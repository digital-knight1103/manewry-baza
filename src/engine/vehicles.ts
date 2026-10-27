import { buildLines, fromU, lineOfEdge, toU, type TrackLine, type TrackPos } from './lines';
import { defaultSwitchStates, type Topology } from './topology';
import type { StationLayout, SwitchStates, VehicleStatusDef, VehicleType } from './types';

/** Wagon lifted on jacks over the inspection pit (see repair.ts). */
export const REPAIR_STATUS = 'naprawa';
export type VehicleStatus = typeof REPAIR_STATUS;

export interface Vehicle {
  id: string;
  type: string;
  /** Wagon number shown in the tooltip. */
  number?: string;
  status?: VehicleStatus;
  /** Position of the vehicle centre. */
  pos: TrackPos;
}

export interface StationState {
  switches: SwitchStates;
  vehicles: Record<string, Vehicle>;
  /** Groups of coupled vehicles, each listed in track order; neighbours in a list are coupled. */
  consists: string[][];
}

// Scenario initial state format (SPEC rozdz. 10).
export interface PlacementVehicle {
  id: string;
  type: string;
  number?: string;
  status?: VehicleStatus;
}

/** Vehicles laid along the edge direction (away from its `from` node) starting at `startOffset`, coupled. */
export interface Placement {
  edge: string;
  startOffset: number;
  vehicles: PlacementVehicle[];
}

export interface InitialState {
  switches: SwitchStates;
  placements: Placement[];
}

/** Tolerance (schematic units) for touching / fitting checks. */
export const EPS = 1e-6;

export function vehicleType(layout: StationLayout, typeId: string): VehicleType {
  const t = layout.vehicleTypes.find((v) => v.id === typeId);
  if (!t) throw new Error(`Nieznany typ pojazdu ${typeId}`);
  return t;
}

/** Vehicle body length in schematic units. */
export const vehicleLength = (layout: StationLayout, typeId: string): number =>
  vehicleType(layout, typeId).lengthM * layout.scalePxPerMeter;

/** Distance between bodies of two coupled vehicles in schematic units. */
export const couplingGap = (layout: StationLayout): number => layout.couplingGapM * layout.scalePxPerMeter;

export const isWagon = (layout: StationLayout, typeId: string): boolean => !vehicleType(layout, typeId).powered;

export function statusDef(layout: StationLayout, status: string): VehicleStatusDef {
  const def = layout.vehicleStatuses.find((s) => s.id === status);
  if (!def) throw new Error(`Nieznany status pojazdu ${status}`);
  return def;
}

export const inRepair = (v: Vehicle | undefined): boolean => v?.status === REPAIR_STATUS;

/** A vehicle that may drive under a wagon in repair right now: a shunter without coupled wagons. */
export function passesUnderRepair(layout: StationLayout, state: StationState, id: string): boolean {
  const v = state.vehicles[id];
  if (!v || inRepair(v)) return false;
  const alone = (state.consists.find((c) => c.includes(id))?.length ?? 1) === 1;
  return alone && vehicleType(layout, v.type).passesUnderRepair === true;
}

/** Bodies of these two vehicles may overlap: one is a wagon in repair, the other drives under it. */
export const mayOverlap = (layout: StationLayout, state: StationState, a: string, b: string): boolean =>
  (inRepair(state.vehicles[a]) && passesUnderRepair(layout, state, b)) ||
  (inRepair(state.vehicles[b]) && passesUnderRepair(layout, state, a));

export function emptyState(layout: StationLayout): StationState {
  return { switches: defaultSwitchStates(layout), vehicles: {}, consists: [] };
}

/** Body extent of a vehicle on a line: [a, b] in line coordinates. */
export function bodyOnLine(layout: StationLayout, line: TrackLine, v: Vehicle): { a: number; b: number; u: number } {
  const u = toU(line, v.pos);
  const half = vehicleLength(layout, v.type) / 2;
  return { a: u - half, b: u + half, u };
}

export function stateFromInitial(topo: Topology, initial: InitialState): StationState {
  const { layout } = topo;
  const switches = { ...defaultSwitchStates(layout), ...initial.switches };
  const lines = buildLines(topo, switches);
  const gap = couplingGap(layout);
  const vehicles: Record<string, Vehicle> = {};
  const consists: string[][] = [];

  for (const [pi, p] of initial.placements.entries()) {
    if (!topo.edges.has(p.edge)) throw new Error(`Rozstawienie ${pi + 1}: nieznany odcinek ${p.edge}`);
    const line = lineOfEdge(lines, p.edge);
    const seg = line.segments.find((s) => s.edge === p.edge)!;
    const sign = seg.reversed ? -1 : 1;
    let along = toU(line, { edge: p.edge, s: p.startOffset });
    const consist: string[] = [];
    for (const pv of p.vehicles) {
      if (vehicles[pv.id]) throw new Error(`Zduplikowany pojazd ${pv.id}`);
      if (pv.status !== undefined) {
        if (pv.status !== REPAIR_STATUS) throw new Error(`Pojazd ${pv.id}: nieznany status ${String(pv.status)}`);
        if (!isWagon(layout, pv.type)) throw new Error(`Pojazd ${pv.id}: w naprawie może być tylko wagon`);
        if (p.vehicles.length > 1) throw new Error(`Wagon w naprawie ${pv.id} nie może być sprzęgnięty z innymi pojazdami`);
      }
      const len = vehicleLength(layout, pv.type);
      const u = along + (sign * len) / 2;
      if (u - len / 2 < -EPS || u + len / 2 > line.length + EPS)
        throw new Error(`Pojazd ${pv.id} nie mieści się na torze (odcinek ${p.edge})`);
      vehicles[pv.id] = { ...pv, pos: fromU(line, u) };
      consist.push(pv.id);
      along += sign * (len + gap);
    }
    consists.push(sign > 0 ? consist : consist.reverse());
  }

  const state = { switches, vehicles, consists };
  const clash = findOverlap(topo, state);
  if (clash) throw new Error(`Pojazdy ${clash[0]} i ${clash[1]} nachodzą na siebie`);
  return state;
}

/** Inverse of stateFromInitial: one placement per consist. */
export function toInitialState(topo: Topology, state: StationState): InitialState {
  const { layout } = topo;
  const lines = buildLines(topo, state.switches);
  const round = (x: number) => Math.round(x * 100) / 100;
  const placements = state.consists.map((ids): Placement => {
    const line = lineOfEdge(lines, state.vehicles[ids[0]!]!.pos.edge);
    const sorted = ids
      .map((id) => ({ v: state.vehicles[id]!, ...bodyOnLine(layout, line, state.vehicles[id]!) }))
      .sort((x, y) => x.u - y.u);
    const first = sorted[0]!;
    const seg = line.segments.find((s) => s.edge === first.v.pos.edge)!;
    // Placement runs along the anchor edge's direction, which is descending `u` on a reversed segment.
    const ordered = seg.reversed ? sorted.reverse() : sorted;
    const startOffset = seg.reversed ? seg.length - (ordered[0]!.b - seg.u0) : first.a - seg.u0;
    return {
      edge: seg.edge,
      startOffset: round(startOffset),
      vehicles: ordered.map(({ v }) => ({
        id: v.id,
        type: v.type,
        ...(v.number ? { number: v.number } : {}),
        ...(v.status ? { status: v.status } : {}),
      })),
    };
  });
  return { switches: { ...state.switches }, placements };
}

/** First pair of vehicles whose bodies (plus coupling gap) overlap on the same line, if any (a shunter under a wagon in repair is fine). */
export function findOverlap(topo: Topology, state: StationState): [string, string] | null {
  const { layout } = topo;
  const gap = couplingGap(layout);
  const lines = buildLines(topo, state.switches);
  for (const line of lines) {
    const bodies = Object.values(state.vehicles)
      .filter((v) => line.segments.some((s) => s.edge === v.pos.edge))
      .map((v) => ({ id: v.id, ...bodyOnLine(layout, line, v) }))
      .sort((x, y) => x.a - y.a);
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length && bodies[j]!.a < bodies[i]!.b + gap - 1e-3; j++) {
        if (!mayOverlap(layout, state, bodies[i]!.id, bodies[j]!.id)) return [bodies[i]!.id, bodies[j]!.id];
      }
    }
  }
  return null;
}

/** Number of wagons (powered vehicles excluded) whose centre lies on one of `edges`. */
export function wagonCount(layout: StationLayout, state: StationState, edges: string[]): number {
  return Object.values(state.vehicles).filter((v) => edges.includes(v.pos.edge) && isWagon(layout, v.type)).length;
}

/** Next free id for a vehicle of the given type, e.g. R5 when R1–R4 exist. */
export function nextVehicleId(layout: StationLayout, state: StationState, typeId: string): string {
  const prefix = vehicleType(layout, typeId).idPrefix;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const id of Object.keys(state.vehicles)) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${max + 1}`;
}
