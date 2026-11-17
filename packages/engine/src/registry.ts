import type { CalcDef } from './types';
import inventory from './calcs/inventory';
import service from './calcs/service';
import performance from './calcs/performance';
import forecasting from './calcs/forecasting';
import process from './calcs/process';
import queuing from './calcs/queuing';
import quality from './calcs/quality';
import mrp from './calcs/mrp';
import logistics from './calcs/logistics';

export const CALCS: CalcDef[] = [...inventory, ...service, ...performance, ...forecasting, ...process, ...queuing, ...quality, ...mrp, ...logistics];
export const byId: Record<string, CalcDef> = Object.fromEntries(CALCS.map((c) => [c.id, c]));
