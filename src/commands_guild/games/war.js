// ============================================================
// war.js — Casino War complet avec animations de cartes
// Emplacement : src/commands_guild/games/war.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Cartes ───────────────────────────────────────────────
const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function cardValue(value) {
  const map = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  return map[value] || 0;
}

function cardStr(card) {
  return `\`${card.value}${card.suit}\``;
}

function newDeck() {
  const d = [];
  for (const s of SUITS) {
    for (const v of VALUES) {
      d.push({ suit: s, value: v });
    }
  }
  // Shuffle
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Game Sessions Map with TTL ───────────────────────────
const gameSessions = new Map();
const sessionScoreboard = new Map();

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
      dealerWins: 0,
      ties: 0,
      gamesPlayed: 0,
      netGain: 0,
    });
  }
  return sessionScoreboard.get(userId);
}

function updateScoreboard(userId, result, payout, mise) {
  const sb = getScoreboard(userId);
  sb.gamesPlayed += 1;
  if (result === 'player') {
    sb.playerWins += 1;
    sb.netGain += (payout - mise);
  } else if (result === 'dealer') {
    sb.dealerWins += 1;
    sb.netGain -= mise;
  } else if (result === 'tie') {
    sb.ties += 1;
  }
}

async function playWarGame(source, userId, guildId, mise, isWarRound = false, warCards = null) {
  const isInteraction = !!source.editReply;
  const u = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  // Vérification du solde (sinon prendre du session)
  let actualMise = mise;
  if (isWarRound && warCards) {
    // En guerre, la mise double
    actualMise = mise * 2;
    if (!u || u.balance < actualMise) {
      const err = `❌ Solde insuffisant pour la guerre. Tu as **${u?.balance || 0} ${coin}** (besoin de ${actualMise} ${coin}).`;
      if (isInteraction) return source.editReply({ content: err, ephemeral: true });
      return source.reply(err);
    }
    db.addCoins(userId, guildId, -actualMise);
  } else if (!isWarRound) {
    if (!u || u.balance < mise) {
      const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
      if (isInteraction) return source.editReply({ content: err, ephemeral: true });
      return source.reply(err);
    }
    db.addCoins(userId, guildId, -mise);
  }

  // Deck
  const deck = newDeck();

  // Distribution initiale
  let playerCard, dealerCard;
  if (isWarRound && warCards) {
    playerCard = warCards.playerCard;
    dealerCard = warCards.dealerCard;
  } else {
    playerCard = deck.pop();
    dealerCard = deck.pop();
  }

  // Animation intro
  let msg;
  if (!isWarRound) {
    const introFrames = [
      { desc: '🎴 *Le croupier distribue les cartes...*\n\n🃏 🃏', color: '#16A085', delay: 500 },
      { desc: '🎴 *Tension dans l\'air...*\n\n🃏 🃏', color: '#1ABC9C', delay: 400 },
    ];

    for (let fi = 0; fi < introFrames.length; fi++) {
      const { desc, color, delay } = introFrames[fi];
      const e = new EmbedBuilder()
        .setColor(color)
        .setTitle('⚔️ ・ Casino War ・')
        .setDescription(desc)
        .addFields(
          { name: '💰 Mise', value: `${mise} ${coin}`, inline: true }
        );
      if (fi === 0) {
        if (isInteraction) {
          msg = await source.editReply({ embeds: [e] });
        } else {
          msg = await source.reply({ embeds: [e] });
        }
      } else {
        await msg.edit({ embeds: [e] });
      }
      await sleep(delay);
    }
  } else {
    const e = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('⚔️ ・ Casino War — EN GUERRE ! ・')
      .setDescription('🎴 *Cartes de la guerre distribuées...*')
      .addFields(
        { name: '💰 Mise doublée', value: `${actualMise} ${coin}`, inline: true }
      );
    msg = await source.editReply({ embeds: [e] });
  }

  // Révélation des cartes
  await sleep(600);

  const revealFrames = [
    { pCard: '🃏', dCard: '🃏', desc: '🎴 *Révélation...*' },
    { pCard: cardStr(playerCard), dCard: '🃏', desc: '✨ *Votre carte !*' },
  ];

  for (const frame of revealFrames) {
    const e = new EmbedBuilder()
      .setColor('#1ABC9C')
      .setTitle('⚔️ ・ Casino War ・')
      .setDescription(frame.desc)
      .addFields(
        { name: '👤 Votre carte', value: frame.pCard, inline: true },
        { name: '🤖 Carte du croupier', value: frame.dCard, inline: true }
      );
    await msg.edit({ embeds: [e] });
    await sleep(700);
  }

  await sleep(300);

  // Révélation finale du croupier
  const e = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('⚔️ ・ Casino War — Résultat ・')
    .setDescription('**Les cartes se révèlent !**')
    .addFields(
      { name: '👤 Votre carte', value: cardStr(playerCard), inline: true },
      { name: '🤖 Carte du croupier', value: cardStr(dealerCard), inline: true }
    );
  await msg.edit({ embeds: [e] });
  await sleep(800);

  // Déterminer le gagnant
  const pVal = cardValue(playerCard.value);
  const dVal = cardValue(dealerCard.value);

  let won = false;
  let gain = 0;
  let result = 'dealer';

  if (pVal > dVal) {
    won = true;
    gain = actualMise * 2;
    result = 'player';
    db.addCoins(userId, guildId, gain);
  } else if (pVal === dVal) {
    // Égalité ! Option "En guerre"
    result = 'tie';
    updateScoreboard(userId, 'tie', 0, mise);

    const warButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`war_gowar_${userId}_${mise}`)
        .setLabel('⚔️ En Guerre !')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`war_surrender_${userId}_${mise}`)
        .setLabel('🏳️ Abandonner')
        .setStyle(ButtonStyle.Secondary)
    );

    const tieEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('⚔️ ・ Casino War — Égalité ! ・')
      .setDescription(`🤝 **C'est l'égalité !**\n\n**Votre carte :** ${cardStr(playerCard)} | **Carte du croupier :** ${cardStr(dealerCard)}`)
      .addFields(
        { name: '⚔️ Options', value: 'Vous pouvez relancer la bataille en doublant la mise, ou abandonner et récupérer la moitié.', inline: false }
      )
      .setFooter({ text: 'En guerre: gagner ×3 | Abandonner: récupérer moitié' });

    await msg.edit({ embeds: [tieEmbed], components: [warButtons] });
    return;
  } else {
    // Dealer gagne
    result = 'dealer';
    db.addCoins(userId, guildId, 0);
  }

  const color = result === 'player' ? '#2ECC71' : '#E74C3C';
  const description = result === 'player'
    ? `🎉 **GAGNÉ !** +${gain} ${coin}`
    : `😔 **Perdu.** -${actualMise} ${coin}`;

  updateScoreboard(userId, result, gain, actualMise);
  const sb = getScoreboard(userId);

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('⚔️ ・ Casino War — Résultat ・')
    .setDescription(description)
    .addFields(
      { name: '👤 Votre carte', value: cardStr(playerCard), inline: true },
      { name: '🤖 Carte du croupier', value: cardStr(dealerCard), inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
      { name: '📊 Session', value: `✅ ${sb.playerWins} | ❌ ${sb.dealerWins} | 🤝 ${sb.ties} | Net: ${sb.netGain >= 0 ? '+' : ''}${sb.netGain} ${coin}`, inline: false }
    )
    .setFooter({ text: 'Casino War · Carte haute gagne · Égalité = relancer ou récupérer moitié' });

  const playAgainButtons = makeGameRow('war', userId, mise, '');
  const statsButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`war_stats_${userId}`)
      .setLabel('📊 Stats session')
      .setStyle(ButtonStyle.Secondary)
  );

  await msg.edit({ embeds: [finalEmbed], components: [playAgainButtons, statsButton] });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const cid = interaction.customId;

  if (cid.startsWith('war_stats_')) {
    const userId = cid.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ces stats ne t\'appartiennent pas.', ephemeral: true }).catch(() => {});
    }
    const sb = getScoreboard(userId);
    const winRate = sb.gamesPlayed > 0 ? ((sb.playerWins / sb.gamesPlayed) * 100).toFixed(1) : '0.0';
    const statsEmbed = new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('📊 Statistiques de session')
      .addFields(
        { name: '🎯 Parties jouées', value: sb.gamesPlayed.toString(), inline: true },
        { name: '✅ Gagnées', value: sb.playerWins.toString(), inline: true },
        { name: '❌ Perdues', value: sb.dealerWins.toString(), inline: true },
        { name: '🤝 Égalités', value: sb.ties.toString(), inline: true },
        { name: '📈 Taux de gain', value: `${winRate}%`, inline: true },
        { name: '💰 Gain/Perte net', value: `${sb.netGain >= 0 ? '+' : ''}${sb.netGain} ${(db.getConfig ? db.getConfig(interaction.guildId) : null)?.currency_emoji || '€'}`, inline: true }
      )
      .setFooter({ text: 'Stats en mémoire (session seulement)' });
    return interaction.reply({ embeds: [statsEmbed], ephemeral: true }).catch(() => {});
  }

  if (cid.startsWith('war_gowar_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true }).catch(() => {});
    }

    // Sauvegarder les cartes précédentes
    const deck = newDeck();
    const playerCard = deck.pop();
    const dealerCard = deck.pop();

    await interaction.deferUpdate().catch(() => {});
    await playWarGame(interaction, userId, interaction.guildId, mise, true, { playerCard, dealerCard });
    return true;
  }

  if (cid.startsWith('war_surrender_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true }).catch(() => {});
    }

    const u = db.getUser(userId, interaction.guildId);
    const coin = (db.getConfig ? db.getConfig(interaction.guildId) : null)?.currency_emoji || '€';

    // Récupérer la moitié
    const refund = Math.floor(mise / 2);
    db.addCoins(userId, interaction.guildId, refund);

    const surrenderEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('⚔️ ・ Casino War — Abandon ・')
      .setDescription(`🏳️ **Vous vous rendez.**\n\nMise remboursée partiellement: +${refund} ${coin}`)
      .addFields(
        { name: '🏦 Solde', value: `${db.getUser(userId, interaction.guildId)?.balance || 0} ${coin}`, inline: true }
      );

    const playAgainButtons = makeGameRow('war', userId, mise, '');
    const statsButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`war_stats_${userId}`)
        .setLabel('📊 Stats session')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [surrenderEmbed], components: [playAgainButtons, statsButton] });
    return true;
  }

  if (cid.startsWith('war_replay_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true }).catch(() => {});
    }

    await interaction.deferUpdate().catch(() => {});
    await playWarGame(interaction, userId, interaction.guildId, mise, false);
    return true;
  }

  if (cid.startsWith('war_changemise_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('war', userId, ''));
    return true;
  }

  if (cid.startsWith('war_modal_') && interaction.isModalSubmit()) {
    const parts = cid.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 €).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playWarGame(interaction, userId, interaction.guildId, newMise);
    return true;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('war')
    .setDescription('⚔️ Casino War — Ta carte vs la mienne, le plus haut gagne !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
      const mise = interaction.options.getInteger('mise');

      await playWarGame(interaction, interaction.user.id, interaction.guildId, mise);
    } catch (err) {
      console.error('[CMD] Erreur:', err?.message || err);
      const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0, 200)}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
        else await interaction.editReply(_em).catch(() => {});
      } catch { }
    }
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
  },

  name: 'war',
  aliases: ['cw', 'cardwar'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&war <mise>`');
    await playWarGame(message, message.author.id, message.guildId, mise);
  },
};
