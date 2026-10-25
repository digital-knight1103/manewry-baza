// Pure edit-mode operations on StationState: adding, filling, removing, dragging, coupling.
import { buildLines, fromU, lineOfEdge, nearestLine, pointAtU, toU, type TrackLine, type TrackPos } from './lines';
import type { Topology } from './topology';
import type { Point } from './types';
import { bodyOnLine, couplingGap, EPS, nextVehicleId, vehicleLength, type StationState, type Vehicle } from './vehicles';

/** Max distance (schematic units) from a track at which a dropped vehicle still lands on it. */
export const DROP_RADIUS = 30;
/** Gaps smaller than this are closed so that vehicles touch (and couple). */
export const SNAP_DISTANCE = 12;
/** Bodies closer than gap + this are considered touching. */
export const TOUCH_TOLERANCE = 0.5;

interface Body {
  id: string;
  a: number;
  b: number;
  u: number;
}

const onLine = (line: TrackLine, v: Vehicle) => line.segments.some((s) => s.edge === v.pos.edge);

/** Bodies of vehicles centred on `line`, sorted along it. */
function bodies(topo: Topology, state: StationState, line: TrackLine, exclude: ReadonlySet<string> = new Set()): Body[] {
  return Object.values(state.vehicles)
    .filter((v) => !exclude.has(v.id) && onLine(line, v))
    .map((v) => ({ id: v.id, ...bodyOnLine(topo.layout, line, v) }))
    .sort((x, y) => x.a - y.a);
}

/** Intervals of feasible centre coordinates for a body of length `len` among `obstacles`. */
function freeCentres(line: TrackLine, obstacles: Body[], len: number, gap: number): [number, number][] {
  const half = len / 2;
  const out: [number, number][] = [];
  let lo = half;
  for (const o of obstacles) {
    const hi = o.a - gap - half;
    if (hi >= lo - EPS) out.push([lo, Math.max(lo, hi)]);
    lo = Math.max(lo, o.b + gap + half);
  }
  if (line.length - half >= lo - EPS) out.push([lo, line.length - half]);
  return out;
}

/** Nearest feasible centre to `u`, snapped to a neighbour or track end when closer than SNAP_DISTANCE. */
function nearestFreeCentre(ranges: [number, number][], u: number): number | null {
  let best: number | null = null;
  for (const [lo, hi] of ranges) {
    const c = Math.min(Math.max(u, lo), hi);
    if (best === null || Math.abs(c - u) < Math.abs(best - u)) best = c;
  }
  if (best === null) return null;
  const range = ranges.find(([lo, hi]) => best! >= lo - EPS && best! <= hi + EPS)!;
  const toLo = best - range[0];
  const toHi = range[1] - best;
  if (toLo <= toHi && toLo < SNAP_DISTANCE) return range[0];
  if (toHi < SNAP_DISTANCE) return range[1];
  return best;
}

export interface DropTarget {
  pos: TrackPos;
  /** Vehicle body as two end points, for drawing a preview. */
  ends: [Point, Point];
}

/** Where a vehicle of `typeId` dropped at point `p` would land, or null when off-track / no room. */
export function findDropPosition(topo: Topology, state: StationState, typeId: string, p: Point): DropTarget | null {
  const lines = buildLines(topo, state.switches);
  const near = nearestLine(topo, lines, p);
  if (!near || near.dist > DROP_RADIUS) return null;
  const len = vehicleLength(topo.layout, typeId);
  const ranges = freeCentres(near.line, bodies(topo, state, near.line), len, couplingGap(topo.layout));
  const u = nearestFreeCentre(ranges, near.u);
  if (u === null) return null;
  return {
    pos: fromU(near.line, u),
    ends: [pointAtU(topo, near.line, u - len / 2), pointAtU(topo, near.line, u + len / 2)],
  };
}

export interface EditOptions {
  /** Couple vehicles that end up touching. */
  autoCouple: boolean;
}

/** Adds a vehicle at `pos` (assumed free, e.g. from findDropPosition). */
export function addVehicle(
  topo: Topology,
  state: StationState,
  typeId: string,
  pos: TrackPos,
  opts: EditOptions,
): { state: StationState; id: string } {
  const id = nextVehicleId(topo.layout, state, typeId);
  let next: StationState = {
    ...state,
    vehicles: { ...state.vehicles, [id]: { id, type: typeId, pos } },
    consists: [...state.consists, [id]],
  };
  if (opts.autoCouple) next = coupleTouching(topo, next, [id]);
  return { state: next, id };
}

export type FillDirection = 'auto' | 'left' | 'right';

/**
 * Adds `count` vehicles of `typeId` with centres on `edgeId`, packed towards one of its ends
 * (directly behind vehicles already standing there). Stops early when the edge is full.
 */
export function fillEdge(
  topo: Topology,
  state: StationState,
  edgeId: string,
  typeId: string,
  count: number,
  direction: FillDirection,
  opts: EditOptions,
): { state: StationState; added: string[] } {
  const lines = buildLines(topo, state.switches);
  const line = lineOfEdge(lines, edgeId);
  const seg = line.segments.find((s) => s.edge === edgeId)!;
  const towardEnd = packTowardEnd(topo, line, seg.edge, direction);
  const len = vehicleLength(topo.layout, typeId);
  const gap = couplingGap(topo.layout);

  const segStart = seg.u0;
  const segEnd = seg.u0 + seg.length;
  let next = state;
  const added: string[] = [];
  for (let i = 0; i < count; i++) {
    // Best centre in each free range, restricted to the edge.
    const valid = freeCentres(line, bodies(topo, next, line), len, gap)
      .map(([lo, hi]) => ({ lo, hi, c: towardEnd ? Math.min(hi, segEnd) : Math.max(lo, segStart) }))
      .filter(({ lo, hi, c }) => c >= lo - EPS && c <= hi + EPS && c >= segStart - EPS && c <= segEnd + EPS)
      .map(({ c }) => c);
    if (valid.length === 0) break;
    const u = towardEnd ? Math.max(...valid) : Math.min(...valid);
    const res = addVehicle(topo, next, typeId, fromU(line, u), opts);
    next = res.state;
    added.push(res.id);
  }
  return { state: next, added };
}

/** True when filling should pack towards the line end (growing `u`). */
function packTowardEnd(topo: Topology, line: TrackLine, edgeId: string, direction: FillDirection): boolean {
  const seg = line.segments.find((s) => s.edge === edgeId)!;
  if (direction === 'auto') {
    // Towards the nearer end of the line, measured from the middle of the edge.
    const mid = seg.u0 + seg.length / 2;
    return line.length - mid < mid;
  }
  const a = pointAtU(topo, line, seg.u0);
  const b = pointAtU(topo, line, seg.u0 + seg.length);
  const uGrowsRight = b.x >= a.x;
  return direction === 'right' ? uGrowsRight : !uGrowsRight;
}

export function removeVehicle(state: StationState, id: string): StationState {
  if (!state.vehicles[id]) return state;
  const vehicles = { ...state.vehicles };
  delete vehicles[id];
  const consists: string[][] = [];
  for (const c of state.consists) {
    const i = c.indexOf(id);
    if (i < 0) consists.push(c);
    else consists.push(...[c.slice(0, i), c.slice(i + 1)].filter((part) => part.length > 0));
  }
  return { ...state, vehicles, consists };
}

export function consistOf(state: StationState, id: string): string[] {
  return state.consists.find((c) => c.includes(id)) ?? [id];
}

export interface DragRange {
  line: TrackLine;
  /** Allowed shift of the whole consist along the line (lo ≤ 0 ≤ hi). */
  lo: number;
  hi: number;
}

/** How far the consist containing `id` can be shifted along its line without collisions. */
export function dragRange(topo: Topology, state: StationState, id: string): DragRange | null {
  const v = state.vehicles[id];
  if (!v) return null;
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  const group = consistOf(state, id);
  if (!group.every((g) => onLine(line, state.vehicles[g]!))) return null;
  const own = group.map((g) => bodyOnLine(topo.layout, line, state.vehicles[g]!));
  const gMin = Math.min(...own.map((b) => b.a));
  const gMax = Math.max(...own.map((b) => b.b));
  const gap = couplingGap(topo.layout);
  let lo = -gMin;
  let hi = line.length - gMax;
  for (const o of bodies(topo, state, line, new Set(group))) {
    if (o.b <= gMin + EPS) lo = Math.max(lo, o.b + gap - gMin);
    else if (o.a >= gMax - EPS) hi = Math.min(hi, o.a - gap - gMax);
  }
  return { line, lo: Math.min(lo, 0), hi: Math.max(hi, 0) };
}

/** Shifts the consist containing `id` by `delta` along its line, clamped to the free range. */
export function moveConsist(topo: Topology, state: StationState, id: string, delta: number): StationState {
  const range = dragRange(topo, state, id);
  if (!range) return state;
  const d = Math.min(Math.max(delta, range.lo), range.hi);
  if (Math.abs(d) < EPS) return state;
  const vehicles = { ...state.vehicles };
  for (const g of consistOf(state, id)) {
    const v = vehicles[g]!;
    vehicles[g] = { ...v, pos: fromU(range.line, toU(range.line, v.pos) + d) };
  }
  return { ...state, vehicles };
}

/** After a drag: closes small gaps to neighbours / track ends and optionally couples. */
export function settleConsist(topo: Topology, state: StationState, id: string, opts: EditOptions): StationState {
  const range = dragRange(topo, state, id);
  if (!range) return state;
  // Free distance ahead (towards growing u) and behind; snap to the closer one if it is small.
  const ahead = range.hi;
  const behind = -range.lo;
  const nearest = Math.min(ahead, behind);
  const delta = nearest >= SNAP_DISTANCE ? 0 : nearest === ahead ? range.hi : range.lo;
  const moved = moveConsist(topo, state, id, delta);
  return opts.autoCouple ? coupleTouching(topo, moved, consistOf(moved, id)) : moved;
}

/** Vehicles directly before/after `id` along its line whose bodies touch it (gap ≈ coupling gap). */
export function touchingNeighbours(topo: Topology, state: StationState, id: string): string[] {
  const v = state.vehicles[id];
  if (!v) return [];
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  const all = bodies(topo, state, line);
  const i = all.findIndex((b) => b.id === id);
  const gap = couplingGap(topo.layout);
  const out: string[] = [];
  const prev = all[i - 1];
  const next = all[i + 1];
  if (prev && all[i]!.a - prev.b <= gap + TOUCH_TOLERANCE) out.push(prev.id);
  if (next && next.a - all[i]!.b <= gap + TOUCH_TOLERANCE) out.push(next.id);
  return out;
}

export const areCoupled = (state: StationState, a: string, b: string): boolean =>
  state.consists.some((c) => {
    const i = c.indexOf(a);
    return i >= 0 && (c[i - 1] === b || c[i + 1] === b);
  });

/** Couples two touching vehicles at the ends of their consists. Returns the state unchanged otherwise. */
export function couple(topo: Topology, state: StationState, a: string, b: string): StationState {
  if (areCoupled(state, a, b) || !touchingNeighbours(topo, state, a).includes(b)) return state;
  // Keep consists in ascending line order: `a` is the one with the lower coordinate.
  const line = lineOfEdge(buildLines(topo, state.switches), state.vehicles[a]!.pos.edge);
  if (toU(line, state.vehicles[a]!.pos) > toU(line, state.vehicles[b]!.pos)) [a, b] = [b, a];
  const ca = consistOf(state, a);
  const cb = consistOf(state, b);
  if (ca === cb) return state;
  // Orient both consists so that `a` ends the first and `b` starts the second.
  const first = ca[ca.length - 1] === a ? ca : [...ca].reverse();
  const second = cb[0] === b ? cb : [...cb].reverse();
  if (first[first.length - 1] !== a || second[0] !== b) return state;
  const merged = [...first, ...second];
  return { ...state, consists: [...state.consists.filter((c) => c !== ca && c !== cb), merged] };
}

export function uncouple(state: StationState, a: string, b: string): StationState {
  if (!areCoupled(state, a, b)) return state;
  const c = consistOf(state, a);
  const cut = Math.max(c.indexOf(a), c.indexOf(b));
  return { ...state, consists: [...state.consists.filter((x) => x !== c), c.slice(0, cut), c.slice(cut)] };
}

/** Couples every vehicle in `ids` with the vehicles it touches. */
export function coupleTouching(topo: Topology, state: StationState, ids: string[]): StationState {
  let next = state;
  for (const id of ids) for (const n of touchingNeighbours(topo, next, id)) next = couple(topo, next, id, n);
  return next;
}

/** Removes all vehicles, keeping switch states. */
export const clearVehicles = (state: StationState): StationState => ({ ...state, vehicles: {}, consists: [] });
