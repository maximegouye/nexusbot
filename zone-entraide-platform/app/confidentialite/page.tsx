import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et traitement des données personnelles sur Zone Entraide.',
};

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Politique de confidentialité</h1>
      <p className="text-zinc-500 text-sm mb-10">Dernière mise à jour : avril 2026</p>

      <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">1. Données collectées</h2>
          <p>Nous collectons uniquement les données nécessaires au fonctionnement du service : nom, adresse email, photo de profil (via OAuth), et les contenus que vous publiez sur la plateforme.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">2. Utilisation des données</h2>
          <p>Vos données sont utilisées pour : authentifier votre compte, afficher votre profil public, vous envoyer des notifications liées à votre activité, et traiter vos paiements (via Stripe, certifié PCI-DSS).</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">3. Partage des données</h2>
          <p>Nous ne vendons jamais vos données personnelles. Elles peuvent être partagées avec nos sous-traitants techniques (hébergement, paiement) dans le strict cadre de la fourniture du service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">4. Vos droits (RGPD)</h2>
          <p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement, de portabilité et d'opposition sur vos données. Exercez ces droits à : <a href="mailto:rgpd@zone-entraide.fr" className="text-brand-400 hover:text-brand-300">rgpd@zone-entraide.fr</a>.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">5. Cookies</h2>
          <p>Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement de la session. Aucun cookie publicitaire ou de tracking tiers n'est utilisé.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">6. Conservation des données</h2>
          <p>Vos données sont conservées pendant la durée de votre inscription, puis 3 ans après la suppression de votre compte conformément aux obligations légales.</p>
        </section>
      </div>
    </main>
  );
}
