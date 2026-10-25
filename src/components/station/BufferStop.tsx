import { add, normal, scale } from '../../engine/geometry';
import { directionAwayFrom, type Topology } from '../../engine/topology';
import type { StationNode } from '../../engine/types';
import { toPath } from './railGeometry';
import { HALF_GAUGE, LABEL_FONT, NAVY } from './style';

interface Props {
  topo: Topology;
  node: StationNode;
}

const BEAM = { halfLength: HALF_GAUGE + 4.5, depth: 3.2 };
const BRACE = 7;

/** Buffer stop (kozioł oporowy) at the dead end of a track: red-white beam with braces behind it. */
export function BufferStop({ topo, node }: Props) {
  const edgeId = topo.edgesAtNode.get(node.id)?.[0];
  if (!edgeId) return null;
  const inward = directionAwayFrom(topo, edgeId, node.id);
  const n = normal(inward);
  const at =(along: number, across: number) => add(add(node, scale(inward, along)), scale(n, across));
  const beam = [at(0, BEAM.halfLength), at(-BEAM.depth, BEAM.halfLength), at(-BEAM.depth, -BEAM.halfLength), at(0, -BEAM.halfLength)];
  const back = -BEAM.depth - BRACE;
  const brace = [at(-BEAM.depth, HALF_GAUGE + 2), at(back, HALF_GAUGE - 1), at(back, -HALF_GAUGE + 1), at(-BEAM.depth, -HALF_GAUGE - 2)];
  return (
    <g className="buffer-stop">
      <title>Kozioł oporowy</title>
      <path d={toPath(brace) + 'Z'} fill="#6b7280" stroke={NAVY} strokeWidth={0.7} strokeLinejoin="round" />
      <path d={toPath(beam) + 'Z'} fill="#d32f2f" stroke={NAVY} strokeWidth={0.8} />
      <path d={toPath([at(-BEAM.depth / 2, 2), at(-BEAM.depth / 2, -2)])} stroke="#ffffff" strokeWidth={BEAM.depth - 1.2} />
    </g>
  );
}

/** Arrow „do stacji” at a track end that leads off the schematic (exit node). */
export function ExitArrow({ topo, node }: Props) {
  const edgeId = topo.edgesAtNode.get(node.id)?.[0];
  if (!edgeId) return null;
  const inward = directionAwayFrom(topo, edgeId, node.id);
  const out = scale(inward, -1);
  const n = normal(inward);
  // Above the track (screen up), a little inside the schematic.
  const up = n.y < 0 ? n : scale(n, -1);
  const base = add(add(node, scale(inward, 12)), scale(up, 16));
  const p = (along: number, across: number) => add(add(base, scale(out, along)), scale(up, across));
  const arrow = [p(0, 2), p(14, 2), p(14, 5), p(22, 0), p(14, -5), p(14, -2), p(0, -2)];
  const textAt = add(base, scale(inward, 6));
  const leftward = out.x < 0;
  return (
    <g className="exit-arrow" pointerEvents="none">
      <title>Do stacji</title>
      <path d={toPath(arrow) + 'Z'} fill={NAVY} />
      <text
        x={textAt.x}
        y={textAt.y + 4}
        textAnchor={leftward ? 'start' : 'end'}
        fontFamily={LABEL_FONT}
        fontSize={11}
        fontWeight={600}
        fill={NAVY}
      >
        do stacji
      </text>
    </g>
  );
}
