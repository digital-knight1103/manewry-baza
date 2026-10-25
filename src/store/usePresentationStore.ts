// Presentation mode (SPEC rozdz. 6.4): title screen → steps of the scenario → end screen, driven by
// the keyboard only. Steps are played by the scenario store; this store only adds the two extra screens.
import { create } from 'zustand';
import { useAppStore } from './useAppStore';
import { useScenarioStore } from './useScenarioStore';
import { useStationStore } from './useStationStore';

export type PresentationScreen = 'title' | 'steps' | 'end';

interface PresentationStore {
  presenting: boolean;
  screen: PresentationScreen;
  /** Opens the presentation of scenario `id` on its title screen; false when there is no such scenario. */
  start: (id: string) => boolean;
  exit: () => void;
  /** → / Space / PageDown: finishes the animated step, else starts the next one (title → step 1 → … → end). */
  next: () => void;
  /** ← / PageUp: state after the previous step at once (step 1 → title, end → last step). */
  prev: () => void;
  /** Home: back to the title screen. */
  home: () => void;
}

const scn = () => useScenarioStore.getState();
const stepCount = () => scn().active()?.steps.length ?? 0;
const animating = () => {
  const { playback } = scn();
  return playback !== null && !playback.finished;
};

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  presenting: false,
  screen: 'title',

  start: (id) => {
    const s = scn();
    if (!s.scenarios().some((x) => x.id === id)) {
      useStationStore.getState().setMessage(`Nie znaleziono scenariusza „${id}”`);
      return false;
    }
    s.stopRecording();
    useAppStore.getState().setMode('scenario');
    s.select(id);
    set({ presenting: true, screen: 'title' });
    return true;
  },

  exit: () => {
    if (!get().presenting) return;
    useScenarioStore.setState({ playing: false, paused: false, gap: 0, playback: null });
    set({ presenting: false, screen: 'title' });
  },

  next: () => {
    const { screen } = get();
    if (screen === 'end') return;
    if (screen === 'title') {
      set({ screen: 'steps' });
      scn().restart();
      if (stepCount() > 0) scn().next();
      else set({ screen: 'end' });
      return;
    }
    if (!animating() && scn().position >= stepCount()) return set({ screen: 'end' });
    scn().next();
  },

  prev: () => {
    const { screen } = get();
    if (screen === 'title') return;
    if (screen === 'end') return set({ screen: 'steps' });
    const { playback, position } = scn();
    const before = playback ? playback.step : position - 1;
    if (before <= 0) return get().home();
    scn().prev();
  },

  home: () => {
    scn().restart();
    set({ screen: 'title' });
  },
}));

const HASH_PREFIX = '#/prezentacja/';

/** Scenario id from a direct presentation link (`#/prezentacja/<id>`), else null. */
export function parsePresentationHash(hash: string): string | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const id = decodeURIComponent(hash.slice(HASH_PREFIX.length)).replace(/\/+$/, '');
  return id || null;
}

export const presentationHash = (id: string) => HASH_PREFIX + encodeURIComponent(id);
