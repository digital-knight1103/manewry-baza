// Route finding for "Ustaw drogę": which edges to traverse and which switch states to set,
// with the fewest changes of direction (then the shortest distance).
import { consistOf } from './edit';
import type { TrackPos } from './lines';
import type { Dir } from './movement';
import type { Topology } from './topology';
import type { SwitchStates } from './types';
import { couplingGap, vehicleLength, type StationState } from './vehicles';

export interface RouteLeg {
  /** Edges in travel order; the first one is where the leg starts. */
  edges: string[];
  /** Direction of travel on the first edge (+1 = towards its `to` node). */
  dir: Dir;
  /** Switch states this leg needs. */
  switches: SwitchStates;
}

export type Route =
  | {
      found: true;
      needsReversal: boolean;
      /** For every change of direction: the edge the front of the consist reaches before reversing. */
      reverseOn: string[];
      legs: RouteLeg[];
    }
  | { found: false; message: string };

export interface RouteOptions {
  /** Length of the whole consist; a reversal needs room for it beyond the fouling zone. Default 0. */
  consistLength?: number;
}

interface Transition {
  edge: string;
  sw?: { id: string; state: number };
}

/** Run beyond the reversal point: the consist pulls through so that it clears the node it came from. */
interface Run {
  /** Edges entered after the reversal edge, in travel order. */
  edges: string[];
  switches: SwitchStates;
  frontEdge: string;
  /** Direction of travel on `frontEdge` before reversing. */
  frontDir: Dir;
}

interface SearchNode {
  edge: string;
  /** Node we are heading towards on `edge`. */
  exit: string;
  reversals: number;
  dist: number;
  prev: SearchNode | null;
  via: { kind: 'start'; dir: Dir } | { kind: 'move'; sw?: Transition['sw'] } | { kind: 'reverse'; run: Run };
}

const otherEnd = (topo: Topology, edgeId: string, nodeId: string): string => {
  const e = topo.edges.get(edgeId)!;
  return e.from === nodeId ? e.to : e.from;
};

/** Direction of travel on an edge entered at `nodeId`. */
const dirFrom = (topo: Topology, edgeId: string, nodeId: string): Dir => (topo.edges.get(edgeId)!.from === nodeId ? 1 : -1);

/** All edges reachable from `edgeId` through `nodeId` in any switch state; current states first. */
function transitions(topo: Topology, current: SwitchStates, edgeId: string, nodeId: string): Transition[] {
  const out: Transition[] = [];
  for (const b of topo.layout.boundaries) {
    if (b.node !== nodeId) continue;
    for (const [x, y] of b.connections) if (x === edgeId || y === edgeId) out.push({ edge: x === edgeId ? y : x });
  }
  const viaSwitch: (Transition & { preferred: boolean })[] = [];
  for (const sw of topo.layout.switches) {
    if (sw.node !== nodeId) continue;
    sw.states.forEach((st, i) => {
      for (const [x, y] of st.connections)
        if (x === edgeId || y === edgeId)
          viaSwitch.push({ edge: x === edgeId ? y : x, sw: { id: sw.id, state: i }, preferred: (current[sw.id] ?? sw.default) === i });
    });
  }
  viaSwitch.sort((p, q) => Number(q.preferred) - Number(p.preferred));
  return [...out, ...viaSwitch.map(({ edge, sw }) => ({ edge, sw }))];
}

/** Pulls forward from `entry` along `edgeId` until `need` units lie behind the front, or null if there is no room. */
function pullThrough(topo: Topology, current: SwitchStates, edgeId: string, entry: string, need: number): Run | null {
  const len = topo.edgeLength.get(edgeId)!;
  if (len >= need) return { edges: [], switches: {}, frontEdge: edgeId, frontDir: dirFrom(topo, edgeId, entry) };
  const exit = otherEnd(topo, edgeId, entry);
  for (const t of transitions(topo, current, edgeId, exit)) {
    const run = pullThrough(topo, current, t.edge, exit, need - len);
    if (run)
      return { ...run, edges: [t.edge, ...run.edges], switches: { ...(t.sw ? { [t.sw.id]: t.sw.state } : {}), ...run.switches } };
  }
  return null;
}

const better = (a: SearchNode, b: SearchNode) => a.reversals < b.reversals || (a.reversals === b.reversals && a.dist < b.dist);

/**
 * Finds a way from `from` to any point of `targetEdge`. Switch states are free to choose; the
 * result lists the states each leg needs. Vehicles standing on the way are not considered.
 */
export function findRoute(topo: Topology, state: StationState, from: TrackPos, targetEdge: string, opts: RouteOptions = {}): Route {
  const start = topo.edges.get(from.edge);
  if (!start) throw new Error(`Nieznany odcinek ${from.edge}`);
  if (!topo.edges.has(targetEdge)) throw new Error(`Nieznany odcinek ${targetEdge}`);
  if (from.edge === targetEdge)
    return { found: true, needsReversal: false, reverseOn: [], legs: [{ edges: [targetEdge], dir: 1, switches: {} }] };

  const need = (opts.consistLength ?? 0) + topo.layout.switchFoulingDistance;
  const len = topo.edgeLength.get(from.edge)!;
  const open: SearchNode[] = [
    { edge: from.edge, exit: start.to, reversals: 0, dist: len - from.s, prev: null, via: { kind: 'start', dir: 1 } },
    { edge: from.edge, exit: start.from, reversals: 0, dist: from.s, prev: null, via: { kind: 'start', dir: -1 } },
  ];
  const done = new Set<string>();

  while (open.length > 0) {
    open.sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    const cur = open.shift()!;
    const key = `${cur.edge}>${cur.exit}>${cur.via.kind === 'reverse'}`;
    if (done.has(key)) continue;
    done.add(key);
    if (cur.edge === targetEdge) return buildRoute(cur);

    for (const t of transitions(topo, state.switches, cur.edge, cur.exit)) {
      open.push({
        edge: t.edge,
        exit: otherEnd(topo, t.edge, cur.exit),
        reversals: cur.reversals,
        dist: cur.dist + topo.edgeLength.get(t.edge)!,
        prev: cur,
        via: { kind: 'move', sw: t.sw },
      });
    }
    // Reverse on an edge we entered through a node: the whole consist must clear that node first.
    if (cur.via.kind === 'move') {
      const entry = otherEnd(topo, cur.edge, cur.exit);
      const run = pullThrough(topo, state.switches, cur.edge, entry, need);
      if (run)
        open.push({ edge: cur.edge, exit: entry, reversals: cur.reversals + 1, dist: cur.dist + 2 * need, prev: cur, via: { kind: 'reverse', run } });
    }
  }
  const name = topo.edges.get(targetEdge)!.name ?? targetEdge;
  return { found: false, message: `Brak drogi do: ${name}` };
}

function buildRoute(end: SearchNode): Route {
  const chain: SearchNode[] = [];
  for (let n: SearchNode | null = end; n; n = n.prev) chain.unshift(n);

  const first = chain[0]!;
  const legs: RouteLeg[] = [{ edges: [first.edge], dir: first.via.kind === 'start' ? first.via.dir : 1, switches: {} }];
  const reverseOn: string[] = [];
  for (const n of chain.slice(1)) {
    const leg = legs[legs.length - 1]!;
    if (n.via.kind === 'move') {
      leg.edges.push(n.edge);
      // The layout has no loops, so a leg never needs one switch in two states.
      if (n.via.sw) leg.switches[n.via.sw.id] = n.via.sw.state;
    } else if (n.via.kind === 'reverse') {
      const { run } = n.via;
      leg.edges.push(...run.edges);
      Object.assign(leg.switches, run.switches);
      reverseOn.push(run.frontEdge);
      legs.push({ edges: [...run.edges].reverse().concat(n.edge), dir: (-run.frontDir) as Dir, switches: { ...run.switches } });
    }
  }
  return { found: true, needsReversal: reverseOn.length > 0, reverseOn, legs };
}

/** Total body length of a consist including coupling gaps. */
export function consistLength(topo: Topology, state: StationState, vehicleId: string): number {
  const ids = consistOf(state, vehicleId);
  const bodies = ids.reduce((sum, id) => sum + vehicleLength(topo.layout, state.vehicles[id]!.type), 0);
  return bodies + (ids.length - 1) * couplingGap(topo.layout);
}

/** findRoute for the consist of a vehicle, starting at the vehicle's position. */
export function findRouteForVehicle(topo: Topology, state: StationState, vehicleId: string, targetEdge: string): Route {
  const v = state.vehicles[vehicleId];
  if (!v) throw new Error(`Nieznany pojazd ${vehicleId}`);
  return findRoute(topo, state, v.pos, targetEdge, { consistLength: consistLength(topo, state, vehicleId) });
}
