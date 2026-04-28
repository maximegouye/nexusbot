import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

const CreateSchema = z.object({
  body:       z.string().min(20).max(50000),
  questionId: z.string().cuid(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Supporte aussi les form submissions classiques
  let data: any;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await req.json();
  } else {
    const form = await req.formData();
    data = { body: form.get('body'), questionId: form.get('questionId') };
  }

  const parsed = CreateSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { body, questionId } = parsed.data;

  // Vérifie que la question existe
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { id: true, isClosed: true },
  });
  if (!question) return NextResponse.json({ error: 'Question introuvable' }, { status: 404 });
  if (question.isClosed) return NextResponse.json({ error: 'Question fermée' }, { status: 400 });

  const answer = await prisma.answer.create({
    data: {
      body,
      authorId:   session.user.id,
      questionId,
    },
    include: {
      author: { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
    },
  });

  // Notifie l'auteur de la question
  await prisma.notification.create({
    data: {
      userId:  (await prisma.question.findUnique({ where: { id: questionId }, select: { authorId: true } }))!.authorId,
      type:    'NEW_ANSWER',
      title:   'Nouvelle réponse',
      body:    `${session.user.name} a répondu à votre question.`,
      link:    `/questions/${(await prisma.question.findUnique({ where: { id: questionId }, select: { slug: true } }))?.slug}`,
    },
  }).catch(() => {});

  // Redirige si form submission, sinon JSON
  if (!contentType.includes('application/json')) {
    const q = await prisma.question.findUnique({ where: { id: questionId }, select: { slug: true } });
    return NextResponse.redirect(new URL(`/questions/${q?.slug}`, req.url));
  }

  return NextResponse.json({ data: answer }, { status: 201 });
}
