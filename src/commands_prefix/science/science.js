/**
 * NexusBot — Science et nature (prefix)
 * n!element, n!planete, n!loi, n!atome, n!formule, n!constante, n!age_univers...
 */
const { EmbedBuilder } = require('discord.js');

const ELEMENTS = {
  h:  { name:'Hydrogène',    symbol:'H',  num:1,   masse:'1.008', categorie:'Non-métal', etat:'Gaz' },
  he: { name:'Hélium',       symbol:'He', num:2,   masse:'4.003', categorie:'Gaz noble', etat:'Gaz' },
  li: { name:'Lithium',      symbol:'Li', num:3,   masse:'6.941', categorie:'Métal alcalin', etat:'Solide' },
  c:  { name:'Carbone',      symbol:'C',  num:6,   masse:'12.011',categorie:'Non-métal', etat:'Solide' },
  n:  { name:'Azote',        symbol:'N',  num:7,   masse:'14.007',categorie:'Non-métal', etat:'Gaz' },
  o:  { name:'Oxygène',      symbol:'O',  num:8,   masse:'15.999',categorie:'Non-métal', etat:'Gaz' },
  na: { name:'Sodium',       symbol:'Na', num:11,  masse:'22.990',categorie:'Métal alcalin', etat:'Solide' },
  mg: { name:'Magnésium',    symbol:'Mg', num:12,  masse:'24.305',categorie:'Métal alcalino-terreux', etat:'Solide' },
  al: { name:'Aluminium',    symbol:'Al', num:13,  masse:'26.982',categorie:'Métal', etat:'Solide' },
  si: { name:'Silicium',     symbol:'Si', num:14,  masse:'28.086',categorie:'Métalloïde', etat:'Solide' },
  fe: { name:'Fer',          symbol:'Fe', num:26,  masse:'55.845',categorie:'Métal de transition', etat:'Solide' },
  cu: { name:'Cuivre',       symbol:'Cu', num:29,  masse:'63.546',categorie:'Métal de transition', etat:'Solide' },
  au: { name:'Or',           symbol:'Au', num:79,  masse:'196.97',categorie:'Métal de transition', etat:'Solide' },
  ag: { name:'Argent',       symbol:'Ag', num:47,  masse:'107.87',categorie:'Métal de transition', etat:'Solide' },
  pb: { name:'Plomb',        symbol:'Pb', num:82,  masse:'207.2', categorie:'Métal pauvre', etat:'Solide' },
  u:  { name:'Uranium',      symbol:'U',  num:92,  masse:'238.03',categorie:'Actinide', etat:'Solide' },
  hg: { name:'Mercure',      symbol:'Hg', num:80,  masse:'200.59',categorie:'Métal de transition', etat:'Liquide' },
  cl: { name:'Chlore',       symbol:'Cl', num:17,  masse:'35.453',categorie:'Halogène', etat:'Gaz' },
  ca: { name:'Calcium',      symbol:'Ca', num:20,  masse:'40.078',categorie:'Métal alcalino-terreux', etat:'Solide' },
  k:  { name:'Potassium',    symbol:'K',  num:19,  masse:'39.098',categorie:'Métal alcalin', etat:'Solide' },
};

const PLANETES = {
  mercure: { nom:'Mercure',   dist:'57.9M km',  diam:'4 879 km',  periode:'88 jours',   lunes:0,   fait:'Planète la plus proche du Soleil.' },
  venus:   { nom:'Vénus',     dist:'108.2M km', diam:'12 104 km', periode:'225 jours',  lunes:0,   fait:'La plus chaude (462°C en moyenne).' },
  terre:   { nom:'Terre',     dist:'149.6M km', diam:'12 742 km', periode:'365 jours',  lunes:1,   fait:'Seule planète connue à abriter la vie.' },
  mars:    { nom:'Mars',      dist:'227.9M km', diam:'6 779 km',  periode:'687 jours',  lunes:2,   fait:'Possède le plus grand volcan du système solaire.' },
  jupiter: { nom:'Jupiter',   dist:'778.5M km', diam:'139 820 km',periode:'11.9 ans',   lunes:95,  fait:'La plus grande planète du système solaire.' },
  saturne: { nom:'Saturne',   dist:'1.43B km',  diam:'116 460 km',periode:'29.5 ans',   lunes:146, fait:'Ses anneaux font 400 000 km de diamètre.' },
  uranus:  { nom:'Uranus',    dist:'2.87B km',  diam:'50 724 km', periode:'84 ans',     lunes:27,  fait:'Tourne sur le côté (axe incliné à 98°).' },
  neptune: { nom:'Neptune',   dist:'4.5B km',   diam:'49 244 km', periode:'165 ans',    lunes:16,  fait:'Vents les plus rapides du système solaire.' },
};

const CONSTANTES = [
  { name:'Vitesse de la lumière', symbol:'c', value:'299 792 458 m/s', domain:'Physique' },
  { name:'Constante de Planck', symbol:'h', value:'6.626×10⁻³⁴ J·s', domain:'Physique quantique' },
  { name:'Constante gravitationnelle', symbol:'G', value:'6.674×10⁻¹¹ N·m²/kg²', domain:'Gravitation' },
  { name:'Nombre d\'Avogadro', symbol:'Nₐ', value:'6.022×10²³ mol⁻¹', domain:'Chimie' },
  { name:'Constante des gaz parfaits', symbol:'R', value:'8.314 J/(mol·K)', domain:'Thermodynamique' },
  { name:'Charge de l\'électron', symbol:'e', value:'1.602×10⁻¹⁹ C', domain:'Électromagnétisme' },
  { name:'Masse de l\'électron', symbol:'mₑ', value:'9.109×10⁻³¹ kg', domain:'Physique atomique' },
  { name:'Pi', symbol:'π', value:'3.14159265358979...', domain:'Mathématiques' },
  { name:'Nombre d\'or', symbol:'φ', value:'1.61803398874989...', domain:'Mathématiques' },
  { name:'Constante d\'Euler', symbol:'e', value:'2.71828182845904...', domain:'Mathématiques' },
];

const LOIS = [
  { name:"Loi de Newton (F=ma)", desc:"La force = masse × accélération. La base de la mécanique classique.", formule:"F = m·a" },
  { name:"Loi de la gravitation universelle", desc:"Attraction entre deux masses.", formule:"F = G·m₁·m₂/r²" },
  { name:"Loi d'Ohm", desc:"Tension = intensité × résistance.", formule:"U = R·I" },
  { name:"E=mc²", desc:"L'énergie est égale à la masse fois la vitesse de la lumière au carré.", formule:"E = m·c²" },
  { name:"Loi de Boyle-Mariotte", desc:"Pour un gaz parfait isotherme : P·V = constante.", formule:"P·V = cste" },
  { name:"Théorème de Pythagore", desc:"Dans un triangle rectangle : a² + b² = c².", formule:"a² + b² = c²" },
  { name:"Loi de Coulomb", desc:"Force entre deux charges électriques.", formule:"F = k·q₁·q₂/r²" },
  { name:"Première loi de la thermodynamique", desc:"Conservation de l'énergie : dU = Q + W.", formule:"ΔU = Q + W" },
];

const commands = [
  {
    name: 'element',
    aliases: ['elem', 'tableau_periodique', 'atome'],
    description: 'Infos sur un élément chimique',
    category: 'Sciences',
    cooldown: 3,
    async run(message, args) {
      const key = args[0]?.toLowerCase();
      if (!key) return message.reply(`❌ Usage : \`n!element <symbole>\` — Disponibles : ${Object.keys(ELEMENTS).join(', ')}`);
      const el = ELEMENTS[key] || Object.values(ELEMENTS).find(e => e.name.toLowerCase() === key || e.symbol.toLowerCase() === key);
      if (!el) return message.reply(`❌ Élément "${key}" introuvable. Essayez : ${Object.keys(ELEMENTS).slice(0,5).join(', ')}...`);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`⚗️ ${el.symbol} — ${el.name}`)
        .addFields(
          { name: '🔢 Numéro atomique', value: el.num.toString(), inline: true },
          { name: '⚖️ Masse atomique', value: el.masse, inline: true },
          { name: '🏷️ Catégorie', value: el.categorie, inline: true },
          { name: '🌡️ État (ambiant)', value: el.etat, inline: true },
        )] });
    }
  },
  {
    name: 'planete',
    aliases: ['planet', 'astre'],
    description: 'Infos sur une planète du système solaire',
    category: 'Sciences',
    cooldown: 3,
    async run(message, args) {
      const key = args[0]?.toLowerCase();
      if (!key || !PLANETES[key]) return message.reply(`❌ Usage : \`n!planete <nom>\` — Disponibles : ${Object.keys(PLANETES).join(', ')}`);
      const p = PLANETES[key];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🪐 ${p.nom}`)
        .addFields(
          { name: '📏 Distance du Soleil', value: p.dist, inline: true },
          { name: '🔵 Diamètre', value: p.diam, inline: true },
          { name: '⏱️ Période orbitale', value: p.periode, inline: true },
          { name: '🌙 Lunes', value: p.lunes.toString(), inline: true },
          { name: '💡 Fun fact', value: p.fait, inline: false },
        )] });
    }
  },
  {
    name: 'constante',
    aliases: ['const', 'physique'],
    description: 'Constante physique ou mathématique',
    category: 'Sciences',
    cooldown: 3,
    async run(message, args) {
      const c = CONSTANTES[Math.floor(Math.random() * CONSTANTES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle(`🔬 ${c.name}`)
        .addFields(
          { name: '📐 Symbole', value: c.symbol, inline: true },
          { name: '📊 Valeur', value: `\`${c.value}\``, inline: true },
          { name: '🏫 Domaine', value: c.domain, inline: true },
        )] });
    }
  },
  {
    name: 'loi',
    aliases: ['loi_physique', 'formule', 'lois'],
    description: 'Loi ou formule physique/mathématique',
    category: 'Sciences',
    cooldown: 3,
    async run(message, args) {
      const l = LOIS[Math.floor(Math.random() * LOIS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`📐 ${l.name}`)
        .addFields(
          { name: '🔢 Formule', value: `\`${l.formule}\``, inline: true },
          { name: '📖 Description', value: l.desc, inline: false },
        )] });
    }
  },
  {
    name: 'age_univers',
    aliases: ['univers', 'cosmos', 'bigbang'],
    description: 'Faits sur l\'âge et la taille de l\'univers',
    category: 'Sciences',
    cooldown: 5,
    async run(message, args) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
        .setTitle('🌌 L\'Univers en chiffres')
        .addFields(
          { name: '⏱️ Âge', value: '**13,8 milliards d\'années**', inline: true },
          { name: '📏 Diamètre observable', value: '**93 milliards d\'années-lumière**', inline: true },
          { name: '⭐ Étoiles estimées', value: '**~2×10²³**', inline: true },
          { name: '🌌 Galaxies', value: '**~2 000 milliards**', inline: true },
          { name: '💡 Fun fact', value: 'Nous sommes constitués des mêmes atomes que les étoiles mortes.', inline: false },
        )] });
    }
  },
  {
    name: 'corps_humain',
    aliases: ['anatomie', 'humain', 'biologie'],
    description: 'Faits sur le corps humain',
    category: 'Sciences',
    cooldown: 5,
    async run(message, args) {
      const FAITS = [
        "Le corps humain contient environ **37 000 milliards de cellules**.",
        "Le cerveau humain consomme **20% de l'énergie** du corps pour 2% de sa masse.",
        "L'ADN humain déplié mesurerait **environ 2 mètres** par cellule, soit ~70 milliards de km en tout.",
        "Le cœur bat environ **100 000 fois par jour** et pompe 7 500 litres de sang.",
        "Le corps humain possède **206 os** et plus de **600 muscles**.",
        "Les poumons contiennent environ **300 millions d'alvéoles** avec une surface totale de ~70m².",
        "La peau est l'organe le plus grand du corps : elle pèse entre **3,5 et 10 kg**.",
      ];
      const f = FAITS[Math.floor(Math.random() * FAITS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('🫀 Corps humain — Le savais-tu ?')
        .setDescription(f)] });
    }
  },
  {
    name: 'meteo_science',
    aliases: ['climat', 'atmosphere', 'weather_sci'],
    description: 'Phénomène météo ou atmosphérique expliqué',
    category: 'Sciences',
    cooldown: 5,
    async run(message, args) {
      const PHENO = [
        { name:'Arc-en-ciel', exp:'Réfraction et dispersion de la lumière dans les gouttes d\'eau. Longueurs d\'onde séparées de 400nm (violet) à 700nm (rouge).'},
        { name:'Foudre', exp:'Décharge électrostatique entre nuages et sol. Température : ~30 000 K (5x plus chaud que le soleil !).'},
        { name:'Aurore boréale', exp:'Particules solaires excitent les atomes d\'oxygène et d\'azote dans la haute atmosphère.'},
        { name:'Tornade', exp:'Colonne d\'air en rotation reliant nuage et sol. Peut atteindre 500 km/h.'},
        { name:'Tsunami', exp:'Onde océanique déclenchée par un tremblement de terre sous-marin ou une éruption volcanique.'},
      ];
      const p = PHENO[Math.floor(Math.random() * PHENO.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#5DADE2')
        .setTitle(`🌤️ ${p.name}`)
        .setDescription(p.exp)] });
    }
  },
  {
    name: 'tech_fait',
    aliases: ['tech', 'informatique', 'it_fact'],
    description: 'Fait technologique ou informatique insolite',
    category: 'Sciences',
    cooldown: 5,
    async run(message, args) {
      const FACTS = [
        "Le premier ordinateur pesait **27 tonnes** et occupait une pièce entière (ENIAC, 1945).",
        "L'erreur **404** vient du numéro de bureau au CERN où était stocké le World Wide Web original.",
        "Le premier email a été envoyé en **1971** par Ray Tomlinson — il ne se souvient plus du contenu.",
        "Il y a plus de **5 milliards** d'internautes dans le monde (2024).",
        "Google traite plus de **8,5 milliards** de recherches par jour.",
        "Le code source du premier jeu vidéo (Tennis for Two, 1958) est perdu.",
        "L'iPhone original (2007) avait **128MB de RAM** — soit 1/32 000ème d'un iPhone moderne.",
      ];
      const f = FACTS[Math.floor(Math.random() * FACTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2C3E50')
        .setTitle('💻 Fait technologique')
        .setDescription(f)] });
    }
  },
  {
    name: 'chimie',
    aliases: ['reaction', 'molecule', 'compose'],
    description: 'Molécule ou réaction chimique courante',
    category: 'Sciences',
    cooldown: 5,
    async run(message, args) {
      const MOLS = [
        { name:'Eau', formula:'H₂O', desc:'Indispensable à la vie. Polaire, solvant universel. Ebullition : 100°C.' },
        { name:'Dioxyde de carbone', formula:'CO₂', desc:'Gaz à effet de serre. Produit de la respiration et des combustions.' },
        { name:'Sel de table', formula:'NaCl', desc:'Chlorure de sodium. Forme des cristaux cubiques. 2,6g/L dans le sang.' },
        { name:'Glucosé', formula:'C₆H₁₂O₆', desc:'Source d\'énergie principale des cellules. Carburant du cerveau.' },
        { name:'Ammoniaque', formula:'NH₃', desc:'Composé azotés, base de nombreux engrais. Odeur très forte.' },
        { name:'Méthane', formula:'CH₄', desc:'Principal composant du gaz naturel. Gaz à effet de serre puissant.' },
        { name:'Acide chlorhydrique', formula:'HCl', desc:'Acide fort présent dans le suc gastrique de l\'estomac.' },
      ];
      const m = MOLS[Math.floor(Math.random() * MOLS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#27AE60')
        .setTitle(`⚗️ ${m.name} (${m.formula})`)
        .setDescription(m.desc)] });
    }
  },
  {
    name: 'energie',
    aliases: ['physique_energie', 'joule', 'watt'],
    description: 'Conversion et infos sur les unités d\'énergie',
    category: 'Sciences',
    cooldown: 3,
    async run(message, args) {
      const val = parseFloat(args[0]);
      const unit = args[1]?.toLowerCase();
      if (!isNaN(val) && unit === 'kwh') {
        const joules = val * 3.6e6;
        const calories = val * 860420;
        return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
          .setTitle(`⚡ ${val} kWh`)
          .addFields(
            { name: 'En Joules', value: `${joules.toExponential(3)} J`, inline: true },
            { name: 'En kcal', value: `${(calories/1000).toFixed(0)} kcal`, inline: true },
          )] });
      }
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle('⚡ Unités d\'énergie')
        .addFields(
          { name: '1 kWh', value: '3 600 000 J', inline: true },
          { name: '1 kcal', value: '4 184 J', inline: true },
          { name: '1 eV', value: '1.6×10⁻¹⁹ J', inline: true },
          { name: 'Usage', value: '`n!energie <valeur> kwh` pour convertir', inline: false },
        )] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
