import type { Metadata } from 'next';
import { BookOpen, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Articles, guides et actualités de la communauté Zone Entraide.',
};

const ARTICLES = [
  {
    slug: 'comment-poser-une-bonne-question',
    title: 'Comment poser une bonne question technique',
    excerpt: 'Les astuces pour formuler vos questions de manière claire et obtenir des réponses utiles rapidement.',
    date: '15 avril 2026',
    readTime: '4 min',
    category: 'Guide',
    color: '#7c3aed',
  },
  {
    slug: 'guide-demarrer-freelance-france',
    title: 'Guide complet pour démarrer en freelance en France',
    excerpt: 'Statut, facturation, TVA, tarification : tout ce que vous devez savoir pour vous lancer sereinement.',
    date: '8 avril 2026',
    readTime: '8 min',
    category: 'Carrière',
    color: '#10b981',
  },
  {
    slug: 'apprendre-programmer-2026',
    title: 'Les meilleures ressources pour apprendre à programmer en 2026',
    excerpt: 'Sélection des meilleurs cours, tutoriels et projets pratiques pour progresser efficacement.',
    date: '1 avril 2026',
    readTime: '6 min',
    category: 'Tech',
    color: '#3b82f6',
  },
];

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100">Blog</h1>
        <p className="mt-2 text-zinc-400">Guides, conseils et actualités de la communauté.</p>
      </div>

      <div className="space-y-6">
        {ARTICLES.map(article => (
          <article
            key={article.slug}
            className="group rounded-xl border border-white/10 bg-surface-800 p-6 hover:border-white/20 transition-all"
          >
            <div className="flex items-start gap-5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${article.color}20` }}
              >
                <BookOpen className="h-5 w-5" style={{ color: article.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${article.color}20`, color: article.color }}
                  >
                    {article.category}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" /> {article.readTime}
                  </span>
                  <span className="text-xs text-zinc-600">{article.date}</span>
                </div>
                <h2 className="text-lg font-semibold text-zinc-100 group-hover:text-white mb-2">
                  {article.title}
                </h2>
                <p className="text-sm text-zinc-400 line-clamp-2">{article.excerpt}</p>
                <div className="mt-4 flex items-center gap-1 text-sm text-brand-400 group-hover:text-brand-300 transition-colors">
                  Lire l'article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
