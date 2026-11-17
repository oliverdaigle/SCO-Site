// Generates the three demo datasets for the Plan Builder (deterministic).
import fs from 'node:fs';
import { mathx } from '../packages/engine/src';

const END = Date.UTC(2026, 10, 15); // Sunday 2026-11-15
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const poisson = (r: () => number, lam: number) => { if (lam > 60) { const u1 = r() || 1e-9, u2 = r(); return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2))); } const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1; };
interface Sku { name: string; base: number; cost: number; lead: number; order: number; trend?: number; dow?: number[]; noise?: number; launch?: number; lumpy?: number; cover: number }
function make(file: string, seed: number, days: number, skus: Sku[], dirty: string[]) {
  const r = mathx.rng(seed); const lines = ['date,sku,units,unit_cost,lead_time_days,order_cost,on_hand'];
  for (const s of skus) {
    const onHand = Math.round(s.base * 7 * s.cover * (1 + (s.trend ?? 0)));
    for (let d = days - 1; d >= 0; d--) {
      const t = (days - 1 - d) / days; if (s.launch && t < s.launch) continue; const ms = END - d * 864e5; const dow = new Date(ms).getUTCDay();
      if (s.lumpy && r() > s.lumpy) continue;
      const lam = s.base * (1 + (s.trend ?? 0) * t) * (s.dow ? s.dow[dow] : 1) * (1 + (r() - 0.5) * 2 * (s.noise ?? 0.15)) / (s.lumpy ?? 1);
      const units = poisson(r, Math.max(0.01, lam)); if (units === 0) continue;
      lines.push(`${iso(ms)},${s.name},${units},${s.cost.toFixed(2)},${s.lead},${s.order},${onHand}`);
    }
  }
  lines.push(...dirty);
  fs.mkdirSync('public/samples', { recursive: true }); fs.writeFileSync(`public/samples/${file}.csv`, lines.join('\n') + '\n'); console.log(file, lines.length - 1, 'rows');
}
const cafe = [0.9, 1.15, 1.0, 1.0, 1.05, 1.2, 1.1]; const weekend = [1.5, 0.7, 0.75, 0.8, 0.9, 1.25, 1.6];
make('coffee-shop', 11, 182, [
  { name: 'House Blend Beans 12oz', base: 16, cost: 6.5, lead: 5, order: 25, dow: cafe, cover: 1.6 }, { name: 'Oat Milk 32oz', base: 22, cost: 2.9, lead: 3, order: 20, dow: cafe, trend: 0.45, cover: 0.5 }, { name: 'Whole Milk Gallon', base: 14, cost: 3.4, lead: 2, order: 15, dow: cafe, cover: 0.6 },
  { name: 'Espresso Beans 5lb', base: 3.2, cost: 42, lead: 7, order: 30, dow: cafe, cover: 2.2 }, { name: 'Paper Cups 12oz (sleeve)', base: 9, cost: 4.1, lead: 6, order: 35, dow: cafe, cover: 5.5 }, { name: 'Lids 12oz (sleeve)', base: 8.5, cost: 2.2, lead: 6, order: 35, dow: cafe, cover: 6.0 },
  { name: 'Butter Croissant', base: 38, cost: 1.1, lead: 1, order: 10, dow: weekend, noise: 0.25, cover: 0.3 }, { name: 'Blueberry Muffin', base: 21, cost: 0.95, lead: 1, order: 10, dow: weekend, noise: 0.3, cover: 0.35 }, { name: 'Vanilla Syrup 750ml', base: 1.6, cost: 7.8, lead: 9, order: 30, cover: 3.2 },
  { name: 'Caramel Syrup 750ml', base: 1.1, cost: 7.8, lead: 9, order: 30, cover: 34 }, { name: 'Chai Concentrate 32oz', base: 2.4, cost: 5.6, lead: 8, order: 30, trend: -0.35, cover: 30 }, { name: 'Cold Brew Filters (pack)', base: 0.9, cost: 11, lead: 12, order: 30, trend: 0.8, cover: 1.0 },
  { name: 'Pumpkin Spice Sauce', base: 3.5, cost: 9.4, lead: 10, order: 30, launch: 0.55, trend: 0.9, noise: 0.3, cover: 0.8 }, { name: 'Napkins (case)', base: 0.45, cost: 28, lead: 7, order: 35, cover: 46 }, { name: 'Matcha Powder 1lb', base: 0.7, cost: 24, lead: 14, order: 30, trend: 0.5, noise: 0.35, cover: 2.5 },
], ['2026-13-40,Oat Milk 32oz,12,2.90,3,20,77', '2026-09-03,,5,1.10,1,10,0', '2026-09-04,Whole Milk Gallon,twelve,3.40,2,15,59', '2026-09-12,Butter Croissant,-6,1.10,1,10,80']);
make('sneaker-resale', 23, 273, [
  { name: 'Aero Runner 2 White', base: 2.6, cost: 92, lead: 21, order: 60, cover: 3.5 }, { name: 'Aero Runner 2 Black', base: 3.1, cost: 92, lead: 21, order: 60, trend: 0.3, cover: 2.0 }, { name: 'Court Classic Low Sail', base: 1.9, cost: 74, lead: 18, order: 60, cover: 4.2 },
  { name: 'Trail Peak GTX Olive', base: 0.8, cost: 138, lead: 28, order: 75, trend: 0.9, noise: 0.3, cover: 1.4 }, { name: 'Retro High 85 Chicago', base: 0.55, cost: 265, lead: 35, order: 90, noise: 0.5, cover: 6.5 }, { name: 'Retro High 85 Royal', base: 0.4, cost: 240, lead: 35, order: 90, noise: 0.5, trend: -0.4, cover: 52 },
  { name: 'Foam Slide Bone', base: 4.4, cost: 38, lead: 14, order: 45, dow: [1.3, 0.8, 0.8, 0.9, 1.0, 1.2, 1.4], trend: 0.5, cover: 1.1 }, { name: 'Skate Pro Suede Navy', base: 1.2, cost: 58, lead: 18, order: 55, cover: 3.0 }, { name: 'Daily Trainer Grey', base: 2.2, cost: 81, lead: 20, order: 60, trend: -0.3, cover: 24 },
  { name: 'Collab Dunk Panda', base: 1.5, cost: 118, lead: 30, order: 80, noise: 0.6, launch: 0.4, trend: 1.2, cover: 0.9 }, { name: 'Crew Socks 3-Pack', base: 6.5, cost: 7.5, lead: 10, order: 30, cover: 6.0 }, { name: 'Cleaning Kit', base: 1.8, cost: 9, lead: 10, order: 30, cover: 44 },
], ['11/31/2026,Cleaning Kit,2,9.00,10,30,150', '2026-06-18,Foam Slide Bone,,38.00,14,45,36']);
make('small-manufacturer', 37, 364, [
  { name: 'BRKT-204 Steel Bracket', base: 60, cost: 2.4, lead: 14, order: 120, lumpy: 0.35, cover: 4.0 }, { name: 'HSG-110 Aluminum Housing', base: 14, cost: 18.5, lead: 28, order: 250, lumpy: 0.3, cover: 2.6 }, { name: 'GSKT-031 Gasket', base: 110, cost: 0.38, lead: 10, order: 80, lumpy: 0.4, cover: 9.0 },
  { name: 'MTR-550 Drive Motor', base: 3.2, cost: 142, lead: 42, order: 300, lumpy: 0.25, trend: 0.4, cover: 3.0 }, { name: 'PCB-A7 Control Board', base: 3.4, cost: 64, lead: 35, order: 280, lumpy: 0.25, trend: 0.4, noise: 0.3, cover: 1.2 }, { name: 'FAST-M6 Bolt Kit', base: 240, cost: 0.11, lead: 7, order: 60, lumpy: 0.5, cover: 60 },
  { name: 'BRG-6204 Bearing', base: 26, cost: 3.9, lead: 21, order: 150, lumpy: 0.35, cover: 5.5 }, { name: 'SHFT-22 Ground Shaft', base: 6.5, cost: 31, lead: 30, order: 220, lumpy: 0.3, trend: -0.35, cover: 34 }, { name: 'CBL-3M Wiring Harness', base: 7, cost: 12.8, lead: 24, order: 180, lumpy: 0.3, cover: 2.2 }, { name: 'LBL-KIT Label Set', base: 18, cost: 0.9, lead: 12, order: 70, lumpy: 0.35, cover: 70 },
], ['2026-02-30,FAST-M6 Bolt Kit,500,0.11,7,60,20160']);
