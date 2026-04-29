const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    last_claim TEXT,
    total_claims INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streak')
    .setDescription('🔥 Séries quotidiennes — connecte-toi chaque jour pour des récompenses')
    .addSubcommand(s => s.setName('check').setDescription('🔥 Vérifier ou récupérer ta récompense quotidienne'))
    .addSubcommand(s => s.setName('voir').setDescription('📊 Voir ta série actuelle')
      .addUserOption(o => o.setName('membre').setDescription('Voir la série d\'un autre membre')))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top des meilleures séries')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const today = getTodayStr();
    const yesterday = getYesterdayStr();

    if (sub === 'check') {
      let streak = db.db.prepare('SELECT * FROM streaks WHERE guild_id=? AND user_id=?').get(guildId, userId);

      if (!streak) {
        db.db.prepare('INSERT INTO streaks (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
        streak = db.db.prepare('SELECT * FROM streaks WHERE guild_id=? AND user_id=?').get(guildId, userId);
      }

      if (streak.last_claim === today) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('Orange')
            .setTitle('🔥 Streak quotidien')
            .setDescription(`Tu as déjà réclamé ta récompense aujourd'hui !\nReviens demain pour continuer ta série de **${streak.current_streak}** jour(s) !`)
            .setFooter({ text: `Série max : ${streak.max_streak} jours` })
        ], ephemeral: true });
      }

      // Calculer la nouvelle série
      let newStreak;
      if (streak.last_claim === yesterday) {
        newStreak = streak.current_streak + 1;
      } else if (!streak.last_claim) {
        newStreak = 1;
      } else {
        newStreak = 1; // Série cassée
      }

      // Récompense basée sur la série
      let reward = 50;
      let bonus = '';
      if (newStreak >= 7) { reward = 200; bonus = '🎯 Bonus semaine complète !'; }
      else if (newStreak >= 5) { reward = 150; bonus = '⭐ Bonus 5 jours !'; }
      else if (newStreak >= 3) { reward = 100; bonus = '✨ Bonus 3 jours !'; }
      const xpReward = Math.floor(reward / 2);

      db.addCoins(userId, guildId, reward);
      db.addXP(userId, guildId, xpReward);
      db.db.prepare(`UPDATE streaks SET current_streak=?, max_streak=MAX(max_streak,?), last_claim=?, total_claims=total_claims+1 WHERE id=?`)
        .run(newStreak, newStreak, today, streak.id);

      const serieText = newStreak === 1 && streak.current_streak > 1
        ? `💔 Ta série précédente de **${streak.current_streak}** jour(s) est cassée. Nouvelle série : **1**`
        : `🔥 Série actuelle : **${newStreak}** jour(s) !`;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor(newStreak >= 7 ? 'Gold' : newStreak >= 3 ? 'Orange' : 'Green')
          .setTitle('🔥 Récompense quotidienne réclamée !')
          .setDescription(`${serieText}\n${bonus}`)
          .addFields(
            { name: '💰 Coins reçus', value: `**+${reward} ${coin}**`, inline: true },
            { name: '⭐ XP reçu', value: `**+${xpReward} XP**`, inline: true },
            { name: '📊 Réclamations totales', value: `**${streak.total_claims + 1}**`, inline: true },
          )
          .setFooter({ text: `Série record : ${Math.max(streak.max_streak, newStreak)} jours • Reviens demain !` })
          .setTimestamp()
      ]});
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const streak = db.db.prepare('SELECT * FROM streaks WHERE guild_id=? AND user_id=?').get(guildId, target.id);

      const isToday = streak?.last_claim === today;
      const status = isToday ? '✅ Réclamé aujourd\'hui' : '⏳ Pas encore réclamé aujourd\'hui';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Orange')
          .setTitle(`🔥 Streak de ${target.username}`)
          .addFields(
            { name: '🔥 Série actuelle', value: `**${streak?.current_streak || 0}** jour(s)`, inline: true },
            { name: '🏆 Série record', value: `**${streak?.max_streak || 0}** jour(s)`, inline: true },
            { name: '📊 Total réclamations', value: `**${streak?.total_claims || 0}**`, inline: true },
            { name: '📅 Statut aujourd\'hui', value: status, inline: false },
          ).setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM streaks WHERE guild_id=? ORDER BY current_streak DESC LIMIT 10').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune donnée.', ephemeral: true });

      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((s, i) => `${medals[i] || `**${i+1}.**`} <@${s.user_id}> — 🔥 **${s.current_streak}** jours (record: ${s.max_streak})`).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Orange').setTitle('🏆 Meilleures Séries').setDescription(lines).setTimestamp()
      ]});
    }
  }
};
