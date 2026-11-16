import type { CalcDef } from './types';
import inventory from './calcs/inventory';
import service from './calcs/service';

export const CALCS: CalcDef[] = [...inventory, ...service];
export const byId: Record<string, CalcDef> = Object.fromEntries(CALCS.map((c) => [c.id, c]));
