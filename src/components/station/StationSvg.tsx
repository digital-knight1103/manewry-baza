import { forwardRef, type PointerEvent, type ReactNode } from 'react';
import type { ScreenSide, VehicleGap } from '../../engine/control';
import type { Topology } from '../../engine/topology';
import type { StationState } from '../../engine/vehicles';
import { Legend } from '../../ui/Legend';
import { useAppStore } from '../../store/useAppStore';
import { BufferStop, ExitArrow } from './BufferStop';
import { Counters } from './Counters';
import { EdgeTargets, GapTargets, RouteHighlight, TrackPulse } from './DriveLayers';
import { Hall } from './Hall';
import { Labels } from './Labels';
import { StepCaption } from './StepCaption';
import { SwitchMarker, SwitchPoints, SwitchRoute } from './Switch';
import { Sleepers, Track } from './Track';
import { Vehicles } from './Vehicles';

interface Props {
  topo: Topology;
  state: StationState;
  selectedId?: string | null;
  /** Direction arrow drawn next to the driven vehicle. */
  driverArrow?: { id: string; side: ScreenSide } | null;
  onVehiclePointerDown?: (id: string, e: PointerEvent<SVGGElement>) => void;
  onPaletteTypePointerDown?: (typeId: string, e: PointerEvent<SVGGElement>) => void;
  /** Pointer down anywhere not handled by a vehicle or palette entry (they stop propagation). */
  onBackgroundPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  onSwitchClick?: (switchId: string) => void;
  /** Edges of a route to highlight. */
  routeEdges?: string[] | null;
  /** Gaps between touching vehicles, clickable to couple / uncouple. */
  gaps?: VehicleGap[];
  onGapClick?: (a: string, b: string) => void;
  /** When set, every edge is a click target (picking a route target). */
  onEdgePick?: (edgeId: string) => void;
  /** Scenario playback: pulsing vehicles / track edges, switch being thrown, step caption. */
  pulseVehicles?: string[];
  pulseEdges?: string[];
  flashSwitch?: string | null;
  caption?: { title: string; bullets: string[] } | null;
  /** Draw the legend inside the schematic (the presentation shows it outside). */
  legend?: boolean;
  /** Visible part of the schematic; defaults to the layout viewBox. */
  viewBox?: [number, number, number, number];
  className?: string;
  /** Extra overlay drawn on top (drag previews etc.). */
  overlay?: ReactNode;
}

/** Station schematic drawn entirely from station.json, with the current vehicles. */
export const StationSvg = forwardRef<SVGSVGElement, Props>(function StationSvg(
  {
    topo,
    state,
    selectedId = null,
    driverArrow = null,
    onVehiclePointerDown,
    onPaletteTypePointerDown,
    onBackgroundPointerDown,
    onSwitchClick,
    routeEdges,
    gaps,
    onGapClick,
    onEdgePick,
    pulseVehicles,
    pulseEdges,
    flashSwitch = null,
    caption = null,
    legend = true,
    viewBox,
    className,
    overlay,
  },
  ref,
) {
  const { layout } = topo;
  const detailed = useAppStore((s) => s.view) === 'detailed';
  const switchStates = state.switches;
  const stateOf = (id: string, fallback: number) => switchStates[id] ?? fallback;
  return (
    <svg
      ref={ref}
      className={['station-svg', className, onEdgePick && 'picking'].filter(Boolean).join(' ')}
      viewBox={(viewBox ?? layout.viewBox).join(' ')}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={layout.name}
      onPointerDown={onBackgroundPointerDown}
    >
      <rect x={layout.viewBox[0]} y={layout.viewBox[1]} width={layout.viewBox[2]} height={layout.viewBox[3]} fill="#ffffff" />
      {legend && <Legend layout={layout} onTypePointerDown={onPaletteTypePointerDown} wagonsOnly={caption !== null} detailed={detailed} />}
      {caption && <StepCaption key={caption.title} title={caption.title} bullets={caption.bullets} />}
      <Hall hall={layout.hall} />
      {routeEdges && <RouteHighlight topo={topo} edges={routeEdges} />}
      {pulseEdges && pulseEdges.length > 0 && <TrackPulse topo={topo} edges={pulseEdges} />}
      {layout.switches.map((sw) => (
        <SwitchRoute key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
      ))}
      <g pointerEvents="none">
        {layout.edges.map((e) => (
          <Sleepers key={e.id} topo={topo} edgeId={e.id} />
        ))}
        {layout.edges.map((e) => (
          <Track key={e.id} topo={topo} edgeId={e.id} />
        ))}
        {layout.nodes
          .filter((n) => n.type === 'bufferStop')
          .map((n) => (
            <BufferStop key={n.id} topo={topo} node={n} />
          ))}
        {layout.nodes
          .filter((n) => n.type === 'exit')
          .map((n) => (
            <ExitArrow key={n.id} topo={topo} node={n} />
          ))}
        {layout.switches.map((sw) => (
          <SwitchPoints key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
        ))}
      </g>
      <Labels labels={layout.labels} />
      <Counters layout={layout} state={state} />
      <Vehicles
        topo={topo}
        state={state}
        selectedId={selectedId}
        arrow={driverArrow}
        pulseIds={pulseVehicles}
        detailed={detailed}
        onVehiclePointerDown={onVehiclePointerDown}
      />
      {gaps && onGapClick && <GapTargets gaps={gaps} onGapClick={onGapClick} />}
      {layout.switches.map((sw) => (
        <SwitchMarker
          key={sw.id}
          topo={topo}
          sw={sw}
          stateIndex={stateOf(sw.id, sw.default)}
          onClick={onSwitchClick}
          flash={sw.id === flashSwitch}
        />
      ))}
      {onEdgePick && <EdgeTargets topo={topo} onEdgePick={onEdgePick} />}
      {overlay}
    </svg>
  );
});
