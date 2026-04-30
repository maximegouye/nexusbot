// ============================================================
// economyEvents.js — Worker événements économiques automatiques
// ============================================================
// Gère 3 systèmes en background :
// 1. LUCKY HOUR : 1h aléatoire/jour avec multiplier ×1.5 sur tous les casinos
// 2. CRYPTO EVENTS : pump/dump/news aléatoires toutes les 4-8h
// 3. DAILY TOURNAMENT : reset minuit, top 10 récompensé
// ============================================================

'use strict';

const db = require('../database/db');

// ─── Migrations DB ─────────────────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS economy_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT,
    event_type    TEXT,
    event_data    TEXT,
    starts_at     INTEGER,
    ends_at       INTEGER,
    active        INTEGER DEFAULT 1,
    created_at    INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS daily_tournament (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT,
    user_id       TEXT,
    day           TEXT,
    casino_won    INTEGER DEFAULT 0,
    casino_played INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id, day)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS crypto_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT,
    crypto_id  TEXT,
    headline   TEXT,
    multiplier REAL,
    posted_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  // Ajouter colonne lucky_hour_active dans guild_config
  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('lucky_hour_active')) db.db.prepare('ALTER TABLE guild_config ADD COLUMN lucky_hour_active INTEGER DEFAULT 0').run();
  if (!gc.includes('lucky_hour_until'))  db.db.prepare('ALTER TABLE guild_config ADD COLUMN lucky_hour_until INTEGER DEFAULT 0').run();
} catch {}

// ─── Helpers ───────────────────────────────────────────────────────────────
const ts = () => Math.floor(Date.now() / 1000);
const dayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// Vérifie si Lucky Hour active pour un guild
function isLuckyHourActive(guildId) {
  try {
    const cfg = db.db.prepare('SELECT lucky_hour_active, lucky_hour_until FROM guild_config WHERE guild_id=?').get(guildId);
    if (!cfg) return false;
    return cfg.lucky_hour_active === 1 && (cfg.lucky_hour_until || 0) > ts();
  } catch { return false; }
}

// Multiplier Lucky Hour (1.5 si actif, sinon 1)
function getLuckyMultiplier(guildId) {
  return isLuckyHourActive(guildId) ? 1.5 : 1;
}

// ─── Tracking tournament ───────────────────────────────────────────────────
function trackTournamentWin(guildId, userId, amount) {
  try {
    const day = dayKey();
    db.db.prepare(`INSERT INTO daily_tournament (guild_id, user_id, day, casino_won, casino_played)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(guild_id, user_id, day) DO UPDATE SET
      casino_won = casino_won + ?, casino_played = casino_played + 1`).run(guildId, userId, day, amount, amount);
  } catch {}
}

function getTournamentLeaderboard(guildId, day = null) {
  const d = day || dayKey();
  try {
    return db.db.prepare(`SELECT user_id, casino_won, casino_played FROM daily_tournament
      WHERE guild_id=? AND day=? AND casino_won > 0
      ORDER BY casino_won DESC LIMIT 10`).all(guildId, d);
  } catch { return []; }
}

// ─── Lucky Hour : worker ──────────────────────────────────────────────────
let luckyHourTimer = null;

function startLuckyHourWorker(client) {
  // Toutes les 30 minutes, vérifier si on doit déclencher Lucky Hour
  if (luckyHourTimer) clearInterval(luckyHourTimer);
  luckyHourTimer = setInterval(() => {
    try {
      const now = ts();
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const cfg = db.db.prepare('SELECT lucky_hour_active, lucky_hour_until FROM guild_config WHERE guild_id=?').get(guildId);
          if (!cfg) continue;
          // Si Lucky Hour expirée, désactiver
          if (cfg.lucky_hour_active === 1 && (cfg.lucky_hour_until || 0) <= now) {
            db.db.prepare('UPDATE guild_config SET lucky_hour_active=0 WHERE guild_id=?').run(guildId);
            continue;
          }
          // Si pas active, chance 5% par check de la déclencher (≈ 1 fois /10h)
          if (cfg.lucky_hour_active !== 1 && Math.random() < 0.05) {
            const until = now + 3600;
            db.db.prepare('UPDATE guild_config SET lucky_hour_active=1, lucky_hour_until=? WHERE guild_id=?').run(until, guildId);
            // Annonce dans le salon casino si trouvé
            const casinoChan = guild.channels.cache.find(c => /casino/i.test(c.name) && c.type === 0);
            if (casinoChan) {
              casinoChan.send({
                embeds: [{
                  color: 0xFFD700,
                  title: '🍀 LUCKY HOUR ACTIVÉE ! 🍀',
                  description: '**Pendant 1 HEURE**, tous les gains du casino sont **multipliés ×1.5** !\n\nFonce sur les machines à sous, la roulette, le blackjack...\n\nTu as 60 minutes !',
                  footer: { text: 'Lucky Hour expire automatiquement' },
                  timestamp: new Date().toISOString(),
                }],
              }).catch(() => {});
            }
          }
        } catch {}
      }
    } catch {}
  }, 30 * 60 * 1000); // 30 min
}

// ─── Crypto Events : worker ─────────────────────────────────────────────────
const CRYPTO_NEWS_TEMPLATES = [
  { headline: '📈 PUMP : {crypto} explose après l\'annonce d\'Elon Musk !', multiplier: 1.4 },
  { headline: '🚀 {crypto} atteint un nouveau record historique !', multiplier: 1.3 },
  { headline: '💰 {crypto} adopté par une grande banque européenne !', multiplier: 1.2 },
  { headline: '🌟 {crypto} listé sur Binance Premium !', multiplier: 1.25 },
  { headline: '📉 DUMP : {crypto} chute de 30% après un hack !', multiplier: 0.7 },
  { headline: '⚠️ {crypto} en panne globale pendant 12h !', multiplier: 0.8 },
  { headline: '🔻 {crypto} subit une vague de ventes massives !', multiplier: 0.85 },
  { headline: '😱 {crypto} attaqué par des baleines short-sellers !', multiplier: 0.75 },
  { headline: '🔄 {crypto} stable, marché en consolidation', multiplier: 1.0 },
  { headline: '📊 Volatilité élevée sur {crypto}, prudence !', multiplier: 0.95 },
];

let cryptoEventTimer = null;

function startCryptoEventWorker(client) {
  if (cryptoEventTimer) clearInterval(cryptoEventTimer);
  // Toutes les 4h, déclencher un event sur une crypto random
  cryptoEventTimer = setInterval(() => {
    try {
      // Récupérer toutes les guildes où crypto_market existe
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const cryptos = db.db.prepare('SELECT * FROM crypto_market WHERE guild_id=?').all(guildId);
          if (!cryptos.length) continue;

          // Choisir une crypto random
          const crypto = cryptos[Math.floor(Math.random() * cryptos.length)];
          const tpl = CRYPTO_NEWS_TEMPLATES[Math.floor(Math.random() * CRYPTO_NEWS_TEMPLATES.length)];
          const newPrice = Math.max(0.01, (crypto.price || 1) * tpl.multiplier);

          // Mettre à jour le prix
          db.db.prepare('UPDATE crypto_market SET price=?, change_24h=? WHERE guild_id=? AND id=?')
            .run(newPrice, (tpl.multiplier - 1) * 100, guildId, crypto.id);

          // Logger l'event
          db.db.prepare('INSERT INTO crypto_news (guild_id, crypto_id, headline, multiplier) VALUES (?,?,?,?)')
            .run(guildId, crypto.id || crypto.name, tpl.headline.replace('{crypto}', crypto.name || 'BTC'), tpl.multiplier);

          // Annonce dans le salon économie/marché
          const ecoChan = guild.channels.cache.find(c => /economie|march[eé]|crypto/i.test(c.name) && c.type === 0);
          if (ecoChan && tpl.multiplier !== 1.0) {
            const isPump = tpl.multiplier > 1;
            ecoChan.send({
              embeds: [{
                color: isPump ? 0x2ECC71 : 0xE74C3C,
                title: isPump ? '📈 PUMP CRYPTO' : '📉 DUMP CRYPTO',
                description: tpl.headline.replace('{crypto}', `**${crypto.name || 'BTC'}**`) +
                  `\n\nNouveau prix : **${newPrice.toFixed(2)}€** (${((tpl.multiplier - 1) * 100).toFixed(0)}%)`,
                footer: { text: 'Trade vite avec /crypto !' },
                timestamp: new Date().toISOString(),
              }],
            }).catch(() => {});
          }
        } catch {}
      }
    } catch {}
  }, 4 * 60 * 60 * 1000); // 4h
}

// ─── Tournament Daily Reset + Récompenses ──────────────────────────────────
let tournamentTimer = null;

function startTournamentWorker(client) {
  if (tournamentTimer) clearInterval(tournamentTimer);
  // Vérifier toutes les heures si on est à minuit pour distribuer les récompenses
  tournamentTimer = setInterval(() => {
    try {
      const now = new Date();
      // Distribuer les récompenses uniquement entre 0h et 1h
      if (now.getHours() !== 0) return;
      // Idempotent : on log dans economy_events pour pas distribuer 2x
      const today = dayKey();
      for (const [guildId, guild] of client.guilds.cache) {
        try {
          const already = db.db.prepare("SELECT id FROM economy_events WHERE guild_id=? AND event_type='tournament_reward' AND event_data=?").get(guildId, today);
          if (already) continue;

          const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const lb = getTournamentLeaderboard(guildId, yesterdayDate);
          if (!lb.length) continue;

          const REWARDS = [1_000_000, 500_000, 250_000, 100_000, 50_000, 25_000, 10_000, 5_000, 5_000, 5_000];
          const cfg = db.getConfig(guildId);
          const emoji = cfg.currency_emoji || '€';

          let lines = [];
          for (let i = 0; i < lb.length && i < REWARDS.length; i++) {
            const winner = lb[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i+1}.**`;
            try {
              db.addCoins(winner.user_id, guildId, REWARDS[i]);
              lines.push(`${medal} <@${winner.user_id}> — **${winner.casino_won.toLocaleString('fr')}** gagnés • +${REWARDS[i].toLocaleString('fr')} ${emoji}`);
            } catch {}
          }

          // Annonce
          const annChan = guild.channels.cache.find(c => /casino|annonce/i.test(c.name) && c.type === 0);
          if (annChan && lines.length) {
            annChan.send({
              embeds: [{
                color: 0xFFD700,
                title: '🏆 TOURNOI CASINO QUOTIDIEN — RÉSULTATS',
                description: `**Top 10 du ${yesterdayDate}** :\n\n${lines.join('\n')}\n\n*Bravo à tous !*`,
                footer: { text: 'Le tournoi reset à minuit. Continue à jouer pour grimper !' },
              }],
            }).catch(() => {});
          }

          // Marquer comme distribué
          db.db.prepare("INSERT INTO economy_events (guild_id, event_type, event_data, starts_at, ends_at, active) VALUES (?, 'tournament_reward', ?, ?, ?, 0)")
            .run(guildId, today, ts(), ts());
        } catch {}
      }
    } catch {}
  }, 60 * 60 * 1000); // 1h
}

// ─── INIT global ───────────────────────────────────────────────────────────
function initEconomyEvents(client) {
  startLuckyHourWorker(client);
  startCryptoEventWorker(client);
  startTournamentWorker(client);
  console.log('[economyEvents] ✅ Workers démarrés : Lucky Hour, Crypto Events, Tournament');
}

module.exports = {
  initEconomyEvents,
  isLuckyHourActive,
  getLuckyMultiplier,
  trackTournamentWin,
  getTournamentLeaderboard,
};
