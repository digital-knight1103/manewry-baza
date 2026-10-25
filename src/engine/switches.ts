// Switch operations: fouling zones and changing switch states.
import { buildLines, type TrackLine } from './lines';
import type { Topology } from './topology';
import type { SwitchDef } from './types';
import { bodyOnLine, type StationState } from './vehicles';

export interface NodeOnLine {
  node: string;
  /** Line coordinate of the node. */
  u: number;
}

/** Every node the line touches (segment ends), in line order, without duplicates. */
export function nodesOnLine(topo: Topology, line: TrackLine): NodeOnLine[] {
  const out: NodeOnLine[] = [];
  for (const seg of line.segments) {
    const e = topo.edges.get(seg.edge)!;
    const [start, end] = seg.reversed ? [e.to, e.from] : [e.from, e.to];
    if (out[out.length - 1]?.node !== start) out.push({ node: start, u: seg.u0 });
    out.push({ node: end, u: seg.u0 + seg.length });
  }
  return out;
}

/** Vehicles whose bodies reach within `distance` of `nodeId` on any track through it. */
export function vehiclesNearNode(topo: Topology, state: StationState, nodeId: string, distance: number): string[] {
  const found: string[] = [];
  for (const line of buildLines(topo, state.switches)) {
    const at = nodesOnLine(topo, line).filter((n) => n.node === nodeId);
    if (at.length === 0) continue;
    for (const v of Object.values(state.vehicles)) {
      if (!line.segments.some((s) => s.edge === v.pos.edge)) continue;
      const { a, b } = bodyOnLine(topo.layout, line, v);
      if (at.some((n) => a <= n.u + distance && b >= n.u - distance)) found.push(v.id);
    }
  }
  return found;
}

export function switchDef(topo: Topology, switchId: string): SwitchDef {
  const sw = topo.layout.switches.find((s) => s.id === switchId);
  if (!sw) throw new Error(`Nieznany rozjazd ${switchId}`);
  return sw;
}

/** Vehicles standing in the fouling zone (± switchFoulingDistance) of the switch. */
export const foulingVehicles = (topo: Topology, state: StationState, switchId: string): string[] =>
  vehiclesNearNode(topo, state, switchDef(topo, switchId).node, topo.layout.switchFoulingDistance);

export interface SwitchResult {
  state: StationState;
  error?: string;
}

/** Sets a switch; refused while a vehicle fouls it. */
export function setSwitch(topo: Topology, state: StationState, switchId: string, stateIndex: number): SwitchResult {
  const sw = switchDef(topo, switchId);
  if (!Number.isInteger(stateIndex) || stateIndex < 0 || stateIndex >= sw.states.length)
    return { state, error: `Rozjazd ${switchId}: nieznany stan ${stateIndex}` };
  if ((state.switches[switchId] ?? sw.default) === stateIndex) return { state };
  if (foulingVehicles(topo, state, switchId).length > 0) return { state, error: `Rozjazd ${switchId} zajęty – nie można przełożyć` };
  return { state: { ...state, switches: { ...state.switches, [switchId]: stateIndex } } };
}

/** Switches to the next state (cyclically). */
export function toggleSwitch(topo: Topology, state: StationState, switchId: string): SwitchResult {
  const sw = switchDef(topo, switchId);
  const current = state.switches[switchId] ?? sw.default;
  return setSwitch(topo, state, switchId, (current + 1) % sw.states.length);
}
