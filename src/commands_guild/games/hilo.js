// ============================================================
// hilo.js — Hi-Lo : la prochaine carte est-elle PLUS HAUTE ou PLUS BASSE ?
// /hilo mise:500  |  &hilo 500
// Deck 52 cartes, multiplicateur progressif, encaissez avant de vous tromper !
// ============================================================
'use strict';
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ─── Deck 52 cartes ─────────────────────────────────────────
const SUITS  = ['s', 'h', 'd', 'c'];
const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const VALUES = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
const SUIT_EMOJI = { s: '♠️', h: '♥️', d: '♦️', c: '♣️' };
const SUIT_COLOR = { s: '⬛', h: '🟥', d: '🟥', c: '⬛' };

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ suit, rank, value: VALUES[rank] });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardStr(card) {
  return `${SUIT_COLOR[card.suit]} **${card.rank}${SUIT_EMOJI[card.suit]}** (valeur : ${card.value})`;
}

// Multiplicateur basé sur la probabilité + house edge 88%
function calcMult(value, dir) {
  const higher = Math.max(1, 14 - value);
  const lower  = Math.max(1, value - 2);
  const fav    = dir === 'higher' ? higher : lower;
  const prob   = fav / 13;
  return parseFloat(Math.max(1.08, (1 / prob) * 0.88).toFixed(2));
}

// ─── Sessions ────────────────────────────────────────────────
const sessions = new Map();

// ─── Embeds ──────────────────────────────────────────────────
function buildEmbed(session, phase, guessDir) {
  const card   = session.currentCard;
  const gains  = Math.floor(session.mise * session.currentMult);
  const hMult  = calcMult(card.value, 'higher');
  const lMult  = calcMult(card.value, 'lower');
  const streak = session.streak || 0;
  const played = 52 - session.deck.length - 1;

  if (phase === 'playing') {
    const color = streak >= 5 ? '#FF6B35' : streak >= 3 ? '#FFD700' : streak >= 1 ? '#F39C12' : '#5865F2';
    const streakLine = streak > 0
      ? `🔥 **Série active : ${streak} bonne${streak > 1 ? 's' : ''} réponse${streak > 1 ? 's' : ''} !**\n\n`
      : '';
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`🃏 Hi-Lo${streak >= 3 ? ' 🔥 En feu !' : ''}`)
      .setDescription(
        '> *Le deck est battu. La prochaine carte décidera de ton sort...*\n\n' +
        `🎴 Carte actuelle : ${cardStr(card)}\n\n` +
        streakLine +
        `📈 **PLUS HAUTE** → ×**${hMult}** appliqué au gain\n` +
        `📉 **PLUS BASSE**  → ×**${lMult}** appliqué au gain\n\n` +
        `💰 Gain actuel : **${gains.toLocaleString()} 💰** *(×${session.currentMult.toFixed(2)})*\n` +
        `📦 Cartes restantes dans le deck : **${session.deck.length}**`
      )
      .setFooter({ text: `NexusBot Casino • Hi-Lo  |  ${played} carte${played !== 1 ? 's' : ''} jouée${played !== 1 ? 's' : ''}` });
  }

  if (phase === 'correct') {
    const bonus = streak >= 5 ? ' 🔥🔥 SÉRIE INFERNALE !' : streak >= 3 ? ' 🔥 Série en feu !' : '';
    return new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`✅ ${guessDir === 'higher' ? '📈 Plus haute !' : '📉 Plus basse !'}${bonus}`)
      .setDescription(
        `🎴 Nouvelle carte : ${cardStr(card)}\n\n` +
        `🔥 Série : **${streak}** bonne${streak !== 1 ? 's' : ''} réponse${streak !== 1 ? 's' : ''} de suite !\n` +
        `💰 Gain actuel : **${gains.toLocaleString()} 💰** *(×${session.currentMult.toFixed(2)})*\n\n` +
        `📈 Monter → ×${hMult}   |   📉 Descendre → ×${lMult}\n\n` +
        '**Continue l\'ascension ou encaisse tes gains ?**'
      )
      .setFooter({ text: `NexusBot Casino • Hi-Lo  |  ${session.deck.length} cartes restantes` });
  }

  if (phase === 'tie') {
    return new EmbedBuilder()
      .setColor('#95A5A6')
      .setTitle('🟰 Égalité parfaite — Aucune perte, aucun gain')
      .setDescription(
        `🎴 Nouvelle carte : ${cardStr(card)} — Même valeur !\n\n` +
        `💰 Gain actuel : **${gains.toLocaleString()} 💰** *(×${session.currentMult.toFixed(2)})*\n\n` +
        'La série continue — retente ta chance !'
      )
      .setFooter({ text: 'NexusBot Casino • Hi-Lo  |  Égalité = on continue !' });
  }

  if (phase === 'wrong') {
    const msgs = [
      'Le deck ne pardonne pas. Retente ta chance !',
      'Si près du but... La prochaine sera la bonne.',
      'La fortune est cruelle, mais elle tourne !',
      "Ton instinct t'a trahi cette fois. Revanche ?",
    ];
    return new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('💥 Mauvaise carte — Game Over !')
      .setDescription(
        `🎴 La carte révélée : ${cardStr(card)}\n\n` +
        `💸 **Perdu : ${session.mise.toLocaleString()} 💰**\n` +
        `🔥 Série finale : **${streak}** bonne${streak !== 1 ? 's' : ''} réponse${streak !== 1 ? 's' : ''} avant la chute\n\n` +
        `*${msgs[Math.floor(Math.random() * msgs.length)]}*`
      )
      .setFooter({ text: 'NexusBot Casino • Hi-Lo' });
  }

  if (phase === 'cashout') {
    const msgs = [
      "La prudence, c'est aussi une forme de victoire.",
      'Vous avez su stopper au bon moment — sage décision !',
      'Les vrais pros savent encaisser à temps.',
      "Banque faite ! C'est ça la vraie stratégie.",
    ];
    return new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 Encaissement — Bien joué !')
      .setDescription(
        `**${played}** cartes jouées avec succès !\n\n` +
        `💰 **+${gains.toLocaleString()} 💰** *(×${session.currentMult.toFixed(2)})*\n\n` +
        `*${msgs[Math.floor(Math.random() * msgs.length)]}*`
      )
      .setFooter({ text: 'NexusBot Casino • Hi-Lo' });
  }

  if (phase === 'deck_empty') {
    return new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('👑 DECK ÉPUISÉ — Victoire absolue !')
      .setDescription(
        'Incroyable ! Tu as traversé les **52 cartes** du deck sans faute !\n\n' +
        `💰 **+${gains.toLocaleString()} 💰** *(×${session.currentMult.toFixed(2)})*\n\n` +
        '*Tu es une véritable légende du Hi-Lo.*'
      )
      .setFooter({ text: 'NexusBot Casino • Hi-Lo' });
  }

  return new EmbedBuilder().setColor('#5865F2').setTitle('Hi-Lo');
}

function buildButtons(sessionId, session) {
  const card      = session.currentCard;
  const gains     = Math.floor(session.mise * session.currentMult);
  const hMult     = calcMult(card.value, 'higher');
  const lMult     = calcMult(card.value, 'lower');
  const canCashout = session.currentMult > 1.0;

  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hilo_higher_${sessionId}`)
      .setLabel(`📈 Plus haute  ×${hMult}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`hilo_cashout_${sessionId}`)
      .setLabel(`💰 Encaisser ${gains.toLocaleString()} 💰`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canCashout),
    new ButtonBuilder()
      .setCustomId(`hilo_lower_${sessionId}`)
      .setLabel(`📉 Plus basse  ×${lMult}`)
      .setStyle(ButtonStyle.Danger),
  )];
}

// ─── Module ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('hilo')
    .setDescription('🃏 Hi-Lo : la prochaine carte est-elle plus haute ou plus basse ?')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Mise (50–20 000 coins)')
      .setRequired(true)
      .setMinValue(50)
      .setMaxValue(20000)
    ),
  cooldown: 5,

  async execute(interaction) {
    return runGame(interaction, interaction.options.getInteger('mise'), false);
  },

  run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 50 || mise > 20000)
      return message.reply('❌ Usage : `&hilo <mise>` (50–20 000 coins)');
    return runGame(message, mise, true);
  },

  handleComponent,
};

// ─── Logique partagée ────────────────────────────────────────
async function runGame(ctx, mise, isPrefix) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;
  const key     = `${userId}_${guildId}`;

  if (sessions.has(key)) {
    const msg = "❌ Tu as déjà une partie Hi-Lo en cours ! Termine-la avant d'en lancer une nouvelle.";
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  const userData = db.getUser(userId, guildId);
  if (!userData || userData.balance < mise) {
    const msg = `❌ Solde insuffisant ! Tu as **${(userData?.balance || 0).toLocaleString()} 💰** pour une mise de **${mise.toLocaleString()} 💰**.`;
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  db.updateBalance(userId, guildId, -mise);

  const deck        = createDeck();
  const currentCard = deck.shift();
  const session     = { deck, currentCard, currentMult: 1.0, mise, userId, guildId, streak: 0 };
  sessions.set(key, session);

  // Auto-cashout 5 min
  setTimeout(() => {
    const s = sessions.get(key);
    if (s) {
      const g = Math.floor(s.mise * s.currentMult);
      if (g > s.mise) db.updateBalance(s.userId, s.guildId, g);
      sessions.delete(key);
    }
  }, 5 * 60 * 1000);

  const embed   = buildEmbed(session, 'playing');
  const buttons = buildButtons(key, session);
  return isPrefix ? ctx.reply({ embeds: [embed], components: buttons }) : ctx.reply({ embeds: [embed], components: buttons });
}

// ─── Gestion des boutons ─────────────────────────────────────
async function handleComponent(interaction, customId) {
  if (!customId.startsWith('hilo_')) return false;

  const parts  = customId.split('_');
  const action = parts[1]; // higher | lower | cashout

  const userId  = interaction.user.id;
  const guildId = interaction.guildId;
  const key     = `${userId}_${guildId}`;
  const session = sessions.get(key);

  if (!session) {
    await interaction.reply({ content: '❌ Session expirée (5 min). Lance une nouvelle partie avec `/hilo` !', ephemeral: true });
    return true;
  }
  if (session.userId !== userId) {
    await interaction.reply({ content: "❌ Ce n'est pas ta partie de Hi-Lo !", ephemeral: true });
    return true;
  }

  await interaction.deferUpdate();

  // ── Cashout ──────────────────────────────────────────────────
  if (action === 'cashout') {
    const gains = Math.floor(session.mise * session.currentMult);
    db.updateBalance(session.userId, session.guildId, gains);
    db.addXP(session.userId, session.guildId, Math.max(5, Math.floor(gains / 80)));
    sessions.delete(key);
    await interaction.editReply({ embeds: [buildEmbed(session, 'cashout')], components: [] });
    return true;
  }

  // ── Deck épuisé ──────────────────────────────────────────────
  if (session.deck.length === 0) {
    const gains = Math.floor(session.mise * session.currentMult);
    db.updateBalance(session.userId, session.guildId, gains);
    db.addXP(session.userId, session.guildId, Math.max(50, Math.floor(gains / 30)));
    sessions.delete(key);
    await interaction.editReply({ embeds: [buildEmbed(session, 'deck_empty')], components: [] });
    return true;
  }

  // ── Tirer la prochaine carte ──────────────────────────────────
  const prevCard = session.currentCard;
  const nextCard = session.deck.shift();
  session.currentCard = nextCard;

  const isTie    = nextCard.value === prevCard.value;
  const isHigher = nextCard.value > prevCard.value;
  const isLower  = nextCard.value < prevCard.value;

  if (isTie) {
    sessions.set(key, session);
    await interaction.editReply({ embeds: [buildEmbed(session, 'tie')], components: buildButtons(key, session) });
    return true;
  }

  const correct =
    (action === 'higher' && isHigher) ||
    (action === 'lower'  && isLower);

  if (correct) {
    session.streak = (session.streak || 0) + 1;
    const mult = calcMult(prevCard.value, action);
    session.currentMult = parseFloat((session.currentMult * mult).toFixed(4));
    sessions.set(key, session);
    await interaction.editReply({ embeds: [buildEmbed(session, 'correct', action)], components: buildButtons(key, session) });
  } else {
    sessions.delete(key);
    await interaction.editReply({ embeds: [buildEmbed(session, 'wrong')], components: [] });
  }

  return true;
}
