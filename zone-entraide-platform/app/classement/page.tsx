import type { Metadata } from 'next';
import { Crown, Star, TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Classement',
  description: 'Les membres les plus actifs et utiles de la communauté Zone Entraide.',
};

const MOCK_TOP = [
  { rank: 1, name: 'Paul Renard',    username: 'paul_r',   reputation: 5600, level: 7, answers: 312, badge: '🥇' },
  { rank: 2, name: 'Marie Dupont',   username: 'marie_d',  reputation: 3200, level: 6, answers: 187, badge: '🥈' },
  { rank: 3, name: 'Lucas Bernard',  username: 'lucas_b',  reputation: 2890, level: 5, answers: 143, badge: '🥉' },
  { rank: 4, name: 'Emma Leroy',     username: 'emma_l',   reputation: 1900, level: 5, answers: 98,  badge: '4' },
  { rank: 5, name: 'Thomas Martin',  username: 'thomas_m', reputation: 890,  level: 3, answers: 54,  badge: '5' },
  { rank: 6, name: 'Sophie Lambert', username: 'sophie_l', reputation: 450,  level: 2, answers: 29,  badge: '6' },
  { rank: 7, name: 'Alex Moreau',    username: 'alex_m',   reputation: 380,  level: 2, answers: 22,  badge: '7' },
  { rank: 8, name: 'Julie Simon',    username: 'julie_s',  reputation: 310,  level: 2, answers: 18,  badge: '8' },
  { rank: 9, name: 'Camille Petit',  username: 'camille_p',reputation: 120,  level: 1, answers: 9,   badge: '9' },
  { rank: 10,name: 'Nathan Roux',    username: 'nathan_r', reputation: 80,   level: 1, answers: 5,   badge: '10' },
];

export default function ClassementPage() {
  const top3  = MOCK_TOP.slice(0, 3);
  const rest  = MOCK_TOP.slice(3);

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10 text-center">
        <Crown className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
        <h1 className="text-3xl font-bold text-zinc-100">Classement</h1>
        <p className="mt-2 text-zinc-400">Les membres qui contribuent le plus à la communauté.</p>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-4 mb-8 items-end">
        {[top3[1], top3[0], top3[2]].map((user, i) => {
          const heights = ['h-28', 'h-36', 'h-24'];
          const colors  = ['bg-zinc-600/30', 'bg-yellow-500/20', 'bg-amber-600/20'];
          return (
            <div key={user.rank} className={`flex flex-col items-center gap-2 rounded-xl border border-white/10 ${colors[i]} p-4 ${heights[i]}`}>
              <span className="text-2xl">{user.badge}</span>
              <div className="text-sm font-semibold text-zinc-200 truncate w-full text-center">{user.name}</div>
              <div className="text-xs text-zinc-400 flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-400" /> {user.reputation.toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-surface-800">
              <th className="py-3 px-4 text-left text-zinc-500 font-medium">#</th>
              <th className="py-3 px-4 text-left text-zinc-500 font-medium">Membre</th>
              <th className="py-3 px-4 text-right text-zinc-500 font-medium">Réputation</th>
              <th className="py-3 px-4 text-right text-zinc-500 font-medium hidden sm:table-cell">Réponses</th>
              <th className="py-3 px-4 text-right text-zinc-500 font-medium hidden sm:table-cell">Niveau</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {MOCK_TOP.map(user => (
              <tr key={user.rank} className="hover:bg-white/3 transition-colors">
                <td className="py-3 px-4 text-zinc-500">{user.rank}</td>
                <td className="py-3 px-4">
                  <div className="font-medium text-zinc-200">{user.name}</div>
                  <div className="text-xs text-zinc-500">@{user.username}</div>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="flex items-center justify-end gap-1 text-yellow-400 font-semibold">
                    <Star className="h-3.5 w-3.5" />
                    {user.reputation.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-zinc-400 hidden sm:table-cell">{user.answers}</td>
                <td className="py-3 px-4 text-right hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-600/20 px-2 py-0.5 text-xs text-brand-400">
                    <TrendingUp className="h-3 w-3" /> Niv.{user.level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
