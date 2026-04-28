import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, Clock, Tag, CheckCircle2, MessageSquare } from 'lucide-react';
import { prisma } from '@/lib/db';
import { VoteButton } from '@/components/VoteButton';
import { timeAgo } from '@/lib/utils';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    select: { title: true, body: true },
  });
  if (!question) return { title: 'Question introuvable' };
  return {
    title: question.title,
    description: question.body.replace(/<[^>]+>/g, '').slice(0, 160),
    openGraph: { title: question.title },
  };
}

export default async function QuestionPage({ params }: PageProps) {
  const question = await prisma.question.findUnique({
    where: { slug: params.slug },
    include: {
      author:   { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
      category: true,
      tags:     true,
      answers: {
        orderBy: [{ isAccepted: 'desc' }, { voteScore: 'desc' }],
        include: {
          author: { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
          _count: { select: { votes: true, comments: true } },
        },
      },
      _count: { select: { answers: true, votes: true, comments: true } },
    },
  });

  if (!question) notFound();

  // Incrémente les vues (fire-and-forget)
  prisma.question.update({
    where: { id: question.id },
    data: { views: { increment: 1 } },
  }).catch(() => {});

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Fil d'ariane ── */}
      <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/questions" className="hover:text-zinc-300 transition-colors">Questions</Link>
        {question.category && (
          <>
            <span>/</span>
            <Link href={`/categories/${question.category.slug}`} className="hover:text-zinc-300 transition-colors">
              {question.category.name}
            </Link>
          </>
        )}
      </nav>

      {/* ── Question ── */}
      <div className="flex gap-6 mb-8">
        {/* Vote */}
        <div className="shrink-0 hidden sm:flex">
          <VoteButton
            targetType="question"
            targetId={question.id}
            initialScore={question.voteScore}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {question.isAnswered && (
              <span className="badge-green"><CheckCircle2 className="h-3 w-3" />Résolu</span>
            )}
            {question.isClosed && (
              <span className="badge-red">Fermé</span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 mb-5 leading-tight">
            {question.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mb-6">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Posée {timeAgo(question.createdAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              {question.views.toLocaleString('fr-FR')} vues
            </span>
            <span className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              {question._count.answers} réponse{question._count.answers !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Body */}
          <div
            className="prose-dark mb-6"
            dangerouslySetInnerHTML={{ __html: question.body }}
          />

          {/* Tags */}
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {question.tags.map(tag => (
                <Link
                  key={tag.id}
                  href={`/questions?tag=${tag.slug}`}
                  className="badge bg-surface-600 text-zinc-400 hover:text-zinc-200 hover:bg-surface-500 border border-white/5 transition-colors"
                >
                  <Tag className="h-3 w-3" />
                  {tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Author */}
          <div className="flex items-center justify-end">
            <div className="card p-3 flex items-center gap-3">
              {question.author.image ? (
                <Image src={question.author.image} alt={question.author.name ?? ''} width={36} height={36} className="rounded-full" />
              ) : (
                <div className="h-9 w-9 rounded-full bg-brand-700 flex items-center justify-center text-sm font-bold text-white">
                  {question.author.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <Link
                  href={`/profil/${question.author.username ?? question.author.id}`}
                  className="text-sm font-semibold text-zinc-200 hover:text-brand-400 transition-colors"
                >
                  {question.author.name}
                </Link>
                <p className="text-xs text-zinc-500">{question.author.reputation} pts de réputation</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* ── Réponses ── */}
      <section>
        <h2 className="text-lg font-bold text-zinc-100 mb-6">
          {question.answers.length} réponse{question.answers.length !== 1 ? 's' : ''}
        </h2>

        {question.answers.length === 0 ? (
          <div className="card p-10 text-center mb-8">
            <MessageSquare className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400">Aucune réponse pour l'instant. Soyez le premier à aider !</p>
          </div>
        ) : (
          <div className="space-y-6 mb-8">
            {question.answers.map(answer => (
              <div key={answer.id} className={`flex gap-6 ${answer.isAccepted ? 'relative' : ''}`}>
                {answer.isAccepted && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-3/4 rounded-full bg-emerald-500" />
                )}
                <div className="shrink-0 hidden sm:flex">
                  <VoteButton
                    targetType="answer"
                    targetId={answer.id}
                    initialScore={answer.voteScore}
                  />
                </div>
                <div className={`flex-1 card p-5 ${answer.isAccepted ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
                  {answer.isAccepted && (
                    <div className="flex items-center gap-2 mb-3 text-emerald-400 text-sm font-semibold">
                      <CheckCircle2 className="h-4 w-4" />
                      Meilleure réponse
                    </div>
                  )}
                  <div
                    className="prose-dark mb-4"
                    dangerouslySetInnerHTML={{ __html: answer.body }}
                  />
                  <div className="flex items-center justify-end">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>Répondu par</span>
                      {answer.author.image && (
                        <Image src={answer.author.image} alt={answer.author.name ?? ''} width={18} height={18} className="rounded-full" />
                      )}
                      <Link
                        href={`/profil/${answer.author.username ?? answer.author.id}`}
                        className="font-medium text-zinc-300 hover:text-brand-400 transition-colors"
                      >
                        {answer.author.name}
                      </Link>
                      <span className="text-zinc-600">·</span>
                      <span>{timeAgo(answer.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Formulaire réponse ── */}
        <AnswerForm questionId={question.id} />
      </section>
    </div>
  );
}

// Formulaire client séparé
function AnswerForm({ questionId }: { questionId: string }) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-zinc-100 mb-4">Votre réponse</h3>
      <form action="/api/answers" method="POST">
        <input type="hidden" name="questionId" value={questionId} />
        <textarea
          name="body"
          rows={6}
          placeholder="Rédigez une réponse claire et détaillée…"
          className="input resize-none mb-4"
          required
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            Utilisez Markdown pour la mise en forme. Soyez précis et bienveillant.
          </p>
          <button type="submit" className="btn-primary">
            Publier ma réponse
          </button>
        </div>
      </form>
    </div>
  );
}
