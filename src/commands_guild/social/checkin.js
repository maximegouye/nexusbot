/**
 * NexusBot — Système de Check-in Quotidien
 * /checkin — Pointez chaque jour pour gagner des récompenses et cumuler des streaks !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS checkin_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    streak     INTEGER DEFAULT 1,
    total      INTEGER DEFAULT 1,
    coins_earned INTEGER DEFAULT 0,
    xp_earned  INTEGER DEFAULT 0,
    checked_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const MILESTONES = {
  7:   { coins: 500,   xp: 100,  label: '🔥 7 jours !',    emoji: '🎁' },
  14:  { coins: 1000,  xp: 200,  label: '⚡ 2 semaines !', emoji: '🏆' },
  30:  { coins: 2500,  xp: 500,  label: '💎 1 mois !',     emoji: '💎' },
  60:  { coins: 5000,  xp: 1000, label: '🌟 2 mois !',     emoji: '🌟' },
  100: { coins: 10000, xp: 2000, label: '👑 100 jours !',  emoji: '👑' },
  365: { coins: 50000, xp: 10000,label: '🚀 1 an !',       emoji: '🚀' },
};

function getReward(streak, total) {
  const base = 50 + Math.min(streak * 10, 300);
  const xp   = 20 + Math.min(streak * 5, 100);
  const milestone = MILESTONES[streak] || MILESTONES[total];
  return { coins: base, xp, milestone };
}

function getStreakBar(streak) {
  const maxShow = Math.min(streak, 10);
  return '🔥'.repeat(maxShow) + (streak > 10 ? ` ×${streak}` : '');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('✅ Système de check-in quotidien')
    .addSubcommand(s => s.setName('pointer').setDescription('📝 Pointer pour aujourd\'hui et gagner des récompenses'))
    .addSubcommand(s => s.setName('profil').setDescription('📊 Voir ton profil de check-in'))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Classement des meilleurs streaks du serveur')),

  cooldown: 60,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const sub     = interaction.options.getSubcommand();
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    if (sub === 'pointer') {
      // Vérifie si déjà checké aujourd'hui
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Math.floor(today.getTime() / 1000);

      const lastCheck = db.db.prepare('SELECT * FROM checkin_log WHERE user_id=? AND guild_id=? ORDER BY checked_at DESC LIMIT 1').get(userId, guildId);

      if (lastCheck && lastCheck.checked_at >= todayTs) {
        const nextTs = todayTs + 86400;
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
          .setColor('#95a5a6')
          .setDescription(`⏳ Tu as déjà pointé aujourd'hui !\nProchain check-in : <t:${nextTs}:R>`)
        ]});
      }

      // Calculer le streak
      const yesterday = todayTs - 86400;
      let streak = 1;
      let total  = 1;

      if (lastCheck) {
        total = lastCheck.total + 1;
        if (lastCheck.checked_at >= yesterday) {
          streak = lastCheck.streak + 1;
        }
      }

      const { coins, xp, milestone } = getReward(streak, total);
      db.addCoins(userId, guildId, coins);
      db.addXP(userId, guildId, xp);

      db.db.prepare('INSERT INTO checkin_log (user_id, guild_id, streak, total, coins_earned, xp_earned) VALUES (?,?,?,?,?,?)')
        .run(userId, guildId, streak, total, coins, xp);

      const embed = new EmbedBuilder()
        .setColor(streak >= 30 ? '#f39c12' : streak >= 7 ? '#9b59b6' : '#2ecc71')
        .setTitle(`✅ Check-in #${total} — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '🔥 Streak',       value: `${getStreakBar(streak)} (${streak} jour(s))`, inline: false },
          { name: '🪙 Coins gagnés', value: `+**${coins}** coins`,                         inline: true  },
          { name: '⭐ XP gagnée',    value: `+**${xp}** XP`,                               inline: true  },
          { name: '📊 Total jours',  value: `${total}`,                                    inline: true  },
        )
        .setFooter({ text: 'Revenez demain pour continuer votre streak !' });

      if (milestone) {
        embed.addFields({ name: `${milestone.emoji} MILESTONE DÉBLOQUÉ !`, value: `**${milestone.label}** — Bonus : +${milestone.coins} coins & +${milestone.xp} XP !`, inline: false });
        db.addCoins(userId, guildId, milestone.coins);
        db.addXP(userId, guildId, milestone.xp);
        embed.setColor('#f39c12');
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'profil') {
      const logs = db.db.prepare('SELECT * FROM checkin_log WHERE user_id=? AND guild_id=? ORDER BY checked_at DESC LIMIT 1').get(userId, guildId);
      if (!logs) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun check-in. Commence avec `/checkin pointer` !')] });

      const today = new Date(); today.setHours(0,0,0,0);
      const todayTs = Math.floor(today.getTime()/1000);
      const isActive = logs.checked_at >= todayTs - 86400;

      const totalCoinsResult = db.db.prepare('SELECT SUM(coins_earned) as t FROM checkin_log WHERE user_id=? AND guild_id=?').get(userId, guildId);
      const totalCoins = totalCoinsResult?.t || 0;

      // Prochain milestone
      const nextMilestone = Object.keys(MILESTONES).map(Number).find(m => m > logs.streak);

      const embed = new EmbedBuilder()
        .setColor(isActive ? '#2ecc71' : '#e74c3c')
        .setTitle(`📊 Profil Check-in — ${interaction.user.username}`)
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: '🔥 Streak actuel',   value: `${logs.streak} jour(s) ${isActive ? '✅' : '❌ Perdu !'}`, inline: true },
          { name: '📅 Total check-ins', value: `${logs.total}`,                                              inline: true },
          { name: '🪙 Coins gagnés',    value: `${totalCoins.toLocaleString()}`,                             inline: true },
          { name: '🎯 Prochain milestone', value: nextMilestone ? `Streak de ${nextMilestone} (${nextMilestone - logs.streak} restants)` : '🏆 Tous les milestones débloqués !', inline: false },
        )
        .setFooter({ text: `Dernier check-in : ${new Date(logs.checked_at * 1000).toLocaleDateString('fr-FR')}` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'classement') {
      const top = db.db.prepare(`
        SELECT user_id, streak, total FROM checkin_log
        WHERE guild_id=? GROUP BY user_id
        ORDER BY streak DESC LIMIT 10
      `).all(guildId);

      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Personne n\'a encore pointé !')] });

      const medals = ['🥇','🥈','🥉'];
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏆 Classement Streaks Check-in')
        .setDescription(top.map((r, i) => `${medals[i] || `**${i+1}.**`} <@${r.user_id}> — 🔥 **${r.streak}** jours streak — ${r.total} total`).join('\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }
  }
};
