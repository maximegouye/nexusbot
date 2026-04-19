/**
 * NexusBot — Moteur de Machine à sous CASINO premium
 * 5 rouleaux × 3 rangs, 20 lignes de paiement.
 *
 * Symboles (10) : 🍒 🍋 🍊 🍇 🔔 ⭐ 💎 7️⃣ + 🃏 WILD + 🎁 SCATTER
 *
 * Paylines (20) — positions 0-2 par rouleau (0=haut, 1=milieu, 2=bas) :
 *   Lignes horizontales × 3, diagonales × 2, zigzags × 15
 *
 * Règles :
 *   - 3 / 4 / 5 identiques sur une payline = gain (multiplicateurs progressifs)
 *   - 🃏 WILD remplace tous les symboles sauf 🎁 SCATTER
 *   - 3+ 🎁 SCATTER anywhere = 10 free spins
 *   - Gain total = somme des gains par payline
 *
 * Pensé pour un rendu immersif : hold, respin, auto-spin, cérémonies.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ═══════════════════════════════════════════════════════════════════
// SYMBOLES
// ═══════════════════════════════════════════════════════════════════
const SYMBOLS = [
  { id: 'CERISE',  emoji: '🍒',  weight: 35, pay: { 3: 2,    4: 5,    5: 12   } },
  { id: 'CITRON',  emoji: '🍋',  weight: 28, pay: { 3: 3,    4: 8,    5: 20   } },
  { id: 'ORANGE',  emoji: '🍊',  weight: 22, pay: { 3: 4,    4: 10,   5: 30   } },
  { id: 'RAISIN',  emoji: '🍇',  weight: 17, pay: { 3: 5,    4: 15,   5: 45   } },
  { id: 'CLOCHE',  emoji: '🔔',  weight: 12, pay: { 3: 8,    4: 25,   5: 75   } },
  { id: 'ETOILE',  emoji: '⭐',  weight:  8, pay: { 3: 15,   4: 50,   5: 150  } },
  { id: 'DIAMANT', emoji: '💎',  weight:  5, pay: { 3: 30,   4: 100,  5: 300  } },
  { id: 'SEVEN',   emoji: '7️⃣', weight:  3, pay: { 3: 100,  4: 500,  5: 2500 } },
  { id: 'WILD',    emoji: '🃏',  weight:  2, pay: { 3: 50,   4: 250,  5: 1000 } },
  { id: 'SCATTER', emoji: '🎁',  weight:  2, pay: { 3: 5,    4: 20,   5: 100  } }, // mise × multi
];
const POOL = SYMBOLS.flatMap(s => Array(s.weight).fill(s));
const byId = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));

// ═══════════════════════════════════════════════════════════════════
// PAYLINES — chaque ligne = 5 positions (0..2)
// ═══════════════════════════════════════════════════════════════════
const PAYLINES = [
  // Horizontales
  [1,1,1,1,1],  // milieu
  [0,0,0,0,0],  // haut
  [2,2,2,2,2],  // bas
  // Diagonales
  [0,1,2,1,0],  // V
  [2,1,0,1,2],  // ^
  // Zigzags / v
  [1,0,1,2,1],
  [1,2,1,0,1],
  [0,0,1,2,2],
  [2,2,1,0,0],
  [0,1,1,1,0],
  [2,1,1,1,2],
  [1,0,0,0,1],
  [1,2,2,2,1],
  [0,1,0,1,0],
  [2,1,2,1,2],
  [1,1,0,1,1],
  [1,1,2,1,1],
  [0,2,0,2,0],
  [2,0,2,0,2],
  [0,2,1,2,0],
];

// ═══════════════════════════════════════════════════════════════════
// SPIN ENGINE
// ═══════════════════════════════════════════════════════════════════
function pickSymbol() { return POOL[Math.floor(Math.random() * POOL.length)]; }

/**
 * Génère une grille 5 rouleaux × 3 rangs.
 * grille[col][row] = symbole
 */
function spinGrid() {
  const g = [];
  for (let c = 0; c < 5; c++) {
    g.push([pickSymbol(), pickSymbol(), pickSymbol()]);
  }
  return g;
}

/**
 * Re-spin ciblé : ne re-génère que les colonnes non tenues.
 * held = array de booléens (5 colonnes)
 */
function respinGrid(oldGrid, held) {
  const g = [];
  for (let c = 0; c < 5; c++) {
    g.push(held[c] ? oldGrid[c] : [pickSymbol(), pickSymbol(), pickSymbol()]);
  }
  return g;
}

/**
 * Évalue UNE payline : renvoie la plus longue chaîne depuis la gauche.
 * Retourne { length, symbolId } ou null.
 * - Wild remplace tout sauf Scatter.
 * - Les chaînes démarrent TOUJOURS par la gauche.
 */
function evalPayline(grid, line) {
  const seq = line.map((row, col) => grid[col][row]);
  // Premier symbole "ancrage" : si wild on prend le prochain non-wild non-scatter comme base
  const firstNonWild = seq.find(s => s.id !== 'WILD' && s.id !== 'SCATTER');
  if (!firstNonWild) {
    // Que des wilds = gain max (traité comme WILD)
    return { length: 5, symbolId: 'WILD' };
  }
  const baseId = seq[0].id === 'WILD' ? firstNonWild.id : seq[0].id;
  if (baseId === 'SCATTER') return null; // scatters ne paient pas en ligne
  let len = 0;
  for (let i = 0; i < seq.length; i++) {
    const s = seq[i];
    if (s.id === baseId || s.id === 'WILD') len++;
    else break;
  }
  if (len < 3) return null;
  return { length: len, symbolId: baseId };
}

/**
 * Évalue la grille complète.
 * Retourne :
 *   { totalWin, payouts: [{line, symbolId, length, amount}], scatterCount, bigType }
 */
function evaluate(grid, mise) {
  const payouts = [];
  let totalWin = 0;
  // Paylines
  PAYLINES.forEach((line, idx) => {
    const r = evalPayline(grid, line);
    if (r) {
      const sym = byId[r.symbolId];
      const mult = sym.pay[r.length] || 0;
      const amount = Math.floor(mise * mult / 20); // mise totale divisée par 20 paylines
      if (amount > 0) {
        totalWin += amount;
        payouts.push({ line: idx, symbolId: r.symbolId, length: r.length, amount });
      }
    }
  });
  // Scatters (anywhere)
  let scatterCount = 0;
  for (let c = 0; c < 5; c++) for (let r = 0; r < 3; r++) {
    if (grid[c][r].id === 'SCATTER') scatterCount++;
  }
  if (scatterCount >= 3) {
    const scatterMult = byId.SCATTER.pay[Math.min(5, scatterCount)] || 0;
    const scatterAmount = mise * scatterMult;
    totalWin += scatterAmount;
    payouts.push({ line: -1, symbolId: 'SCATTER', length: scatterCount, amount: scatterAmount, freeSpins: 10 });
  }
  // Type de gain
  let bigType = null;
  if (totalWin >= mise * 50) bigType = 'JACKPOT';
  else if (totalWin >= mise * 10) bigType = 'MEGA';
  else if (totalWin >= mise * 3) bigType = 'BIG';
  return { totalWin, payouts, scatterCount, bigType };
}

// ═══════════════════════════════════════════════════════════════════
// RENDU DISCORD
// ═══════════════════════════════════════════════════════════════════
function renderGrid(grid, locked) {
  const lines = [];
  for (let r = 0; r < 3; r++) {
    const row = grid.map((col, cIdx) => {
      const e = col[r].emoji;
      return locked && locked[cIdx] ? `[${e}]` : e;
    }).join(' ｜ ');
    lines.push(row);
  }
  return lines.join('\n');
}

function renderGridSpinning(lockedReels) {
  // Affiche des ❔ pour les rouleaux qui tournent encore
  const lines = [];
  for (let r = 0; r < 3; r++) {
    const row = [0,1,2,3,4].map(c => {
      if (lockedReels[c]) return '🎰';
      return '❔';
    }).join(' ｜ ');
    lines.push(row);
  }
  return lines.join('\n');
}

/**
 * Panneau principal de la machine (état idle avec mise réglable)
 */
function buildMenuEmbed({ userName, mise, balance, symbol, color, freeSpins = 0, session, cfgBg }) {
  const sessionStats = session || { spins: 0, totalBet: 0, totalWon: 0, biggest: 0 };
  const bg = cfgBg || '╔════════════════════╗\n║  🎰 MACHINE VEGAS  ║\n╚════════════════════╝';
  return new EmbedBuilder()
    .setColor(color || '#FFD700')
    .setTitle('🎰 Machine à sous — VEGAS ROYALE')
    .setDescription([
      '```',
      bg,
      '```',
      '## 🎯 Mise actuelle',
      `### **${mise.toLocaleString('fr-FR')}${symbol}**`,
      freeSpins > 0 ? `### 🎁 **${freeSpins} free spins restants !**` : '',
      '',
      `**👛 Solde :** ${balance.toLocaleString('fr-FR')}${symbol}`,
      '',
      '> 🎯 Ajuste ta mise avec les boutons `−` et `+`',
      '> 🎰 Appuie sur **TIRER LE LEVIER** pour lancer',
      '> 📊 Voir la **Table des gains** pour tout savoir',
    ].filter(Boolean).join('\n'))
    .addFields(
      { name: '🌀 Tours', value: `${sessionStats.spins}`, inline: true },
      { name: '💸 Misé', value: `${sessionStats.totalBet.toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '🏆 Gagné', value: `${sessionStats.totalWon.toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '🎯 Meilleur coup', value: `${sessionStats.biggest.toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '📈 Solde net', value: `${(sessionStats.totalWon - sessionStats.totalBet).toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '🎰 Machine', value: `**${SYMBOLS.length} symboles · 20 lignes**`, inline: true },
    )
    .setFooter({ text: `${userName} · Casino Royale · 2025` });
}

/**
 * Embed pendant spin (rouleaux qui tournent)
 */
function buildSpinningEmbed({ userName, mise, symbol, color, locked }) {
  return new EmbedBuilder()
    .setColor(color || '#9B59B6')
    .setTitle('🎰 LES ROULEAUX TOURNENT…')
    .setDescription([
      '```',
      '╔══════════════════════════════╗',
      renderGridSpinning(locked).split('\n').map(l => `║ ${l.padEnd(28)} ║`).join('\n').replace(/\n/g, '\n'),
      '╚══════════════════════════════╝',
      '```',
      `Mise : **${mise.toLocaleString('fr-FR')}${symbol}**`,
      '',
      `> 🌀 ${locked.filter(Boolean).length}/5 rouleaux verrouillés`,
    ].join('\n'))
    .setFooter({ text: `${userName} · En cours…` });
}

/**
 * Embed résultat (après tous les rouleaux fixés)
 */
function buildResultEmbed({ userName, mise, result, grid, balance, symbol, color, freeSpin = false }) {
  const { totalWin, payouts, scatterCount, bigType } = result;
  const won = totalWin > 0;
  const pickColor = bigType === 'JACKPOT' ? '#FFD700'
                   : bigType === 'MEGA'    ? '#9B59B6'
                   : bigType === 'BIG'     ? '#2ECC71'
                   : won                    ? '#F39C12'
                   :                          '#E74C3C';

  let title = '🎰 ';
  if (bigType === 'JACKPOT') title += '🏆🎊 JACKPOT !!! 🎊🏆';
  else if (bigType === 'MEGA') title += '💥 MEGA WIN !';
  else if (bigType === 'BIG')  title += '🔥 BIG WIN !';
  else if (won)                title += 'Gagné !';
  else                         title += 'Perdu…';

  // Détails des lignes gagnantes (max 5)
  const linesText = payouts.slice(0, 5).map(p => {
    if (p.line === -1) {
      return `🎁 **${p.length} scatters** → +${p.amount.toLocaleString('fr-FR')}${symbol} + **${p.freeSpins} free spins**`;
    }
    const sym = byId[p.symbolId];
    return `Ligne **${p.line + 1}** · ${p.length}× ${sym.emoji} → **+${p.amount.toLocaleString('fr-FR')}${symbol}**`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(pickColor)
    .setTitle(title)
    .setDescription([
      '```',
      '╔══════════════════════════════╗',
      ...renderGrid(grid).split('\n').map(l => `║ ${l.padEnd(28)} ║`),
      '╚══════════════════════════════╝',
      '```',
      freeSpin ? '### 🎁 Free spin — mise gratuite !' : '',
      linesText ? `\n**💫 Lignes gagnantes :**\n${linesText}` : '\n*Aucune combinaison gagnante.*',
      payouts.length > 5 ? `\n*…et ${payouts.length - 5} autre(s) ligne(s)*` : '',
    ].filter(Boolean).join('\n'))
    .addFields(
      { name: '💰 Mise',         value: `${mise.toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '🏆 Gain',         value: `**${totalWin.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: won ? '📈 Bénéfice' : '📉 Perte', value: `**${totalWin - (freeSpin ? 0 : mise) > 0 ? '+' : ''}${(totalWin - (freeSpin ? 0 : mise)).toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: '👛 Solde', value: `${balance.toLocaleString('fr-FR')}${symbol}`, inline: true },
      { name: '🎁 Scatters', value: `${scatterCount}`, inline: true },
      { name: '🔥 Type', value: bigType || (won ? 'Normal' : '—'), inline: true },
    )
    .setFooter({ text: `${userName} · Casino Royale` })
    .setTimestamp();
}

/**
 * Paytable (modal d'info)
 */
function buildPaytableEmbed(symbol, color) {
  const fields = SYMBOLS.map(s => ({
    name: `${s.emoji} ${s.id}`,
    value: `3× : ×${s.pay[3]}\n4× : ×${s.pay[4]}\n5× : ×${s.pay[5]}`,
    inline: true,
  }));
  return new EmbedBuilder()
    .setColor(color || '#3498DB')
    .setTitle('📊 Table des gains — Vegas Royale')
    .setDescription([
      '**🃏 WILD** remplace tous les symboles sauf 🎁 Scatter.',
      '**🎁 SCATTER** : 3+ n\'importe où = **10 free spins + gain scatter**.',
      '',
      '**Multiplicateur** appliqué à `mise × multi / 20 paylines`',
      '**20 lignes** actives à chaque spin.',
    ].join('\n'))
    .addFields(fields);
}

// ═══════════════════════════════════════════════════════════════════
// BOUTONS
// ═══════════════════════════════════════════════════════════════════
function buildMenuButtons(userId, mise, freeSpins) {
  // Row 1 : ajuster mise
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:-1000`).setLabel('−1K').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:-100`).setLabel('−100').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:half`).setLabel('½').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:+100`).setLabel('+100').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:+1000`).setLabel('+1K').setStyle(ButtonStyle.Secondary),
  );
  // Row 2 : mises grandes + max
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:+10000`).setLabel('+10K').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:+100000`).setLabel('+100K').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:+1000000`).setLabel('+1M').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:custom`).setLabel('✍️ Perso').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cslot_bet:${userId}:max`).setLabel('MAX').setStyle(ButtonStyle.Danger),
  );
  // Row 3 : action principale
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_spin:${userId}`).setLabel(freeSpins > 0 ? `🎁 Free Spin (${freeSpins})` : '🎰 TIRER LE LEVIER').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cslot_auto:${userId}:5`).setLabel('▶ Auto ×5').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cslot_auto:${userId}:25`).setLabel('▶▶ Auto ×25').setStyle(ButtonStyle.Primary),
  );
  // Row 4 : infos & quitter
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_paytable:${userId}`).setLabel('📊 Table des gains').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_reset:${userId}`).setLabel('🔄 Reset mise').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_quit:${userId}`).setLabel('🚪 Quitter').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2, row3, row4];
}

/**
 * Boutons affichés après un spin : HOLD par rouleau + respin + continuer
 */
function buildAfterSpinButtons(userId, held, canRespin) {
  const row1 = new ActionRowBuilder().addComponents(
    ...[0,1,2,3,4].map(i =>
      new ButtonBuilder()
        .setCustomId(`cslot_hold:${userId}:${i}`)
        .setLabel(held[i] ? `🔒 R${i+1}` : `R${i+1}`)
        .setStyle(held[i] ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_respin:${userId}`).setLabel('🔄 Re-spin (−50%)').setStyle(ButtonStyle.Primary).setDisabled(!canRespin),
    new ButtonBuilder().setCustomId(`cslot_gamble:${userId}`).setLabel('🎴 Double or nothing').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`cslot_continue:${userId}`).setLabel('✅ Continuer').setStyle(ButtonStyle.Success),
  );
  return [row1, row2];
}

/**
 * Boutons gamble (double up) — rouge ou noir
 */
function buildGambleButtons(userId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cslot_gamble_pick:${userId}:red`).setLabel('🟥 Rouge').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`cslot_gamble_pick:${userId}:black`).setLabel('⬛ Noir').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cslot_gamble_cancel:${userId}`).setLabel('❌ Encaisser').setStyle(ButtonStyle.Success),
  )];
}

module.exports = {
  SYMBOLS, PAYLINES, byId,
  spinGrid, respinGrid, evaluate,
  renderGrid, renderGridSpinning,
  buildMenuEmbed, buildSpinningEmbed, buildResultEmbed, buildPaytableEmbed,
  buildMenuButtons, buildAfterSpinButtons, buildGambleButtons,
};
