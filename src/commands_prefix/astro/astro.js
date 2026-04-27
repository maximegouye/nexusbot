/**
 * NexusBot — Astrologie et astronomie (prefix)
 * n!horoscope, n!signe, n!planete_astro, n!constellation, n!compatibilite...
 */
const { EmbedBuilder } = require('discord.js');

const SIGNES = {
  belier:      { dates:'21 mars - 19 avril',   elem:'Feu',     planete:'Mars',    traits:'Courageux, impulsif, leader, énergique.' },
  taureau:     { dates:'20 avril - 20 mai',     elem:'Terre',   planete:'Vénus',   traits:'Patient, sensuel, déterminé, matérialiste.' },
  gemeaux:     { dates:'21 mai - 20 juin',      elem:'Air',     planete:'Mercure', traits:'Adaptable, curieux, communicatif, indécis.' },
  cancer:      { dates:'21 juin - 22 juillet',  elem:'Eau',     planete:'Lune',    traits:'Intuitif, protecteur, émotionnel, nostalgique.' },
  lion:        { dates:'23 juillet - 22 août',  elem:'Feu',     planete:'Soleil',  traits:'Créatif, généreux, théâtral, fier.' },
  vierge:      { dates:'23 août - 22 septembre',elem:'Terre',   planete:'Mercure', traits:'Perfectionniste, analytique, serviable, critique.' },
  balance:     { dates:'23 septembre - 22 octobre', elem:'Air', planete:'Vénus',   traits:'Diplomate, charmant, indécis, équitable.' },
  scorpion:    { dates:'23 octobre - 21 novembre', elem:'Eau',  planete:'Pluton',  traits:'Passionné, mystérieux, intense, jaloux.' },
  sagittaire:  { dates:'22 novembre - 21 décembre', elem:'Feu', planete:'Jupiter', traits:'Aventurier, optimiste, philosophe, imprudent.' },
  capricorne:  { dates:'22 décembre - 19 janvier', elem:'Terre',planete:'Saturne', traits:'Ambitieux, discipliné, prudent, froid.' },
  verseau:     { dates:'20 janvier - 18 février', elem:'Air',   planete:'Uranus',  traits:'Original, humaniste, rebelle, détaché.' },
  poissons:    { dates:'19 février - 20 mars',  elem:'Eau',     planete:'Neptune', traits:'Sensible, intuitif, rêveur, sacrifice.' },
};

const HOROSCOPES_MODELES = [
  "L'énergie de {planete} vous pousse à prendre des risques aujourd'hui. Faites confiance à votre instinct.",
  "Une opportunité inattendue se présente. Votre signe de {elem} vous aide à saisir le moment.",
  "Les astres favorisent la communication. Partagez vos idées avec confiance.",
  "Une période de réflexion s'impose. Tournez-vous vers votre intérieur pour trouver les réponses.",
  "Votre charisme est au maximum aujourd'hui. Les autres sont attirés par votre énergie.",
  "Un défi vous attend mais vos ressources sont suffisantes pour le surmonter.",
  "Les relations interpersonnelles sont à l'honneur. Cultivez vos liens importants.",
  "Financièrement, soyez prudent. Évitez les dépenses impulsives.",
  "La créativité est votre alliée. Exprimez-vous artistiquement.",
  "Une rencontre significative pourrait changer votre perspective.",
];

const CONSTELLATIONS = [
  { name:'Orion', desc:'Visible en hiver dans l\'hémisphère nord. Contient Bételgeuse (épaule) et Rigel (pied). La Nébuleuse d\'Orion est à 1 344 années-lumière.' },
  { name:'Grande Ourse', desc:'La plus connue. Contient l\'astérisme "la Grande Casserole" (7 étoiles). Pointe vers l\'Étoile Polaire.' },
  { name:'Cassiopée', desc:'Forme un W ou M dans le ciel. Visible toute l\'année dans l\'hémisphère nord. Galaxie voisine de la Voie Lactée.' },
  { name:'Scorpion', desc:'Signe du zodiaque. Visible en été. L\'étoile Antarès est une supergéante rouge 700x plus grande que le Soleil.' },
  { name:'Croix du Sud', desc:'Visible depuis l\'hémisphère sud. Représentée sur les drapeaux d\'Australie, Nouvelle-Zélande, Brésil, Papouasie.' },
  { name:'Pégase', desc:'Grand carré de 4 étoiles brillantes. Cheval ailé de la mythologie grecque. Visible en automne.' },
];

const PLANETES_ASTRO = {
  soleil:  { role:'Ego, identité, vitalité, créativité', jour:'Dimanche', metal:'Or', pierre:'Citrine' },
  lune:    { role:'Émotions, instinct, mémoire, féminité', jour:'Lundi', metal:'Argent', pierre:'Perle' },
  mercure: { role:'Communication, intellect, voyages courts', jour:'Mercredi', metal:'Mercure', pierre:'Agate' },
  venus:   { role:'Amour, beauté, valeurs, plaisir', jour:'Vendredi', metal:'Cuivre', pierre:'Émeraude' },
  mars:    { role:'Action, désir, courage, conflits', jour:'Mardi', metal:'Fer', pierre:'Rubis' },
  jupiter: { role:'Expansion, chance, sagesse, philosophie', jour:'Jeudi', metal:'Étain', pierre:'Saphir' },
  saturne: { role:'Discipline, karma, structure, limitation', jour:'Samedi', metal:'Plomb', pierre:'Onyx' },
};

function getSigneFromDate(day, month) {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'belier';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'taureau';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'gemeaux';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'lion';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'vierge';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'balance';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'scorpion';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'sagittaire';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'capricorne';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'verseau';
  return 'poissons';
}

const commands = [
  {
    name: 'horoscope',
    aliases: ['astro', 'signe_du_jour', 'prevision'],
    description: 'Horoscope du jour pour votre signe',
    category: 'Astrologie',
    cooldown: 30,
    async run(message, args) {
      const key = args[0]?.toLowerCase();
      const signes = Object.keys(SIGNES);
      const signe = signes.includes(key) ? key : signes[Math.floor(Math.random() * signes.length)];
      const s = SIGNES[signe];
      const h = HOROSCOPES_MODELES[Math.floor(Math.random() * HOROSCOPES_MODELES.length)]
        .replace('{planete}', s.planete).replace('{elem}', s.elem.toLowerCase());
      const colors = { Feu:'#E74C3C', Terre:'#8B4513', Air:'#87CEEB', Eau:'#3498DB' };
      return message.reply({ embeds: [new EmbedBuilder().setColor(colors[s.elem] || '#9B59B6')
        .setTitle(`✨ Horoscope ${signe.charAt(0).toUpperCase()+signe.slice(1)} — Aujourd'hui`)
        .setDescription(`*${h}*`)
        .addFields(
          { name: '📅 Dates', value: s.dates, inline: true },
          { name: '🌿 Élément', value: s.elem, inline: true },
          { name: '🪐 Planète', value: s.planete, inline: true },
        )
        .setFooter({ text: `Signes : ${signes.join(', ')}` })] });
    }
  },
  {
    name: 'signe',
    aliases: ['mon_signe', 'zsigne', 'quel_signe'],
    description: 'Trouver son signe astrologique depuis sa date de naissance',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      if (!args[0]) return message.reply('❌ Usage : `n!signe <DD/MM>` ex: `n!signe 15/04`');
      const [d, m] = args[0].split('/').map(Number);
      if (!d || !m || d > 31 || m > 12) return message.reply('❌ Format : DD/MM');
      const signe = getSigneFromDate(d, m);
      const s = SIGNES[signe];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`♈ Votre signe : ${signe.charAt(0).toUpperCase()+signe.slice(1)}`)
        .addFields(
          { name: '📅 Dates', value: s.dates, inline: true },
          { name: '🌿 Élément', value: s.elem, inline: true },
          { name: '🪐 Planète', value: s.planete, inline: true },
          { name: '🌟 Traits', value: s.traits, inline: false },
        )] });
    }
  },
  {
    name: 'compatibilite',
    aliases: ['compat', 'compatibilite_astro', 'amour_astro'],
    description: 'Compatibilité astrologique entre deux signes',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      const [s1, s2] = args.map(a => a?.toLowerCase());
      if (!s1 || !s2 || !SIGNES[s1] || !SIGNES[s2]) {
        return message.reply(`❌ Usage : \`n!compatibilite <signe1> <signe2>\` — Signes : ${Object.keys(SIGNES).join(', ')}`);
      }
      const elem1 = SIGNES[s1].elem;
      const elem2 = SIGNES[s2].elem;
      const COMPAT = {
        'Feu-Feu':'🔥🔥 Explosive et passionnée ! Attention à ne pas tout brûler.',
        'Feu-Air':'💨🔥 Excellent ! L\'Air alimente le Feu — harmonie naturelle.',
        'Feu-Eau':'💧🔥 Opposés qui s\'attirent mais se neutralisent souvent.',
        'Feu-Terre':'🌍🔥 Difficile mais possible avec effort mutuel.',
        'Terre-Terre':'🌍🌍 Stabilité et sécurité. Durabilité garantie.',
        'Terre-Eau':'💧🌍 Nourrissante ! L\'Eau fait fleurir la Terre.',
        'Terre-Air':'💨🌍 Complexe. L\'Air peut dessécher la Terre.',
        'Air-Air':'💨💨 Intellectuelle et stimulante. Peut manquer de profondeur.',
        'Air-Eau':'💧💨 Créative et émotionnelle. Équilibre nécessaire.',
        'Eau-Eau':'💧💧 Profonde et intuitive. Risque de noyade émotionnelle.',
      };
      const key = `${elem1}-${elem2}`;
      const keyRev = `${elem2}-${elem1}`;
      const compat = COMPAT[key] || COMPAT[keyRev] || 'Une combinaison unique — construisez votre propre voie !';
      const score = Math.floor(Math.random() * 30) + 60;
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4')
        .setTitle(`💕 Compatibilité : ${s1} × ${s2}`)
        .addFields(
          { name: '🌿 Éléments', value: `${elem1} × ${elem2}`, inline: true },
          { name: '💯 Score', value: `**${score}%**`, inline: true },
          { name: '✨ Verdict', value: compat, inline: false },
        )] });
    }
  },
  {
    name: 'constellation',
    aliases: ['etoiles', 'ciel', 'constel'],
    description: 'Infos sur une constellation',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      const c = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
        .setTitle(`⭐ Constellation : ${c.name}`)
        .setDescription(c.desc)] });
    }
  },
  {
    name: 'planete_astro',
    aliases: ['astro_planete', 'influence'],
    description: 'Influence astrologique d\'une planète',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      const key = args[0]?.toLowerCase();
      const p = key && PLANETES_ASTRO[key] ? PLANETES_ASTRO[key] : PLANETES_ASTRO[Object.keys(PLANETES_ASTRO)[Math.floor(Math.random() * Object.keys(PLANETES_ASTRO).length)]];
      const pNom = key && PLANETES_ASTRO[key] ? key : '(aléatoire)';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle(`🪐 ${pNom.charAt(0).toUpperCase()+pNom.slice(1)}`)
        .addFields(
          { name: '🌟 Rôle', value: p.role, inline: false },
          { name: '📅 Jour', value: p.jour, inline: true },
          { name: '⚙️ Métal', value: p.metal, inline: true },
          { name: '💎 Pierre', value: p.pierre, inline: true },
        )
        .setFooter({ text: `Planètes : ${Object.keys(PLANETES_ASTRO).join(', ')}` })] });
    }
  },
  {
    name: 'ascendant',
    aliases: ['rising', 'asc'],
    description: 'Informations sur l\'ascendant astrologique',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🌅 L\'Ascendant astrologique')
        .setDescription('L\'**ascendant** (ou signe ascendant) est le signe du zodiaque qui se levait à l\'horizon Est au moment exact de votre naissance.\n\nIl représente votre **façade sociale** — comment les autres vous perçoivent au premier abord, votre apparence et vos réactions instinctives.\n\nPour le calculer précisément, il faut :\n• Votre date de naissance\n• Votre heure de naissance\n• Votre lieu de naissance\n\nL\'ascendant change d\'environ 2 heures en 2 heures. Rendez-vous sur un site d\'astrologie pour calculer le vôtre précisément !')
        ] });
    }
  },
  {
    name: 'lune_phase',
    aliases: ['phase_lune', 'moon_phase', 'lune'],
    description: 'Phase de la lune approximative du jour',
    category: 'Astrologie',
    cooldown: 10,
    async run(message, args) {
      // Approximation simple de la phase lunaire
      const now = new Date();
      const lune_ref = new Date(2024, 0, 11); // Nouvelle lune référence
      const diff = (now - lune_ref) / (1000 * 60 * 60 * 24);
      const cycle = 29.53;
      const phase = ((diff % cycle) + cycle) % cycle;
      let phaseName, emoji;
      if (phase < 1.85)      { phaseName = 'Nouvelle Lune';        emoji = '🌑'; }
      else if (phase < 7.38) { phaseName = 'Premier Croissant';    emoji = '🌒'; }
      else if (phase < 9.22) { phaseName = 'Premier Quartier';     emoji = '🌓'; }
      else if (phase < 14.76){ phaseName = 'Lune Gibbeuse Croiss.';emoji = '🌔'; }
      else if (phase < 16.61){ phaseName = 'Pleine Lune';          emoji = '🌕'; }
      else if (phase < 22.15){ phaseName = 'Lune Gibbeuse Décrois.';emoji = '🌖'; }
      else if (phase < 23.99){ phaseName = 'Dernier Quartier';     emoji = '🌗'; }
      else if (phase < 29.53){ phaseName = 'Dernier Croissant';    emoji = '🌘'; }
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
        .setTitle(`${emoji} Phase de Lune`)
        .addFields(
          { name: '🌙 Phase', value: `**${phaseName}**`, inline: true },
          { name: '📅 Jour du cycle', value: `${phase.toFixed(1)} / 29.5`, inline: true },
        )
        .setFooter({ text: 'Calcul approximatif — consultez un calendrier lunaire pour précision' })] });
    }
  },
  {
    name: 'chakra',
    aliases: ['chakras', 'energie_corps'],
    description: 'Informations sur les 7 chakras',
    category: 'Astrologie',
    cooldown: 5,
    async run(message, args) {
      const CHAKRAS = [
        { nom:'Racine (Muladhara)', couleur:'🔴 Rouge', element:'Terre', role:'Sécurité, stabilité, survie' },
        { nom:'Sacré (Svadhisthana)', couleur:'🟠 Orange', element:'Eau', role:'Créativité, sexualité, émotions' },
        { nom:'Plexus Solaire (Manipura)', couleur:'🟡 Jaune', element:'Feu', role:'Confiance, pouvoir personnel, volonté' },
        { nom:'Cœur (Anahata)', couleur:'💚 Vert', element:'Air', role:'Amour, compassion, guérison' },
        { nom:'Gorge (Vishuddha)', couleur:'🔵 Bleu clair', element:'Éther', role:'Communication, expression, vérité' },
        { nom:'Troisième Œil (Ajna)', couleur:'💙 Indigo', element:'Lumière', role:'Intuition, perception, vision' },
        { nom:'Couronne (Sahasrara)', couleur:'💜 Violet/Blanc', element:'Conscience', role:'Spiritualité, éveil, connexion divine' },
      ];
      const c = CHAKRAS[Math.floor(Math.random() * CHAKRAS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🧘 Chakra : ${c.nom}`)
        .addFields(
          { name: '🎨 Couleur', value: c.couleur, inline: true },
          { name: '🌿 Élément', value: c.element, inline: true },
          { name: '✨ Rôle', value: c.role, inline: false },
        )] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
