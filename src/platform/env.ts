// Build target and demo-mode detection. The standalone demo bundle sets NEXT_PUBLIC_TARGET=artifact.
export const IS_ARTIFACT = process.env.NEXT_PUBLIC_TARGET === 'artifact';
export const HAS_SUPABASE = !IS_ARTIFACT && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
/** Demo mode: no keys present. Auth and payments are simulated and Pro features can be toggled on. */
export const DEMO_MODE = !HAS_SUPABASE;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://lotwise.io').replace(/\/$/, '');
export const BRAND = { name: 'Lotwise', tagline: 'Supply chain math, made obvious.', domain: 'lotwise.io' };
