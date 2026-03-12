// client/src/stores/achievementStore.ts — Achievement state management
import { create } from 'zustand';
import type { AchievementDef, PlayerAchievementSummary } from '@nannaricher/shared';
import { useAuthStore } from './authStore';

const GAME_API = import.meta.env.VITE_API_URL || '';

interface AchievementState {
  definitions: AchievementDef[];
  summary: PlayerAchievementSummary | null;
  newlyUnlocked: string[]; // achievement IDs just unlocked (for toast/popup)
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDefinitions: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchAll: () => Promise<void>;
  handleUnlocked: (achievementIds: string[]) => void;
  clearNewlyUnlocked: () => void;
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  definitions: [],
  summary: null,
  newlyUnlocked: [],
  isLoading: false,
  error: null,

  fetchDefinitions: async () => {
    try {
      const res = await fetch(`${GAME_API}/api/achievements`);
      if (!res.ok) throw new Error('Failed to fetch achievements');
      const data = await res.json();
      set({ definitions: data });
    } catch (err: any) {
      console.error('[Achievements] Failed to fetch definitions:', err);
    }
  },

  fetchSummary: async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${GAME_API}/api/achievements/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch achievement summary');
      const data: PlayerAchievementSummary = await res.json();
      set({ summary: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchAll: async () => {
    const { fetchDefinitions, fetchSummary } = get();
    await Promise.all([fetchDefinitions(), fetchSummary()]);
  },

  handleUnlocked: (achievementIds: string[]) => {
    if (achievementIds.length === 0) return;
    // Append to existing (in case of rapid successive events)
    set(s => ({ newlyUnlocked: [...s.newlyUnlocked, ...achievementIds] }));
    // Refresh summary to get updated data
    get().fetchSummary();
  },

  clearNewlyUnlocked: () => {
    set({ newlyUnlocked: [] });
  },
}));
