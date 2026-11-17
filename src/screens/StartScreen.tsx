'use client';
import type { Mode } from '@lotwise/engine';
import { useStore } from '@/lib/store';
import { Link, useNav } from '@/platform/nav';
import { Icon, Wordmark } from '@/components/icons';

/** First-visit mode choice. Two worlds, one engine. */
export function ModeChoice({ compact }: { compact?: boolean }) {
  const setMode = useStore((s) => s.setMode); const nav = useNav();
  const go = (m: Mode) => { setMode(m); nav.push(m === 'learner' ? '/learn' : '/business'); };
  const panel = (m: Mode) => {
    const biz = m === 'business';
    return (
      <button type="button" onClick={() => go(m)} data-mode={m} className="group relative flex min-h-[19rem] flex-1 flex-col justify-end overflow-hidden rounded-3xl border border-line bg-surface p-7 text-left transition-all duration-300 hover:-translate-y-1 hover:border-accent-line focus-visible:-translate-y-1 sm:min-h-[26rem] sm:p-10">
        <span aria-hidden className="absolute -right-16 -top-16 h-72 w-72 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60" style={{ background: 'var(--accent)' }} />
        <svg aria-hidden viewBox="0 0 400 200" className="absolute inset-x-0 top-5 h-[44%] w-full opacity-70 transition-transform duration-500 group-hover:scale-[1.03]">
          {biz ? (<><path d="M20 150 L20 60 L110 150 L110 60 L200 150 L200 60 L290 150 L290 60 L380 150" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /><line x1="10" x2="390" y1="118" y2="118" stroke="var(--accent)" strokeDasharray="6 6" strokeOpacity=".5" /><line x1="10" x2="390" y1="150" y2="150" stroke="var(--line-strong)" /></>)
            : (<><path d="M20 160 C 120 160, 140 40, 200 40 S 280 160, 380 160" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" /><path d="M20 160 C 120 160, 140 40, 200 40 S 250 110, 262 128 L262 160 Z" fill="var(--accent)" fillOpacity=".18" /><line x1="262" x2="262" y1="30" y2="160" stroke="var(--accent)" strokeDasharray="6 6" /><text x="270" y="44" fontSize="15" fill="var(--accent)" fontFamily="var(--font-math)" fontStyle="italic">z = 1.645</text></>)}
        </svg>
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-lg"><Icon name={biz ? 'briefcase' : 'book'} size={22} /></span>
        <span className="display relative mt-5 block text-3xl font-semibold leading-tight sm:text-[2.6rem]">{biz ? 'I’m running a business' : 'I’m learning'}</span>
        <span className="relative mt-3 block max-w-md text-muted">{biz ? 'Plain-language answers, what they mean in dollars and time, and what to do next.' : 'Step-by-step solutions in your textbook’s notation, exam traps, and unlimited practice.'}</span>
        <span className="relative mt-6 inline-flex items-center gap-2 font-semibold text-accent">{biz ? 'Enter Business mode' : 'Enter Learner mode'}<Icon name="arrowRight" className="transition-transform group-hover:translate-x-1" /></span>
      </button>
    );
  };
  return (
    <div className={compact ? '' : 'relative flex min-h-dvh flex-col overflow-hidden'}>
      {!compact && <div className="aurora" aria-hidden />}
      <div className={compact ? '' : 'wrap relative flex flex-1 flex-col justify-center py-10'}>
        {!compact && (<div className="mb-8 text-center sm:mb-12"><Link href="/" aria-label="Lotwise home" className="inline-block"><Wordmark size={34} /></Link><h1 className="mx-auto mt-6 max-w-2xl text-4xl font-semibold sm:text-6xl">How will you use Lotwise?</h1><p className="mt-3 text-lg text-muted">Same verified math. Two ways to see it. You can switch any time.</p></div>)}
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">{panel('business')}{panel('learner')}</div>
      </div>
    </div>
  );
}
export function StartScreen() { return <ModeChoice />; }
