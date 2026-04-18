/**
 * NexusBot — Jeu de Mines (démineur casino) 5×5.
 *
 * Règles :
 *  - Grille de 25 cases, N mines cachées (1–24)
 *  - Chaque case retournée sans mine augmente le multiplicateur
 *  - Tu peux "Cash out" à tout moment pour empocher gain = mise × multiplicateur
 *  - Si tu cliques sur une mine → perte totale
 *
 * Multiplicateurs calculés via la formule classique :
 *   mult(k) = (25 / (25 - M)) × (24 / (24 - M)) × … × ((26 - k) / (26 - k - M))
 *   où M = nb de mines, k = nb de cases découvertes sans mine
 *
 * L'état est persisté via db.saveGameSession (table game_sessions).
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const GRID_SIZE = 25; // 5x5

function createGame(bet, mines) {
  const M = Math.max(1, Math.min(24, parseInt(mines, 10) || 3));
  // Placer M mines aléatoirement
  const indices = [...Array(GRID_SIZE).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const minesSet = new Set(indices.slice(0, M));
  return {
    bet: bet.toString(),
    mines: M,
    revealed: [],    // indices cliqués safe
    minesIdx: [...minesSet],
    over: false,
    cashed: false,
    exploded: false,
    payout: '0',
  };
}

// Calcule le multiplicateur courant (k cases révélées, M mines)
function multiplier(k, M) {
  let m = 1;
  const safes = 25 - M;
  // Probabilité pour que k cases aléatoires soient toutes safes :
  // P = (safes / 25) × ((safes-1) / 24) × … × ((safes-k+1) / (25-k+1))
  // Gain attendu = 1 / P × (1 - house_edge). On prend house_edge = 3%.
  let p = 1;
  for (let i = 0; i < k; i++) {
    p *= (safes - i) / (25 - i);
  }
  if (p <= 0) return 1;
  m = (1 / p) * 0.97; // 3% edge maison
  return m;
}

function revealSafe(game, idx) {
  if (game.over) return game;
  if (game.revealed.includes(idx)) return game;
  if (game.minesIdx.includes(idx)) {
    game.exploded = true;
    game.over = true;
    return game;
  }
  game.revealed.push(idx);
  // Si toutes les cases safe sont révélées → cash out auto (gain max)
  if (game.revealed.length >= 25 - game.mines) {
    cashOut(game);
  }
  return game;
}

function cashOut(game) {
  if (game.over) return game;
  const k = game.revealed.length;
  if (k === 0) {
    // Cash out sans révéler → mise remboursée
    game.payout = game.bet;
  } else {
    const m = multiplier(k, game.mines);
    const bet = BigInt(game.bet);
    const gain = BigInt(Math.floor(Number(bet) * m));
    game.payout = gain.toString();
  }
  game.cashed = true;
  game.over = true;
  return game;
}

function buildEmbed(game, { userName, symbol, color }) {
  const k = game.revealed.length;
  const mult = multiplier(k, game.mines);
  const bet = BigInt(game.bet);
  const current = game.over ? BigInt(game.payout) : BigInt(Math.floor(Number(bet) * mult));
  const revealedSet = new Set(game.revealed);
  const minesSet = game.over ? new Set(game.minesIdx) : new Set();

  let grid = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      if (game.over && minesSet.has(idx)) grid += '💣';
      else if (revealedSet.has(idx))      grid += '💎';
      else                                grid += '⬛';
      grid += ' ';
    }
    grid += '\n';
  }

  const status = game.exploded
    ? `💥 **BOOM !** Tu as touché une mine. Tu perds **${bet.toLocaleString('fr-FR')}${symbol}**.`
    : game.cashed
    ? `💰 **Cash out !** Tu récupères **${BigInt(game.payout).toLocaleString('fr-FR')}${symbol}**.`
    : `🎯 **${k}** case(s) sûres révélée(s) · multiplicateur **×${mult.toFixed(3)}**`;

  return new EmbedBuilder()
    .setColor(game.exploded ? '#E74C3C' : game.cashed ? '#2ECC71' : color || '#F39C12')
    .setTitle(`💣 Mines — ${game.mines} mine(s) cachée(s)`)
    .setDescription('```\n' + grid + '```\n' + status)
    .addFields(
      { name: '💰 Mise',        value: `${bet.toLocaleString('fr-FR')}${symbol}`,              inline: true },
      { name: '✖️ Multiplicateur', value: `×${mult.toFixed(3)}`,                              inline: true },
      { name: game.over ? (game.exploded ? '💸 Perte' : '💵 Gain') : '💵 Gain potentiel',
        value: `**${(game.exploded ? -bet : current).toLocaleString('fr-FR')}${symbol}**`,    inline: true },
    )
    .setFooter({ text: userName + ' · 💣 Mines · session persistée, tu as 30 min' })
    .setTimestamp();
}

function buildButtons(game) {
  if (game.over) return [];
  const rows = [];
  const revealed = new Set(game.revealed);
  for (let row = 0; row < 5; row++) {
    const ab = new ActionRowBuilder();
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const btn = new ButtonBuilder()
        .setCustomId(`mines_pick:${idx}`)
        .setLabel(revealed.has(idx) ? '💎' : '⬛')
        .setStyle(revealed.has(idx) ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(revealed.has(idx));
      ab.addComponents(btn);
    }
    rows.push(ab);
  }
  // Action row bonus : cash out
  if (game.revealed.length > 0) {
    // Discord limit : 5 rows MAX. Si on a 5 rows de grille, on remplace la dernière par un bouton pleine ligne ? Non, on a besoin de 5 rows pour la grille.
    // On va donc compacter la grille en 5 rows et mettre le cash out INLINE dans la dernière. Mieux : on sacrifie la dernière row pour le cash out si grille est petite.
    // En pratique : on a 5 rows de 5 boutons = exactement la limite. Pas de place pour "Cash Out" séparé.
    // Solution : ajouter un bouton "Cash Out" dans chaque ligne comme 6e... non, 5 max par row.
    // Alternative : on remplace la grille par 4 rows de 6 cases ? Non, 5x5 = 25 cases, ça passe pas.
    // => On sacrifie une case et on met Cash Out comme dernier bouton... bof.
    // Mieux : on fait la grille en premier, puis dès qu'il y a au moins 1 case révélée, Discord accepte 5 rows donc on ne peut pas ajouter la 6ème.
    // => On remplacera visuellement la grille par 5 rows, et on dira à l'user d'utiliser le bouton 🏳️ Cash Out intégré sur le message d'info suivant.
    // Solution simple : on génère 5 rows pour la grille, et on utilise un SÉPARATEUR : le joueur envoie des slash commands ou on utilise message.content pour offrir un cash out.
    // En pratique : limite 5 rows. On va faire grille 4x6 = 24 cases (1 de moins) et dernière row = Cash Out.
    // Mais 4x6 = 24, pas 25. Changeons : grille 4x5 = 20 cases.
  }
  return rows;
}

// Alternative : grille 4×5 (20 cases) + 1 row avec bouton Cash Out
function buildButtons4x5(game) {
  if (game.over) return [];
  const rows = [];
  const revealed = new Set(game.revealed);
  for (let row = 0; row < 4; row++) {
    const ab = new ActionRowBuilder();
    for (let col = 0; col < 5; col++) {
      const idx = row * 5 + col;
      const btn = new ButtonBuilder()
        .setCustomId(`mines_pick:${idx}`)
        .setLabel(revealed.has(idx) ? '💎' : '⬛')
        .setStyle(revealed.has(idx) ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(revealed.has(idx));
      ab.addComponents(btn);
    }
    rows.push(ab);
  }
  // Dernière row : Cash Out
  const cashRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('mines_cash')
      .setLabel(game.revealed.length > 0 ? `💰 Cash Out (${game.revealed.length} révélée${game.revealed.length > 1 ? 's' : ''})` : '💰 Cash Out')
      .setStyle(ButtonStyle.Success)
      .setDisabled(game.revealed.length === 0),
  );
  rows.push(cashRow);
  return rows;
}

module.exports = {
  GRID_SIZE: 20, // on utilise 4x5 = 20 cases pour laisser la 5e row au bouton Cash Out
  createGame: (bet, mines) => {
    // Version 4x5 = 20 cases
    const M = Math.max(1, Math.min(19, parseInt(mines, 10) || 3));
    const indices = [...Array(20).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return {
      bet: bet.toString(), mines: M, revealed: [],
      minesIdx: [...new Set(indices.slice(0, M))],
      over: false, cashed: false, exploded: false, payout: '0',
    };
  },
  multiplier: (k, M) => {
    let p = 1;
    const safes = 20 - M;
    for (let i = 0; i < k; i++) p *= (safes - i) / (20 - i);
    if (p <= 0) return 1;
    return (1 / p) * 0.97;
  },
  revealSafe: (game, idx) => {
    if (game.over) return game;
    if (game.revealed.includes(idx)) return game;
    if (game.minesIdx.includes(idx)) {
      game.exploded = true; game.over = true; return game;
    }
    game.revealed.push(idx);
    if (game.revealed.length >= 20 - game.mines) {
      // full clear - auto cash out
      const k = game.revealed.length;
      let p = 1;
      const safes = 20 - game.mines;
      for (let i = 0; i < k; i++) p *= (safes - i) / (20 - i);
      const m = p > 0 ? (1 / p) * 0.97 : 1;
      const bet = BigInt(game.bet);
      game.payout = BigInt(Math.floor(Number(bet) * m)).toString();
      game.cashed = true;
      game.over = true;
    }
    return game;
  },
  cashOut: (game) => {
    if (game.over) return game;
    const k = game.revealed.length;
    if (k === 0) {
      game.payout = game.bet;
    } else {
      let p = 1;
      const safes = 20 - game.mines;
      for (let i = 0; i < k; i++) p *= (safes - i) / (20 - i);
      const m = p > 0 ? (1 / p) * 0.97 : 1;
      const bet = BigInt(game.bet);
      game.payout = BigInt(Math.floor(Number(bet) * m)).toString();
    }
    game.cashed = true; game.over = true;
    return game;
  },
  buildEmbed: (game, opts) => {
    const { userName = 'Toi', symbol = '€', color = '#F39C12' } = opts || {};
    const k = game.revealed.length;
    let p = 1;
    const safes = 20 - game.mines;
    for (let i = 0; i < k; i++) p *= (safes - i) / (20 - i);
    const mult = p > 0 ? (1 / p) * 0.97 : 1;
    const bet = BigInt(game.bet);
    const current = game.over ? BigInt(game.payout) : BigInt(Math.floor(Number(bet) * mult));
    const revealedSet = new Set(game.revealed);
    const minesSet = game.over ? new Set(game.minesIdx) : new Set();

    let grid = '';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 5; col++) {
        const idx = row * 5 + col;
        grid += game.over && minesSet.has(idx) ? '💣 '
              : revealedSet.has(idx) ? '💎 '
              : '⬛ ';
      }
      grid += '\n';
    }

    const status = game.exploded
      ? `💥 **BOOM !** Tu as cliqué sur une mine. Perte : **${bet.toLocaleString('fr-FR')}${symbol}**.`
      : game.cashed
      ? `💰 **Cash out !** Tu repars avec **${BigInt(game.payout).toLocaleString('fr-FR')}${symbol}**.`
      : `🎯 **${k}** case(s) sûres révélée(s) · multiplicateur actuel **×${mult.toFixed(3)}**`;

    return new EmbedBuilder()
      .setColor(game.exploded ? '#E74C3C' : game.cashed ? '#2ECC71' : color || '#F39C12')
      .setTitle(`💣 Mines — ${game.mines} mine(s) cachée(s) sur 20`)
      .setDescription(grid + '\n' + status)
      .addFields(
        { name: '💰 Mise',           value: `${bet.toLocaleString('fr-FR')}${symbol}`,          inline: true },
        { name: '✖️ Multiplicateur', value: `×${mult.toFixed(3)}`,                             inline: true },
        { name: game.over ? (game.exploded ? '💸 Perte' : '💵 Gain') : '💵 Gain potentiel',
          value: `**${(game.exploded ? -bet : current).toLocaleString('fr-FR')}${symbol}**`,    inline: true },
      )
      .setFooter({ text: userName + ' · 💣 Mines · session persistée, 30 min' })
      .setTimestamp();
  },
  buildButtons: buildButtons4x5,
};
