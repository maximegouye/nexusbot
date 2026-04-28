import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Conditions générales d'utilisation de Zone Entraide.",
};

export default function CguPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14">
      <h1 className="text-3xl font-bold text-zinc-100 mb-2">Conditions Générales d'Utilisation</h1>
      <p className="text-zinc-500 text-sm mb-10">Dernière mise à jour : avril 2026</p>

      <div className="prose prose-invert prose-zinc max-w-none space-y-8 text-zinc-300">
        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">1. Acceptation des conditions</h2>
          <p>En accédant et en utilisant Zone Entraide, vous acceptez d'être lié par les présentes conditions générales d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">2. Description du service</h2>
          <p>Zone Entraide est une plateforme communautaire francophone permettant à ses membres de poser des questions, d'y répondre, et de proposer des services dans un espace de marketplace dédié.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">3. Inscription et compte</h2>
          <p>L'inscription est gratuite. Vous vous engagez à fournir des informations exactes lors de la création de votre compte et à maintenir la confidentialité de vos identifiants de connexion.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">4. Règles de conduite</h2>
          <p>Il est interdit de publier du contenu offensant, discriminatoire, illégal ou portant atteinte aux droits d'autrui. Zone Entraide se réserve le droit de supprimer tout contenu enfreignant ces règles et de suspendre les comptes contrevenants.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">5. Propriété intellectuelle</h2>
          <p>Les contenus publiés par les utilisateurs leur appartiennent. En publiant sur Zone Entraide, vous accordez à la plateforme une licence non exclusive d'utilisation de ces contenus dans le cadre du service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">6. Premium et marketplace</h2>
          <p>Les abonnements Premium et les transactions de la marketplace sont soumis à des conditions spécifiques de paiement. Les remboursements sont possibles dans les 14 jours suivant l'achat, conformément au droit européen de la consommation.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">7. Modification des conditions</h2>
          <p>Zone Entraide se réserve le droit de modifier les présentes conditions à tout moment. Les utilisateurs seront informés de toute modification substantielle par notification sur la plateforme.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-3">8. Contact</h2>
          <p>Pour toute question relative aux présentes conditions, contactez-nous à <a href="mailto:legal@zone-entraide.fr" className="text-brand-400 hover:text-brand-300">legal@zone-entraide.fr</a>.</p>
        </section>
      </div>
    </main>
  );
}
