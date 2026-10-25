import type { Topology } from '../../engine/topology';
import type { SwitchDef } from '../../engine/types';
import { edgeStub } from './railGeometry';
import { OUTLINE_COLOR, ROUTE_HIGHLIGHT } from './style';

interface Props {
  topo: Topology;
  sw: SwitchDef;
  stateIndex: number;
}

const STUB_LENGTH = 34;
/** Switch id label offset: above the node and to the right, clear of vehicles on every track through it. */
const LABEL_OFFSET = { x: 8, y: -14 };

/** Switch marker with the currently active route lightly highlighted. */
export function SwitchRoute({ topo, sw, stateIndex }: Props) {
  const state = sw.states[stateIndex];
  if (!state) return null;
  return (
    <g className="switch-route" pointerEvents="none">
      {state.connections.flat().map((edgeId) => {
        const [a, b] = edgeStub(topo, edgeId, sw.node, STUB_LENGTH);
        return (
          <line
            key={edgeId}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={ROUTE_HIGHLIGHT}
            strokeOpacity={0.4}
            strokeWidth={12}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

export function SwitchMarker({ topo, sw, stateIndex, onClick }: Props & { onClick?: (switchId: string) => void }) {
  const node = topo.nodes.get(sw.node)!;
  const state = sw.states[stateIndex];
  const title = `Rozjazd ${sw.id}: ${state?.name ?? '?'}${onClick ? ' – kliknij, aby przełożyć' : ''}`;
  return (
    <g
      className={`switch-marker${onClick ? ' clickable' : ''}`}
      data-switch={sw.id}
      onPointerDown={
        onClick &&
        ((e) => {
          e.stopPropagation();
          onClick(sw.id);
        })
      }
    >
      <title>{title}</title>
      {onClick && <circle cx={node.x} cy={node.y} r={11} fill="transparent" />}
      <circle className="switch-dot" cx={node.x} cy={node.y} r={4.5} fill="#ffffff" stroke={OUTLINE_COLOR} strokeWidth={1.2} />
      <text x={node.x + LABEL_OFFSET.x} y={node.y + LABEL_OFFSET.y} fontSize={10} fill="#555">
        {sw.id}
      </text>
    </g>
  );
}
