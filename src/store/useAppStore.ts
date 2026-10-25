import { create } from 'zustand';

export type AppMode = 'edit' | 'drive' | 'scenario';

interface AppStore {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  mode: 'edit',
  setMode: (mode) => set({ mode }),
}));
