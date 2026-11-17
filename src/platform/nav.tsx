'use client';
// Navigation adapter (Next.js implementation). UI code imports Link / useNav / usePath from here only,
// so the same screens run inside the standalone demo bundle, which swaps this file for nav.hash.tsx.
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children?: ReactNode; prefetch?: boolean };
export function Link({ href, children, prefetch, ...rest }: LinkProps) {
  if (/^(https?:|mailto:|#)/.test(href)) return <a href={href} {...rest}>{children}</a>;
  return <NextLink href={href} prefetch={prefetch} {...rest}>{children}</NextLink>;
}
export function useNav() {
  const r = useRouter();
  return { push: (href: string) => r.push(href), replace: (href: string) => r.replace(href), back: () => r.back() };
}
export function usePath(): string { return usePathname() || '/'; }
/** Query string read on the client only (keeps calculator pages statically rendered). */
export function useQuery(): URLSearchParams | null {
  const [q, setQ] = useState<URLSearchParams | null>(null);
  const path = usePathname();
  useEffect(() => { setQ(new URLSearchParams(window.location.search)); }, [path]);
  return q;
}
export function absoluteUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return window.location.origin + path;
}
