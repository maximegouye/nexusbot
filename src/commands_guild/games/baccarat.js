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
const sessionScoreboard = new Map(); // Scoreboard per userId

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

function getScoreboard(userId) {
  if (!sessionScoreboard.has(userId)) {
    sessionScoreboard.set(userId, {
      playerWins: 0,
      bankerWins: 0,
      ties: 0,
      gamesPlayed: 0,
      netGain: 0,
    });
  }
  return sessionScoreboard.get(userId);
}

function updateScoreboard(userId, winner, payout, mise) {
  const sb = getScoreboard(userId);
  sb.gamesPlayed += 1;
  const netDiff = payout ? (payout - mise) : -mise;
  sb.netGain += netDiff;
  if (winner === 'player') sb.playerWins += 1;
  else if (winner === 'banker') sb.bankerWins += 1;
  else if (winner === 'tie') sb.ties += 1;
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

  // Embed de départ — cartes dos visible (intro améliorée avec croupier qui distribue)
  const bacAnimFrames = [
    { desc:'🎴 *Le croupier mélange le sabot...*\n\n🃏 🃏 🃏 🃏', color:'#16A085', delay:500 },
    { desc:'🎴 *Préparation de la table...*\n\n🃏 🃏 🃏 🃏', color:'#158D63', delay:400 },
    { desc:'🎴 *Distribution en cours...*\n\n🃏 🃏 🃏 🃏', color:'#1ABC9C', delay:400 },
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

  // Distribution animée — cartes dos puis révèle avec PLUS DE SUSPENSE et descriptions dramatiques
  const steps = [
    { p: ['🃏'], b: [],     desc:'🎴 *1ère carte joueur...*' },
    { p: ['🃏'], b: ['🃏'], desc:'🎴 *1ère carte banquier...*' },
    { p: [player[0]], b: ['🃏'],           desc:'✨ *La première carte du joueur !*' },
    { p: [player[0]], b: [banker[0]],      desc:'✨ *La première carte du banquier !*' },
    { p: player.slice(0,2).map(cardStr), b: [banker[0]], pRaw:true, bRaw:false, desc:'🎯 *2ème carte joueur — tension monte !*' },
    { p: player.slice(0,2).map(cardStr), b: banker.slice(0,2).map(cardStr), pRaw:true, bRaw:true, desc:'🎭 *2ème carte banquier — le jeu commence !*' },
  ];
  for (const s of steps) {
    const pVal = s.pRaw ? s.p.join(' ') : (Array.isArray(s.p) && s.p[0]?.value ? s.p.map(cardStr).join(' ') : s.p.join(' '));
    const bVal = s.bRaw ? s.b.join(' ') : (Array.isArray(s.b) && s.b[0]?.value ? s.b.map(cardStr).join(' ') : s.b.join(' '));
    const pScore = s.pRaw ? '' : (s.p[0]?.value ? `(${handTotal(s.p.filter(c=>c?.value))})` : '');
    const bScore = s.bRaw ? '' : (s.b[0]?.value ? `(${handTotal(s.b.filter(c=>c?.value))})` : '');
    const e = new EmbedBuilder()
      .setColor('#1ABC9C').setTitle('🎴 ・ Baccarat ・').setDescription(`${s.desc}`)
      .addFields(
        {name:`👤 Joueur ${pScore}`,value:`**${pVal}**`||'—',inline:true},
        {name:`🏦 Banquier ${bScore}`,value:`**${bVal}**`||'—',inline:true},
      );
    await msg.edit({ embeds: [e] });
    await sleep(600); // Plus de suspense : délai augmenté
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

  // Animation finale de révélation du vainqueur (2-3 frames de transition dramatique)
  const winEmoji = { player: '👤', banker: '🏦', tie: '🤝' };
  const winFrames = [
    { desc: '⏱️ *Calcul des scores en cours...*', color: '#F39C12', delay: 500 },
    { desc: '🎯 *Détermination du vainqueur...*', color: '#E67E22', delay: 400 },
  ];
  for (const frame of winFrames) {
    const transEmbed = new EmbedBuilder()
      .setColor(frame.color)
      .setTitle('🎴 ・ Baccarat ・')
      .setDescription(frame.desc)
      .addFields(
        { name: `👤 Joueur **${pTotal}**`, value: player.map(cardStr).join(' '), inline: true },
        { name: `🏦 Banquier **${bTotal}**`, value: banker.map(cardStr).join(' '), inline: true },
      );
    await msg.edit({ embeds: [transEmbed] }).catch(() => {});
    await sleep(frame.delay);
  }

  const color    = won && betKey === winner ? '#2ECC71' : winner === 'tie' && betKey !== 'tie' ? '#F39C12' : '#E74C3C';
  const desc     = betKey === winner
    ? `🎉 **${betLabels[betKey]} gagne !** +${gain} ${coin}`
    : winner === 'tie' && betKey !== 'tie'
    ? `🤝 Égalité ! Mise remboursée.`
    : `😔 **${betLabels[winner]} gagne.** -${mise} ${coin}`;

  // Update scoreboard
  updateScoreboard(userId, winner, betKey === winner ? gain : (winner === 'tie' && betKey !== 'tie' ? mise : 0), mise);
  const sb = getScoreboard(userId);

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎴 ・ Baccarat — Résultat ・')
    .setDescription(desc)
    .addFields(
      { name: `👤 Joueur **${pTotal}**`, value: player.map(cardStr).join(' '), inline: true },
      { name: `🏦 Banquier **${bTotal}**`, value: banker.map(cardStr).join(' '), inline: true },
      { name: '🏆 Vainqueur', value: `${winEmoji[winner]} ${betLabels[winner]}`, inline: false },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
      { name: '📊 Session', value: `🎭 J:${sb.playerWins} | 🏦 B:${sb.bankerWins} | 🤝 T:${sb.ties} | Net: ${sb.netGain >= 0 ? '+' : ''}${sb.netGain} ${coin}`, inline: false }
    )
    .setFooter({ text: 'Baccarat · Joueur ×2 · Banquier ×1.95 (5% commission) · Égalité ×9' });

  const playAgainButtons = makeGameRow('baccarat', userId, mise, betKey);
  const statsButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`baccarat_stats_${userId}`)
      .setLabel('📊 Stats session')
      .setStyle(ButtonStyle.Secondary)
  );

  await msg.edit({ embeds: [finalEmbed], components: [playAgainButtons, statsButton] });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const cid = interaction.customId;

  if (cid.startsWith('baccarat_stats_')) {
    const userId = cid.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.editReply({ content: '❌ Ces stats ne t\'appartiennent pas.', ephemeral: true });
    }
    const sb = getScoreboard(userId);
    const winRate = sb.gamesPlayed > 0 ? ((sb.playerWins + sb.bankerWins + sb.ties) / sb.gamesPlayed * 100).toFixed(1) : '0.0';
    const statsEmbed = new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('📊 Statistiques de session')
      .addFields(
        { name: '🎯 Parties jouées', value: sb.gamesPlayed.toString(), inline: true },
        { name: '🎭 Joueur gagnées', value: sb.playerWins.toString(), inline: true },
        { name: '🏦 Banquier gagnées', value: sb.bankerWins.toString(), inline: true },
        { name: '🤝 Égalités', value: sb.ties.toString(), inline: true },
        { name: '📈 Taux de gain', value: `${winRate}%`, inline: true },
        { name: '💰 Gain/Perte net', value: `${sb.netGain >= 0 ? '+' : ''}${sb.netGain} coins`, inline: true }
      )
      .setFooter({ text: 'Stats en mémoire (session seulement)' });
    return interaction.editReply({ embeds: [statsEmbed], ephemeral: true });
  }

  if (cid.startsWith('baccarat_replay_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);
    const betKey = parts[4];

    if (interaction.user.id !== userId) {
      return interaction.editReply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
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
      return interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('baccarat', userId, betKey));
    return true;
  }

  if (cid.startsWith('baccarat_modal_') && interaction.isModalSubmit()) {
    const parts = cid.split('_');
    const userId = parts[2];
    const betKey = parts[3];
    if (interaction.user.id !== userId) {
      return interaction.editReply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.editReply({ content: '❌ Mise invalide (min 10 coins).', ephemeral: true });
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
    try {
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
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.editReply(_em).catch(() => {});
    } catch {}
  }},

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
