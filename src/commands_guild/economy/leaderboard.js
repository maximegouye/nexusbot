// ============================================================
// leaderboard.js — Classement global XP / Coins / Réputation / Pêche
// Emplacement : src/commands_guild/economy/leaderboard.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

const CATEGORIES = {
  coins:      { label: '💰 Richesse', color: '#FFD700', desc: 'Classement par coins en poche + banque' },
  xp:         { label: '⭐ Expérience', color: '#5865F2', desc: 'Classement par points XP' },
  niveau:     { label: '🏆 Niveau',    color: '#57F287', desc: 'Classement par niveau' },
  reputation: { label: '❤️ Réputation', color: '#ED4245', desc: 'Classement par points de réputation' },
  messages:   { label: '💬 Messages',  color: '#EB459E', desc: 'Classement par nombre de messages' },
};

function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

async function getTag(client, userId) {
  try {
    const u = await client.users.fetch(userId);
    return u?.username || userId;
  } catch { return userId; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('classement')
    .setDescription('🏆 Classement du serveur')
    .addStringOption(o => o
      .setName('categorie')
      .setDescription('Catégorie du classement')
      .addChoices(
        { name: '💰 Richesse (coins)',   value: 'coins' },
        { name: '⭐ Expérience (XP)',    value: 'xp' },
        { name: '🏆 Niveau',            value: 'niveau' },
        { name: '❤️ Réputation',        value: 'reputation' },
        { name: '💬 Messages',          value: 'messages' },
      )),

  async execute(interaction) {
    await interaction.deferReply();
    const cat    = interaction.options.getString('categorie') || 'coins';
    const guildId = interaction.guildId;
    const cfg    = db.getConfig ? db.getConfig(guildId) : null;
    const coin   = cfg?.currency_emoji || '🪙';
    const info   = CATEGORIES[cat];

    let rows, valueGetter, valueSuffix;

    if (cat === 'coins') {
      rows = db.db.prepare(
        'SELECT user_id, balance, COALESCE(bank,0) as bank FROM users WHERE guild_id=? ORDER BY (balance + COALESCE(bank,0)) DESC LIMIT 10'
      ).all(guildId);
      valueGetter  = r => r.balance + r.bank;
      valueSuffix  = coin;
    } else if (cat === 'xp') {
      rows = db.db.prepare(
        'SELECT user_id, xp FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT 10'
      ).all(guildId);
      valueGetter  = r => r.xp;
      valueSuffix  = 'XP';
    } else if (cat === 'niveau') {
      rows = db.db.prepare(
        'SELECT user_id, level, xp FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10'
      ).all(guildId);
      valueGetter  = r => r.level;
      valueSuffix  = 'lvl';
    } else if (cat === 'reputation') {
      rows = db.db.prepare(
        'SELECT user_id, reputation FROM users WHERE guild_id=? ORDER BY reputation DESC LIMIT 10'
      ).all(guildId);
      valueGetter  = r => r.reputation || 0;
      valueSuffix  = 'rep';
    } else if (cat === 'messages') {
      rows = db.db.prepare(
        'SELECT user_id, message_count FROM users WHERE guild_id=? ORDER BY message_count DESC LIMIT 10'
      ).all(guildId);
      valueGetter  = r => r.message_count || 0;
      valueSuffix  = 'msgs';
    }

    if (!rows || rows.length === 0) {
      return interaction.editReply({ content: '📭 Aucune donnée disponible pour ce classement.' });
    }

    // Résoudre les pseudos Discord
    const lines = await Promise.all(rows.map(async (r, i) => {
      const username = await getTag(interaction.client, r.user_id);
      const val = valueGetter(r);
      return `${MEDALS[i]} **${username}** — ${fmt(val)} ${valueSuffix}`;
    }));

    // Chercher la position du joueur appelant
    let callerPos = null;
    if (cat === 'coins') {
      const all = db.db.prepare(
        'SELECT user_id FROM users WHERE guild_id=? ORDER BY (balance + COALESCE(bank,0)) DESC'
      ).all(guildId);
      callerPos = all.findIndex(r => r.user_id === interaction.user.id) + 1;
    } else if (cat === 'xp') {
      const all = db.db.prepare('SELECT user_id FROM users WHERE guild_id=? ORDER BY xp DESC').all(guildId);
      callerPos = all.findIndex(r => r.user_id === interaction.user.id) + 1;
    } else if (cat === 'niveau') {
      const all = db.db.prepare('SELECT user_id FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC').all(guildId);
      callerPos = all.findIndex(r => r.user_id === interaction.user.id) + 1;
    } else if (cat === 'reputation') {
      const all = db.db.prepare('SELECT user_id FROM users WHERE guild_id=? ORDER BY reputation DESC').all(guildId);
      callerPos = all.findIndex(r => r.user_id === interaction.user.id) + 1;
    } else if (cat === 'messages') {
      const all = db.db.prepare('SELECT user_id FROM users WHERE guild_id=? ORDER BY message_count DESC').all(guildId);
      callerPos = all.findIndex(r => r.user_id === interaction.user.id) + 1;
    }

    const footer = callerPos > 0
      ? `Votre position : #${callerPos}`
      : 'Vous n\'êtes pas encore dans le classement';

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.label} — Top 10`)
      .setDescription(info.desc + '\n\n' + lines.join('\n'))
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: footer })
      .setTimestamp();

    // Boutons de navigation entre catégories
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lb_coins').setLabel('💰').setStyle(ButtonStyle.Secondary).setDisabled(cat === 'coins'),
      new ButtonBuilder().setCustomId('lb_xp').setLabel('⭐ XP').setStyle(ButtonStyle.Secondary).setDisabled(cat === 'xp'),
      new ButtonBuilder().setCustomId('lb_niveau').setLabel('🏆 Niv').setStyle(ButtonStyle.Secondary).setDisabled(cat === 'niveau'),
      new ButtonBuilder().setCustomId('lb_reputation').setLabel('❤️ Rep').setStyle(ButtonStyle.Secondary).setDisabled(cat === 'reputation'),
      new ButtonBuilder().setCustomId('lb_messages').setLabel('💬 Msgs').setStyle(ButtonStyle.Secondary).setDisabled(cat === 'messages'),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    // Collector navigation
    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('lb_');
    const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

    collector.on('collect', async i => {
      await i.deferUpdate();
      collector.stop();
      const newCat = i.customId.replace('lb_', '');
      // Relancer la commande avec la nouvelle catégorie
      const fakeInteraction = Object.create(interaction);
      fakeInteraction.options = {
        getSubcommand: () => null,
        getString: () => newCat,
      };
      // Appeler execute directement
      await module.exports.execute(Object.assign(Object.create(interaction), {
        options: { getString: () => newCat, getSubcommand: () => null },
        deferReply: async () => {},
        editReply: async (opts) => msg.edit(opts),
        followUp: interaction.followUp.bind(interaction),
        replied: true,
        deferred: true,
        guildId: interaction.guildId,
        guild: interaction.guild,
        user: interaction.user,
        client: interaction.client,
      }));
    });

    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  },

  name: 'classement',
  aliases: ['top', 'leaderboard', 'lb'],
  async run(message, args) {
    const catMap = { coins: 'coins', argent: 'coins', xp: 'xp', niveau: 'niveau', lvl: 'niveau', rep: 'reputation', messages: 'messages' };
    const cat    = catMap[args[0]?.toLowerCase()] || 'coins';
    const guildId = message.guildId;
    const cfg    = db.getConfig ? db.getConfig(guildId) : null;
    const coin   = cfg?.currency_emoji || '🪙';
    const info   = CATEGORIES[cat];

    let rows, valueGetter, valueSuffix;
    if (cat === 'coins') {
      rows = db.db.prepare('SELECT user_id, balance, COALESCE(bank,0) as bank FROM users WHERE guild_id=? ORDER BY (balance + COALESCE(bank,0)) DESC LIMIT 10').all(guildId);
      valueGetter = r => r.balance + r.bank; valueSuffix = coin;
    } else if (cat === 'xp') {
      rows = db.db.prepare('SELECT user_id, xp FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT 10').all(guildId);
      valueGetter = r => r.xp; valueSuffix = 'XP';
    } else if (cat === 'niveau') {
      rows = db.db.prepare('SELECT user_id, level, xp FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
      valueGetter = r => r.level; valueSuffix = 'lvl';
    } else if (cat === 'reputation') {
      rows = db.db.prepare('SELECT user_id, reputation FROM users WHERE guild_id=? ORDER BY reputation DESC LIMIT 10').all(guildId);
      valueGetter = r => r.reputation || 0; valueSuffix = 'rep';
    } else if (cat === 'messages') {
      rows = db.db.prepare('SELECT user_id, message_count FROM users WHERE guild_id=? ORDER BY message_count DESC LIMIT 10').all(guildId);
      valueGetter = r => r.message_count || 0; valueSuffix = 'msgs';
    }

    if (!rows?.length) return message.reply('📭 Aucune donnée disponible.');

    const lines = await Promise.all(rows.map(async (r, i) => {
      const u = await message.client.users.fetch(r.user_id).catch(() => null);
      return `${MEDALS[i]} **${u?.username || r.user_id}** — ${fmt(valueGetter(r))} ${valueSuffix}`;
    }));

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor(info.color)
        .setTitle(`${info.label} — Top 10`)
        .setDescription(info.desc + '\n\n' + lines.join('\n'))
        .setTimestamp()],
    });
  },
};

