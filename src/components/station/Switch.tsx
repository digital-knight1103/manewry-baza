import { add, normal, normalize, scale, sub } from '../../engine/geometry';
import type { Topology } from '../../engine/topology';
import type { SwitchDef } from '../../engine/types';
import { bladeEdges, edgeStub, toPath } from './railGeometry';
import { ACCENT, HALF_GAUGE, LABEL_FONT, NAVY, OUTLINE_COLOR, PULSE_COLOR, ROUTE_HIGHLIGHT } from './style';

interface Props {
  topo: Topology;
  sw: SwitchDef;
  stateIndex: number;
}

const STUB_LENGTH = 34;
/** Switch blade (iglica): length along the active branch and half width at its heel. */
const BLADE = { length: 26, halfWidth: 2.4 };
/** Break in the rails of a branch the switch is not set to: from / to distance from the node. */
const BREAK = { from: 5, to: 11 };
/** Switch id plate offset: above the node and to the right, clear of vehicles on every track through it. */
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
            strokeOpacity={0.3}
            strokeWidth={12}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

/** Blade pointing to the active direction and breaks in the rails of the branches not in use (drawn over the rails). */
export function SwitchPoints({ topo, sw, stateIndex }: Props) {
  const active = new Set(sw.states[stateIndex]?.connections.flat() ?? []);
  const all = new Set(sw.states.flatMap((s) => s.connections.flat()));
  return (
    <g className="switch-points" pointerEvents="none">
      {[...all]
        .filter((e) => !active.has(e))
        .map((edgeId) => {
          const [a, b] = edgeStub(topo, edgeId, sw.node, BREAK.to);
          const u = normalize(sub(b, a));
          const from = add(a, scale(u, BREAK.from));
          return (
            <line key={edgeId} x1={from.x} y1={from.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth={2 * HALF_GAUGE + 2.5} />
          );
        })}
      {bladeEdges(sw, stateIndex).map((edgeId) => {
        const [a, b] = edgeStub(topo, edgeId, sw.node, BLADE.length);
        const n = scale(normal(normalize(sub(b, a))), BLADE.halfWidth);
        return <path key={edgeId} d={toPath([add(a, n), b, sub(a, n)]) + 'Z'} fill={ACCENT} stroke={NAVY} strokeWidth={0.7} strokeLinejoin="round" />;
      })}
    </g>
  );
}

export function SwitchMarker({
  topo,
  sw,
  stateIndex,
  onClick,
  flash = false,
}: Props & { onClick?: (switchId: string) => void; /** Switch just being thrown (scenario playback). */ flash?: boolean }) {
  const node = topo.nodes.get(sw.node)!;
  const state = sw.states[stateIndex];
  const title = `Rozjazd ${sw.id}: ${state?.name ?? '?'}${onClick ? ' – kliknij, aby przełożyć' : ''}`;
  const plateW = 7 + sw.id.length * 6;
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
      {flash && (
        <circle
          className="pulse"
          cx={node.x}
          cy={node.y}
          r={12}
          fill={PULSE_COLOR}
          fillOpacity={0.25}
          stroke={PULSE_COLOR}
          strokeWidth={3}
        />
      )}
      <circle className="switch-dot" cx={node.x} cy={node.y} r={4} fill="#ffffff" stroke={OUTLINE_COLOR} strokeWidth={1.4} />
      <g transform={`translate(${node.x + LABEL_OFFSET.x} ${node.y + LABEL_OFFSET.y})`}>
        <rect x={0} y={-9} width={plateW} height={12} rx={3} fill="#ffffff" stroke={NAVY} strokeWidth={0.9} />
        <text x={plateW / 2} y={0.6} textAnchor="middle" fontFamily={LABEL_FONT} fontSize={9} fontWeight={600} fill={NAVY}>
          {sw.id}
        </text>
      </g>
    </g>
  );
}
