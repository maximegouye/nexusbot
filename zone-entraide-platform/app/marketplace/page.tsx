import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, ShoppingBag, Star } from 'lucide-react';
import { prisma } from '@/lib/db';
import { ServiceCard } from '@/components/ServiceCard';
import type { ServiceSort } from '@/types';

interface PageProps {
  searchParams: { sort?: ServiceSort; category?: string; q?: string; page?: string };
}

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Achetez et vendez des services entre membres. Paiement sécurisé, avis vérifiés, commission transparente.',
};

const PER_PAGE = 12;

export default async function MarketplacePage({ searchParams }: PageProps) {
  const sort     = searchParams.sort ?? 'popular';
  const category = searchParams.category;
  const q        = searchParams.q;
  const page     = Math.max(1, parseInt(searchParams.page ?? '1'));
  const skip     = (page - 1) * PER_PAGE;

  const where: any = { isActive: true };
  if (category) where.category = { slug: category };
  if (q) where.OR = [
    { title: { contains: q, mode: 'insensitive' } },
    { description: { contains: q, mode: 'insensitive' } },
  ];

  const orderBy: any =
    sort === 'popular'   ? { salesCount: 'desc' }  :
    sort === 'newest'    ? { createdAt:  'desc' }  :
    sort === 'price_asc' ? { price:      'asc'  }  :
    sort === 'price_desc'? { price:      'desc' }  :
    sort === 'rating'    ? { rating:     'desc' }  :
    { salesCount: 'desc' };

  const [services, total, categories] = await Promise.all([
    prisma.service.findMany({
      where, orderBy, take: PER_PAGE, skip,
      include: {
        seller:   { select: { id: true, name: true, image: true, username: true, reputation: true, level: true, isPremium: true } },
        category: true,
      },
    }),
    prisma.service.count({ where }),
    prisma.category.findMany({ orderBy: { order: 'asc' } }),
  ]);

  const totalPages = Math.ceil(total / PER_PAGE);

  const SORT_OPTIONS = [
    { value: 'popular',    label: 'Plus populaires' },
    { value: 'newest',     label: 'Récents'         },
    { value: 'rating',     label: 'Mieux notés'    },
    { value: 'price_asc',  label: 'Prix ↑'          },
    { value: 'price_desc', label: 'Prix ↓'          },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100">Marketplace</h1>
          <p className="text-zinc-500 mt-1">
            {total.toLocaleString('fr-FR')} service{total !== 1 ? 's' : ''} disponible{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/marketplace/proposer" className="btn-primary text-sm">
          <Plus className="h-4 w-4" />
          Proposer un service
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* Sidebar */}
        <aside className="lg:w-56 shrink-0 space-y-5">
          {/* Tri */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Trier par</h3>
            <div className="space-y-1">
              {SORT_OPTIONS.map(({ value, label }) => {
                const params = new URLSearchParams(searchParams as any);
                params.set('sort', value);
                return (
                  <Link
                    key={value}
                    href={`/marketplace?${params}`}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      sort === value ? 'bg-brand-600/20 text-brand-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Catégories */}
          {categories.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Catégories</h3>
              <div className="space-y-1">
                <Link
                  href="/marketplace"
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !category ? 'bg-brand-600/20 text-brand-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
                >
                  Toutes
                </Link>
                {categories.map(cat => (
                  <Link
                    key={cat.id}
                    href={`/marketplace?category=${cat.slug}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      category === cat.slug ? 'bg-brand-600/20 text-brand-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    <span>{cat.icon ?? '📁'}</span>
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Commission info */}
          <div className="card p-4 bg-brand-600/5 border-brand-600/20">
            <h3 className="text-sm font-semibold text-brand-300 mb-2 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Commission
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Zone Entraide prend <strong className="text-zinc-300">10 %</strong> sur chaque vente.
              Le reste va directement au vendeur.
            </p>
          </div>
        </aside>

        {/* Grille de services */}
        <main className="flex-1 min-w-0">
          {services.length === 0 ? (
            <div className="card p-12 text-center">
              <ShoppingBag className="h-10 w-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 font-medium">Aucun service disponible</p>
              <p className="text-sm text-zinc-600 mt-1">Soyez le premier à proposer un service !</p>
              <Link href="/marketplace/proposer" className="btn-primary mt-4 inline-flex">
                Proposer un service
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {services.map(s => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {page > 1 && (
                <Link href={`/marketplace?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn-outline text-sm px-4 py-2">
                  ← Précédent
                </Link>
              )}
              <span className="text-sm text-zinc-500">Page {page} sur {totalPages}</span>
              {page < totalPages && (
                <Link href={`/marketplace?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn-outline text-sm px-4 py-2">
                  Suivant →
                </Link>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
