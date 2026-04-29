// ============================================================
// autoBadgeWorker.js — Détection auto des badges existants
// ============================================================
// Tourne toutes les 5 min, scan tous les users actifs et débloque
// automatiquement les badges qu'ils ont mérité.
// Utilise la table user_badges existante (commands_guild/social/badges.js)
// ============================================================
'use strict';

const db = require('../database/db');

// Conditions pour chaque badge — basées sur les colonnes existantes de la DB
const CONDITIONS = {
  premier_message:  (u) => (u.message_count || 0) >= 1,
  bavard:           (u) => (u.message_count || 0) >= 100,
  orateur:          (u) => (u.message_count || 0) >= 1000,
  vocal_actif:      (u) => (u.voice_minutes || 0) >= 600,
  riche:            (u) => ((u.balance || 0) + (u.bank || 0)) >= 10000,
  millionnaire:     (u) => ((u.balance || 0) + (u.bank || 0)) >= 1000000,
  niveau_5:         (u) => (u.level || 0) >= 5,
  niveau_10:        (u) => (u.level || 0) >= 10,
  niveau_25:        (u) => (u.level || 0) >= 25,
  niveau_50:        (u) => (u.level || 0) >= 50,
};

function grantBadge(guildId, userId, badgeId) {
  try {
    const result = db.db.prepare(
      'INSERT OR IGNORE INTO user_badges (guild_id, user_id, badge_id) VALUES (?, ?, ?)'
    ).run(guildId, userId, badgeId);
    return result.changes > 0;
  } catch {
    return false;
  }
}

function hasBadge(guildId, userId, badgeId) {
  try {
    return !!db.db.prepare('SELECT 1 FROM user_badges WHERE guild_id=? AND user_id=? AND badge_id=?')
      .get(guildId, userId, badgeId);
  } catch { return false; }
}

async function scanGuild(guildId) {
  let granted = 0;
  try {
    // Récupère tous les users actifs (au moins 1€ ou 1 message)
    const users = db.db.prepare(
      'SELECT user_id, balance, bank, message_count, voice_minutes, level FROM users WHERE guild_id=? AND (balance > 0 OR message_count > 0)'
    ).all(guildId);

    for (const user of users) {
      for (const [badgeId, condFn] of Object.entries(CONDITIONS)) {
        try {
          if (condFn(user) && !hasBadge(guildId, user.user_id, badgeId)) {
            if (grantBadge(guildId, user.user_id, badgeId)) {
              granted++;
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('[autoBadge] scanGuild error:', e.message);
  }
  return granted;
}

async function scanAllGuilds(client) {
  let totalGranted = 0;
  try {
    for (const guild of client.guilds.cache.values()) {
      const n = await scanGuild(guild.id);
      totalGranted += n;
    }
    if (totalGranted > 0) {
      console.log(`[autoBadge] ✅ ${totalGranted} badge(s) auto-attribué(s)`);
    }
  } catch (e) {
    console.error('[autoBadge] scanAllGuilds error:', e.message);
  }
  return totalGranted;
}

function startAutoBadgeWorker(client) {
  // Premier scan après 30 sec, puis toutes les 5 min
  setTimeout(() => scanAllGuilds(client).catch(() => {}), 30_000);
  setInterval(() => scanAllGuilds(client).catch(() => {}), 5 * 60 * 1000);
  console.log('[autoBadge] Worker démarré (scan toutes les 5 min)');
}

module.exports = {
  startAutoBadgeWorker,
  scanGuild,
  scanAllGuilds,
  CONDITIONS,
};
