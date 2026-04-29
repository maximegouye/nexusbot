// ============================================================
// economyBalancer.js — Anti-snowball + Owner boost discret
// ============================================================
//
// Configuration via variables d'environnement (Railway > Variables) :
//   OWNER_ID         = ton ID Discord (clic droit pseudo → Copier l'ID en mode dev)
//   ECONOMY_DISABLED = "true" pour désactiver totalement le système
//
// Comportement :
//  • Top 10% riches (par guild)  → RTP × 0.97 (-3%) + 0.3% chance/spin de malaise (perte 5-10%)
//  • OWNER_ID                    → RTP × 1.06 (+6%), immunisé aux malaises, +1% chance jackpot
//  • Autres                      → RTP × 1.00 (neutre)
//
// Le système est silencieux — aucun log ne révèle qui est qui.
// La taxe riches est expliquable comme une "house edge progressive".
// ============================================================

const db = require('../database/db');

const ECONOMY_DISABLED = process.env.ECONOMY_DISABLED === 'true';
const OWNER_ID         = process.env.OWNER_ID || null;

// ─── Cache des wallet listings (rafraîchi toutes les 60s par guild) ──
const richCache = new Map(); // guildId → { ts, topRich: Set<userId> }
const RICH_CACHE_TTL_MS = 60_000;

function getTopRich(guildId) {
  const now = Date.now();
  const cached = richCache.get(guildId);
  if (cached && now - cached.ts < RICH_CACHE_TTL_MS) return cached.topRich;

  let topRich = new Set();
  try {
    const rows = db.db.prepare(
      'SELECT user_id, balance FROM users WHERE guild_id = ? AND balance > 0 ORDER BY balance DESC'
    ).all(guildId);
    if (rows.length >= 10) {
      const topN = Math.ceil(rows.length * 0.10); // top 10%
      topRich = new Set(rows.slice(0, topN).map(r => r.user_id));
    }
  } catch { /* DB pas prête, ignore */ }

  richCache.set(guildId, { ts: now, topRich });
  return topRich;
}

// ─── Modifier RTP pour un user (gains × ce modifier) ─────
// Retourne { rtp: number, isOwner: bool, isRich: bool }
function getLuckModifier(userId, guildId) {
  if (ECONOMY_DISABLED) return { rtp: 1.0, isOwner: false, isRich: false };

  if (OWNER_ID && userId === OWNER_ID) {
    return { rtp: 1.06, isOwner: true, isRich: false };
  }

  const topRich = getTopRich(guildId);
  if (topRich.has(userId)) {
    return { rtp: 0.97, isOwner: false, isRich: true };
  }

  return { rtp: 1.0, isOwner: false, isRich: false };
}

// ─── Applique le modifier RTP à un montant gagné ─────────
// Utiliser SEULEMENT sur les gains (jamais sur les mises ou pertes).
// Garantit qu'un gain de 0 reste 0 (pas de magie négative).
function adjustGain(gain, userId, guildId) {
  if (gain <= 0) return gain;
  const mod = getLuckModifier(userId, guildId);
  return Math.max(0, Math.floor(gain * mod.rtp));
}

// ─── Vérifie un événement "malaise" aléatoire pour les riches ──
// À appeler dans les commandes casino, après le jeu.
// Retourne null OU { type, message, amount }
//
// Le malaise prélève automatiquement le solde du user.
const MALAISES = [
  { type: 'crypto_crash',  emoji: '📉', message: '**Crash crypto !** Tes investissements ont fondu de **{pct}%** !' },
  { type: 'casino_loss',   emoji: '🎰', message: '**Mauvaise nuit au casino**. Le croupier a pris **{pct}%** de ton solde sans prévenir...' },
  { type: 'thief',         emoji: '🚓', message: '**Vol nocturne !** Un cambrioleur t\'a délesté de **{pct}%** de ton coffre.' },
  { type: 'tax_audit',     emoji: '📋', message: '**Contrôle fiscal !** Le fisc a saisi **{pct}%** de tes gains non déclarés.' },
  { type: 'bad_advice',    emoji: '💼', message: '**Mauvais conseiller financier**. Il s\'est enfui avec **{pct}%** de tes économies !' },
  { type: 'broken_safe',   emoji: '🔓', message: '**Coffre-fort forcé !** Tu as perdu **{pct}%** de ton solde.' },
  { type: 'fake_jackpot',  emoji: '🪤', message: '**Arnaque ! Le jackpot était truqué** — tu as perdu **{pct}%** dans une fausse loterie.' },
];

function rollMalaise(userId, guildId) {
  if (ECONOMY_DISABLED) return null;
  const mod = getLuckModifier(userId, guildId);
  if (mod.isOwner) return null;          // owner immunisé
  if (!mod.isRich) return null;          // seuls les top 10% sont concernés

  if (Math.random() > 0.003) return null; // 0.3% par appel

  const u = db.getUser(userId, guildId);
  if (!u || u.balance < 1000) return null; // pas la peine pour les soldes trop bas

  const pct = 0.05 + Math.random() * 0.05; // 5% à 10%
  const amount = Math.max(50, Math.floor(u.balance * pct));

  // Prélever
  try { db.removeCoins(userId, guildId, amount); } catch { return null; }

  const m = MALAISES[Math.floor(Math.random() * MALAISES.length)];
  return {
    type: m.type,
    emoji: m.emoji,
    message: m.message.replace('{pct}', Math.round(pct * 100)),
    amount,
  };
}

// ─── Bonus owner : +1% chance sur les jackpots ────────────
// Appelle ça à la place de Math.random() pour les events rares.
// Pour OWNER, retourne true 1% plus souvent.
function jackpotRoll(userId, guildId, baseChance) {
  if (ECONOMY_DISABLED) return Math.random() < baseChance;
  const mod = getLuckModifier(userId, guildId);
  const adjusted = mod.isOwner ? baseChance + 0.01 : baseChance;
  return Math.random() < adjusted;
}

// ─── Helper : applique malaise sur embed (helper UI) ───────
// Retourne le texte à ajouter à la description si malaise, sinon ''
function malaiseEmbedText(malaise, coin) {
  if (!malaise) return '';
  return `\n\n${malaise.emoji} *${malaise.message}* (-${malaise.amount.toLocaleString('fr-FR')} ${coin})`;
}

module.exports = {
  getLuckModifier,
  adjustGain,
  rollMalaise,
  jackpotRoll,
  malaiseEmbedText,
  // Pour debug admin
  _stats: (guildId) => ({
    enabled: !ECONOMY_DISABLED,
    ownerSet: !!OWNER_ID,
    richCount: getTopRich(guildId).size,
  }),
};
