/**
 * NexusBot — Commandes de roleplay (prefix)
 * n!action, n!emote, n!me, n!scene, n!char...
 */
const { EmbedBuilder } = require('discord.js');

const ACTIONS = {
  gifle:    { verb: 'gifle',       emoji: '👋', targets: true },
  calin:    { verb: 'fait un câlin à', emoji: '🤗', targets: true },
  bisou:    { verb: 'fait un bisou à', emoji: '😘', targets: true },
  frappe:   { verb: 'frappe',      emoji: '👊', targets: true },
  poke:     { verb: 'pousse du doigt', emoji: '👉', targets: true },
  embrasse: { verb: 'embrasse',    emoji: '💋', targets: true },
  pleurer:  { verb: 'pleure',      emoji: '😢', targets: false },
  rire:     { verb: 'rit aux éclats', emoji: '😂', targets: false },
  dormir:   { verb: 's\'endort',   emoji: '😴', targets: false },
  danser:   { verb: 'danse',       emoji: '💃', targets: false },
  chanter:  { verb: 'chante',      emoji: '🎤', targets: false },
  crier:    { verb: 'crie de joie',emoji: '🗣️', targets: false },
  courir:   { verb: 's\'enfuit en courant', emoji: '🏃', targets: false },
  sauter:   { verb: 'saute de partout', emoji: '🦘', targets: false },
};

const commands = [
  // — Commandes d'action RP —
  ...Object.entries(ACTIONS).map(([name, action]) => ({
    name,
    aliases: [name.substring(0, 3)],
    description: `RP: ${action.verb}`,
    category: 'Roleplay',
    cooldown: 3,
    async execute(message, args) {
      const target = action.targets
        ? (message.mentions.users.first() || (args[0] ? { username: args[0] } : null))
        : null;
      const actor = message.member?.displayName || message.author.username;

      let desc;
      if (action.targets && !target) {
        desc = `*${actor} ${action.verb} dans le vide…*`;
      } else if (action.targets) {
        const tName = target.username || target.displayName || target;
        desc = `*${actor} ${action.verb} ${tName}* ${action.emoji}`;
      } else {
        desc = `*${actor} ${action.verb}* ${action.emoji}`;
      }

      return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4').setDescription(desc)] });
    }
  })),

  // — /me (action en RP tiers) —
  {
    name: 'me',
    aliases: ['action', 'do'],
    description: 'Effectuer une action RP personnalisée',
    category: 'Roleplay',
    cooldown: 3,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!me <action>`');
      const actor = message.member?.displayName || message.author.username;
      const action = args.join(' ');
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [new EmbedBuilder().setColor('#FF69B4').setDescription(`*${actor} ${action}*`)] });
    }
  },

  // — /say (parler comme un personnage) —
  {
    name: 'say',
    aliases: ['parler', 'dire'],
    description: 'Dire quelque chose en RP',
    category: 'Roleplay',
    cooldown: 3,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!say <texte>`');
      const actor = message.member?.displayName || message.author.username;
      const text = args.join(' ');
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [new EmbedBuilder().setColor('#9B59B6').setDescription(`💬 **${actor}** : *"${text}"*`)] });
    }
  },

  // — /scene (décrire une scène) —
  {
    name: 'scene',
    aliases: ['scenario', 'decor'],
    description: 'Décrire une scène RP',
    category: 'Roleplay',
    cooldown: 5,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!scene <description>`');
      const text = args.join(' ');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2C3E50').setTitle('🎬 Nouvelle scène')
        .setDescription(`*${text}*`)
        .setFooter({ text: `Scène établie par ${message.author.username}` })
      ]});
    }
  },

  // — /rp (lancer une session RP) —
  {
    name: 'rp',
    aliases: ['roleplay', 'jdr'],
    description: 'Lancer une session de roleplay',
    category: 'Roleplay',
    cooldown: 10,
    async execute(message, args) {
      const theme = args.join(' ') || 'Aventure libre';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD').setTitle('🎭 Session RP ouverte !')
        .setDescription(`**Thème :** ${theme}\n\nTous les membres peuvent participer ! Utilisez \`n!me <action>\` ou \`n!say <texte>\` pour interagir.`)
        .setFooter({ text: `Session lancée par ${message.author.username}` })
      ]});
    }
  },

  // — /char (définir un personnage) —
  {
    name: 'char',
    aliases: ['perso', 'personnage'],
    description: 'Définir votre personnage RP',
    category: 'Roleplay',
    cooldown: 5,
    async execute(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!char <nom> [description]`');
      const name = args[0];
      const desc = args.slice(1).join(' ') || 'Mystérieux personnage sans description.';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle(`🎭 Personnage : ${name}`)
        .setDescription(desc)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      ]});
    }
  },

  // — /tableau (afficher un tableau de score RP) —
  {
    name: 'tableau',
    aliases: ['score_rp', 'rpboard'],
    description: 'Afficher un tableau de jeu RP',
    category: 'Roleplay',
    cooldown: 5,
    async execute(message, args) {
      const title = args.join(' ') || 'Tableau de jeu';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`📋 ${title}`)
        .setDescription('*(Tableau vide — complétez avec les règles de votre RP)*')
        .setFooter({ text: `Créé par ${message.author.username}` })
      ]});
    }
  },

  // — /whisper (message secret à un membre) —
  {
    name: 'whisper',
    aliases: ['chuchoter', 'murmurer'],
    description: 'Chuchoter un message à un membre en RP',
    category: 'Roleplay',
    cooldown: 5,
    async execute(message, args) {
      const target = message.mentions.users.first();
      if (!target || args.length < 2) return message.reply('❌ Usage : `n!whisper @membre <message>`');
      const text = args.slice(1).join(' ');
      const actor = message.member?.displayName || message.author.username;
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [new EmbedBuilder().setColor('#95A5A6')
        .setDescription(`🤫 *${actor} chuchote à ${target.username} : "**${text}**"*`)
      ]});
    }
  },
];

const __isMulti = true;
module.exports = commands.map(cmd => ({ ...cmd, __isMulti: true }));
module.exports.__isMulti = true;
