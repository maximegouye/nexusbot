import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Filter, TrendingUp, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { prisma } from '@/lib/db';
import { QuestionCard } from '@/components/QuestionCard';
import type { QuestionSort } from '@/types';

interface PageProps {
  searchParams: {
    q?: string;
    sort?: QuestionSort;
    category?: string;
    tag?: string;
    page?: string;
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const q = searchParams.q;
  return {
    title: q ? `"${q}" — Questions` : 'Questions',
    description: q
      ? `Résultats pour "${q}" sur Zone Entraide`
      : 'Toutes les questions de la communauté Zone Entraide. Votes, réponses, catégories.',
    openGraph: {
      title: q ? `"${q}" — Questions` : 'Questions — Zone Entraide',
    },
  };
}

const PER_PAGE = 20;

const SORT_OPTIONS: { value: QuestionSort; label: string; icon: React.ElementType }[] = [
  { value: 'newest',     label: 'Récentes',   icon: Clock         },
  { value: 'popular',   label: 'Populaires', icon: TrendingUp    },
  { value: 'trending',  label: 'Trending',   icon: Zap           },
  { value: 'unanswered',label: 'Sans réponse',icon: Filter       },
];

export default async function QuestionsPage({ searchParams }: PageProps) {
  const sort      = (searchParams.sort as QuestionSort) ?? 'newest';
  const category  = searchParams.category;
  const tag       = searchParams.tag;
  const q         = searchParams.q;
  const page      = Math.max(1, parseInt(searchParams.page ?? '1'));
  const skip      = (page - 1) * PER_PAGE;

  const where: any = {};
  if (category)  where.category  = { slug: category };
  if (tag)       where.tags       = { some: { slug: tag } };
  if (q)         where.OR         = [
    { title: { contains: q, mode: 'insensitive' } },
    { body:  { contains: q, mode: 'insensitive' } },
  ];
  if (sort === 'unanswered') where.isAnswered = false;

  const orderBy: any =
    sort === 'newest'    ? { createdAt: 'desc' } :
    sort === 'popular'   ? { voteScore:  'desc' } :
    sort === 'trending'  ? { views:      'desc' } :
    { createdAt: 'desc' };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where, orderBy, take: PER_PAGE, skip,
      include: {
        author:   { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
        category: true,
        tags:     true,
        _count:   { select: { answers: true, votes: true, comments: true } },
      },
    }),
    prisma.question.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);
  const catData    = category ? await prisma.category.findUnique({ where: { slug: category } }) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Sidebar ── */}
        <aside className="lg:w-64 shrink-0 space-y-6">
          {/* Ask button */}
          <Link href="/questions/poser" className="btn-primary w-full justify-center text-sm">
            <Plus className="h-4 w-4" />
            Poser une question
          </Link>

          {/* Tri */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Trier par</h3>
            <div className="space-y-1">
              {SORT_OPTIONS.map(({ value, label, icon: Icon }) => {
                const params = new URLSearchParams(searchParams as any);
                params.set('sort', value);
                params.delete('page');
                return (
                  <Link
                    key={value}
                    href={`/questions?${params}`}
                    className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm transition-colors ${
                      sort === value
                        ? 'bg-brand-600/20 text-brand-300'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Catégories */}
          <CategoriesSidebar activeSlug={category} />
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-zinc-100">
                {q ? `Résultats pour "${q}"` : catData ? catData.name : 'Questions'}
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {total.toLocaleString('fr-FR')} question{total !== 1 ? 's' : ''}
              </p>
            </div>
            {tag && (
              <span className="badge-brand">#{tag}</span>
            )}
          </div>

          {/* Liste */}
          {questions.length === 0 ? (
            <div className="card p-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">Aucune question trouvée</p>
              <p className="text-sm text-zinc-600 mt-1">Soyez le premier à poser cette question !</p>
              <Link href="/questions/poser" className="btn-primary mt-4 inline-flex">
                Poser une question
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link
                  href={`/questions?${Object.entries({ ...searchParams, page: page - 1 }).map(([k, v]) => `${k}=${v}`).join('&')}`}
                  className="btn-outline text-sm px-4 py-2"
                >
                  ← Précédent
                </Link>
              )}
              <span className="text-sm text-zinc-500">Page {page} sur {totalPages}</span>
              {page < totalPages && (
                <Link
                  href={`/questions?${Object.entries({ ...searchParams, page: page + 1 }).map(([k, v]) => `${k}=${v}`).join('&')}`}
                  className="btn-outline text-sm px-4 py-2"
                >
                  Suivant →
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Composant sidebar catégories ──────────────────────────

async function CategoriesSidebar({ activeSlug }: { activeSlug?: string }) {
  const cats = await prisma.category.findMany({
    take: 12, orderBy: { order: 'asc' },
    include: { _count: { select: { questions: true } } },
  });
  if (cats.length === 0) return null;
  return (
    <div className="card p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Catégories</h3>
      <div className="space-y-1">
        {cats.map(cat => (
          <Link
            key={cat.id}
            href={`/questions?category=${cat.slug}`}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
              activeSlug === cat.slug
                ? 'bg-brand-600/20 text-brand-300'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>{cat.icon ?? '📁'}</span>
              {cat.name}
            </span>
            <span className="text-xs text-zinc-600">{(cat as any)._count.questions}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
