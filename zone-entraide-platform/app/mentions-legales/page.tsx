import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales de Zone Entraide.',
};

export default function MentionsLegalesPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <h1 className="text-3xl font-bold text-zinc-100 mb-10">Mentions légales</h1>

      <div className="space-y-8 text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">Éditeur</h2>
          <p>Zone Entraide<br />
          Email : <a href="mailto:contact@zone-entraide.fr" className="text-brand-400 hover:text-brand-300">contact@zone-entraide.fr</a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">Hébergement</h2>
          <p>Vercel Inc.<br />
          440 N Barranca Ave #4133<br />
          Covina, CA 91723, États-Unis</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">Propriété intellectuelle</h2>
          <p>Le contenu de ce site (design, textes, logos) est protégé par le droit d'auteur. Toute reproduction sans autorisation est interdite.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">Responsabilité</h2>
          <p>Zone Entraide ne saurait être tenu responsable des contenus publiés par les utilisateurs. Si vous constatez un contenu illicite, signalez-le via notre système de signalement.</p>
        </section>
      </div>
    </main>
  );
}
