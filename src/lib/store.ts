'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Mode, NotationId, Vals } from '@lotwise/engine';
import { DEMO_MODE } from '@/platform/env';

export interface User { email: string; name: string; demo: boolean; admin: boolean }
export interface Plan { businessPro: boolean; learnerPro: boolean; learnerUntil: string | null; source: 'demo' | 'stripe' | 'none' }
export interface Scenario { id: string; calcId: string; name: string; values: Vals; savedAt: string; headline: string }
export interface PracticeStat { attempts: number; correct: number; lastWrong: boolean }

interface State {
  hydrated: boolean;
  mode: Mode | null;
  theme: 'dark' | 'light';
  notation: NotationId;
  eli: boolean;
  user: User | null;
  plan: Plan;
  streak: { count: number; lastDay: string; best: number };
  xp: number;
  practice: Record<string, PracticeStat>;
  practiceToday: { day: string; count: number };
  scenarios: Scenario[];
  recent: string[];
  seenIntro: boolean;
  setMode: (m: Mode) => void;
  setTheme: (t: 'dark' | 'light') => void;
  setNotation: (n: NotationId) => void;
  setEli: (b: boolean) => void;
  signIn: (u: User) => void;
  signOut: () => void;
  setPlan: (p: Partial<Plan>) => void;
  recordAnswer: (calcId: string, correct: boolean) => { streak: number; xp: number; newDay: boolean };
  saveScenario: (s: Omit<Scenario, 'id' | 'savedAt'>) => void;
  removeScenario: (id: string) => void;
  visit: (calcId: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      mode: null, theme: 'dark', notation: 'heizer', eli: false,
      user: null,
      // In demo mode every Pro feature starts unlocked so the whole product can be explored.
      plan: { businessPro: DEMO_MODE, learnerPro: DEMO_MODE, learnerUntil: null, source: DEMO_MODE ? 'demo' : 'none' },
      streak: { count: 0, lastDay: '', best: 0 }, xp: 0, practice: {}, practiceToday: { day: '', count: 0 }, scenarios: [], recent: [], seenIntro: false,
      setMode: (mode) => { set({ mode, seenIntro: true }); if (typeof document !== 'undefined') document.documentElement.dataset.mode = mode; },
      setTheme: (theme) => { set({ theme }); if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme; },
      setNotation: (notation) => set({ notation }),
      setEli: (eli) => set({ eli }),
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      setPlan: (p) => set({ plan: { ...get().plan, ...p } }),
      recordAnswer: (calcId, correct) => {
        const s = get(); const d = today(); const prev = s.practice[calcId] ?? { attempts: 0, correct: 0, lastWrong: false };
        let streak = s.streak; let newDay = false;
        if (correct && s.streak.lastDay !== d) { const count = s.streak.lastDay === yesterday() ? s.streak.count + 1 : 1; streak = { count, lastDay: d, best: Math.max(s.streak.best, count) }; newDay = true; }
        const xp = s.xp + (correct ? 10 : 2);
        set({ practice: { ...s.practice, [calcId]: { attempts: prev.attempts + 1, correct: prev.correct + (correct ? 1 : 0), lastWrong: !correct } }, streak, xp, practiceToday: { day: d, count: s.practiceToday.day === d ? s.practiceToday.count + 1 : 1 } });
        return { streak: streak.count, xp, newDay };
      },
      saveScenario: (sc) => set({ scenarios: [{ ...sc, id: Math.random().toString(36).slice(2, 10), savedAt: new Date().toISOString() }, ...get().scenarios].slice(0, 100) }),
      removeScenario: (id) => set({ scenarios: get().scenarios.filter((x) => x.id !== id) }),
      visit: (calcId) => set({ recent: [calcId, ...get().recent.filter((x) => x !== calcId)].slice(0, 8) }),
    }),
    { name: 'lotwise:v1', skipHydration: true, partialize: (s) => { const { hydrated, setMode, setTheme, setNotation, setEli, signIn, signOut, setPlan, recordAnswer, saveScenario, removeScenario, visit, ...rest } = s; return rest; } },
  ),
);

/** Streak shown to the user: it lapses if a day was missed. */
export function liveStreak(s: { count: number; lastDay: string }): number { return s.lastDay === today() || s.lastDay === yesterday() ? s.count : 0; }
export const FREE_PRACTICE_PER_DAY = 3;
export function practiceLeft(s: Pick<State, 'plan' | 'practiceToday'>): number { if (s.plan.learnerPro) return Infinity; return Math.max(0, FREE_PRACTICE_PER_DAY - (s.practiceToday.day === today() ? s.practiceToday.count : 0)); }
