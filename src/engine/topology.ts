import { distance, normalize, polylineLength, sub, type Vec } from './geometry';
import type { NodeType, Point, StationEdge, StationLayout, StationNode, SwitchStates } from './types';

const NODE_TYPES: readonly NodeType[] = ['bufferStop', 'switch', 'boundary', 'exit'];

export interface Topology {
  layout: StationLayout;
  nodes: Map<string, StationNode>;
  edges: Map<string, StationEdge>;
  /** Edge ids touching each node. */
  edgesAtNode: Map<string, string[]>;
  /** Length of every edge in schematic units. */
  edgeLength: Map<string, number>;
}

export function buildTopology(layout: StationLayout): Topology {
  const errors = validateStation(layout);
  if (errors.length > 0) throw new Error(`Błędny układ stacji:\n${errors.join('\n')}`);

  const nodes = new Map(layout.nodes.map((n) => [n.id, n]));
  const edges = new Map(layout.edges.map((e) => [e.id, e]));
  const edgesAtNode = new Map<string, string[]>(layout.nodes.map((n) => [n.id, []]));
  const edgeLength = new Map<string, number>();

  for (const edge of layout.edges) {
    edgesAtNode.get(edge.from)!.push(edge.id);
    edgesAtNode.get(edge.to)!.push(edge.id);
    edgeLength.set(edge.id, polylineLength(polylineOf(nodes, edge)));
  }

  return { layout, nodes, edges, edgesAtNode, edgeLength };
}

/** Checks references and switch definitions; returns a list of human-readable problems. */
export function validateStation(layout: StationLayout): string[] {
  const errors: string[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (!Array.isArray(layout.viewBox) || layout.viewBox.length !== 4)
    errors.push('viewBox musi mieć 4 liczby [x, y, szerokość, wysokość]');

  for (const n of layout.nodes) {
    if (nodeIds.has(n.id)) errors.push(`Zduplikowany węzeł ${n.id}`);
    nodeIds.add(n.id);
    if (!NODE_TYPES.includes(n.type)) errors.push(`Węzeł ${n.id}: nieznany typ ${n.type}`);
  }
  for (const e of layout.edges) {
    if (edgeIds.has(e.id)) errors.push(`Zduplikowany odcinek ${e.id}`);
    edgeIds.add(e.id);
    if (!nodeIds.has(e.from)) errors.push(`Odcinek ${e.id}: brak węzła ${e.from}`);
    if (!nodeIds.has(e.to)) errors.push(`Odcinek ${e.id}: brak węzła ${e.to}`);
    if (e.from === e.to) errors.push(`Odcinek ${e.id}: ten sam węzeł na obu końcach`);
  }

  const edgeById = new Map(layout.edges.map((e) => [e.id, e]));
  const checkConnections = (owner: string, nodeId: string, connections: [string, string][]) => {
    for (const [a, b] of connections) {
      for (const id of [a, b]) {
        const edge = edgeById.get(id);
        if (!edge) errors.push(`${owner}: brak odcinka ${id}`);
        else if (edge.from !== nodeId && edge.to !== nodeId)
          errors.push(`${owner}: odcinek ${id} nie dochodzi do węzła ${nodeId}`);
      }
    }
  };

  for (const sw of layout.switches) {
    if (!nodeIds.has(sw.node)) errors.push(`Rozjazd ${sw.id}: brak węzła ${sw.node}`);
    if (sw.states.length === 0) errors.push(`Rozjazd ${sw.id}: brak stanów`);
    if (sw.default < 0 || sw.default >= sw.states.length)
      errors.push(`Rozjazd ${sw.id}: stan domyślny ${sw.default} poza zakresem`);
    sw.states.forEach((st, i) => checkConnections(`Rozjazd ${sw.id} (stan ${i})`, sw.node, st.connections));
  }
  for (const b of layout.boundaries) {
    if (!nodeIds.has(b.node)) errors.push(`Granica: brak węzła ${b.node}`);
    checkConnections(`Granica ${b.node}`, b.node, b.connections);
  }

  const typeIds = new Set<string>();
  for (const t of layout.vehicleTypes) {
    if (typeIds.has(t.id)) errors.push(`Zduplikowany typ pojazdu ${t.id}`);
    typeIds.add(t.id);
    if (!(t.lengthM > 0)) errors.push(`Typ ${t.id}: długość musi być dodatnia`);
    if (!t.idPrefix) errors.push(`Typ ${t.id}: brak idPrefix`);
  }
  for (const c of layout.counters) {
    for (const id of c.edges) if (!edgeIds.has(id)) errors.push(`Licznik: brak odcinka ${id}`);
  }

  return errors;
}

function polylineOf(nodes: Map<string, StationNode>, edge: StationEdge): Point[] {
  const from = nodes.get(edge.from)!;
  const to = nodes.get(edge.to)!;
  return [from, ...(edge.points ?? []), to].map(({ x, y }) => ({ x, y }));
}

/** Points of the edge from its `from` node to its `to` node. */
export function edgePolyline(topo: Topology, edgeId: string): Point[] {
  const edge = topo.edges.get(edgeId);
  if (!edge) throw new Error(`Nieznany odcinek ${edgeId}`);
  return polylineOf(topo.nodes, edge);
}

/** Unit direction of the edge pointing away from `nodeId` (which must be one of its ends). */
export function directionAwayFrom(topo: Topology, edgeId: string, nodeId: string): Vec {
  const pts = edgePolyline(topo, edgeId);
  const edge = topo.edges.get(edgeId)!;
  if (edge.from === nodeId) return normalize(sub(pts[1]!, pts[0]!));
  if (edge.to === nodeId) return normalize(sub(pts[pts.length - 2]!, pts[pts.length - 1]!));
  throw new Error(`Odcinek ${edgeId} nie dochodzi do węzła ${nodeId}`);
}

/** Point lying at distance `s` from the `from` node along the edge (clamped to the edge). */
export function pointAt(topo: Topology, edgeId: string, s: number): Point {
  const pts = edgePolyline(topo, edgeId);
  let remaining = Math.max(0, s);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = distance(a, b);
    if (remaining <= seg) {
      const k = seg === 0 ? 0 : remaining / seg;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remaining -= seg;
  }
  return pts[pts.length - 1]!;
}

export function defaultSwitchStates(layout: StationLayout): SwitchStates {
  return Object.fromEntries(layout.switches.map((sw) => [sw.id, sw.default]));
}

/** Edge pairs joined at the switch in its current state. */
export function activeConnections(topo: Topology, switchId: string, states: SwitchStates): [string, string][] {
  const sw = topo.layout.switches.find((s) => s.id === switchId);
  if (!sw) throw new Error(`Nieznany rozjazd ${switchId}`);
  const state = sw.states[states[switchId] ?? sw.default];
  if (!state) throw new Error(`Rozjazd ${switchId}: nieznany stan ${states[switchId]}`);
  return state.connections;
}
