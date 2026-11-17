// Loads a Plan Builder sample dataset. The standalone demo bundle swaps this file for one with the CSVs inlined.
export { SAMPLES } from '@/data/samples';
export async function loadSample(id: string): Promise<string> { const r = await fetch(`/samples/${id}.csv`); if (!r.ok) throw new Error('Could not load the sample file.'); return r.text(); }
