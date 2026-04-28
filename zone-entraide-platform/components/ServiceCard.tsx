import Link from 'next/link';
import Image from 'next/image';
import { Star, ShoppingBag, Crown, Clock } from 'lucide-react';
import type { ServiceWithRelations } from '@/types';
import { formatPrice } from '@/lib/stripe';

interface ServiceCardProps {
  service: ServiceWithRelations;
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <article className="card-hover group overflow-hidden">
      {/* Image */}
      <div className="aspect-[16/9] bg-surface-700 relative overflow-hidden">
        {service.images[0] ? (
          <Image
            src={service.images[0]}
            alt={service.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-900 to-surface-700">
            <ShoppingBag className="h-10 w-10 text-brand-600" />
          </div>
        )}
        {service.category && (
          <div className="absolute top-3 left-3">
            <span className="badge-brand backdrop-blur-sm">{service.category.name}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Seller */}
        <div className="flex items-center gap-2 mb-3">
          {service.seller.image ? (
            <Image
              src={service.seller.image}
              alt={service.seller.name ?? ''}
              width={22}
              height={22}
              className="rounded-full"
            />
          ) : (
            <div className="h-5 w-5 rounded-full bg-brand-700 flex items-center justify-center text-[10px] font-bold text-white">
              {service.seller.name?.[0]?.toUpperCase()}
            </div>
          )}
          <Link
            href={`/profil/${service.seller.username ?? service.seller.id}`}
            className="text-xs font-medium text-zinc-400 hover:text-brand-400 transition-colors"
          >
            {service.seller.name}
          </Link>
          {service.seller.isPremium && (
            <Crown className="h-3.5 w-3.5 text-gold-400" />
          )}
        </div>

        <Link href={`/marketplace/${service.slug}`}>
          <h3 className="font-semibold text-zinc-100 text-sm leading-snug mb-3 line-clamp-2 group-hover:text-brand-300 transition-colors">
            {service.title}
          </h3>
        </Link>

        {/* Rating */}
        {service.reviewCount > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(i => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i <= Math.round(service.rating) ? 'fill-gold-400 text-gold-400' : 'text-zinc-700'}`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-gold-400">{service.rating.toFixed(1)}</span>
            <span className="text-xs text-zinc-600">({service.reviewCount})</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <span>Livraison {service.deliveryDays}j</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-600 uppercase tracking-wide">À partir de</p>
            <p className="font-bold text-zinc-100">{formatPrice(service.price)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
