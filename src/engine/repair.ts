// Wagon repair status: a wagon lifted on jacks over the inspection pit in the hall.
// While in repair it cannot be moved or coupled; a lone shunter may drive under it
// (see movement.ts, edit.ts and vehicles.ts → mayOverlap).
import { buildLines, lineOfEdge } from './lines';
import { consistOf } from './edit';
import { pointAt, type Topology } from './topology';
import {
  bodyOnLine,
  EPS,
  inRepair,
  isWagon,
  REPAIR_STATUS,
  statusDef,
  vehicleType,
  type StationState,
  type VehicleStatus,
} from './vehicles';

export interface StatusResult {
  state: StationState;
  error?: string;
}

/** True when the centre of the vehicle stands over the inspection pit (hall.channel). */
export function overInspectionPit(topo: Topology, state: StationState, id: string): boolean {
  const v = state.vehicles[id];
  if (!v) return false;
  const { x, y, w, h } = topo.layout.hall.channel;
  const p = pointAt(topo, v.pos.edge, v.pos.s);
  return p.x >= x - EPS && p.x <= x + w + EPS && p.y >= y - EPS && p.y <= y + h + EPS;
}

/** Vehicles standing (partly) under the wagon `id`. */
export function vehiclesUnder(topo: Topology, state: StationState, id: string): string[] {
  const v = state.vehicles[id];
  if (!v) return [];
  const line = lineOfEdge(buildLines(topo, state.switches), v.pos.edge);
  const own = bodyOnLine(topo.layout, line, v);
  return Object.values(state.vehicles)
    .filter((o) => o.id !== id && line.segments.some((s) => s.edge === o.pos.edge))
    .filter((o) => {
      const b = bodyOnLine(topo.layout, line, o);
      return b.a < own.b - EPS && b.b > own.a + EPS;
    })
    .map((o) => o.id);
}

/** Why the vehicle cannot be put into repair (Polish), or null when it can. */
export function startRepairProblem(topo: Topology, state: StationState, id: string): string | null {
  const v = state.vehicles[id];
  if (!v) return `Brak pojazdu ${id}`;
  if (!isWagon(topo.layout, v.type)) return `${id}: na podnośnikach można podnieść tylko wagon`;
  if (inRepair(v)) return `${id} jest już w naprawie`;
  if (!overInspectionPit(topo, state, id)) return `${id}: wagon musi stać na torze 69 nad kanałem rewizyjnym`;
  const coupled = consistOf(state, id).filter((x) => x !== id);
  if (coupled.length > 0) return `${id}: najpierw rozprzęgnij wagon od: ${coupled.join(', ')}`;
  return null;
}

/** Why the repair of the vehicle cannot end (Polish), or null when it can. */
export function endRepairProblem(topo: Topology, state: StationState, id: string): string | null {
  const v = state.vehicles[id];
  if (!v) return `Brak pojazdu ${id}`;
  if (!inRepair(v)) return `${id} nie jest w naprawie`;
  const under = vehiclesUnder(topo, state, id);
  if (under.length > 0) return `Pod wagonem ${id} stoi ${under.join(', ')} – najpierw wyjedź spod wagonu`;
  return null;
}

/**
 * Starts (`status` = "naprawa") or ends (`status` = null) the repair of a wagon. Ending it may change
 * the wagon type (`newType`, e.g. "wagon_zdrowy"). Refused with a Polish message when not allowed.
 */
export function setStatus(
  topo: Topology,
  state: StationState,
  id: string,
  status: VehicleStatus | null,
  newType?: string,
): StatusResult {
  if (status !== null && status !== REPAIR_STATUS) return { state, error: `Nieznany status ${String(status)}` };
  const problem = status ? startRepairProblem(topo, state, id) : endRepairProblem(topo, state, id);
  if (problem) return { state, error: problem };
  const v = state.vehicles[id]!;
  if (status) return { state: { ...state, vehicles: { ...state.vehicles, [id]: { ...v, status } } } };

  const next = { ...v };
  delete next.status;
  if (newType !== undefined) {
    const type = topo.layout.vehicleTypes.find((t) => t.id === newType);
    if (!type || type.powered) return { state, error: `${id}: ${newType} nie jest typem wagonu` };
    next.type = newType;
  }
  return { state: { ...state, vehicles: { ...state.vehicles, [id]: next } } };
}

/** Status-bar message after a successful setStatus. */
export function statusMessage(topo: Topology, id: string, status: VehicleStatus | null, newType?: string): string {
  if (status) return `${id}: rozpoczęto naprawę – wagon podniesiony na podnośnikach`;
  const type = newType ? ` – teraz: ${vehicleType(topo.layout, newType).name}` : '';
  return `${id}: zakończono naprawę${type}`;
}

/** Type offered after the repair (station.json → vehicleStatuses), if any. */
export const typeAfterRepair = (topo: Topology): string | undefined => statusDef(topo.layout, REPAIR_STATUS).afterType;
