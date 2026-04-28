import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { QuestionCard } from '@/components/QuestionCard';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await prisma.category.findUnique({ where: { slug: params.slug } });
  if (!category) return { title: 'Catégorie introuvable' };
  return {
    title: `${category.name} — Questions`,
    description: `Parcourez les questions de la catégorie ${category.name} sur Zone Entraide.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const [category, questions] = await Promise.all([
    prisma.category.findUnique({ where: { slug: params.slug } }),
    prisma.question.findMany({
      where: { category: { slug: params.slug } },
      orderBy: { voteScore: 'desc' },
      take: 20,
      include: {
        author: true,
        category: true,
        tags: true,
        _count: { select: { answers: true, votes: true, comments: true } },
      },
    }),
  ]);

  if (!category) notFound();

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Back */}
      <Link
        href="/categories"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Toutes les catégories
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl"
          style={{ backgroundColor: `${(category as any).color}20`, border: `1px solid ${(category as any).color}40` }}
        >
          {(category as any).icon}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{category.name}</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {(category as any)._count?.questions ?? questions.length} questions
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-3">
        {questions.length > 0 ? (
          questions.map((q: any) => (
            <QuestionCard key={q.id} question={q} />
          ))
        ) : (
          <div className="text-center py-16 text-zinc-500">
            Aucune question dans cette catégorie pour l'instant.
            <div className="mt-4">
              <Link href="/questions" className="btn-primary text-sm">
                Poser la première question
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
