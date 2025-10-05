import { create } from 'zustand';

type PerfBudget = 'ok' | 'down' | 'up';

interface UIState {
  cleanPercent: number;
  streak: number;
  jetOn: boolean;
  perfBudget: PerfBudget;
  setCleanPercent: (value: number) => void;
  setStreak: (value: number) => void;
  setJetOn: (value: boolean) => void;
  setPerfBudget: (value: PerfBudget) => void;
  bindGameEvents: (bus: unknown) => void;
}

export const useUIStore = create<UIState>((set) => ({
  cleanPercent: 0,
  streak: 0,
  jetOn: false,
  perfBudget: 'ok',

  setCleanPercent: (value) => set({ cleanPercent: value }),
  setStreak: (value) => set({ streak: value }),
  setJetOn: (value) => set({ jetOn: value }),
  setPerfBudget: (value) => set({ perfBudget: value }),

  // Placeholder for game event binding
  // Will be implemented when game engine event bus is ready
  bindGameEvents: (_bus: unknown) => {
    // TODO: Subscribe to engine events and update UI state
    console.log('Game events binding placeholder');
  },
}));
