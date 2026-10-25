import { normal, normalize, sub } from '../../engine/geometry';
import { pointAt, type Topology } from '../../engine/topology';
import { railLines, toPath } from './railGeometry';
import { HALF_GAUGE, RAIL_COLOR, RAIL_WIDTH, SLEEPER_COLOR, SLEEPER_STEP } from './style';

interface Props {
  topo: Topology;
  edgeId: string;
}

/** How far sleepers stick out beyond the rails. */
const SLEEPER_OVERHANG = 2.6;

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

/** Light sleepers across the track every SLEEPER_STEP, drawn under all rails. */
export function Sleepers({ topo, edgeId }: Props) {
  const len = topo.edgeLength.get(edgeId)!;
  const half = HALF_GAUGE + SLEEPER_OVERHANG;
  let d = '';
  for (let s = SLEEPER_STEP / 2; s < len; s += SLEEPER_STEP) {
    const p = pointAt(topo, edgeId, s);
    const n = normal(normalize(sub(pointAt(topo, edgeId, Math.min(len, s + 0.5)), pointAt(topo, edgeId, Math.max(0, s - 0.5)))));
    d += `M${(p.x + n.x * half).toFixed(1)} ${(p.y + n.y * half).toFixed(1)}L${(p.x - n.x * half).toFixed(1)} ${(p.y - n.y * half).toFixed(1)}`;
  }
  return <path d={d} stroke={SLEEPER_COLOR} strokeWidth={2} fill="none" />;
}
