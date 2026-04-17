/**
 * NexusBot — Trivia & culture générale (prefix)
 * n!trivia, n!capital, n!flag, n!sport_trivia, n!cinema, n!geographie...
 */
const { EmbedBuilder } = require('discord.js');

const CAPITALES = {
  france: { capital:'Paris', pop:'67M', lang:'Français' },
  allemagne: { capital:'Berlin', pop:'84M', lang:'Allemand' },
  japon: { capital:'Tokyo', pop:'125M', lang:'Japonais' },
  bresil: { capital:'Brasília', pop:'215M', lang:'Portugais' },
  australie: { capital:'Canberra', pop:'26M', lang:'Anglais' },
  canada: { capital:'Ottawa', pop:'38M', lang:'Anglais/Français' },
  inde: { capital:'New Delhi', pop:'1.4Mrd', lang:'Hindi/Anglais (et +20)' },
  chine: { capital:'Pékin', pop:'1.4Mrd', lang:'Mandarin' },
  russie: { capital:'Moscou', pop:'144M', lang:'Russe' },
  usa: { capital:'Washington D.C.', pop:'335M', lang:'Anglais' },
  maroc: { capital:'Rabat', pop:'37M', lang:'Arabe/Berbère/Français' },
  senegal: { capital:'Dakar', pop:'17M', lang:'Français/Wolof' },
  cameroun: { capital:'Yaoundé', pop:'28M', lang:'Français/Anglais' },
  algerie: { capital:'Alger', pop:'44M', lang:'Arabe/Berbère' },
  tunisie: { capital:'Tunis', pop:'12M', lang:'Arabe/Français' },
  cote_ivoire: { capital:'Yamoussoukro', pop:'27M', lang:'Français' },
  mexique: { capital:'Mexico', pop:'130M', lang:'Espagnol' },
  argentine: { capital:'Buenos Aires', pop:'45M', lang:'Espagnol' },
  egypte: { capital:'Le Caire', pop:'104M', lang:'Arabe' },
  nigeria: { capital:'Abuja', pop:'220M', lang:'Anglais' },
};

const SPORT_FACTS = [
  { sport:'Football', fait:'La Coupe du Monde FIFA a lieu tous les 4 ans. Le Brésil l\'a remportée 5 fois (record mondial).' },
  { sport:'Tennis', fait:'Les 4 Grand Chelems : Roland Garros (terre), Wimbledon (gazon), US Open (dur), Australian Open (dur).' },
  { sport:'Basketball', fait:'NBA = 30 équipes. Michael Jordan a remporté 6 titres avec les Chicago Bulls (1991-1998).' },
  { sport:'Boxe', fait:'Muhammad Ali (3x champion poids lourds) est considéré le plus grand boxeur de l\'histoire.' },
  { sport:'Rugby', fait:'La Coupe du Monde de Rugby a lieu tous les 4 ans. La Nouvelle-Zélande (All Blacks) est championne 3x.' },
  { sport:'Natation', fait:'Michael Phelps détient le record : 23 médailles d\'or olympiques, 28 médailles olympiques au total.' },
  { sport:'Cyclisme', fait:'Le Tour de France, 3 semaines, 21 étapes, ~3 500 km. Lance Armstrong a été déchu de ses 7 titres.' },
  { sport:'Athlétisme', fait:'Usain Bolt détient les records du monde du 100m (9.58s) et 200m (19.19s) depuis 2009.' },
  { sport:'Judo', fait:'Inventé au Japon en 1882 par Jigoro Kano. Sport olympique depuis Tokyo 1964.' },
  { sport:'Arts martiaux', fait:'Les Jeux Olympiques incluent Judo, Taekwondo, Karaté (2020), Lutte, Boxe, Escrime.' },
];

const CINEMA_FACTS = [
  "Le film **'Avatar' (2009)** de James Cameron est le plus rentable de l'histoire (~$2.9 milliards).",
  "**Stanley Kubrick** n'a jamais remporté d'Oscar de réalisation malgré des films comme 2001, The Shining, Full Metal Jacket.",
  "Le tournage de **'Apocalypse Now'** (1979) a duré 16 mois au lieu de 6. Brando pesait 115kg à l'arrivée.",
  "**Titanic (1997)** a coûté plus cher à produire que le vrai Titanic à construire (ajusté à l'inflation).",
  "**Meryl Streep** détient le record de nominations aux Oscars : 21 nominations, 3 victoires.",
  "La musique du film **Jaws (1975)** de John Williams n'utilise que 2 notes pour créer la peur.",
  "**'The Room' (2003)** est souvent cité comme le 'meilleur mauvais film de l'histoire'.",
  "**Inception** de Christopher Nolan : le totem de Cobb tourne encore — on ne sait jamais si c'est un rêve.",
];

const GEOGRAPHIE_QUIZ = [
  { q:"Quel est le plus grand pays du monde par superficie ?", r:"La Russie (17,1 millions km²)" },
  { q:"Quel est le plus petit pays du monde ?", r:"Le Vatican (0,44 km²)" },
  { q:"Quel est le fleuve le plus long du monde ?", r:"Le Nil (6 650 km) ou l'Amazone selon les mesures" },
  { q:"Quelle est la montagne la plus haute du monde ?", r:"L'Everest (8 848,86 m)" },
  { q:"Quel est l'océan le plus grand ?", r:"L'océan Pacifique (165 millions km²)" },
  { q:"Dans quel pays se trouve le désert du Sahara ?", r:"Il s'étend sur 11 pays : Algérie, Tunisie, Libye, Maroc, Mauritanie, Mali, Niger, Tchad, Soudan, Égypte, Érythrée" },
  { q:"Quelle est la ville la plus peuplée du monde ?", r:"Tokyo (37 millions d'habitants dans l'agglomération)" },
  { q:"Quel pays a le plus de frontières terrestres ?", r:"La Chine (14 frontières) ou la Russie (14 frontières)" },
];

const HISTOIRE_DATES = [
  { date:'1789', event:'Révolution française — Prise de la Bastille le 14 juillet.' },
  { date:'1492', event:'Christophe Colomb arrive en Amérique (12 octobre).' },
  { date:'1969', event:'Neil Armstrong marche sur la Lune (Apollo 11, 20 juillet).' },
  { date:'1945', event:'Fin de la Seconde Guerre mondiale (8 mai en Europe, 2 sept. en Asie).' },
  { date:'1914', event:'Début de la Première Guerre mondiale (28 juillet).' },
  { date:'1905', event:'Albert Einstein publie la théorie de la relativité restreinte.' },
  { date:'1865', event:'Abolition officielle de l\'esclavage aux États-Unis (13e amendement).' },
  { date:'1804', event:'Napoléon Bonaparte se couronne Empereur des Français.' },
  { date:'2001', event:'Attentats du 11 septembre — Tours du World Trade Center détruites.' },
  { date:'1991', event:'Dissolution de l\'URSS (25 décembre). Fin de la Guerre froide.' },
];

const commands = [
  {
    name: 'capitale',
    aliases: ['capital', 'pays_info', 'pays'],
    description: 'Capitale et infos d\'un pays',
    category: 'Culture générale',
    cooldown: 3,
    async execute(message, args) {
      const key = args.join('_').toLowerCase().replace(/\s+/g, '_');
      const pays = CAPITALES[key] || Object.entries(CAPITALES).find(([k]) => k.includes(key?.split('_')[0]))?.[1];
      const paysNom = Object.keys(CAPITALES).find(k => CAPITALES[k] === pays) || key;
      if (!pays) return message.reply(`❌ Pays inconnu. Disponibles : ${Object.keys(CAPITALES).join(', ')}`);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`🌍 ${paysNom.charAt(0).toUpperCase() + paysNom.slice(1).replace('_', ' ')}`)
        .addFields(
          { name: '🏛️ Capitale', value: pays.capital, inline: true },
          { name: '👥 Population', value: pays.pop, inline: true },
          { name: '🗣️ Langue(s)', value: pays.lang, inline: true },
        )] });
    }
  },
  {
    name: 'sport_trivia',
    aliases: ['sports', 'sport_fait', 'sportfact'],
    description: 'Fait sportif aléatoire',
    category: 'Culture générale',
    cooldown: 3,
    async execute(message, args) {
      const s = SPORT_FACTS[Math.floor(Math.random() * SPORT_FACTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`⚽ ${s.sport}`)
        .setDescription(s.fait)] });
    }
  },
  {
    name: 'cinema',
    aliases: ['film', 'cinema_fact', 'movie'],
    description: 'Anecdote cinéma',
    category: 'Culture générale',
    cooldown: 3,
    async execute(message, args) {
      const f = CINEMA_FACTS[Math.floor(Math.random() * CINEMA_FACTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#C0392B')
        .setTitle('🎬 Anecdote Cinéma')
        .setDescription(f)] });
    }
  },
  {
    name: 'geographie',
    aliases: ['geo', 'terre', 'pays_trivia'],
    description: 'Quiz géographie',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const q = GEOGRAPHIE_QUIZ[Math.floor(Math.random() * GEOGRAPHIE_QUIZ.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('🌍 Question géographie')
        .setDescription(`**${q.q}**\n\n||**Réponse :** ${q.r}||`)] });
    }
  },
  {
    name: 'histoire_date',
    aliases: ['datehisto', 'evenement', 'history'],
    description: 'Événement historique aléatoire',
    category: 'Culture générale',
    cooldown: 3,
    async execute(message, args) {
      const h = HISTOIRE_DATES[Math.floor(Math.random() * HISTOIRE_DATES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`📜 En ${h.date}`)
        .setDescription(h.event)] });
    }
  },
  {
    name: 'culture_pop',
    aliases: ['pop_culture', 'popquiz', 'cultureG'],
    description: 'Question culture pop / générale',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const QUESTIONS = [
        { q:"Quel est l'animal représenté sur le drapeau du Mexique ?", r:"Un aigle (mangeant un serpent)" },
        { q:"Dans quelle ville se déroule l'action du jeu Assassin's Creed Origins ?", r:"L'Égypte antique (Alexandrie, Memphis...)" },
        { q:"Qui a créé Facebook ?", r:"Mark Zuckerberg (avec 4 co-fondateurs) en 2004 à Harvard" },
        { q:"Combien de couleurs y a-t-il dans l'arc-en-ciel ?", r:"7 : Rouge, Orange, Jaune, Vert, Bleu, Indigo, Violet" },
        { q:"Quel est le record du monde de vitesse humaine à la nage ?", r:"47,84 km/h (Caeleb Dressel, 2021, 50m nage libre)" },
        { q:"Qui a peint la Joconde ?", r:"Léonard de Vinci (vers 1503-1519)" },
        { q:"Quel pays a le plus grand nombre de pyramides ?", r:"Le Soudan (200-255 pyramides, plus que l'Égypte)" },
      ];
      const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('🎯 Culture générale')
        .setDescription(`**${q.q}**\n\n||**Réponse :** ${q.r}||`)] });
    }
  },
  {
    name: 'langue',
    aliases: ['langues', 'linguistique', 'linguo'],
    description: 'Fait sur les langues du monde',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const FAITS = [
        "Il existe environ **7 000 langues** dans le monde. 90% risquent de disparaître d'ici 2100.",
        "Le **Mandarin** est la langue la plus parlée en nombre de locuteurs natifs (~920 millions).",
        "L'**Anglais** est la langue la plus parlée au total avec les non-natifs (~1,5 milliard).",
        "Le **Français** est parlé sur les 5 continents — langue officielle dans 29 pays.",
        "Le langage le plus ancien encore parlé est le **Basque** — aucun lien avec d'autres langues connues.",
        "L'écriture a été inventée en **Mésopotamie** vers -3200 avant J.-C. (cunéiforme sumérien).",
        "Le **Pirahã** (Amazonie) est une langue sans concept de couleur, de chiffres ni de passé/futur.",
      ];
      const f = FAITS[Math.floor(Math.random() * FAITS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1ABC9C')
        .setTitle('🗣️ Les langues du monde')
        .setDescription(f)] });
    }
  },
  {
    name: 'nourriture_monde',
    aliases: ['cuisine_monde', 'plat_mondial', 'food_trivia'],
    description: 'Plat traditionnel d\'un pays',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const PLATS = [
        { pays:'France', plat:'Bœuf Bourguignon', desc:'Bœuf mijoté au vin rouge de Bourgogne avec carottes et oignons.' },
        { pays:'Japon', plat:'Sushi / Ramen', desc:'Sushi = riz vinaigré + poisson. Ramen = bouillon, nouilles, porc, œuf.' },
        { pays:'Maroc', plat:'Tajine', desc:'Ragoût cuit dans un plat en terre cuite conique. Épices, viande, légumes.' },
        { pays:'Mexique', plat:'Tacos', desc:'Tortilla de maïs garnie de viande, salsa, coriandre, oignon.' },
        { pays:'Italie', plat:'Pizza / Pasta', desc:'Pizza Napolitaine = pâte fine, tomate, mozzarella di bufala. Protégée par l\'UNESCO.' },
        { pays:'Inde', plat:'Biryani', desc:'Riz épicé cuit avec viande ou légumes. 26 types répertoriés.' },
        { pays:'Sénégal', plat:'Thieboudienne', desc:'Riz cuit dans une sauce tomate avec poisson. Plat national du Sénégal.' },
        { pays:'Brésil', plat:'Feijoada', desc:'Ragoût de haricots noirs et viandes de porc. Plat national du Brésil.' },
      ];
      const p = PLATS[Math.floor(Math.random() * PLATS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🍽️ ${p.plat} — ${p.pays}`)
        .setDescription(p.desc)] });
    }
  },
  {
    name: 'prix_nobel',
    aliases: ['nobel', 'prix_science'],
    description: 'Catégories et faits sur le Prix Nobel',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const NOBELS = [
        "Le **Prix Nobel** a été créé par Alfred Nobel, inventeur de la dynamite, en 1895.",
        "Il y a **6 catégories Nobel** : Physique, Chimie, Médecine, Littérature, Paix, Économie.",
        "**Marie Curie** est la seule personne à avoir reçu deux Prix Nobel dans deux sciences différentes (Physique 1903 et Chimie 1911).",
        "**Nelson Mandela** a reçu le Prix Nobel de la Paix en 1993, avec Frederik de Klerk.",
        "**Albert Einstein** a reçu le Nobel de Physique en 1921... pour l'effet photoélectrique, pas la relativité.",
        "La **Malala Yousafzai** (Pakistan) est la plus jeune lauréate : 17 ans en 2014 (Paix).",
      ];
      const n = NOBELS[Math.floor(Math.random() * NOBELS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏅 Prix Nobel')
        .setDescription(n)] });
    }
  },
  {
    name: 'invention',
    aliases: ['inventeur', 'decouverte', 'inventer'],
    description: 'Qui a inventé ça ?',
    category: 'Culture générale',
    cooldown: 5,
    async execute(message, args) {
      const INVENTIONS = [
        { objet:'Internet', inventeur:'Vint Cerf & Bob Kahn (1973-1983) pour TCP/IP. Tim Berners-Lee pour le World Wide Web (1989).' },
        { objet:'Téléphone', inventeur:'Alexander Graham Bell (1876) — mais Elisha Gray a déposé le même jour !' },
        { objet:'Ampoule électrique', inventeur:'Thomas Edison (1879), bien qu\'Humphry Davy ait créé la première lumière électrique en 1802.' },
        { objet:'Avion', inventeur:'Frères Wright (1903) — premier vol motorisé contrôlé.' },
        { objet:'Imprimerie', inventeur:'Johannes Gutenberg (vers 1440) — Bible de Gutenberg en 1450.' },
        { objet:'Vaccin', inventeur:'Edward Jenner (1796) — premier vaccin contre la variole.' },
        { objet:'Pénicilline', inventeur:'Alexander Fleming (1928) — découverte accidentelle.' },
        { objet:'Dynamite', inventeur:'Alfred Nobel (1867) — fondateur du Prix Nobel.' },
      ];
      const i = INVENTIONS[Math.floor(Math.random() * INVENTIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`💡 Qui a inventé : ${i.objet} ?`)
        .setDescription(i.inventeur)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
