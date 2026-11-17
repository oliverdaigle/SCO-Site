import type { SVGProps } from 'react';

// Lotwise icon set: 24px grid, 1.6px round strokes, no fills. One visual language everywhere.
const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6', arrowLeft: 'M19 12H5M11 6l-6 6 6 6', chevronDown: 'M6 9l6 6 6-6', chevronRight: 'M9 6l6 6-6 6', chevronLeft: 'M15 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10', share: 'M12 15V3M8 7l4-4 4 4M5 12v7h14v-7', download: 'M12 3v12M8 11l4 4 4-4M5 19h14', upload: 'M12 15V3M8 7l4-4 4 4M5 19h14',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z', unlock: 'M7 11V8a5 5 0 0 1 9.6-2M6 11h12v9H6z',
  sparkles: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z',
  play: 'M7 5l12 7-12 7V5Z', pause: 'M8 5v14M16 5v14', refresh: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v6M12 7.5v.5', alert: 'M12 4l9 16H3L12 4ZM12 10v4M12 17v.5',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', external: 'M14 5h5v5M19 5l-8 8M17 14v5H5V7h5', menu: 'M4 7h16M4 12h16M4 17h16',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.6 1 2.5 2 3 0-3 0-5.5 1-8.5Z',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4V4ZM5 16a4 4 0 0 1 4-4h9', briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', shield: 'M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3ZM8.5 12l2.5 2.5 4.5-5',
  zap: 'M13 3L5 13h6l-1 8 8-10h-6l1-8Z', box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3ZM4 7.5l8 4.5 8-4.5M12 12v9',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3', flow: 'M3 7h5v5H3zM16 12h5v5h-5zM8 9.5h4a2 2 0 0 1 2 2v3h2',
  queue: 'M5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 14h18M3 19h12',
  quality: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 11.5v1',
  forecast: 'M3 17l5-5 4 3 8-9M15 6h5v5', gauge: 'M4 16a8 8 0 1 1 16 0M12 16l4-6M4 20h16',
  handshake: 'M3 9l4-3 5 3 5-3 4 3-4 6-2-1-3 4-3-2-3-1-3-6Z', tree: 'M4 5h4v4H4zM4 15h4v4H4zM16 10h4v4h-4zM8 7h4v10H8M12 12h4',
  network: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6.5 6.5l4.5 11M17.5 6.5 13 17.5M7 5h10',
  file: 'M7 3h7l4 4v14H7zM14 3v4h4', printer: 'M7 8V4h10v4M5 8h14v8H5zM8 13h8v7H8z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5 6.8 15M17.2 9l2.6-1.5', logout: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
  star: 'M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8L12 3Z', trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  wand: 'M5 19L16 8M14 6l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM6 5l.5 1.5L8 7l-1.5.5L6 9l-.5-1.5L4 7l1.5-.5L6 5Z', code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14', clipboard: 'M8 5h8v3H8zM6 6H5v15h14V6h-1M8 13h8M8 17h5', target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  layers: 'M12 3l9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  cart: 'M3 4h3l2.5 11h9.5l2-8H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M9 20v-6h6v6', factory: 'M3 20V10l6 3V10l6 3V6h6v14H3ZM7 17h2M12 17h2M17 17h2',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8.5 14a4 4 0 0 0 7 0M9 9.5v.5M15 9.5v.5', keyboard: 'M3 6h18v12H3zM7 10h.5M11 10h.5M15 10h.5M7 14h10',
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 18, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
/** The Lotwise mark: the inventory sawtooth. Works from 16px favicon to hero size. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><linearGradient id="lw-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8E9BFF" /><stop offset="1" stopColor="#FFA35C" /></linearGradient></defs>
      <rect width="32" height="32" rx="8" fill="url(#lw-g)" />
      <path d="M6.5 22.5V10l9 12.5V10l9 12.5" fill="none" stroke="#0A0C14" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Wordmark({ size = 28 }: { size?: number }) {
  return (<span className="inline-flex items-center gap-2"><LogoMark size={size} /><span className="display font-bold" style={{ fontSize: size * 0.72, letterSpacing: '-0.035em' }}>Lotwise</span></span>);
}
