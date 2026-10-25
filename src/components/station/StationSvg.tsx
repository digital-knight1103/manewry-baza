import { forwardRef, type PointerEvent, type ReactNode } from 'react';
import type { ScreenSide, VehicleGap } from '../../engine/control';
import type { Topology } from '../../engine/topology';
import type { StationState } from '../../engine/vehicles';
import { Legend } from '../../ui/Legend';
import { BufferStop } from './BufferStop';
import { Counters } from './Counters';
import { EdgeTargets, GapTargets, RouteHighlight, TrackPulse } from './DriveLayers';
import { Hall } from './Hall';
import { Labels } from './Labels';
import { StepCaption } from './StepCaption';
import { SwitchMarker, SwitchRoute } from './Switch';
import { Track } from './Track';
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
    className,
    overlay,
  },
  ref,
) {
  const { layout } = topo;
  const switchStates = state.switches;
  const stateOf = (id: string, fallback: number) => switchStates[id] ?? fallback;
  return (
    <svg
      ref={ref}
      className={['station-svg', className, onEdgePick && 'picking'].filter(Boolean).join(' ')}
      viewBox={layout.viewBox.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={layout.name}
      onPointerDown={onBackgroundPointerDown}
    >
      <rect x={layout.viewBox[0]} y={layout.viewBox[1]} width={layout.viewBox[2]} height={layout.viewBox[3]} fill="#ffffff" />
      <Legend layout={layout} onTypePointerDown={onPaletteTypePointerDown} wagonsOnly={caption !== null} />
      {caption && <StepCaption title={caption.title} bullets={caption.bullets} />}
      <Hall hall={layout.hall} />
      {routeEdges && <RouteHighlight topo={topo} edges={routeEdges} />}
      {pulseEdges && pulseEdges.length > 0 && <TrackPulse topo={topo} edges={pulseEdges} />}
      {layout.switches.map((sw) => (
        <SwitchRoute key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
      ))}
      <g pointerEvents="none">
        {layout.edges.map((e) => (
          <Track key={e.id} topo={topo} edgeId={e.id} />
        ))}
        {layout.nodes
          .filter((n) => n.type === 'bufferStop')
          .map((n) => (
            <BufferStop key={n.id} topo={topo} node={n} />
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
