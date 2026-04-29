// ============================================================
// realCasinoEngine.js — Moteur de probabilités RTP réelles
// ============================================================
// Modèle réaliste type vrai casino. Chaque jeu a un RTP cible
// (Return To Player %) sur le long terme. Les jackpots sont
// rares mais bien dimensionnés.
//
// RTP réels (référence vraie vie) :
//   - Slots                  : 92-96%   (4-8% maison)
//   - Vidéo poker            : 95-99%
//   - Blackjack (basique)    : 95-99%
//   - Roulette européenne    : 97.3%
//   - Roulette américaine    : 94.7%
//   - Baccarat (Banker)      : 98.94%
//   - Craps (Pass Line)      : 98.6%
//   - Plinko                 : 95-99%
//   - Crash                  : 96-99%
//   - Cartes à gratter       : 60-75%
//   - Loterie                : 50-60%
//
// Utilisation côté jeu :
//   const { applyRtp, capWin } = require('../utils/realCasinoEngine');
//   let gain = computeRawGain(...);
//   gain = applyRtp('slots', mise, gain);
//   gain = capWin(mise, gain, 'slots');
// ============================================================
'use strict';

// RTP cibles (Return To Player % sur infinité de parties)
const RTP_TARGETS = {
  slots:        0.95,   // 95%
  'mega-slots': 0.94,   // 94% (plus haute mise = un peu moins favorable)
  blackjack:    0.985,  // 98.5%
  videopoker:   0.97,   // 97%
  roulette:     0.973,  // 97.3% (européenne)
  'roue-fortune': 0.92, // 92% (game show wheel)
  baccarat:       0.9894, // 98.94%
  craps:          0.986,  // 98.6%
  plinko:         0.97,   // 97%
  crash:          0.97,   // 97%
  mines:          0.96,   // 96%
  hilo:           0.97,   // 97%
  'dragon-tiger': 0.965,  // 96.5%
  sicbo:        0.97,   // 97%
  des:          0.95,   // 95%
  hippodrome:   0.92,   // 92% (course)
  war:          0.95,   // 95%
  'coffre-magique': 0.93, // 93%
  grattage:     0.70,   // 70% (vrai grattage français ~65%)
  scratch:      0.70,
  'instant-grattage': 0.70,
  loto:         0.55,   // 55% (vraie loto FR)
  lotto:        0.55,
  default:      0.95,
};

// Plafond maximum par session pour éviter wins absurdes
// Multiplicateur sur la mise (= mise * MAX_WIN_MULT)
const MAX_WIN_MULT = {
  slots:        500,    // mise 1000 → max 500k (sauf jackpot progressif)
  'mega-slots': 1000,   // mise 100k → max 100M (high-roller)
  blackjack:    3,      // 3:2 max + double
  videopoker:   800,    // royal flush
  roulette:     35,     // straight up = 35:1
  'roue-fortune': 25,   // jackpot ×25
  baccarat:     2,      // 2:1 sur tie
  craps:        30,     // odds bets
  plinko:         1000,   // multiplicateurs extrêmes
  crash:          100,    // safe cash-out
  mines:          500,    // gros multiplicateurs
  hilo:           500,
  'dragon-tiger': 8,
  sicbo:        180,    // triple specific
  des:          30,
  hippodrome:   12,
  war:          20,
  'coffre-magique': 7,  // x7 max niveau
  grattage:     50000,  // vrai grattage, max 500k€ pour mise 10€
  scratch:      50000,
  default:      100,
};

// Probabilité d'un jackpot (vrai jackpot, paie énormément)
const JACKPOT_RATE = {
  slots:        1 / 25000,  // 0.004%
  'mega-slots': 1 / 50000,
  roulette:     0,          // pas de jackpot, juste straight up 35x
  'roue-fortune': 1 / 1000, // 0.1%
  plinko:       1 / 5000,
  mines:        1 / 10000,
  crash:        1 / 8000,
  grattage:     1 / 3000,   // grattage = jackpot un peu plus fréquent (numéros 1M sur 1000)
  scratch:      1 / 3000,
  default:      0,
};

// Multiplicateur du jackpot (sur la mise)
const JACKPOT_MULT = {
  slots:        500,
  'mega-slots': 2000,
  'roue-fortune': 100,
  plinko:       1000,
  mines:        2000,
  crash:        500,
  grattage:     100000,  // vrai jackpot grattage
  scratch:      100000,
  default:      500,
};

// ─── Helpers ─────────────────────────────────────────────

/**
 * Récupère le RTP cible pour un jeu
 */
function getRTP(game) {
  return RTP_TARGETS[game] ?? RTP_TARGETS.default;
}

/**
 * Récupère le plafond de gain (multiplicateur sur la mise)
 */
function getMaxWinMult(game) {
  return MAX_WIN_MULT[game] ?? MAX_WIN_MULT.default;
}

/**
 * Cap absolu sur le gain pour un spin/round.
 * Ne s'applique pas si le jeu a légitimement déclenché un jackpot
 * (le caller est responsable de skip ce cap pour les jackpots).
 */
function capWin(game, mise, gain) {
  const max = getMaxWinMult(game) * mise;
  return Math.min(gain, Math.floor(max));
}

/**
 * Applique un ajustement RTP sur un gain brut.
 * Garde la variance du jeu (gros gains restent gros) mais
 * normalise globalement vers le RTP cible.
 *
 * Idée : on multiplie le gain brut par (RTP_cible / RTP_actuel_estime)
 * où RTP_actuel_estime est calé à 1.0 par défaut (jeu non corrigé).
 *
 * Utilisation simple : applyRtp(game, mise, gain) → gain ajusté
 */
function applyRtp(game, mise, gain) {
  const rtp = getRTP(game);
  // Si le jeu paie en moyenne 1× la mise (RTP=100%), on le tire vers RTP cible
  // Le facteur d'ajustement est donc juste rtp (95% → on multiplie par 0.95)
  // Mais on garde au moins 1€ pour pas insulter sur une victoire
  if (gain <= 0) return 0;
  const adjusted = Math.floor(gain * rtp);
  return Math.max(1, adjusted);
}

/**
 * Tire un événement jackpot (true/false) pour ce jeu.
 * Si oui, on calcule un gain jackpot basé sur la mise + petit bonus aléatoire.
 */
function rollJackpot(game, mise) {
  const rate = JACKPOT_RATE[game] ?? JACKPOT_RATE.default;
  if (rate <= 0) return null;
  if (Math.random() >= rate) return null;
  const mult = JACKPOT_MULT[game] ?? JACKPOT_MULT.default;
  // Bonus 80%-120% pour la variance
  const variance = 0.8 + Math.random() * 0.4;
  return Math.floor(mise * mult * variance);
}

/**
 * Génère un résultat réaliste pour un grattage / scratch card.
 * Mise = prix du ticket. Returns un payout ou 0.
 *
 * Distribution type vrai grattage :
 *   - 50% perdant (0)
 *   - 30% remboursé (= mise)
 *   - 12% petit gain (×2-5)
 *   - 5% gain moyen (×10-50)
 *   - 2.7% gros gain (×100-500)
 *   - 0.3% jackpot (×10 000-100 000)
 */
function scratchResult(mise, type = 'classic') {
  const r = Math.random();
  if (r < 0.50) return { payout: 0, label: 'Perdu', emoji: '😢' };
  if (r < 0.80) return { payout: mise, label: 'Remboursé', emoji: '🪙' };
  if (r < 0.92) {
    const m = 2 + Math.floor(Math.random() * 4); // ×2 à ×5
    return { payout: mise * m, label: `Petit gain ×${m}`, emoji: '✨' };
  }
  if (r < 0.97) {
    const m = 10 + Math.floor(Math.random() * 41); // ×10 à ×50
    return { payout: mise * m, label: `Gain moyen ×${m}`, emoji: '💎' };
  }
  if (r < 0.997) {
    const m = 100 + Math.floor(Math.random() * 401); // ×100 à ×500
    return { payout: mise * m, label: `Gros gain ×${m}`, emoji: '🏆' };
  }
  const m = 10000 + Math.floor(Math.random() * 90001); // ×10k à ×100k
  return { payout: mise * m, label: `🎉 JACKPOT ×${m}`, emoji: '💰' };
}

module.exports = {
  RTP_TARGETS,
  MAX_WIN_MULT,
  JACKPOT_RATE,
  JACKPOT_MULT,
  getRTP,
  getMaxWinMult,
  capWin,
  applyRtp,
  rollJackpot,
  scratchResult,
};
