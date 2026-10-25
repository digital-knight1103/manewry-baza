import { forwardRef, type PointerEvent, type ReactNode } from 'react';
import type { Topology } from '../../engine/topology';
import type { StationState } from '../../engine/vehicles';
import { Legend } from '../../ui/Legend';
import { BufferStop } from './BufferStop';
import { Counters } from './Counters';
import { Hall } from './Hall';
import { Labels } from './Labels';
import { SwitchMarker, SwitchRoute } from './Switch';
import { Track } from './Track';
import { Vehicles } from './Vehicles';

interface Props {
  topo: Topology;
  state: StationState;
  selectedId?: string | null;
  onVehiclePointerDown?: (id: string, e: PointerEvent<SVGGElement>) => void;
  onPaletteTypePointerDown?: (typeId: string, e: PointerEvent<SVGGElement>) => void;
  /** Pointer down anywhere not handled by a vehicle or palette entry (they stop propagation). */
  onBackgroundPointerDown?: (e: PointerEvent<SVGSVGElement>) => void;
  /** Extra overlay drawn on top (drag previews etc.). */
  overlay?: ReactNode;
}

/** Station schematic drawn entirely from station.json, with the current vehicles. */
export const StationSvg = forwardRef<SVGSVGElement, Props>(function StationSvg(
  { topo, state, selectedId = null, onVehiclePointerDown, onPaletteTypePointerDown, onBackgroundPointerDown, overlay },
  ref,
) {
  const { layout } = topo;
  const switchStates = state.switches;
  const stateOf = (id: string, fallback: number) => switchStates[id] ?? fallback;
  return (
    <svg
      ref={ref}
      className="station-svg"
      viewBox={layout.viewBox.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={layout.name}
      onPointerDown={onBackgroundPointerDown}
    >
      <rect
        x={layout.viewBox[0]}
        y={layout.viewBox[1]}
        width={layout.viewBox[2]}
        height={layout.viewBox[3]}
        fill="#ffffff"
      />
      <Legend layout={layout} onTypePointerDown={onPaletteTypePointerDown} />
      <Hall hall={layout.hall} />
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
      {layout.switches.map((sw) => (
        <SwitchMarker key={sw.id} topo={topo} sw={sw} stateIndex={stateOf(sw.id, sw.default)} />
      ))}
      <Labels labels={layout.labels} />
      <Counters layout={layout} state={state} />
      <Vehicles topo={topo} state={state} selectedId={selectedId} onVehiclePointerDown={onVehiclePointerDown} />
      {overlay}
    </svg>
  );
});
