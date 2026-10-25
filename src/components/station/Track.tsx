import type { Topology } from '../../engine/topology';
import { railLines, toPath } from './railGeometry';
import { HALF_GAUGE, RAIL_COLOR, RAIL_WIDTH } from './style';

interface Props {
  topo: Topology;
  edgeId: string;
}

export function Track({ topo, edgeId }: Props) {
  const [left, right] = railLines(topo, edgeId, HALF_GAUGE);
  const edge = topo.edges.get(edgeId)!;
  return (
    <g className="track" data-edge={edgeId}>
      <title>{edge.track === 'łącznik' ? 'łącznik' : `tor ${edge.track}`}</title>
      <path d={toPath(left)} stroke={RAIL_COLOR} strokeWidth={RAIL_WIDTH} fill="none" />
      <path d={toPath(right)} stroke={RAIL_COLOR} strokeWidth={RAIL_WIDTH} fill="none" />
    </g>
  );
}
