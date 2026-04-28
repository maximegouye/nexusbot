# Zone Entraide — Démarrage

## Stack
- **Frontend** : Next.js 14 + React + Tailwind CSS
- **Backend** : API REST (Next.js App Router)
- **Base de données** : PostgreSQL + Prisma ORM
- **Auth** : NextAuth.js (Google + Email magique)
- **Paiement** : Stripe (abonnements + marketplace)
- **SEO** : SSR + sitemap dynamique + metadata OpenGraph

## Installation

```bash
cd zone-entraide-platform

# Installer les dépendances
npm install

# Copier les variables d'environnement
cp .env.example .env.local
# → Remplir TOUS les champs de .env.local

# Créer la base de données
npm run db:push

# Lancer en développement
npm run dev
```

Le site est accessible sur **http://localhost:3000**

## Variables d'environnement obligatoires

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Secret aléatoire (générer avec `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL de l'app (http://localhost:3000 en dev) |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook Stripe |
| `STRIPE_PREMIUM_PRICE_ID` | ID du prix Stripe pour Premium mensuel |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe |
| `NEXT_PUBLIC_APP_URL` | URL publique du site |

## Structure des fichiers

```
app/
  page.tsx               — Accueil
  questions/
    page.tsx             — Liste des questions (filtres, tri, pagination)
    [slug]/page.tsx      — Page question individuelle (SEO)
  categories/
    page.tsx             — Grille des catégories
    [slug]/page.tsx      — Page catégorie (SEO)
  marketplace/
    page.tsx             — Marketplace des services
  premium/
    page.tsx             — Page abonnement
  profile/
    [username]/page.tsx  — Profil utilisateur
  api/
    questions/route.ts   — CRUD questions
    answers/route.ts     — CRUD réponses
    votes/route.ts       — Système de votes
    auth/                — NextAuth
    stripe/              — Checkout + Webhook

components/
  Header.tsx             — Nav sticky responsive
  Footer.tsx             — Footer 4 colonnes
  QuestionCard.tsx       — Carte question (votes, tags, auteur)
  ServiceCard.tsx        — Carte service marketplace
  VoteButton.tsx         — Bouton vote optimistic UI

lib/
  db.ts                  — Client Prisma
  auth.ts                — Config NextAuth
  stripe.ts              — Client Stripe
  utils.ts               — Helpers (slugify, timeAgo, etc.)

prisma/
  schema.prisma          — Schema complet (User, Question, Answer, Vote, Service, Order...)
```

## Déploiement (Vercel)

1. Pousser le dossier `zone-entraide-platform` sur un repo GitHub
2. Importer sur [vercel.com](https://vercel.com)
3. Ajouter toutes les variables d'environnement
4. Connecter une base PostgreSQL (Vercel Postgres, Supabase, Neon...)
5. Déployer

## Revenus

- **Premium** : 4,99 €/mois ou 39,99 €/an
- **Marketplace** : 10 % de commission sur chaque vente (configurable via `COMMISSION_RATE`)
