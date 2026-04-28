import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, Search, Zap, Users, MessageSquare, Star,
  TrendingUp, Shield, Crown, BookOpen, ChevronRight,
  HelpCircle, ShoppingBag, CheckCircle2, Award
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { QuestionCard } from '@/components/QuestionCard';

export const metadata: Metadata = {
  title: 'Zone Entraide — La plateforme d\'entraide francophone',
  description: 'Posez vos questions, obtenez des réponses, partagez vos connaissances et proposez vos services. La communauté d\'entraide francophone de référence.',
};

// Données réelles uniquement — on masque si vide
async function getStats() {
  const [users, questions, answers] = await Promise.all([
    prisma.user.count(),
    prisma.question.count(),
    prisma.answer.count(),
  ]);
  return { users, questions, answers, solved: await prisma.question.count({ where: { isAnswered: true } }) };
}

async function getPopularQuestions() {
  return prisma.question.findMany({
    take: 8,
    orderBy: [{ voteScore: 'desc' }, { createdAt: 'desc' }],
    include: {
      author: { select: { id: true, name: true, image: true, username: true, reputation: true, level: true } },
      category: true,
      tags: true,
      _count: { select: { answers: true, votes: true, comments: true } },
    },
  });
}

async function getCategories() {
  return prisma.category.findMany({
    take: 8,
    orderBy: { order: 'asc' },
    include: { _count: { select: { questions: true } } },
  });
}

export default async function HomePage() {
  const [stats, questions, categories] = await Promise.all([
    getStats(),
    getPopularQuestions(),
    getCategories(),
  ]);

  const showStats  = stats.users > 0;
  const showQs     = questions.length > 0;
  const showCats   = categories.length > 0;

  return (
    <>
      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Glow background */}
        <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-600/5 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-600/30 bg-brand-600/10 px-4 py-1.5 text-sm font-medium text-brand-300 mb-8 animate-fade-up">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse-slow" />
            Plateforme francophone d'entraide
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 animate-fade-up animate-delay-100">
            L'entraide,{' '}
            <span className="gradient-text">réinventée</span>
            <br />
            pour les francophones
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-up animate-delay-200">
            Posez vos questions, obtenez des réponses d'experts, proposez vos services.
            La communauté où la connaissance se partage librement.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mb-10 animate-fade-up animate-delay-300">
            <form action="/questions" method="GET">
              <div className="flex items-center gap-3 p-2 rounded-2xl border border-white/10 bg-surface-800/80 backdrop-blur-sm shadow-card">
                <Search className="ml-3 h-5 w-5 text-zinc-500 shrink-0" />
                <input
                  type="search"
                  name="q"
                  placeholder="Comment faire… ? Quelle est la meilleure… ? Aide pour…"
                  className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 text-base outline-none"
                />
                <button type="submit" className="btn-primary shrink-0">
                  Rechercher
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap justify-center gap-2 mb-14 animate-fade-up animate-delay-400">
            {['JavaScript', 'Python', 'Design', 'Marketing', 'Finance', 'Droit'].map(tag => (
              <Link
                key={tag}
                href={`/questions?tag=${tag.toLowerCase()}`}
                className="badge bg-surface-700 text-zinc-400 hover:text-zinc-200 hover:bg-surface-600 border border-white/5 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>

          {/* Stats — uniquement si données réelles */}
          {showStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-up animate-delay-500">
              {[
                { value: stats.users.toLocaleString('fr-FR'), label: 'Membres',    icon: Users         },
                { value: stats.questions.toLocaleString('fr-FR'), label: 'Questions',  icon: HelpCircle   },
                { value: stats.answers.toLocaleString('fr-FR'),  label: 'Réponses',   icon: MessageSquare },
                { value: stats.solved.toLocaleString('fr-FR'),   label: 'Résolues',   icon: CheckCircle2  },
              ].map(({ value, label, icon: Icon }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-black gradient-text">{value}</div>
                  <div className="flex items-center justify-center gap-1 mt-1 text-xs text-zinc-500 uppercase tracking-wider">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section className="py-20 bg-surface-800/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <div className="section-label mx-auto mb-3 w-fit"><Zap className="h-3 w-3" />Pourquoi Zone Entraide ?</div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Tout ce dont tu as besoin</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-12">
            {[
              { icon: HelpCircle,    color: 'text-brand-400',    bg: 'bg-brand-600/10', title: 'Questions & Réponses',  desc: 'Système de votes, meilleures réponses mises en avant, tags, catégories. Tout pour trouver rapidement ce dont vous avez besoin.' },
              { icon: ShoppingBag,  color: 'text-emerald-400',  bg: 'bg-emerald-600/10', title: 'Marketplace de services', desc: 'Proposez et achetez des services entre membres. Paiement sécurisé Stripe, commission transparente, avis vérifiés.' },
              { icon: Crown,        color: 'text-gold-400',     bg: 'bg-gold-500/10',   title: 'Abonnement Premium',    desc: 'Questions prioritaires, badges exclusifs, accès avancé aux statistiques, visibilité accrue sur le marketplace.' },
              { icon: TrendingUp,   color: 'text-blue-400',     bg: 'bg-blue-600/10',   title: 'Réputation & Niveaux',  desc: 'Gagnez de la réputation en aidant la communauté. Débloquez des niveaux et des badges qui reflètent votre expertise.' },
              { icon: Shield,       color: 'text-purple-400',   bg: 'bg-purple-600/10', title: 'Modération active',     desc: 'Signalement, modération rapide, anti-spam. Une communauté saine et bienveillante.' },
              { icon: BookOpen,     color: 'text-orange-400',   bg: 'bg-orange-600/10', title: 'SEO & Visibilité',       desc: 'Chaque question est une page SEO. Votre expertise est indexée et visible par des milliers de personnes.' },
            ].map(({ icon: Icon, color, bg, title, desc }) => (
              <div key={title} className="card-hover p-6">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${bg} mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-bold text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ────────────────────────────────────── */}
      {showCats && (
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <div className="section-label mb-2 w-fit"><Award className="h-3 w-3" />Catégories</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Parcourir par thème</h2>
              </div>
              <Link href="/categories" className="btn-outline text-sm hidden sm:flex">
                Toutes les catégories <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map(cat => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.slug}`}
                  className="card-hover p-4 flex items-center gap-3 group"
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${cat.color}15` }}
                  >
                    {cat.icon ?? '📁'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-zinc-200 group-hover:text-brand-300 transition-colors truncate">{cat.name}</p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {(cat as any)._count.questions.toLocaleString('fr-FR')} questions
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── POPULAR QUESTIONS ─────────────────────────────── */}
      {showQs && (
        <section className="py-20 bg-surface-800/30">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-10">
              <div>
                <div className="section-label mb-2 w-fit"><TrendingUp className="h-3 w-3" />Populaires</div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">Questions du moment</h2>
              </div>
              <Link href="/questions" className="btn-outline text-sm hidden sm:flex">
                Toutes les questions <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="space-y-3">
              {questions.map(q => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/questions" className="btn-primary">
                Voir toutes les questions <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA INSCRIPTION ───────────────────────────────── */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="card p-10 sm:p-14 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/20 mb-6 mx-auto">
                <Star className="h-7 w-7 text-brand-400" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                Rejoins la communauté
              </h2>
              <p className="text-zinc-400 text-lg max-w-lg mx-auto mb-8">
                Gratuit, sans spam, sans fausses promesses. Juste une communauté qui s'entraide vraiment.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/inscription" className="btn-primary text-base px-8 py-3">
                  Créer un compte gratuit
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/questions" className="btn-outline text-base px-8 py-3">
                  Parcourir sans compte
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
