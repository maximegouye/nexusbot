// Mock client pour démo locale — remplacer par PrismaClient en prod avec vraie DB
const mockUser = {
  id: 'demo', name: 'Demo User', image: null, username: 'demo',
  reputation: 1250, level: 4, isPremium: false,
};

const mockQuestions = [
  {
    id: '1', title: 'Comment apprendre JavaScript rapidement en 2024 ?', slug: 'apprendre-javascript-rapidement-2024',
    body: 'Je suis débutant et je veux apprendre JS le plus vite possible. Quelles ressources recommandez-vous ?',
    views: 4280, voteScore: 47, isPinned: false, isClosed: false, isAnswered: true,
    createdAt: new Date(Date.now() - 2 * 86400000), updatedAt: new Date(),
    authorId: '1', categoryId: '1',
    author: { id: '1', name: 'Marie Dupont', image: null, username: 'marie_d', reputation: 3200, level: 6 },
    category: { id: '1', name: 'Programmation', slug: 'programmation', icon: '💻', color: '#7c3aed' },
    tags: [{ id: '1', name: 'javascript', slug: 'javascript' }, { id: '2', name: 'débutant', slug: 'debutant' }],
    _count: { answers: 12, votes: 47, comments: 8 },
  },
  {
    id: '2', title: 'Meilleure stratégie pour investir 10 000€ en 2024 ?', slug: 'investir-10000-euros-2024',
    body: 'J\'ai 10 000€ d\'économies. ETF, immobilier locatif, crypto ? Besoin de conseils de personnes expérimentées.',
    views: 8910, voteScore: 89, isPinned: false, isClosed: false, isAnswered: false,
    createdAt: new Date(Date.now() - 5 * 86400000), updatedAt: new Date(),
    authorId: '2', categoryId: '2',
    author: { id: '2', name: 'Thomas Martin', image: null, username: 'thomas_m', reputation: 890, level: 3 },
    category: { id: '2', name: 'Finance', slug: 'finance', icon: '💰', color: '#f59e0b' },
    tags: [{ id: '3', name: 'investissement', slug: 'investissement' }, { id: '4', name: 'epargne', slug: 'epargne' }],
    _count: { answers: 7, votes: 89, comments: 15 },
  },
  {
    id: '3', title: 'Comment créer un CV qui se démarque pour les recruteurs tech ?', slug: 'cv-developpeur-se-demarquer',
    body: 'Je postule pour des postes de développeur junior. Mon CV est lu mais je n\'ai pas de rappels. Des conseils ?',
    views: 3150, voteScore: 34, isPinned: false, isClosed: false, isAnswered: true,
    createdAt: new Date(Date.now() - 1 * 86400000), updatedAt: new Date(),
    authorId: '3', categoryId: '3',
    author: { id: '3', name: 'Sophie Lambert', image: null, username: 'sophie_l', reputation: 450, level: 2 },
    category: { id: '3', name: 'Emploi & Carrière', slug: 'emploi', icon: '💼', color: '#10b981' },
    tags: [{ id: '5', name: 'cv', slug: 'cv' }, { id: '6', name: 'recrutement', slug: 'recrutement' }],
    _count: { answers: 5, votes: 34, comments: 3 },
  },
  {
    id: '4', title: 'React vs Vue.js en 2024 — lequel choisir pour un nouveau projet ?', slug: 'react-vs-vue-2024',
    body: 'Je dois choisir entre React et Vue pour une startup. Avantages/inconvénients de chacun ?',
    views: 6720, voteScore: 61, isPinned: false, isClosed: false, isAnswered: true,
    createdAt: new Date(Date.now() - 3 * 86400000), updatedAt: new Date(),
    authorId: '4', categoryId: '1',
    author: { id: '4', name: 'Paul Renard', image: null, username: 'paul_r', reputation: 5600, level: 7 },
    category: { id: '1', name: 'Programmation', slug: 'programmation', icon: '💻', color: '#7c3aed' },
    tags: [{ id: '7', name: 'react', slug: 'react' }, { id: '8', name: 'vue', slug: 'vue' }, { id: '1', name: 'javascript', slug: 'javascript' }],
    _count: { answers: 18, votes: 61, comments: 22 },
  },
  {
    id: '5', title: 'Comment négocier son salaire lors d\'un entretien en France ?', slug: 'negocier-salaire-entretien-france',
    body: 'J\'ai un entretien final dans 2 jours. Comment aborder la question du salaire sans paraître trop gourmand ?',
    views: 2890, voteScore: 28, isPinned: false, isClosed: false, isAnswered: false,
    createdAt: new Date(Date.now() - 6 * 3600000), updatedAt: new Date(),
    authorId: '5', categoryId: '3',
    author: { id: '5', name: 'Camille Petit', image: null, username: 'camille_p', reputation: 120, level: 1 },
    category: { id: '3', name: 'Emploi & Carrière', slug: 'emploi', icon: '💼', color: '#10b981' },
    tags: [{ id: '9', name: 'salaire', slug: 'salaire' }, { id: '10', name: 'entretien', slug: 'entretien' }],
    _count: { answers: 3, votes: 28, comments: 6 },
  },
  {
    id: '6', title: 'Quelle stack choisir pour une app SaaS B2B en 2024 ?', slug: 'stack-saas-b2b-2024',
    body: 'Je lance un SaaS B2B seul. Next.js + Supabase + Stripe semble être la voie. Des retours ?',
    views: 5240, voteScore: 72, isPinned: false, isClosed: false, isAnswered: true,
    createdAt: new Date(Date.now() - 7 * 86400000), updatedAt: new Date(),
    authorId: '4', categoryId: '1',
    author: { id: '4', name: 'Paul Renard', image: null, username: 'paul_r', reputation: 5600, level: 7 },
    category: { id: '1', name: 'Programmation', slug: 'programmation', icon: '💻', color: '#7c3aed' },
    tags: [{ id: '11', name: 'saas', slug: 'saas' }, { id: '12', name: 'nextjs', slug: 'nextjs' }],
    _count: { answers: 9, votes: 72, comments: 11 },
  },
];

const mockCategories = [
  { id: '1', name: 'Programmation',    slug: 'programmation', icon: '💻', color: '#7c3aed', order: 1, description: null, createdAt: new Date(), _count: { questions: 142 } },
  { id: '2', name: 'Finance',          slug: 'finance',       icon: '💰', color: '#f59e0b', order: 2, description: null, createdAt: new Date(), _count: { questions: 98  } },
  { id: '3', name: 'Emploi & Carrière',slug: 'emploi',        icon: '💼', color: '#10b981', order: 3, description: null, createdAt: new Date(), _count: { questions: 76  } },
  { id: '4', name: 'Design & UX',      slug: 'design',        icon: '🎨', color: '#ec4899', order: 4, description: null, createdAt: new Date(), _count: { questions: 64  } },
  { id: '5', name: 'Marketing',        slug: 'marketing',     icon: '📢', color: '#ef4444', order: 5, description: null, createdAt: new Date(), _count: { questions: 87  } },
  { id: '6', name: 'Droit',            slug: 'droit',         icon: '⚖️', color: '#6366f1', order: 6, description: null, createdAt: new Date(), _count: { questions: 43  } },
  { id: '7', name: 'Santé',            slug: 'sante',         icon: '🏥', color: '#14b8a6', order: 7, description: null, createdAt: new Date(), _count: { questions: 55  } },
  { id: '8', name: 'Entrepreneuriat',  slug: 'entrepreneuriat',icon: '🚀',color: '#f97316', order: 8, description: null, createdAt: new Date(), _count: { questions: 119 } },
];

// Mock Prisma client qui retourne les données de démo
export const prisma = {
  user: {
    count: async () => 2847,
    findUnique: async (args: any) => mockUser,
    findFirst:  async (args: any) => mockUser,
    update:     async (args: any) => mockUser,
    create:     async (args: any) => mockUser,
  },
  question: {
    count:     async (args?: any) => args?.where?.isAnswered === true ? 1203 : mockQuestions.length,
    findMany:  async (args?: any) => mockQuestions.slice(0, args?.take ?? 20),
    findUnique:async (args?: any) => mockQuestions[0],
    create:    async (args: any)  => ({ ...mockQuestions[0], id: Date.now().toString() }),
    update:    async (args: any)  => mockQuestions[0],
  },
  answer: {
    count:    async () => 8921,
    findMany: async () => [],
    create:   async (args: any) => ({ id: '1', ...args.data }),
    update:   async (args: any) => args.data,
  },
  category: {
    findMany:  async (args?: any) => mockCategories.slice(0, args?.take ?? 8),
    findUnique:async (args?: any) => mockCategories[0],
  },
  service: {
    count:    async () => 0,
    findMany: async () => [],
  },
  tag: {
    upsert: async (args: any) => ({ id: '1', ...args.create }),
  },
  vote: {
    findUnique: async () => null,
    create:     async () => null,
    update:     async () => null,
    delete:     async () => null,
  },
  notification: {
    create: async () => null,
  },
  subscription: {
    upsert: async () => null,
  },
  db: { prepare: () => ({ get: () => null, all: () => [], run: () => null }) },
} as any;
