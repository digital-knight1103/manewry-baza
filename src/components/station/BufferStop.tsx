import { add, normal, scale } from '../../engine/geometry';
import { directionAwayFrom, type Topology } from '../../engine/topology';
import type { StationNode } from '../../engine/types';
import { HALF_GAUGE, RAIL_COLOR } from './style';

interface Props {
  topo: Topology;
  node: StationNode;
}

/** Short bar across the rails at the dead end of a track. */
export function BufferStop({ topo, node }: Props) {
  const edgeId = topo.edgesAtNode.get(node.id)?.[0];
  if (!edgeId) return null;
  const n = normal(directionAwayFrom(topo, edgeId, node.id));
  const a = add(node, scale(n, HALF_GAUGE + 3));
  const b = add(node, scale(n, -(HALF_GAUGE + 3)));
  return (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={RAIL_COLOR} strokeWidth={2.5}>
      <title>Kozioł oporowy</title>
    </line>
  );
}
