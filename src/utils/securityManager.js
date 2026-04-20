// securityManager.js — Sécurité centralisée NexusBot
const db = require('../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS security_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
    reason TEXT DEFAULT 'Aucune raison', added_by TEXT,
    added_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, guild_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS security_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, action TEXT, details TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS security_daily_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
    action TEXT NOT NULL, count INTEGER DEFAULT 1,
    date TEXT DEFAULT (date('now')),
    UNIQUE(user_id, guild_id, action, date)
  )`).run();
} catch {}

const globalUsage = new Map();
const GLOBAL_MAX = 20, GLOBAL_WIN = 60_000;

function checkGlobalRate(userId) {
  const now = Date.now();
  const list = (globalUsage.get(userId) || []).filter(t => now - t < GLOBAL_WIN);
  if (list.length >= GLOBAL_MAX) return { ok: false, waitSec: Math.ceil((GLOBAL_WIN - (now - list[0])) / 1000) };
  list.push(now); globalUsage.set(userId, list);
  return { ok: true };
}

const activeSet = new Set();
function lockCmd(userId, cmd) { const key = `${userId}:${cmd}`; if (activeSet.has(key)) return false; activeSet.add(key); return true; }
function unlockCmd(userId, cmd) { activeSet.delete(`${userId}:${cmd}`); }

function isBlacklisted(userId, guildId) { return !!db.db.prepare('SELECT 1 FROM security_blacklist WHERE user_id=? AND guild_id=?').get(userId, guildId); }
function addBlacklist(userId, guildId, reason, addedBy) { try { db.db.prepare('INSERT OR REPLACE INTO security_blacklist (user_id,guild_id,reason,added_by) VALUES (?,?,?,?)').run(userId, guildId, reason||'Aucune raison', addedBy||'système'); return true; } catch { return false; } }
function removeBlacklist(userId, guildId) { return db.db.prepare('DELETE FROM security_blacklist WHERE user_id=? AND guild_id=?').run(userId, guildId).changes > 0; }
function getBlacklist(guildId) { return db.db.prepare('SELECT * FROM security_blacklist WHERE guild_id=? ORDER BY added_at DESC').all(guildId); }
function checkDailyLimit(userId, guildId, action, maxCount) {
  const row = db.db.prepare('SELECT count FROM security_daily_limits WHERE user_id=? AND guild_id=? AND action=? AND date=date("now")').get(userId, guildId, action);
  const current = row ? row.count : 0;
  if (current >= maxCount) return { ok: false, current, max: maxCount };
  db.db.prepare('INSERT INTO security_daily_limits (user_id,guild_id,action,count) VALUES (?,?,?,1) ON CONFLICT(user_id,guild_id,action,date) DO UPDATE SET count=count+1').run(userId, guildId, action);
  return { ok: true, current: current + 1, max: maxCount };
}
function sanitize(input, maxLen = 200) { if (typeof input !== 'string') return ''; return input.replace(/@(everyone|here)/gi, '@\u200b$1').replace(/`{1,3}[^`]*`{1,3}/g, '[code]').slice(0, maxLen).trim(); }
function auditLog(guildId, userId, action, details) { try { db.db.prepare('INSERT INTO security_audit (guild_id,user_id,action,details) VALUES (?,?,?,?)').run(guildId, userId, action, details||''); } catch {} }
function getAuditLogs(guildId, limit = 20) { return db.db.prepare('SELECT * FROM security_audit WHERE guild_id=? ORDER BY created_at DESC LIMIT ?').all(guildId, limit); }

async function securityCheck(interaction, opts = {}) {
  const { requireAdmin = false, cmdName = interaction.commandName, skipGlobalRate = false } = opts;
  const userId = interaction.user.id, guildId = interaction.guildId;
  if (isBlacklisted(userId, guildId)) { await interaction.reply({ content: '🚫 Vous êtes blacklisté sur ce serveur.', ephemeral: true }); return false; }
  if (!skipGlobalRate) { const rate = checkGlobalRate(userId); if (!rate.ok) { await interaction.reply({ content: `⏳ Trop de commandes ! Réessaie dans **${rate.waitSec}s**.`, ephemeral: true }); return false; } }
  if (requireAdmin && !interaction.member.permissions.has('Administrator')) { await interaction.reply({ content: '🔒 Réservé aux administrateurs.', ephemeral: true }); return false; }
  if (!lockCmd(userId, cmdName)) { await interaction.reply({ content: '⚠️ Commande déjà en cours.', ephemeral: true }); return false; }
  return true;
}
function releaseCmd(interaction, opts = {}) { unlockCmd(interaction.user.id, opts.cmdName || interaction.commandName); }

module.exports = { securityCheck, releaseCmd, isBlacklisted, addBlacklist, removeBlacklist, getBlacklist, checkDailyLimit, sanitize, auditLog, getAuditLogs, checkGlobalRate, lockCmd, unlockCmd };