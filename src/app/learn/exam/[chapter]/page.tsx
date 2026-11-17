import { notFound } from 'next/navigation';
import { CATEGORIES, catById } from '@lotwise/engine';
import { ExamScreen } from '@/screens/PracticeScreens';
export const dynamicParams = false;
export function generateStaticParams() { return CATEGORIES.map((c) => ({ chapter: c.id })); }
export async function generateMetadata({ params }: { params: Promise<{ chapter: string }> }) { const { chapter } = await params; const c = catById[chapter]; return c ? { title: `${c.name} exam review`, description: `Mixed exam-style practice across ${c.name}: accuracy tracking and missed topics that come back.`, alternates: { canonical: `/learn/exam/${chapter}` } } : {}; }
export default async function Page({ params }: { params: Promise<{ chapter: string }> }) { const { chapter } = await params; if (!catById[chapter]) notFound(); return <ExamScreen chapter={chapter} />; }
