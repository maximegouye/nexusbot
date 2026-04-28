// ============================================================
// coffre-magique.js — 🗝️ COFFRE MAGIQUE PROGRESSIF 🗝️
// Mini-jeu interactif multi-niveaux (5 niveaux, 3 portes/niveau)
// Trésor → multiplicateur croissant ×1.3 → ×1.7 → ×2.5 → ×4 → ×7
// Bombe → tu perds tout. Encaisser → tu repars avec le gain.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── State en mémoire (par userId_guildId) ──────────────────
const sessions = new Map();

// ─── Multiplicateurs progressifs (RTP ≈ 96%) ───────────────
// À chaque niveau réussi : 2 portes safe + 1 bombe → P(safe) = 2/3 par étape
// Mult cumulé après N niveaux : ×1.3, ×2.21, ×5.52, ×22, ×154
// Les valeurs ci-dessous sont un peu plus douces pour équilibrer le risque.
const LEVEL_MULTS = [1.3, 1.7, 2.5, 4.0, 7.0];

// ─── Affichage des portes ──────────────────────────────────
function renderDoors(level, opened = -1, content = null) {
  const doors = [];
  for (let i = 0; i < 3; i++) {
    if (opened === i) {
      doors.push(`     ${content === 'bomb' ? '💣' : '💎'}     `);
    } else if (opened !== -1) {
      // les autres portes restent fermées
      doors.push(`     🚪    `);
    } else {
      doors.push(`     🚪    `);
    }
  }
  const labels = ['  PORTE 1  ', '  PORTE 2  ', '  PORTE 3  '];
  return [
    '```',
    `╔═══════════╦═══════════╦═══════════╗`,
    `║${labels[0]}║${labels[1]}║${labels[2]}║`,
    `║${doors[0]}║${doors[1]}║${doors[2]}║`,
    `║   [ A ]   ║   [ B ]   ║   [ C ]   ║`,
    `╚═══════════╩═══════════╩═══════════╝`,
    `       NIVEAU ${level + 1} / 5`,
    '```',
  ].join('\n');
}

// ─── Render coffre ─────────────────────────────────────────
function renderTreasureChest(filled = 0) {
  const bars = '▓'.repeat(filled) + '░'.repeat(20 - filled);
  return [
    '```',
    '          ╔═══════════════╗',
    '          ║  🗝️ COFFRE  🗝️ ║',
    '          ║   M A G I Q U E ║',
    '          ╚═══════════════╝',
    `       [${bars}]`,
    '```',
  ].join('\n');
}

// ─── Démarrage du jeu ──────────────────────────────────────
async function playCoffre(source, userId, guildId, mise) {
  const isInteraction = !!source.editReply;
  const cfg = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg.currency_emoji || '€';
  const u = db.getUser(userId, guildId);

  if (!u) {
    const err = '❌ Compte introuvable.';
    return isInteraction ? source.editReply({ content: err }) : source.reply(err);
  }

  if (!mise || mise < 100) {
    const err = `❌ Mise minimum : **100 ${coin}**`;
    return isInteraction ? source.editReply({ content: err, ephemeral: true }) : source.reply(err);
  }
  if (mise > u.balance) {
    const err = `❌ Solde insuffisant. Tu as **${u.balance.toLocaleString('fr-FR')} ${coin}**`;
    return isInteraction ? source.editReply({ content: err, ephemeral: true }) : source.reply(err);
  }

  // Prélever la mise
  db.removeCoins(userId, guildId, mise);

  // Init session
  const key = `${userId}_${guildId}`;
  sessions.set(key, {
    mise,
    level: 0,
    currentGain: mise, // commence à mise (×1)
    locked: false,
  });

  // Embed d'intro
  const playerName = (source.user && source.user.username) || (source.author && source.author.username) || 'Joueur';

  const introEmbed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('🗝️ ━━━ COFFRE MAGIQUE PROGRESSIF ━━━ 🗝️')
    .setDescription([
      `**${playerName}** ouvre l'antichambre du coffre.`,
      '',
      renderTreasureChest(2),
      '',
      `💰 Mise : **${mise.toLocaleString('fr-FR')} ${coin}**`,
      '',
      `🎯 **5 niveaux**, **3 portes** par niveau`,
      `🚪 2 portes : **TRÉSOR** → ×1.3, ×1.7, ×2.5, ×4.0, ×7.0`,
      `💣 1 porte : **BOMBE** → tu perds tout`,
      `💵 Encaisser : tu repars avec le gain accumulé`,
      '',
      '*Choisis une porte pour commencer...*',
    ].join('\n'))
    .setFooter({ text: 'Coffre Magique · Plus tu progresses, plus le risque est grand' });

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cf_pick_${userId}_0`).setLabel('🚪 Porte A').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cf_pick_${userId}_1`).setLabel('🚪 Porte B').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cf_pick_${userId}_2`).setLabel('🚪 Porte C').setStyle(ButtonStyle.Primary),
  );

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [introEmbed], components: [buttons] });
  } else {
    msg = await source.reply({ embeds: [introEmbed], components: [buttons] });
  }
  // Stocker un ref vers le message pour edits ultérieurs
  sessions.get(key).messageId = msg.id;
  sessions.get(key).channelId = msg.channel ? msg.channel.id : (msg.channelId || null);
}

// ─── Gestion d'une porte choisie ────────────────────────────
async function handleDoorPick(interaction, userId, guildId, doorIdx) {
  const key = `${userId}_${guildId}`;
  const sess = sessions.get(key);
  if (!sess) {
    await interaction.reply({ content: '❌ Aucune partie en cours. Lance `/coffre-magique` pour démarrer.', ephemeral: true }).catch(() => {});
    return;
  }
  if (sess.locked) {
    await interaction.reply({ content: '⏳ Animation en cours...', ephemeral: true }).catch(() => {});
    return;
  }
  sess.locked = true;

  const cfg = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg.currency_emoji || '€';
  await interaction.deferUpdate().catch(() => {});

  // Tirer le contenu : 2 portes safe (trésor) + 1 bombe
  const bombDoor = Math.floor(Math.random() * 3);
  const isBomb = doorIdx === bombDoor;

  // ── Animation : porte qui s'ouvre lentement ──
  const lockSeq = ['🔐', '🔒', '🔓', '🔑'];
  for (const lock of lockSeq) {
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle(`${lock}  Tu ouvres la Porte ${'ABC'[doorIdx]}...  ${lock}`)
      .setDescription([
        renderDoors(sess.level, -1),
        '',
        `🤫 *Le mécanisme se déverrouille...*`,
        `**Niveau ${sess.level + 1}/5** · Gain accumulé : **${sess.currentGain.toLocaleString('fr-FR')} ${coin}**`,
      ].join('\n'))
    ], components: [] }).catch(() => {});
    await sleep(380);
  }

  if (isBomb) {
    // ── BOMBE : perte totale ──
    sess.locked = false;
    sessions.delete(key);

    // Animation explosion
    for (const exp of ['💥', '💣 💥 💣', '🔥 💥 🔥']) {
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`💣  BOMBE !  💥`)
        .setDescription([
          renderDoors(sess.level, doorIdx, 'bomb'),
          '',
          `${exp}`,
          '',
          `❌ Tu as ouvert la **mauvaise porte**.`,
          `💸 Perte : **${sess.mise.toLocaleString('fr-FR')} ${coin}**`,
        ].join('\n'))
      ], components: [] }).catch(() => {});
      await sleep(450);
    }

    const newBal = db.getUser(userId, guildId)?.balance || 0;
    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#C0392B')
      .setTitle('💣 COFFRE EXPLOSÉ — Tu as perdu')
      .setDescription([
        renderDoors(sess.level, doorIdx, 'bomb'),
        '',
        `💀 La **Porte ${'ABC'[doorIdx]}** contenait une bombe.`,
        `💸 Tu as perdu **${sess.mise.toLocaleString('fr-FR')} ${coin}**.`,
        '',
        `🏦 Solde : **${newBal.toLocaleString('fr-FR')} ${coin}**`,
      ].join('\n'))
      .setFooter({ text: 'Coffre Magique · Retente ta chance avec /coffre-magique' })
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cf_replay_${userId}_${sess.mise}`).setLabel(`🔄 Rejouer (${sess.mise} ${coin})`).setStyle(ButtonStyle.Success),
    )] }).catch(() => {});
    return;
  }

  // ── TRÉSOR : on monte de niveau ──
  const newGain = Math.floor(sess.mise * LEVEL_MULTS[sess.level]);
  sess.currentGain = newGain;
  sess.level += 1;

  if (sess.level >= 5) {
    // ── VICTOIRE FINALE : top niveau atteint ──
    db.addCoins(userId, guildId, newGain);
    const newBal = db.getUser(userId, guildId)?.balance || 0;
    sessions.delete(key);

    // Animation jackpot
    for (const flash of ['#FFD700', '#FF00FF', '#00FF7F']) {
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(flash)
        .setTitle('🌟 ✨ COFFRE MAÎTRE OUVERT ✨ 🌟')
        .setDescription([
          renderDoors(4, doorIdx, 'treasure'),
          '',
          renderTreasureChest(20),
          '',
          `🏆 **Tu as conquis les 5 niveaux !**`,
          `💰 Gain final : **${newGain.toLocaleString('fr-FR')} ${coin}** (×${LEVEL_MULTS[4]})`,
        ].join('\n'))
      ], components: [] }).catch(() => {});
      await sleep(450);
    }

    await interaction.editReply({ embeds: [new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 GRAND COFFRE — CONQUIS !')
      .setDescription([
        `🌟 Niveau **MAX** atteint ! Tu as remporté tous les coffres.`,
        '',
        renderTreasureChest(20),
        '',
        `💰 **+${newGain.toLocaleString('fr-FR')} ${coin}** (×${LEVEL_MULTS[4]})`,
        `🏦 Solde : **${newBal.toLocaleString('fr-FR')} ${coin}**`,
      ].join('\n'))
      .setFooter({ text: 'Légende absolue · Coffre Magique · Almosni Casino' })
      .setTimestamp()
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cf_replay_${userId}_${sess.mise}`).setLabel(`🔄 Rejouer (${sess.mise} ${coin})`).setStyle(ButtonStyle.Success),
    )] }).catch(() => {});
    return;
  }

  // ── Niveau suivant : choix entre continuer ou encaisser ──
  sess.locked = false;
  const nextMult = LEVEL_MULTS[sess.level];
  const projectedGain = Math.floor(sess.mise * nextMult);

  await interaction.editReply({ embeds: [new EmbedBuilder()
    .setColor('#2ECC71')
    .setTitle(`💎 TRÉSOR ! Niveau ${sess.level}/5 réussi`)
    .setDescription([
      renderDoors(sess.level - 1, doorIdx, 'treasure'),
      '',
      renderTreasureChest(Math.min(20, sess.level * 4)),
      '',
      `✅ La **Porte ${'ABC'[doorIdx]}** contenait un trésor !`,
      `💰 Gain accumulé : **${newGain.toLocaleString('fr-FR')} ${coin}** (×${LEVEL_MULTS[sess.level - 1]})`,
      '',
      `🎯 Niveau suivant (${sess.level + 1}/5) :`,
      `   ➜ Si trésor : **${projectedGain.toLocaleString('fr-FR')} ${coin}** (×${nextMult})`,
      `   ➜ Si bombe : **0** (perte totale)`,
      '',
      `⚖️ Encaisser maintenant ou continuer ?`,
    ].join('\n'))
    .setFooter({ text: `Coffre Magique · Niveau ${sess.level + 1} / 5` })
  ], components: [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`cf_pick_${userId}_0`).setLabel('🚪 Porte A').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cf_pick_${userId}_1`).setLabel('🚪 Porte B').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cf_pick_${userId}_2`).setLabel('🚪 Porte C').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cf_cashout_${userId}`).setLabel(`💵 Encaisser (+${newGain.toLocaleString('fr-FR')} ${coin})`).setStyle(ButtonStyle.Success),
    ),
  ] }).catch(() => {});
}

// ─── Encaissement ──────────────────────────────────────────
async function handleCashout(interaction, userId, guildId) {
  const key = `${userId}_${guildId}`;
  const sess = sessions.get(key);
  if (!sess) {
    await interaction.reply({ content: '❌ Aucune partie en cours.', ephemeral: true }).catch(() => {});
    return;
  }

  await interaction.deferUpdate().catch(() => {});

  const cfg = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg.currency_emoji || '€';
  const finalGain = sess.currentGain;
  db.addCoins(userId, guildId, finalGain);
  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const lvlReached = sess.level;
  const mise = sess.mise;
  sessions.delete(key);

  await interaction.editReply({ embeds: [new EmbedBuilder()
    .setColor('#1ABC9C')
    .setTitle('💵 ENCAISSEMENT — Tu repars avec le butin')
    .setDescription([
      renderTreasureChest(Math.min(20, lvlReached * 4)),
      '',
      `🛡️ Tu as fait le bon choix : encaisser !`,
      `🪜 Niveau atteint : **${lvlReached}/5**`,
      `💰 Mise : ${mise.toLocaleString('fr-FR')} ${coin}`,
      `📊 Gain net : **+${(finalGain - mise).toLocaleString('fr-FR')} ${coin}**`,
      '',
      `🏦 Solde : **${newBal.toLocaleString('fr-FR')} ${coin}**`,
    ].join('\n'))
    .setFooter({ text: 'Coffre Magique · La sagesse paie aussi' })
    .setTimestamp()
  ], components: [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cf_replay_${userId}_${mise}`).setLabel(`🔄 Rejouer (${mise} ${coin})`).setStyle(ButtonStyle.Success),
  )] }).catch(() => {});
}

// ─── handleComponent ──────────────────────────────────────
async function handleComponent(interaction, cid) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (cid.startsWith('cf_pick_')) {
    const parts = cid.split('_');
    const targetId = parts[2];
    const doorIdx = parseInt(parts[3]);
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce coffre ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await handleDoorPick(interaction, userId, guildId, doorIdx);
    return true;
  }

  if (cid.startsWith('cf_cashout_')) {
    const targetId = cid.replace('cf_cashout_', '');
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce coffre ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await handleCashout(interaction, userId, guildId);
    return true;
  }

  if (cid.startsWith('cf_replay_')) {
    const parts = cid.split('_');
    const targetId = parts[2];
    const mise = parseInt(parts[3]) || 100;
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    await playCoffre(interaction, userId, guildId, mise);
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('coffre-magique')
    .setDescription('🗝️ Coffre Magique — 5 niveaux progressifs (×1.3 → ×7), 3 portes/niveau, 1 bombe!')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Mise initiale (min 100)')
      .setRequired(true)
      .setMinValue(100)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise = interaction.options.getInteger('mise');
    await playCoffre(interaction, interaction.user.id, interaction.guildId, mise);
  },

  handleComponent,

  name: 'coffre-magique',
  aliases: ['coffre', 'cf', 'magique', 'vault'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) {
      return message.reply('❌ Usage : `&coffre-magique <mise>` (min 100)');
    }
    const u = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') mise = bal;
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 100) return message.reply('❌ Mise minimum : 100');
    await playCoffre(message, message.author.id, message.guildId, mise);
  },
};
