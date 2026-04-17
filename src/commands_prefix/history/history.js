/**
 * NexusBot — Histoire mondiale (prefix)
 * n!epoque, n!personnage_hist, n!guerre, n!revolution, n!civilisation, n!chronologie...
 */
const { EmbedBuilder } = require('discord.js');

const PERSONNAGES = [
  { name:'Napoléon Bonaparte', dates:'1769-1821', origine:'France (Corse)', role:'Général, Consul, Empereur des Français', fait:'Réforma le droit (Code civil), l\'éducation et l\'administration. Conquit une grande partie de l\'Europe.' },
  { name:'Cléopâtre VII', dates:'69-30 av. J.-C.', origine:'Égypte', role:'Reine d\'Égypte, Pharaon', fait:'Dernière reine d\'Égypte antique. Alliée de Jules César puis Marc Antoine.' },
  { name:'Martin Luther King', dates:'1929-1968', origine:'États-Unis', role:'Pasteur, militant des droits civiques', fait:'"I Have a Dream" (1963). Prix Nobel de la Paix 1964. Assassiné à 39 ans.' },
  { name:'Nelson Mandela', dates:'1918-2013', origine:'Afrique du Sud', role:'Président, militant anti-apartheid', fait:'27 ans de prison. Premier président noir d\'Afrique du Sud (1994-1999). Nobel de la Paix 1993.' },
  { name:'Marie Curie', dates:'1867-1934', origine:'Pologne/France', role:'Scientifique, chercheuse', fait:'Double Nobel : Physique 1903, Chimie 1911. Découverte du polonium et du radium.' },
  { name:'Lénine', dates:'1870-1924', origine:'Russie', role:'Révolutionnaire, chef bolchévique', fait:'Dirigea la Révolution d\'Octobre 1917. Créa l\'URSS. Fondateur du parti bolchévique.' },
  { name:'Gengis Khan', dates:'1162-1227', origine:'Mongolie', role:'Conquérant, fondateur de l\'Empire mongol', fait:'Plus grand empire contigu de l\'histoire. Tué ou déplacé 40 millions de personnes.' },
  { name:'Alexandre le Grand', dates:'356-323 av. J.-C.', origine:'Macédoine', role:'Roi, général conquérant', fait:'Conquit l\'Égypte, la Perse, jusqu\'à l\'Inde. Empire de 5.2M km² à 25 ans.' },
  { name:'Rosa Parks', dates:'1913-2005', origine:'États-Unis', role:'Militante des droits civiques', fait:'Refusa de céder sa place dans un bus à Montgomery (1955) — déclencheur du boycott.' },
  { name:'Shaka Zulu', dates:'1787-1828', origine:'Afrique du Sud', role:'Roi des Zoulous', fait:'Unifia les tribus zoulous et créa un empire militaire puissant en Afrique australe.' },
];

const GUERRES = [
  { name:'Première Guerre mondiale', dates:'1914-1918', combattants:'Triple-Entente vs Triplice', morts:'17-20 millions', fait:'Première guerre industrielle moderne. Tranchées, gaz, chars. Déclenchée par l\'assassinat de Franz Ferdinand.' },
  { name:'Seconde Guerre mondiale', dates:'1939-1945', combattants:'Alliés vs Axe (Allemagne, Italie, Japon)', morts:'70-85 millions', fait:'Plus meurtrière de l\'histoire. Holocauste (6M juifs). Bombes atomiques sur Hiroshima et Nagasaki.' },
  { name:'Guerre de 100 Ans', dates:'1337-1453', combattants:'France vs Angleterre', morts:'~3 millions', fait:'Jeanne d\'Arc joua un rôle clé dans la victoire française. Définit les frontières de la France moderne.' },
  { name:'Guerre du Vietnam', dates:'1955-1975', combattants:'Vietnam du Nord + Viêt Cong vs Vietnam du Sud + USA', morts:'3-4 millions', fait:'Défaite américaine. 58 000 soldats US morts. Naissance du mouvement anti-guerre.' },
  { name:'Guerre de Corée', dates:'1950-1953', combattants:'Corée du Nord + Chine vs Corée du Sud + ONU', morts:'3-5 millions', fait:'Division en Corée du Nord et du Sud au 38ème parallèle. Toujours en armistice.' },
];

const CIVILISATIONS = [
  { name:'Égypte antique', dates:'v. -3100 à -30 av. J.-C.', region:'Afrique du Nord', contributions:'Écriture hiéroglyphique, pyramides, papyrus, astronomie, médecine.', fait:'Dura plus de 3 000 ans — plus longue civilisation de l\'histoire.' },
  { name:'Mésopotamie', dates:'v. -3500 à -539 av. J.-C.', region:'Irak actuel', contributions:'Première écriture (cunéiforme), premières lois (Code Hammurabi), roue, agriculture irriguée.', fait:'Berceau de la civilisation humaine entre le Tigre et l\'Euphrate.' },
  { name:'Grèce antique', dates:'v. -800 à -146 av. J.-C.', region:'Méditerranée', contributions:'Démocratie, philosophie, mathématiques (Pythagore, Euclide), théâtre, Jeux Olympiques.', fait:'L\'Iliade et l\'Odyssée d\'Homère sont parmi les plus anciens textes littéraires.' },
  { name:'Empire romain', dates:'27 av. J.-C. à 476 ap. J.-C.', region:'Europe/Moyen-Orient/Afrique du Nord', contributions:'Droit romain, routes, aqueducs, latin (ancêtre des langues romanes), calendrier.', fait:'À son apogée : 70 millions d\'habitants sur 5 millions km².' },
  { name:'Empire du Mali', dates:'1235-1600', region:'Afrique de l\'Ouest', contributions:'Commerce de l\'or et du sel, université de Tombouctou, Mansa Musa (homme le plus riche de l\'histoire).', fait:'Mansa Musa possédait ~400 milliards $ en valeur actuelle.' },
  { name:'Azimov (Perse)', dates:'v. -550 à -330 av. J.-C.', region:'Iran/Moyen-Orient', contributions:'Premier empire mondial, poste impériale, tolérance religieuse, routes commerciales.', fait:'Cyrus le Grand : premier à proclamer les droits de l\'homme.' },
  { name:'Empire Ottoman', dates:'1299-1922', region:'Moyen-Orient/Europe/Afrique', contributions:'Architecture (Sainte-Sophie), droit, commerce, art calligraphique.', fait:'Dura 624 ans. Inclua 3 continents à son apogée.' },
];

const REVOLUTIONS = [
  { name:'Révolution française', date:'1789-1799', pays:'France', cause:'Inégalités, absolutisme royal, famine', resultat:'Fin de la monarchie absolue, Déclaration des Droits de l\'Homme, Ière République puis Empire.' },
  { name:'Révolution américaine', date:'1775-1783', pays:'États-Unis', cause:'Taxes sans représentation, colonialisme britannique', resultat:'Indépendance des 13 colonies. Déclaration d\'Indépendance (1776). Première démocratie moderne.' },
  { name:'Révolution industrielle', date:'1760-1840', pays:'Angleterre → monde', cause:'Machine à vapeur, charbon, coton', resultat:'Urbanisation massive, capitalisme, prolétariat, chemins de fer, révolution des transports.' },
  { name:'Révolution russe', date:'1917', pays:'Russie', cause:'Défaites militaires, famine, inégalités extrêmes', resultat:'Chute du tsar Nicolas II. Prise du pouvoir par les Bolchéviques. Création de l\'URSS.' },
  { name:'Révolution haïtienne', date:'1791-1804', pays:'Haïti', cause:'Esclavage, colonialisme français', resultat:'Première République noire libre du monde. Seul cas de révolte d\'esclaves victorieuse.' },
];

const commands = [
  {
    name: 'personnage_hist',
    aliases: ['historical_figure', 'hist_perso', 'figure'],
    description: 'Biographie courte d\'un personnage historique',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const search = args.join(' ').toLowerCase();
      let p;
      if (search) {
        p = PERSONNAGES.find(x => x.name.toLowerCase().includes(search));
      }
      if (!p) p = PERSONNAGES[Math.floor(Math.random() * PERSONNAGES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`📜 ${p.name} (${p.dates})`)
        .addFields(
          { name: '🌍 Origine', value: p.origine, inline: true },
          { name: '🏛️ Rôle', value: p.role, inline: true },
          { name: '📖 À retenir', value: p.fait, inline: false },
        )] });
    }
  },
  {
    name: 'guerre',
    aliases: ['guerres', 'conflit', 'war'],
    description: 'Informations sur une guerre historique',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const g = GUERRES[Math.floor(Math.random() * GUERRES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#C0392B')
        .setTitle(`⚔️ ${g.name} (${g.dates})`)
        .addFields(
          { name: '🪖 Belligérants', value: g.combattants, inline: false },
          { name: '💀 Victimes', value: g.morts, inline: true },
          { name: '📖 Contexte', value: g.fait, inline: false },
        )] });
    }
  },
  {
    name: 'civilisation',
    aliases: ['empire', 'civilisations', 'civ'],
    description: 'Informations sur une civilisation ancienne',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const c = CIVILISATIONS[Math.floor(Math.random() * CIVILISATIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🏛️ ${c.name}`)
        .addFields(
          { name: '📅 Période', value: c.dates, inline: true },
          { name: '🌍 Région', value: c.region, inline: true },
          { name: '🏆 Contributions', value: c.contributions, inline: false },
          { name: '💡 Fait', value: c.fait, inline: false },
        )] });
    }
  },
  {
    name: 'revolution',
    aliases: ['revolutions', 'revolte', 'uprising'],
    description: 'Informations sur une révolution historique',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const r = REVOLUTIONS[Math.floor(Math.random() * REVOLUTIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`🔥 ${r.name} (${r.date})`)
        .addFields(
          { name: '📍 Pays', value: r.pays, inline: true },
          { name: '⚡ Cause', value: r.cause, inline: false },
          { name: '🎯 Résultat', value: r.resultat, inline: false },
        )] });
    }
  },
  {
    name: 'chronologie',
    aliases: ['timeline', 'frise_chrono', 'chrono'],
    description: 'Grande chronologie de l\'histoire humaine',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const CHRONO = [
        '🔹 -200 000 ans : Homo sapiens apparaît en Afrique',
        '🔹 -12 000 ans : Révolution néolithique (agriculture)',
        '🔹 -3 500 ans : Premières écritures (Mésopotamie)',
        '🔹 -3 100 : Unification de l\'Égypte',
        '🔹 -776 : Premiers Jeux Olympiques (Grèce)',
        '🔹 -44 : Assassinat de Jules César',
        '🔹 476 : Chute de l\'Empire romain d\'Occident',
        '🔹 622 : Naissance de l\'islam (Hégire)',
        '🔹 1066 : Conquête normande de l\'Angleterre',
        '🔹 1440 : Imprimerie de Gutenberg',
        '🔹 1492 : Christophe Colomb en Amérique',
        '🔹 1789 : Révolution française',
        '🔹 1865 : Abolition de l\'esclavage aux USA',
        '🔹 1945 : Fin de la Seconde Guerre mondiale',
        '🔹 1969 : Homme sur la Lune',
        '🔹 1991 : Dissolution de l\'URSS',
        '🔹 2001 : Attentats du 11 septembre',
        '🔹 2020 : Pandémie COVID-19',
      ];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle('📅 Grande Chronologie de l\'Humanité')
        .setDescription(CHRONO.join('\n'))] });
    }
  },
  {
    name: 'invention_hist',
    aliases: ['invhist', 'invention_historique'],
    description: 'Grande invention qui a changé le monde',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const INVS = [
        { inv:'La roue', date:'~3 500 av. J.-C.', impact:'Révolutionna le transport, l\'agriculture, la poterie et la mécanique.' },
        { inv:'L\'écriture', date:'~3 200 av. J.-C.', impact:'Permis la transmission du savoir, le commerce à grande échelle et l\'histoire.' },
        { inv:'L\'imprimerie', date:'1440 (Gutenberg)', impact:'Démocratisa le savoir. Sans elle, pas de Réforme protestante ni de révolution scientifique.' },
        { inv:'La machine à vapeur', date:'1765 (Watt)', impact:'Déclencha la Révolution industrielle. Transport, usines, mines.' },
        { inv:'L\'électricité (domestique)', date:'1879 (Edison)', impact:'Transforma la vie quotidienne, l\'industrie, les communications.' },
        { inv:'La pénicilline', date:'1928 (Fleming)', impact:'Sauva des centaines de millions de vies. Révolutionna la médecine.' },
        { inv:'Internet', date:'1969 (ARPANET)', impact:'Connecta le monde. Transformation totale des communications, commerce, culture.' },
      ];
      const i = INVS[Math.floor(Math.random() * INVS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle(`💡 Invention : ${i.inv}`)
        .addFields(
          { name: '📅 Date', value: i.date, inline: true },
          { name: '🌍 Impact', value: i.impact, inline: false },
        )] });
    }
  },
  {
    name: 'monument',
    aliases: ['monuments', 'merveille', 'patrimoine'],
    description: 'Informations sur un monument historique',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const MONUMENTS = [
        { name:'Pyramides de Gizeh', pays:'Égypte', date:'~2 560 av. J.-C.', fait:'Seule merveille du monde antique encore debout. Grande pyramide : 2.3M blocs de pierre.' },
        { name:'Colisée de Rome', pays:'Italie', date:'72-80 ap. J.-C.', fait:'50 000 spectateurs. 80 sorties. Utilisé jusqu\'au VIe siècle.' },
        { name:'Taj Mahal', pays:'Inde', date:'1632-1653', fait:'Mausolée en marbre blanc. Construit par Shah Jahan pour son épouse Mumtaz Mahal.' },
        { name:'Grande Muraille de Chine', pays:'Chine', date:'-7e siècle à XVIIe siècle', fait:'21 196 km total. Construite sur 2 000 ans par différentes dynasties.' },
        { name:'Machu Picchu', pays:'Pérou', date:'XVe siècle', fait:'Cité inca à 2 430m d\'altitude. Abandonnée, "redécouverte" en 1911 par Bingham.' },
        { name:'Cathédrale Notre-Dame de Paris', pays:'France', date:'1163-1345', fait:'Chef-d\'œuvre gothique. Incendie en 2019 → reconstruction en cours.' },
        { name:'Stonehenge', pays:'Angleterre', date:'~3 000 av. J.-C.', fait:'But inconnu. Mégalithes de 25 tonnes transportées sur 250 km. Alignement solstice.' },
      ];
      const m = MONUMENTS[Math.floor(Math.random() * MONUMENTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🏛️ ${m.name}`)
        .addFields(
          { name: '🌍 Pays', value: m.pays, inline: true },
          { name: '📅 Période', value: m.date, inline: true },
          { name: '💡 Fait', value: m.fait, inline: false },
        )] });
    }
  },
  {
    name: 'afrique_hist',
    aliases: ['africaine', 'histoire_afrique', 'africa_hist'],
    description: 'Histoire de l\'Afrique — royaumes et empires',
    category: 'Histoire',
    cooldown: 5,
    async execute(message, args) {
      const ROYAUMES = [
        { name:'Empire du Ghana', dates:'300-1200', fait:'Premier grand empire d\'Afrique de l\'Ouest. Commerce de l\'or et du sel. Capitale Koumbi Saleh.' },
        { name:'Empire du Mali', dates:'1235-1600', fait:'Sous Mansa Musa, le Mali était la source de la moitié de l\'or mondial. Timbuktu = centre de savoir.' },
        { name:'Empire Songhaï', dates:'1430-1591', fait:'Succéda au Mali. Askia Mohammed : gran réformateur. Université de Tombouctou (~25 000 étudiants).' },
        { name:'Royaume du Kongo', dates:'1390-1914', fait:'Couvrait Congo, Angola, Gabon. Commerce actif avec l\'Europe. Christianisé au XVe s.' },
        { name:'Empire du Zimbabwe', dates:'1200-1450', fait:'Grande Zimbabwe : cité de pierre sans mortier. Centre commercial de l\'or et de l\'ivoire.' },
        { name:'Royaume d\'Aksoum', dates:'Ier-XIe s.', fait:'Éthiopie et Érythrée. Parmi les premières civilisations chrétiennes. Monnaie propre.' },
        { name:'Royaume d\'Ashanti', dates:'1670-1900', fait:'Ghana actuel. Résista longtemps à la colonisation britannique. Tabouret d\'or = symbole.' },
      ];
      const r = ROYAUMES[Math.floor(Math.random() * ROYAUMES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle(`👑 ${r.name} (${r.dates})`)
        .setDescription(r.fait)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
