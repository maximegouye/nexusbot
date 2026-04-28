// ── Types de base (alignés avec prisma/schema.prisma) ──────

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  username: string | null;
  bio: string | null;
  reputation: number;
  level: number;
  isPremium: boolean;
  premiumUntil: Date | null;
  stripeCustomerId: string | null;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string;
  order: number;
  createdAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface Question {
  id: string;
  title: string;
  slug: string;
  body: string;
  views: number;
  voteScore: number;
  isPinned: boolean;
  isClosed: boolean;
  isAnswered: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  categoryId: string | null;
}

export interface Answer {
  id: string;
  body: string;
  voteScore: number;
  isAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  questionId: string;
}

export interface Service {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  deliveryDays: number;
  images: string[];
  tags: string[];
  isActive: boolean;
  rating: number;
  reviewCount: number;
  salesCount: number;
  createdAt: Date;
  updatedAt: Date;
  sellerId: string;
  categoryId: string | null;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  awardedAt: Date;
  badge: Badge;
}

// ── Etendus ────────────────────────────────────────────────

export type QuestionWithRelations = Question & {
  author: Pick<User, 'id' | 'name' | 'image' | 'username' | 'reputation' | 'level'>;
  category: Category | null;
  tags: Tag[];
  _count: { answers: number; votes: number; comments: number };
};

export type AnswerWithRelations = Answer & {
  author: Pick<User, 'id' | 'name' | 'image' | 'username' | 'reputation' | 'level'>;
  _count: { votes: number; comments: number };
};

export type ServiceWithRelations = Service & {
  seller: Pick<User, 'id' | 'name' | 'image' | 'username' | 'reputation' | 'level' | 'isPremium'>;
  category: Category | null;
};

// ── API ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

// ── Filters ────────────────────────────────────────────────

export type QuestionSort = 'newest' | 'popular' | 'unanswered' | 'trending';

export interface QuestionFilters {
  sort?: QuestionSort;
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
}

export type ServiceSort = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface ServiceFilters {
  sort?: ServiceSort;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  page?: number;
}

// ── Next-Auth ──────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      isPremium: boolean;
      username?: string | null;
      reputation: number;
    };
  }
}
