/**
 * NexusBot — Cache Leaderboard
 * Réduit les requêtes DB répétées sur les classements.
 * Les leaderboards sont mis en cache 60s max.
 */

const db = require('../database/db');

const cache = new Map();
const TTL = 60 * 1000; // 60 secondes

/**
 * Obtenir le classement avec cache.
 * @param {string} guildId
 * @param {'xp'|'coins'|'voice'|'messages'} type
 * @param {number} limit
 */
function getLeaderboard(guildId, type = 'xp', limit = 10) {
  const key = `${guildId}:${type}:${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  let data;
  switch (type) {
    case 'xp':
      data = db.db.prepare('SELECT user_id, xp, level FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
      break;
    case 'coins':
      data = db.db.prepare('SELECT user_id, balance FROM users WHERE guild_id=? ORDER BY balance DESC LIMIT ?').all(guildId, limit);
      break;
    case 'voice':
      data = db.db.prepare('SELECT user_id, voice_minutes FROM users WHERE guild_id=? ORDER BY voice_minutes DESC LIMIT ?').all(guildId, limit);
      break;
    case 'messages':
      data = db.db.prepare('SELECT user_id, message_count FROM users WHERE guild_id=? ORDER BY message_count DESC LIMIT ?').all(guildId, limit);
      break;
    default:
      data = [];
  }

  cache.set(key, { data, ts: Date.now() });
  return data;
}

/** Invalider le cache d'un serveur (ex: après une grosse modification) */
function invalidate(guildId) {
  for (const key of cache.keys()) {
    if (key.startsWith(guildId + ':')) cache.delete(key);
  }
}

/** Nettoyage automatique des entrées expirées toutes les 5 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache.entries()) {
    if (now - val.ts > TTL * 5) cache.delete(key);
  }
}, 5 * 60 * 1000);

module.exports = { getLeaderboard, invalidate };
