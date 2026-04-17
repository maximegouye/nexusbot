/**
 * NexusBot — Géographie mondiale (prefix)
 * n!capitale_quiz, n!frontiere, n!superficie, n!population, n!drapeau_quiz, n!ocean...
 */
const { EmbedBuilder } = require('discord.js');

const PAYS_DATA = [
  { nom:'France', capitale:'Paris', superficie:'551 695 km²', pop:'67.4M', continent:'Europe', monnaie:'Euro (€)', langue:'Français', drapeau:'🇫🇷' },
  { nom:'Allemagne', capitale:'Berlin', superficie:'357 386 km²', pop:'83.8M', continent:'Europe', monnaie:'Euro (€)', langue:'Allemand', drapeau:'🇩🇪' },
  { nom:'Japon', capitale:'Tokyo', superficie:'377 915 km²', pop:'125.7M', continent:'Asie', monnaie:'Yen (¥)', langue:'Japonais', drapeau:'🇯🇵' },
  { nom:'Brésil', capitale:'Brasília', superficie:'8 515 767 km²', pop:'215M', continent:'Amérique du Sud', monnaie:'Réal (R$)', langue:'Portugais', drapeau:'🇧🇷' },
  { nom:'Canada', capitale:'Ottawa', superficie:'9 984 670 km²', pop:'38.2M', continent:'Amérique du Nord', monnaie:'Dollar CAD', langue:'Anglais/Français', drapeau:'🇨🇦' },
  { nom:'Maroc', capitale:'Rabat', superficie:'710 850 km²', pop:'37.5M', continent:'Afrique', monnaie:'Dirham (MAD)', langue:'Arabe/Berbère/Français', drapeau:'🇲🇦' },
  { nom:'Sénégal', capitale:'Dakar', superficie:'196 722 km²', pop:'17.2M', continent:'Afrique', monnaie:'Franc CFA (XOF)', langue:'Français/Wolof', drapeau:'🇸🇳' },
  { nom:'Nigeria', capitale:'Abuja', superficie:'923 768 km²', pop:'220M', continent:'Afrique', monnaie:'Naira (NGN)', langue:'Anglais/Haoussa/Igbo/Yoruba', drapeau:'🇳🇬' },
  { nom:'Russie', capitale:'Moscou', superficie:'17 098 242 km²', pop:'145M', continent:'Europe/Asie', monnaie:'Rouble (RUB)', langue:'Russe', drapeau:'🇷🇺' },
  { nom:'Australie', capitale:'Canberra', superficie:'7 692 024 km²', pop:'26M', continent:'Océanie', monnaie:'Dollar AUD', langue:'Anglais', drapeau:'🇦🇺' },
  { nom:'Inde', capitale:'New Delhi', superficie:'3 287 263 km²', pop:'1.4Mrd', continent:'Asie', monnaie:'Roupie (INR)', langue:'Hindi/Anglais', drapeau:'🇮🇳' },
  { nom:'Mexique', capitale:'Mexico', superficie:'1 964 375 km²', pop:'130M', continent:'Amérique du Nord', monnaie:'Peso (MXN)', langue:'Espagnol', drapeau:'🇲🇽' },
  { nom:'Égypte', capitale:'Le Caire', superficie:'1 001 449 km²', pop:'104M', continent:'Afrique', monnaie:'Livre égyptienne (EGP)', langue:'Arabe', drapeau:'🇪🇬' },
  { nom:'Turquie', capitale:'Ankara', superficie:'783 356 km²', pop:'84M', continent:'Europe/Asie', monnaie:'Livre turque (TRY)', langue:'Turc', drapeau:'🇹🇷' },
  { nom:'Côte d\'Ivoire', capitale:'Yamoussoukro', superficie:'322 462 km²', pop:'27M', continent:'Afrique', monnaie:'Franc CFA (XOF)', langue:'Français', drapeau:'🇨🇮' },
];

const OCEANS = [
  { name:'Pacifique', superficie:'165.2M km²', profondeur:'4 188m (moy)', point_max:'Fosse des Mariannes : -11 034m', fait:'Plus grand océan : 46% de l\'eau de la Terre.' },
  { name:'Atlantique', superficie:'106.5M km²', profondeur:'3 332m (moy)', point_max:'Fosse de Milwaukee : -8 376m', fait:'Le plus salé. Sépare les Amériques de l\'Europe/Afrique.' },
  { name:'Indien', superficie:'70.6M km²', profondeur:'3 840m (moy)', point_max:'Fosse Java : -7 187m', fait:'Le plus chaud. Riche en biodiversité (récifs coralliens).' },
  { name:'Arctique', superficie:'14.1M km²', profondeur:'1 205m (moy)', point_max:'-5 567m', fait:'Le plus petit et le moins profond. Couvert de glace en hiver.' },
  { name:'Austral/Antarctique', superficie:'21.9M km²', profondeur:'3 270m (moy)', point_max:'Fosse des îles Sandwich du Sud : -8 264m', fait:'Ajouté officiellement en 2000. Entoure l\'Antarctique.' },
];

const MONTAGNES = [
  { name:'Everest', altitude:'8 848.86 m', pays:'Népal/Chine', chaine:'Himalaya', fait:'Plus haute montagne du monde. Première ascension : Hillary & Tensing, 1953.' },
  { name:'K2', altitude:'8 611 m', pays:'Pakistan/Chine', chaine:'Karakoram', fait:'2ème plus haute. Considérée la plus difficile à grimper.' },
  { name:'Mont Blanc', altitude:'4 808 m', pays:'France/Italie', chaine:'Alpes', fait:'Plus haute montagne d\'Europe occidentale.' },
  { name:'Kilimandjaro', altitude:'5 895 m', pays:'Tanzanie', chaine:'Isolée', fait:'Plus haute montagne d\'Afrique. Volcan endormi.' },
  { name:'Mont Fuji', altitude:'3 776 m', pays:'Japon', chaine:'Isolée', fait:'Symbole national du Japon. Volcan actif endormi depuis 1707.' },
  { name:'Aconcagua', altitude:'6 961 m', pays:'Argentine', chaine:'Andes', fait:'Plus haute montagne des Amériques.' },
];

const FLEUVES = [
  { name:'Nil', longueur:'6 650 km', continent:'Afrique', pays:'Ouganda→Soudan→Égypte', fait:'Considéré le plus long. Alimentait la civilisation égyptienne antique.' },
  { name:'Amazone', longueur:'6 400 km', continent:'Amérique du Sud', pays:'Pérou→Brésil', fait:'Le plus grand débit d\'eau au monde. Bassin de 7 millions km².' },
  { name:'Yangtsé', longueur:'6 300 km', continent:'Asie', pays:'Chine', fait:'Le plus long fleuve d\'Asie. Barrage des Trois Gorges dessus.' },
  { name:'Mississippi', longueur:'3 730 km', continent:'Amérique du Nord', pays:'États-Unis', fait:'Avec le Missouri : 6 275 km. "Old Man River".' },
  { name:'Congo', longueur:'4 700 km', continent:'Afrique', pays:'RDC/Congo', fait:'2ème débit mondial. Plus profond fleuve du monde (220m).' },
  { name:'Loire', longueur:'1 013 km', continent:'Europe', pays:'France', fait:'Le plus long fleuve de France. Source en Ardèche.' },
];

const FUSEAUX_QUIZ = [
  { ville:'Paris', utc:'UTC+1 (été : UTC+2)', pays:'France' },
  { ville:'New York', utc:'UTC-5 (été : UTC-4)', pays:'États-Unis' },
  { ville:'Tokyo', utc:'UTC+9', pays:'Japon' },
  { ville:'Sydney', utc:'UTC+10 (été : UTC+11)', pays:'Australie' },
  { ville:'Dubai', utc:'UTC+4', pays:'Émirats arabes unis' },
  { ville:'Dakar', utc:'UTC+0', pays:'Sénégal' },
  { ville:'São Paulo', utc:'UTC-3', pays:'Brésil' },
];

const commands = [
  {
    name: 'pays_info',
    aliases: ['pinfo', 'infopays', 'country_info'],
    description: 'Informations complètes sur un pays',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      if (!args.length) return message.reply(`❌ Usage : \`n!pays_info <pays>\` — Ex: france, japon, maroc, senegal...`);
      const search = args.join(' ').toLowerCase();
      const pays = PAYS_DATA.find(p => p.nom.toLowerCase().includes(search) || p.capitale.toLowerCase().includes(search));
      if (!pays) return message.reply(`❌ Pays non trouvé. Essayez : ${PAYS_DATA.map(p=>p.nom).slice(0,5).join(', ')}...`);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`${pays.drapeau} ${pays.nom}`)
        .addFields(
          { name: '🏛️ Capitale', value: pays.capitale, inline: true },
          { name: '🌍 Continent', value: pays.continent, inline: true },
          { name: '👥 Population', value: pays.pop, inline: true },
          { name: '📏 Superficie', value: pays.superficie, inline: true },
          { name: '💰 Monnaie', value: pays.monnaie, inline: true },
          { name: '🗣️ Langue(s)', value: pays.langue, inline: true },
        )] });
    }
  },
  {
    name: 'ocean',
    aliases: ['oceans', 'mer_info', 'ocean_info'],
    description: 'Informations sur les océans du monde',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const o = OCEANS[Math.floor(Math.random() * OCEANS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2980B9')
        .setTitle(`🌊 Océan ${o.name}`)
        .addFields(
          { name: '📏 Superficie', value: o.superficie, inline: true },
          { name: '🔵 Profondeur moy.', value: o.profondeur, inline: true },
          { name: '⬇️ Point le plus profond', value: o.point_max, inline: false },
          { name: '💡 Fait', value: o.fait, inline: false },
        )] });
    }
  },
  {
    name: 'montagne',
    aliases: ['montagne_info', 'sommet', 'altitude'],
    description: 'Informations sur les grandes montagnes',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const m = MONTAGNES[Math.floor(Math.random() * MONTAGNES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8B4513')
        .setTitle(`⛰️ ${m.name}`)
        .addFields(
          { name: '📏 Altitude', value: m.altitude, inline: true },
          { name: '🌍 Pays', value: m.pays, inline: true },
          { name: '⛰️ Chaîne', value: m.chaine, inline: true },
          { name: '💡 Fait', value: m.fait, inline: false },
        )] });
    }
  },
  {
    name: 'fleuve',
    aliases: ['fleuves', 'riviere', 'fleuve_info'],
    description: 'Informations sur les grands fleuves du monde',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const f = FLEUVES[Math.floor(Math.random() * FLEUVES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#27AE60')
        .setTitle(`🌊 Fleuve : ${f.name}`)
        .addFields(
          { name: '📏 Longueur', value: f.longueur, inline: true },
          { name: '🌍 Continent', value: f.continent, inline: true },
          { name: '🗺️ Parcours', value: f.pays, inline: false },
          { name: '💡 Fait', value: f.fait, inline: false },
        )] });
    }
  },
  {
    name: 'continent',
    aliases: ['continents', 'cont'],
    description: 'Infos sur les continents du monde',
    category: 'Géographie',
    cooldown: 5,
    async execute(message, args) {
      const CONTS = [
        { name:'Asie', superficie:'44.6M km²', pop:'4.7 milliards', pays:48, fait:'Plus grand et plus peuplé. Everest, Sibérie, désert d\'Arabie.' },
        { name:'Afrique', superficie:'30.4M km²', pop:'1.4 milliard', pays:54, fait:'Berceau de l\'humanité. Sahara, Nil, Congo, Kilimandjaro.' },
        { name:'Amérique du Nord', superficie:'24.7M km²', pop:'600M', pays:23, fait:'Inclut les États-Unis, Canada, Mexique, Caraïbes.' },
        { name:'Amérique du Sud', superficie:'17.8M km²', pop:'435M', pays:12, fait:'Amazonie, Andes, forêts tropicales. Brésil = 50% du continent.' },
        { name:'Antarctique', superficie:'14M km²', pop:'~5000 (chercheurs)', pays:0, fait:'Continent le plus froid. 90% des réserves de glace douce mondiales.' },
        { name:'Europe', superficie:'10.5M km²', pop:'748M', pays:44, fait:'Plus densément peuplé. Berceau de la démocratie, Renaissance, industrialisation.' },
        { name:'Océanie', superficie:'8.5M km²', pop:'43M', pays:14, fait:'Australie = 80% du continent. Îles du Pacifique, Nouvelle-Zélande, PNG.' },
      ];
      const c = CONTS[Math.floor(Math.random() * CONTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🌍 ${c.name}`)
        .addFields(
          { name: '📏 Superficie', value: c.superficie, inline: true },
          { name: '👥 Population', value: c.pop, inline: true },
          { name: '🌐 Pays', value: c.pays.toString(), inline: true },
          { name: '💡 Fait', value: c.fait, inline: false },
        )] });
    }
  },
  {
    name: 'frontiere',
    aliases: ['frontieres', 'voisins', 'pays_voisins'],
    description: 'Pays voisins d\'un pays',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const VOISINS = {
        france: 'Espagne, Andorre, Monaco, Italie, Suisse, Allemagne, Luxembourg, Belgique',
        maroc: 'Algérie, Mauritanie (+ Sahara occidental)',
        senegal: 'Mauritanie, Mali, Guinée, Guinée-Bissau, Gambie',
        nigeria: 'Bénin, Niger, Tchad, Cameroun',
        algerie: 'Maroc, Mauritanie, Mali, Niger, Libye, Tunisie',
        allemagne: 'France, Luxembourg, Belgique, Pays-Bas, Danemark, Pologne, Tchéquie, Autriche, Suisse',
        russie: 'Norvège, Finlande, Estonie, Lettonie, Lituanie, Pologne, Biélorussie, Ukraine, Géorgie, Azerbaïdjan, Kazakhstan, Chine, Mongolie, Corée du Nord',
      };
      const key = args.join(' ').toLowerCase();
      const v = VOISINS[key] || VOISINS[Object.keys(VOISINS).find(k => k.includes(key.split(' ')[0]))];
      if (!v) return message.reply(`❌ Pays non trouvé. Disponibles : ${Object.keys(VOISINS).join(', ')}`);
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`🗺️ Voisins de ${cap}`)
        .setDescription(v)] });
    }
  },
  {
    name: 'desert',
    aliases: ['deserts', 'desert_info'],
    description: 'Informations sur les grands déserts',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const DESERTS = [
        { name:'Sahara', superficie:'9.2M km²', pays:'11 pays d\'Afrique du Nord', type:'Chaud', fait:'Plus grand désert chaud. Températures : -10°C la nuit à 50°C le jour.' },
        { name:'Antarctique', superficie:'14.2M km²', pays:'Antarctique', type:'Froid (polaire)', fait:'Le plus grand désert du monde ! Moins de 200mm de précipitations/an.' },
        { name:'Arctique', superficie:'13.9M km²', pays:'Pôle Nord', type:'Froid (polaire)', fait:'2ème plus grand désert. Couvert de glace de mer.' },
        { name:'Gobi', superficie:'1.3M km²', pays:'Chine/Mongolie', type:'Froid-tempéré', fait:'Le plus vaste désert d\'Asie. -40°C en hiver.' },
        { name:'Arabie', superficie:'2.3M km²', pays:'Péninsule arabique', type:'Chaud', fait:'Contient le Rub\' al-Khali (Quart Vide) — le plus grand erg du monde.' },
        { name:'Atacama', superficie:'105 000 km²', pays:'Chili/Pérou', type:'Côtier', fait:'Désert le plus aride. Certains secteurs : 0 pluie depuis des décennies.' },
      ];
      const d = DESERTS[Math.floor(Math.random() * DESERTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle(`🏜️ Désert : ${d.name}`)
        .addFields(
          { name: '📏 Superficie', value: d.superficie, inline: true },
          { name: '🌡️ Type', value: d.type, inline: true },
          { name: '🗺️ Localisation', value: d.pays, inline: false },
          { name: '💡 Fait', value: d.fait, inline: false },
        )] });
    }
  },
  {
    name: 'fuseau_horaire',
    aliases: ['timezone_ville', 'utc_ville', 'heure_ville'],
    description: 'Fuseau horaire d\'une grande ville',
    category: 'Géographie',
    cooldown: 3,
    async execute(message, args) {
      const f = FUSEAUX_QUIZ[Math.floor(Math.random() * FUSEAUX_QUIZ.length)];
      return message.reply(`🕐 **${f.ville}** (${f.pays}) est en **${f.utc}**`);
    }
  },
  {
    name: 'geo_quiz',
    aliases: ['quiz_geo', 'test_geo', 'question_geo'],
    description: 'Question quiz de géographie',
    category: 'Géographie',
    cooldown: 5,
    async execute(message, args) {
      const QUIZ = [
        { q:"Quelle est la capitale de l'Australie ?", r:"Canberra (pas Sydney ni Melbourne !)" },
        { q:"Quel pays a le plus grand nombre de lacs du monde ?", r:"Le Canada (plus de 2 millions de lacs)" },
        { q:"Dans quel pays se trouve le Mont Fuji ?", r:"Au Japon" },
        { q:"Quelle est la ville la plus haute du monde ?", r:"La Paz (Bolivie) : 3 640m — ou El Alto à 4 150m" },
        { q:"Quel est le seul pays à partager des frontières avec la France sur 4 continents (avec ses territoires) ?", r:"Le Brésil (Guyane française est en Amérique du Sud)" },
        { q:"Combien de pays se trouvent en Afrique ?", r:"54 pays reconnus" },
        { q:"Quelle est la plus petite mer du monde ?", r:"La mer de Marmara (entre Europe et Asie, en Turquie) : ~11 350 km²" },
      ];
      const q = QUIZ[Math.floor(Math.random() * QUIZ.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('🌍 Quiz Géographie')
        .setDescription(`**${q.q}**\n\n||**Réponse :** ${q.r}||`)] });
    }
  },
  {
    name: 'drapeau',
    aliases: ['flag', 'flags', 'drap'],
    description: 'Deviner le drapeau d\'un pays (quiz)',
    category: 'Géographie',
    cooldown: 5,
    async execute(message, args) {
      const p = PAYS_DATA[Math.floor(Math.random() * PAYS_DATA.length)];
      if (args[0] === 'quiz') {
        // Affiche le drapeau, donne 3 choix
        const wrong = PAYS_DATA.filter(x => x.nom !== p.nom)
          .sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.nom);
        const choices = [...wrong, p.nom].sort(() => Math.random() - 0.5);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
          .setTitle(`🏳️ Quel pays est ce drapeau ? ${p.drapeau}`)
          .setDescription(choices.map((c, i) => `**${['A','B','C','D'][i]}.** ${c}`).join('\n'))
          .setFooter({ text: `Répondez avec la lettre ! (réponse : ||${p.nom}||)` })] });
      }
      return message.reply(`${p.drapeau} Ce drapeau est celui de : ||**${p.nom}**|| (Capitale : ${p.capitale})`);
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
