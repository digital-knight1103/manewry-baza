// Driving consists along the track graph (SPEC rozdz. 7). Pure functions: state in → new state out.
//
// Under fixed switch states every edge belongs to exactly one track line (see lines.ts), so a
// moving consist is a 1-D interval on its line. The line ends exactly where the next connection
// is missing — at a buffer stop, a station exit or a switch set against us — which also guarantees
// that every vehicle of the consist (not only the front one) follows the active switch states.
import { formatWagonCount } from './counters';
import { areCoupled, consistOf, couple } from './edit';
import { buildLines, fromU, lineOfEdge, toU, type TrackLine } from './lines';
import { nodesOnLine, vehiclesNearNode } from './switches';
import type { Topology } from './topology';
import type { StationLayout } from './types';
import { bodyOnLine, couplingGap, EPS, vehicleType, type StationState } from './vehicles';

/** Direction of travel relative to an edge: +1 towards its `to` node, -1 towards its `from` node. */
export type Dir = 1 | -1;

export type StopReason =
  | 'bufferStop'
  | 'exit'
  | 'switchAgainst'
  | 'endOfTrack'
  | 'collision'
  | 'blocked'
  | 'noTraction'
  | 'shunterLimit'
  | 'notOnRoute';

export interface Stop {
  reason: StopReason;
  /** Message for the status bar (Polish). */
  message: string;
  node?: string;
  switchId?: string;
  /** Vehicle we ran into. */
  vehicle?: string;
  /** Collision only: the consists were coupled. */
  coupled?: boolean;
}

export interface DriveResult {
  state: StationState;
  /** Distance actually travelled (schematic units). */
  moved: number;
  /** Direction of travel on the edge the driving vehicle stands on after the move. */
  dir: Dir;
  /** Why the consist stopped before covering the requested distance (or refused to move). */
  stop?: Stop;
}

export interface DriveOptions {
  /** Couple with the consist we run into (default: true). */
  autoCouple?: boolean;
}

const onLine = (line: TrackLine, edgeId: string) => line.segments.some((s) => s.edge === edgeId);
const segmentOf = (line: TrackLine, edgeId: string) => line.segments.find((s) => s.edge === edgeId)!;

/** Reason why the consist cannot move by itself, or null when it can. */
export function tractionProblem(layout: StationLayout, state: StationState, group: string[]): Stop | null {
  const types = group.map((id) => vehicleType(layout, state.vehicles[id]!.type));
  const powered = types.filter((t) => t.powered);
  if (powered.length === 0) return { reason: 'noTraction', message: 'Skład bez lokomotywy ani shuntera nie może jechać' };
  // A vehicle without a wagon limit (locomotive) pulls any number of wagons.
  if (powered.some((t) => t.maxWagons === undefined)) return null;
  const limit = powered.reduce((sum, t) => sum + t.maxWagons!, 0);
  const wagons = types.length - powered.length;
  if (wagons > limit) return { reason: 'shunterLimit', message: `Shunter może pchać maks. ${formatWagonCount(limit)}` };
  return null;
}

/** What stops a consist at the end of a line. */
function lineEndStop(topo: Topology, nodeId: string, edgeId: string): Stop {
  const node = topo.nodes.get(nodeId)!;
  if (node.type === 'bufferStop') return { reason: 'bufferStop', message: 'Kozioł oporowy – koniec toru', node: nodeId };
  if (node.type === 'exit') return { reason: 'exit', message: 'Wyjazd ze stacji', node: nodeId };
  const sw = topo.layout.switches.find(
    (s) => s.node === nodeId && s.states.some((st) => st.connections.some((c) => c.includes(edgeId))),
  );
  if (sw)
    return { reason: 'switchAgainst', message: `Rozjazd ${sw.id} ustawiony przeciwnie`, node: nodeId, switchId: sw.id };
  return { reason: 'endOfTrack', message: 'Koniec toru', node: nodeId };
}

/** Name of a node for messages: the switch standing there, or the node id. */
const nodeLabel = (topo: Topology, nodeId: string) => topo.layout.switches.find((s) => s.node === nodeId)?.id ?? nodeId;

/**
 * Drives the consist containing `vehicleId` by up to `distance` in direction `dir`
 * (relative to the edge the vehicle stands on). Stops early at line ends, other vehicles
 * and crossings occupied by vehicles on another route.
 */
export function drive(
  topo: Topology,
  state: StationState,
  vehicleId: string,
  dir: Dir,
  distance: number,
  opts: DriveOptions = {},
): DriveResult {
  const { layout } = topo;
  const driver = state.vehicles[vehicleId];
  if (!driver) throw new Error(`Nieznany pojazd ${vehicleId}`);
  const group = consistOf(state, vehicleId);
  const refuse = (stop: Stop): DriveResult => ({ state, moved: 0, dir, stop });

  const traction = tractionProblem(layout, state, group);
  if (traction) return refuse(traction);

  const line = lineOfEdge(buildLines(topo, state.switches), driver.pos.edge);
  if (!group.every((id) => onLine(line, state.vehicles[id]!.pos.edge)))
    return refuse({ reason: 'notOnRoute', message: 'Skład nie stoi na jednej drodze – sprawdź rozjazdy' });

  // Work in line coordinates: ld = +1 means growing u.
  const ld = segmentOf(line, driver.pos.edge).reversed ? -dir : dir;
  const own = group.map((id) => ({ id, ...bodyOnLine(layout, line, state.vehicles[id]!) }));
  const frontBody = ld > 0 ? own.reduce((x, y) => (y.b > x.b ? y : x)) : own.reduce((x, y) => (y.a < x.a ? y : x));
  const front = ld > 0 ? frontBody.b : frontBody.a;
  const gap = couplingGap(layout);
  const ahead = (u: number) => (u - front) * ld;

  const candidates: { free: number; stop: Stop }[] = [];

  // 1. End of the line.
  const nodes = nodesOnLine(topo, line);
  const endNode = ld > 0 ? nodes[nodes.length - 1]! : nodes[0]!;
  const endEdge = (ld > 0 ? line.segments[line.segments.length - 1]! : line.segments[0]!).edge;
  candidates.push({ free: ahead(endNode.u), stop: lineEndStop(topo, endNode.node, endEdge) });

  // 2. Vehicles on the same line.
  const members = new Set(group);
  for (const v of Object.values(state.vehicles)) {
    if (members.has(v.id) || !onLine(line, v.pos.edge)) continue;
    const o = bodyOnLine(layout, line, v);
    const near = ld > 0 ? o.a : o.b;
    if (ahead(near) < -EPS) continue;
    candidates.push({ free: ahead(near) - gap, stop: { reason: 'collision', message: `Kolizja z pojazdem ${v.id}`, vehicle: v.id } });
  }

  // 3. Nodes ahead occupied by vehicles standing on another route (crossings, switch tongues).
  for (const n of nodes) {
    if (n === endNode || ahead(n.u) < -EPS) continue;
    const blocker = vehiclesNearNode(topo, state, n.node, gap).find(
      (id) => !members.has(id) && !onLine(line, state.vehicles[id]!.pos.edge),
    );
    if (!blocker) continue;
    const label = nodeLabel(topo, n.node);
    candidates.push({
      free: ahead(n.u) - gap,
      stop: { reason: 'blocked', message: `Przejazd przez ${label} zajęty przez pojazd ${blocker}`, node: n.node, vehicle: blocker },
    });
  }

  const nearest = candidates.reduce((x, y) => (y.free < x.free ? y : x));
  const want = Math.max(0, distance);
  const hit = nearest.free <= want + EPS;
  const moved = hit ? Math.max(0, nearest.free) : want;
  let stop = hit ? { ...nearest.stop } : undefined;

  let next = state;
  if (moved > EPS) {
    const vehicles = { ...state.vehicles };
    for (const { id, u } of own) vehicles[id] = { ...vehicles[id]!, pos: fromU(line, u + ld * moved) };
    next = { ...state, vehicles };
  }
  if (stop?.reason === 'collision') {
    if (opts.autoCouple ?? true) next = couple(topo, next, frontBody.id, stop.vehicle!);
    stop = { ...stop, coupled: areCoupled(next, frontBody.id, stop.vehicle!) };
  }

  const newEdge = next.vehicles[vehicleId]!.pos.edge;
  const newDir = (segmentOf(line, newEdge).reversed ? -ld : ld) as Dir;
  return { state: next, moved, dir: newDir, ...(stop ? { stop } : {}) };
}

/** One animation tick: drives `speed · dt` (units per second × seconds). */
export const step = (
  topo: Topology,
  state: StationState,
  vehicleId: string,
  dir: Dir,
  dt: number,
  speed: number,
  opts: DriveOptions = {},
): DriveResult => drive(topo, state, vehicleId, dir, speed * dt, opts);

/** Signed travel distance along the current route from the vehicle to an edge position, or null if off-route. */
export function distanceAlongRoute(
  topo: Topology,
  state: StationState,
  vehicleId: string,
  edgeId: string,
  s: number,
): { dir: Dir; distance: number } | null {
  const v = state.vehicles[vehicleId];
  if (!v) throw new Error(`Nieznany pojazd ${vehicleId}`);
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  if (!onLine(line, edgeId)) return null;
  const delta = toU(line, { edge: edgeId, s }) - toU(line, v.pos);
  const ld: Dir = delta >= 0 ? 1 : -1;
  const dir = (segmentOf(line, v.pos.edge).reversed ? -ld : ld) as Dir;
  return { dir, distance: Math.abs(delta) };
}
