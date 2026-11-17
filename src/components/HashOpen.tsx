'use client';
import { useEffect } from 'react';
/** Opens the <details> element named by the URL hash (used by the Verified badge links) and scrolls to it. */
export function HashOpen({ id }: { id?: string | null }) {
  useEffect(() => {
    const open = () => { const h = id ?? decodeURIComponent(location.hash.slice(1)); if (!h) return; const el = document.getElementById(h); if (!el) return; if (el instanceof HTMLDetailsElement) el.open = true; el.scrollIntoView({ block: 'start' }); };
    open(); if (id) return; window.addEventListener('hashchange', open); return () => window.removeEventListener('hashchange', open);
  }, [id]);
  return null;
}
