// ============================================================
// sicbo.js — Sic Bo complet avec animations de dés
// Emplacement : src/commands_guild/games/sicbo.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Génération de dés ────────────────────────────────────
function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function diceStr(value) {
  return `[\`${value}\`]`;
}

// ─── Vérification des paris ──────────────────────────────
function checkBet(dice, betType, betValue) {
  const total = dice[0] + dice[1] + dice[2];
  const sorted = [...dice].sort((a, b) => a - b);
  const [d1, d2, d3] = sorted;

  switch (betType) {
    case 'small':
      // Petit : 4-10 (sauf triple)
      return total >= 4 && total <= 10 && !(d1 === d2 && d2 === d3);

    case 'big':
      // Grand : 11-17 (sauf triple)
      return total >= 11 && total <= 17 && !(d1 === d2 && d2 === d3);

    case 'triple':
      // Triple quelconque
      return d1 === d2 && d2 === d3;

    case 'double':
      // Paire spécifique (2 dés pareils)
      const count = {};
      for (const d of dice) count[d] = (count[d] || 0) + 1;
      return count[betValue] === 2;

    case 'total':
      // Total exact
      return total === betValue;

    case 'single':
      // Dé simple : combien de fois le dé apparaît
      return dice.filter(d => d === betValue).length;

    default:
      return false;
  }
}

// ─── Calcul des gains ────────────────────────────────────
function getMultiplier(betType, result) {
  const multipliers = {
    small: 2,
    big: 2,
    triple: 24,
    double: 10,
    total: { 4: 6, 5: 6, 6: 6, 7: 12, 8: 12, 9: 12, 10: 12, 11: 12, 12: 12, 13: 12, 14: 6, 15: 6, 16: 6, 17: 6 },
    single: { 1: 1, 2: 1, 3: 2 },
  };

  if (betType === 'total') return multipliers.total[result] || 0;
  if (betType === 'single') return multipliers.single[result] || 0;
  return multipliers[betType] || 0;
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
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      netGain: 0,
    });
  }
  return sessionScoreboard.get(userId);
}

function updateScoreboard(userId, won, payout, mise) {
  const sb = getScoreboard(userId);
  sb.gamesPlayed += 1;
  if (won) {
    sb.wins += 1;
    sb.netGain += (payout - mise);
  } else {
    sb.losses += 1;
    sb.netGain -= mise;
  }
}

async function playSicBoGame(source, userId, guildId, mise, betType, betValue = null) {
  const isInteraction = !!source.editReply;
  const u = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Descriptions de paris
  const betDescriptions = {
    small: '4-10 (sans triple)',
    big: '11-17 (sans triple)',
    triple: 'Triple quelconque',
    double: `Paire de ${betValue}`,
    total: `Total exactement ${betValue}`,
    single: `Dé ${betValue} apparaît`,
  };

  const betLabels = {
    small: 'Petit (4-10)',
    big: 'Grand (11-17)',
    triple: 'Triple ×24',
    double: `Paire ×10`,
    total: `Total ×6-12`,
    single: `Dé simple ×1-3`,
  };

  // Animation intro
  const introFrames = [
    { desc: '🎲 *Le croupier prépare les dés...*\n\n🎲🎲🎲', color: '#16A085', delay: 500 },
    { desc: '🎲 *Les dés tourbillonnent dans le gobelet...*\n\n🎲🎲🎲', color: '#1ABC9C', delay: 400 },
  ];

  let msg;
  for (let fi = 0; fi < introFrames.length; fi++) {
    const { desc, color, delay } = introFrames[fi];
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎲 ・ Sic Bo ・')
      .setDescription(desc)
      .addFields(
        { name: '🎯 Pari', value: betLabels[betType], inline: true },
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

  // Lancer les dés
  const dice = [rollDice(), rollDice(), rollDice()];
  const total = dice.reduce((a, b) => a + b, 0);

  // Animation révélation progressive des dés
  const animSteps = [
    { d: ['?', '?', '?'], desc: '🎲 *Premier dé...*' },
    { d: [dice[0], '?', '?'], desc: '🎲 *Deuxième dé...*' },
    { d: [dice[0], dice[1], '?'], desc: '🎲 *Troisième dé...*' },
  ];

  for (const step of animSteps) {
    const displayDice = step.d.map(d => d === '?' ? '[?]' : diceStr(d)).join(' ');
    const e = new EmbedBuilder()
      .setColor('#1ABC9C')
      .setTitle('🎲 ・ Sic Bo ・')
      .setDescription(step.desc)
      .addFields(
        { name: '🎲 Dés', value: `${displayDice}`, inline: false },
        { name: '🎯 Pari', value: betLabels[betType], inline: true },
        { name: '💰 Mise', value: `${mise} ${coin}`, inline: true }
      );
    await msg.edit({ embeds: [e] });
    await sleep(600);
  }

  // Affichage des dés avec total
  await sleep(400);
  const diceDisplay = dice.map(diceStr).join(' ');
  const e = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎲 ・ Sic Bo — Résultat ・')
    .setDescription(`**Les dés se posent...**`)
    .addFields(
      { name: '🎲 Dés', value: diceDisplay, inline: false },
      { name: '➕ Total', value: `**${total}**`, inline: true },
    );
  await msg.edit({ embeds: [e] });
  await sleep(800);

  // Vérifier le gain
  let won = false;
  let multiplier = 0;
  let result = 0;

  if (betType === 'single') {
    result = checkBet(dice, betType, betValue);
    multiplier = getMultiplier(betType, result);
    won = result > 0;
  } else {
    won = checkBet(dice, betType, betValue);
    multiplier = getMultiplier(betType, betType === 'total' ? total : 1);
  }

  let gain = 0;
  if (won) {
    gain = Math.floor(mise * multiplier);
    db.addCoins(userId, guildId, gain);
  }

  const color = won ? '#2ECC71' : '#E74C3C';
  const description = won
    ? `🎉 **GAGNÉ !** +${gain} ${coin}\n\nParade : ${betDescriptions[betType]}`
    : `😔 **Perdu.** -${mise} ${coin}\n\nParade : ${betDescriptions[betType]}`;

  updateScoreboard(userId, won, gain, mise);
  const sb = getScoreboard(userId);

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎲 ・ Sic Bo — Résultat ・')
    .setDescription(description)
    .addFields(
      { name: '🎲 Dés', value: diceDisplay, inline: false },
      { name: '➕ Total', value: `${total}`, inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
      { name: '📊 Session', value: `✅ ${sb.wins} | ❌ ${sb.losses} | Net: ${sb.netGain >= 0 ? '+' : ''}${sb.netGain} ${coin}`, inline: false }
    )
    .setFooter({ text: 'Sic Bo · Petit/Grand ×2 · Paire ×10 · Triple ×24 · Total ×6-12 · Dé ×1-3' });

  const playAgainButtons = makeGameRow('sicbo', userId, mise, betType);
  const statsButton = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`sicbo_stats_${userId}`)
      .setLabel('📊 Stats session')
      .setStyle(ButtonStyle.Secondary)
  );

  await msg.edit({ embeds: [finalEmbed], components: [playAgainButtons, statsButton] });
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const cid = interaction.customId;

  if (cid.startsWith('sicbo_stats_')) {
    const userId = cid.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ces stats ne t\'appartiennent pas.', ephemeral: true }).catch(() => {});
    }
    const sb = getScoreboard(userId);
    const winRate = sb.gamesPlayed > 0 ? ((sb.wins / sb.gamesPlayed) * 100).toFixed(1) : '0.0';
    const statsEmbed = new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('📊 Statistiques de session')
      .addFields(
        { name: '🎯 Parties jouées', value: sb.gamesPlayed.toString(), inline: true },
        { name: '✅ Gagnées', value: sb.wins.toString(), inline: true },
        { name: '❌ Perdues', value: sb.losses.toString(), inline: true },
        { name: '📈 Taux de gain', value: `${winRate}%`, inline: true },
        { name: '💰 Gain/Perte net', value: `${sb.netGain >= 0 ? '+' : ''}${sb.netGain} ${(db.getConfig ? db.getConfig(interaction.guildId) : null)?.currency_emoji || '€'}`, inline: true }
      )
      .setFooter({ text: 'Stats en mémoire (session seulement)' });
    return interaction.reply({ embeds: [statsEmbed], ephemeral: true }).catch(() => {});
  }

  if (cid.startsWith('sicbo_replay_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);
    const betType = parts[4];
    const betValue = parts[5] ? parseInt(parts[5]) : null;

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true }).catch(() => {});
    }

    await interaction.deferUpdate().catch(() => {});
    await playSicBoGame(interaction, userId, interaction.guildId, mise, betType, betValue);
    return true;
  }

  if (cid.startsWith('sicbo_changemise_')) {
    const parts = cid.split('_');
    const userId = parts[2];
    const betType = parts[3];
    if (interaction.user.id !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('sicbo', userId, betType));
    return true;
  }

  if (cid.startsWith('sicbo_modal_') && interaction.isModalSubmit()) {
    const parts = cid.split('_');
    const userId = parts[2];
    const betType = parts[3];
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
    await playSicBoGame(interaction, userId, interaction.guildId, newMise, betType);
    return true;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sicbo')
    .setDescription('🎲 Sic Bo — Trois dés, mille possibilités !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10))
    .addStringOption(o => o.setName('pari').setDescription('Type de pari').setRequired(true)
      .addChoices(
        { name: '4-10 Petit (×2)', value: 'small' },
        { name: '11-17 Grand (×2)', value: 'big' },
        { name: '🎲 Triple (×24)', value: 'triple' },
        { name: '🎲 Paire spécifique (×10)', value: 'double' },
        { name: '➕ Total exact (×6-12)', value: 'total' },
        { name: '🎲 Dé simple (×1-3)', value: 'single' },
      ))
    .addIntegerOption(o => o.setName('valeur').setDescription('Valeur (pour paire/total/dé: 1-6)').setMinValue(1).setMaxValue(17)),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
      const mise = interaction.options.getInteger('mise');
      const pari = interaction.options.getString('pari');
      const valeur = interaction.options.getInteger('valeur');

      await playSicBoGame(interaction, interaction.user.id, interaction.guildId, mise, pari, valeur);
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

  name: 'sicbo',
  aliases: ['sb', 'dices'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    const pari = args[1] || 'small';
    const valeur = parseInt(args[2]);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&sicbo <mise> <small/big/triple/double/total/single> [valeur]`');
    await playSicBoGame(message, message.author.id, message.guildId, mise, pari, valeur);
  },
};
