// Sample datasets for the Plan Builder. The standalone demo bundle swaps this file for one with the CSVs inlined.
export const SAMPLES = [
  { id: 'coffee-shop', name: 'Coffee shop', blurb: '15 products, 26 weeks of daily sales. Milk, beans, pastries, and a seasonal launch.', icon: 'store' },
  { id: 'sneaker-resale', name: 'Sneaker resale store', blurb: '12 styles, 39 weeks. Hype releases, slow classics, long lead times.', icon: 'cart' },
  { id: 'small-manufacturer', name: 'Small manufacturer', blurb: '10 components, a full year of lumpy usage. Motors, boards, fasteners.', icon: 'factory' },
] as const;
export async function loadSample(id: string): Promise<string> { const r = await fetch(`/samples/${id}.csv`); if (!r.ok) throw new Error('Could not load the sample file.'); return r.text(); }
