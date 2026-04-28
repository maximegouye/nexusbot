import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { slugify } from '@/lib/utils';

const CreateSchema = z.object({
  title:      z.string().min(10).max(300),
  body:       z.string().min(20),
  categoryId: z.string().cuid().optional(),
  tags:       z.array(z.string().min(1).max(30)).max(5).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sort     = searchParams.get('sort') ?? 'newest';
  const category = searchParams.get('category');
  const tag      = searchParams.get('tag');
  const q        = searchParams.get('q');
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const perPage  = 20;

  const where: any = {};
  if (category) where.category = { slug: category };
  if (tag)      where.tags      = { some: { slug: tag } };
  if (q)        where.OR        = [
    { title: { contains: q, mode: 'insensitive' } },
    { body:  { contains: q, mode: 'insensitive' } },
  ];
  if (sort === 'unanswered') where.isAnswered = false;

  const orderBy: any =
    sort === 'popular'  ? { voteScore: 'desc' } :
    sort === 'trending' ? { views:     'desc' } :
    { createdAt: 'desc' };

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where, orderBy,
      take: perPage, skip: (page - 1) * perPage,
      include: {
        author:   { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
        category: true,
        tags:     true,
        _count:   { select: { answers: true, votes: true, comments: true } },
      },
    }),
    prisma.question.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, perPage, hasMore: page * perPage < total });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, body: qBody, categoryId, tags = [] } = parsed.data;
  let slug = slugify(title);

  // S'assurer de l'unicité du slug
  const existing = await prisma.question.count({ where: { slug } });
  if (existing > 0) slug = `${slug}-${Date.now()}`;

  // Crée ou trouve les tags
  const tagRecords = await Promise.all(
    tags.map(async name => {
      const tagSlug = slugify(name);
      return prisma.tag.upsert({
        where:  { slug: tagSlug },
        update: { count: { increment: 1 } },
        create: { name, slug: tagSlug, count: 1 },
      });
    })
  );

  const question = await prisma.question.create({
    data: {
      title,
      slug,
      body: qBody,
      authorId: session.user.id,
      categoryId: categoryId ?? undefined,
      tags: { connect: tagRecords.map(t => ({ id: t.id })) },
    },
    include: {
      author:   { select: { id: true, name: true, username: true } },
      category: true,
      tags:     true,
    },
  });

  return NextResponse.json({ data: question }, { status: 201 });
}
