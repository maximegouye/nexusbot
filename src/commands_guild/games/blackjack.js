// ============================================================
// blackjack.js — Blackjack complet avec animations
// Emplacement : src/commands_guild/games/blackjack.js
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

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

// ─── Sessions actives ─────────────────────────────────────
const sessions = new Map(); // userId → state

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
  const cfg  = db.getConfig ? db.getConfig(state.guildId) : { coin: '🪙' };
  const coin  = cfg?.coin || '🪙';

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
    new ButtonBuilder().setCustomId('bj_hit')   .setLabel('🃏 Tirer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('bj_stand') .setLabel('✋ Rester').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bj_double').setLabel('⬆️ Doubler').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_split')   .setLabel('✂️ Split').setStyle(ButtonStyle.Primary).setDisabled(!canSplit),
    new ButtonBuilder().setCustomId('bj_insure')  .setLabel('🛡️ Assurance').setStyle(ButtonStyle.Danger).setDisabled(!canInsure),
    new ButtonBuilder().setCustomId('bj_surrender').setLabel('🏳️ Abandonner').setStyle(ButtonStyle.Danger),
  );
  return [row1, row2];
}

function disabledButtons() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bj_done').setLabel('Partie terminée').setStyle(ButtonStyle.Secondary).setDisabled(true),
  )];
}

// ─── Fin de partie ────────────────────────────────────────
async function endGame(msg, state, status, winMult = 0) {
  state.revealed = true;
  const u    = db.getUser(state.userId, state.guildId);
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.coin || '🪙';
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

  sessions.delete(state.userId);
  await msg.edit({ embeds: [embed], components: disabledButtons() });
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
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  if (!u || u.solde < mise) {
    const errMsg = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.reply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (sessions.has(userId)) {
    const errMsg = '⚠️ Tu as déjà une partie en cours ! Termines-la d\'abord.';
    if (isInteraction) return source.reply({ content: errMsg, ephemeral: true });
    return source.reply(errMsg);
  }
  if (mise < 10) {
    const errMsg = '❌ Mise minimale : **10 coins**.';
    if (isInteraction) return source.reply({ content: errMsg, ephemeral: true });
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

  // Animation distribution cartes
  const tempState = { ...state, player: [player[0]], dealer: [dealer[0]], revealed: false };
  const tempEmbed = buildEmbed(tempState, '');

  let msg;
  if (isInteraction) {
    await source.reply({ embeds: [tempEmbed], components: [] });
    msg = await source.fetchReply();
  } else {
    msg = await source.reply({ embeds: [tempEmbed] });
  }
  await sleep(500);

  // Carte joueur 2
  tempState.player = player;
  await msg.edit({ embeds: [buildEmbed(tempState, '')] });
  await sleep(500);

  // Carte croupier 2 (cachée)
  state.player = player;
  state.dealer = dealer;
  state.revealed = false;

  // Blackjack naturel ?
  if (isBlackjack(player)) {
    state.revealed = true;
    if (isBlackjack(dealer)) {
      await msg.edit({ embeds: [buildEmbed(state, 'push')], components: disabledButtons() });
      db.addCoins(userId, guildId, mise); // remboursement
      return;
    }
    await msg.edit({ embeds: [buildEmbed(state, 'blackjack')], components: disabledButtons() });
    db.addCoins(userId, guildId, Math.floor(mise * 2.5)); // BJ paie 3:2 → x2.5 total
    return;
  }

  sessions.set(userId, state);
  await msg.edit({ embeds: [buildEmbed(state, '')], components: buildButtons(state) });

  // ─── Collecteur de boutons ────────────────────────────────
  const filter = i => i.user.id === userId && i.customId.startsWith('bj_');
  const collector = msg.createMessageComponentCollector({ filter, time: 120_000 });

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});
    const st = sessions.get(userId);
    if (!st) return;

    if (i.customId === 'bj_hit') {
      st.player.push(st.deck.pop());
      const pv = handValue(st.player);
      if (pv > 21) {
        collector.stop('bust');
        return endGame(msg, st, 'bust', 0);
      }
      if (pv === 21) { // auto-stand à 21
        collector.stop('stand');
        return dealerPlay(msg, st);
      }
      await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

    } else if (i.customId === 'bj_stand') {
      collector.stop('stand');
      await dealerPlay(msg, st);

    } else if (i.customId === 'bj_double') {
      const u2 = db.getUser(userId, guildId);
      if (u2.solde < st.mise) {
        return msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });
      }
      db.addCoins(userId, guildId, -st.mise);
      st.mise *= 2;
      st.player.push(st.deck.pop());
      const pv = handValue(st.player);
      if (pv > 21) {
        collector.stop('bust');
        return endGame(msg, st, 'bust', 0);
      }
      collector.stop('double');
      await dealerPlay(msg, st);

    } else if (i.customId === 'bj_split') {
      const u2 = db.getUser(userId, guildId);
      if (u2.solde < st.mise) return;
      db.addCoins(userId, guildId, -st.mise);
      st.split  = [st.player.pop(), st.deck.pop()];
      st.player.push(st.deck.pop());
      await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

    } else if (i.customId === 'bj_insure') {
      const insureCost = Math.floor(st.mise / 2);
      const u2 = db.getUser(userId, guildId);
      if (u2.solde < insureCost) return;
      db.addCoins(userId, guildId, -insureCost);
      st.insurance = true;
      // Si le croupier a blackjack → assurance paie 2:1
      if (isBlackjack(dealer)) {
        st.revealed = true;
        db.addCoins(userId, guildId, insureCost * 3); // remboursement + gain
        sessions.delete(userId);
        collector.stop('insurance_win');
        const e = buildEmbed(st, 'lose');
        e.setDescription('🛡️ Assurance payée 2:1 — le croupier avait blackjack !');
        return msg.edit({ embeds: [e], components: disabledButtons() });
      }
      await msg.edit({ embeds: [buildEmbed(st, '')], components: buildButtons(st) });

    } else if (i.customId === 'bj_surrender') {
      sessions.delete(userId);
      collector.stop('surrender');
      db.addCoins(userId, guildId, Math.floor(st.mise / 2));
      const e = buildEmbed(st, 'lose');
      e.setDescription('🏳️ Abandonné — moitié de la mise remboursée.');
      await msg.edit({ embeds: [e], components: disabledButtons() });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      const st = sessions.get(userId);
      if (st) {
        sessions.delete(userId);
        db.addCoins(userId, guildId, Math.floor(st.mise / 2));
        msg.edit({ content: '⏰ Temps écoulé — moitié de la mise remboursée.', components: disabledButtons() }).catch(() => {});
      }
    }
  });
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Jouez au BlackJack contre le croupier')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant à miser (min 10)').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    const mise    = interaction.options.getInteger('mise');
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    await startGame(interaction, userId, guildId, mise);
  },

  // Préfixe : !blackjack <mise>
  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 10) return message.reply('❌ Usage : `!blackjack <mise>` — mise minimum 10.');
    await startGame(message, message.author.id, message.guildId, mise);
  },
};
