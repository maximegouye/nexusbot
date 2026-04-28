'use client';

import { useState, useTransition } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface VoteButtonProps {
  targetType: 'question' | 'answer';
  targetId: string;
  initialScore: number;
  initialUserVote?: number | null; // +1, -1 ou null
}

export function VoteButton({ targetType, targetId, initialScore, initialUserVote = null }: VoteButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState(initialUserVote);

  async function handleVote(value: 1 | -1) {
    if (!session) {
      router.push('/connexion');
      return;
    }

    const newVote = userVote === value ? 0 : value;
    const scoreDelta = newVote - (userVote ?? 0);

    setScore(s => s + scoreDelta);
    setUserVote(newVote || null);

    startTransition(async () => {
      try {
        await fetch('/api/votes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetType, targetId, value }),
        });
        router.refresh();
      } catch {
        // Rollback
        setScore(initialScore);
        setUserVote(initialUserVote);
      }
    });
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => handleVote(1)}
        disabled={isPending}
        className={cn(
          'p-2 rounded-lg transition-all',
          userVote === 1
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10'
        )}
        aria-label="Vote positif"
      >
        <ThumbsUp className="h-5 w-5" />
      </button>

      <span className={cn(
        'text-base font-bold tabular-nums min-w-[2ch] text-center',
        score > 0 ? 'text-emerald-400' : score < 0 ? 'text-red-400' : 'text-zinc-500'
      )}>
        {score}
      </span>

      <button
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className={cn(
          'p-2 rounded-lg transition-all',
          userVote === -1
            ? 'bg-red-500/20 text-red-400'
            : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
        )}
        aria-label="Vote négatif"
      >
        <ThumbsDown className="h-5 w-5" />
      </button>
    </div>
  );
}
