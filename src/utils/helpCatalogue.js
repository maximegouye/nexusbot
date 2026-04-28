/**
 * NexusBot — Catalogue de toutes les commandes pour /aide.
 */
module.exports = {
  accueil: {
    label: '🏠 Accueil',
    description: 'Vue d\'ensemble du bot',
  },
  economy: {
    label: '💰 Économie',
    description: 'Gagner, dépenser, épargner',
    commands: [
      { cmd: '/solde · &solde',        desc: 'Voir ton solde et ta banque' },
      { cmd: '/daily · &daily',         desc: 'Récompense quotidienne (streak bonus)' },
      { cmd: '/work · &work',           desc: 'Travailler pour gagner des €' },
      { cmd: '/crime · &crime',         desc: 'Commettre un crime (risqué mais payant)' },
      { cmd: '/rob · &rob',             desc: 'Voler un membre' },
      { cmd: '/transfer · &transfer',   desc: 'Envoyer des € à quelqu\'un' },
      { cmd: '/deposit · /withdraw',    desc: 'Déposer ou retirer à la banque' },
      { cmd: '/shop · &shop',           desc: 'Voir la boutique du serveur' },
      { cmd: '/buy · &buy',             desc: 'Acheter un article' },
      { cmd: '/inventory · &inv',       desc: 'Voir ton inventaire' },
      { cmd: '/market',                  desc: 'Marché joueur-à-joueur' },
    ],
  },
  games: {
    label: '🎰 Jeux & Casino',
    description: 'Toutes les mises ILLIMITÉES',
    commands: [
      { cmd: '/blackjack · &bj',        desc: '♠♥ Mise ce que tu veux · doubler · abandon · assurance' },
      { cmd: '/roulette · &roul',       desc: '🎡 Rouge/noir, pair/impair, douzaines, colonnes, numéro' },
      { cmd: '/slots · &slots',          desc: '🎰 Machine à sous · 7️⃣ JACKPOT ×50' },
      { cmd: '/mines · &mines',          desc: '💣 Démineur casino · multi qui monte, cash out avant la mine' },
      { cmd: '/crash · &crash',          desc: '📈 Vise un multiplicateur · encaisse avant le crash' },
      { cmd: '/roue · &roue',            desc: '🎡 Roue de la fortune · jusqu\'à ×10 JACKPOT' },
      { cmd: '/des · &des',              desc: '🎲 2 dés · pair/impair/haut/bas/7/numéro' },
      { cmd: '/coinflip · &cf',          desc: '€ Pile ou face contre un autre membre' },
      { cmd: '/trivia · &trivia',        desc: '🧠 Questions culture générale' },
    ],
  },
  leveling: {
    label: '⭐ Niveaux & Rang',
    description: 'XP, classement, rôles par niveau',
    commands: [
      { cmd: '/rank · &rank',            desc: 'Carte de rang XP premium' },
      { cmd: '/classement · &top',       desc: 'Top serveur (XP / solde / messages / vocal)' },
      { cmd: '/profil · &profil',        desc: 'Ton profil complet' },
      { cmd: '/rep · &rep',              desc: 'Donner un point de réputation' },
    ],
  },
  moderation: {
    label: '🛡️ Modération',
    description: 'Outils staff',
    commands: [
      { cmd: '/ban · &ban',              desc: 'Bannir un membre' },
      { cmd: '/kick · &kick',            desc: 'Expulser un membre' },
      { cmd: '/mute · /timeout',         desc: 'Rendre muet temporairement' },
      { cmd: '/warn · /warnings',        desc: 'Avertir / voir les avertissements' },
      { cmd: '/clear · &clear',          desc: 'Supprimer des messages' },
      { cmd: '/slowmode · /lock',        desc: 'Mode lent / verrouiller un salon' },
      { cmd: '/tempban · /untempban',    desc: 'Bannissement temporaire' },
      { cmd: '/cases',                    desc: 'Historique des sanctions' },
    ],
  },
  ai: {
    label: '🧠 Intelligence IA',
    description: 'Réponses intelligentes · résumés · traduction',
    commands: [
      { cmd: '/ia · &ia',                desc: 'Pose une question à l\'IA (Claude / GPT)' },
      { cmd: '/resume · &resume',         desc: 'Résumer les N derniers messages' },
      { cmd: '/traduis · &traduis',       desc: 'Traduire dans n\'importe quelle langue' },
      { cmd: '@NexusBot …',               desc: 'Mentionne le bot pour une réponse auto (si activé)' },
    ],
  },
  config: {
    label: '⚙️ Configuration',
    description: 'Panneau d\'admin complet',
    commands: [
      { cmd: '/config · &config',        desc: 'Ouvrir le panneau (25+ catégories, 0 limite)' },
      { cmd: 'Sections : Économie avancée · XP avancé · Modération avancée · Logs · IA · Éditeur libre · Éditeur d\'encarts · Commandes custom · Messages système · Autoresponder · Rôles par niveau · Boutique · Rôles par réaction · Menus de rôles · Anti-raid · Notifs YouTube/Twitch · Concours · Messages programmés · Quêtes · Sondages · Cooldowns & activations · Raccourcis · Sauvegarde & Import · Textes & libellés', desc: '' },
    ],
  },
  tickets: {
    label: '🎫 Tickets & Support',
    description: 'Système de tickets complet',
    commands: [
      { cmd: '/ticket',                   desc: 'Créer/gérer les tickets · panneaux · transcripts' },
      { cmd: '/notes',                    desc: 'Notes de modération silencieuses' },
      { cmd: '/suggestion',               desc: 'Proposer une idée (vote)' },
    ],
  },
  utility: {
    label: '🔧 Utilitaires',
    description: 'Outils pratiques',
    commands: [
      { cmd: '/serverinfo · /userinfo',  desc: 'Infos serveur / membre' },
      { cmd: '/poll · /sondage',         desc: 'Créer un sondage interactif' },
      { cmd: '/rappel · /remind',        desc: 'Rappel programmé' },
      { cmd: '/avatar · /banniere',      desc: 'Récupérer avatar ou bannière' },
      { cmd: '/meteo',                    desc: 'Météo d\'une ville' },
      { cmd: '/traduire (clic droit)',   desc: 'Traduire un message' },
      { cmd: '/quotes',                   desc: 'Citations motivantes' },
    ],
  },
  fun: {
    label: '🎉 Fun & Social',
    description: 'Divertissement',
    commands: [
      { cmd: '/8ball · &8ball',          desc: 'Boule magique' },
      { cmd: '/blague · /riddle',         desc: 'Blagues et devinettes' },
      { cmd: '/rps · /tictactoe',         desc: 'Pierre-papier-ciseaux · Morpion' },
      { cmd: '/connect4',                 desc: 'Puissance 4' },
      { cmd: '/wordle · /devine',         desc: 'Mots à deviner' },
      { cmd: '/pendu',                    desc: 'Jeu du pendu' },
      { cmd: '/actions',                  desc: 'Câlin, kiss, slap, etc.' },
    ],
  },
  unique: {
    label: '✨ Fonctions uniques',
    description: 'Ce qui rend NexusBot unique',
    commands: [
      { cmd: '/quest',                    desc: 'Quêtes communautaires · progression partagée' },
      { cmd: '/giveaway',                 desc: 'Organiser un concours' },
      { cmd: '/birthday',                 desc: 'Enregistrer ton anniversaire' },
      { cmd: '/health',                   desc: 'Rapport de santé du serveur' },
      { cmd: '/reactionrole',             desc: 'Réagir = obtenir un rôle' },
      { cmd: '/rolemenu',                 desc: 'Menu de rôles interactif' },
      { cmd: '/premium',                  desc: 'Activer premium avec un code' },
    ],
  },
};
