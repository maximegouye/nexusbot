// ============================================================
// blackjack.js — Blackjack Premium v7 (Vegas Style)
// Cartes ASCII premium, stratégie de base, comptage HiLo,
// Insurance timing, Natural BJ cinématique, Perfect Pair SideBet
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── DB : séries de victoires ─────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bj_streaks (
    user_id   TEXT,
    guild_id  TEXT,
    streak    INTEGER DEFAULT 0,
    best      INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

// ─── DB : Comptage Hi-Lo (simulation) ────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bj_hilocount (
    user_id   TEXT,
    guild_id  TEXT,
    running_count INTEGER DEFAULT 0,
    cards_dealt   INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

function getStreak(userId, guildId) {
  db.db.prepare('INSERT OR IGNORE INTO bj_streaks (user_id, guild_id) VALUES (?,?)').run(userId, guildId);
  return db.db.prepare('SELECT streak, best FROM bj_streaks WHERE user_id=? AND guild_id=?').get(userId, guildId) || { streak: 0, best: 0 };
}
function getHiLoCount(userId, guildId) {
  db.db.prepare('INSERT OR IGNORE INTO bj_hilocount (user_id, guild_id) VALUES (?,?)').run(userId, guildId);
  return db.db.prepare('SELECT running_count, cards_dealt FROM bj_hilocount WHERE user_id=? AND guild_id=?').get(userId, guildId) || { running_count: 0, cards_dealt: 0 };
}
function updateHiLoCount(userId, guildId, delta, cardsUsed = 1) {
  const curr = getHiLoCount(userId, guildId);
  const newRC = curr.running_count + delta;
  const newCD = curr.cards_dealt + cardsUsed;
  db.db.prepare('UPDATE bj_hilocount SET running_count=?, cards_dealt=? WHERE user_id=? AND guild_id=?')
    .run(newRC, newCD, userId, guildId);
  return { running_count: newRC, cards_dealt: newCD };
}
function resetHiLoCount(userId, guildId) {
  db.db.prepare('UPDATE bj_hilocount SET running_count=0, cards_dealt=0 WHERE user_id=? AND guild_id=?')
    .run(userId, guildId);
}

function onWin(userId, guildId) {
  db.db.prepare('INSERT OR IGNORE INTO bj_streaks (user_id, guild_id) VALUES (?,?)').run(userId, guildId);
  db.db.prepare('UPDATE bj_streaks SET streak=streak+1, total_wins=total_wins+1, best=MAX(best,streak+1) WHERE user_id=? AND guild_id=?').run(userId, guildId);
}
function onLose(userId, guildId) {
  db.db.prepare('INSERT OR IGNORE INTO bj_streaks (user_id, guild_id) VALUES (?,?)').run(userId, guildId);
  db.db.prepare('UPDATE bj_streaks SET streak=0 WHERE user_id=? AND guild_id=?').run(userId, guildId);
}
function onPush(userId, guildId) { /* Égalité : streak inchangé */ }

// ─── Multiplicateur de série ──────────────────────────────
function streakMultiplier(streak) {
  if (streak >= 7) return 2.0;
  if (streak >= 5) return 1.75;
  if (streak >= 3) return 1.5;
  if (streak >= 2) return 1.25;
  return 1.0;
}
function streakLabel(streak) {
  if (streak >= 7) return `🔥🔥🔥 ${streak} victoires de suite ! ×2.0`;
  if (streak >= 5) return `🔥🔥 ${streak} victoires de suite ! ×1.75`;
  if (streak >= 3) return `🔥 ${streak} victoires de suite ! ×1.5`;
  if (streak >= 2) return `✨ ${streak} victoires de suite ! ×1.25`;
  return null;
}

// ─── Stratégie de Base (simplifié mais précis) ────────────
function getBasicAdvice(playerTotal, dealerCard) {
  const dv = cardVal(dealerCard);

  // Hard totals (sans As souple)
  if (playerTotal <= 8) return '🃏 Tirer toujours avec 8 ou moins.';
  if (playerTotal === 9) return dv >= 3 && dv <= 6 ? '⬆️ Doubler' : '🃏 Tirer';
  if (playerTotal === 10) return dv <= 9 ? '⬆️ Doubler' : '🃏 Tirer';
  if (playerTotal === 11) return '⬆️ Doubler';
  if (playerTotal === 12) return dv >= 4 && dv <= 6 ? '✋ Rester' : '🃏 Tirer';
  if (playerTotal >= 13 && playerTotal <= 16) {
    return dv >= 2 && dv <= 6 ? '✋ Rester (dealer faible)' : '🃏 Tirer (dealer fort)';
  }
  if (playerTotal >= 17) return '✋ Rester ou... Stand (risque très élevé).';

  return '✋ Rester.';
}

// ─── Deck ─────────────────────────────────────────────────
const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const v of VALUES) deck.push({ suit: s, value: v });
  return shuffle(deck);
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function cardVal(card) {
  if (['J','Q','K'].includes(card.value)) return 10;
  if (card.value === 'A') return 11;
  return parseInt(card.value);
}
function hiLoValue(card) {
  // Comptage Hi-Lo : 2-6 = +1, 7-9 = 0, 10-A = -1
  if (['2','3','4','5','6'].includes(card.value)) return 1;
  if (['7','8','9'].includes(card.value)) return 0;
  return -1;
}
function handValue(hand) {
  let total = hand.reduce((s, c) => s + cardVal(c), 0);
  let aces  = hand.filter(c => c.value === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function cardStr(card) { return `\`${card.value}${card.suit}\``; }
function handStr(hand, hideSecond = false) {
  return hand.map((c, i) => (hideSecond && i === 1) ? '`🂠`' : cardStr(c)).join(' ');
}
function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }
function isSoft17(hand)    { return handValue(hand) === 17 && hand.some(c => c.value === 'A'); }

// ─── Cartes ASCII PREMIUM (style Vegas) ───────────────────
// Discord supporte les codes ANSI dans les code blocks ```ansi```.
// Couleurs : 31=rouge (♥♦), 37=blanc (♣♠), 1=bold, 0=reset.
const ANSI_RESET = '[0m';
const ANSI_RED   = '[1;31m';
const ANSI_WHITE = '[1;37m';
const ANSI_GOLD  = '[1;33m';

function suitColor(suit) {
  return (suit === '♥' || suit === '♦') ? ANSI_RED : ANSI_WHITE;
}

function cardDisplayAscii(card) {
  const suit = card.suit;
  const val = card.value === '10' ? '10' : card.value;
  const padding = val.length === 1 ? ' ' : '';
  const c = suitColor(suit);

  // Carte avec valeur et couleur colorées en ANSI, bordures dorées
  return (
    `${ANSI_GOLD}┌─────┐${ANSI_RESET}\n` +
    `${ANSI_GOLD}│${c}${val}${padding}   ${ANSI_GOLD}│${ANSI_RESET}\n` +
    `${ANSI_GOLD}│${c}  ${suit}  ${ANSI_GOLD}│${ANSI_RESET}\n` +
    `${ANSI_GOLD}│${c}   ${padding}${val}${ANSI_GOLD}│${ANSI_RESET}\n` +
    `${ANSI_GOLD}└─────┘${ANSI_RESET}`
  );
}

// Dos de carte (cachée) — bordures dorées avec motif au centre
function cardBackDisplay() {
  return (
    `${ANSI_GOLD}┌─────┐\n` +
    `│░░░░░│\n` +
    `│░░♣░░│\n` +
    `│░░░░░│\n` +
    `└─────┘${ANSI_RESET}`
  );
}

// ─── Afficher une main de cartes côte à côte ──────────────
function displayHandCards(hand, hideSecond = false) {
  if (hand.length === 0) return '(pas de cartes)';
  const cardLines = hand.map((c, i) =>
    (hideSecond && i === 1)
      ? cardBackDisplay().split('\n')
      : cardDisplayAscii(c).split('\n')
  );
  const maxRows = Math.max(...cardLines.map(l => l.length));
  let result = '';
  for (let row = 0; row < maxRows; row++) {
    result += cardLines.map(lines => lines[row] || '').join(' ') + '\n';
  }
  return result.trim();
}

// ─── Perfect Pair SideBet ─────────────────────────────────
function evalPerfectPair(card1, card2) {
  const sameRank = card1.value === card2.value;
  const sameSuit = card1.suit === card2.suit;
  const sameColor = (card1.suit === '♥' || card1.suit === '♦') === (card2.suit === '♥' || card2.suit === '♦');

  if (!sameRank) return null;
  if (sameSuit) return { name: 'Perfect Pair', payout: 25, emoji: '💎' };
  if (sameColor) return { name: 'Colored Pair', payout: 12, emoji: '♠️' };
  return { name: 'Pair', payout: 5, emoji: '🎴' };
}

// ─── Sessions ─────────────────────────────────────────────
const gameSessions = new Map();
function storeSession(userId, state) {
  const existing = gameSessions.get(userId);
  if (existing?.timeout) clearTimeout(existing.timeout);
  const timeout = setTimeout(() => gameSessions.delete(userId), 15 * 60 * 1000);
  gameSessions.set(userId, { ...state, timeout });
}
function getSession(userId)    { return gameSessions.get(userId); }
function deleteSession(userId) {
  const sess = gameSessions.get(userId);
  if (sess?.timeout) clearTimeout(sess.timeout);
  gameSessions.delete(userId);
}

// ─── Déterminer couleur embed (dynamique) ─────────────────
function getEmbedColor(playerTotal, dealerVisible, status = '') {
  if (status === 'blackjack') return '#FFD700';
  if (status === 'win') return '#27AE60';
  if (status === 'lose' || status === 'bust') return '#C0392B';
  if (status === 'push') return '#F39C12';

  // Couleur dynamique : dealer fort = rouge, joueur fort = vert
  if (dealerVisible && dealerVisible >= 17 && dealerVisible > playerTotal) return '#C0392B';
  if (playerTotal >= 18) return '#27AE60';
  return '#2C3E50';
}

// ─── Embed Premium ────────────────────────────────────────
function buildEmbed(state, status = '') {
  const playerVal = handValue(state.player);
  const dealerVal = state.revealed ? handValue(state.dealer) : '?';
  const color = getEmbedColor(playerVal, state.revealed ? dealerVal : null, status);

  const cfg  = db.getConfig ? db.getConfig(state.guildId) : { currency_emoji: '€' };
  const coin = cfg?.currency_emoji || '€';

  const hiLo = getHiLoCount(state.userId, state.guildId);
  const trueCount = hiLo.cards_dealt > 0 ? (hiLo.running_count / (52 - hiLo.cards_dealt)).toFixed(1) : '0';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 ・ BLACKJACK TABLE ・ 🃏')
    .setDescription('```\n' + '═'.repeat(40) + '\n   CASINO ALMOSNI - 6 Decks ・ S17\n' + '═'.repeat(40) + '\n```');

  // Affichage dealer avec cartes si révélé (couleurs ANSI : ♥♦ rouge, ♣♠ blanc)
  if (state.revealed) {
    embed.addFields({
      name: `🎩 Dealer (${dealerVal})`,
      value: '```ansi\n' + displayHandCards(state.dealer) + '\n```',
      inline: false
    });
  } else {
    // Cartes dealer : 1ère visible, 2ème (et plus) cachées en dos doré
    embed.addFields({
      name: `🎩 Dealer`,
      value: '```ansi\n' + displayHandCards(state.dealer, true) + '\n```',
      inline: false
    });
  }

  // Affichage joueur
  embed.addFields({
    name: `🎮 Vous (Total: ${playerVal})`,
    value: '```ansi\n' + displayHandCards(state.player) + '\n```',
    inline: false
  });

  // Split hand si présente
  if (state.split && state.split.length > 0) {
    embed.addFields({
      name: `🎮 Main 2 (Total: ${handValue(state.split)})`,
      value: '```ansi\n' + displayHandCards(state.split) + '\n```',
      inline: false
    });
  }

  // Mise et side bets
  embed.addFields({ name: '💰 Mise', value: `**${state.mise} ${coin}**`, inline: true });
  if (state.sideBet > 0) {
    embed.addFields({ name: '💎 Side Bet', value: `**${state.sideBet} ${coin}**`, inline: true });
  }

  // Comptage Hi-Lo
  embed.addFields({
    name: '📊 Hi-Lo Count',
    value: `RC: ${hiLo.running_count > 0 ? '+' : ''}${hiLo.running_count} | TC: ${trueCount}`,
    inline: true
  });

  // Série de victoires
  const streakData = getStreak(state.userId, state.guildId);
  if (streakData.streak >= 2) {
    const sLabel = streakLabel(streakData.streak);
    if (sLabel) embed.addFields({ name: '🔥 Série', value: sLabel, inline: false });
  }

  // Footer casino
  embed.setFooter({ text: `Casino Almosni Blackjack • 6 decks • S17 • DAS • RSA` });

  // Message de fin de partie
  if (status) {
    const msgs = {
      win:       '🎉 Vous gagnez !',
      blackjack: '🌟🎊 BLACKJACK NATUREL ! Payé 3:2 ! 🎊🌟',
      lose:      '💸 Dépassé, vous perdez...',
      bust:      '💥 BUST! Dépassé 21 — Perdu.',
      push:      '🤝 Égalité — mise remboursée.',
      surrender: '🏳️ Abandonné — 50% remboursé.',
    };
    embed.setDescription((msgs[status] || status) + '\n\n```\n' + '═'.repeat(40) + '\n```');
  }

  return embed;
}

// ─── Boutons ──────────────────────────────────────────────
function buildButtons(state) {
  const canDouble = state.player.length === 2 && !state.split && !state.doubled;
  const canSplit  = state.player.length === 2
                 && cardVal(state.player[0]) === cardVal(state.player[1])
                 && !state.split;
  const canInsure = state.dealer[0].value === 'A'
                 && state.insurance === null
                 && state.player.length === 2;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${state.userId}`).setLabel('🃏 Tirer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${state.userId}`).setLabel('✋ Rester').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bj_double_${state.userId}`).setLabel('⬆️ Doubler').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_split_${state.userId}`).setLabel('✂️ Split').setStyle(ButtonStyle.Primary).setDisabled(!canSplit),
    new ButtonBuilder().setCustomId(`bj_insure_${state.userId}`).setLabel('🛡️ Assurance').setStyle(ButtonStyle.Danger).setDisabled(!canInsure),
    new ButtonBuilder().setCustomId(`bj_counsel_${state.userId}`).setLabel('💡 Conseil').setStyle(ButtonStyle.Secondary),
  );
  return [row1, row2];
}

function disabledButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_done').setLabel('Partie terminée').setStyle(ButtonStyle.Secondary).setDisabled(true),
  )];
}

function playAgainButtons(userId, mise) {
  return [makeGameRow('bj', userId, mise)];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fin de partie ────────────────────────────────────────
async function endGame(msg, state, status, winMult = 0) {
  state.revealed = true;
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.currency_emoji || '€';
  let payout = 0;

  const streakBefore = getStreak(state.userId, state.guildId).streak;

  if (winMult > 0) {
    const sMult  = streakMultiplier(streakBefore);
    const eff    = winMult * sMult;
    payout = Math.floor(state.mise * eff);
    db.addCoins(state.userId, state.guildId, payout);
    onWin(state.userId, state.guildId);
  } else if (status !== 'push') {
    onLose(state.userId, state.guildId);
  } else {
    onPush(state.userId, state.guildId);
  }

  // ── Évaluation Perfect Pair ──────────────────────────────
  let perfectPairResult = null;
  if (state.sideBet > 0) {
    const pp = evalPerfectPair(state.player[0], state.player[1]);
    if (pp) {
      const sidePayout = state.sideBet * (pp.payout + 1);
      db.addCoins(state.userId, state.guildId, sidePayout);
      perfectPairResult = { won: true, hand: pp, gain: sidePayout };
    } else {
      perfectPairResult = { won: false };
    }
  }

  // Animation révélation
  const revealFrames = [
    { desc: '🎩 *Révélation du trou...*', delay: 600 },
    { desc: '✨ *Calcul du résultat...*', delay: 400 },
  ];
  for (const frame of revealFrames) {
    const tempEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🃏 ・ BLACKJACK TABLE ・ 🃏')
      .setDescription(frame.desc)
      .addFields(
        { name: '🎩 Dealer', value: `${'```\n' + displayHandCards(state.dealer) + '\n```'}`, inline: false },
        { name: '🎮 Vous', value: `${'```\n' + displayHandCards(state.player) + '\n```'}`, inline: false },
      );
    await msg.edit({ embeds: [tempEmbed], components: [] }).catch(() => {});
    await sleep(frame.delay);
  }

  const embed = buildEmbed(state, status);
  const newBalance = db.getUser(state.userId, state.guildId)?.balance || 0;

  // Affichage résultat
  if (payout > 0) {
    const streakNow = getStreak(state.userId, state.guildId).streak;
    const sMult     = streakMultiplier(streakBefore);
    const bonusLine = sMult > 1
      ? `+**${payout} ${coin}** *(série ×${sMult.toFixed(2)})*`
      : `+**${payout} ${coin}**`;
    embed.addFields({ name: '💵 Gain', value: bonusLine, inline: true });
    if (streakNow >= 2) {
      const sl = streakLabel(streakNow);
      if (sl) embed.addFields({ name: '🔥 Nouvelle série', value: sl, inline: false });
    }
  } else if (status !== 'push') {
    embed.addFields({ name: '💵 Perte', value: `-**${state.mise} ${coin}**`, inline: true });
  }

  // Résultat Perfect Pair
  if (perfectPairResult) {
    if (perfectPairResult.won) {
      embed.addFields({
        name: `💎 Perfect Pair: ${perfectPairResult.hand.emoji} ${perfectPairResult.hand.name}`,
        value: `+**${perfectPairResult.gain} ${coin}** (×${perfectPairResult.hand.payout + 1})`,
        inline: false,
      });
    } else {
      embed.addFields({ name: '💎 Perfect Pair: ❌ Pas de paire', value: `−${state.sideBet} ${coin}`, inline: false });
    }
  }

  // Résumé final
  embed.addFields({
    name: '📊 Résumé Session',
    value: `Mains: ${streakBefore + 1} | Win Rate: ${Math.round((getStreak(state.userId, state.guildId).total_wins / Math.max(1, streakBefore + 1)) * 100)}%`,
    inline: false
  });

  embed.setFooter({ text: `Solde: ${newBalance} ${coin} • Casino Almosni Blackjack` });

  deleteSession(state.userId);
  resetHiLoCount(state.userId, state.guildId);
  await msg.edit({ embeds: [embed], components: playAgainButtons(state.userId, state.mise) });
}

// ─── Dealer play ──────────────────────────────────────────
async function dealerPlay(msg, state) {
  state.revealed = true;
  await msg.edit({ embeds: [buildEmbed(state, '')], components: [] });
  await sleep(800);

  while (handValue(state.dealer) < 17 || isSoft17(state.dealer)) {
    const newCard = state.deck.pop();
    state.dealer.push(newCard);
    // Comptage Hi-Lo
    updateHiLoCount(state.userId, state.guildId, hiLoValue(newCard));
    await msg.edit({ embeds: [buildEmbed(state, '')], components: [] });
    await sleep(700);
  }

  const dv = handValue(state.dealer);
  const pv = handValue(state.player);

  if (dv > 21)   return endGame(msg, state, 'win', 2);
  if (pv > dv)   return endGame(msg, state, 'win', 2);
  if (pv < dv)   return endGame(msg, state, 'lose', 0);
  /* égalité */  return endGame(msg, state, 'push', 1);
}

// ─── Démarrer une partie ──────────────────────────────────
async function startGame(source, userId, guildId, mise, sideBet = 0) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  const totalCost = mise + sideBet;

  if (!u || u.balance < totalCost) {
    const errMsg = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}** (coût: ${totalCost} ${coin}).`;
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (getSession(userId)) {
    const errMsg = '⚠️ Partie en cours ! Termines-la d\'abord.';
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (mise < 10) {
    const errMsg = '❌ Mise minimale: **10 €**.';
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }

  db.addCoins(userId, guildId, -totalCost);

  const deck   = newDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];

  // Comptage initial
  [...player, ...dealer].forEach(card => {
    updateHiLoCount(userId, guildId, hiLoValue(card));
  });

  const state = {
    userId, guildId, mise, sideBet, deck, player, dealer,
    revealed: false, insurance: null, split: null, doubled: false,
  };

  function quickEmbed(pCards, dCards, msg_txt) {
    const cn = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const streakData = getStreak(userId, guildId);
    const sl = streakLabel(streakData.streak);
    const hiLo = getHiLoCount(userId, guildId);
    const trueCount = hiLo.cards_dealt > 0 ? (hiLo.running_count / (52 - hiLo.cards_dealt)).toFixed(1) : '0';

    const e = new EmbedBuilder()
      .setColor('#2C3E50').setTitle('🃏 ・ BLACKJACK TABLE ・ 🃏')
      .addFields(
        { name: '🎩 Dealer', value: dCards || '🂠', inline: false },
        { name: '🎮 Vous', value: pCards || '🂠', inline: false },
      )
      .setDescription(msg_txt || '')
      .addFields({ name: '📊 RC | TC', value: `${hiLo.running_count > 0 ? '+' : ''}${hiLo.running_count} | ${trueCount}`, inline: true })
      .setFooter({ text: `Solde: ${u?.balance || 0} ${cn}` });

    if (sideBet > 0) e.addFields({ name: '💎 Side Bet', value: `${sideBet} ${cn}`, inline: true });
    if (sl) e.addFields({ name: '🔥 Série', value: sl, inline: true });
    return e;
  }

  const dealSteps = [
    { pCards: '🂠', dCards: '―', txt: '🃏 *Les cartes volent !*', delay: 500 },
    { pCards: '🂠', dCards: '―', txt: '✨ *Distribution en cours...*', delay: 350 },
    { pCards: handStr(player), dCards: '―', txt: '🃏 *+1 carte joueur*', delay: 400 },
    { pCards: handStr(player), dCards: '🂠', txt: '✨ *Cartes du dealer !*', delay: 400 },
    { pCards: handStr(player), dCards: handStr(dealer, true), txt: '🃏 *Jeu prêt !*', delay: 350 },
  ];

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [quickEmbed(dealSteps[0].pCards, dealSteps[0].dCards, dealSteps[0].txt)], components: [] });
  } else {
    msg = await source.reply({ embeds: [quickEmbed(dealSteps[0].pCards, dealSteps[0].dCards, dealSteps[0].txt)] });
  }

  for (let di = 1; di < dealSteps.length; di++) {
    await sleep(dealSteps[di].delay);
    await msg.edit({ embeds: [quickEmbed(dealSteps[di].pCards, dealSteps[di].dCards, dealSteps[di].txt)], components: [] });
  }
  await sleep(350);

  state.player = player;
  state.dealer = dealer;
  state.revealed = false;

  // ─── Blackjack naturel ? ──────────────────────────────
  if (isBlackjack(player)) {
    state.revealed = true;
    if (isBlackjack(dealer)) {
      db.addCoins(userId, guildId, mise);
      onPush(userId, guildId);
      if (sideBet > 0) db.addCoins(userId, guildId, sideBet);
      const embed = buildEmbed(state, 'push');
      embed.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
      deleteSession(userId);
      resetHiLoCount(userId, guildId);
      await msg.edit({ embeds: [embed], components: playAgainButtons(userId, state.mise) });
      return;
    }

    db.addCoins(userId, guildId, Math.floor(mise * 2.5));
    onWin(userId, guildId);

    // Perfect Pair sur BJ
    let perfectPair = null;
    if (sideBet > 0) {
      const pp = evalPerfectPair(player[0], player[1]);
      if (pp) {
        const sp = sideBet * (pp.payout + 1);
        db.addCoins(userId, guildId, sp);
        perfectPair = { won: true, hand: pp, gain: sp };
      } else {
        perfectPair = { won: false };
      }
    }

    // 🎬 Animation BJ naturel cinématique
    const bjPayout = Math.floor(mise * 2.5);
    const celebFrames = [
      { color: '#FFD700', title: '🎉 BLACKJACK NATUREL ! 🎉', desc: '```\n' + '★'.repeat(40) + '\n' + '        NATURAL BLACKJACK!\n' + '          Payé 3:2 ! ★2.5\n' + '★'.repeat(40) + '\n```' },
      { color: '#F1C40F', title: '✨ 21 PARFAIT ! ✨', desc: `*La table frémit... Vous avez **21** !*` },
      { color: '#FFD700', title: `🎊 +${bjPayout} ${coin} 🎊`, desc: `**+${bjPayout} ${coin}** empochés !\n\n*Payé à 3:2 — la règle d'or du Blackjack !* 🏆` },
    ];
    for (const { color, title, desc: fDesc } of celebFrames) {
      await msg.edit({ embeds: [new EmbedBuilder()
        .setColor(color).setTitle(title).setDescription(fDesc)
        .addFields(
          { name: '🎩 Dealer', value: handStr(dealer), inline: false },
          { name: '🎮 Vous (21 - BJ!)', value: handStr(player), inline: false }
        )
      ], components: [] }).catch(() => {});
      await sleep(500);
    }

    const embed = buildEmbed(state, 'blackjack');
    const sNow  = getStreak(userId, guildId).streak;
    const sl    = streakLabel(sNow);
    if (sl) embed.addFields({ name: '🔥 Série Actuelle', value: sl, inline: false });
    if (perfectPair?.won) {
      embed.addFields({ name: `💎 Perfect Pair: ${perfectPair.hand.emoji} ${perfectPair.hand.name}`, value: `+**${perfectPair.gain} ${coin}**`, inline: false });
    } else if (perfectPair) {
      embed.addFields({ name: '💎 Perfect Pair: ❌ Pas de paire', value: `−${sideBet} ${coin}`, inline: false });
    }
    embed.addFields({ name: '💵 Gain', value: `+**${bjPayout} ${coin}** (3:2)`, inline: true });
    embed.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin} • Casino Almosni Blackjack` });
    deleteSession(userId);
    resetHiLoCount(userId, guildId);
    await msg.edit({ embeds: [embed], components: playAgainButtons(userId, state.mise) });
    return;
  }

  storeSession(userId, state);
  await msg.edit({ embeds: [buildEmbed(state, '')], components: buildButtons(state) });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const customId = interaction.customId;

  // ── Rejouer ───────────────────────────────────────────────
  if (customId.startsWith('bj_replay_')) {
    const parts  = customId.split('_');
    const userId = parts[2];
    const mise   = parseInt(parts[3]);
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Pas ta partie!', ephemeral: true }).catch(() => {});
    }
    await interaction.deferUpdate().catch(() => {});
    await startGame(interaction, userId, interaction.guildId, mise);
    return true;
  }

  // ── Changer mise ──────────────────────────────────────────
  if (customId.startsWith('bj_changemise_')) {
    const parts  = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      // Bouton non déféré → reply() (pas editReply)
      return interaction.reply({ content: '❌ Bouton non autorisé.', ephemeral: true }).catch(() => {});
    }
    await interaction.showModal(changeMiseModal('bj', userId));
    return true;
  }

  // ── Modal mise ────────────────────────────────────────────
  if (customId.startsWith('bj_modal_') && interaction.isModalSubmit()) {
    const parts  = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      // Modal submit auto-déféré par interactionCreate → editReply (pas reply)
      return interaction.editReply({ content: '❌ Modal non autorisé.' }).catch(() => {});
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u       = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      // Modal submit auto-déféré → editReply
      return interaction.editReply({ content: '❌ Mise invalide (min 10).' }).catch(() => {});
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});
    await startGame(interaction, userId, interaction.guildId, newMise);
    return true;
  }

  // ── Conseil stratégique ───────────────────────────────────
  if (customId.startsWith('bj_counsel_')) {
    const parts  = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Bouton non autorisé.', ephemeral: true }).catch(() => {});
    }
    // Defer ephemeral pour pouvoir editReply ensuite (bouton non auto-déféré)
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
    }
    const st = getSession(userId);
    if (!st) {
      return interaction.editReply({ content: '❌ Pas de partie en cours.' }).catch(() => {});
    }
    const playerTotal = handValue(st.player);
    const dealerCard = st.dealer[0];
    const advice = getBasicAdvice(playerTotal, dealerCard);
    return interaction.editReply({
      content: `**💡 Conseil Stratégie Basique:**\n\nTa main: ${handStr(st.player)} = **${playerTotal}**\nCarte dealer: ${cardStr(dealerCard)}\n\n→ ${advice}`,
    }).catch(() => {});
  }

  // ── Boutons in-game ───────────────────────────────────────
  if (!customId.startsWith('bj_')) return;
  const parts  = customId.split('_');
  const userId = parts.length > 2 ? parts[2] : null;

  if (!userId || interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Pas ta partie!', ephemeral: true });
  }

  await interaction.deferUpdate().catch(() => {});
  const st = getSession(userId);
  if (!st) return;

  const action  = parts[1];
  const msg     = interaction.message;
  const guildId = interaction.guildId;
  const coin    = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (action === 'hit') {
    const newCard = st.deck.pop();
    st.player.push(newCard);
    updateHiLoCount(userId, guildId, hiLoValue(newCard));
    const pv = handValue(st.player);
    if (pv > 21) return endGame(msg, st, 'bust', 0);
    if (pv === 21) return dealerPlay(msg, st);
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'stand') {
    await dealerPlay(msg, st);

  } else if (action === 'double') {
    const u2 = db.getUser(userId, guildId);
    if (!u2 || u2.balance < st.mise) return msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });
    db.addCoins(userId, guildId, -st.mise);
    st.mise *= 2;
    const newCard = st.deck.pop();
    st.player.push(newCard);
    updateHiLoCount(userId, guildId, hiLoValue(newCard));
    const pv = handValue(st.player);
    if (pv > 21) return endGame(msg, st, 'bust', 0);
    await dealerPlay(msg, st);

  } else if (action === 'split') {
    const u2 = db.getUser(userId, guildId);
    if (!u2 || u2.balance < st.mise) return;
    db.addCoins(userId, guildId, -st.mise);
    const card = st.player.pop();
    const newCard = st.deck.pop();
    st.split  = [card, newCard];
    const pCard2 = st.deck.pop();
    st.player.push(pCard2);
    updateHiLoCount(userId, guildId, hiLoValue(newCard) + hiLoValue(pCard2));
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'insure') {
    const insureCost = Math.floor(st.mise / 2);
    const u2 = db.getUser(userId, guildId);
    if (!u2 || u2.balance < insureCost) return;
    db.addCoins(userId, guildId, -insureCost);
    st.insurance = true;
    if (isBlackjack(st.dealer)) {
      st.revealed = true;
      db.addCoins(userId, guildId, insureCost * 3);
      deleteSession(userId);
      resetHiLoCount(userId, guildId);
      const e = buildEmbed(st, 'lose');
      e.setDescription('🛡️ Insurance payée 2:1 — Dealer had Blackjack!');
      onLose(userId, guildId);
      e.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
      return msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
    }
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'surrender') {
    deleteSession(userId);
    resetHiLoCount(userId, guildId);
    db.addCoins(userId, guildId, Math.floor(st.mise / 2));
    onLose(userId, guildId);
    const e = buildEmbed(st, 'surrender');
    e.setDescription('🏳️ Abandonné — 50% remboursé.');
    e.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
    await msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Blackjack Premium v7 — Cartes visuelles, Stratégie, Hi-Lo Count')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise principale (min 10)').setRequired(true).setMinValue(10))
    .addIntegerOption(o => o
      .setName('sidebet').setDescription('Perfect Pair Side Bet (opt.)').setMinValue(5)),

  async execute(interaction) {
    const mise    = interaction.options.getInteger('mise');
    const sideBet = interaction.options.getInteger('sidebet') || 0;
    await startGame(interaction, interaction.user.id, interaction.guildId, mise, sideBet);
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
  },

  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage: `&blackjack <mise> [sidebet]` — min 10.');
    const u = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 10) return message.reply('❌ Usage: `&blackjack <mise>` — min 10.');
    const sideBet = parseInt(args[1]) || 0;
    await startGame(message, message.author.id, message.guildId, mise, sideBet);
  },
};
