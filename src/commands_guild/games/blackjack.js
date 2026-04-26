// ============================================================
// blackjack.js — Blackjack complet avec animations
// Emplacement : src/commands_guild/games/blackjack.js
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── Deck ─────────────────────────────────────────────────
const SUITS   = ['♠️','♥️','♦️','♣️'];
const VALUES  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const CARD_EMOJIS = {
  '♠️': '🂠', '♥️': '🂠', '♦️': '🂠', '♣️': '🂠',
};

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
function isSoft17(hand)    {
  return handValue(hand) === 17 && hand.some(c => c.value === 'A');
}

// ─── Game Sessions Map with TTL ───────────────────────────
const gameSessions = new Map(); // userId → { ...state, timeout: NodeJS.Timeout }

function storeSession(userId, state) {
  const existing = gameSessions.get(userId);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    gameSessions.delete(userId);
  }, 15 * 60 * 1000); // 15 minutes

  gameSessions.set(userId, { ...state, timeout });
}

function getSession(userId) {
  return gameSessions.get(userId);
}

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

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🃏 ・ BlackJack ・')
    .addFields(
      { name: `🎩 Croupier ${state.revealed ? `(${dealerVal})` : ''}`,
        value: handStr(state.dealer, !state.revealed), inline: false },
      { name: `🎮 Vous (${playerVal})`,
        value: handStr(state.player), inline: false },
    );

  if (state.split) {
    embed.addFields({
      name: `🎮 Main 2 (${handValue(state.split)})`,
      value: handStr(state.split), inline: false,
    });
  }
  if (state.insurance !== null) {
    embed.addFields({ name: '🛡️ Assurance', value: state.insurance ? '✅ Prise' : '❌ Refusée', inline: true });
  }

  const mise = state.mise;
  const cfg  = db.getConfig ? db.getConfig(state.guildId) : { currency_emoji: '€' };
  const coin  = cfg?.currency_emoji || '🪙';

  embed.addFields({ name: '💰 Mise', value: `**${mise} ${coin}**`, inline: true });

  if (status) {
    const msgs = {
      win:       '🎉 Vous gagnez !',
      blackjack: '🌟 BLACKJACK ! Payé 3:2 !',
      lose:      '💸 Perdu...',
      bust:      '💥 Dépassé ! Perdu.',
      push:      '🤝 Égalité — mise remboursée.',
    };
    embed.setDescription(msgs[status] || status);
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
    new ButtonBuilder().setCustomId(`bj_hit_${state.userId}`)   .setLabel('🃏 Tirer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`bj_stand_${state.userId}`) .setLabel('✋ Rester').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bj_double_${state.userId}`).setLabel('⬆️ Doubler').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj_split_${state.userId}`)   .setLabel('✂️ Split').setStyle(ButtonStyle.Primary).setDisabled(!canSplit),
    new ButtonBuilder().setCustomId(`bj_insure_${state.userId}`)  .setLabel('🛡️ Assurance').setStyle(ButtonStyle.Danger).setDisabled(!canInsure),
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

// ─── Fin de partie ────────────────────────────────────────
async function endGame(msg, state, status, winMult = 0) {
  state.revealed = true;
  const u    = db.getUser(state.userId, state.guildId);
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.currency_emoji || '🪙';
  let payout = 0;

  if (winMult > 0) {
    payout = Math.floor(state.mise * winMult);
    db.addCoins(state.userId, state.guildId, payout);
  }

  const embed = buildEmbed(state, status);
  if (payout > 0) {
    embed.addFields({ name: '💵 Gain', value: `+**${payout} ${coin}**`, inline: true });
  } else if (status !== 'push') {
    embed.addFields({ name: '💵 Perte', value: `-**${state.mise} ${coin}**`, inline: true });
  }

  const newBalance = db.getUser(state.userId, state.guildId)?.balance || 0;
  embed.setFooter({ text: `Solde: ${newBalance} ${coin}` });

  deleteSession(state.userId);
  await msg.edit({ embeds: [embed], components: playAgainButtons(state.userId, state.mise) });
}

// ─── Dealer play (révèle + tire) ──────────────────────────
async function dealerPlay(msg, state) {
  state.revealed = true;
  // Animation révélation croupier
  await msg.edit({ embeds: [buildEmbed(state, '')], components: [] });
  await sleep(800);

  while (handValue(state.dealer) < 17 || isSoft17(state.dealer)) {
    state.dealer.push(state.deck.pop());
    await msg.edit({ embeds: [buildEmbed(state, '')], components: [] });
    await sleep(700);
  }

  const dv = handValue(state.dealer);
  const pv = handValue(state.player);

  if (dv > 21)         return endGame(msg, state, 'win', 2);
  if (pv > dv)         return endGame(msg, state, 'win', 2);
  if (pv < dv)         return endGame(msg, state, 'lose', 0);
  /* égalité */        return endGame(msg, state, 'push', 1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Jeu principal ────────────────────────────────────────
async function startGame(source, userId, guildId, mise) {
  const isInteraction = !!source.editReply;

  // Vérif mise
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (!u || u.balance < mise) {
    const errMsg = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
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

  db.addCoins(userId, guildId, -mise);

  const deck   = newDeck();
  const player = [deck.pop(), deck.pop()];
  const dealer = [deck.pop(), deck.pop()];

  const state = {
    userId, guildId, mise, deck, player, dealer,
    revealed: false, insurance: null, split: null,
    doubled: false,
  };

  // Animation distribution cartes — plus dramatique
  function quickEmbed(pCards, dCards, msg_txt) {
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';
    return new EmbedBuilder()
      .setColor('#2C3E50').setTitle('🃏 ・ BlackJack ・')
      .addFields(
        { name: '🎩 Croupier', value: dCards || '🂠', inline: false },
        { name: `🎮 Vous`, value: pCards || '🂠', inline: false },
      )
      .setDescription(msg_txt || '')
      .setFooter({ text: `Solde: ${u?.balance || 0} ${coin}` });
  }

  const dealSteps = [
    { pCards: '🂠',                        dCards: '―',               txt: '*Distribution...*', delay: 380 },
    { pCards: `\`${player[0].value}${player[0].suit}\``, dCards: '―',  txt: '*+1 carte joueur*', delay: 350 },
    { pCards: `\`${player[0].value}${player[0].suit}\``, dCards: '🂠', txt: '*+1 carte croupier*', delay: 380 },
    { pCards: handStr(player),             dCards: '🂠',               txt: '*+2ème carte joueur*', delay: 380 },
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

  // Carte croupier 2 (cachée)
  state.player = player;
  state.dealer = dealer;
  state.revealed = false;

  // Blackjack naturel ?
  if (isBlackjack(player)) {
    state.revealed = true;
    if (isBlackjack(dealer)) {
      db.addCoins(userId, guildId, mise); // remboursement
      const embed = buildEmbed(state, 'push');
      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      embed.setFooter({ text: `Solde: ${newBalance} ${coin}` });
      deleteSession(userId);
      await msg.edit({ embeds: [embed], components: playAgainButtons(userId, state.mise) });
      return;
    }
    db.addCoins(userId, guildId, Math.floor(mise * 2.5)); // BJ paie 3:2 → x2.5 total
    const embed = buildEmbed(state, 'blackjack');
    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    embed.setFooter({ text: `Solde: ${newBalance} ${coin}` });
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

  // Play again handler
  if (customId.startsWith('bj_replay_')) {
    const parts = customId.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    await startGame(interaction, userId, interaction.guildId, mise);
    return true;
  }

  // Changer la mise
  if (customId.startsWith('bj_changemise_')) {
    const parts = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('bj', userId));
    return true;
  }

  // Modal mise
  if (customId.startsWith('bj_modal_') && interaction.isModalSubmit()) {
    const parts = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 coins).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await startGame(interaction, userId, interaction.guildId, newMise);
    return true;
  }

  // In-game buttons
  if (!customId.startsWith('bj_')) return;

  const parts = customId.split('_');
  const userId = parts.length > 2 ? parts[2] : null;

  if (!userId || interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
  }

  await interaction.deferUpdate().catch(() => {});
  const st = getSession(userId);
  if (!st) return;

  const action = parts[1];
  const msg = interaction.message;
  const guildId = interaction.guildId;
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (action === 'hit') {
    st.player.push(st.deck.pop());
    const pv = handValue(st.player);
    if (pv > 21) {
      return endGame(msg, st, 'bust', 0);
    }
    if (pv === 21) {
      return dealerPlay(msg, st);
    }
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'stand') {
    await dealerPlay(msg, st);

  } else if (action === 'double') {
    const u2 = db.getUser(userId, guildId);
    if (u2.balance < st.mise) {
      return msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });
    }
    db.addCoins(userId, guildId, -st.mise);
    st.mise *= 2;
    st.player.push(st.deck.pop());
    const pv = handValue(st.player);
    if (pv > 21) {
      return endGame(msg, st, 'bust', 0);
    }
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
      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      e.setFooter({ text: `Solde: ${newBalance} ${coin}` });
      return msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
    }
    await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

  } else if (action === 'surrender') {
    deleteSession(userId);
    db.addCoins(userId, guildId, Math.floor(st.mise / 2));
    const e = buildEmbed(st, 'lose');
    e.setDescription('🏳️ Abandonné — moitié de la mise remboursée.');
    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    e.setFooter({ text: `Solde: ${newBalance} ${coin}` });
    await msg.edit({ embeds: [e], components: playAgainButtons(userId, st.mise) });
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Jouez au BlackJack contre le croupier')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant à miser (min 10)').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise    = interaction.options.getInteger('mise');
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    await startGame(interaction, userId, guildId, mise);
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
  },

  // Préfixe : !blackjack <mise>
  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&blackjack <mise>` — mise minimum 10.');
    const u = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&blackjack <mise>` — mise minimum 10.');
    await startGame(message, message.author.id, message.guildId, mise);
  },
};

