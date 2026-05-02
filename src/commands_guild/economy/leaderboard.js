// ============================================================
// leaderboard.js — Classement global XP / Coins / Réputation / Pêche
// Emplacement : src/commands_guild/economy/leaderboard.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const PODIUM_BG = ['#FFD700', '#C0C0C0', '#CD7F32'];

const CATEGORIES = {
  coins:      { label: '💰 Richesse',   color: '#FFD700', desc: 'Solde total (poche + banque)', emoji: '💰' },
  xp:         { label: '⭐ Expérience', color: '#5865F2', desc: 'Points XP cumulés',            emoji: '⭐' },
  niveau:     { label: '🏆 Niveau',     color: '#57F287', desc: 'Niveau actuel',                emoji: '🏆' },
  reputation: { label: '❤️ Réputation', color: '#ED4245', desc: 'Points de réputation',         emoji: '❤️' },
  messages:   { label: '💬 Messages',   color: '#EB459E', desc: 'Messages envoyés',             emoji: '💬' },
};

function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

// Barre de progression textuelle (10 blocs)
function progressBar(value, max, length = 10) {
  if (!max || max <= 0) return '░'.repeat(length);
  const filled = Math.round((value / max) * length);
  return '█'.repeat(Math.min(filled, length)) + '░'.repeat(Math.max(0, length - filled));
}

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
        { name: '💰 Richesse (€)',   value: 'coins' },
        { name: '⭐ Expérience (XP)',    value: 'xp' },
        { name: '🏆 Niveau',            value: 'niveau' },
        { name: '❤️ Réputation',        value: 'reputation' },
        { name: '💬 Messages',          value: 'messages' },
      )),

  async execute(interaction) {
    await interaction.deferReply().catch(() => {});
    const cat    = interaction.options.getString('categorie') || 'coins';
    const guildId = interaction.guildId;
    const cfg    = db.getConfig ? db.getConfig(guildId) : null;
    const coin   = cfg?.currency_emoji || '€';
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
    const resolved = await Promise.all(rows.map(async (r, i) => {
      const username = await getTag(interaction.client, r.user_id);
      const val = valueGetter(r);
      return { username, val, userId: r.user_id, rank: i + 1 };
    }));

    const maxVal = resolved[0]?.val || 1;

    // ── Podium top 3 ──
    const podiumLines = resolved.slice(0, 3).map(({ username, val, rank }) => {
      const bar = progressBar(val, maxVal, 12);
      const crown = rank === 1 ? ' 👑' : '';
      return `${MEDALS[rank - 1]} **${username}**${crown}\n\`${bar}\` ${fmt(val)} ${valueSuffix}`;
    });

    // ── Suite 4-10 ──
    const restLines = resolved.slice(3).map(({ username, val, rank }) => {
      return `${MEDALS[rank - 1]} **${username}** · ${fmt(val)} ${valueSuffix}`;
    });

    // Construire la description
    const sep = '━━━━━━━━━━━━━━━━━━━━━━━';
    let desc = `*${info.desc}*\n\n`;
    desc += podiumLines.join('\n\n');
    if (restLines.length) {
      desc += `\n\n${sep}\n`;
      desc += restLines.join('\n');
    }

    // Chercher la position du joueur appelant
    let callerPos = null, callerVal = null;
    const orderMap = {
      coins:      'SELECT user_id, (balance + COALESCE(bank,0)) as v FROM users WHERE guild_id=? ORDER BY v DESC',
      xp:         'SELECT user_id, xp as v FROM users WHERE guild_id=? ORDER BY v DESC',
      niveau:     'SELECT user_id, level as v FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC',
      reputation: 'SELECT user_id, COALESCE(reputation,0) as v FROM users WHERE guild_id=? ORDER BY v DESC',
      messages:   'SELECT user_id, COALESCE(message_count,0) as v FROM users WHERE guild_id=? ORDER BY v DESC',
    };
    try {
      const all = db.db.prepare(orderMap[cat]).all(guildId);
      const idx = all.findIndex(r => r.user_id === interaction.user.id);
      if (idx !== -1) { callerPos = idx + 1; callerVal = all[idx].v; }
    } catch {}

    const footerText = callerPos
      ? `Vous · #${callerPos} — ${fmt(callerVal)} ${valueSuffix}`
      : 'Tu n\'es pas encore dans le classement';

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setAuthor({ name: `${interaction.guild.name} · Classement`, iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
      .setTitle(`${info.emoji}  ${info.label} — Top 10`)
      .setDescription(desc)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null)
      .setFooter({ text: footerText, iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
      .setTimestamp();

    // Boutons de navigation entre catégories
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lb_coins').setLabel('Richesse').setEmoji('💰').setStyle(cat === 'coins' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(cat === 'coins'),
      new ButtonBuilder().setCustomId('lb_xp').setLabel('XP').setEmoji('⭐').setStyle(cat === 'xp' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(cat === 'xp'),
      new ButtonBuilder().setCustomId('lb_niveau').setLabel('Niveau').setEmoji('🏆').setStyle(cat === 'niveau' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(cat === 'niveau'),
      new ButtonBuilder().setCustomId('lb_reputation').setLabel('Réputation').setEmoji('❤️').setStyle(cat === 'reputation' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(cat === 'reputation'),
      new ButtonBuilder().setCustomId('lb_messages').setLabel('Messages').setEmoji('💬').setStyle(cat === 'messages' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(cat === 'messages'),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });

    // Collector navigation
    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('lb_');

    // Fonction interne qui rebâtit l'embed pour une catégorie donnée
    async function renderCat(targetMsg, newCat) {
      const newInfo = CATEGORIES[newCat];
      if (!newInfo) return;

      let newRows, newValueGetter, newValueSuffix;
      if (newCat === 'coins') {
        newRows = db.db.prepare('SELECT user_id, balance, COALESCE(bank,0) as bank FROM users WHERE guild_id=? ORDER BY (balance + COALESCE(bank,0)) DESC LIMIT 10').all(guildId);
        newValueGetter = r => r.balance + r.bank; newValueSuffix = coin;
      } else if (newCat === 'xp') {
        newRows = db.db.prepare('SELECT user_id, xp FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT 10').all(guildId);
        newValueGetter = r => r.xp; newValueSuffix = 'XP';
      } else if (newCat === 'niveau') {
        newRows = db.db.prepare('SELECT user_id, level, xp FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(guildId);
        newValueGetter = r => r.level; newValueSuffix = 'lvl';
      } else if (newCat === 'reputation') {
        newRows = db.db.prepare('SELECT user_id, reputation FROM users WHERE guild_id=? ORDER BY reputation DESC LIMIT 10').all(guildId);
        newValueGetter = r => r.reputation || 0; newValueSuffix = 'rep';
      } else if (newCat === 'messages') {
        newRows = db.db.prepare('SELECT user_id, message_count FROM users WHERE guild_id=? ORDER BY message_count DESC LIMIT 10').all(guildId);
        newValueGetter = r => r.message_count || 0; newValueSuffix = 'msgs';
      }

      if (!newRows?.length) {
        await targetMsg.edit({ content: '📭 Aucune donnée disponible.', embeds: [], components: [] }).catch(() => {});
        return;
      }

      const newResolved = await Promise.all(newRows.map(async (r, idx) => {
        const username = await getTag(interaction.client, r.user_id);
        const val = newValueGetter(r);
        return { username, val, rank: idx + 1 };
      }));

      const newMaxVal = newResolved[0]?.val || 1;

      const newPodiumLines = newResolved.slice(0, 3).map(({ username, val, rank }) => {
        const bar = progressBar(val, newMaxVal, 12);
        const crown = rank === 1 ? ' 👑' : '';
        return `${MEDALS[rank - 1]} **${username}**${crown}\n\`${bar}\` ${fmt(val)} ${newValueSuffix}`;
      });
      const newRestLines = newResolved.slice(3).map(({ username, val, rank }) =>
        `${MEDALS[rank - 1]} **${username}** · ${fmt(val)} ${newValueSuffix}`
      );

      const newSep = '━━━━━━━━━━━━━━━━━━━━━━━';
      let newDesc = `*${newInfo.desc}*\n\n`;
      newDesc += newPodiumLines.join('\n\n');
      if (newRestLines.length) newDesc += `\n\n${newSep}\n` + newRestLines.join('\n');

      const newRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_coins').setLabel('Richesse').setEmoji('💰').setStyle(newCat === 'coins' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(newCat === 'coins'),
        new ButtonBuilder().setCustomId('lb_xp').setLabel('XP').setEmoji('⭐').setStyle(newCat === 'xp' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(newCat === 'xp'),
        new ButtonBuilder().setCustomId('lb_niveau').setLabel('Niveau').setEmoji('🏆').setStyle(newCat === 'niveau' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(newCat === 'niveau'),
        new ButtonBuilder().setCustomId('lb_reputation').setLabel('Réputation').setEmoji('❤️').setStyle(newCat === 'reputation' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(newCat === 'reputation'),
        new ButtonBuilder().setCustomId('lb_messages').setLabel('Messages').setEmoji('💬').setStyle(newCat === 'messages' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(newCat === 'messages'),
      );

      const newEmbed = new EmbedBuilder()
        .setColor(newInfo.color)
        .setAuthor({ name: `${interaction.guild.name} · Classement`, iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
        .setTitle(`${newInfo.emoji}  ${newInfo.label} — Top 10`)
        .setDescription(newDesc)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null)
        .setFooter({ text: `Navigue entre les catégories`, iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
        .setTimestamp();

      await targetMsg.edit({ embeds: [newEmbed], components: [newRow] }).catch(() => {});

      // Nouveau collector pour la navigation continue
      const nc = targetMsg.createMessageComponentCollector({ filter, time: 60_000 });
      nc.on('collect', async j => {
        await j.deferUpdate();
        nc.stop();
        await renderCat(targetMsg, j.customId.replace('lb_', ''));
      });
      nc.on('end', () => targetMsg.edit({ components: [] }).catch(() => {}));
    }

    const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });
    collector.on('collect', async i => {
      await i.deferUpdate();
      collector.stop();
      await renderCat(msg, i.customId.replace('lb_', ''));
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
    const coin   = cfg?.currency_emoji || '€';
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

