import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, ThumbsUp, Eye, CheckCircle2, Clock } from 'lucide-react';
import type { QuestionWithRelations } from '@/types';
import { timeAgo, truncate } from '@/lib/utils';

interface QuestionCardProps {
  question: QuestionWithRelations;
  showCategory?: boolean;
}

export function QuestionCard({ question, showCategory = true }: QuestionCardProps) {
  return (
    <article className="card-hover p-5 group">
      <div className="flex gap-4">
        {/* Vote + answer counts */}
        <div className="hidden sm:flex flex-col items-center gap-3 shrink-0 text-center min-w-[56px]">
          <div className="flex flex-col items-center">
            <span className={`text-lg font-bold ${question.voteScore > 0 ? 'text-emerald-400' : question.voteScore < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
              {question.voteScore}
            </span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">votes</span>
          </div>
          <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${question.isAnswered ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-500'}`}>
            <span className="text-base font-bold">{question._count.answers}</span>
            <span className="text-[10px] uppercase tracking-wide">
              {question.isAnswered ? '✓ rép.' : 'rép.'}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-2">
            {question.isAnswered && (
              <span className="badge-green shrink-0"><CheckCircle2 className="h-3 w-3" />Résolu</span>
            )}
            {showCategory && question.category && (
              <Link href={`/categories/${question.category.slug}`} className="badge-brand hover:bg-brand-600/30 transition-colors">
                {question.category.name}
              </Link>
            )}
          </div>

          <Link href={`/questions/${question.slug}`} className="block group-hover:text-brand-300 transition-colors">
            <h3 className="font-semibold text-zinc-100 text-base leading-snug mb-2 line-clamp-2">
              {question.title}
            </h3>
          </Link>

          <p className="text-sm text-zinc-500 line-clamp-2 mb-3">
            {truncate(question.body.replace(/<[^>]+>/g, ''), 140)}
          </p>

          {/* Tags */}
          {question.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {question.tags.slice(0, 4).map(tag => (
                <Link
                  key={tag.id}
                  href={`/questions?tag=${tag.slug}`}
                  className="badge bg-surface-600 text-zinc-400 hover:text-zinc-200 hover:bg-surface-500 transition-colors border border-white/5"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {question.author.image ? (
                <Image
                  src={question.author.image}
                  alt={question.author.name ?? ''}
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-white">
                  {question.author.name?.[0]?.toUpperCase()}
                </div>
              )}
              <Link
                href={`/profil/${question.author.username ?? question.author.id}`}
                className="text-xs text-zinc-400 hover:text-brand-400 transition-colors font-medium"
              >
                {question.author.name ?? 'Anonyme'}
              </Link>
              <span className="text-xs text-zinc-600">{question.author.reputation} pts</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {question.views.toLocaleString('fr-FR')}
              </span>
              <span className="flex items-center gap-1 sm:hidden">
                <MessageSquare className="h-3 w-3" />
                {question._count.answers}
              </span>
              <span className="flex items-center gap-1 sm:hidden">
                <ThumbsUp className="h-3 w-3" />
                {question.voteScore}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(question.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
