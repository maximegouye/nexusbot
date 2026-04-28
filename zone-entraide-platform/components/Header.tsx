'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  Search, Bell, ChevronDown, Menu, X, Zap,
  User, Settings, LogOut, Star, ShoppingBag,
  HelpCircle, Grid3X3, Crown,
} from 'lucide-react';
import Image from 'next/image';

const NAV = [
  { label: 'Questions',   href: '/questions',  icon: HelpCircle },
  { label: 'Catégories',  href: '/categories', icon: Grid3X3   },
  { label: 'Marketplace', href: '/marketplace',icon: ShoppingBag},
  { label: 'Premium',     href: '/premium',    icon: Crown      },
];

export function Header() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-zinc-100 text-lg hidden sm:block">
              Zone<span className="text-brand-400">Entraide</span>
            </span>
          </Link>

          {/* Search bar */}
          <div className="flex-1 max-w-xl hidden md:block">
            <form action="/questions" method="GET">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="search"
                  name="q"
                  placeholder="Rechercher une question, un service…"
                  className="input pl-9 pr-4 h-9 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </form>
          </div>

          {/* Nav desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            {session ? (
              <>
                {/* Notifications */}
                <button className="relative btn-ghost rounded-lg p-2">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500" />
                </button>

                {/* User menu */}
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-surface-700 px-3 py-1.5 hover:border-white/20 transition-colors"
                  >
                    {session.user.image ? (
                      <Image
                        src={session.user.image}
                        alt={session.user.name ?? ''}
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white">
                        {session.user.name?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                    )}
                    <span className="text-sm font-medium text-zinc-200 hidden sm:block max-w-[100px] truncate">
                      {session.user.name ?? session.user.email}
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-white/10 bg-surface-700 shadow-card z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/5">
                          <p className="text-sm font-semibold text-zinc-100">{session.user.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{session.user.email}</p>
                          {session.user.isPremium && (
                            <span className="badge-gold mt-1.5"><Crown className="h-3 w-3" />Premium</span>
                          )}
                        </div>
                        <div className="py-1">
                          {[
                            { icon: User, label: 'Mon profil', href: `/profil/${session.user.username ?? session.user.id}` },
                            { icon: Star, label: 'Mes questions', href: '/questions?filter=mine' },
                            { icon: ShoppingBag, label: 'Mes services', href: '/marketplace?filter=mine' },
                            { icon: Settings, label: 'Paramètres', href: '/parametres' },
                          ].map(({ icon: Icon, label, href }) => (
                            <Link
                              key={href}
                              href={href}
                              onClick={() => setProfileOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/5 hover:text-zinc-100 transition-colors"
                            >
                              <Icon className="h-4 w-4 text-zinc-500" />
                              {label}
                            </Link>
                          ))}
                        </div>
                        <div className="border-t border-white/5 py-1">
                          <button
                            onClick={() => signOut()}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Se déconnecter
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/connexion" className="btn-outline text-sm px-4 py-2 hidden sm:flex">
                  Connexion
                </Link>
                <Link href="/inscription" className="btn-primary text-sm px-4 py-2">
                  S'inscrire
                </Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-ghost rounded-lg p-2 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/5 bg-surface-800 lg:hidden">
          <div className="px-4 py-3 space-y-1">
            {/* Mobile search */}
            <form action="/questions" method="GET" className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="search"
                  name="q"
                  placeholder="Rechercher…"
                  className="input pl-9 h-9 text-sm"
                />
              </div>
            </form>
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/5"
              >
                <Icon className="h-4 w-4 text-zinc-500" />
                {label}
              </Link>
            ))}
            {!session && (
              <div className="flex gap-2 pt-2 mt-2 border-t border-white/5">
                <Link href="/connexion" className="btn-outline flex-1 justify-center text-sm">Connexion</Link>
                <Link href="/inscription" className="btn-primary flex-1 justify-center text-sm">S'inscrire</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
