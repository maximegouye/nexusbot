import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Crown, Star, MessageSquare, Calendar, Award, TrendingUp } from 'lucide-react';
import { prisma } from '@/lib/db';
import { QuestionCard } from '@/components/QuestionCard';
import { timeAgo, levelLabel } from '@/lib/utils';

interface PageProps {
  params: { username: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: params.username }, { id: params.username }] },
    select: { name: true, bio: true },
  });
  if (!user) return { title: 'Profil introuvable' };
  return {
    title: `Profil de ${user.name}`,
    description: user.bio ?? `Voir le profil de ${user.name} sur Zone Entraide.`,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: params.username }, { id: params.username }] },
    include: {
      badges: { include: { badge: true } },
      _count: { select: { questions: true, answers: true } },
    },
  });

  if (!user) notFound();

  const [questions, topAnswers] = await Promise.all([
    prisma.question.findMany({
      where: { authorId: user.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
        category: true,
        tags: true,
        _count: { select: { answers: true, votes: true, comments: true } },
      },
    }),
    prisma.answer.findMany({
      where: { authorId: user.id, isAccepted: true },
      take: 3,
      orderBy: { voteScore: 'desc' },
      include: {
        question: { select: { title: true, slug: true } },
      },
    }),
  ]);

  const levelNum = user.level;
  const levelTitle = levelLabel(levelNum);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Sidebar profil ── */}
        <aside className="lg:w-72 shrink-0 space-y-5">
          {/* Avatar + infos */}
          <div className="card p-6 text-center">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? ''}
                width={80}
                height={80}
                className="rounded-full mx-auto mb-4 ring-2 ring-brand-600/30"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-brand-700 flex items-center justify-center text-2xl font-black text-white mx-auto mb-4">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}

            <h1 className="font-bold text-xl text-zinc-100">{user.name}</h1>
            {user.username && (
              <p className="text-sm text-zinc-500 mt-0.5">@{user.username}</p>
            )}

            {user.isPremium && (
              <span className="badge-gold mt-2 mx-auto w-fit">
                <Crown className="h-3 w-3" />Premium
              </span>
            )}

            {user.bio && (
              <p className="text-sm text-zinc-400 mt-4 leading-relaxed">{user.bio}</p>
            )}
          </div>

          {/* Stats */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Statistiques</h3>
            <div className="space-y-3">
              {[
                { label: 'Réputation',  value: user.reputation.toLocaleString('fr-FR'), icon: Star,         color: 'text-gold-400'    },
                { label: 'Niveau',      value: `${levelNum} — ${levelTitle}`,            icon: TrendingUp,  color: 'text-brand-400'   },
                { label: 'Questions',   value: user._count.questions.toLocaleString('fr-FR'), icon: MessageSquare, color: 'text-blue-400' },
                { label: 'Réponses',    value: user._count.answers.toLocaleString('fr-FR'),   icon: Award,         color: 'text-emerald-400' },
                { label: 'Membre depuis', value: timeAgo(user.createdAt),                icon: Calendar,    color: 'text-zinc-500'    },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-zinc-500">
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-zinc-200">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Badges */}
          {user.badges.length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Badges</h3>
              <div className="flex flex-wrap gap-2">
                {user.badges.map(({ badge }) => (
                  <div
                    key={badge.id}
                    title={badge.description}
                    className="flex items-center gap-1.5 badge bg-surface-600 border border-white/5 text-zinc-300"
                    style={{ borderColor: `${badge.color}30` }}
                  >
                    <span>{badge.icon}</span>
                    <span className="text-xs">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meilleures réponses */}
          {topAnswers.length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                Meilleures réponses acceptées
              </h3>
              <div className="space-y-3">
                {topAnswers.map(a => (
                  <Link
                    key={a.id}
                    href={`/questions/${a.question.slug}`}
                    className="block text-sm text-zinc-400 hover:text-brand-400 transition-colors line-clamp-2"
                  >
                    ✓ {a.question.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Questions ── */}
        <main className="flex-1 min-w-0">
          <h2 className="font-bold text-lg text-zinc-100 mb-5">
            Questions récentes ({user._count.questions})
          </h2>
          {questions.length === 0 ? (
            <div className="card p-10 text-center text-zinc-500">
              Aucune question pour l'instant.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <QuestionCard key={q.id} question={q} />
              ))}
              {user._count.questions > 5 && (
                <Link
                  href={`/questions?author=${user.id}`}
                  className="btn-outline w-full justify-center text-sm mt-4"
                >
                  Voir toutes les questions
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
