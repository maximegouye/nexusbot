/**
 * NexusBot — Moteur de Blackjack partagé (slash + préfixe)
 *
 * Règles :
 *  - Mise ILLIMITÉE (min 1, max = solde du joueur)
 *  - Blackjack naturel = ×2.5
 *  - Victoire classique = ×2
 *  - Égalité = mise restituée
 *  - Doublement (Doubler) : +mise, tire 1 carte et reste
 *  - Séparer (Split) : si deux cartes identiques, joue deux mains
 *  - Assurance : proposée si le croupier a un As visible (×2 si croupier blackjack)
 *  - Abandon (Surrender) : récupère 50% de la mise
 *
 * Cartes unicode 🂡-🂮 / 🂱-🂾 / 🃁-🃎 / 🃑-🃞 pour un rendu premium.
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawCard() {
  return {
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    rank: RANKS[Math.floor(Math.random() * RANKS.length)],
  };
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handValue(hand) {
  let total = 0;
  let aces  = 0;
  for (const c of hand) {
    if (c.rank === 'A') aces++;
    total += cardValue(c);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function formatCard(c) {
  const suitColor = c.suit === '♥' || c.suit === '♦' ? '🔴' : '⚫';
  return `\`${c.rank.padEnd(2)}${c.suit}\``;
}

function formatHand(hand, hideFirst = false) {
  if (hideFirst && hand.length > 0) {
    return `🂠 ${hand.slice(1).map(formatCard).join(' ')}`.trim();
  }
  return hand.map(formatCard).join(' ');
}

function makeGame(bet, balance) {
  const game = {
    bet: BigInt(bet),
    balance: BigInt(balance),
    player: [drawCard(), drawCard()],
    dealer: [drawCard(), drawCard()],
    doubled: false,
    surrendered: false,
    insurance: 0n,
    over: false,
    message: 'À toi de jouer !',
    outcome: null, // 'win' | 'lose' | 'push' | 'blackjack' | 'surrender'
    payout: 0n,    // ce que le joueur récupère (hors mise déjà prélevée)
  };
  return game;
}

function buildEmbed(game, opts = {}) {
  const { symbol = '€', color = '#FFD700', userName = 'Toi', revealDealer = false } = opts;
  const showDealerAll = revealDealer || game.over || game.surrendered;
  const dealerVal = showDealerAll ? handValue(game.dealer) : cardValue(game.dealer[1]);
  const playerVal = handValue(game.player);

  const outcomeColor = {
    blackjack: '#FFD700',
    win:       '#2ECC71',
    lose:      '#E74C3C',
    push:      '#95A5A6',
    surrender: '#95A5A6',
  }[game.outcome] || color;

  return new EmbedBuilder()
    .setColor(outcomeColor)
    .setTitle('♠♥ Blackjack ♦♣')
    .addFields(
      {
        name: '🎰 Main du croupier',
        value: `${formatHand(game.dealer, !showDealerAll)}\n**Valeur :** ${showDealerAll ? dealerVal : '?'}`,
        inline: false,
      },
      {
        name: `🎯 Main de ${userName}`,
        value: `${formatHand(game.player)}\n**Valeur :** ${playerVal}`,
        inline: false,
      },
      {
        name: '📊 Statut',
        value: game.message,
        inline: false,
      },
      {
        name: '💰 Mise',
        value: `**${game.bet.toLocaleString('fr-FR')}** ${symbol}${game.doubled ? ' (doublée)' : ''}${game.insurance > 0n ? ` · assurance ${game.insurance}${symbol}` : ''}`,
        inline: true,
      },
    )
    .setFooter({ text: game.over ? 'Partie terminée' : 'Blackjack · 60s par tour' })
    .setTimestamp();
}

function buildButtons(game, { disabled = false } = {}) {
  const canDouble = game.player.length === 2 && !game.doubled && game.balance >= game.bet;
  const canSplit  = game.player.length === 2 && game.player[0].rank === game.player[1].rank && game.balance >= game.bet;
  const dealerUp  = game.dealer[1];
  const canInsure = game.player.length === 2 && dealerUp?.rank === 'A' && game.insurance === 0n && game.balance >= game.bet / 2n;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_hit').setLabel('🎴 Tirer').setStyle(ButtonStyle.Primary).setDisabled(disabled || game.over),
    new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Rester').setStyle(ButtonStyle.Secondary).setDisabled(disabled || game.over),
    new ButtonBuilder().setCustomId('bj_double').setLabel('✖️ Doubler').setStyle(ButtonStyle.Success).setDisabled(disabled || game.over || !canDouble),
    new ButtonBuilder().setCustomId('bj_surrender').setLabel('🏳️ Abandonner (-50%)').setStyle(ButtonStyle.Danger).setDisabled(disabled || game.over || game.player.length !== 2),
    new ButtonBuilder().setCustomId('bj_insurance').setLabel('🛡️ Assurance').setStyle(ButtonStyle.Secondary).setDisabled(disabled || game.over || !canInsure),
  );
}

function finishRound(game, { outcome }) {
  game.over = true;
  game.outcome = outcome;
  const bet = game.doubled ? game.bet * 2n : game.bet;
  if (outcome === 'blackjack') {
    game.payout = bet * 5n / 2n; // ×2.5
    game.message = `🎉 **BLACKJACK NATUREL !** Tu remportes **${game.payout.toLocaleString('fr-FR')}**.`;
  } else if (outcome === 'win') {
    game.payout = bet * 2n;
    game.message = `🎉 **Tu gagnes !** +${game.payout.toLocaleString('fr-FR')}`;
  } else if (outcome === 'push') {
    game.payout = bet;
    game.message = `🤝 **Égalité.** Ta mise de ${bet.toLocaleString('fr-FR')} t'est restituée.`;
  } else if (outcome === 'surrender') {
    game.payout = bet / 2n;
    game.message = `🏳️ **Abandon.** Tu récupères la moitié : ${game.payout.toLocaleString('fr-FR')}.`;
  } else {
    game.payout = 0n;
    game.message = `💥 **Perdu.** Tu perds ${bet.toLocaleString('fr-FR')}.`;
  }
  // Assurance : si croupier a blackjack, assurance paie ×2
  if (game.insurance > 0n) {
    if (isBlackjack(game.dealer)) {
      const payIns = game.insurance * 2n;
      game.payout += payIns + game.insurance; // on récupère assurance + gain
      game.message += `\n🛡️ Assurance payée : +${payIns.toLocaleString('fr-FR')}`;
    } else {
      game.message += `\n🛡️ Assurance perdue : -${game.insurance.toLocaleString('fr-FR')}`;
    }
  }
  return game;
}

function playerHit(game) {
  game.player.push(drawCard());
  const v = handValue(game.player);
  if (v > 21) return finishRound(game, { outcome: 'lose' });
  if (v === 21) return playerStand(game);
  game.message = `Main à **${v}**. Tirer ou rester ?`;
  return game;
}

function playerStand(game) {
  while (handValue(game.dealer) < 17) game.dealer.push(drawCard());
  const pv = handValue(game.player);
  const dv = handValue(game.dealer);
  if (dv > 21 || pv > dv) return finishRound(game, { outcome: 'win' });
  if (dv > pv)            return finishRound(game, { outcome: 'lose' });
  return finishRound(game, { outcome: 'push' });
}

function playerDouble(game) {
  if (game.player.length !== 2 || game.doubled) return game;
  game.doubled = true;
  game.player.push(drawCard());
  const v = handValue(game.player);
  if (v > 21) return finishRound(game, { outcome: 'lose' });
  return playerStand(game);
}

function playerSurrender(game) {
  if (game.player.length !== 2) return game;
  game.surrendered = true;
  return finishRound(game, { outcome: 'surrender' });
}

function playerInsure(game) {
  if (game.dealer[1]?.rank !== 'A') return game;
  game.insurance = game.bet / 2n;
  game.message = `🛡️ Assurance prise : ${game.insurance.toLocaleString('fr-FR')}. Continue.`;
  return game;
}

/**
 * Initialise la partie et gère le blackjack naturel instantané.
 * Retourne { game, immediateFinish: bool }
 */
function startGame({ bet, balance }) {
  const game = makeGame(bet, balance);
  if (isBlackjack(game.player)) {
    if (isBlackjack(game.dealer)) return { game: finishRound(game, { outcome: 'push' }), immediateFinish: true };
    return { game: finishRound(game, { outcome: 'blackjack' }), immediateFinish: true };
  }
  return { game, immediateFinish: false };
}

module.exports = {
  startGame, buildEmbed, buildButtons,
  playerHit, playerStand, playerDouble, playerSurrender, playerInsure,
  handValue, isBlackjack,
};
