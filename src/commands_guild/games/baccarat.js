// ============================================================
// baccarat.js — Baccarat complet avec animations
// Emplacement : src/commands_guild/games/baccarat.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

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

// ─── Game Sessions Map with TTL ───────────────────────────
const gameSessions = new Map();

function storeSession(userId, state) {
  const existing = gameSessions.get(userId);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    gameSessions.delete(userId);
  }, 15 * 60 * 1000);

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

async function playBaccaratGame(source, userId, guildId, mise, betOn) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  const betMap = { joueur: 'player', player: 'player', banquier: 'banker', banker: 'banker', egalite: 'tie', tie: 'tie', egal: 'tie' };
  const betKey = betMap[betOn.toLowerCase()];
  if (!betKey) {
    const err = '❌ Pari invalide. Choisir : `joueur`, `banquier`, ou `egalite`';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const betLabels = { player: '👤 Joueur', banker: '🏦 Banquier', tie: '🤝 Égalité' };

  // Embed de départ — cartes dos visible
  const bacAnimFrames = [
    { desc:'🎴 Mélange du sabot...\n\n🃏 🃏 🃏 🃏', color:'#16A085', delay:500 },
    { desc:'🎴 Distribution en cours...\n\n🃏 🃏 🃏 🃏', color:'#1ABC9C', delay:400 },
  ];
  let msg;
  for (let fi = 0; fi < bacAnimFrames.length; fi++) {
    const { desc, color, delay } = bacAnimFrames[fi];
    const e = new EmbedBuilder().setColor(color).setTitle('🎴 ・ Baccarat ・')
      .setDescription(desc)
      .addFields({name:'🎯 Pari',value:betLabels[betKey],inline:true},{name:'💰 Mise',value:`${mise} ${coin}`,inline:true});
    if (fi === 0) {
      if (isInteraction) { msg = await source.editReply({ embeds: [e] }); }
      else { msg = await source.reply({ embeds: [e] }); }
    } else {
      await msg.edit({ embeds: [e] });
    }
    await sleep(delay);
  }

  const { player, banker, pTotal, bTotal } = playBaccarat();

  // Distribution animée — cartes dos puis révèle avec plus d'animations
  const steps = [
    { p: ['🃏'], b: [],     desc:'🎴 1ère carte joueur...' },
    { p: ['🃏'], b: ['🃏'], desc:'🎴 1ère carte banquier...' },
    { p: [player[0]], b: ['🃏'],           desc:'✨ Révèle la carte du joueur !' },
    { p: [player[0]], b: [banker[0]],      desc:'✨ Révèle la carte du banquier !' },
    { p: player.slice(0,2).map(cardStr), b: [banker[0]], pRaw:true, bRaw:false, desc:'🎴 2ème carte joueur !' },
    { p: player.slice(0,2).map(cardStr), b: banker.slice(0,2).map(cardStr), pRaw:true, bRaw:true, desc:'✅ Main initiale complète !' },
  ];
  for (const s of steps) {
    const pVal = s.pRaw ? s.p.join(' ') : (Array.isArray(s.p) && s.p[0]?.value ? s.p.map(cardStr).join(' ') : s.p.join(' '));
    const bVal = s.bRaw ? s.b.join(' ') : (Array.isArray(s.b) && s.b[0]?.value ? s.b.map(cardStr).join(' ') : s.b.join(' '));
    const pScore = s.pRaw ? '' : (s.p[0]?.value ? `(${handTotal(s.p.filter(c=>c?.value))})` : '');
    const bScore = s.bRaw ? '' : (s.b[0]?.value ? `(${handTotal(s.b.filter(c=>c?.value))})` : '');
    const e = new EmbedBuilder()
      .setColor('#1ABC9C').setTitle('🎴 ・ Baccarat ・').setDescription(`*${s.desc}*`)
      .addFields(
        {name:`👤 Joueur ${pScore}`,value:`**${pVal}**`||'—',inline:true},
        {name:`🏦 Banquier ${bScore}`,value:`**${bVal}**`||'—',inline:true},
      );
    await msg.edit({ embeds: [e] });
    await sleep(500); // Slightly longer delay for drama
  }

  // Troisième carte si applicable
  if (player.length === 3) {
    await sleep(600);
    const e = new EmbedBuilder().setColor('#1ABC9C').setTitle('🎴 ・ Baccarat — 3ème carte ・')
      .setDescription('*Tirage de 3ème carte en cours...*')
      .addFields(
        { name: `👤 Joueur **${pTotal}**`, value: player.map(cardStr).join(' '), inline: true },
        { name: `🏦 Banquier **${bTotal}**`, value: banker.map(cardStr).join(' '), inline: true },
      );
    await msg.edit({ embeds: [e] });
    await sleep(700);
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
      { name: `👤 Joueur **${pTotal}**`, value: player.map(cardStr).join(' '), inline: true },
      { name: `🏦 Banquier **${bTotal}**`, value: banker.map(cardStr).join(' '), inline: true },
      { name: '🏆 Vainqueur', value: `${winEmoji[winner]} ${betLabels[winner]}`, inline: false },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
    )
    .setFooter({ text: 'Baccarat · Joueur ×2 · Banquier ×1.95 (5% commission) · Égalité ×9' });

  const playAgainButtons = makeGameRow('baccarat', userId, mise, betKey);

  await msg.edit({ embeds: [finalEmbed], components: [playAgainButtons] });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const cid = interaction.customId;

  if (cid.startsWith('baccarat_replay_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);
    const betKey = parts[4];

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    const betLabels = { player: 'joueur', banker: 'banquier', tie: 'egalite' };
    await playBaccaratGame(interaction, userId, interaction.guildId, mise, betLabels[betKey] || betKey);
    return true;
  }

  if (cid.startsWith('baccarat_changemise_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const betKey = parts[3];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('baccarat', userId, betKey));
    return true;
  }

  if (cid.startsWith('baccarat_modal_') && interaction.isModalSubmit()) {
    const parts = cid.split('_');
    const userId = parts[2];
    const betKey = parts[3];
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
    const betLabels = { player: 'joueur', banker: 'banquier', tie: 'egalite' };
    await playBaccaratGame(interaction, userId, interaction.guildId, newMise, betLabels[betKey] || betKey);
    return true;
  }
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
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playBaccaratGame(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('pari'),
    );
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
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
