// Scenario mode (SPEC rozdz. 6.3): list of scenarios, step editing, playback and recording.
// Playback shows its own states (snapshots / animation frames) and leaves the station store alone;
// recording drives the station store through the drive mode and appends each manoeuvre as an action.
import { create } from 'zustand';
import type { Action } from '../engine/actions';
import { runScenario, type Scenario, type ScenarioRun, type ScenarioStep } from '../engine/scenario';
import * as sc from '../engine/scenarioEdit';
import { advanceStep, startStep, type StepPlayback } from '../engine/scenarioRunner';
import { toInitialState, type StationState } from '../engine/vehicles';
import { useAppStore } from './useAppStore';
import { setActionRecorder, useDriveStore } from './useDriveStore';
import { useStationStore } from './useStationStore';

const STORAGE_KEY = 'manewry-baza:scenariusze';

export const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 3, 4] as const;
/** Pause between steps during continuous playback, so that viewers can read the new caption. */
export const STEP_PAUSE_MS = 1200;

/** Built-in scenarios from src/data/scenarios/*.json — read-only. */
const BUILT_IN: Scenario[] = Object.values(
  import.meta.glob<{ default: unknown }>('../data/scenarios/*.json', { eager: true }),
).map((m) => m.default as Scenario);

interface Saved {
  scenarios: Scenario[];
  activeId: string;
}

function loadSaved(): Saved {
  const fallback = { scenarios: [], activeId: BUILT_IN[0]?.id ?? '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw) as Partial<Saved>;
    const scenarios = sc.parseScenarioFile(JSON.stringify({ scenarios: data.scenarios ?? [] }));
    return { scenarios, activeId: typeof data.activeId === 'string' ? data.activeId : fallback.activeId };
  } catch {
    return fallback;
  }
}

interface ScenarioStore {
  builtIn: Scenario[];
  /** Editable scenarios (autosaved). */
  user: Scenario[];
  activeId: string;
  /** Instant run of the active scenario: snapshots after every step and the first error. */
  run: ScenarioRun;
  /** Number of completed steps shown while no step is animating (index into run.snapshots). */
  position: number;
  /** Step being animated (or stopped by an error). */
  playback: StepPlayback | null;
  /** Keep playing the following steps. */
  playing: boolean;
  paused: boolean;
  /** Waiting between steps during continuous playback (ms left). */
  gap: number;
  speed: number;
  recording: boolean;

  scenarios: () => Scenario[];
  active: () => Scenario | undefined;
  isReadOnly: (id: string) => boolean;

  select: (id: string) => void;
  create: (title: string) => void;
  duplicate: () => void;
  remove: () => void;
  rename: (title: string) => void;
  importFile: (text: string) => void;
  exportActive: () => { name: string; text: string } | null;
  exportAll: () => { name: string; text: string };
  /** Current station state becomes the initial state of the active scenario. */
  saveInitialFromStation: () => void;

  addStep: (title: string) => void;
  updateStep: (index: number, patch: Partial<Pick<ScenarioStep, 'title' | 'bullets'>>) => void;
  removeStep: (index: number) => void;
  moveStep: (index: number, delta: -1 | 1) => void;

  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  restart: () => void;
  /** Shows the state after `count` steps at once. */
  jumpTo: (count: number) => void;
  /** Animates one step from its start. */
  playStep: (index: number) => void;
  setSpeed: (speed: number) => void;
  /** Advances the animation by `dtMs` of real time. */
  tick: (dtMs: number) => void;

  startRecording: () => void;
  stopRecording: () => void;
  record: (action: Action) => void;
  undoRecorded: () => void;
}

const station = () => useStationStore.getState();
const say = (message: string) => station().setMessage(message);

export const useScenarioStore = create<ScenarioStore>((set, get) => {
  const topo = station().topo;
  const saved = loadSaved();
  const all = (user: Scenario[]) => [...BUILT_IN, ...user];
  const find = (id: string, user = get().user) => all(user).find((s) => s.id === id);
  const runOf = (s: Scenario | undefined): ScenarioRun =>
    s ? runScenario(topo, s) : { state: station().state, snapshots: [station().state] };
  const initialActive = all(saved.scenarios).some((s) => s.id === saved.activeId) ? saved.activeId : (BUILT_IN[0]?.id ?? '');

  const idle = { playback: null, playing: false, paused: false, gap: 0 };

  /** Shows a scenario from its start. */
  const show = (id: string, user = get().user) => set({ activeId: id, user, run: runOf(find(id, user)), position: 0, ...idle });

  /** Replaces the active (editable) scenario; playback returns to a valid position. */
  const updateActive = (fn: (s: Scenario) => Scenario | null) => {
    const { activeId, user, position } = get();
    const current = user.find((s) => s.id === activeId);
    if (!current) {
      say('Scenariusz wbudowany jest tylko do odczytu – użyj „Duplikuj”, aby go edytować');
      return false;
    }
    const next = fn(current);
    if (!next) return false;
    const run = runOf(next);
    set({
      user: user.map((s) => (s.id === activeId ? next : s)),
      run,
      position: Math.min(position, run.snapshots.length - 1),
      ...idle,
    });
    return true;
  };

  const startAnimation = (step: number, playing: boolean) => {
    const { run } = get();
    const active = get().active();
    if (!active || step >= active.steps.length) return;
    const from = run.snapshots[step];
    if (!from) return say(run.error?.message ?? 'Krok niedostępny');
    set({ position: step, playback: startStep(step, from), playing, paused: false, gap: 0 });
  };

  const finishRecordingState = () => {
    setActionRecorder(null);
    useDriveStore.getState().leave();
  };

  return {
    builtIn: BUILT_IN,
    user: saved.scenarios,
    activeId: initialActive,
    run: runOf(all(saved.scenarios).find((s) => s.id === initialActive)),
    position: 0,
    ...idle,
    speed: 1,
    recording: false,

    scenarios: () => all(get().user),
    active: () => find(get().activeId),
    isReadOnly: (id) => BUILT_IN.some((s) => s.id === id),

    select: (id) => {
      if (get().recording) get().stopRecording();
      if (find(id)) show(id);
    },

    create: (title) => {
      const { user } = get();
      const s = sc.newScenario(
        title.trim() || 'Nowy scenariusz',
        toInitialState(topo, station().state),
        all(user).map((x) => x.id),
      );
      show(s.id, [...user, s]);
      say(`Utworzono scenariusz „${s.title}” ze stanem początkowym = bieżący stan stacji`);
    },

    duplicate: () => {
      const src = get().active();
      if (!src) return;
      const { user } = get();
      const copy = sc.duplicateScenario(
        src,
        all(user).map((x) => x.id),
      );
      show(copy.id, [...user, copy]);
      say(`Utworzono edytowalną kopię „${copy.title}”`);
    },

    remove: () => {
      const { activeId, user } = get();
      if (get().isReadOnly(activeId)) return say('Scenariusza wbudowanego nie można usunąć');
      if (get().recording) get().stopRecording();
      const rest = user.filter((s) => s.id !== activeId);
      show(all(rest)[0]?.id ?? '', rest);
      say('Usunięto scenariusz');
    },

    rename: (title) => {
      if (!title.trim()) return;
      updateActive((s) => ({ ...s, title: title.trim() }));
    },

    importFile: (text) => {
      let imported: Scenario[];
      try {
        imported = sc.parseScenarioFile(text);
      } catch (e) {
        return say(`Import nieudany: ${e instanceof Error ? e.message : String(e)}`);
      }
      let user = [...get().user];
      for (const s of imported) {
        // A built-in id cannot be overwritten; an editable one is replaced by the imported version.
        const scenario = get().isReadOnly(s.id)
          ? {
              ...s,
              id: sc.uniqueId(
                s.id,
                all(user).map((x) => x.id),
              ),
            }
          : s;
        const at = user.findIndex((x) => x.id === scenario.id);
        if (at >= 0) user[at] = scenario;
        else user = [...user, scenario];
      }
      const last = imported[imported.length - 1]!;
      show(user.some((s) => s.id === last.id) ? last.id : user[user.length - 1]!.id, user);
      say(`Zaimportowano scenariusze: ${imported.length}`);
    },

    exportActive: () => {
      const s = get().active();
      return s ? { name: `${s.id}.json`, text: sc.exportScenario(s) } : null;
    },

    exportAll: () => ({ name: 'scenariusze.json', text: sc.exportBundle(all(get().user)) }),

    saveInitialFromStation: () => {
      const ok = updateActive((s) => ({ ...s, initialState: toInitialState(topo, station().state) }));
      if (!ok) return;
      const { run } = get();
      say(
        run.error
          ? `Zapisano stan początkowy, ale scenariusz się nie odtwarza – ${run.error.message}`
          : 'Zapisano bieżący stan stacji jako stan początkowy scenariusza',
      );
    },

    addStep: (title) => {
      if (updateActive((s) => sc.addStep(s, title))) set((s) => ({ position: s.run.snapshots.length - 1 }));
    },
    updateStep: (index, patch) => void updateActive((s) => sc.updateStep(s, index, patch)),
    removeStep: (index) => void updateActive((s) => sc.removeStep(s, index)),
    moveStep: (index, delta) => void updateActive((s) => sc.moveStep(s, index, delta)),

    play: () => {
      const { playback, position, recording } = get();
      const steps = get().active()?.steps.length ?? 0;
      if (recording || steps === 0) return;
      if (playback && !playback.finished) return set({ paused: false, playing: true });
      startAnimation(position >= steps ? 0 : position, true);
    },

    pause: () => set({ paused: true }),

    next: () => {
      const { playback, position } = get();
      if (playback && !playback.finished) {
        // Skip the rest of the animated step.
        const done = advanceStep(topo, get().active()!, playback, Infinity);
        if (done.error) return set({ playback: done, playing: false, paused: false, gap: 0 });
        return set({ position: playback.step + 1, ...idle });
      }
      if (playback?.error) return say(playback.error.message);
      startAnimation(position, false);
    },

    prev: () => {
      const { playback, position } = get();
      set({ position: playback ? playback.step : Math.max(0, position - 1), ...idle });
    },

    restart: () => set({ position: 0, ...idle }),

    jumpTo: (count) => {
      const { run } = get();
      if (count > run.snapshots.length - 1) return say(run.error?.message ?? 'Krok niedostępny');
      set({ position: Math.max(0, count), ...idle });
    },

    playStep: (index) => startAnimation(index, false),

    setSpeed: (speed) => set({ speed: Math.min(4, Math.max(0.5, speed)) }),

    tick: (dtMs) => {
      const { playback, paused, gap, speed, playing } = get();
      if (paused) return;
      if (gap > 0) {
        const left = gap - dtMs;
        if (left > 0) return set({ gap: left });
        set({ gap: 0 });
        return startAnimation(get().position, true);
      }
      if (!playback || playback.finished) return;
      const pb = advanceStep(topo, get().active()!, playback, dtMs * speed);
      if (!pb.finished) return set({ playback: pb });
      if (pb.error) {
        say(pb.error.message);
        return set({ playback: pb, playing: false });
      }
      const position = pb.step + 1;
      const more = playing && position < (get().active()?.steps.length ?? 0);
      set({ position, playback: null, playing: more, gap: more ? STEP_PAUSE_MS : 0 });
    },

    startRecording: () => {
      const s = get().active();
      if (!s || get().recording) return;
      if (get().isReadOnly(s.id)) return say('Scenariusz wbudowany jest tylko do odczytu – użyj „Duplikuj”, aby nagrywać');
      if (s.steps.length === 0) {
        // Recording a new scenario starts from the current station state.
        updateActive((x) => sc.addStep({ ...x, initialState: toInitialState(topo, station().state) }, sc.defaultStepTitle(0)));
      } else {
        const { run } = get();
        if (run.error) return say(`Nie można nagrywać – scenariusz się nie odtwarza: ${run.error.message}`);
        station().commit(run.state);
      }
      set({ recording: true, ...idle, position: get().run.snapshots.length - 1 });
      setActionRecorder((a) => get().record(a));
      useDriveStore.getState().enter();
      say('Nagrywanie: kliknij lokomotywę lub shunter i wykonuj manewry – każda czynność zapisuje się w bieżącym kroku');
    },

    stopRecording: () => {
      if (!get().recording) return;
      finishRecordingState();
      set((s) => ({ recording: false, position: s.run.snapshots.length - 1 }));
      say('Zakończono nagrywanie');
    },

    record: (action) => {
      if (!get().recording) return;
      updateActive((s) => sc.recordAction(s, action));
      const { run } = get();
      set({ position: run.snapshots.length - 1 });
      if (run.error) say(`Uwaga: nagrana akcja nie odtwarza się – ${run.error.message}`);
    },

    undoRecorded: () => {
      useDriveStore.getState().setThrottle(null);
      const ok = updateActive((s) => sc.removeLastAction(s));
      if (!ok) return say('Bieżący krok nie ma akcji do cofnięcia');
      const { run } = get();
      station().commit(run.state, 'Cofnięto ostatnią nagraną akcję');
      set({ position: run.snapshots.length - 1 });
    },
  };
});

/** State shown on the schematic in scenario mode (not recording). */
export function scenarioViewState(s: ScenarioStore): StationState {
  if (s.playback) return s.playback.state;
  return s.run.snapshots[Math.min(s.position, s.run.snapshots.length - 1)] ?? s.run.state;
}

/** Step whose caption is shown: the animated one, else the last completed one (the first before playing). */
export function captionStepIndex(s: ScenarioStore): number | null {
  const count = s.active()?.steps.length ?? 0;
  if (count === 0) return null;
  if (s.playback) return s.playback.step;
  return Math.min(Math.max(0, s.position - 1), count - 1);
}

// Leaving the scenario mode stops playback and recording.
useAppStore.subscribe((s, prev) => {
  if (s.mode === prev.mode || prev.mode !== 'scenario') return;
  const store = useScenarioStore.getState();
  store.stopRecording();
  useScenarioStore.setState({ playing: false, paused: false, gap: 0, playback: null });
});

// Autosave of editable scenarios.
useScenarioStore.subscribe((s, prev) => {
  if (s.user === prev.user && s.activeId === prev.activeId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scenarios: s.user, activeId: s.activeId } satisfies Saved));
  } catch {
    // Storage unavailable — scenarios live until the page is closed; export keeps them.
  }
});
