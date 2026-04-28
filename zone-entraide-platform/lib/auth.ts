import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { prisma } from './db';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/connexion',
    error: '/connexion',
    verifyRequest: '/connexion/verification',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, isPremium: true, username: true, reputation: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.isPremium = dbUser.isPremium;
          token.username = dbUser.username;
          token.reputation = dbUser.reputation;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isPremium = token.isPremium as boolean;
        session.user.username = token.username as string;
        session.user.reputation = token.reputation as number;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Génère un username par défaut basé sur email
      if (user.email && !user.name) return;
      const base = user.name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'user';
      const username = `${base}_${Math.random().toString(36).slice(2, 6)}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { username },
      });
    },
  },
};
