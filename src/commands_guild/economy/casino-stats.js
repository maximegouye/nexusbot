// ============================================================
// casino-stats.js — Statistiques personnelles casino
// Emplacement : src/commands_guild/economy/casino-stats.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino-stats')
    .setDescription('🎰 Voir vos statistiques personnelles au casino')
    .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un autre membre').setRequired(false)),

  async execute(interaction) {
    const target  = interaction.options.getUser('membre') || interaction.user;
    const guildId = interaction.guildId;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '🪙';

    // Slots stats
    const slots = db.db.prepare('SELECT * FROM slots_stats WHERE user_id=? AND guild_id=?').get(target.id, guildId);

    // Blackjack stats
    let bj = null;
    try { bj = db.db.prepare('SELECT * FROM blackjack_stats WHERE user_id=? AND guild_id=?').get(target.id, guildId); } catch {}

    // Roulette stats
    let rl = null;
    try { rl = db.db.prepare('SELECT * FROM roulette_stats WHERE user_id=? AND guild_id=?').get(target.id, guildId); } catch {}

    // Crash stats
    let crash = null;
    try { crash = db.db.prepare('SELECT COUNT(*) as games, SUM(gain) as total FROM crash_bets WHERE user_id=? AND guild_id=?').get(target.id, guildId); } catch {}

    // Balance globale
    const u = db.getUser(target.id, guildId);

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle(`🎰 Stats Casino — ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();

    // ─ Slots ─
    if (slots) {
      const slotsWR = slots.spins > 0 ? ((slots.wins / slots.spins) * 100).toFixed(1) : '0.0';
      embed.addFields({
        name: '🎰 Machines à sous',
        value: `Parties : **${fmt(slots.spins)}** | Victoires : **${fmt(slots.wins)}** (${slotsWR}%)\nJackpots : **${fmt(slots.jackpots)}** | Meilleur gain : **${fmt(slots.biggest)} ${coin}**`,
        inline: false,
      });
    }

    // ─ Blackjack ─
    if (bj && bj.games > 0) {
      const bjWR = ((bj.wins / bj.games) * 100).toFixed(1);
      embed.addFields({
        name: '🃏 Blackjack',
        value: `Parties : **${fmt(bj.games)}** | Victoires : **${fmt(bj.wins)}** (${bjWR}%) | Blackjacks : **${fmt(bj.blackjacks || 0)}**`,
        inline: false,
      });
    }

    // ─ Crash ─
    if (crash && crash.games > 0) {
      embed.addFields({
        name: '🚀 Crash',
        value: `Parties : **${fmt(crash.games)}** | Total net : **${fmt(crash.total || 0)} ${coin}**`,
        inline: false,
      });
    }

    // ─ Solde actuel ─
    if (u) {
      embed.addFields({
        name: '💰 Solde actuel',
        value: `Portefeuille : **${fmt(u.balance)} ${coin}** | Banque : **${fmt(u.bank || 0)} ${coin}**`,
        inline: false,
      });
    }

    if (!slots && !bj && !crash) {
      embed.setDescription('📭 Aucune statistique casino trouvée. Jouez d\'abord quelques parties !');
    }

    return interaction.reply({ embeds: [embed], ephemeral: target.id !== interaction.user.id });
  },

  name: 'casino-stats',
  aliases: ['mes-stats', 'stats-casino', 'casinostats'],
  async run(message, args) {
    const target  = message.mentions.users.first() || message.author;
    const guildId = message.guildId;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '🪙';

    const slots = db.db.prepare('SELECT * FROM slots_stats WHERE user_id=? AND guild_id=?').get(target.id, guildId);
    const u     = db.getUser(target.id, guildId);

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle(`🎰 Stats Casino — ${target.username}`)
      .setTimestamp();

    if (slots) {
      const slotsWR = slots.spins > 0 ? ((slots.wins / slots.spins) * 100).toFixed(1) : '0.0';
      embed.addFields({
        name: '🎰 Machines à sous',
        value: `Parties : **${fmt(slots.spins)}** | Victoires : **${fmt(slots.wins)}** (${slotsWR}%)\nJackpots : **${fmt(slots.jackpots)}** | Meilleur gain : **${fmt(slots.biggest)} ${coin}**`,
      });
    }

    if (u) {
      embed.addFields({
        name: '💰 Solde actuel',
        value: `Portefeuille : **${fmt(u.balance)} ${coin}** | Banque : **${fmt(u.bank || 0)} ${coin}**`,
      });
    }

    if (!slots) embed.setDescription('📭 Aucune statistique casino trouvée.');

    return message.reply({ embeds: [embed] });
  },
};

