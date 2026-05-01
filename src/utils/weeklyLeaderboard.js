// ============================================================
// weeklyLeaderboard.js — Auto-post le classement hebdo des plus
// actifs chaque lundi à midi (heure Paris) dans #général.
// Récompense les 3 premiers avec un bonus € pour booster la
// compétition saine.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Init de la table de tracking XP hebdomadaire (idempotent)
function initWeeklyTable() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS weekly_xp_log (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      xp_gained INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id, week_start)
    )`).run();
    db.db.prepare(`CREATE TABLE IF NOT EXISTS weekly_leaderboard_log (
      guild_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      posted_at INTEGER,
      PRIMARY KEY (guild_id, week_start)
    )`).run();
  } catch {}
}

// Renvoie YYYY-MM-DD du lundi de la semaine en cours (Paris-aware approximatif)
function currentWeekStart() {
  const d = new Date();
  const day = d.getUTCDay() || 7; // 1=Lundi, 7=Dimanche
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

// Increment XP hebdomadaire (à appeler depuis messageCreate après chaque gain XP)
function incrementWeeklyXP(guildId, userId, xpGained) {
  try {
    initWeeklyTable();
    const week = currentWeekStart();
    db.db.prepare(`INSERT INTO weekly_xp_log (guild_id, user_id, week_start, xp_gained)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(guild_id, user_id, week_start)
                   DO UPDATE SET xp_gained = xp_gained + ?`)
      .run(guildId, userId, week, xpGained, xpGained);
  } catch {}
}

// Top 10 de la semaine
function getTop10(guildId, weekStart) {
  try {
    return db.db.prepare(`SELECT user_id, xp_gained FROM weekly_xp_log
                          WHERE guild_id = ? AND week_start = ?
                          ORDER BY xp_gained DESC LIMIT 10`)
      .all(guildId, weekStart);
  } catch { return []; }
}

// Vérifie si on a déjà posté pour cette semaine
function alreadyPostedForWeek(guildId, weekStart) {
  try {
    const row = db.db.prepare('SELECT 1 FROM weekly_leaderboard_log WHERE guild_id = ? AND week_start = ?')
      .get(guildId, weekStart);
    return !!row;
  } catch { return false; }
}

function markPosted(guildId, weekStart) {
  try {
    db.db.prepare('INSERT OR REPLACE INTO weekly_leaderboard_log (guild_id, week_start, posted_at) VALUES (?, ?, ?)')
      .run(guildId, weekStart, Math.floor(Date.now() / 1000));
  } catch {}
}

function findGeneralChannel(guild) {
  const candidates = ['général', 'general', 'chat', 'discussion'];
  for (const name of candidates) {
    const ch = guild.channels.cache.find(c => c.name === name && c.isTextBased && c.isTextBased());
    if (ch) return ch;
  }
  return guild.systemChannel || guild.channels.cache.find(c =>
    c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
  );
}

// Poste le classement de la semaine PRÉCÉDENTE et donne les récompenses au top 3
async function postWeeklyLeaderboardInGuild(guild) {
  initWeeklyTable();
  // Calcule le lundi de la semaine PRÉCÉDENTE (celle qu'on récap)
  const d = new Date();
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1) - 7); // Lundi de la semaine d'avant
  const lastWeek = d.toISOString().slice(0, 10);

  if (alreadyPostedForWeek(guild.id, lastWeek)) return false;

  const top = getTop10(guild.id, lastWeek);
  if (!top.length) {
    markPosted(guild.id, lastWeek);
    return false; // pas de données
  }

  const channel = findGeneralChannel(guild);
  if (!channel) return false;

  const cfg = db.getConfig(guild.id);
  const coin = cfg?.currency_emoji || '€';

  // Récompenses : Top 1 : 5000 €, Top 2 : 3000 €, Top 3 : 1500 €
  const rewards = [5000, 3000, 1500];
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = top.map((row, i) => {
    const reward = rewards[i] ? ` — **+${rewards[i].toLocaleString('fr-FR')} ${coin}** 🎁` : '';
    return `${medals[i]} <@${row.user_id}> — ${row.xp_gained.toLocaleString('fr-FR')} XP${reward}`;
  }).join('\n');

  // Distribue les récompenses
  for (let i = 0; i < Math.min(3, top.length); i++) {
    try { db.addCoins(top[i].user_id, guild.id, rewards[i]); } catch {}
  }

  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🏆 Classement Hebdomadaire — Top 10 des Actifs')
    .setDescription([
      '*Récap de la semaine passée — bravo aux plus engagés !*',
      '',
      lines,
      '',
      '*🎁 Le top 3 reçoit un bonus en € directement crédité.*',
      '*Continue de discuter cette semaine pour rejoindre le classement !*',
    ].join('\n'))
    .setFooter({ text: 'Zone Entraide · Classement remis à zéro chaque lundi' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    markPosted(guild.id, lastWeek);
    return true;
  } catch { return false; }
}

// Démarre le scheduler — appelé depuis ready.js
function startWeeklyLeaderboardScheduler(client) {
  initWeeklyTable();
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30 min
  // Poste tous les lundis à 12h (heure Paris approximative via UTC)
  const tick = async () => {
    try {
      const now = new Date();
      const day = now.getUTCDay(); // 0=Sunday, 1=Monday
      if (day !== 1) return; // pas lundi
      const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
      const parisHour = (now.getUTCHours() + parisOffset) % 24;
      if (parisHour !== 12) return; // pas midi
      for (const guild of client.guilds.cache.values()) {
        await postWeeklyLeaderboardInGuild(guild).catch(() => {});
      }
    } catch {}
  };
  setTimeout(tick, 90_000);
  setInterval(tick, CHECK_INTERVAL);
  console.log('[weeklyLeaderboard] Scheduler démarré — top 10 chaque lundi midi');
}

module.exports = {
  startWeeklyLeaderboardScheduler,
  incrementWeeklyXP,
  postWeeklyLeaderboardInGuild,
  initWeeklyTable,
};
