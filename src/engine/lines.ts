import { distance } from './geometry';
import { activeConnections, edgePolyline, pointAt, type Topology } from './topology';
import type { Point, SwitchStates } from './types';

/**
 * A track line is a maximal chain of edges joined through currently active connections
 * (switch states and boundaries). It gives every point on the chain a 1-D coordinate `u`,
 * which turns placement, collisions and dragging into interval arithmetic.
 */
export interface LineSegment {
  edge: string;
  /** True when the line runs from the edge's `to` node towards its `from` node. */
  reversed: boolean;
  /** Line coordinate of the segment start. */
  u0: number;
  length: number;
}

export interface TrackLine {
  id: string;
  segments: LineSegment[];
  length: number;
}

export interface TrackPos {
  edge: string;
  /** Distance from the edge's `from` node. */
  s: number;
}

/** Edge joined to `edgeId` at `nodeId` under the given switch states, or null for a dead end. */
export function connectedEdge(topo: Topology, switches: SwitchStates, edgeId: string, nodeId: string): string | null {
  const pairs: [string, string][] = [];
  for (const sw of topo.layout.switches) if (sw.node === nodeId) pairs.push(...activeConnections(topo, sw.id, switches));
  for (const b of topo.layout.boundaries) if (b.node === nodeId) pairs.push(...b.connections);
  for (const [a, b] of pairs) {
    if (a === edgeId) return b;
    if (b === edgeId) return a;
  }
  return null;
}

/** Splits all edges into track lines under the given switch states. */
export function buildLines(topo: Topology, switches: SwitchStates): TrackLine[] {
  const seen = new Set<string>();
  const lines: TrackLine[] = [];
  for (const start of topo.layout.edges) {
    if (seen.has(start.id)) continue;
    // Walk backwards (through the `from` end) to the first edge of the chain.
    let edgeId = start.id;
    let reversed = false;
    const visited = new Set([edgeId]);
    for (;;) {
      const e = topo.edges.get(edgeId)!;
      const backNode: string = reversed ? e.to : e.from;
      const prev = connectedEdge(topo, switches, edgeId, backNode);
      if (!prev || visited.has(prev)) break;
      const p = topo.edges.get(prev)!;
      // The previous edge must end at backNode when walked forward.
      reversed = p.from === backNode;
      edgeId = prev;
      visited.add(prev);
    }
    // Walk forward collecting segments.
    const segments: LineSegment[] = [];
    let u = 0;
    for (;;) {
      const len = topo.edgeLength.get(edgeId)!;
      segments.push({ edge: edgeId, reversed, u0: u, length: len });
      seen.add(edgeId);
      u += len;
      const e = topo.edges.get(edgeId)!;
      const frontNode = reversed ? e.from : e.to;
      const next = connectedEdge(topo, switches, edgeId, frontNode);
      if (!next || seen.has(next)) break;
      reversed = topo.edges.get(next)!.to === frontNode;
      edgeId = next;
    }
    lines.push({ id: segments.map((s) => s.edge).join('+'), segments, length: u });
  }
  return lines;
}

export function lineOfEdge(lines: TrackLine[], edgeId: string): TrackLine {
  const line = lines.find((l) => l.segments.some((s) => s.edge === edgeId));
  if (!line) throw new Error(`Nieznany odcinek ${edgeId}`);
  return line;
}

function segmentOf(line: TrackLine, edgeId: string): LineSegment {
  const seg = line.segments.find((s) => s.edge === edgeId);
  if (!seg) throw new Error(`Odcinek ${edgeId} nie należy do linii ${line.id}`);
  return seg;
}

/** Line coordinate of a position; linear, so offsets beyond the edge ends extrapolate. */
export function toU(line: TrackLine, pos: TrackPos): number {
  const seg = segmentOf(line, pos.edge);
  return seg.u0 + (seg.reversed ? seg.length - pos.s : pos.s);
}

/** Edge position of line coordinate `u` (clamped to the line). */
export function fromU(line: TrackLine, u: number): TrackPos {
  const clamped = Math.min(Math.max(u, 0), line.length);
  const seg = line.segments.find((s) => clamped <= s.u0 + s.length) ?? line.segments[line.segments.length - 1]!;
  const along = clamped - seg.u0;
  return { edge: seg.edge, s: seg.reversed ? seg.length - along : along };
}

export function pointAtU(topo: Topology, line: TrackLine, u: number): Point {
  const pos = fromU(line, u);
  return pointAt(topo, pos.edge, pos.s);
}

/** Points of the line between coordinates `a` < `b`, including bends at nodes in between. */
export function linePath(topo: Topology, line: TrackLine, a: number, b: number): Point[] {
  const pts: Point[] = [pointAtU(topo, line, a)];
  for (const seg of line.segments) {
    const poly = edgePolyline(topo, seg.edge);
    const ordered = seg.reversed ? [...poly].reverse() : poly;
    let u = seg.u0;
    for (let i = 1; i < ordered.length; i++) {
      u += distance(ordered[i - 1]!, ordered[i]!);
      if (u > a && u < b) pts.push(ordered[i]!);
    }
  }
  pts.push(pointAtU(topo, line, b));
  return pts;
}

/** Nearest point on the line to `p`: its coordinate and the distance from `p`. */
export function projectOnLine(topo: Topology, line: TrackLine, p: Point): { u: number; dist: number } {
  let best = { u: 0, dist: Infinity };
  for (const seg of line.segments) {
    const poly = edgePolyline(topo, seg.edge);
    const ordered = seg.reversed ? [...poly].reverse() : poly;
    let u = seg.u0;
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1]!;
      const b = ordered[i]!;
      const len = distance(a, b);
      const k = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)));
      const q = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      const d = distance(p, q);
      if (d < best.dist) best = { u: u + k * len, dist: d };
      u += len;
    }
  }
  return best;
}

/** Track line closest to `p` together with the projected coordinate. */
export function nearestLine(topo: Topology, lines: TrackLine[], p: Point): { line: TrackLine; u: number; dist: number } | null {
  let best: { line: TrackLine; u: number; dist: number } | null = null;
  for (const line of lines) {
    const pr = projectOnLine(topo, line, p);
    if (!best || pr.dist < best.dist) best = { line, ...pr };
  }
  return best;
}
