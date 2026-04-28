import Link from 'next/link';
import { Zap, Github, Twitter, MessageCircle } from 'lucide-react';

type NavLink = { label: string; href: string; external?: boolean };

const LINKS: Record<string, NavLink[]> = {
  Plateforme: [
    { label: 'Questions',    href: '/questions'    },
    { label: 'Catégories',  href: '/categories'   },
    { label: 'Marketplace', href: '/marketplace'  },
    { label: 'Premium',     href: '/premium'      },
  ],
  Communauté: [
    { label: 'Discord',      href: 'https://discord.gg/zone-entraide', external: true },
    { label: 'Blog',         href: '/blog'         },
    { label: 'Classement',  href: '/classement'   },
  ],
  Légal: [
    { label: 'CGU',             href: '/cgu'             },
    { label: 'Politique vie privée', href: '/confidentialite' },
    { label: 'Mentions légales', href: '/mentions-legales' },
    { label: 'Contact',          href: '/contact'          },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface-900 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-12 grid grid-cols-2 gap-8 sm:grid-cols-4">

          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-zinc-100">
                Zone<span className="text-brand-400">Entraide</span>
              </span>
            </Link>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-[200px]">
              La plateforme d'entraide francophone. Posez vos questions, partagez vos savoirs.
            </p>
            <div className="flex gap-3 mt-5">
              {[
                { icon: Github,        href: 'https://github.com', label: 'GitHub'  },
                { icon: Twitter,       href: 'https://twitter.com', label: 'Twitter' },
                { icon: MessageCircle, href: 'https://discord.gg/zone-entraide', label: 'Discord' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-zinc-200 hover:border-white/20 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(LINKS).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-zinc-200 mb-4">{title}</h3>
              <ul className="space-y-2.5">
                {links.map(({ label, href, external }) => (
                  <li key={href}>
                    {external ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            © {new Date().getFullYear()} Zone Entraide. Tous droits réservés.
          </p>
          <p className="text-xs text-zinc-600">
            Fait avec ❤️ pour la communauté francophone
          </p>
        </div>
      </div>
    </footer>
  );
}
