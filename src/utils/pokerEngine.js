/**
 * NexusBot — Video Poker "Jacks or Better"
 *
 * Phases :
 *  1. Deal : 5 cartes distribuées.
 *  2. Hold : le joueur garde 0–5 cartes, les autres sont remplacées.
 *  3. Showdown : calcul de la main finale, gain selon table.
 *
 * Paytable (multiplicateur × mise) :
 *  - Quinte Flush Royale : ×250
 *  - Quinte Flush         : ×50
 *  - Carré                : ×25
 *  - Full                 : ×9
 *  - Couleur              : ×6
 *  - Quinte               : ×4
 *  - Brelan               : ×3
 *  - Double paire         : ×2
 *  - Paire de valets+ (J/Q/K/A) : ×1 (rembourse la mise)
 *  - Rien                 : 0
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_IDX = { A: 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

function drawCard(used) {
  while (true) {
    const s = SUITS[Math.floor(Math.random() * 4)];
    const r = RANKS[Math.floor(Math.random() * 13)];
    const id = r + s;
    if (!used.has(id)) { used.add(id); return { rank: r, suit: s, id }; }
  }
}

function deal5() {
  const used = new Set();
  const hand = [];
  for (let i = 0; i < 5; i++) hand.push(drawCard(used));
  return { hand, used };
}

function evaluateHand(hand) {
  const ranks = hand.map(c => RANK_IDX[c.rank]).sort((a, b) => a - b);
  const suits = hand.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  // Straight (gérer A-2-3-4-5)
  let isStraight = false;
  const uniqRanks = [...new Set(ranks)];
  if (uniqRanks.length === 5) {
    if (uniqRanks[4] - uniqRanks[0] === 4) isStraight = true;
    // A-2-3-4-5 : ranks = [2,3,4,5,14]
    if (uniqRanks.join(',') === '2,3,4,5,14') isStraight = true;
  }

  // Compter les occurrences
  const counts = {};
  for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
  const countsSorted = Object.values(counts).sort((a, b) => b - a);

  if (isFlush && isStraight && ranks[4] === 14 && ranks[0] === 10) return { mult: 250, label: '👑 QUINTE FLUSH ROYALE !' };
  if (isFlush && isStraight)                                     return { mult: 50,  label: '✨ Quinte Flush' };
  if (countsSorted[0] === 4)                                     return { mult: 25,  label: '🎯 Carré' };
  if (countsSorted[0] === 3 && countsSorted[1] === 2)            return { mult: 9,   label: '🎴 Full' };
  if (isFlush)                                                   return { mult: 6,   label: '🌈 Couleur' };
  if (isStraight)                                                return { mult: 4,   label: '📏 Quinte' };
  if (countsSorted[0] === 3)                                     return { mult: 3,   label: '🎲 Brelan' };
  if (countsSorted[0] === 2 && countsSorted[1] === 2)            return { mult: 2,   label: '👯 Double paire' };
  // Paire de valets ou plus
  for (const [r, c] of Object.entries(counts)) {
    if (c === 2 && parseInt(r) >= 11) return { mult: 1, label: '💪 Paire de ' + (r === '11' ? 'Valets' : r === '12' ? 'Dames' : r === '13' ? 'Rois' : 'As') };
  }
  return { mult: 0, label: '💨 Rien — retente !' };
}

function formatHand(hand, held = new Set()) {
  return hand.map((c, i) => {
    const mark = held.has(i) ? '🔒' : '  ';
    return `${mark} \`${c.rank.padEnd(2)}${c.suit}\``;
  }).join(' ');
}

function serialize(state) {
  return {
    bet: state.bet.toString(),
    hand: state.hand,
    used: [...state.used],
    held: [...state.held],
    phase: state.phase,
    result: state.result,
  };
}

function deserialize(data) {
  return {
    bet: BigInt(data.bet),
    hand: data.hand || [],
    used: new Set(data.used || []),
    held: new Set(data.held || []),
    phase: data.phase || 'hold',
    result: data.result || null,
  };
}

function buildEmbed(state, { userName, symbol, color }) {
  const bet = state.bet;
  const heldArr = [...state.held].sort((a, b) => a - b);

  if (state.phase === 'hold') {
    return new EmbedBuilder()
      .setColor(color || '#9B59B6')
      .setTitle('🎴 Video Poker — Jacks or Better')
      .setDescription(
        '**Tes 5 cartes :**\n' + formatHand(state.hand, state.held) + '\n\n' +
        '🔒 = carte conservée · *(les autres seront remplacées)*\n\n' +
        'Clique sur chaque carte pour la **garder/relâcher**, puis **Tirer**.',
      )
      .addFields(
        { name: '💰 Mise', value: `${bet.toLocaleString('fr-FR')}${symbol}`, inline: true },
        { name: '🔒 Conservées', value: heldArr.length ? heldArr.map(i => i + 1).join(', ') : 'aucune', inline: true },
      )
      .setFooter({ text: userName + ' · 🎴 Poker · 30 min pour jouer' });
  }

  // phase = 'done'
  const { mult, label } = state.result || { mult: 0, label: '?' };
  const gain = BigInt(Math.floor(Number(bet) * mult));
  const net  = gain - bet;
  const color2 = mult === 0 ? '#E74C3C' : mult >= 25 ? '#9B59B6' : '#2ECC71';

  return new EmbedBuilder()
    .setColor(color2)
    .setTitle(mult >= 25 ? `🎊 ${label}` : mult > 0 ? `🎉 ${label}` : '💨 Perdu')
    .setDescription('**Main finale :**\n' + formatHand(state.hand) + '\n\n' + label)
    .addFields(
      { name: '💰 Mise',        value: `${bet.toLocaleString('fr-FR')}${symbol}`,            inline: true },
      { name: '✖️ Multiplicateur', value: `×${mult}`,                                         inline: true },
      { name: '🏆 Gain',         value: `${gain.toLocaleString('fr-FR')}${symbol}`,           inline: true },
      { name: net >= 0n ? '📈 Bénéfice' : '📉 Perte',
        value: `**${net > 0n ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
    )
    .setFooter({ text: '🎴 Video Poker · NexusBot' })
    .setTimestamp();
}

function buildButtons(state) {
  if (state.phase !== 'hold') return [];
  const held = state.held;
  const row1 = new ActionRowBuilder();
  for (let i = 0; i < 5; i++) {
    row1.addComponents(new ButtonBuilder()
      .setCustomId(`poker_hold:${i}`)
      .setLabel(`${held.has(i) ? '🔒' : '🔓'} ${state.hand[i].rank}${state.hand[i].suit}`)
      .setStyle(held.has(i) ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('poker_draw').setLabel('🎴 Tirer les nouvelles cartes').setStyle(ButtonStyle.Primary),
  );
  return [row1, row2];
}

function toggleHold(state, idx) {
  if (state.phase !== 'hold') return state;
  if (state.held.has(idx)) state.held.delete(idx);
  else state.held.add(idx);
  return state;
}

function resolve(state) {
  if (state.phase !== 'hold') return state;
  // Remplacer les cartes non conservées
  for (let i = 0; i < 5; i++) {
    if (!state.held.has(i)) {
      state.hand[i] = drawCard(state.used);
    }
  }
  state.result = evaluateHand(state.hand);
  state.phase = 'done';
  return state;
}

function startGame(bet) {
  const { hand, used } = deal5();
  return { bet: BigInt(bet), hand, used, held: new Set(), phase: 'hold', result: null };
}

module.exports = { startGame, toggleHold, resolve, buildEmbed, buildButtons, serialize, deserialize, evaluateHand };
