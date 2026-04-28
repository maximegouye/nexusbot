import { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zone-entraide.fr';

  const [questions, categories] = await Promise.all([
    prisma.question.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10000,
    }),
    prisma.category.findMany({ select: { slug: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl,                 lastModified: new Date(), changeFrequency: 'daily',   priority: 1   },
    { url: `${baseUrl}/questions`,  lastModified: new Date(), changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${baseUrl}/categories`, lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/marketplace`,lastModified: new Date(), changeFrequency: 'daily',   priority: 0.8 },
    { url: `${baseUrl}/premium`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  const questionRoutes: MetadataRoute.Sitemap = questions.map(q => ({
    url:             `${baseUrl}/questions/${q.slug}`,
    lastModified:    q.updatedAt,
    changeFrequency: 'weekly',
    priority:        0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map(c => ({
    url:             `${baseUrl}/categories/${c.slug}`,
    lastModified:    new Date(),
    changeFrequency: 'daily',
    priority:        0.6,
  }));

  return [...staticRoutes, ...questionRoutes, ...categoryRoutes];
}
