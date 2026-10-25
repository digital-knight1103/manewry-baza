import { create } from 'zustand';

export type AppMode = 'edit' | 'drive' | 'scenario';
/** How vehicles are drawn: plain coloured bands or detailed drawings (bogies, cab, wheelsets). */
export type ViewStyle = 'schematic' | 'detailed';

const VIEW_KEY = 'manewry-baza:widok';

function loadView(): ViewStyle {
  try {
    return localStorage.getItem(VIEW_KEY) === 'schematic' ? 'schematic' : 'detailed';
  } catch {
    return 'detailed';
  }
}

interface AppStore {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  view: ViewStyle;
  setView: (view: ViewStyle) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  mode: 'edit',
  setMode: (mode) => set({ mode }),
  view: typeof localStorage === 'undefined' ? 'detailed' : loadView(),
  setView: (view) => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Private mode etc. – the choice just is not remembered.
    }
    set({ view });
  },
}));
