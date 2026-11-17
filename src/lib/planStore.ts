'use client';
import { create } from 'zustand';
import type { PlanResult } from '@lotwise/engine';
/** The latest Plan Builder run, kept in memory so Wrapped can use it. Not persisted: sales data stays in the browser tab. */
export const usePlan = create<{ plan: PlanResult | null; source: string; csv: string; set: (plan: PlanResult | null, source: string, csv: string) => void }>((set) => ({ plan: null, source: '', csv: '', set: (plan, source, csv) => set({ plan, source, csv }) }));
