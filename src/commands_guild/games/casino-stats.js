// ============================================================
// casino-stats.js — Tableau de bord statistiques casino
// Slash : /casino-stats [user]
// Prefix : &casino-stats [@user]
// Routes boutons : cs_
// ============================================================
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ─── Tables stats ─────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS casino_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    game      TEXT NOT NULL,
    mise      INTEGER NOT NULL,
    gain      INTEGER NOT NULL,
    result    TEXT NOT NULL,
    played_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─── Fonctions helpers ────────────────────────────────────
function getSlotsStats(userId, guildId) {
  try {
    return db.db.prepare('SELECT * FROM slots_stats WHERE user_id=? AND guild_id=?').get(userId, guildId) || { spins: 0, wins: 0, jackpots: 0, biggest: 0 };
  } catch { return { spins: 0, wins: 0, jackpots: 0, biggest: 0 }; }
}

function getBJStats(userId, guildId) {
  try {
    return db.db.prepare('SELECT streak, best, total_wins FROM bj_streaks WHERE user_id=? AND guild_id=?').get(userId, guildId) || { streak: 0, best: 0, total_wins: 0 };
  } catch { return { streak: 0, best: 0, total_wins: 0 }; }
}

function getRouletteSpins(userId, guildId) {
  // Roulette history is guild-wide; we can only count server-wide
  try {
    const row = db.db.prepare('SELECT COUNT(*) as cnt FROM roulette_history WHERE guild_id=?').get(guildId);
    return row?.cnt || 0;
  } catch { return 0; }
}

function getTopPlayers(guildId) {
  try {
    return db.db.prepare(
      `SELECT user_id, spins, wins, jackpots, biggest
       FROM slots_stats WHERE guild_id=?
       ORDER BY biggest DESC LIMIT 5`
    ).all(guildId) || [];
  } catch { return []; }
}

function getTopBJStreaks(guildId) {
  try {
    return db.db.prepare(
      `SELECT user_id, best, total_wins
       FROM bj_streaks WHERE guild_id=?
       ORDER BY best DESC LIMIT 5`
    ).all(guildId) || [];
  } catch { return []; }
}

function getRichest(guildId) {
  try {
    return db.db.prepare(
      `SELECT user_id, balance, total_earned
       FROM users WHERE guild_id=?
       ORDER BY balance DESC LIMIT 5`
    ).all(guildId) || [];
  } catch { return []; }
}

function getHotColdNumbers(guildId) {
  try {
    const rows = db.db.prepare(
      `SELECT number, COUNT(*) as cnt FROM roulette_history WHERE guild_id=?
       GROUP BY number ORDER BY cnt DESC LIMIT 6`
    ).all(guildId) || [];
    return rows;
  } catch { return []; }
}

// ─── Médaille streak BJ ───────────────────────────────────
function streakBadge(streak) {
  if (streak >= 10) return '👑';
  if (streak >= 7)  return '🏆';
  if (streak >= 5)  return '🥇';
  if (streak >= 3)  return '🥈';
  if (streak >= 2)  return '🥉';
  return '🎯';
}

// ─── Barre de progression visuelle ───────────────────────
function progressBar(value, max, length = 10) {
  if (!max || max === 0) return '░'.repeat(length) + ' 0%';
  const pct = Math.min(value / max, 1);
  const filled = Math.round(pct * length);
  const bar = '█'.repeat(filled) + '░'.repeat(length - filled);
  return `${bar} ${Math.round(pct * 100)}%`;
}

// ─── Rang casino selon profil ─────────────────────────────
function casinoRank(slots, bj) {
  const total = (slots.spins || 0) + (bj.total_wins || 0);
  if (total >= 1000) return { label: '💎 Diamant', color: '#00BCD4' };
  if (total >= 500)  return { label: '🔮 Platine',  color: '#9C27B0' };
  if (total >= 200)  return { label: '🥇 Or',       color: '#FFC107' };
  if (total >= 50)   return { label: '🥈 Argent',   color: '#9E9E9E' };
  if (total >= 10)   return { label: '🥉 Bronze',   color: '#FF5722' };
  return { label: '🎰 Novice', color: '#607D8B' };
}

// ─── Embed personnel ──────────────────────────────────────
async function buildPersonalEmbed(interaction, targetUser, guildId, coin) {
  const userId  = targetUser.id;
  const slots   = getSlotsStats(userId, guildId);
  const bj      = getBJStats(userId, guildId);
  const u       = db.getUser ? db.getUser(userId, guildId) : (db.db.prepare('SELECT balance, total_earned FROM users WHERE user_id=? AND guild_id=?').get(userId, guildId) || { balance: 0, total_earned: 0 });
  const rank    = casinoRank(slots, bj);

  const winRate  = slots.spins > 0 ? ((slots.wins / slots.spins) * 100).toFixed(1) : '0.0';
  const bjBar    = progressBar(bj.streak, Math.max(bj.best, 1), 10);
  const slotsBar = progressBar(slots.wins, Math.max(slots.spins, 1), 10);

  const embed = new EmbedBuilder()
    .setColor(rank.color)
    .setTitle(`🎰 Statistiques Casino — ${targetUser.displayName || targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
    .setDescription(
      `\`\`\`\n` +
      `╔═══════════════════════════════╗\n` +
      `║  🎰  CASINO NEXUSBOT ROYALE  🎰  ║\n` +
      `║      Carte de Joueur          ║\n` +
      `╚═══════════════════════════════╝\n` +
      `\`\`\``
    )
    .addFields(
      {
        name: '🏅 Rang Casino',
        value: `${rank.label}`,
        inline: true,
      },
      {
        name: '💰 Solde Actuel',
        value: `**${Number(u.balance || 0).toLocaleString('fr-FR')} ${coin}**`,
        inline: true,
      },
      {
        name: '📈 Total Gagné (vie)',
        value: `**${Number(u.total_earned || 0).toLocaleString('fr-FR')} ${coin}**`,
        inline: true,
      },
      {
        name: '🎰 Machines à Sous',
        value: [
          `🎡 **${slots.spins.toLocaleString('fr-FR')}** tours joués`,
          `✅ **${slots.wins.toLocaleString('fr-FR')}** gains · Taux: \`${winRate}%\``,
          `🏆 **${slots.jackpots}** jackpots`,
          `💎 Meilleur gain: **${slots.biggest.toLocaleString('fr-FR')} ${coin}**`,
          `Victoires: \`${slotsBar}\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🃏 Blackjack',
        value: [
          `🎯 **${bj.total_wins}** victoires totales`,
          `🔥 Série actuelle: **${bj.streak}** ${bj.streak >= 3 ? '🔥' : ''}`,
          `${streakBadge(bj.best)} Meilleure série: **${bj.best}**`,
          `Streak: \`${bjBar}\``,
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: '🎰 Casino NexusBot • Jouez de manière responsable' })
    .setTimestamp();

  return embed;
}

// ─── Embed serveur ────────────────────────────────────────
async function buildServerEmbed(interaction, guild, coin, client) {
  const guildId   = guild.id;
  const topSlots  = getTopPlayers(guildId);
  const topBJ     = getTopBJStreaks(guildId);
  const richest   = getRichest(guildId);
  const hotCold   = getHotColdNumbers(guildId);
  const roulSpins = getRouletteSpins(null, guildId);

  // Fonction pour résoudre username
  const getName = async (userId) => {
    try {
      const m = await guild.members.fetch(userId).catch(() => null);
      return m ? (m.displayName || m.user.username) : `<@${userId}>`;
    } catch { return `<@${userId}>`; }
  };

  // Top richesse
  let richLines = '```\n';
  for (let i = 0; i < Math.min(richest.length, 5); i++) {
    const r = richest[i];
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const name = await getName(r.user_id);
    richLines += `${medals[i]} ${name.slice(0, 16).padEnd(16)} ${Number(r.balance).toLocaleString('fr-FR')} ${coin}\n`;
  }
  richLines += '```';

  // Top slots
  let slotsLines = '';
  for (let i = 0; i < Math.min(topSlots.length, 5); i++) {
    const s = topSlots[i];
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const name = await getName(s.user_id);
    slotsLines += `${medals[i]} **${name.slice(0, 14)}** — 💎 ${Number(s.biggest).toLocaleString('fr-FR')} ${coin}\n`;
  }
  if (!slotsLines) slotsLines = '*Aucune partie encore jouée*';

  // Top BJ streaks
  let bjLines = '';
  for (let i = 0; i < Math.min(topBJ.length, 5); i++) {
    const b = topBJ[i];
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    const name = await getName(b.user_id);
    bjLines += `${medals[i]} **${name.slice(0, 14)}** — ${streakBadge(b.best)} Série x${b.best} · ${b.total_wins} victoires\n`;
  }
  if (!bjLines) bjLines = '*Aucune partie encore jouée*';

  // Numéros chauds roulette
  let roulLines = roulSpins > 0
    ? `🌡️ **${roulSpins}** numéros tirés sur ce serveur\n`
    : '🎡 *Aucune roulette jouée encore*\n';
  for (const row of hotCold.slice(0, 3)) {
    const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    const col = row.number === 0 ? '🟩' : RED.includes(row.number) ? '🔴' : '⚫';
    roulLines += `${col} **${row.number}** — tiré **${row.cnt}× **\n`;
  }

  const embed = new EmbedBuilder()
    .setColor('#2C3E50')
    .setTitle(`🏆 Classement Casino — ${guild.name}`)
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setDescription(
      `\`\`\`\n` +
      `╔══════════════════════════════════╗\n` +
      `║  🎰  HALL OF FAME  CASINO  🏆  ║\n` +
      `╚══════════════════════════════════╝\n` +
      `\`\`\``
    )
    .addFields(
      { name: '💰 Les Plus Riches du Serveur', value: richLines || '*Aucun joueur*', inline: false },
      { name: '🎰 Top Gains Machines à Sous', value: slotsLines, inline: false },
      { name: '🃏 Top Séries Blackjack',        value: bjLines,   inline: false },
      { name: '🎡 Roulette — Numéros Chauds',   value: roulLines, inline: false },
    )
    .setFooter({ text: '🎰 Casino NexusBot • Statistiques du serveur' })
    .setTimestamp();

  return embed;
}

// ─── Action principale ────────────────────────────────────
async function showStats(source, userId, targetUser, guildId, showServer, client) {
  const isInteraction = !!source.editReply;
  const guild  = source.guild || source.channel?.guild;
  const cfg    = db.getConfig ? db.getConfig(guildId) : db.db.prepare('SELECT currency_emoji FROM guild_config WHERE guild_id=?').get(guildId);
  const coin   = cfg?.currency_emoji || '€';

  const personalEmbed = await buildPersonalEmbed(source, targetUser, guildId, coin);

  // Boutons navigation
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cs_personal_${userId}_${targetUser.id}`)
      .setLabel('👤 Mon Profil')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cs_server_${userId}`)
      .setLabel('🏆 Classement')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cs_refresh_${userId}_${targetUser.id}`)
      .setLabel('🔄 Actualiser')
      .setStyle(ButtonStyle.Success),
  );

  if (isInteraction) {
    await source.editReply({ embeds: [personalEmbed], components: [row] });
  } else {
    await source.reply({ embeds: [personalEmbed], components: [row] });
  }
}

// ─── handleComponent ─────────────────────────────────────
async function handleComponent(interaction, cid) {
  if (!cid.startsWith('cs_')) return false;

  const parts    = cid.split('_');
  const action   = parts[1];
  const userId   = parts[2];
  const targetId = parts[3] || userId;

  // Seul le joueur peut naviguer
  if (interaction.user.id !== userId) {
    await interaction.editReply({ content: "❌ Ce tableau de bord ne t'appartient pas.", ephemeral: true });
    return true;
  }

  const guildId = interaction.guildId;
  const cfg     = db.getConfig ? db.getConfig(guildId) : db.db.prepare('SELECT currency_emoji FROM guild_config WHERE guild_id=?').get(guildId);
  const coin    = cfg?.currency_emoji || '€';
  const guild   = interaction.guild;

  await interaction.deferUpdate().catch(() => {});

  if (action === 'personal' || action === 'refresh') {
    let targetUser;
    try {
      targetUser = await guild.members.fetch(targetId).then(m => m.user);
    } catch {
      targetUser = interaction.user;
    }
    const embed = await buildPersonalEmbed(interaction, targetUser, guildId, coin);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cs_personal_${userId}_${targetUser.id}`).setLabel('👤 Mon Profil').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cs_server_${userId}`).setLabel('🏆 Classement').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cs_refresh_${userId}_${targetUser.id}`).setLabel('🔄 Actualiser').setStyle(ButtonStyle.Success),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  if (action === 'server') {
    const embed = await buildServerEmbed(interaction, guild, coin, interaction.client);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cs_personal_${userId}_${userId}`).setLabel('👤 Mon Profil').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cs_server_${userId}`).setLabel('🏆 Classement').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`cs_refresh_${userId}_${userId}`).setLabel('🔄 Actualiser').setStyle(ButtonStyle.Success),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
    return true;
  }

  return false;
}

// ─── run() pour prefix & ─────────────────────────────────
async function run(message, args) {
  const guildId = message.guildId;
  let targetUser = message.author;

  // Résoudre mention ou ID
  if (args[0]) {
    const mention = message.mentions?.users?.first();
    if (mention) {
      targetUser = mention;
    } else {
      try {
        const found = await message.guild.members.fetch(args[0]).catch(() => null);
        if (found) targetUser = found.user;
      } catch {}
    }
  }

  await message.channel.sendTyping?.().catch(() => {});
  await showStats(message, message.author.id, targetUser, guildId, false, message.client);
}

// ─── execute() pour slash / ───────────────────────────────
async function execute(interaction) {
  await interaction.deferReply().catch(() => {});

  const guildId    = interaction.guildId;
  const targetMember = interaction.options.getMember('utilisateur') || null;
  const targetUser  = targetMember ? targetMember.user : interaction.user;

  await showStats(interaction, interaction.user.id, targetUser, guildId, false, interaction.client);
}

// ─── Slash command builder ────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('casino-stats')
  .setDescription('📊 Affiche tes statistiques casino et le classement du serveur')
  .addUserOption(o => o
    .setName('utilisateur')
    .setDescription('Voir les stats d\'un autre joueur')
    .setRequired(false)
  );

module.exports = {
  name: 'casino-stats',
  aliases: ['cstats', 'casinostats', 'casino-stat'],
  data,
  execute,
  run,
  handleComponent,
};
