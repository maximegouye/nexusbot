import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

const VoteSchema = z.object({
  targetType: z.enum(['question', 'answer']),
  targetId:   z.string().cuid(),
  value:      z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { targetType, targetId, value } = parsed.data;
  const userId = session.user.id;

  // Vérifie que la cible existe + récupère l'auteur pour la réputation
  const target = targetType === 'question'
    ? await prisma.question.findUnique({ where: { id: targetId }, select: { authorId: true } })
    : await prisma.answer.findUnique({   where: { id: targetId }, select: { authorId: true } });

  if (!target) return NextResponse.json({ error: 'Cible introuvable' }, { status: 404 });

  // Pas de vote sur son propre contenu
  if (target.authorId === userId) {
    return NextResponse.json({ error: 'Impossible de voter pour votre propre contenu' }, { status: 400 });
  }

  // Upsert du vote
  const existingWhere = targetType === 'question'
    ? { userId_questionId: { userId, questionId: targetId } }
    : { userId_answerId:   { userId, answerId:   targetId } };

  const existing = await (prisma.vote as any).findUnique({ where: existingWhere });

  let delta = 0;

  if (existing) {
    if (existing.value === value) {
      // Annule le vote
      await prisma.vote.delete({ where: { id: existing.id } });
      delta = -value;
    } else {
      // Change le vote
      await prisma.vote.update({ where: { id: existing.id }, data: { value } });
      delta = value - existing.value;
    }
  } else {
    // Nouveau vote
    await prisma.vote.create({
      data: {
        userId, value,
        ...(targetType === 'question' ? { questionId: targetId } : { answerId: targetId }),
      },
    });
    delta = value;
  }

  // Met à jour le score
  if (targetType === 'question') {
    await prisma.question.update({
      where: { id: targetId },
      data:  { voteScore: { increment: delta } },
    });
  } else {
    await prisma.answer.update({
      where: { id: targetId },
      data:  { voteScore: { increment: delta } },
    });
  }

  // Met à jour la réputation de l'auteur (+10/-2 par vote)
  const repDelta = delta > 0 ? 10 * delta : 2 * delta;
  await prisma.user.update({
    where: { id: target.authorId },
    data:  { reputation: { increment: repDelta } },
  });

  return NextResponse.json({ success: true, delta });
}
