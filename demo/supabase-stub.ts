// The demo never talks to Supabase. This stands in for src/lib/supabase/client.ts so its SDK is not bundled.
export function supabaseBrowser(): never { throw new Error('Supabase is not available in the demo.'); }
