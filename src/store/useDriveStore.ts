// Drive mode (SPEC rozdz. 6.2): driver selection, throttle, switches, coupling, routes and reset.
// All movement rules live in src/engine; this store only feeds them input and keeps UI state.
import { create } from 'zustand';
import {
  consistAtExit,
  describeRoute,
  driveTowards,
  leadingSide,
  routeEdges,
  setSwitches,
  type ScreenSide,
} from '../engine/control';
import type { Action } from '../engine/actions';
import { areCoupled, consistOf, couple, removeVehicle, uncouple } from '../engine/edit';
import { findRouteForVehicle } from '../engine/route';
import { driveToAction } from '../engine/scenarioEdit';
import { setSwitch, switchDef, toggleSwitch, type SwitchResult } from '../engine/switches';
import { vehicleType, type StationState, type VehicleStatus } from '../engine/vehicles';
import { useAppStore } from './useAppStore';
import { useStationStore } from './useStationStore';

export const SPEED_MIN = 10;
export const SPEED_MAX = 150;
export const SPEED_DEFAULT = 40;

interface DriveStore {
  /** Locomotive or shunter being driven. */
  driverId: string | null;
  /** Vehicle whose details are shown in the panel (a clicked wagon or the driver). */
  inspectedId: string | null;
  /** Direction arrow of the driver: last direction driven. */
  side: ScreenSide;
  /** Direction currently held (◀/▶ button or arrow key), null = standing. */
  throttle: ScreenSide | null;
  /** Units per second. */
  speed: number;
  /** Edges of the last route set with „Ustaw drogę”. */
  route: string[] | null;
  /** Waiting for a click on the target track of „Ustaw drogę”. */
  pickingRoute: boolean;
  /** State when drive mode was entered; „Reset do stanu początkowego” returns to it. */
  startState: StationState | null;

  enter: () => void;
  leave: () => void;
  clickVehicle: (id: string) => void;
  setThrottle: (side: ScreenSide | null) => void;
  /** Advances the held drive by `dt` seconds (called every animation frame). */
  driveTick: (dt: number) => void;
  setSpeed: (speed: number) => void;
  toggleSwitch: (switchId: string) => void;
  /** Sets a switch to a chosen state (menu of a switch with more than two states). */
  setSwitch: (switchId: string, stateIndex: number) => void;
  /** Click on the gap between two touching vehicles: uncouple if coupled, otherwise couple. */
  toggleCoupling: (a: string, b: string) => void;
  startRoutePick: () => void;
  cancelRoutePick: () => void;
  routeTo: (edgeId: string) => void;
  /** Starts / ends the repair of a wagon (recorded while recording a scenario). */
  setStatus: (id: string, status: VehicleStatus | null, newType?: string) => void;
  /** Removes the driver's consist standing at a station exit. */
  leaveStation: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
}

/** Receives every manoeuvre done in drive mode while a scenario is being recorded. */
let recorder: ((action: Action) => void) | null = null;
export const setActionRecorder = (fn: ((action: Action) => void) | null) => {
  recorder = fn;
};
const record = (action: Action) => recorder?.(action);

/** State when the current drive started, and the vehicle it coupled with when the engine stopped it. */
let driveFrom: StationState | null = null;
let coupledWith: string | null = null;

const station = () => useStationStore.getState();
const topo = () => station().topo;
const edgeName = (edgeId: string) => topo().edges.get(edgeId)?.name ?? edgeId;

export const useDriveStore = create<DriveStore>((set, get) => {
  /** Drops selections of vehicles that no longer exist (after undo, removal…). */
  const dropMissing = () => {
    const { vehicles } = station().state;
    const { driverId, inspectedId } = get();
    set({
      driverId: driverId && vehicles[driverId] ? driverId : null,
      inspectedId: inspectedId && vehicles[inspectedId] ? inspectedId : null,
    });
  };

  /** Commits and records a thrown switch; an unchanged state is a no-op. */
  const applySwitch = (switchId: string, res: SwitchResult) => {
    const s = station();
    if (res.error) return s.setMessage(res.error);
    if (res.state === s.state) return;
    const sw = switchDef(s.topo, switchId);
    const index = res.state.switches[switchId]!;
    s.commit(res.state, `Rozjazd ${switchId}: ${sw.states[index]!.name}`);
    record({ type: 'setSwitch', switch: switchId, state: index });
    set({ route: null });
  };

  /** A finished drive becomes one recorded action: driveTo the stopping point, or driveAndCouple. */
  const recordDrive = () => {
    const from = driveFrom;
    const hit = coupledWith;
    driveFrom = null;
    coupledWith = null;
    const { driverId } = get();
    const before = driverId ? from?.vehicles[driverId] : undefined;
    const now = driverId ? station().state.vehicles[driverId] : undefined;
    if (!driverId || !before || !now) return;
    if (hit) record({ type: 'driveAndCouple', vehicle: driverId, to: hit });
    else if (now.pos.edge !== before.pos.edge || Math.abs(now.pos.s - before.pos.s) > 1e-6)
      record(driveToAction(station().state, driverId));
  };

  const stop = () => {
    if (get().throttle) set({ throttle: null });
    station().settle();
    recordDrive();
  };

  return {
    driverId: null,
    inspectedId: null,
    side: 'left',
    throttle: null,
    speed: SPEED_DEFAULT,
    route: null,
    pickingRoute: false,
    startState: null,

    enter: () => {
      set({ startState: station().state, throttle: null, pickingRoute: false, route: null });
      dropMissing();
      if (!get().driverId) station().setMessage('Tryb Jazda: kliknij lokomotywę lub shunter, aby nim jechać');
    },

    leave: () => {
      stop();
      set({ pickingRoute: false });
    },

    clickVehicle: (id) => {
      const s = station();
      const v = s.state.vehicles[id];
      if (!v) return;
      const type = vehicleType(s.topo.layout, v.type);
      if (!type.powered) {
        set({ inspectedId: id });
        return;
      }
      if (get().driverId !== id) stop();
      set({ driverId: id, inspectedId: id, side: leadingSide(s.topo, s.state, id), route: null });
      s.setMessage(`Prowadzisz: ${id} (${type.name}) – jedź ◀ ▶ lub klawiszami ← →`);
    },

    setThrottle: (side) => {
      if (!side) {
        if (!get().throttle) return;
        stop();
        const { driverId } = get();
        const v = driverId && station().state.vehicles[driverId];
        if (v) station().setMessage(`${driverId} zatrzymany – ${edgeName(v.pos.edge)}`);
        return;
      }
      const { driverId } = get();
      if (!driverId || !station().state.vehicles[driverId]) {
        station().setMessage('Najpierw kliknij lokomotywę lub shunter');
        return;
      }
      if (!get().throttle) driveFrom = station().state;
      set({ throttle: side, side, pickingRoute: false });
      // Drive one tiny step at once so that a blocked consist reports why immediately.
      get().driveTick(0);
    },

    driveTick: (dt) => {
      const { driverId, throttle, speed } = get();
      if (!driverId || !throttle) return;
      const s = station();
      if (!s.state.vehicles[driverId]) return stop();
      const res = driveTowards(s.topo, s.state, driverId, throttle, speed * dt, { autoCouple: s.autoCouple });
      s.change(res.state);
      if (!res.stop) return;
      const { stop: why } = res;
      if (why.reason === 'collision' && why.coupled) coupledWith = why.vehicle!;
      stop();
      if (why.reason === 'collision' && why.coupled) s.setMessage(`Sprzęgnięto z pojazdem ${why.vehicle}`);
      else if (why.reason === 'exit') s.setMessage('Wyjazd ze stacji – „Zjedź ze stacji” usuwa skład ze schematu');
      else s.setMessage(why.message);
    },

    setSpeed: (speed) => set({ speed: Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed)) }),

    toggleSwitch: (switchId) => applySwitch(switchId, toggleSwitch(station().topo, station().state, switchId)),

    setSwitch: (switchId, stateIndex) => applySwitch(switchId, setSwitch(station().topo, station().state, switchId, stateIndex)),

    toggleCoupling: (a, b) => {
      const s = station();
      if (areCoupled(s.state, a, b)) {
        s.commit(uncouple(s.state, a, b), `Rozprzęgnięto ${a} i ${b}`);
        record({ type: 'uncouple', between: [a, b] });
        return;
      }
      const next = couple(s.topo, s.state, a, b);
      if (next === s.state) return s.setMessage(`Pojazdy ${a} i ${b} nie stykają się`);
      s.commit(next, `Sprzęgnięto ${a} z ${b}`);
      record({ type: 'couple', between: [a, b] });
    },

    startRoutePick: () => {
      const { driverId } = get();
      if (!driverId || !station().state.vehicles[driverId]) {
        station().setMessage('Najpierw kliknij lokomotywę lub shunter');
        return;
      }
      stop();
      set({ pickingRoute: true });
      station().setMessage(`Ustaw drogę dla ${driverId}: kliknij tor docelowy (Esc – anuluj)`);
    },

    cancelRoutePick: () => {
      if (!get().pickingRoute) return;
      set({ pickingRoute: false });
      station().setMessage('Anulowano ustawianie drogi');
    },

    routeTo: (edgeId) => {
      const { driverId } = get();
      set({ pickingRoute: false });
      const s = station();
      const driver = driverId ? s.state.vehicles[driverId] : undefined;
      if (!driverId || !driver) return;
      const route = findRouteForVehicle(s.topo, s.state, driverId, edgeId);
      if (!route.found) {
        set({ route: null });
        return s.setMessage(route.message);
      }
      const res = setSwitches(s.topo, s.state, route.legs[0]!.switches);
      if (res.error) {
        set({ route: null });
        return s.setMessage(`Nie można ustawić drogi: ${res.error}`);
      }
      s.commit(res.state, describeRoute(s.topo, res.state.switches, driver.pos, route, edgeId));
      for (const [id, index] of Object.entries(res.state.switches))
        if (s.state.switches[id] !== index) record({ type: 'setSwitch', switch: id, state: index });
      set({ route: routeEdges(route) });
    },

    setStatus: (id, status, newType) => {
      stop();
      if (!station().setStatus(id, status, newType)) return;
      record({ type: 'setStatus', vehicle: id, status, ...(newType ? { newType } : {}) });
    },

    leaveStation: () => {
      const { driverId } = get();
      const s = station();
      if (!driverId || !consistAtExit(s.topo, s.state, driverId)) {
        s.setMessage('Skład musi dojechać do wyjazdu ze stacji (koniec toru 3)');
        return;
      }
      stop();
      const group = consistOf(s.state, driverId);
      s.commit(group.reduce(removeVehicle, s.state), `Zjechał ze stacji: ${group.join(', ')}`);
      record({ type: 'remove', vehicles: group });
      set({ route: null });
      dropMissing();
    },

    reset: () => {
      const { startState } = get();
      if (!startState) return;
      stop();
      station().commit(startState, 'Przywrócono stan z chwili wejścia w tryb Jazda');
      set({ route: null, pickingRoute: false });
      dropMissing();
    },

    undo: () => {
      stop();
      station().undo();
      set({ route: null });
      dropMissing();
    },

    redo: () => {
      stop();
      station().redo();
      set({ route: null });
      dropMissing();
    },
  };
});

useAppStore.subscribe((s, prev) => {
  if (s.mode === prev.mode) return;
  if (s.mode === 'drive') useDriveStore.getState().enter();
  else if (prev.mode === 'drive') useDriveStore.getState().leave();
});
