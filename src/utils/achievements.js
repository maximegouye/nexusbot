// ============================================================
// achievements.js — Système d'achievements / badges (30+)
// ============================================================
// Auto-détection sur les actions du joueur. Stocke dans une table
// dédiée. Notification ephemerale au déblocage. Récompense en coins.
// ============================================================
'use strict';

const db = require('../database/db');

// ─── Init table ──────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS achievements (
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    badge_id   TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, guild_id, badge_id)
  )`).run();
  // Compteurs cumulatifs (jeux joués, gains, etc) pour détecter les achievements
  db.db.prepare(`CREATE TABLE IF NOT EXISTS achievement_stats (
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    games_played       INTEGER DEFAULT 0,
    games_won          INTEGER DEFAULT 0,
    total_winnings     INTEGER DEFAULT 0,
    biggest_win        INTEGER DEFAULT 0,
    jackpots_hit       INTEGER DEFAULT 0,
    daily_streak       INTEGER DEFAULT 0,
    max_daily_streak   INTEGER DEFAULT 0,
    messages_sent      INTEGER DEFAULT 0,
    commands_used      INTEGER DEFAULT 0,
    items_bought       INTEGER DEFAULT 0,
    bets_placed        INTEGER DEFAULT 0,
    losses_in_a_row    INTEGER DEFAULT 0,
    wins_in_a_row      INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch (e) {
  console.error('[achievements] init table error:', e.message);
}

// ─── Liste des achievements ──────────────────────────────
// reward : montant en coins
// secret : badge caché (pas dans la liste publique)
const BADGES = [
  // ── Premier pas ──
  { id: 'first_command',   emoji: '👋', name: 'Premier pas',          desc: 'Utilise ta première commande.',          reward: 100,    check: s => s.commands_used >= 1 },
  { id: 'first_daily',     emoji: '📅', name: 'Habitué',              desc: 'Récupère ton premier daily.',            reward: 500,    check: s => s.daily_streak >= 1 },
  { id: 'first_win',       emoji: '🎯', name: 'Première victoire',    desc: 'Gagne ton premier jeu.',                  reward: 250,    check: s => s.games_won >= 1 },

  // ── Jeux joués ──
  { id: 'gamer_10',        emoji: '🎮', name: 'Joueur Occasionnel',   desc: 'Joue 10 parties.',                        reward: 500,    check: s => s.games_played >= 10 },
  { id: 'gamer_100',       emoji: '🎲', name: 'Joueur Régulier',      desc: 'Joue 100 parties.',                       reward: 5000,   check: s => s.games_played >= 100 },
  { id: 'gamer_1000',      emoji: '🕹️', name: 'Vétéran du Casino',   desc: 'Joue 1 000 parties.',                     reward: 50000,  check: s => s.games_played >= 1000 },
  { id: 'gamer_10000',     emoji: '🏆', name: 'Légende des Casinos',  desc: 'Joue 10 000 parties.',                    reward: 500000, check: s => s.games_played >= 10000 },

  // ── Victoires ──
  { id: 'wins_10',         emoji: '✅', name: 'Petit Veinard',        desc: 'Gagne 10 parties.',                       reward: 750,    check: s => s.games_won >= 10 },
  { id: 'wins_100',        emoji: '🌟', name: 'Veinard',              desc: 'Gagne 100 parties.',                      reward: 7500,   check: s => s.games_won >= 100 },
  { id: 'wins_1000',       emoji: '💫', name: 'Maître de la Chance',  desc: 'Gagne 1 000 parties.',                    reward: 75000,  check: s => s.games_won >= 1000 },

  // ── Argent gagné cumulé ──
  { id: 'rich_10k',        emoji: '💵', name: '10K en poche',         desc: 'Gagne au total 10 000 €.',                reward: 1000,   check: s => s.total_winnings >= 10000 },
  { id: 'rich_100k',       emoji: '💴', name: '100K — Millionnaire',  desc: 'Gagne au total 100 000 €.',               reward: 10000,  check: s => s.total_winnings >= 100000 },
  { id: 'rich_1m',         emoji: '💰', name: 'Millionnaire',         desc: 'Gagne au total 1 000 000 €.',             reward: 100000, check: s => s.total_winnings >= 1000000 },
  { id: 'rich_10m',        emoji: '🤑', name: 'Multi-Millionnaire',   desc: 'Gagne au total 10 000 000 €.',            reward: 1000000,check: s => s.total_winnings >= 10000000 },
  { id: 'rich_100m',       emoji: '👑', name: 'Roi du Casino',         desc: 'Gagne au total 100 000 000 €.',           reward: 10000000,check: s => s.total_winnings >= 100000000 },

  // ── Plus gros gain en une fois ──
  { id: 'big_win_5k',      emoji: '💸', name: 'Gros coup',            desc: 'Gagne 5 000 € en une seule partie.',      reward: 500,    check: s => s.biggest_win >= 5000 },
  { id: 'big_win_50k',     emoji: '💎', name: 'Énorme coup',          desc: 'Gagne 50 000 € en une seule partie.',     reward: 5000,   check: s => s.biggest_win >= 50000 },
  { id: 'big_win_500k',    emoji: '🌠', name: 'Coup d\'éclat',        desc: 'Gagne 500 000 € en une seule partie.',    reward: 50000,  check: s => s.biggest_win >= 500000 },
  { id: 'big_win_5m',      emoji: '🚀', name: 'Mega Coup',            desc: 'Gagne 5 000 000 € en une seule partie.',  reward: 500000, check: s => s.biggest_win >= 5000000 },

  // ── Jackpots ──
  { id: 'jackpot_1',       emoji: '🎰', name: 'Premier Jackpot',      desc: 'Touche ton premier jackpot.',             reward: 5000,   check: s => s.jackpots_hit >= 1 },
  { id: 'jackpot_5',       emoji: '🎊', name: 'Chasseur de Jackpot',  desc: 'Touche 5 jackpots.',                      reward: 25000,  check: s => s.jackpots_hit >= 5 },
  { id: 'jackpot_25',      emoji: '🎁', name: 'Maître Jackpot',       desc: 'Touche 25 jackpots.',                     reward: 250000, check: s => s.jackpots_hit >= 25 },

  // ── Streaks ──
  { id: 'streak_7',        emoji: '🔥', name: 'Une semaine',          desc: 'Daily 7 jours d\'affilée.',               reward: 5000,   check: s => s.max_daily_streak >= 7 },
  { id: 'streak_30',       emoji: '☄️', name: 'Un mois',              desc: 'Daily 30 jours d\'affilée.',              reward: 50000,  check: s => s.max_daily_streak >= 30 },
  { id: 'streak_100',      emoji: '🌋', name: 'Persévérant',          desc: 'Daily 100 jours d\'affilée.',             reward: 500000, check: s => s.max_daily_streak >= 100 },

  // ── Wins consécutifs ──
  { id: 'hot_streak_5',    emoji: '🔥', name: 'En feu',               desc: 'Gagne 5 parties d\'affilée.',             reward: 2500,   check: s => s.wins_in_a_row >= 5 },
  { id: 'hot_streak_10',   emoji: '🔥🔥', name: 'En FEU',             desc: 'Gagne 10 parties d\'affilée.',            reward: 25000,  check: s => s.wins_in_a_row >= 10 },

  // ── Pertes consécutives (humour) ──
  { id: 'unlucky_5',       emoji: '😢', name: 'Pas de bol',           desc: 'Perds 5 parties d\'affilée. Bouton consolation !', reward: 1000, check: s => s.losses_in_a_row >= 5 },
  { id: 'unlucky_20',      emoji: '🥲', name: 'Maudit',               desc: 'Perds 20 parties d\'affilée. Reprends-toi !', reward: 10000, check: s => s.losses_in_a_row >= 20 },

  // ── Activité serveur ──
  { id: 'msg_100',         emoji: '💬', name: 'Bavard',               desc: 'Envoie 100 messages.',                    reward: 500,    check: s => s.messages_sent >= 100 },
  { id: 'msg_1000',        emoji: '🗣️', name: 'Pipelette',            desc: 'Envoie 1 000 messages.',                  reward: 5000,   check: s => s.messages_sent >= 1000 },
  { id: 'cmd_500',         emoji: '⚡', name: 'Power User',           desc: 'Utilise 500 commandes.',                  reward: 5000,   check: s => s.commands_used >= 500 },

  // ── Shopping ──
  { id: 'shop_first',      emoji: '🛍️', name: 'Premier Achat',       desc: 'Achète ton premier item au shop.',         reward: 250,    check: s => s.items_bought >= 1 },
  { id: 'shop_50',         emoji: '🛒', name: 'Shopaholic',           desc: 'Achète 50 items au shop.',                reward: 5000,   check: s => s.items_bought >= 50 },

  // ── Paris ──
  { id: 'bet_100',         emoji: '🎲', name: 'Parieur',              desc: 'Place 100 paris.',                        reward: 2500,   check: s => s.bets_placed >= 100 },
];

const BADGE_MAP = Object.fromEntries(BADGES.map(b => [b.id, b]));

// ─── API ─────────────────────────────────────────────────
function ensureStats(userId, guildId) {
  try {
    db.db.prepare('INSERT OR IGNORE INTO achievement_stats (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
  } catch {}
}

function getStats(userId, guildId) {
  ensureStats(userId, guildId);
  return db.db.prepare('SELECT * FROM achievement_stats WHERE user_id=? AND guild_id=?').get(userId, guildId) || {};
}

function addStat(userId, guildId, statName, delta = 1) {
  ensureStats(userId, guildId);
  const allowed = ['games_played','games_won','total_winnings','biggest_win','jackpots_hit','daily_streak','max_daily_streak','messages_sent','commands_used','items_bought','bets_placed','losses_in_a_row','wins_in_a_row'];
  if (!allowed.includes(statName)) return;
  try {
    if (statName === 'biggest_win' || statName === 'max_daily_streak') {
      db.db.prepare(`UPDATE achievement_stats SET ${statName} = MAX(${statName}, ?) WHERE user_id=? AND guild_id=?`).run(delta, userId, guildId);
    } else {
      db.db.prepare(`UPDATE achievement_stats SET ${statName} = ${statName} + ? WHERE user_id=? AND guild_id=?`).run(delta, userId, guildId);
    }
  } catch {}
}

function setStat(userId, guildId, statName, value) {
  ensureStats(userId, guildId);
  const allowed = ['games_played','games_won','total_winnings','biggest_win','jackpots_hit','daily_streak','max_daily_streak','messages_sent','commands_used','items_bought','bets_placed','losses_in_a_row','wins_in_a_row'];
  if (!allowed.includes(statName)) return;
  try {
    db.db.prepare(`UPDATE achievement_stats SET ${statName} = ? WHERE user_id=? AND guild_id=?`).run(value, userId, guildId);
  } catch {}
}

function hasBadge(userId, guildId, badgeId) {
  return !!db.db.prepare('SELECT 1 FROM achievements WHERE user_id=? AND guild_id=? AND badge_id=?').get(userId, guildId, badgeId);
}

function unlockBadge(userId, guildId, badgeId) {
  if (hasBadge(userId, guildId, badgeId)) return null;
  const b = BADGE_MAP[badgeId];
  if (!b) return null;
  try {
    db.db.prepare('INSERT INTO achievements (user_id, guild_id, badge_id, unlocked_at) VALUES (?, ?, ?, ?)')
      .run(userId, guildId, badgeId, Math.floor(Date.now() / 1000));
    if (b.reward > 0) {
      try { db.addCoins(userId, guildId, b.reward, { type: 'achievement', note: `Badge: ${b.name}` }); } catch {}
    }
    return b;
  } catch { return null; }
}

// Vérifie tous les achievements du user, débloque les nouveaux
// Retourne la liste des badges nouvellement débloqués
function checkAchievements(userId, guildId) {
  const stats = getStats(userId, guildId);
  const newlyUnlocked = [];
  for (const b of BADGES) {
    if (hasBadge(userId, guildId, b.id)) continue;
    try {
      if (b.check(stats)) {
        const unlocked = unlockBadge(userId, guildId, b.id);
        if (unlocked) newlyUnlocked.push(unlocked);
      }
    } catch (_) {}
  }
  return newlyUnlocked;
}

// Helper pour les jeux : enregistrer une partie + check
function recordGame(userId, guildId, { won = false, gain = 0, bet = 0, jackpot = false } = {}) {
  ensureStats(userId, guildId);
  addStat(userId, guildId, 'games_played', 1);
  if (won) {
    addStat(userId, guildId, 'games_won', 1);
    addStat(userId, guildId, 'wins_in_a_row', 1);
    setStat(userId, guildId, 'losses_in_a_row', 0);
  } else {
    addStat(userId, guildId, 'losses_in_a_row', 1);
    setStat(userId, guildId, 'wins_in_a_row', 0);
  }
  if (gain > 0) {
    addStat(userId, guildId, 'total_winnings', gain);
    addStat(userId, guildId, 'biggest_win', gain);
  }
  if (jackpot) addStat(userId, guildId, 'jackpots_hit', 1);
  return checkAchievements(userId, guildId);
}

function getUserBadges(userId, guildId) {
  const rows = db.db.prepare('SELECT badge_id, unlocked_at FROM achievements WHERE user_id=? AND guild_id=? ORDER BY unlocked_at ASC')
    .all(userId, guildId);
  return rows.map(r => ({ ...BADGE_MAP[r.badge_id], unlocked_at: r.unlocked_at })).filter(b => b.id);
}

function getAllBadges() { return BADGES.slice(); }

module.exports = {
  BADGES,
  BADGE_MAP,
  getStats,
  addStat,
  setStat,
  hasBadge,
  unlockBadge,
  checkAchievements,
  recordGame,
  getUserBadges,
  getAllBadges,
};
