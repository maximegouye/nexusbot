// ============================================================
// blackjack.js — Blackjack complet (v4)
// Nouveautés : série de victoires (streak bonus) + pari annexe 21+3
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

function getStreak(userId, guildId) {
  db.db.prepare('INSERT OR IGNORE INTO bj_streaks (user_id, guild_id) VALUES (?,?)').run(userId, guildId);
  return db.db.prepare('SELECT streak, best FROM bj_streaks WHERE user_id=? AND guild_id=?').get(userId, guildId) || { streak: 0, best: 0 };
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

// Bonus de série : plus tu gagnes d'affilée, plus tu gagnes
function streakMultiplier(streak) {
  if (streak >= 7) return 2.0;   // +100%
  if (streak >= 5) return 1.75;  // +75%
  if (streak >= 3) return 1.5;   // +50%
  if (streak >= 2) return 1.25;  // +25%
  return 1.0;
}
function streakLabel(streak) {
  if (streak >= 7) return `🔥🔥🔥 ${streak} victoires de suite ! ×2.0`;
  if (streak >= 5) return `🔥🔥 ${streak} victoires de suite ! ×1.75`;
  if (streak >= 3) return `🔥 ${streak} victoires de suite ! ×1.5`;
  if (streak >= 2) return `✨ ${streak} victoires de suite ! ×1.25`;
  return null;
}

// ─── Évaluation 21+3 ─────────────────────────────────────
// Player's 2 cards + Dealer's face card → 3-card poker hand
function eval21Plus3(card1, card2, dealerCard) {
  const all = [card1, card2, dealerCard];
  const suits = all.map(c => c.suit);
  const toNum = c => {
    if (c.value === 'A') return 14;
    if (c.value === 'K') return 13;
    if (c.value === 'Q') return 12;
    if (c.value === 'J') return 11;
    return parseInt(c.value);
  };
  const numVals = all.map(toNum).sort((a, b) => a - b);
  const sameVals = all.every(c => c.value === all[0].value);
  const isFlush  = suits.every(s => s === suits[0]);
  const isStraight = (numVals[2] - numVals[0] === 2 && new Set(numVals).size === 3)
    || (numVals[0] === 2 && numVals[1] === 3 && numVals[2] === 14); // A-2-3

  if (sameVals && isFlush) return { name: '💎 Brelan Suited !', payout: 100, emoji: '💎' };
  if (isFlush && isStraight) return { name: '♠️ Quinte Flush !', payout: 40,  emoji: '♠️' };
  if (sameVals)              return { name: '🎰 Brelan !',       payout: 30,  emoji: '🎰' };
  if (isStraight)            return { name: '📏 Suite !',        payout: 10,  emoji: '📏' };
  if (isFlush)               return { name: '🌊 Couleur !',      payout: 5,   emoji: '🌊' };
  return null;
}

// ─── Deck ─────────────────────────────────────────────────
const SUITS  = ['♠️','♥️','♦️','♣️'];
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

// ─── Embed ────────────────────────────────────────────────
function buildEmbed(state, status = '') {
  const playerVal = handValue(state.player);
  const dealerVal = state.revealed ? handValue(state.dealer) : '?';
  const color = status === 'win'  ? '#2ECC71'
              : status === 'lose' ? '#E74C3C'
              : status === 'push' ? '#F39C12'
              : '#2C3E50';

  const headerAscii = '╔═══════════════════════════════╗\n║      ⚡ BLACKJACK TABLE ⚡    ║\n╚═══════════════════════════════╝';
  const cfg  = db.getConfig ? db.getConfig(state.guildId) : { currency_emoji: '🪙' };
  const coin = cfg?.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 ・ BlackJack ・')
    .setDescription(headerAscii)
    .addFields(
      { name: `🎩 Croupier ${state.revealed ? `(${dealerVal})` : ''}`, value: handStr(state.dealer, !state.revealed), inline: false },
      { name: `🎮 Vous (${playerVal})`, value: handStr(state.player), inline: false },
    );

  if (state.split) {
    embed.addFields({ name: `🎮 Main 2 (${handValue(state.split)})`, value: handStr(state.split), inline: false });
  }
  if (state.insurance !== null) {
    embed.addFields({ name: '🛡️ Assurance', value: state.insurance ? '✅ Prise' : '❌ Refusée', inline: true });
  }

  embed.addFields({ name: '💰 Mise', value: `**${state.mise} ${coin}**`, inline: true });

  // Afficher le side bet si présent
  if (state.sideBet > 0) {
    embed.addFields({ name: '🃏 21+3 Side bet', value: `**${state.sideBet} ${coin}**`, inline: true });
  }

  // Afficher la série si active
  const streakData = getStreak(state.userId, state.guildId);
  if (streakData.streak >= 2) {
    const sLabel = streakLabel(streakData.streak);
    if (sLabel) embed.addFields({ name: '🔥 Série en cours', value: sLabel, inline: false });
  }

  if (status) {
    const msgs = {
      win:       '🎉 Vous gagnez !',
      blackjack: '🌟 BLACKJACK ! Payé 3:2 !',
      lose:      '💸 Perdu...',
      bust:      '💥 Dépassé ! Perdu.',
      push:      '🤝 Égalité — mise remboursée.',
    };
    embed.setDescription(headerAscii + '\n\n' + (msgs[status] || status));
  }
  return embed;
}

function buildButtons(state) {
  const canDouble = state.player.length === 2 && !state.split;
  const canSplit  = state.player.length === 2
                 && cardVal(state.player[0]) === cardVal(state.player[1])
                 && !state.split;
  const canInsure = state.dealer[0].value === 'A'
                 && state.insurance === null
                 && state.player.length === 2;

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${state.userId}`)      .setLabel('🃏 Tirer')      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${state.userId}`)    .setLabel('✋ Rester')     .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bj_double_${state.userId}`)   .setLabel('⬆️ Doubler')   .setStyle(ButtonStyle.Success).setDisabled(!canDouble),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_split_${state.userId}`)    .setLabel('✂️ Split')     .setStyle(ButtonStyle.Primary).setDisabled(!canSplit),
    new ButtonBuilder().setCustomId(`bj_insure_${state.userId}`)   .setLabel('🛡️ Assurance') .setStyle(ButtonStyle.Danger).setDisabled(!canInsure),
    new ButtonBuilder().setCustomId(`bj_surrender_${state.userId}`).setLabel('🏳️ Abandonner').setStyle(ButtonStyle.Danger),
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
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.currency_emoji || '🪙';
  let payout = 0;

  // Streak courant avant la mise à jour
  const streakBefore = getStreak(state.userId, state.guildId).streak;

  if (winMult > 0) {
    // Appliquer le multiplicateur de série
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

  // ── Résultat du side bet 21+3 ─────────────────────────
  let side21Result = null;
  if (state.sideBet > 0) {
    const r21 = eval21Plus3(state.player[0], state.player[1], state.dealer[0]);
    if (r21) {
      const sidePayout = state.sideBet * (r21.payout + 1);
      db.addCoins(state.userId, state.guildId, sidePayout);
      side21Result = { won: true, hand: r21, gain: sidePayout };
    } else {
      side21Result = { won: false };
    }
  }

  // Animation révélation
  const revealFrames = [
    { desc: '🎩 *Révélation de la main du croupier...*', delay: 600 },
    { desc: '✨ *Calcul du résultat...*', delay: 400 },
  ];
  for (const frame of revealFrames) {
    const tempEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🃏 ・ BlackJack ・')
      .setDescription(frame.desc)
      .addFields(
        { name: '🎩 Croupier', value: handStr(state.dealer), inline: false },
        { name: '🎮 Vous',     value: handStr(state.player), inline: false },
      );
    await msg.edit({ embeds: [tempEmbed], components: [] }).catch(() => {});
    await sleep(frame.delay);
  }

  const embed = buildEmbed(state, status);
  const newBalance = db.getUser(state.userId, state.guildId)?.balance || 0;

  if (payout > 0) {
    const streakNow = getStreak(state.userId, state.guildId).streak;
    const sMult     = streakMultiplier(streakBefore);
    const bonusLine = sMult > 1
      ? `+**${payout} ${coin}** *(série ×${sMult.toFixed(2)})*`
      : `+**${payout} ${coin}**`;
    embed.addFields({ name: '💵 Gain', value: bonusLine, inline: true });
    // Afficher la nouvelle série
    if (streakNow >= 2) {
      const sl = streakLabel(streakNow);
      if (sl) embed.addFields({ name: '🔥 Nouvelle série', value: sl, inline: false });
    }
  } else if (status !== 'push') {
    embed.addFields({ name: '💵 Perte', value: `-**${state.mise} ${coin}**`, inline: true });
  }

  // Résultat 21+3
  if (side21Result) {
    if (side21Result.won) {
      embed.addFields({
        name: `🃏 21+3 : ${side21Result.hand.emoji} ${side21Result.hand.name}`,
        value: `+**${side21Result.gain} ${coin}** (×${side21Result.hand.payout + 1})`,
        inline: false,
      });
    } else {
      embed.addFields({ name: '🃏 21+3 : ❌ Pas de combo', value: `−${state.sideBet} ${coin}`, inline: false });
    }
  }

  embed.setFooter({ text: `Solde: ${newBalance} ${coin}` });

  deleteSession(state.userId);
  await msg.edit({ embeds: [embed], components: playAgainButtons(state.userId, state.mise) });
}

// ─── Dealer play ──────────────────────────────────────────
async function dealerPlay(msg, state) {
  state.revealed = true;
  await msg.edit({ embeds: [buildEmbed(state, '')], components: [] });
  await sleep(800);

  while (handValue(state.dealer) < 17 || isSoft17(state.dealer)) {
    state.dealer.push(state.deck.pop());
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
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  const totalCost = mise + sideBet;

  if (!u || u.balance < totalCost) {
    const errMsg = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}** (coût total : ${totalCost} ${coin}).`;
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (getSession(userId)) {
    const errMsg = '⚠️ Tu as déjà une partie en cours ! Termines-la d\'abord.';
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (mise < 10) {
    const errMsg = '❌ Mise minimale : **10 coins**.';
    if (isInteraction) return source.editReply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }

  db.addCoins(userId, guildId, -totalCost);

  const deck   = newDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];

  const state = {
    userId, guildId, mise, sideBet, deck, player, dealer,
    revealed: false, insurance: null, split: null, doubled: false,
  };

  // Animation distribution cartes
  function quickEmbed(pCards, dCards, msg_txt) {
    const cn = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';
    const streakData = getStreak(userId, guildId);
    const sl = streakLabel(streakData.streak);
    const e  = new EmbedBuilder()
      .setColor('#2C3E50').setTitle('🃏 ・ BlackJack ・')
      .addFields(
        { name: '🎩 Croupier', value: dCards || '🂠', inline: false },
        { name: '🎮 Vous',     value: pCards || '🂠', inline: false },
      )
      .setDescription(msg_txt || '')
      .setFooter({ text: `Solde: ${u?.balance || 0} ${cn}` });
    if (sideBet > 0) e.addFields({ name: '🃏 21+3 Side bet', value: `${sideBet} ${cn}`, inline: true });
    if (sl)          e.addFields({ name: '🔥 Série', value: sl, inline: true });
    return e;
  }

  const dealSteps = [
    { pCards: '🂠', dCards: '―', txt: '🃏 *Le croupier bat les cartes...*', delay: 500 },
    { pCards: '🂠', dCards: '―', txt: '✨ *Distribution en cours...*', delay: 350 },
    { pCards: `\`${player[0].value}${player[0].suit}\``, dCards: '―', txt: '🃏 *+1 carte joueur*', delay: 400 },
    { pCards: `\`${player[0].value}${player[0].suit}\``, dCards: '🂠', txt: '✨ *Les cartes volent !*', delay: 400 },
    { pCards: handStr(player), dCards: '🂠', txt: '🃏 *+2ème carte joueur*', delay: 350 },
    { pCards: handStr(player), dCards: '🂠', txt: '✅ *Main initiale prête !*', delay: 350 },
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

  // Blackjack naturel ?
  if (isBlackjack(player)) {
    state.revealed = true;
    if (isBlackjack(dealer)) {
      db.addCoins(userId, guildId, mise);
      onPush(userId, guildId);
      // Rembourser le side bet aussi si blackjack push
      if (sideBet > 0) db.addCoins(userId, guildId, sideBet);
      const embed = buildEmbed(state, 'push');
      embed.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
      deleteSession(userId);
      await msg.edit({ embeds: [embed], components: playAgainButtons(userId, state.mise) });
      return;
    }
    db.addCoins(userId, guildId, Math.floor(mise * 2.5));
    onWin(userId, guildId);

    // 21+3 sur blackjack naturel
    let side21 = null;
    if (sideBet > 0) {
      const r21 = eval21Plus3(player[0], player[1], dealer[0]);
      if (r21) {
        const sp = sideBet * (r21.payout + 1);
        db.addCoins(userId, guildId, sp);
        side21 = { won: true, hand: r21, gain: sp };
      } else {
        side21 = { won: false };
      }
    }

    // 🎬 Animation célébration Blackjack naturel !
    const bjPayout = Math.floor(mise * 2.5);
    const celebFrames = [
      { color: '#FFD700', title: '🌟 BLACKJACK ! 🌟',           desc: '```\n' + '★'.repeat(34) + '\n' + '    🃏  BLACKJACK NATUREL ! 🃏    \n' + '           Payé 3:2 !           \n' + '★'.repeat(34) + '\n```' },
      { color: '#F1C40F', title: '✨ 21 ! ✨',                   desc: `*La table frémit ! Vous avez **21** !*` },
      { color: '#FFD700', title: `🎊 +${bjPayout} ${coin} 🎊`, desc: `**+${bjPayout} ${coin}** empochés !\n\n*Payé à 3:2 — la règle d'or du Blackjack !*` },
    ];
    for (const { color, title, desc: fDesc } of celebFrames) {
      await msg.edit({ embeds: [new EmbedBuilder()
        .setColor(color).setTitle(title).setDescription(fDesc)
        .addFields({ name: '🎩 Croupier', value: handStr(dealer, false), inline: true }, { name: '🎮 Vous (21)', value: handStr(player), inline: true })
      ], components: [] }).catch(() => {});
      await sleep(500);
    }

    const embed = buildEmbed(state, 'blackjack');
    const sNow  = getStreak(userId, guildId).streak;
    const sl    = streakLabel(sNow);
    if (sl) embed.addFields({ name: '🔥 Série', value: sl, inline: false });
    if (side21?.won) {
      embed.addFields({ name: `🃏 21+3 : ${side21.hand.emoji} ${side21.hand.name}`, value: `+**${side21.gain} ${coin}**`, inline: false });
    } else if (side21) {
      embed.addFields({ name: '🃏 21+3 : ❌ Pas de combo', value: `−${sideBet} ${coin}`, inline: false });
    }
    embed.addFields({ name: '💵 Gain', value: `+**${bjPayout} ${coin}** (3:2)`, inline: true });
    embed.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
    deleteSession(userId);
    await msg.edit({ embeds: [embed], components: playAgainButtons(userId, state.mise) });
    return;
  }

  storeSession(userId, state);
  await msg.edit({ embeds: [buildEmbed(state, '')], components: buildButtons(state) });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const customId = interaction.customId;

  // ── Rejouer ──────────────────────────────────────────────
  if (customId.startsWith('bj_replay_')) {
    const parts  = customId.split('_');
    const userId = parts[2];
    const mise   = parseInt(parts[3]);
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
    }
    await interaction.deferUpdate().catch(() => {});
    await startGame(interaction, userId, interaction.guildId, mise);
    return true;
  }

  // ── Changer la mise ──────────────────────────────────────
  if (customId.startsWith('bj_changemise_')) {
    const parts  = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('bj', userId));
    return true;
  }

  // ── Modal mise ───────────────────────────────────────────
  if (customId.startsWith('bj_modal_') && interaction.isModalSubmit()) {
    const parts  = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u       = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 coins).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await startGame(interaction, userId, interaction.guildId, newMise);
    return true;
  }

  // ── Boutons in-game ──────────────────────────────────────
  if (!customId.startsWith('bj_')) return;
  const parts  = customId.split('_');
  const userId = parts.length > 2 ? parts[2] : null;

  if (!userId || interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
  }

  await interaction.deferUpdate().catch(() => {});
  const st = getSession(userId);
  if (!st) return;

  const action  = parts[1];
  const msg     = interaction.message;
  const guildId = interaction.guildId;
  const coin    = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (action === 'hit') {
    st.player.push(st.deck.pop());
    const pv = handValue(st.player);
    if (pv > 21) return endGame(msg, st, 'bust', 0);
    if (pv === 21) return dealerPlay(msg, st);
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'stand') {
    await dealerPlay(msg, st);

  } else if (action === 'double') {
    const u2 = db.getUser(userId, guildId);
    if (u2.balance < st.mise) return msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });
    db.addCoins(userId, guildId, -st.mise);
    st.mise *= 2;
    st.player.push(st.deck.pop());
    const pv = handValue(st.player);
    if (pv > 21) return endGame(msg, st, 'bust', 0);
    await dealerPlay(msg, st);

  } else if (action === 'split') {
    const u2 = db.getUser(userId, guildId);
    if (u2.balance < st.mise) return;
    db.addCoins(userId, guildId, -st.mise);
    st.split  = [st.player.pop(), st.deck.pop()];
    st.player.push(st.deck.pop());
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'insure') {
    const insureCost = Math.floor(st.mise / 2);
    const u2 = db.getUser(userId, guildId);
    if (u2.balance < insureCost) return;
    db.addCoins(userId, guildId, -insureCost);
    st.insurance = true;
    if (isBlackjack(st.dealer)) {
      st.revealed = true;
      db.addCoins(userId, guildId, insureCost * 3);
      deleteSession(userId);
      const e = buildEmbed(st, 'lose');
      e.setDescription('🛡️ Assurance payée 2:1 — le croupier avait blackjack !');
      onLose(userId, guildId);
      e.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
      return msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
    }
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'surrender') {
    deleteSession(userId);
    db.addCoins(userId, guildId, Math.floor(st.mise / 2));
    onLose(userId, guildId);
    const e = buildEmbed(st, 'lose');
    e.setDescription('🏳️ Abandonné — moitié de la mise remboursée.');
    e.setFooter({ text: `Solde: ${db.getUser(userId, guildId)?.balance || 0} ${coin}` });
    await msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 BlackJack — streak bonus & pari annexe 21+3 !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise principale (min 10)').setRequired(true).setMinValue(10))
    .addIntegerOption(o => o
      .setName('cote').setDescription('Pari annexe 21+3 (5× flush … 100× brelan suited, opt.)').setMinValue(5)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise    = interaction.options.getInteger('mise');
    const sideBet = interaction.options.getInteger('cote') || 0;
    await startGame(interaction, interaction.user.id, interaction.guildId, mise, sideBet);
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
  },

  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&blackjack <mise> [cote]` — mise minimum 10.');
    const u = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&blackjack <mise>` — mise minimum 10.');
    const sideBet = parseInt(args[1]) || 0;
    await startGame(message, message.author.id, message.guildId, mise, sideBet);
  },
};
