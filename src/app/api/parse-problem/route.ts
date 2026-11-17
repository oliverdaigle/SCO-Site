import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { aiCatalog, byId } from '@lotwise/engine';
import { currentUser, planFromSubs, supabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const MODEL = 'claude-opus-5-5';
const SYSTEM = `You read operations and supply chain homework problems for a calculator site. Given the problem text, choose the single calculator that solves it and extract its inputs.

Rules:
- Choose calcId only from the catalog below. If nothing fits, return an empty string for calcId.
- Extract only numbers that the problem states. Never invent or assume a value; leave an input out if the problem does not give it.
- Percent inputs are entered as percent numbers (a 95% service level is 95, not 0.95).
- Inputs marked (+id_u: day|week|month|year) carry a time unit. Report the number exactly as the problem states it and report the unit separately as an entry with id "<id>_u". Do not convert units yourself.
- Inputs marked [] are number lists. Inputs marked [{...}] are tables: a list of row objects using the column ids shown.
- For inputs with a fixed set of choices {a,b,c}, use one of the listed values.
- Each value is given as a JSON literal in a string, for example "95", "\\"week\\"", "[120, 135, 150]".
- evidence is the short phrase from the problem that the value came from.
- note is one plain sentence a student would find useful, such as a unit mismatch you noticed, or an empty string.

Catalog (id | name | inputs):
${aiCatalog()}`;
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['calcId', 'confidence', 'values', 'note'],
  properties: {
    calcId: { type: 'string' }, confidence: { type: 'number' }, note: { type: 'string' },
    values: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'json', 'evidence'], properties: { id: { type: 'string' }, json: { type: 'string' }, evidence: { type: 'string' } } } },
  },
};

/** Tells the page whether the AI reader is available (an Anthropic key is configured). */
export async function GET() { return NextResponse.json({ ai: !!process.env.ANTHROPIC_API_KEY }); }

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI reader is not configured' }, { status: 503 });
  // The AI reader is a Learner Pro feature. When accounts are live, only subscribers may spend the owner's API budget.
  if (supabaseConfigured()) {
    const { user, supabase } = await currentUser(); if (!user || !supabase) return NextResponse.json({ error: 'Sign in to use the AI reader' }, { status: 401 });
    const { data: subs } = await supabase.from('subscriptions').select('plan, status, current_period_end').eq('user_id', user.id);
    if (!planFromSubs(subs ?? []).learnerPro) return NextResponse.json({ error: 'Learner Pro required' }, { status: 402 });
  }
  const body = await req.json().catch(() => null); const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 4000) : '';
  if (text.length < 12) return NextResponse.json({ error: 'Paste more of the problem.' }, { status: 400 });
  const client = new Anthropic();
  try {
    // Server-side fallback is on: if the main model declines a request, the API reruns it on a fallback model in the same call.
    const res = await client.beta.messages.create({
      model: MODEL, max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Problem:\n${text}` }],
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return NextResponse.json({ error: 'Could not read this problem' }, { status: 422 });
    const out = res.content.find((b) => b.type === 'text'); if (!out || out.type !== 'text') return NextResponse.json({ error: 'Empty response' }, { status: 502 });
    const parsed = JSON.parse(out.text); if (!byId[parsed.calcId]) return NextResponse.json({ error: 'No matching calculator' }, { status: 422 });
    const values: Record<string, unknown> = {}; const evidence: Record<string, string> = {};
    for (const v of parsed.values ?? []) { try { values[v.id] = JSON.parse(v.json); evidence[v.id] = String(v.evidence ?? ''); } catch { /* skip a value that is not valid JSON */ } }
    return NextResponse.json({ calcId: parsed.calcId, confidence: parsed.confidence, values, evidence, note: parsed.note });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Busy, try again in a moment' }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: 'AI key is invalid' }, { status: 503 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: 'AI reader failed' }, { status: 502 });
    return NextResponse.json({ error: 'Could not read the response' }, { status: 502 });
  }
}
