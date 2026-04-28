import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Crown, Zap, Star, ArrowRight, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Premium',
  description: 'Accédez aux fonctionnalités avancées de Zone Entraide. Abonnement mensuel, annulable à tout moment.',
};

const FEATURES_FREE = [
  'Poser des questions',
  'Répondre aux questions',
  'Votes',
  'Profil public',
  'Accès au marketplace',
];

const FEATURES_PREMIUM = [
  'Tout ce qui est gratuit',
  'Badge Premium visible',
  'Questions en avant-plan (x2 visibilité)',
  'Réponses prioritaires (mise en avant)',
  '5 % de commission en moins sur le marketplace (10 % → 5 %)',
  'Statistiques avancées de son profil',
  'Accès aux questions exclusives Premium',
  'Notifications email personnalisées',
  'Titre exclusif "Contributeur Premium"',
  'Support prioritaire',
];

export default function PremiumPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">

      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 badge-gold mb-4 text-sm">
          <Crown className="h-4 w-4" />
          Zone Entraide Premium
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
          Passez au niveau{' '}
          <span className="gradient-text">supérieur</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Aucune fausse promesse. Des avantages concrets pour ceux qui contribuent activement à la communauté.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid sm:grid-cols-2 gap-6 mb-16">

        {/* Free */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-surface-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-zinc-400" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100 text-lg">Gratuit</h2>
              <p className="text-sm text-zinc-500">Toujours gratuit</p>
            </div>
          </div>
          <div className="mb-6">
            <span className="text-4xl font-black text-zinc-100">0 €</span>
            <span className="text-zinc-500 ml-2">/mois</span>
          </div>
          <ul className="space-y-3 mb-8">
            {FEATURES_FREE.map(f => (
              <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
                <Check className="h-4 w-4 text-zinc-600 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Link href="/inscription" className="btn-outline w-full justify-center">
            Créer un compte gratuit
          </Link>
        </div>

        {/* Premium */}
        <div className="relative card p-8 border-gold-500/30 bg-gradient-to-br from-gold-500/5 to-transparent overflow-hidden">
          {/* Popular badge */}
          <div className="absolute top-4 right-4">
            <span className="badge-gold"><Star className="h-3 w-3" />Recommandé</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gold-500/20 flex items-center justify-center">
              <Crown className="h-5 w-5 text-gold-400" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100 text-lg">Premium</h2>
              <p className="text-sm text-zinc-500">Annulable à tout moment</p>
            </div>
          </div>

          <div className="mb-6">
            <span className="text-4xl font-black text-zinc-100">4,99 €</span>
            <span className="text-zinc-500 ml-2">/mois</span>
            <p className="text-xs text-zinc-600 mt-1">ou 39,99 € / an — économisez 34 %</p>
          </div>

          <ul className="space-y-3 mb-8">
            {FEATURES_PREMIUM.map(f => (
              <li key={f} className="flex items-start gap-3 text-sm text-zinc-300">
                <Check className="h-4 w-4 text-gold-400 mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <Link
            href="/api/stripe/checkout?plan=premium_monthly"
            className="btn bg-gradient-to-r from-gold-500 to-gold-600 text-surface-900 font-bold w-full justify-center hover:from-gold-400 hover:to-gold-500 shadow-[0_4px_16px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_24px_rgba(245,158,11,0.4)]"
          >
            <Crown className="h-5 w-5" />
            Devenir Premium
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* FAQ rapide */}
      <div className="card p-8">
        <h2 className="font-bold text-zinc-100 text-xl mb-6 flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-400" />
          Questions fréquentes
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              q: 'Puis-je annuler à tout moment ?',
              a: 'Oui. Vous pouvez annuler depuis votre profil. L\'accès Premium reste actif jusqu\'à la fin de la période payée.',
            },
            {
              q: 'Le paiement est-il sécurisé ?',
              a: 'Oui. Les paiements sont traités par Stripe, certifié PCI DSS. Nous ne stockons jamais vos données bancaires.',
            },
            {
              q: 'Y a-t-il un engagement ?',
              a: 'Aucun. L\'abonnement mensuel se renouvelle automatiquement mais peut être annulé à n\'importe quel moment.',
            },
            {
              q: 'Que se passe-t-il si j\'annule ?',
              a: 'Votre compte repasse en version gratuite à la fin de la période. Vous conservez vos questions et réponses.',
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="font-semibold text-zinc-200 text-sm mb-1.5">{q}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
