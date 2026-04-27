/**
 * NexusBot — Actions de Roleplay Sociales
 * /rp — Exprimez-vous avec des actions animées et des interactions sociales !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS rp_stats (
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    action    TEXT NOT NULL,
    count     INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, guild_id, action)
  )`).run();
} catch {}

const ACTIONS = {
  // Affection
  calin:     { emoji: '🤗', template: '**{user}** fait un gros câlin à **{target}** !',           gif: 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',         needsTarget: true  },
  bisou:     { emoji: '😘', template: '**{user}** donne un bisou à **{target}** !',               gif: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',         needsTarget: true  },
  serremain: { emoji: '🤝', template: '**{user}** serre la main de **{target}** !',               gif: 'https://media.giphy.com/media/TbYgHMnICI1A4/giphy.gif',         needsTarget: true  },
  highfive:  { emoji: '🖐️',template: '**{user}** tape dans la main de **{target}** ! High five !', gif: 'https://media.giphy.com/media/doJrCO8kCAgNq/giphy.gif',       needsTarget: true  },
  // Fun
  gifle:     { emoji: '👋', template: '**{user}** gifle **{target}** ! Aïe !',                    gif: 'https://media.giphy.com/media/Zau0yrl17uhdK/giphy.gif',         needsTarget: true  },
  poke:      { emoji: '👉', template: '**{user}** taquine **{target}** avec un petit doigt !',    gif: 'https://media.giphy.com/media/WvVzZ9mCyMjsc/giphy.gif',         needsTarget: true  },
  chatouille:{ emoji: '😂', template: '**{user}** chatouille **{target}** sans pitié !',          gif: 'https://media.giphy.com/media/IsB6PGhOkMNyM/giphy.gif',         needsTarget: true  },
  mordre:    { emoji: '😬', template: '**{user}** mord **{target}** ! Miam ?',                    gif: 'https://media.giphy.com/media/z8rEcJ6I0hiUM/giphy.gif',         needsTarget: true  },
  // Solo
  danser:    { emoji: '💃', template: '**{user}** se met à danser !',                             gif: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',    needsTarget: false },
  pleurer:   { emoji: '😭', template: '**{user}** se met à pleurer...',                           gif: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',         needsTarget: false },
  rire:      { emoji: '😂', template: '**{user}** éclate de rire !',                              gif: 'https://media.giphy.com/media/ZqlvCTNHpqrio/giphy.gif',         needsTarget: false },
  dormir:    { emoji: '😴', template: '**{user}** s\'endort sur le clavier... zzZ',               gif: 'https://media.giphy.com/media/sfmflgJiLpJN6/giphy.gif',         needsTarget: false },
  manger:    { emoji: '🍔', template: '**{user}** commence à manger avec appétit !',              gif: 'https://media.giphy.com/media/3oEjHULqCmHt3wGGhO/giphy.gif',   needsTarget: false },
  courir:    { emoji: '🏃', template: '**{user}** part en courant à toute vitesse !',             gif: 'https://media.giphy.com/media/LJLG5dOBkGWVG/giphy.gif',         needsTarget: false },
  penser:    { emoji: '🤔', template: '**{user}** se gratte la tête et réfléchit intensément...', gif: 'https://media.giphy.com/media/a5viI92PAF89q/giphy.gif',         needsTarget: false },
  winner:    { emoji: '🏆', template: '**{user}** fait la danse de la victoire !',                gif: 'https://media.giphy.com/media/lMameLIF8voLu8HxWV/giphy.gif',    needsTarget: false },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rp')
    .setDescription('🎭 Actions de roleplay et interactions sociales')
    .addSubcommand(s => s.setName('calin')
      .setDescription('🤗 Faire un câlin à quelqu\'un').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('bisou')
      .setDescription('😘 Donner un bisou').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('serremain')
      .setDescription('🤝 Serrer la main').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('highfive')
      .setDescription('🖐️ Taper dans la main').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('gifle')
      .setDescription('👋 Donner une gifle').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('poke')
      .setDescription('👉 Taquiner quelqu\'un').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('chatouille')
      .setDescription('😂 Chatouiller quelqu\'un').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('mordre')
      .setDescription('😬 Mordre quelqu\'un').addUserOption(o => o.setName('membre').setDescription('Cible').setRequired(true)))
    .addSubcommand(s => s.setName('danser').setDescription('💃 Se mettre à danser'))
    .addSubcommand(s => s.setName('pleurer').setDescription('😭 Pleurer'))
    .addSubcommand(s => s.setName('rire').setDescription('😂 Éclater de rire'))
    .addSubcommand(s => s.setName('dormir').setDescription('😴 S\'endormir'))
    .addSubcommand(s => s.setName('manger').setDescription('🍔 Manger'))
    .addSubcommand(s => s.setName('courir').setDescription('🏃 Courir'))
    .addSubcommand(s => s.setName('penser').setDescription('🤔 Réfléchir'))
    .addSubcommand(s => s.setName('winner').setDescription('🏆 Danse de la victoire'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir tes stats de roleplay')),

  cooldown: 3,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (sub === 'stats') {
      const stats = db.db.prepare('SELECT action, count FROM rp_stats WHERE user_id=? AND guild_id=? ORDER BY count DESC LIMIT 10').all(userId, guildId);
      if (!stats.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune action RP effectuée.')], ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(`🎭 Tes Stats de Roleplay — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setDescription(stats.map(s => {
          const action = ACTIONS[s.action];
          return `${action?.emoji || '🎭'} **${s.action}** : ${s.count} fois`;
        }).join('\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    const action = ACTIONS[sub];
    if (!action) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Action inconnue.', ephemeral: true });

    let target = null;
    if (action.needsTarget) {
      target = interaction.options.getUser('membre');
      if (!target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu dois mentionner une personne !', ephemeral: true });
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas faire ça à toi-même !', ephemeral: true });
    }

    // Mise à jour des stats
    db.db.prepare(`INSERT INTO rp_stats (user_id, guild_id, action, count) VALUES (?,?,?,1)
      ON CONFLICT(user_id, guild_id, action) DO UPDATE SET count = count + 1`).run(userId, guildId, sub);

    const text = action.template
      .replace('{user}', interaction.user.username)
      .replace('{target}', target?.username || '');

    const embed = new EmbedBuilder()
      .setColor('#9b59b6')
      .setDescription(text)
      .setImage(action.gif)
      .setFooter({ text: `${interaction.user.username} • /rp ${sub}` });

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
