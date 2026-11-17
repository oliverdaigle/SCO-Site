// Catalog metadata: categories (Business) and chapters (Learner), plus the formula dependency graph.
import { CALCS, byId } from './registry';
import type { CalcDef } from './types';

export interface Category { id: string; name: string; bname: string; blurb: string; chapter: number; stage: 'forecast' | 'supplier' | 'factory' | 'warehouse' | 'store' | 'customer'; icon: string }

export const CATEGORIES: Category[] = [
  { id: 'process', name: 'Process and Capacity', bname: 'Speed up my operation', blurb: 'Flow, bottlenecks, capacity, and line design.', chapter: 1, stage: 'factory', icon: 'flow' },
  { id: 'queue', name: 'Queuing', bname: 'Cut waiting and set staffing', blurb: 'Waiting lines, staffing levels, and the cost of variability.', chapter: 2, stage: 'store', icon: 'queue' },
  { id: 'quality', name: 'Quality', bname: 'Control quality', blurb: 'Control charts, capability, and the cost of getting it wrong.', chapter: 3, stage: 'factory', icon: 'quality' },
  { id: 'forecast', name: 'Forecasting', bname: 'Forecast demand', blurb: 'Predict demand and measure how good the prediction is.', chapter: 4, stage: 'forecast', icon: 'forecast' },
  { id: 'inv-order', name: 'Inventory: Order Quantity', bname: 'Decide how much to order', blurb: 'Order sizes that balance ordering and holding cost.', chapter: 5, stage: 'warehouse', icon: 'box' },
  { id: 'inv-service', name: 'Inventory: Uncertainty and Service', bname: 'Stop running out of stock', blurb: 'Reorder points, safety stock, and service levels.', chapter: 6, stage: 'warehouse', icon: 'shield' },
  { id: 'inv-perf', name: 'Inventory: Performance', bname: 'Check inventory health', blurb: 'Turns, days of supply, ABC analysis, and return on inventory.', chapter: 7, stage: 'warehouse', icon: 'gauge' },
  { id: 'mrp', name: 'Planning and MRP', bname: 'Plan production and materials', blurb: 'Time-phased material plans, lot sizing, and aggregate plans.', chapter: 8, stage: 'factory', icon: 'grid' },
  { id: 'logistics', name: 'Logistics and Network', bname: 'Ship smarter and pick locations', blurb: 'Landed cost, freight, and where to put facilities.', chapter: 9, stage: 'supplier', icon: 'truck' },
  { id: 'sourcing', name: 'Sourcing', bname: 'Choose and compare suppliers', blurb: 'Total cost of ownership, scorecards, and make-or-buy.', chapter: 10, stage: 'supplier', icon: 'handshake' },
  { id: 'finance', name: 'Supply Chain Finance and Metrics', bname: 'Track cash and performance', blurb: 'Cash cycle, return on assets, and delivery metrics.', chapter: 11, stage: 'customer', icon: 'chart' },
  { id: 'project', name: 'Project Management', bname: 'Plan a project', blurb: 'Critical path, uncertain durations, and crashing.', chapter: 12, stage: 'factory', icon: 'network' },
  { id: 'decision', name: 'Decision Analysis', bname: 'Make a tough call', blurb: 'Expected value, decision trees, and the value of information.', chapter: 13, stage: 'customer', icon: 'tree' },
];
export const catById: Record<string, Category> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const CHAPTERS = [...CATEGORIES].sort((a, b) => a.chapter - b.chapter);
export const calcsIn = (cat: string): CalcDef[] => CALCS.filter((c) => c.cat === cat);

export interface Edge { from: string; to: string }
/** Directed edges: `from` feeds `to` (an output of one is an input or concept used by the other). */
export const EDGES: Edge[] = CALCS.flatMap((c) => c.uses.filter((u) => byId[u]).map((u) => ({ from: u, to: c.id })));

/** Related calculators: direct graph neighbours first, then same-category siblings. */
export function related(id: string, limit = 6): CalcDef[] {
  const self = byId[id]; if (!self) return [];
  const seen = new Set<string>([id]); const outList: CalcDef[] = [];
  const push = (x?: CalcDef) => { if (x && !seen.has(x.id)) { seen.add(x.id); outList.push(x); } };
  EDGES.filter((e) => e.to === id).forEach((e) => push(byId[e.from]));
  EDGES.filter((e) => e.from === id).forEach((e) => push(byId[e.to]));
  calcsIn(self.cat).forEach(push);
  return outList.slice(0, limit);
}

/** A curated learning path through the graph: the chain every operations course builds. */
export const LEARNING_PATHS: { id: string; name: string; blurb: string; steps: string[] }[] = [
  { id: 'stockout', name: 'From forecast error to reorder point', blurb: 'How uncertainty in a forecast becomes units on a shelf.', steps: ['exponential-smoothing', 'mad', 'safety-stock-demand', 'reorder-point', 'continuous-review', 'fill-rate'] },
  { id: 'order', name: 'How much to order', blurb: 'From holding cost to the full ordering policy.', steps: ['holding-cost', 'eoq', 'total-inventory-cost', 'quantity-discount', 'epq', 'backorder-eoq'] },
  { id: 'flow', name: 'Flow and waiting', blurb: 'Capacity, bottlenecks, and why lines form.', steps: ['takt-time', 'cycle-time', 'bottleneck', 'utilization', 'littles-law', 'mm1', 'mms', 'kingman'] },
  { id: 'quality', name: 'Is the process good enough?', blurb: 'From control to capability to cost.', steps: ['xbar-r-chart', 'process-capability', 'dpmo-sigma', 'taguchi-loss', 'cost-of-quality'] },
  { id: 'project', name: 'Schedule a project', blurb: 'From a task list to a deadline you can defend.', steps: ['cpm', 'pert', 'pert-probability', 'crashing'] },
  { id: 'cash', name: 'Inventory to cash', blurb: 'How stock on a shelf shows up in the financials.', steps: ['average-inventory', 'inventory-turnover', 'days-of-supply', 'cash-to-cash', 'dupont-roa'] },
];
