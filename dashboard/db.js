// ============================================================
// dashboard/db.js — Adaptateur base de données NexusBot
// Lit la même SQLite que le bot (lecture seule pour le dash)
// ============================================================
'use strict';

const path    = require('path');
const BetterSqlite3 = require('better-sqlite3');

// Chemin vers la DB du bot (Railway : /app/data/nexusbot.db)
const DB_PATHS = [
  process.env.DB_PATH,
  path.join(__dirname, '../data/nexusbot.db'),
  path.join(__dirname, '../src/database/nexusbot.db'),
  path.join(__dirname, '../nexusbot.db'),
].filter(Boolean);

let _db = null;

function getDB() {
  if (_db) return _db;
  for (const p of DB_PATHS) {
    try {
      _db = new BetterSqlite3(p, { readonly: true, fileMustExist: true });
      console.log('[Dashboard] DB connectée:', p);
      return _db;
    } catch (_) {}
  }
  console.warn('[Dashboard] DB introuvable — données simulées');
  return null;
}

// ── Helpers ───────────────────────────────────────────────

function safeAll(sql, params = []) {
  try {
    const db = getDB();
    if (!db) return [];
    return db.prepare(sql).all(...params);
  } catch (e) {
    console.error('[Dashboard DB]', e.message);
    return [];
  }
}

function safeGet(sql, params = []) {
  try {
    const db = getDB();
    if (!db) return null;
    return db.prepare(sql).get(...params);
  } catch (e) {
    console.error('[Dashboard DB]', e.message);
    return null;
  }
}

// ── API publique ──────────────────────────────────────────

module.exports = {
  // Top N joueurs par solde total (portefeuille + banque)
  getLeaderboard(guildId = null, limit = 50) {
    const sql = guildId
      ? `SELECT user_id, guild_id, balance, COALESCE(bank,0) as bank,
               (balance + COALESCE(bank,0)) as total
         FROM users WHERE guild_id = ?
         ORDER BY total DESC LIMIT ?`
      : `SELECT user_id, guild_id, balance, COALESCE(bank,0) as bank,
               (balance + COALESCE(bank,0)) as total
         FROM users ORDER BY total DESC LIMIT ?`;
    return guildId ? safeAll(sql, [guildId, limit]) : safeAll(sql, [limit]);
  },

  // Stats globales économie
  getEcoStats(guildId = null) {
    const where = guildId ? 'WHERE guild_id = ?' : '';
    const params = guildId ? [guildId] : [];
    return safeGet(
      `SELECT COUNT(*) as users,
              SUM(balance) as total_balance,
              SUM(COALESCE(bank,0)) as total_bank,
              AVG(balance) as avg_balance,
              MAX(balance + COALESCE(bank,0)) as max_total
       FROM users ${where}`,
      params,
    ) ?? { users: 0, total_balance: 0, total_bank: 0, avg_balance: 0, max_total: 0 };
  },

  // Stats par guild
  getGuilds() {
    return safeAll(
      `SELECT guild_id, COUNT(*) as members,
              SUM(balance) as total_coins
       FROM users GROUP BY guild_id ORDER BY members DESC`,
    );
  },

  // Utilisateur spécifique
  getUser(userId, guildId) {
    return safeGet(
      `SELECT * FROM users WHERE user_id = ? AND guild_id = ?`,
      [userId, guildId],
    );
  },

  // Config d'un guild
  getConfig(guildId) {
    return safeGet(`SELECT * FROM config WHERE guild_id = ?`, [guildId]) ?? {};
  },

  // Transactions récentes (si table existe)
  getRecentTransactions(guildId = null, limit = 100) {
    const where = guildId ? 'WHERE guild_id = ?' : '';
    const params = guildId ? [guildId, limit] : [limit];
    return safeAll(
      `SELECT * FROM transactions ${where} ORDER BY created_at DESC LIMIT ?`,
      params,
    );
  },

  // Distribution des richesses (pour graphiques)
  getWealthDistribution(guildId = null) {
    const where = guildId ? 'WHERE guild_id = ?' : '';
    const params = guildId ? [guildId] : [];
    return safeAll(
      `SELECT
         CASE
           WHEN balance < 1000    THEN '0-1K'
           WHEN balance < 10000   THEN '1K-10K'
           WHEN balance < 100000  THEN '10K-100K'
           WHEN balance < 1000000 THEN '100K-1M'
           ELSE '1M+'
         END as range,
         COUNT(*) as count
       FROM users ${where}
       GROUP BY range ORDER BY MIN(balance)`,
      params,
    );
  },

  // Vérifier si un utilisateur a le premium
  isPremium(userId, guildId) {
    const row = safeGet(
      `SELECT premium FROM users WHERE user_id = ? AND guild_id = ?`,
      [userId, guildId],
    );
    return row?.premium === 1;
  },

  // Activer le premium (écriture)
  setPremium(userId, guildId, value = 1) {
    try {
      const db = getDB();
      if (!db) return false;
      // Ouvrir en write pour cette opération
      const writePath = DB_PATHS[0] || DB_PATHS[1];
      const writeDB = new BetterSqlite3(writePath);
      writeDB.prepare(
        `UPDATE users SET premium = ? WHERE user_id = ? AND guild_id = ?`,
      ).run(value, userId, guildId);
      writeDB.close();
      return true;
    } catch (e) {
      console.error('[Dashboard] setPremium error:', e.message);
      return false;
    }
  },
};
