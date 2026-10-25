import { add, intersectLines, isParallel, normal, normalize, scale, sub, type Vec } from '../../engine/geometry';
import { directionAwayFrom, edgePolyline, pointAt, type Topology } from '../../engine/topology';
import type { Point, SwitchDef } from '../../engine/types';

/**
 * Direction along which the rails of `edgeId` are cut at `nodeId`: the direction of the first
 * other edge at that node which is clearly not parallel. Cutting both edges along the same line
 * makes the rails meet without gaps, like on the reference drawings (diagonal rails end
 * on the horizontal track). Returns null when only collinear edges meet (plain perpendicular cut).
 */
function cutDirection(topo: Topology, nodeId: string, edgeId: string): Vec | null {
  const own = directionAwayFrom(topo, edgeId, nodeId);
  for (const other of topo.edgesAtNode.get(nodeId) ?? []) {
    if (other === edgeId) continue;
    const dir = directionAwayFrom(topo, other, nodeId);
    if (!isParallel(own, dir, 0.2)) return dir;
  }
  return null;
}

/** The two rails of an edge as polylines, offset by ±halfGauge from the centreline. */
export function railLines(topo: Topology, edgeId: string, halfGauge: number): [Point[], Point[]] {
  const pts = edgePolyline(topo, edgeId);
  const edge = topo.edges.get(edgeId)!;
  const startCut = cutDirection(topo, edge.from, edgeId);
  const endCut = cutDirection(topo, edge.to, edgeId);

  const rail = (side: 1 | -1): Point[] => {
    const lines = pts.slice(1).map((b, i) => {
      const a = pts[i]!;
      const u = normalize(sub(b, a));
      return { p: add(a, scale(normal(u), side * halfGauge)), u };
    });
    const first = lines[0]!;
    const last = lines[lines.length - 1]!;
    const out: Point[] = [];
    out.push((startCut && intersectLines(first.p, first.u, pts[0]!, startCut)) || first.p);
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1]!;
      const cur = lines[i]!;
      out.push(intersectLines(prev.p, prev.u, cur.p, cur.u) ?? cur.p);
    }
    const lastPt = pts[pts.length - 1]!;
    const lastOffset = add(lastPt, scale(normal(last.u), side * halfGauge));
    out.push((endCut && intersectLines(last.p, last.u, lastPt, endCut)) || lastOffset);
    return out;
  };

  return [rail(1), rail(-1)];
}

/** Short piece of the edge starting at `nodeId`, used to highlight the active switch route. */
export function edgeStub(topo: Topology, edgeId: string, nodeId: string, stubLength: number): [Point, Point] {
  const edge = topo.edges.get(edgeId)!;
  const len = topo.edgeLength.get(edgeId)!;
  const s = Math.min(stubLength, len);
  return edge.from === nodeId
    ? [pointAt(topo, edgeId, 0), pointAt(topo, edgeId, s)]
    : [pointAt(topo, edgeId, len), pointAt(topo, edgeId, len - s)];
}

export const toPath = (points: Point[]): string =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

/** Polyline offset sideways by `d` (positive = left normal), with mitred joints. */
export function offsetPolyline(points: Point[], d: number): Point[] {
  const lines = points.slice(1).map((b, i) => {
    const a = points[i]!;
    const u = normalize(sub(b, a));
    return { p: add(a, scale(normal(u), d)), u };
  });
  const out: Point[] = [lines[0]!.p];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1]!;
    const cur = lines[i]!;
    out.push(intersectLines(prev.p, prev.u, cur.p, cur.u) ?? cur.p);
  }
  const last = lines[lines.length - 1]!;
  out.push(add(points[points.length - 1]!, scale(normal(last.u), d)));
  return out;
}

/** Closed outline of a band of width 2·halfWidth around a centreline (vehicle body). */
export function bandOutline(points: Point[], halfWidth: number): Point[] {
  return [...offsetPolyline(points, halfWidth), ...offsetPolyline(points, -halfWidth).reverse()];
}

/**
 * Edges the blades of the active state point along: of each connected pair the edge used by
 * fewer states (the branch, not the common trunk); on a tie the second one.
 */
export function bladeEdges(sw: SwitchDef, stateIndex: number): string[] {
  const uses = new Map<string, number>();
  for (const s of sw.states) for (const e of new Set(s.connections.flat())) uses.set(e, (uses.get(e) ?? 0) + 1);
  return (sw.states[stateIndex]?.connections ?? []).map(([a, b]) => ((uses.get(a) ?? 0) < (uses.get(b) ?? 0) ? a : b));
}
