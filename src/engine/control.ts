// Helpers for manual driving (tryb Jazda): screen directions, gaps between vehicles,
// station exits and applying routes found by findRoute.
import { consistOf, TOUCH_TOLERANCE } from './edit';
import { buildLines, lineOfEdge, linePath, type TrackPos } from './lines';
import { drive, type Dir, type DriveOptions, type DriveResult } from './movement';
import type { Route } from './route';
import { setSwitch, switchDef, nodesOnLine, type SwitchResult } from './switches';
import { pointAt, type Topology } from './topology';
import type { Point, SwitchStates } from './types';
import { bodyOnLine, couplingGap, inRepair, type StationState } from './vehicles';

/** Direction of travel as seen on the screen: ◀ or ▶. */
export type ScreenSide = 'left' | 'right';

export const sideArrow = (side: ScreenSide): string => (side === 'left' ? '◀' : '▶');

/** Horizontal movement below this (units per 2 units of track) counts as vertical. */
const VERTICAL_DX = 0.1;

/**
 * Screen side reached by travelling in `dir` on an edge near distance `s`. ▶ means right,
 * or down on a vertical piece of track — on the diagonal connector ◀ = up-left, ▶ = down-right.
 */
export function screenSideOf(topo: Topology, edgeId: string, dir: Dir, s?: number): ScreenSide {
  const len = topo.edgeLength.get(edgeId);
  if (len === undefined) throw new Error(`Nieznany odcinek ${edgeId}`);
  const at = Math.min(Math.max(s ?? len / 2, 0), len);
  const a = pointAt(topo, edgeId, Math.max(0, at - 1));
  const b = pointAt(topo, edgeId, Math.min(len, at + 1));
  const dx = b.x - a.x;
  const towardsToIsRight = Math.abs(dx) > VERTICAL_DX ? dx > 0 : b.y > a.y;
  return (dir === 1) === towardsToIsRight ? 'right' : 'left';
}

/** Edge direction (+1 / -1) that moves a vehicle standing at `pos` towards the screen side. */
export const dirForSide = (topo: Topology, pos: TrackPos, side: ScreenSide): Dir =>
  screenSideOf(topo, pos.edge, 1, pos.s) === side ? 1 : -1;

/** Drives the consist of `vehicleId` by up to `distance` towards a screen side. */
export function driveTowards(
  topo: Topology,
  state: StationState,
  vehicleId: string,
  side: ScreenSide,
  distance: number,
  opts: DriveOptions = {},
): DriveResult {
  const v = state.vehicles[vehicleId];
  if (!v) throw new Error(`Nieznany pojazd ${vehicleId}`);
  return drive(topo, state, vehicleId, dirForSide(topo, v.pos, side), distance, opts);
}

/** Screen side the vehicle leads towards: away from the rest of its consist (left when alone). */
export function leadingSide(topo: Topology, state: StationState, vehicleId: string): ScreenSide {
  const v = state.vehicles[vehicleId];
  if (!v) throw new Error(`Nieznany pojazd ${vehicleId}`);
  const others = consistOf(state, vehicleId).filter((id) => id !== vehicleId);
  if (others.length === 0) return 'left';
  const at = (id: string) => pointAt(topo, state.vehicles[id]!.pos.edge, state.vehicles[id]!.pos.s);
  const own = at(vehicleId);
  const mean = others.reduce((sum, id) => sum + at(id).x, 0) / others.length;
  return own.x < mean ? 'left' : 'right';
}

export interface VehicleGap {
  /** Vehicle with the lower line coordinate. */
  a: string;
  b: string;
  coupled: boolean;
  /** Centreline of the gap (slightly overlapping both bodies), for drawing a click target. */
  path: Point[];
}

/** Every pair of neighbouring vehicles that touch (gap ≈ coupling gap), coupled or not; wagons in repair are left out. */
export function vehicleGaps(topo: Topology, state: StationState): VehicleGap[] {
  const { layout } = topo;
  const gap = couplingGap(layout);
  const coupled = new Set<string>();
  for (const c of state.consists) for (let i = 1; i < c.length; i++) coupled.add(`${c[i - 1]}|${c[i]}`).add(`${c[i]}|${c[i - 1]}`);

  const out: VehicleGap[] = [];
  for (const line of buildLines(topo, state.switches)) {
    const bodies = Object.values(state.vehicles)
      .filter((v) => !inRepair(v) && line.segments.some((s) => s.edge === v.pos.edge))
      .map((v) => ({ id: v.id, ...bodyOnLine(layout, line, v) }))
      .sort((x, y) => x.a - y.a);
    for (let i = 1; i < bodies.length; i++) {
      const p = bodies[i - 1]!;
      const q = bodies[i]!;
      if (q.a - p.b > gap + TOUCH_TOLERANCE) continue;
      out.push({ a: p.id, b: q.id, coupled: coupled.has(`${p.id}|${q.id}`), path: linePath(topo, line, p.b - 1, q.a + 1) });
    }
  }
  return out;
}

/** Exit node the consist of `vehicleId` has reached with its outer end, or null. */
export function consistAtExit(topo: Topology, state: StationState, vehicleId: string): string | null {
  const v = state.vehicles[vehicleId];
  if (!v) return null;
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  const group = consistOf(state, vehicleId);
  if (!group.every((id) => line.segments.some((s) => s.edge === state.vehicles[id]!.pos.edge))) return null;
  const bodies = group.map((id) => bodyOnLine(topo.layout, line, state.vehicles[id]!));
  const lo = Math.min(...bodies.map((b) => b.a));
  const hi = Math.max(...bodies.map((b) => b.b));
  const nodes = nodesOnLine(topo, line);
  for (const [end, u] of [
    [nodes[0]!, lo],
    [nodes[nodes.length - 1]!, hi],
  ] as const) {
    if (topo.nodes.get(end.node)!.type === 'exit' && Math.abs(end.u - u) < TOUCH_TOLERANCE) return end.node;
  }
  return null;
}

/** Sets all given switches, or none of them when one is fouled. */
export function setSwitches(topo: Topology, state: StationState, switches: SwitchStates): SwitchResult {
  let next = state;
  for (const [id, index] of Object.entries(switches)) {
    const res = setSwitch(topo, next, id, index);
    if (res.error) return { state, error: res.error };
    next = res.state;
  }
  return { state: next };
}

/** All edges of a found route, without duplicates (for highlighting). */
export const routeEdges = (route: Extract<Route, { found: true }>): string[] => [...new Set(route.legs.flatMap((l) => l.edges))];

/**
 * Status-bar description of a route whose first leg has just been set from `from`: which way to
 * drive and, when the route needs a change of direction, where and which switches to throw then.
 */
export function describeRoute(
  topo: Topology,
  switches: SwitchStates,
  from: TrackPos,
  route: Extract<Route, { found: true }>,
  targetEdge: string,
): string {
  const name = (edgeId: string) => topo.edges.get(edgeId)?.name ?? edgeId;
  const [first, ...rest] = route.legs;
  const go = `jedź ${sideArrow(screenSideOf(topo, first!.edges[0]!, first!.dir, from.s))}`;
  if (from.edge === targetEdge) return `Pojazd już stoi na: ${name(targetEdge)}`;
  if (!route.needsReversal) return `Droga do: ${name(targetEdge)} ustawiona – ${go}`;

  const next = rest[0]!;
  const changes = Object.entries(next.switches)
    .filter(([id, index]) => (switches[id] ?? switchDef(topo, id).default) !== index)
    .map(([id, index]) => `${id} → ${switchDef(topo, id).states[index]!.name}`);
  const reversals = route.reverseOn.length > 1 ? ` (zmian kierunku: ${route.reverseOn.length})` : '';
  return (
    `Droga do: ${name(targetEdge)} wymaga zmiany kierunku${reversals}: ${go} na: ${name(route.reverseOn[0]!)}, ` +
    `tam zmień kierunek${changes.length > 0 ? ` i przestaw ${changes.join(', ')}` : ''} – ` +
    'potem ponownie „Ustaw drogę”'
  );
}
