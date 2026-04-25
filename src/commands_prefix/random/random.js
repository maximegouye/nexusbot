/**
 * NexusBot — Générateurs aléatoires (prefix)
 * n!couleur, n!nombre, n!mot, n!choix, n!lancer, n!token, n!pseudo, n!pile, n!des, n!tarot...
 */
const { EmbedBuilder } = require('discord.js');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomHex() { return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase(); }
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[randInt(0, chars.length - 1)]).join('');
}

const MOTS_FR = ['soleil','nuage','rivière','montagne','forêt','plage','étoile','lune','feu','vent','pluie','neige','tempête','océan','désert','fleur','arbre','rocher','colline','vallée','château','village','jardin','chemin','pont','lac','source','grotte','île','cascade'];
const PSEUDOS_ADJ = ['Rapide','Sombre','Brillant','Mystérieux','Calme','Sauvage','Vif','Ancien','Sage','Courageux','Furtif','Légendaire'];
const PSEUDOS_NOM = ['Loup','Aigle','Tigre','Dragon','Serpent','Renard','Corbeau','Phénix','Lion','Ours','Faucon','Requin'];
const TAROT = ['🃏 Le Mat','I Le Bateleur','II La Papesse','III L\'Impératrice','IV L\'Empereur','V Le Pape','VI L\'Amoureux','VII Le Chariot','VIII La Justice','IX L\'Ermite','X La Roue','XI La Force','XII Le Pendu','XIII La Mort','XIV La Tempérance','XV Le Diable','XVI La Maison-Dieu','XVII L\'Étoile','XVIII La Lune','XIX Le Soleil','XX Le Jugement','XXI Le Monde'];
const PAYS = ['France','Japon','Brésil','Australie','Canada','Inde','Mexique','Italie','Allemagne','Espagne','Corée','Maroc','Sénégal','Pérou','Norvège','Thaïlande','Argentine','Turquie','Pologne','Égypte'];
const METIERS = ['Architecte','Médecin','Pilote','Cuisinier','Ingénieur','Artiste','Écrivain','Musicien','Astronaute','Détective','Botaniste','Archéologue','Plombier','Vétérinaire','Physicien'];

const commands = [
  {
    name: 'couleur_alea',
    aliases: ['randomcolor', 'couleur_rand', 'rcolor'],
    description: 'Générer une couleur aléatoire',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const hex = randomHex();
      const { r, g, b } = hexToRgb(hex);
      return message.reply({ embeds: [new EmbedBuilder().setColor(hex)
        .setTitle('🎨 Couleur aléatoire')
        .addFields(
          { name: 'HEX', value: `\`${hex}\``, inline: true },
          { name: 'RGB', value: `\`rgb(${r}, ${g}, ${b})\``, inline: true },
        )
        .setDescription('Voici votre couleur du moment !')] });
    }
  },
  {
    name: 'nombre_alea',
    aliases: ['randnum', 'rnum', 'nombre_rand'],
    description: 'Nombre aléatoire entre min et max',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const min = parseInt(args[0]) || 1;
      const max = parseInt(args[1]) || 100;
      if (min >= max) return message.reply('❌ Usage : `n!nombre_alea <min> <max>`');
      return message.reply(`🎲 Nombre aléatoire entre **${min}** et **${max}** : **${randInt(min, max)}**`);
    }
  },
  {
    name: 'choix_alea',
    aliases: ['choisir', 'pick', 'orpick'],
    description: 'Choisir aléatoirement parmi des options',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!choix_alea option1 option2 option3...`');
      const choice = args[Math.floor(Math.random() * args.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('🎯 Mon choix')
        .setDescription(`Parmi \`${args.join(' | ')}\`\n\n→ **${choice}**`)] });
    }
  },
  {
    // Renommé pour éviter conflit avec commands_prefix/games/des_prefix.js (jeu casino),
    name: 'lancer',
    aliases: ['roll', 'lancer_de', 'jetdes'],
    description: 'Lancer des dés aléatoires (ex: 2d6, 1d20)',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const notation = args[0] || '1d6';
      const match = notation.match(/^(\d+)d(\d+)$/i);
      if (!match) return message.reply('❌ Usage : `n!des <NdF>` ex: `n!des 2d6`, `n!des 1d20`');
      const n = Math.min(20, parseInt(match[1]));
      const faces = Math.min(1000, parseInt(match[2]));
      if (faces < 2) return message.reply('❌ Le dé doit avoir au moins 2 faces.');
      const rolls = Array.from({ length: n }, () => randInt(1, faces));
      const total = rolls.reduce((s, v) => s + v, 0);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`🎲 ${n}d${faces}`)
        .addFields(
          { name: '🎯 Résultats', value: rolls.join(', '), inline: false },
          { name: '➕ Total', value: `**${total}**`, inline: true },
          { name: '📊 Moyenne', value: `${(total / n).toFixed(2)}`, inline: true },
        )] });
    }
  },
  {
    name: 'pile_face',
    aliases: ['coinflip', 'pf', 'tirage'],
    description: 'Pile ou face',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const result = Math.random() < 0.5 ? '🟡 PILE' : '⚪ FACE';
      return message.reply(`Résultat du lancer : **${result}** !`);
    }
  },
  {
    name: 'mot_alea',
    aliases: ['randword', 'motrand', 'word_rand'],
    description: 'Mot français aléatoire',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const word = MOTS_FR[Math.floor(Math.random() * MOTS_FR.length)];
      return message.reply(`📚 Mot aléatoire : **${word}**`);
    }
  },
  {
    name: 'pseudo_alea',
    aliases: ['username', 'pseudorand', 'genname'],
    description: 'Générer un pseudo aléatoire',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const adj = PSEUDOS_ADJ[Math.floor(Math.random() * PSEUDOS_ADJ.length)];
      const nom = PSEUDOS_NOM[Math.floor(Math.random() * PSEUDOS_NOM.length)];
      const num = randInt(1, 9999);
      return message.reply(`🏷️ Pseudo généré : **${adj}${nom}${num}**`);
    }
  },
  {
    name: 'token',
    aliases: ['gentoken', 'secret', 'password_gen'],
    description: 'Générer un token/mot de passe sécurisé',
    category: 'Aléatoire',
    cooldown: 3,
    async execute(message, args) {
      const length = Math.min(64, Math.max(8, parseInt(args[0]) || 32));
      const token = generateToken(length);
      try {
        await message.author.send(`🔑 Token généré (${length} chars) : \`${token}\``);
        return message.reply('🔐 Token envoyé en message privé pour sécurité !');
      } catch {
        return message.reply({ content: `🔑 Token : \`${token}\``, ephemeral: false });
      }
    }
  },
  {
    name: 'tarot',
    aliases: ['carte_tarot', 'oracle'],
    description: 'Tirer une carte de tarot au hasard',
    category: 'Aléatoire',
    cooldown: 5,
    async execute(message, args) {
      const card = TAROT[Math.floor(Math.random() * TAROT.length)];
      const MEANINGS = ['Nouveau départ', 'Réflexion nécessaire', 'Transformation', 'Abondance', 'Voyage imminent', 'Décision importante', 'Surprise positive', 'Attention aux obstacles'];
      const meaning = MEANINGS[Math.floor(Math.random() * MEANINGS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle('🔮 Tirage de tarot')
        .addFields(
          { name: '🃏 Carte', value: `**${card}**`, inline: true },
          { name: '✨ Message', value: meaning, inline: true },
        )] });
    }
  },
  {
    name: 'pays_alea',
    aliases: ['randcountry', 'paysrand'],
    description: 'Pays aléatoire',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const pays = PAYS[Math.floor(Math.random() * PAYS.length)];
      return message.reply(`🌍 Pays aléatoire : **${pays}**`);
    }
  },
  {
    name: 'metier_alea',
    aliases: ['job', 'profession', 'randmetier'],
    description: 'Métier aléatoire',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const m = METIERS[Math.floor(Math.random() * METIERS.length)];
      return message.reply(`💼 Métier aléatoire : **${m}**`);
    }
  },
  {
    name: 'couleur_rgb',
    aliases: ['rgb', 'genrgb'],
    description: 'Générer des valeurs RGB aléatoires',
    category: 'Aléatoire',
    cooldown: 2,
    async execute(message, args) {
      const r = randInt(0, 255), g = randInt(0, 255), b = randInt(0, 255);
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      return message.reply({ embeds: [new EmbedBuilder().setColor(hex)
        .setDescription(`🎨 **RGB(${r}, ${g}, ${b})** = HEX \`${hex}\``)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
