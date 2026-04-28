import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { MessageSquare, TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Catégories',
  description: 'Parcourez toutes les catégories de questions sur Zone Entraide.',
};

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100">Catégories</h1>
        <p className="mt-2 text-zinc-400">
          Explorez les sujets qui vous intéressent et trouvez des réponses adaptées.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((cat: any) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.slug}`}
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-surface-800 p-6 transition-all hover:border-white/20 hover:bg-surface-700"
          >
            {/* Color accent bar */}
            <div
              className="absolute inset-x-0 top-0 h-1 rounded-t-xl transition-all group-hover:h-1.5"
              style={{ backgroundColor: cat.color }}
            />

            <div className="flex items-start gap-4 pt-2">
              <span className="text-3xl">{cat.icon}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-zinc-100 group-hover:text-white truncate">
                  {cat.name}
                </h2>
                {cat.description && (
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{cat.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {cat._count?.questions ?? 0} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Actif
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          Aucune catégorie disponible pour l'instant.
        </div>
      )}
    </main>
  );
}
