// Scenario actions (SPEC rozdz. 10), each executed to completion.
import { areCoupled, consistOf, couple, removeVehicle, uncouple } from './edit';
import { buildLines, fromU, lineOfEdge } from './lines';
import { distanceAlongRoute, drive, type Dir } from './movement';
import { setStatus } from './repair';
import { findRouteForVehicle } from './route';
import { setSwitch, switchDef } from './switches';
import type { Topology } from './topology';
import {
  bodyOnLine,
  couplingGap,
  EPS,
  vehicleLength,
  type PlacementVehicle,
  type StationState,
  type Vehicle,
  type VehicleStatus,
} from './vehicles';

export type Action =
  | { type: 'setSwitch'; switch: string; state: number }
  | { type: 'driveTo'; vehicle: string; edge: string; offset: number }
  | { type: 'driveAndCouple'; vehicle: string; to: string }
  | { type: 'couple'; between: [string, string] }
  | { type: 'uncouple'; between: [string, string] }
  | { type: 'spawn'; exit: string; vehicles: PlacementVehicle[] }
  | { type: 'remove'; vehicles: string[] }
  | { type: 'wait'; ms: number }
  | { type: 'highlight'; vehicles?: string[]; track?: string; ms: number }
  /** Start ("naprawa") or end (null) the repair of a wagon; ending may change its type. */
  | { type: 'setStatus'; vehicle: string; status: VehicleStatus | null; newType?: string };

/** Movement performed by a drive action, so that the UI can animate it from the start state. */
export interface DriveMotion {
  vehicle: string;
  dir: Dir;
  /** Distance actually travelled. */
  distance: number;
}

export interface ActionResult {
  state: StationState;
  /** Why the action failed (Polish); the state is then left as far as the action got. */
  error?: string;
  /** driveTo / driveAndCouple only. */
  motion?: DriveMotion;
}

/** Tolerance for reaching a driveTo target (recorded offsets are rounded to 0.01). */
const TARGET_TOLERANCE = 0.01;

/** Why the vehicle cannot get to `edgeId` along its current track: switch set against it, reversal needed, no way. */
function unreachableReason(topo: Topology, state: StationState, vehicleId: string, edgeId: string, what: string): string {
  const route = findRouteForVehicle(topo, state, vehicleId, edgeId);
  if (!route.found) return `${vehicleId}: brak drogi do: ${what}`;
  if (route.needsReversal) return `${vehicleId}: dojazd do: ${what} wymaga zmiany kierunku – podziel przejazd na kilka akcji`;
  const wrong = Object.entries(route.legs[0]!.switches)
    .filter(([id, index]) => (state.switches[id] ?? switchDef(topo, id).default) !== index)
    .map(([id, index]) => `rozjazd ${id} ustawiony przeciwnie (potrzebny stan: ${switchDef(topo, id).states[index]!.name})`);
  if (wrong.length > 0) return `${vehicleId}: ${wrong.join(', ')} – brak drogi do: ${what}`;
  return `${vehicleId}: ${what} nieosiągalny przy obecnym ustawieniu rozjazdów`;
}

const missing = (state: StationState, ids: string[]) => ids.find((id) => !state.vehicles[id]);

/** Edges of a highlighted track: given by track number ("65") or by edge id ("e67b"). */
export const highlightEdges = (topo: Topology, track: string): string[] =>
  topo.layout.edges.filter((e) => e.track === track || e.id === track).map((e) => e.id);

/** Executes an action instantly. Bad data (unknown switch, vehicle type…) is reported as an error, never thrown. */
export function applyAction(topo: Topology, state: StationState, action: Action): ActionResult {
  try {
    return execute(topo, state, action);
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : String(e) };
  }
}

function execute(topo: Topology, state: StationState, action: Action): ActionResult {
  switch (action.type) {
    case 'setSwitch':
      return setSwitch(topo, state, action.switch, action.state);

    case 'driveTo': {
      if (missing(state, [action.vehicle])) return { state, error: `Brak pojazdu ${action.vehicle}` };
      if (!topo.edges.has(action.edge)) return { state, error: `Nieznany odcinek ${action.edge}` };
      const target = distanceAlongRoute(topo, state, action.vehicle, action.edge, action.offset);
      if (!target) {
        const what = topo.edges.get(action.edge)!.name ?? action.edge;
        return { state, error: unreachableReason(topo, state, action.vehicle, action.edge, what) };
      }
      const res = drive(topo, state, action.vehicle, target.dir, target.distance, { autoCouple: false });
      const motion = { vehicle: action.vehicle, dir: target.dir, distance: res.moved };
      if (res.moved < target.distance - TARGET_TOLERANCE)
        return { state: res.state, motion, error: `${action.vehicle}: ${res.stop?.message ?? 'nie dojechał do celu'}` };
      return { state: res.state, motion };
    }

    case 'driveAndCouple': {
      const gone = missing(state, [action.vehicle, action.to]);
      if (gone) return { state, error: `Brak pojazdu ${gone}` };
      if (consistOf(state, action.vehicle).includes(action.to)) return { state };
      const to = state.vehicles[action.to]!.pos;
      const toward = distanceAlongRoute(topo, state, action.vehicle, to.edge, to.s);
      if (!toward) return { state, error: unreachableReason(topo, state, action.vehicle, to.edge, `pojazd ${action.to}`) };
      const res = drive(topo, state, action.vehicle, toward.dir, Infinity, { autoCouple: true });
      const motion = { vehicle: action.vehicle, dir: toward.dir, distance: res.moved };
      if (!consistOf(res.state, action.vehicle).includes(action.to))
        return { state: res.state, motion, error: `${action.vehicle}: ${res.stop?.message ?? `nie dojechał do ${action.to}`}` };
      return { state: res.state, motion };
    }

    case 'couple': {
      const [a, b] = action.between;
      const gone = missing(state, [a, b]);
      if (gone) return { state, error: `Brak pojazdu ${gone}` };
      const next = couple(topo, state, a, b);
      return areCoupled(next, a, b) ? { state: next } : { state, error: `Pojazdy ${a} i ${b} nie stykają się` };
    }

    case 'uncouple': {
      const [a, b] = action.between;
      if (!areCoupled(state, a, b)) return { state, error: `Pojazdy ${a} i ${b} nie są sprzęgnięte` };
      return { state: uncouple(state, a, b) };
    }

    case 'spawn':
      return spawn(topo, state, action.exit, action.vehicles);

    case 'remove': {
      const gone = missing(state, action.vehicles);
      if (gone) return { state, error: `Brak pojazdu ${gone}` };
      return { state: action.vehicles.reduce(removeVehicle, state) };
    }

    case 'highlight': {
      const gone = missing(state, action.vehicles ?? []);
      if (gone) return { state, error: `Brak pojazdu ${gone}` };
      if (action.track !== undefined && highlightEdges(topo, action.track).length === 0)
        return { state, error: `Nieznany tor ${action.track}` };
      return { state };
    }

    case 'setStatus':
      return setStatus(topo, state, action.vehicle, action.status, action.newType);

    case 'wait':
      return { state };
  }
}

/**
 * A train arrives at the station exit `exitNode`: `vehicles[0]` is its front (deepest inside the
 * station), the last vehicle stands at the exit. All vehicles are coupled.
 */
export function spawn(topo: Topology, state: StationState, exitNode: string, vehicles: PlacementVehicle[]): ActionResult {
  const node = topo.nodes.get(exitNode);
  if (!node || node.type !== 'exit') return { state, error: `${exitNode} nie jest wyjazdem ze stacji` };
  const dup = vehicles.find((v) => state.vehicles[v.id]);
  if (dup) return { state, error: `Pojazd ${dup.id} już jest na stacji` };
  if (vehicles.length === 0) return { state };

  const { layout } = topo;
  const edgeId = topo.edgesAtNode.get(exitNode)![0]!;
  const line = lineOfEdge(buildLines(topo, state.switches), edgeId);
  const atStart = line.segments[0]!.edge === edgeId && (topo.edges.get(edgeId)!.from === exitNode) !== line.segments[0]!.reversed;
  const inward = atStart ? 1 : -1;
  const gap = couplingGap(layout);

  // Lay vehicles from the exit inwards, last vehicle first.
  const placed: Vehicle[] = [];
  let cursor = atStart ? 0 : line.length;
  for (const pv of [...vehicles].reverse()) {
    const len = vehicleLength(layout, pv.type);
    placed.push({ ...pv, pos: fromU(line, cursor + (inward * len) / 2) });
    cursor += inward * (len + gap);
  }
  const deepest = cursor - inward * gap;
  if (deepest < -EPS || deepest > line.length + EPS) return { state, error: 'Skład nie mieści się na torze przy wyjeździe' };
  const [lo, hi] = atStart ? [0, deepest] : [deepest, line.length];
  const blocker = Object.values(state.vehicles).find((v) => {
    if (!line.segments.some((s) => s.edge === v.pos.edge)) return false;
    const b = bodyOnLine(layout, line, v);
    return b.a < hi + gap - EPS && b.b > lo - gap + EPS;
  });
  if (blocker) return { state, error: `Wjazd zablokowany przez pojazd ${blocker.id}` };

  const ids = placed.map((v) => v.id);
  return {
    state: {
      ...state,
      vehicles: { ...state.vehicles, ...Object.fromEntries(placed.map((v) => [v.id, v])) },
      // Consists are kept in ascending line order.
      consists: [...state.consists, atStart ? ids : ids.reverse()],
    },
  };
}
