import type { CalcDef } from './types';
import inventory from './calcs/inventory';
import service from './calcs/service';
import performance from './calcs/performance';
import forecasting from './calcs/forecasting';

export const CALCS: CalcDef[] = [...inventory, ...service, ...performance, ...forecasting];
export const byId: Record<string, CalcDef> = Object.fromEntries(CALCS.map((c) => [c.id, c]));
