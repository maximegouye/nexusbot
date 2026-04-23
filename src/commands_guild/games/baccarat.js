// ============================================================
// baccarat.js — Baccarat complet avec animations
// Emplacement : src/commands_guild/games/baccarat.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Valeur des cartes au baccarat ───────────────────────
function baccaratVal(card) {
  const v = card.value;
  if (['J','Q','K','10'].includes(v)) return 0;
  if (v === 'A') return 1;
  return parseInt(v);
}
function handTotal(hand) {
  return hand.reduce((s, c) => s + baccaratVal(c), 0) % 10;
}
function cardStr(card) { return `\`${card.value}${card.suit}\``; }

const SUITS  = ['♠️','♥️','♦️','♣️'];
const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ suit: s, value: v });
  // Shuffle
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Règles du baccarat ───────────────────────────────────
function playBaccarat() {
  const deck   = newDeck();
  const player = [deck.pop(), deck.pop()];
  const banker = [deck.pop(), deck.pop()];

  let pTotal = handTotal(player);
  let bTotal = handTotal(banker);

  // Natural check (8 or 9)
  if (pTotal >= 8 || bTotal >= 8) {
    return { player, banker, pTotal: handTotal(player), bTotal: handTotal(banker), extraCards: false };
  }

  // Player third card rule
  let playerThird = null;
  if (pTotal <= 5) {
    playerThird = deck.pop();
    player.push(playerThird);
    pTotal = handTotal(player);
  }

  // Banker third card rule
  let bankerDraws = false;
  if (playerThird === null) {
    bankerDraws = bTotal <= 5;
  } else {
    const pt = baccaratVal(playerThird);
    if      (bTotal <= 2) bankerDraws = true;
    else if (bTotal === 3) bankerDraws = pt !== 8;
    else if (bTotal === 4) bankerDraws = pt >= 2 && pt <= 7;
    else if (bTotal === 5) bankerDraws = pt >= 4 && pt <= 7;
    else if (bTotal === 6) bankerDraws = pt === 6 || pt === 7;
    else bankerDraws = false;
  }

  if (bankerDraws) { banker.push(deck.pop()); bTotal = handTotal(banker); }

  return { player, banker, pTotal, bTotal, extraCards: true };
}

// ─── Payouts ──────────────────────────────────────────────
// Joueur : 1:1, Banquier : 0.95:1 (5% commission), Tie : 8:1
const PAYOUTS = { player: 2, banker: 1.95, tie: 9 };

async function playBaccaratGame(source, userId, guildId, mise, betOn) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  const betMap = { joueur: 'player', player: 'player', banquier: 'banker', banker: 'banker', egalite: 'tie', tie: 'tie', egal: 'tie' };
  const betKey = betMap[betOn.toLowerCase()];
  if (!betKey) {
    const err = '❌ Pari invalide. Choisir : `joueur`, `banquier`, ou `egalite`';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (!u || u.solde < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const betLabels = { player: '👤 Joueur', banker: '🏦 Banquier', tie: '🤝 Égalité' };
  const animEmbed = new EmbedBuilder()
    .setColor('#1ABC9C')
    .setTitle('🎴 ・ Baccarat ・')
    .setDescription('*Distribution des cartes...*\n🃏 🃏 🃏 🃏')
    .addFields({ name: '🎯 Pari', value: betLabels[betKey], inline: true }, { name: '💰 Mise', value: `${mise} ${coin}`, inline: true });

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [animEmbed] });
  } else {
    msg = await source.editReply({ embeds: [animEmbed] });
  }

  await sleep(800);

  const { player, banker, pTotal, bTotal } = playBaccarat();

  // Distribution animée
  const steps = [
    { p: [player[0]], b: [] },
    { p: [player[0]], b: [banker[0]] },
    { p: player.slice(0, 2), b: [banker[0]] },
    { p: player.slice(0, 2), b: banker.slice(0, 2) },
  ];
  for (const s of steps) {
    const e = new EmbedBuilder()
      .setColor('#1ABC9C')
      .setTitle('🎴 ・ Baccarat ・')
      .addFields(
        { name: `👤 Joueur (${handTotal(s.p)})`, value: s.p.map(cardStr).join(' ') || '—', inline: true },
        { name: `🏦 Banquier (${handTotal(s.b)})`, value: s.b.map(cardStr).join(' ') || '—', inline: true },
      );
    await msg.edit({ embeds: [e] });
    await sleep(500);
  }

  // Troisième carte si applicable
  if (player.length === 3) {
    await sleep(300);
    const e = new EmbedBuilder().setColor('#1ABC9C').setTitle('🎴 ・ Baccarat — 3ème carte ・')
      .addFields(
        { name: `👤 Joueur (${pTotal})`, value: player.map(cardStr).join(' '), inline: true },
        { name: `🏦 Banquier (${bTotal})`, value: banker.map(cardStr).join(' '), inline: true },
      );
    await msg.edit({ embeds: [e] });
    await sleep(600);
  }

  // Résultat
  let winner;
  if (pTotal > bTotal) winner = 'player';
  else if (bTotal > pTotal) winner = 'banker';
  else winner = 'tie';

  let won = false, gain = 0;
  if (betKey === winner) {
    won  = true;
    gain = Math.floor(mise * PAYOUTS[betKey]);
    db.addCoins(userId, guildId, gain);
  } else if (winner === 'tie' && betKey !== 'tie') {
    // Push on tie for player/banker bets
    db.addCoins(userId, guildId, mise);
    gain = mise;
    won  = true; // remboursé
  }

  const winEmoji = { player: '👤', banker: '🏦', tie: '🤝' };
  const color    = won && betKey === winner ? '#2ECC71' : winner === 'tie' && betKey !== 'tie' ? '#F39C12' : '#E74C3C';
  const desc     = betKey === winner
    ? `🎉 **${betLabels[betKey]} gagne !** +${gain} ${coin}`
    : winner === 'tie' && betKey !== 'tie'
    ? `🤝 Égalité ! Mise remboursée.`
    : `😔 **${betLabels[winner]} gagne.** -${mise} ${coin}`;

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎴 ・ Baccarat — Résultat ・')
    .setDescription(desc)
    .addFields(
      { name: `👤 Joueur (${pTotal})`, value: player.map(cardStr).join(' '), inline: true },
      { name: `🏦 Banquier (${bTotal})`, value: banker.map(cardStr).join(' '), inline: true },
      { name: '🏆 Vainqueur', value: `${winEmoji[winner]} ${betLabels[winner]}`, inline: false },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.solde || 0} ${coin}`, inline: true },
    )
    .setFooter({ text: 'Baccarat · Banquier: 5% commission · Égalité: ×9' })
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('baccarat')
    .setDescription('🎴 Baccarat — Misez sur le joueur, banquier ou égalité')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10))
    .addStringOption(o => o.setName('pari').setDescription('joueur / banquier / egalite').setRequired(true)
      .addChoices(
        { name: '👤 Joueur (×2)', value: 'joueur' },
        { name: '🏦 Banquier (×1.95)', value: 'banquier' },
        { name: '🤝 Égalité (×9)', value: 'egalite' },
      )),

  async execute(interaction) {
    await playBaccaratGame(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('pari'),
    );
  },

  name: 'baccarat',
  aliases: ['bac', 'punto'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    const pari = args[1] || 'joueur';
    if (!mise || mise < 10) return message.reply('❌ Usage : `&baccarat <mise> <joueur/banquier/egalite>`');
    await playBaccaratGame(message, message.author.id, message.guildId, mise, pari);
  },
};
