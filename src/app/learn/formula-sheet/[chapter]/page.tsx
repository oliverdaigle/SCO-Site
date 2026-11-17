import { notFound } from 'next/navigation';
import { CATEGORIES, catById } from '@lotwise/engine';
import { FormulaSheetScreen } from '@/screens/PracticeScreens';
export const dynamicParams = false;
export function generateStaticParams() { return CATEGORIES.map((c) => ({ chapter: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }) { const { chapter } = await params; const c = catById[chapter]; return c ? { title: `${c.name} formula sheet (printable PDF)`, description: `One-page formula sheet for ${c.name} in Heizer, Chopra, Cachon, or Jacobs notation.`, alternates: { canonical: `/learn/formula-sheet/${chapter}` } } : {}; }
export default async function Page({ params }: { params: Promise<{ chapter: string }> }) { const { chapter } = await params; if (!catById[chapter]) notFound(); return <FormulaSheetScreen chapter={chapter} />; }
