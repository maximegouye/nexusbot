// ============================================================
// /badges — Voir ses achievements et progression
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ach = require('../../utils/achievements');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badges')
    .setDescription('🏅 Voir tes badges et achievements débloqués')
    .addSubcommand(s => s.setName('moi').setDescription('🏅 Voir tes propres badges'))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir TOUS les badges du serveur'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 10 des collectionneurs de badges'))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir les badges d\'un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Le membre').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg = db.getConfig(guildId) || {};
    const coin = cfg.currency_emoji || '€';

    // ── Mes badges ──
    if (sub === 'moi' || sub === 'voir') {
      const target = sub === 'voir' ? interaction.options.getUser('membre') : interaction.user;
      const userBadges = ach.getUserBadges(target.id, guildId);
      const allBadges = ach.getAllBadges();
      const stats = ach.getStats(target.id, guildId);
      const totalReward = userBadges.reduce((sum, b) => sum + (b.reward || 0), 0);
      const pct = Math.round((userBadges.length / allBadges.length) * 100);

      const lines = userBadges.length
        ? userBadges.slice(0, 30).map(b => `${b.emoji} **${b.name}** — ${b.desc}`).join('\n')
        : '*Aucun badge débloqué pour le moment. Joue, gagne, échange — les badges arrivent !*';

      const embed = new EmbedBuilder()
        .setColor(userBadges.length > 0 ? '#F1C40F' : '#95A5A6')
        .setAuthor({ name: target.username, iconURL: target.displayAvatarURL() })
        .setTitle(`🏅 Badges — ${userBadges.length} / ${allBadges.length} (${pct}%)`)
        .setDescription(lines.slice(0, 4000))
        .addFields(
          { name: '🎮 Parties jouées',  value: `**${(stats.games_played || 0).toLocaleString('fr-FR')}**`, inline: true },
          { name: '✅ Victoires',        value: `**${(stats.games_won || 0).toLocaleString('fr-FR')}**`,    inline: true },
          { name: '🎰 Jackpots',         value: `**${(stats.jackpots_hit || 0)}**`,                         inline: true },
          { name: '💰 Total gagné',      value: `**${(stats.total_winnings || 0).toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: '💎 Plus gros gain',   value: `**${(stats.biggest_win || 0).toLocaleString('fr-FR')} ${coin}**`,    inline: true },
          { name: '🔥 Streak max',       value: `**${stats.max_daily_streak || 0} jours**`,                 inline: true },
          { name: '💵 Récompenses badges', value: `**${totalReward.toLocaleString('fr-FR')} ${coin}**`,     inline: false },
        )
        .setFooter({ text: `Utilise /badges liste pour voir tous les badges disponibles` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Liste tous les badges ──
    if (sub === 'liste') {
      const all = ach.getAllBadges();
      const userBadges = new Set(ach.getUserBadges(interaction.user.id, guildId).map(b => b.id));
      const lines = all.map(b => {
        const got = userBadges.has(b.id) ? '✅' : '⬜';
        return `${got} ${b.emoji} **${b.name}** — ${b.desc} *(+${b.reward.toLocaleString('fr-FR')} ${coin})*`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📋 Tous les badges (${all.length})`)
        .setDescription(lines.slice(0, 4000))
        .setFooter({ text: `Tu as débloqué ${userBadges.size}/${all.length} badges` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── Top 10 collectionneurs ──
    if (sub === 'top') {
      const rows = db.db.prepare(
        'SELECT user_id, COUNT(*) as count FROM achievements WHERE guild_id=? GROUP BY user_id ORDER BY count DESC LIMIT 10'
      ).all(guildId);

      if (!rows.length) {
        return interaction.editReply({ content: '🏆 Personne n\'a encore débloqué de badge sur ce serveur. Sois le premier !' });
      }

      const lines = await Promise.all(rows.map(async (r, i) => {
        const u = await interaction.client.users.fetch(r.user_id).catch(() => null);
        const name = u ? `<@${r.user_id}>` : '*Utilisateur inconnu*';
        const medal = ['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`;
        return `${medal} ${name} — **${r.count}** badge(s)`;
      }));

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🏆 Top Collectionneurs de Badges')
        .setDescription(lines.join('\n'))
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
