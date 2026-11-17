// Content pages. No client state, so they render on the server.
import type { ReactNode } from 'react';
import { CALCS } from '@lotwise/engine';
import summary from '@/data/verified-summary.json';
import { BRAND } from '@/platform/env';
import { Link } from '@/platform/nav';
import { Icon } from '@/components/icons';

const N = CALCS.length; const S = summary.summary; const n = (x: number) => x.toLocaleString('en-US');
function Page({ eyebrow, title, lead, children, template }: { eyebrow: string; title: string; lead?: string; children: ReactNode; template?: boolean }) {
  return (
    <div className="wrap max-w-3xl pb-24 pt-8 sm:pt-14">
      <p className="eyebrow">{eyebrow}</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{title}</h1>{lead && <p className="mt-4 text-lg text-muted">{lead}</p>}
      {template && <div role="note" className="mt-6 flex gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm"><Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warn" /><p><b>Template.</b> This page is a starting point written in plain language. It is not legal advice. Before launch, replace the bracketed details and have a qualified lawyer review it for your business and location.</p></div>}
      <div className="prose mt-8 space-y-5 text-muted [&_a]:text-accent [&_a]:underline [&_b]:text-fg [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </div>
  );
}

export function AboutScreen() {
  return (
    <Page eyebrow="About" title="Supply chain math, made obvious." lead={`${BRAND.name} is ${N} supply chain and operations calculators in one place, built so that the person running a business and the person studying for an exam can both get what they need from the same verified math.`}>
      <h2>Why this exists</h2>
      <p>The formulas that run inventory, forecasting, queues, quality, and projects are not secret. They are in every operations textbook. But using them is harder than it should be. Calculator sites bury one formula per page under ads. Spreadsheets break quietly. And textbooks use four different sets of symbols for the same idea.</p>
      <p>{BRAND.name} starts from a different question: what are you trying to decide? Tell it you keep running out of stock, or that your professor assigned a safety stock problem, and it takes you to the right model, asks for your numbers in your own units, and shows the answer first.</p>
      <h2>Two modes, one engine</h2>
      <p><b>Business mode</b> speaks in plain language. It gives you the answer as a sentence, what it means in dollars and time, and two or three things to do about it. The math is there if you want it, one click away.</p>
      <p><b>Learner mode</b> shows the method. Every substitution, every table lookup, the reasoning behind each step, the traps that cost points on exams, and practice problems that never repeat. It follows your textbook’s notation, whether that is Heizer and Render, Chopra and Meindl, Cachon and Terwiesch, or Jacobs and Chase.</p>
      <p>Both modes run on the same calculation engine, so the number you study is the number a business would use.</p>
      <h2>Why you can trust the numbers</h2>
      <p>Every calculator has to pass three independent checks before it gets a Verified badge: {n(S.examples)} textbook-style worked examples, {n(S.crossComparisons)} randomized comparisons against a second implementation written separately in Python, and {n(S.simulations)} simulation suites that test whether each formula’s real-world claim actually holds. The results are public on the <Link href="/verified">Verified page</Link>, which is generated from the test run itself.</p>
      <h2>Who is behind it</h2>
      <p>{BRAND.name} was started by a Supply Chain and Operations student at the University of Minnesota’s Carlson School of Management who wanted one honest tool that worked for class and for the job. If you find a mistake, or a calculator that should exist and does not, we want to hear about it.</p>
      <p className="flex flex-wrap gap-3 pt-2"><Link href="/start" className="btn btn-primary !text-accent-fg !no-underline">Start calculating</Link><Link href="/verified" className="btn !text-fg !no-underline">See the verification results</Link></p>
    </Page>
  );
}

export const FAQS: { q: string; a: string }[] = [
  { q: `What is ${BRAND.name}?`, a: `A set of ${N} supply chain and operations calculators covering inventory, forecasting, capacity, queuing, quality, planning, logistics, sourcing, finance, project management, and decision analysis. It routes you to the right calculator from a plain description of your problem.` },
  { q: 'Is it free?', a: 'Every calculator is free: the answer, the chart, the worked examples, and share links, with no account needed. Pro adds the full step-by-step solution, unlimited practice, and exam tools for learners, and the Plan Builder, exports, and what-if tools for businesses.' },
  { q: 'What is the difference between Business mode and Learner mode?', a: 'Business mode uses everyday labels, converts units for you, and leads with a plain-language answer and what to do next. Learner mode uses textbook notation, shows every step and table lookup, and warns you about common exam mistakes. The math underneath is identical.' },
  { q: 'How do I know the answers are right?', a: `Each calculator must pass three layers of verification: textbook worked examples, randomized comparison against an independent Python implementation (${n(S.crossComparisons)} comparisons in the latest run), and simulation where the formula makes a real-world claim. Results for every calculator are on the Verified page.` },
  { q: 'Which textbooks does Learner mode match?', a: 'You can switch notation between Heizer, Render and Munson; Chopra and Meindl; Cachon and Terwiesch; and Jacobs and Chase. Where textbooks disagree on a convention, such as the sign of forecast error, the calculator states which one it is using and lets you switch.' },
  { q: 'My answer differs from my textbook. Why?', a: 'The usual causes are rounding the z-value from a printed table, mixing time units (daily demand with a lead time in weeks), or a different convention for holding cost or forecast error. Learner mode shows which convention is in use and has a setting for table-rounded z-values.' },
  { q: 'Can I use this for homework?', a: 'Yes, as a way to check your work and understand the method. Practice mode gives you fresh problems with worked solutions. Follow your course’s rules on outside tools.' },
  { q: 'What is the Plan Builder?', a: 'Upload a CSV of sales history and it cleans the data, picks the best forecasting method for each product, measures demand variability, and sets safety stock, reorder point, and order quantity for every SKU. It exports to Excel with live formulas so you can keep working in your own spreadsheet.' },
  { q: 'Does my data leave my browser?', a: 'Calculations run in your browser. Files you upload to the Plan Builder are processed on your device and are not sent to our servers. If you use the AI reader in Paste Your Problem, the text you paste is sent to our AI provider to be read.' },
  { q: 'Can I put a calculator on my own site?', a: 'Yes. The embed builder gives you a snippet for any calculator, themed to match your site, free with a small Powered by link.' },
  { q: 'Is this professional advice?', a: 'No. Lotwise is a decision-support and learning tool. The models make simplifying assumptions that are stated on each page. For decisions with real money at stake, treat the output as one input and apply your own judgment.' },
  { q: 'I found a bug or want a calculator that is missing. What do I do?', a: 'Tell us. Searches that find nothing are also logged (without any personal information) so we can see what to build next.' },
];
export function FaqScreen() {
  return (
    <Page eyebrow="FAQ" title="Questions, answered plainly.">
      <dl className="divide-y divide-line">{FAQS.map((f) => <div key={f.q} className="py-5"><dt className="text-lg font-semibold text-fg">{f.q}</dt><dd className="mt-2">{f.a}</dd></div>)}</dl>
      <p>Still stuck? See <Link href="/pricing">pricing</Link>, the <Link href="/verified">Verified page</Link>, or the <Link href="/disclaimer">disclaimer</Link>.</p>
    </Page>
  );
}

export function TermsScreen() {
  return (
    <Page eyebrow="Legal" title="Terms of Service" lead="Last updated: [DATE]" template>
      <h2>1. Who we are</h2><p>{BRAND.name} (“we”, “us”) is operated by [LEGAL NAME OR COMPANY], based in [CITY, STATE, COUNTRY]. These terms cover your use of {BRAND.domain} and everything on it (the “Service”). By using the Service you agree to them.</p>
      <h2>2. What the Service is</h2><p>{BRAND.name} provides calculators, explanations, practice problems, and planning tools for supply chain and operations topics. It is an educational and decision-support tool. It is not professional, financial, legal, or engineering advice. See the <Link href="/disclaimer">Disclaimer</Link>.</p>
      <h2>3. Accounts</h2><p>You can use most of the Service without an account. If you create one, keep your sign-in email secure and tell us if you think someone else has access. You must be at least 13 years old, or the minimum age in your country, to create an account.</p>
      <h2>4. Paid plans</h2><ul><li><b>Business Pro</b> and <b>Learner Pro (monthly)</b> are subscriptions billed in advance each month through our payment processor, Stripe, until you cancel.</li><li><b>Learner Pro Semester Pass</b> is a single payment for 5 months of access. It does not renew.</li><li>You can cancel a subscription any time from your account. You keep access until the end of the period you paid for.</li><li>Refunds: if you ask within 7 days of your first payment for a plan, we will refund it. Otherwise payments are non-refundable except where the law requires.</li><li>We may change prices. We will tell subscribers at least 30 days before a change affects them.</li></ul>
      <h2>5. Acceptable use</h2><ul><li>Do not try to break, overload, or get around the security or payment controls of the Service.</li><li>Do not resell the Service or copy substantial parts of it into a competing product.</li><li>Do not use automated tools to scrape the Service at a volume that affects other users.</li><li>Students: follow your institution’s academic integrity rules. You are responsible for how you use what you learn here.</li></ul>
      <h2>6. Your content</h2><p>Numbers you enter and files you upload stay yours. Files you upload to the Plan Builder are processed in your browser. Where you choose to save work to your account, you give us permission to store it so we can show it back to you.</p>
      <h2>7. Our content</h2><p>The site, its design, text, and software are owned by us or our licensors. Embeds may be placed on other sites using the code we provide, with the attribution link intact.</p>
      <h2>8. No warranty</h2><p>The Service is provided “as is”. We work hard to make the calculations correct and publish how we test them, but we do not guarantee that the Service is error-free, uninterrupted, or suitable for a particular purpose.</p>
      <h2>9. Limit of liability</h2><p>To the fullest extent the law allows, we are not liable for indirect or consequential losses, lost profits, or lost data arising from your use of the Service, and our total liability is limited to the amount you paid us in the 12 months before the claim, or [AMOUNT], whichever is greater.</p>
      <h2>10. Ending or changing the Service</h2><p>You can stop using the Service at any time. We may suspend accounts that break these terms. We may change or discontinue features, and will give reasonable notice of changes that materially affect paid plans.</p>
      <h2>11. Governing law</h2><p>These terms are governed by the laws of [STATE/COUNTRY]. Disputes will be handled in the courts of [JURISDICTION].</p>
      <h2>12. Contact</h2><p>Questions about these terms: [CONTACT EMAIL].</p>
    </Page>
  );
}

export function PrivacyScreen() {
  return (
    <Page eyebrow="Legal" title="Privacy Policy" lead="Last updated: [DATE]" template>
      <h2>The short version</h2><ul><li>We collect as little as we can. You can use every calculator without an account.</li><li>We do not sell your data, and we do not use advertising trackers or third-party analytics.</li><li>Calculations run in your browser. Files you upload to the Plan Builder are not sent to our servers.</li></ul>
      <h2>What we collect</h2><ul><li><b>Account details</b>, if you create an account: your email address and, if you sign in with Google, your name.</li><li><b>Saved work</b>, if you are signed in: your settings, saved scenarios, and practice progress, so they follow you between devices.</li><li><b>Payment details</b>: handled by Stripe. We receive your plan and payment status, never your full card number.</li><li><b>Usage events</b>: which pages and calculators are used, searches that found nothing, and upgrade steps. These are stored in our own database with a random per-tab identifier. We do not store IP addresses with them or use cookies for analytics.</li><li><b>Pasted problems</b>: if the AI reader is used in Paste Your Problem, the text you paste is sent to our AI provider (Anthropic) to be read, and is not used by us for any other purpose.</li></ul>
      <h2>What is stored on your device</h2><p>Your mode, theme, notation, recent calculators, and practice streak are kept in your browser’s local storage so the site remembers them. If you sign in, a session cookie keeps you signed in.</p>
      <h2>Who we share it with</h2><p>Only the services needed to run {BRAND.name}: Supabase (database and sign-in), Stripe (payments), Vercel (hosting), and Anthropic (AI reader, only for text you submit to it). Each handles data under its own privacy terms. We may disclose information if the law requires it.</p>
      <h2>How long we keep it</h2><p>Account data is kept until you delete your account. Usage events are kept for [RETENTION PERIOD] and then deleted or aggregated.</p>
      <h2>Your choices and rights</h2><p>You can ask for a copy of your data, ask us to correct it, or ask us to delete your account and everything linked to it by writing to [CONTACT EMAIL]. Depending on where you live (for example the EU, UK, or California) you may have additional rights, including the right to complain to a regulator.</p>
      <h2>Children</h2><p>{BRAND.name} is not directed at children under 13, and we do not knowingly collect their personal information.</p>
      <h2>Changes</h2><p>If we change this policy in a way that matters, we will say so on this page and, for account holders, by email.</p>
      <h2>Contact</h2><p>[LEGAL NAME OR COMPANY], [ADDRESS]. Email: [CONTACT EMAIL].</p>
    </Page>
  );
}

export function DisclaimerScreen() {
  return (
    <Page eyebrow="Legal" title="Disclaimer" lead="What Lotwise is, and what it is not." template>
      <h2>Decision support, not advice</h2><p>{BRAND.name} provides calculations and explanations for education and planning. Nothing on the site is professional, financial, legal, accounting, or engineering advice. You are responsible for the decisions you make with it.</p>
      <h2>Models simplify reality</h2><p>Every formula here rests on assumptions, and each calculator states its own. Economic order quantity assumes steady demand. Safety stock formulas usually assume demand is roughly normal. Queuing models assume particular arrival and service patterns. When your situation departs from the assumptions, the answer is a starting point, not a guarantee.</p>
      <h2>Your inputs drive the outputs</h2><p>Results are only as good as the numbers entered. Check your units, your time periods, and your cost estimates. The Plan Builder flags data problems it can detect, but it cannot know what your data should have been.</p>
      <h2>Accuracy</h2><p>We test every calculator in three independent ways and publish the results on the <Link href="/verified">Verified page</Link>. Even so, software can contain errors. If a result looks wrong, tell us and do not rely on it until it is resolved.</p>
      <h2>Coursework</h2><p>Learner mode is meant to help you understand methods and check your work. Your instructor’s conventions take priority over ours, and your institution’s academic integrity policy governs how you may use outside tools.</p>
      <h2>No liability</h2><p>To the extent the law allows, {BRAND.name} and its operators are not liable for losses arising from use of the site or reliance on its results. See the <Link href="/terms">Terms of Service</Link>.</p>
    </Page>
  );
}
