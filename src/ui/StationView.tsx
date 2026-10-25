import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { StationSvg } from '../components/station/StationSvg';
import { VehicleGhost } from '../components/station/Vehicles';
import { vehicleGaps } from '../engine/control';
import { findDropPosition, type DropTarget } from '../engine/edit';
import { buildLines, lineOfEdge, projectOnLine, toU } from '../engine/lines';
import type { Point } from '../engine/types';
import { vehicleLength, vehicleType } from '../engine/vehicles';
import { useAppStore } from '../store/useAppStore';
import { useDriveStore } from '../store/useDriveStore';
import { captionStepIndex, scenarioViewState, useScenarioStore } from '../store/useScenarioStore';
import { useStationStore } from '../store/useStationStore';

/** Pointer travel (screen px) below which a press on a vehicle counts as a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

interface PaletteDrag {
  typeId: string;
  point: Point;
  target: DropTarget | null;
}

/** Listens on window until the pointer is released, so drags continue outside the SVG. */
function trackPointer(onMove: (e: globalThis.PointerEvent) => void, onUp: (e: globalThis.PointerEvent) => void) {
  const up = (e: globalThis.PointerEvent) => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onUp(e);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

/**
 * Station schematic with the interactions of the current mode (edit: palette, dragging; drive and
 * scenario recording: driving, switches, couplings; scenario playback: animation with captions).
 */
export function StationView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const editing = useAppStore((s) => s.mode === 'edit');
  const recording = useScenarioStore((s) => s.recording);
  const playingScenario = useAppStore((s) => s.mode === 'scenario') && !recording;
  const driving = useAppStore((s) => s.mode === 'drive') || recording;
  const topo = useStationStore((s) => s.topo);
  const state = useStationStore((s) => s.state);
  const selectedId = useStationStore((s) => s.selectedId);
  const driverId = useDriveStore((s) => s.driverId);
  const side = useDriveStore((s) => s.side);
  const route = useDriveStore((s) => s.route);
  const pickingRoute = useDriveStore((s) => s.pickingRoute);
  const gaps = useMemo(() => (driving ? vehicleGaps(topo, state) : []), [driving, topo, state]);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDrag | null>(null);

  const toSvgPoint = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: clientX, y: clientY };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const onPaletteTypePointerDown = (typeId: string, e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const update = (clientX: number, clientY: number) => {
      const point = toSvgPoint(clientX, clientY);
      const target = findDropPosition(topo, useStationStore.getState().state, typeId, point);
      setPaletteDrag({ typeId, point, target });
      return target;
    };
    update(e.clientX, e.clientY);
    trackPointer(
      (ev) => update(ev.clientX, ev.clientY),
      (ev) => {
        const target = ev.type === 'pointerup' ? update(ev.clientX, ev.clientY) : null;
        setPaletteDrag(null);
        if (target) useStationStore.getState().addVehicle(typeId, target.pos);
      },
    );
  };

  const onVehiclePointerDown = (id: string, e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const store = useStationStore.getState();
    store.select(id);
    const vehicle = store.state.vehicles[id];
    if (!vehicle) return;
    const line = lineOfEdge(buildLines(topo, store.state.switches), vehicle.pos.edge);
    const grabOffset = toU(line, vehicle.pos) - projectOnLine(topo, line, toSvgPoint(e.clientX, e.clientY)).u;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    trackPointer(
      (ev) => {
        if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        moved = true;
        const s = useStationStore.getState();
        const current = s.state.vehicles[id];
        if (!current) return;
        const target = projectOnLine(topo, line, toSvgPoint(ev.clientX, ev.clientY)).u + grabOffset;
        s.dragBy(id, target - toU(line, current.pos));
      },
      () => {
        if (moved) useStationStore.getState().endDrag(id);
      },
    );
  };

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
      const s = useStationStore.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        e.preventDefault();
        s.removeVehicle(s.selectedId);
      } else if (e.key === 'Escape') s.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  let overlay = null;
  if (paletteDrag) {
    const { typeId, point, target } = paletteDrag;
    const half = vehicleLength(topo.layout, typeId) / 2;
    const path = target?.ends ?? [
      { x: point.x - half, y: point.y },
      { x: point.x + half, y: point.y },
    ];
    overlay = <VehicleGhost path={path} color={vehicleType(topo.layout, typeId).color} valid={target !== null} />;
  }

  const drive = useDriveStore.getState();
  const driverExists = driverId !== null && state.vehicles[driverId] !== undefined;

  if (playingScenario) return <ScenarioSvg />;

  if (driving) {
    return (
      <StationSvg
        ref={svgRef}
        className="driving"
        topo={topo}
        state={state}
        selectedId={driverExists ? driverId : null}
        driverArrow={driverExists ? { id: driverId, side } : null}
        onVehiclePointerDown={(id, e) => {
          e.stopPropagation();
          drive.clickVehicle(id);
        }}
        onSwitchClick={drive.toggleSwitch}
        routeEdges={route}
        gaps={gaps}
        onGapClick={drive.toggleCoupling}
        onEdgePick={pickingRoute ? drive.routeTo : undefined}
      />
    );
  }

  return (
    <StationSvg
      ref={svgRef}
      topo={topo}
      state={state}
      selectedId={editing ? selectedId : null}
      onVehiclePointerDown={editing ? onVehiclePointerDown : undefined}
      onPaletteTypePointerDown={editing ? onPaletteTypePointerDown : undefined}
      onBackgroundPointerDown={editing ? () => useStationStore.getState().select(null) : undefined}
      overlay={overlay}
    />
  );
}

/** Scenario playback: snapshot or animation frame, caption of the step, route / switch / highlight of the current action. */
function ScenarioSvg() {
  const topo = useStationStore((s) => s.topo);
  const state = useScenarioStore(scenarioViewState);
  const captionIndex = useScenarioStore(captionStepIndex);
  const step = useScenarioStore((s) => (captionIndex === null ? undefined : s.active()?.steps[captionIndex]));
  const anim = useScenarioStore((s) => s.playback?.anim ?? null);
  return (
    <StationSvg
      topo={topo}
      state={state}
      caption={step ? { title: step.title, bullets: step.bullets } : null}
      routeEdges={anim?.route ?? null}
      flashSwitch={anim?.switchId ?? null}
      pulseVehicles={anim?.highlight?.vehicles}
      pulseEdges={anim?.highlight?.edges}
    />
  );
}
