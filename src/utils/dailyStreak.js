// ============================================================
// dailyStreak.js — Système de "streak" (jours consécutifs).
// Inspiré du modèle Snapchat / Duolingo : compte le nombre de
// jours d'affilée où le membre a parlé sur le serveur.
// Récompenses exponentielles pour booster la rétention.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

function init() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS user_streaks (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_active_day TEXT,
      total_days INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    )`).run();
  } catch {}
}
init();

// Échelle de récompenses : exponentielle pour récompenser la fidélité.
// Plus le streak est long, plus le bonus du jour est gros.
function streakReward(streak) {
  if (streak >= 365) return 10000; // 1 an
  if (streak >= 100) return 5000;
  if (streak >= 30)  return 2500;
  if (streak >= 14)  return 1500;
  if (streak >= 7)   return 1000;
  if (streak >= 3)   return 500;
  return 250;
}

// Badge / label visuel selon la longueur du streak
function streakLabel(streak) {
  if (streak >= 365) return '🏆 LÉGENDE — 1 an d\'activité !';
  if (streak >= 180) return '👑 IMMORTEL — 6 mois consécutifs !';
  if (streak >= 100) return '💎 ÉLITE — 100 jours !';
  if (streak >= 60)  return '🌟 VÉTÉRAN — 2 mois !';
  if (streak >= 30)  return '🔥 ACCRO — 1 mois !';
  if (streak >= 14)  return '⚡ FIDÈLE — 2 semaines !';
  if (streak >= 7)   return '🎯 ENGAGÉ — 1 semaine !';
  if (streak >= 3)   return '✨ EN FORME — 3 jours !';
  return '🌱 NOUVEAU STREAK';
}

// Appelé à chaque message — met à jour le streak du membre.
// Renvoie { streakChanged, newStreak, broken, reward } si le streak a évolué
// aujourd'hui, sinon null. Optimisé pour ne tourner qu'une fois par jour.
function updateStreak(guildId, userId) {
  init();
  const today = new Date().toISOString().slice(0, 10);
  let row = db.db.prepare('SELECT * FROM user_streaks WHERE guild_id=? AND user_id=?').get(guildId, userId);
  if (!row) {
    db.db.prepare(`INSERT INTO user_streaks (guild_id, user_id, current_streak, best_streak, last_active_day, total_days)
                   VALUES (?, ?, 1, 1, ?, 1)`).run(guildId, userId, today);
    return { streakChanged: true, newStreak: 1, broken: false, reward: streakReward(1) };
  }
  if (row.last_active_day === today) return null; // déjà actif aujourd'hui

  // Calcule l'écart depuis le dernier jour actif
  const last = new Date(row.last_active_day + 'T00:00:00Z');
  const now  = new Date(today + 'T00:00:00Z');
  const diffDays = Math.round((now - last) / 86400000);

  let newStreak;
  let broken = false;
  if (diffDays === 1) {
    newStreak = row.current_streak + 1;
  } else {
    // Streak cassé (>1 jour d'absence)
    newStreak = 1;
    broken = row.current_streak > 1;
  }
  const newBest = Math.max(newStreak, row.best_streak);
  const newTotal = (row.total_days || 0) + 1;

  db.db.prepare(`UPDATE user_streaks SET current_streak=?, best_streak=?, last_active_day=?, total_days=?
                 WHERE guild_id=? AND user_id=?`)
    .run(newStreak, newBest, today, newTotal, guildId, userId);

  const reward = streakReward(newStreak);
  // Crédite le bonus en €
  try { db.addCoins(userId, guildId, reward); } catch {}

  return { streakChanged: true, newStreak, broken, reward };
}

function getStreak(guildId, userId) {
  init();
  return db.db.prepare('SELECT * FROM user_streaks WHERE guild_id=? AND user_id=?').get(guildId, userId);
}

// Top 10 des streaks actuels (utile pour le leaderboard hebdo)
function getTopStreaks(guildId, limit = 10) {
  init();
  return db.db.prepare(`SELECT * FROM user_streaks WHERE guild_id=?
                        ORDER BY current_streak DESC, best_streak DESC LIMIT ?`)
    .all(guildId, limit);
}

// Notifie le membre de son streak quand il atteint un palier remarquable
async function announceStreakMilestone(message, info) {
  const milestones = [3, 7, 14, 30, 60, 100, 180, 365];
  if (!milestones.includes(info.newStreak)) return; // seulement aux paliers

  const cfg = db.getConfig(message.guild.id);
  const coin = cfg?.currency_emoji || '€';
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle(streakLabel(info.newStreak))
    .setDescription([
      `<@${message.author.id}> a atteint **${info.newStreak} jours d'affilée** sur Zone Entraide !`,
      '',
      `🎁 **Bonus du jour** : +${info.reward.toLocaleString('fr-FR')} ${coin}`,
      `🔥 Continue comme ça pour atteindre le palier suivant.`,
    ].join('\n'))
    .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
    .setTimestamp();
  message.channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  updateStreak,
  getStreak,
  getTopStreaks,
  announceStreakMilestone,
  streakLabel,
  streakReward,
  init,
};
