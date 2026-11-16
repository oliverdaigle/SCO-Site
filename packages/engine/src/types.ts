import type { Rng } from './math/util';

export type Mode = 'business' | 'learner';
export type NotationId = 'heizer' | 'chopra' | 'cachon' | 'jacobs';
export type TimeUnit = 'day' | 'week' | 'month' | 'year';
export type Tone = 'accent' | 'alt' | 'alt2' | 'muted' | 'good' | 'warn' | 'bad';
export type Vals = Record<string, any>;
export type Outs = Record<string, any>;

export interface ColumnDef { id: string; label: string; kind: 'text' | 'number'; def?: any; help?: string; w?: number }

export interface InputDef {
  id: string;
  kind: 'number' | 'money' | 'percent' | 'int' | 'select' | 'series' | 'table' | 'tree';
  /** Symbol: a key of the notation table (adapts per textbook) or raw mini-TeX. */
  sym?: string;
  label: string;
  blabel?: string;
  help?: string;
  unit?: string;
  /** Time-dimensioned quantity. rate: per-period amount. dur: a length of time. sd: std dev of a per-period amount (scales with sqrt). */
  time?: { role: 'rate' | 'dur' | 'sd'; unit: TimeUnit };
  def: any;
  min?: number; max?: number; step?: number;
  /** Range [lo, hi, step] used for practice problems and randomized cross-checks. */
  rand?: [number, number, number?];
  options?: { value: string; label: string }[];
  columns?: ColumnDef[];
  minRows?: number;
  adv?: boolean;
  show?: (v: Vals) => boolean;
  sens?: boolean;
  cues?: string[];
  learnerOnly?: boolean;
}

export interface OutputDef {
  id: string; sym?: string; label: string; blabel?: string; unit?: string;
  fmt?: 'num' | 'int' | 'money' | 'pct' | 'text';
  dp?: number; primary?: boolean;
  show?: (v: Vals, o: Outs) => boolean;
}

export interface TableSpec { caption?: string; columns: string[]; rows: (string | number)[][]; highlight?: number[]; note?: string }

export interface Step {
  title: string;
  tex?: string;
  why?: string;
  /** Plain-language rewrite used by "Explain like I'm new". */
  eli?: string;
  lookup?: string;
  table?: TableSpec;
}

export interface BizView { headline: string; meaning: string[]; actions: string[] }

export interface XYSeries { name: string; pts: [number, number][]; style: 'line' | 'area' | 'step' | 'bars' | 'dots' | 'dash'; tone?: Tone }
export type VizSpec =
  | { kind: 'xy'; x: { label: string; cats?: string[] }; y: { label: string; zero?: boolean }; series: XYSeries[];
      hlines?: { y: number; label: string; tone?: Tone }[]; vlines?: { x: number; label: string; tone?: Tone }[];
      bands?: { y0: number; y1: number; label: string; tone?: Tone }[];
      shade?: { x0: number; x1: number; series: number; tone?: Tone; label?: string }[];
      marks?: { x: number; y: number; label: string; tone?: Tone }[]; flagged?: number[] }
  | { kind: 'queue'; lambda: number; mu: number; servers: number; cva: number; cvs: number; Lq: number; Wq: number; rho: number; timeUnit: string }
  | { kind: 'network'; variant: 'cpm' | 'line'; nodes: { id: string; label: string; dur: number; es?: number; ef?: number; ls?: number; lf?: number; slack?: number; critical?: boolean; group?: number }[]; edges: [string, string][]; total?: number }
  | { kind: 'map'; tableId: string; points: { name: string; x: number; y: number; w: number }[]; center?: { x: number; y: number; label: string }; candidates?: { name: string; x: number; y: number; score: number; best: boolean }[] }
  | { kind: 'tree'; root: TreeViz }
  | { kind: 'flow'; steps: { name: string; cap: number; util: number; bottleneck: boolean; sub?: string }[]; unit: string; flowRate: number }
  | { kind: 'meters'; items: { label: string; value: number; max: number; text: string; tone?: Tone }[]; chain?: string }
  | { kind: 'matrix'; rows: string[]; cols: string[]; cells: number[][]; best?: [number, number][]; rowTags?: string[]; fmt?: 'num' | 'money' | 'pct'; colNote?: string[] }
  | { kind: 'timeline'; unit: string; segs: { label: string; start: number; end: number; tone?: Tone; row: number }[]; marker?: { x: number; label: string } }
  | { kind: 'grid'; periods: string[]; rows: { label: string; vals: (number | null)[]; tone?: Tone; bold?: boolean }[] }
  | { kind: 'stack'; unit: string; bars: { label: string; best?: boolean; parts: { name: string; value: number; tone?: Tone }[] }[] }
  | { kind: 'container'; cubePct: number; weightPct: number; units: number; limiting: string }
  | { kind: 'kpitree'; root: KpiNode };

export interface TreeViz { id: string; type: 'decision' | 'chance' | 'end'; label: string; value: number; prob?: number; best?: boolean; children?: TreeViz[] }
export interface KpiNode { label: string; value: string; op?: string; children?: KpiNode[]; tone?: Tone }

export interface Fmt {
  num: (x: number, dp?: number) => string;
  int: (x: number) => string;
  money: (x: number, dp?: number) => string;
  pct: (x: number, dp?: number) => string;
  /** number for use inside TeX */
  t: (x: number, dp?: number) => string;
}

export interface Ctx {
  /** Symbols resolved for the selected textbook notation. */
  s: Record<string, string>;
  f: Fmt;
  nota: NotationId;
  /** Basis time unit label for this run, e.g. "year". */
  u: string;
}

export interface Example { title: string; story: string; v: Vals; expect: Record<string, number>; tol?: number; note?: string }

export interface Practice { prompt: (v: Vals, f: Fmt) => string; ask: string[]; gen?: (r: Rng) => Vals }

export interface CalcDef {
  id: string;
  name: string;
  short: string;
  cat: string;
  /** Business-mode question this calculator answers. */
  bq: string;
  blurb: string;
  keywords: string[];
  symptoms: string[];
  /** Headline formula in mini-TeX using notation keys via template fn. */
  formula: (s: Record<string, string>) => string;
  inputs: InputDef[];
  outputs: OutputDef[];
  basis?: TimeUnit | { from: string };
  compute: (v: Vals) => Outs;
  check?: (v: Vals) => string | null;
  steps: (v: Vals, o: Outs, c: Ctx) => Step[];
  biz: (v: Vals, o: Outs, f: Fmt) => BizView;
  viz: (v: Vals, o: Outs, f: Fmt) => VizSpec;
  traps: string[];
  analogy: string;
  convention?: string;
  examples: Example[];
  practice: Practice;
  /** Calculators whose outputs feed this one (edges of the formula map). */
  uses: string[];
  /** Monotonicity properties: [input, output, +1 | -1]. */
  mono?: [string, string, 1 | -1][];
  /** Custom random-input generator for cross-checks (defaults to `rand` ranges). */
  gen?: (r: Rng) => Vals;
  /** One-line real-world claim verified by simulation (shown on the Verified page). */
  claim?: string;
  faq?: { q: string; a: string }[];
}

export interface RunResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  v: Vals;
  o: Outs;
  steps: Step[];
  biz: BizView | null;
  viz: VizSpec | null;
  unit: string;
}
