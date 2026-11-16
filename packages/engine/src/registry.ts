import type { CalcDef } from './types';
import inventory from './calcs/inventory';

export const CALCS: CalcDef[] = [...inventory];
export const byId: Record<string, CalcDef> = Object.fromEntries(CALCS.map((c) => [c.id, c]));
