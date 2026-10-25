import type { VehicleGap } from '../../engine/control';
import { edgePolyline, type Topology } from '../../engine/topology';
import { toPath } from './railGeometry';
import { PULSE_COLOR } from './style';

/** Route set with „Ustaw drogę”, drawn under the rails. */
export function RouteHighlight({ topo, edges }: { topo: Topology; edges: string[] }) {
  return (
    <g className="route-highlight" pointerEvents="none">
      {edges.map((id) => (
        <path
          key={id}
          d={toPath(edgePolyline(topo, id))}
          stroke="#2E86DE"
          strokeOpacity={0.28}
          strokeWidth={16}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </g>
  );
}

/** Pulsing highlight of whole tracks (scenario action „highlight” with a track). */
export function TrackPulse({ topo, edges }: { topo: Topology; edges: string[] }) {
  return (
    <g pointerEvents="none">
      {edges.map((id) => (
        <path
          key={id}
          className="pulse"
          d={toPath(edgePolyline(topo, id))}
          stroke={PULSE_COLOR}
          strokeOpacity={0.35}
          strokeWidth={26}
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </g>
  );
}

/** Click targets on the gaps between touching vehicles: uncouple (scissors) or couple. */
export function GapTargets({ gaps, onGapClick }: { gaps: VehicleGap[]; onGapClick: (a: string, b: string) => void }) {
  return (
    <g className="gap-targets">
      {gaps.map((g) => (
        <path
          key={`${g.a}|${g.b}`}
          className={`gap-target ${g.coupled ? 'coupled' : 'uncoupled'}`}
          d={toPath(g.path)}
          stroke="transparent"
          strokeWidth={26}
          fill="none"
          pointerEvents="stroke"
          onPointerDown={(e) => {
            e.stopPropagation();
            onGapClick(g.a, g.b);
          }}
        >
          <title>{g.coupled ? `Rozprzęgnij ${g.a} | ${g.b}` : `Sprzęgnij ${g.a} z ${g.b}`}</title>
        </path>
      ))}
    </g>
  );
}

/** Wide click targets on every edge while picking the target track of „Ustaw drogę”. */
export function EdgeTargets({ topo, onEdgePick }: { topo: Topology; onEdgePick: (edgeId: string) => void }) {
  return (
    <g className="edge-targets">
      {topo.layout.edges.map((e) => (
        <path
          key={e.id}
          className="edge-target"
          d={toPath(edgePolyline(topo, e.id))}
          stroke="transparent"
          strokeWidth={22}
          fill="none"
          pointerEvents="stroke"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            onEdgePick(e.id);
          }}
        >
          <title>{`Ustaw drogę na: ${e.name ?? e.id}`}</title>
        </path>
      ))}
    </g>
  );
}
