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
/** Undo steps kept in memory. */
const HISTORY_LIMIT = 200;
const exampleInitial = exampleScenario.initialState as InitialState;

interface StationStore {
  topo: Topology;
  state: StationState;
  selectedId: string | null;
  /** Couple vehicles that end up touching (edit mode) or run into each other (drive mode). */
  autoCouple: boolean;
  /** Last message for the status bar. */
  message: string | null;
  /** Undo / redo stacks of whole station states. */
  past: StationState[];
  future: StationState[];
  /** State before a continuous change (drag, drive) that has not been settled into history yet. */
  pending: StationState | null;

  setMessage: (message: string | null) => void;
  /** Replaces the state as one undoable step. */
  commit: (next: StationState, message?: string) => void;
  /** Part of a continuous change; becomes one undoable step on `settle`. */
  change: (next: StationState) => void;
  settle: () => void;
  undo: () => void;
  redo: () => void;

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
  const trim = (stack: StationState[]) => stack.slice(-HISTORY_LIMIT);

  return {
    topo,
    state: loadSaved(topo),
    selectedId: null,
    autoCouple: true,
    message: null,
    past: [],
    future: [],
    pending: null,

    setMessage: (message) => set({ message }),

    commit: (next, message) =>
      set((s) => {
        const past = [...s.past];
        if (s.pending && s.pending !== s.state) past.push(s.pending);
        if (next !== s.state) past.push(s.state);
        const changed = past.length !== s.past.length;
        return {
          state: next,
          past: trim(past),
          future: changed ? [] : s.future,
          pending: null,
          ...(message !== undefined ? { message } : {}),
        };
      }),

    change: (next) => set((s) => (next === s.state ? {} : { state: next, pending: s.pending ?? s.state })),

    settle: () =>
      set((s) => {
        if (!s.pending) return {};
        if (s.pending === s.state) return { pending: null };
        return { past: trim([...s.past, s.pending]), future: [], pending: null };
      }),

    undo: () => {
      get().settle();
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return set({ message: 'Nie ma czego cofnąć' });
      set({ state: prev, past: s.past.slice(0, -1), future: [...s.future, s.state], message: 'Cofnięto' });
    },

    redo: () => {
      get().settle();
      const s = get();
      const next = s.future[s.future.length - 1];
      if (!next) return set({ message: 'Nie ma czego ponowić' });
      set({ state: next, past: trim([...s.past, s.state]), future: s.future.slice(0, -1), message: 'Ponowiono' });
    },

    select: (id) => set({ selectedId: id }),
    setAutoCouple: (on) => set({ autoCouple: on }),

    addVehicle: (typeId, pos) => {
      const res = edit.addVehicle(topo, get().state, typeId, pos, opts());
      get().commit(res.state, `Dodano ${res.id} na ${edgeName(pos.edge)}`);
      set({ selectedId: res.id });
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
      get().commit(res.state, message);
    },

    removeVehicle: (id) => {
      get().commit(edit.removeVehicle(get().state, id), `Usunięto ${id}`);
      set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }));
    },

    dragBy: (id, delta) => get().change(edit.moveConsist(topo, get().state, id, delta)),
    endDrag: (id) => {
      get().change(edit.settleConsist(topo, get().state, id, opts()));
      get().settle();
    },

    couple: (a, b) => get().commit(edit.couple(topo, get().state, a, b), `Sprzęgnięto ${a} z ${b}`),
    uncouple: (a, b) => get().commit(edit.uncouple(get().state, a, b), `Rozprzęgnięto ${a} i ${b}`),

    setNumber: (id, number) => {
      const s = get().state;
      const v = s.vehicles[id];
      if (!v || (v.number ?? '') === number.trim()) return;
      const updated: Vehicle = { ...v, number: number.trim() };
      if (!updated.number) delete updated.number;
      get().commit({ ...s, vehicles: { ...s.vehicles, [id]: updated } });
    },

    clear: () => {
      get().commit(edit.clearVehicles(get().state), 'Stacja wyczyszczona');
      set({ selectedId: null });
    },
    loadExample: () => {
      get().commit(stateFromInitial(topo, exampleInitial), `Wczytano stan początkowy scenariusza „${exampleScenario.title}”`);
      set({ selectedId: null });
    },
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
