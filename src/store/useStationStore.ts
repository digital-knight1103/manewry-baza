import { create } from 'zustand';
import exampleScenario from '../data/scenarios/wstawienie-na-naprawe.json';
import { stationTopology } from '../data/station';
import { formatCount, VEHICLE } from '../engine/counters';
import * as edit from '../engine/edit';
import type { TrackPos } from '../engine/lines';
import type { Topology } from '../engine/topology';
import {
  stateFromInitial,
  toInitialState,
  vehicleType,
  type InitialState,
  type StationState,
  type Vehicle,
} from '../engine/vehicles';

const STORAGE_KEY = 'manewry-baza:stan-stacji';
const exampleInitial = exampleScenario.initialState as InitialState;

interface StationStore {
  topo: Topology;
  state: StationState;
  selectedId: string | null;
  /** Couple vehicles that end up touching in edit mode. */
  autoCouple: boolean;
  /** Last message for the status bar. */
  message: string | null;

  select: (id: string | null) => void;
  setAutoCouple: (on: boolean) => void;
  addVehicle: (typeId: string, pos: TrackPos) => void;
  fillEdge: (edgeId: string, typeId: string, count: number, direction: edit.FillDirection) => void;
  removeVehicle: (id: string) => void;
  /** Shifts the consist of `id` during a drag (clamped at obstacles). */
  dragBy: (id: string, delta: number) => void;
  /** Ends a drag: snaps to close neighbours and auto-couples. */
  endDrag: (id: string) => void;
  couple: (a: string, b: string) => void;
  uncouple: (a: string, b: string) => void;
  setNumber: (id: string, number: string) => void;
  clear: () => void;
  loadExample: () => void;
}

function loadSaved(topo: Topology): StationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return stateFromInitial(topo, JSON.parse(raw) as InitialState);
  } catch {
    // Corrupt or outdated save — fall back to the example.
  }
  return stateFromInitial(topo, exampleInitial);
}

export const useStationStore = create<StationStore>((set, get) => {
  const topo = stationTopology;
  const opts = () => ({ autoCouple: get().autoCouple });
  const edgeName = (edgeId: string) => topo.edges.get(edgeId)?.name ?? edgeId;

  return {
    topo,
    state: loadSaved(topo),
    selectedId: null,
    autoCouple: true,
    message: null,

    select: (id) => set({ selectedId: id }),
    setAutoCouple: (on) => set({ autoCouple: on }),

    addVehicle: (typeId, pos) => {
      const res = edit.addVehicle(topo, get().state, typeId, pos, opts());
      set({ state: res.state, selectedId: res.id, message: `Dodano ${res.id} na ${edgeName(pos.edge)}` });
    },

    fillEdge: (edgeId, typeId, count, direction) => {
      const res = edit.fillEdge(topo, get().state, edgeId, typeId, count, direction, opts());
      const typeName = vehicleType(topo.layout, typeId).name;
      const where = edgeName(edgeId);
      let message: string;
      if (res.added.length === 0) message = `Brak miejsca na ${where}`;
      else if (res.added.length < count)
        message = `Zmieściło się tylko ${formatCount(res.added.length, VEHICLE)} z ${count} (${typeName}) na ${where}`;
      else message = `Dodano ${formatCount(count, VEHICLE)} (${typeName}) na ${where}`;
      set({ state: res.state, message });
    },

    removeVehicle: (id) =>
      set((s) => ({
        state: edit.removeVehicle(s.state, id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        message: `Usunięto ${id}`,
      })),

    dragBy: (id, delta) => set((s) => ({ state: edit.moveConsist(topo, s.state, id, delta) })),
    endDrag: (id) => set((s) => ({ state: edit.settleConsist(topo, s.state, id, opts()) })),

    couple: (a, b) => set((s) => ({ state: edit.couple(topo, s.state, a, b), message: `Sprzęgnięto ${a} z ${b}` })),
    uncouple: (a, b) => set((s) => ({ state: edit.uncouple(s.state, a, b), message: `Rozprzęgnięto ${a} i ${b}` })),

    setNumber: (id, number) =>
      set((s) => {
        const v = s.state.vehicles[id];
        if (!v) return {};
        const updated: Vehicle = { ...v, number: number.trim() };
        if (!updated.number) delete updated.number;
        return { state: { ...s.state, vehicles: { ...s.state.vehicles, [id]: updated } } };
      }),

    clear: () => set((s) => ({ state: edit.clearVehicles(s.state), selectedId: null, message: 'Stacja wyczyszczona' })),
    loadExample: () =>
      set({
        state: stateFromInitial(topo, exampleInitial),
        selectedId: null,
        message: `Wczytano stan początkowy scenariusza „${exampleScenario.title}”`,
      }),
  };
});

// Autosave (debounced, so dragging does not hammer localStorage).
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStationStore.subscribe((s, prev) => {
  if (s.state === prev.state) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toInitialState(s.topo, s.state)));
    } catch {
      // Storage unavailable (private mode) — keep working without autosave.
    }
  }, 400);
});
