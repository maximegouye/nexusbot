/**
 * NexusBot — Devinettes et énigmes (prefix)
 * n!devinette, n!enigme, n!charade, n!logique, n!rebus...
 */
const { EmbedBuilder } = require('discord.js');

const DEVINETTES = [
  { q:"J'ai des mains mais pas de doigts. Qui suis-je ?", r:"Une montre / Une horloge" },
  { q:"Plus je sèche, plus je suis mouillée. Qui suis-je ?", r:"Une serviette" },
  { q:"Je parle sans bouche, j'entends sans oreilles. Qui suis-je ?", r:"Un écho" },
  { q:"Je pèse la même chose que du vide mais je suis là. Qui suis-je ?", r:"Le silence" },
  { q:"J'ai des villes, mais pas de maisons. Des forêts, mais pas d'arbres. De l'eau mais pas de poissons. Qu'est-ce que je suis ?", r:"Une carte" },
  { q:"Je vole sans ailes, je coule sans eau. Qui suis-je ?", r:"Le temps" },
  { q:"Plus tu m'enlèves, plus je suis grande. Qu'est-ce que je suis ?", r:"Un trou" },
  { q:"J'ai deux mains, une face et pas de jambes. Pourtant je cours. Qu'est-ce que je suis ?", r:"Une montre" },
  { q:"On me jette quand on en a besoin, et on me reprend quand on n'en a plus besoin. Qu'est-ce que je suis ?", r:"Une ancre" },
  { q:"Quel est l'animal dont la tête est du côté de la queue ?", r:"Un chat enroulé en boule" },
  { q:"Qu'est-ce qui a 4 roues et des mouches ?", r:"Un camion-poubelle" },
  { q:"Quelle est la différence entre une pie et un ordinateur ?", r:"L'ordinateur a de la mémoire mais pas de plumes." },
  { q:"Je suis plein de trous mais je retiens l'eau. Qu'est-ce que je suis ?", r:"Une éponge" },
  { q:"Qu'est-ce qu'on trouve au milieu de Paris ?", r:"La lettre 'a'" },
  { q:"Blanc je suis utile, rouge je suis dangereux, noir je suis inutile. Qu'est-ce que je suis ?", r:"Du charbon / Un feu" },
];

const ENIGMES = [
  { q:"Un homme est sorti par une porte en verre, il est tombé de 30 étages et il est vivant. Comment est-ce possible ?", r:"Il est sorti au rez-de-chaussée." },
  { q:"Un père et son fils ont un accident. Le père meurt. Le fils est amené aux urgences. Le chirurgien dit : 'Je ne peux pas opérer, c'est mon fils.' Comment est-ce possible ?", r:"Le chirurgien est la mère du garçon." },
  { q:"Qu'est-ce qu'un père peut faire et que son fils ne peut pas encore faire ?", r:"Avoir un fils." },
  { q:"Vous êtes dans une pièce avec une bougie, une cheminée et un poêle. Vous n'avez qu'une allumette. Qu'allumez-vous en premier ?", r:"L'allumette." },
  { q:"Un coq pond un œuf au sommet d'un toit. De quel côté va tomber l'œuf ?", r:"Les coqs ne pondent pas d'œufs." },
  { q:"Vous avez 3 pommes et vous en prenez 2. Combien en avez-vous ?", r:"2 — celles que vous avez prises." },
  { q:"Quelle est la question à laquelle on ne peut jamais répondre 'oui' ?", r:"'Êtes-vous endormi(e) ?'" },
  { q:"Un homme habite au 30ème étage. Chaque matin il prend l'ascenseur jusqu'au rez-de-chaussée. Le soir, il monte jusqu'au 15ème et marche jusqu'au 30ème. Pourquoi ?", r:"Il est trop petit pour atteindre le bouton 30." },
];

const CHARADES = [
  { q:"Mon premier est un métal précieux.\nMon second est une note de musique.\nMon tout est une belle femme dans la mythologie.", r:"**Or + Si = Orsi** → une Sirène ?" , real:"Mon premier = OR (métal), Mon second = SI (note), Mon tout = ORSI(s)" },
  { q:"Mon premier est la 5ème lettre de l'alphabet.\nMon deuxième est une boisson chaude.\nMon tout est un sentiment.", r:"E + THÉ = ÉTHÉ... non → **Peur** ? Think: Empoter..." },
  { q:"Mon premier est un article féminin.\nMon deuxième est une boisson gazeuse.\nMon tout est un groupe de musique.", r:"LA + CO → **LACOLA** — Cherche encore !" },
  { q:"Mon premier est la couleur du ciel.\nMon deuxième est une planète.\nMon tout est un instrument de musique.", r:"BLEU + MARS = BLEU + (... MARS) → piste : pensez à 'clarinette'" },
];

const LOGIQUE = [
  { q:"Si 5 machines mettent 5 minutes à faire 5 pièces, combien de temps mettent 100 machines à faire 100 pièces ?", r:"**5 minutes** — chaque machine fait 1 pièce en 5 min." },
  { q:"Une brique pèse 1kg plus la moitié d'une brique. Combien pèse la brique ?", r:"**2 kg** — (x = 1 + x/2 → x/2 = 1 → x = 2)" },
  { q:"Il y a 6 œufs dans un panier. 6 personnes en prennent chacune un. Il reste encore 1 œuf dans le panier. Comment ?", r:"La 6ème personne a pris le panier avec l'œuf dedans." },
  { q:"Quel mot français commence par 'IN' et finit par 'IN', qui a 3 lettres et contient le mot PAIN ?", r:"**Impunité** ? Non — **LAPIN** — il commence par LA... Réponse : LAPIN contient PAIN !", real:"LAPIN (L-A-P-I-N) contient PAIN" },
  { q:"Jean regarde une photo. Il dit : 'Les frères et sœurs de cet homme, je n'en ai aucun. Mais le père de cet homme est le fils de mon père.' Qui regarde Jean ?", r:"Jean regarde sa propre photo." },
];

const commands = [
  {
    name: 'devinette',
    aliases: ['deviner', 'devine', 'quiz_dev'],
    description: 'Devinette aléatoire (réponse en spoiler)',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const d = DEVINETTES[Math.floor(Math.random() * DEVINETTES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🧩 Devinette !')
        .setDescription(`**${d.q}**\n\n||**Réponse :** ${d.r}||`)
        .setFooter({ text: 'Clique sur le spoiler pour voir la réponse !' })] });
    }
  },
  {
    name: 'enigme',
    aliases: ['enigma', 'mystere', 'puzzle'],
    description: 'Énigme logique aléatoire',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const e = ENIGMES[Math.floor(Math.random() * ENIGMES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle('🔍 Énigme !')
        .setDescription(`**${e.q}**\n\n||**Solution :** ${e.r}||`)
        .setFooter({ text: 'Réfléchis bien avant de voir la réponse !' })] });
    }
  },
  {
    name: 'logique',
    aliases: ['puzzlelogic', 'cerveau', 'brain'],
    description: 'Puzzle de logique avec solution',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const l = LOGIQUE[Math.floor(Math.random() * LOGIQUE.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('🧠 Puzzle logique')
        .setDescription(`**${l.q}**\n\n||**Réponse :** ${l.r}||`)] });
    }
  },
  {
    name: 'charade',
    aliases: ['char_ade', 'jeu_mots'],
    description: 'Charade classique',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const c = CHARADES[Math.floor(Math.random() * CHARADES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('🎭 Charade')
        .setDescription(`${c.q}\n\n||**Réponse :** ${c.r}||`)] });
    }
  },
  {
    name: 'test_qi',
    aliases: ['iq_test', 'qi', 'intelligence'],
    description: 'Mini test de QI en une question',
    category: 'Énigmes',
    cooldown: 10,
    async run(message, args) {
      const QI_TESTS = [
        { q:"Complétez la suite : 2, 4, 8, 16, 32, ___", r:"64 (×2 à chaque fois)" },
        { q:"Quel est le nombre qui manque ? 3, 6, 9, 12, ___, 18", r:"15 (multiples de 3)" },
        { q:"Une horloge affiche 3h15. Quel angle (degrés) y a-t-il entre les aiguilles ?", r:"7,5° (l'aiguille des heures est à 3h15, soit entre le 3 et le 4, à 97,5°, et les minutes sont à 90°, différence = 7,5°)" },
        { q:"Quelle lettre vient ensuite ? A, C, E, G, ___", r:"I (consonnes en sautant une lettre : A+2=C+2=E+2=G+2=I)" },
        { q:"Si ORANGE = 6 lettres, et BANANE = 6, que vaut CITRON ?", r:"6 (CITRON a 6 lettres)" },
      ];
      const t = QI_TESTS[Math.floor(Math.random() * QI_TESTS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('🧪 Mini Test QI')
        .setDescription(`**${t.q}**\n\n||**Réponse :** ${t.r}||`)
        .setFooter({ text: 'Essaie avant de regarder la réponse !' })] });
    }
  },
  {
    name: 'blague',
    aliases: ['joke', 'humour', 'lol', 'blagounette'],
    description: 'Blague aléatoire',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const BLAGUES = [
        { setup:"Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ?", punchline:"Parce que sinon ils tomberaient dans le bateau !" },
        { setup:"Qu'est-ce qu'un canif ?", punchline:"Le petit frère du canif... wait, le petit frère du caniveau ! (CANIF = petite lame, jeu de mots avec 'caniveau')" },
        { setup:"Qu'est-ce que deux gazelles ?", punchline:"Des jumelles !" },
        { setup:"Un homme entre dans une bibliothèque et dit : 'Un steak frites et une bière !'", punchline:"Le bibliothécaire répond : 'Monsieur, ici c'est une bibliothèque !' L'homme chuchote : 'Pardon. Un steak frites et une bière...'" },
        { setup:"Pourquoi les fantômes sont-ils mauvais menteurs ?", punchline:"Parce qu'on voit à travers eux !" },
        { setup:"Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ?", punchline:"Un chat-peint de Noël !" },
        { setup:"Qu'est-ce qu'une vache tremblante ?", punchline:"Un milk-shake !" },
      ];
      const b = BLAGUES[Math.floor(Math.random() * BLAGUES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle('😂 Blague')
        .addFields(
          { name: '🤔 Question', value: b.setup, inline: false },
          { name: '😄 Réponse', value: `||${b.punchline}||`, inline: false },
        )] });
    }
  },
  {
    name: 'vrai_faux',
    aliases: ['true_false', 'vf', 'affirm'],
    description: 'Vrai ou faux ? Testez vos connaissances',
    category: 'Énigmes',
    cooldown: 5,
    async run(message, args) {
      const VF = [
        { q:"Les chauves-souris sont aveugles.", r:false, exp:"FAUX — Elles voient très bien, elles utilisent EN PLUS l'écholocation." },
        { q:"La Grande Muraille de Chine est visible depuis l'espace.", r:false, exp:"FAUX — C'est un mythe. Elle est trop étroite (~5m) pour être visible depuis l'orbite." },
        { q:"Le Soleil est une étoile jaune.", r:false, exp:"FAUX — Le Soleil est une étoile blanche. Il nous semble jaune en raison de l'atmosphère." },
        { q:"Napoleon Bonaparte était de petite taille.", r:false, exp:"FAUX — Il mesurait 1m68, légèrement au-dessus de la moyenne de son époque." },
        { q:"Les diamants sont la matière la plus dure connue.", r:false, exp:"FAUX — La wurtzite de boron et le lonsdaleite seraient plus durs en théorie." },
        { q:"L'eau bout toujours à 100°C.", r:false, exp:"FAUX — Elle bout à 100°C à pression atmosphérique standard. En altitude, elle bout à moins." },
        { q:"Les humains et les chimpanzés partagent 98.7% de leur ADN.", r:true, exp:"VRAI — Et 85% avec la souris, 60% avec la banane !" },
      ];
      const v = VF[Math.floor(Math.random() * VF.length)];
      const label = v.r ? '✅ VRAI' : '❌ FAUX';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('✅❌ Vrai ou Faux ?')
        .setDescription(`**"${v.q}"**\n\n||**Réponse : ${label}**\n${v.exp}||`)] });
    }
  },
  {
    name: 'reponse_magique',
    aliases: ['boule_magique', 'ask8', 'magic8'],
    description: 'Pose une question, la boule magique répond',
    category: 'Énigmes',
    cooldown: 3,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Pose une question ! Ex: `n!reponse_magique Vais-je réussir mon examen ?`');
      const REP = [
        "🟢 Oui, absolument !",
        "🟢 C'est certain.",
        "🟢 Sans aucun doute !",
        "🟡 Cela me paraît bien.",
        "🟡 Les signes sont favorables.",
        "🟡 Très probablement.",
        "🟡 Concentre-toi et réessaie.",
        "🔴 Pas sûr(e)...",
        "🔴 Les perspectives ne sont pas bonnes.",
        "🔴 Ne compte pas dessus.",
        "🔴 C'est non.",
      ];
      const r = REP[Math.floor(Math.random() * REP.length)];
      const question = args.join(' ');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1A1A2E')
        .setTitle('🔮 Boule Magique')
        .addFields(
          { name: '❓ Question', value: question, inline: false },
          { name: '🔮 Réponse', value: `**${r}**`, inline: false },
        )] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
