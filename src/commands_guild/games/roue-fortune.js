// ============================================================
// roue-fortune.js — 🎡 GRANDE ROUE ALMOSNI PREMIUM 🎡
// Animation épique multi-phases, 12 segments multiplicateurs,
// historique des 5 derniers tours, bonus spéciaux dynamiques
// Mise minimum: 50€, pas de limite max
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── 12 segments variés avec multiplicateurs ─────────────────
const SEGMENTS = [
  { label: '×0.5 REMB',    mult: 0.5,   emoji: '🔄', color: '#95A5A6', type: 'partial' },
  { label: '×1.5 GAIN',    mult: 1.5,   emoji: '📈', color: '#F39C12', type: 'win' },
  { label: '×2 MISE',      mult: 2,     emoji: '💰', color: '#2ECC71', type: 'win' },
  { label: '×2.5 BOOST',   mult: 2.5,   emoji: '⚡', color: '#F1C40F', type: 'win' },
  { label: '×3 SUPER',     mult: 3,     emoji: '🔥', color: '#E67E22', type: 'win' },
  { label: '×5 MEGA',      mult: 5,     emoji: '💎', color: '#9B59B6', type: 'mega' },
  { label: '×10 ULTRA',    mult: 10,    emoji: '👑', color: '#E74C3C', type: 'ultra' },
  { label: 'JACKPOT ×50',  mult: 50,    emoji: '🌟', color: '#FFD700', type: 'jackpot' },
  { label: '💸 PERTE',     mult: 0,     emoji: '💀', color: '#2C3E50', type: 'lose' },
  { label: '🎁 DOUBLE MISE', mult: 2,   emoji: '🎁', color: '#3498DB', type: 'special_double' },
  { label: '🔁 REMBOURSÉ', mult: 1,     emoji: '✅', color: '#1ABC9C', type: 'special_refund' },
  { label: '🎯 GRATUIT +500', mult: null, emoji: '🎯', color: '#16A085', type: 'special_free' },
];

// Poids (probabilités) pour chaque segment
const WEIGHTS = [8, 9, 8, 7, 6, 4, 2, 1, 12, 3, 5, 4];

function weightedSpin() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// Historique des tours (stocké en mémoire par guildId)
const spinHistory = new Map(); // guildId → [{idx, gain, emoji}, ...]

// ─── Animation textuelle de la roue (12 segments circulaires) ──
function renderWheelFrame(centerIdx, phase = 0) {
  const N = SEGMENTS.length;
  const getSegment = (offset) => SEGMENTS[(centerIdx + offset + N) % N];

  const top = getSegment(-1).emoji;
  const center = getSegment(0).emoji;
  const bottom = getSegment(1).emoji;
  const phases = ['▀', '▄', '█', '▓', '▒'][phase % 5];

  return [
    `      ${top}`,
    `    ◆ ${phases}${center}${phases} ◆`,
    `      ${bottom}`,
    `        ▼`,
  ].join('\n');
}

// ─── Visualisation finale avec l'étiquette ──────────
function renderFinalSegment(idx) {
  const seg = SEGMENTS[idx];
  return [
    '```',
    '╔════════════════════════════════╗',
    `║  ${seg.emoji}  ${seg.label.padEnd(24)}║`,
    '╚════════════════════════════════╝',
    '```',
  ].join('\n');
}

// ─── Historique des 5 derniers tours ─────────────────────────
function renderHistory(guildId, coin) {
  const hist = spinHistory.get(guildId) || [];
  if (hist.length === 0) return '';

  const last5 = hist.slice(-5).reverse();
  const lines = last5.map(h => `${h.emoji} **${h.label}** → ${h.gain >= 0 ? `+${h.gain}` : h.gain} ${coin}`);
  return '\n📊 **Derniers tours :**\n' + lines.join('\n');
}

// ─── Fonction principale du jeu ──────────────────────────────
async function playRoueFortune(source, userId, guildId, mise) {
  const isInteraction = !!source.editReply;
  const cfg = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg.currency_emoji || '€';
  const u = db.getUser(userId, guildId);

  if (!u) {
    const err = '❌ Compte introuvable.';
    if (isInteraction) return source.editReply({ content: err });
    return source.reply(err);
  }

  // Validation de la mise
  if (!mise) mise = 100; // défaut
  mise = Math.floor(mise);
  if (mise < 50) {
    const err = `❌ Mise minimum : 50 ${coin}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise > u.balance) {
    const err = `❌ Solde insuffisant : **${u.balance} ${coin}**`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  // Prélever la mise
  db.removeCoins(userId, guildId, mise);

  // Sélectionner le résultat
  const finalIdx = weightedSpin();
  const segment = SEGMENTS[finalIdx];

  // ── Phase 1 : Introduction ────────────────────────────────────
  let startPos = Math.floor(Math.random() * SEGMENTS.length);
  const introEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎡 ━━━ GRANDE ROUE ALMOSNI PREMIUM ━━━ 🎡')
    .setDescription([
      `**${source.user.username}** mise **${mise.toLocaleString()} ${coin}**`,
      '',
      renderWheelFrame(startPos, 0),
      '',
      '🎬 *La roue commence à tourner...*',
    ].join('\n'))
    .setFooter({ text: 'Grande Roue Almosni Premium · Jeu de hasard' });

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [introEmbed] });
  else               msg = await source.reply({ embeds: [introEmbed] });

  // ── Phase 2 : Rotation rapide (6 frames) ──────────────────────
  let pos = startPos;
  for (let i = 0; i < 6; i++) {
    pos = (pos + (Math.floor(Math.random() * 3) + 2)) % SEGMENTS.length;
    const spinEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🎡 ━━━ EN TRAIN DE TOURNER... ━━━ 🎡')
      .setDescription([
        renderWheelFrame(pos, i),
        '',
        '⚡ **La roue tourne à pleine vitesse !**',
        '`▓▓▓▓▓▓▓▓░░  80%`',
      ].join('\n'));
    await msg.edit({ embeds: [spinEmbed] }).catch(() => {});
    await sleep(120);
  }

  // ── Phase 3 : Ralentissement (4 frames) ──────────────────────
  for (let i = 0; i < 4; i++) {
    pos = (pos + 1) % SEGMENTS.length;
    const spinEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🎡 ━━━ EN TRAIN DE TOURNER... ━━━ 🎡')
      .setDescription([
        renderWheelFrame(pos, i + 1),
        '',
        '💨 **Ralentissement en cours...**',
        '`▓▓▓▓▓▓░░░░  60%`',
      ].join('\n'));
    await msg.edit({ embeds: [spinEmbed] }).catch(() => {});
    await sleep(250);
  }

  // ── Phase 4 : Approche lente vers le résultat ────────────────
  const diff = ((finalIdx - pos) % SEGMENTS.length + SEGMENTS.length) % SEGMENTS.length;
  for (let s = 0; s < diff; s++) {
    pos = (pos + 1) % SEGMENTS.length;
    const isLast = pos === finalIdx;
    const spinEmbed = new EmbedBuilder()
      .setColor(isLast ? '#FFD700' : '#2ECC71')
      .setTitle(isLast ? '🛑 ✨ ARRÊT ! ✨ 🛑' : '🎡 ━━━ EN TRAIN DE TOURNER... ━━━ 🎡')
      .setDescription([
        renderWheelFrame(pos, 3),
        '',
        isLast ? '🔔 **Clic ! La roue s\'arrête !**' : '🎯 *Dernier rebond...*',
        `\`${isLast ? '▓▓░░░░░░░░   5%' : '▓▓▓░░░░░░░  30%'}\``,
      ].join('\n'));
    await msg.edit({ embeds: [spinEmbed] }).catch(() => {});
    await sleep(isLast ? 300 : 200);
  }

  await sleep(500);

  // ── Calcul du gain ──────────────────────────────────────────
  let gain = 0;
  const balanceBefore = db.getUser(userId, guildId)?.balance || 0;

  if (segment.type === 'jackpot') {
    gain = segment.mult * mise;
    db.addCoins(userId, guildId, gain);
  } else if (segment.type === 'win' || segment.type === 'mega' || segment.type === 'ultra') {
    gain = Math.floor(segment.mult * mise);
    db.addCoins(userId, guildId, gain);
  } else if (segment.type === 'special_double') {
    gain = mise;
    db.addCoins(userId, guildId, gain);
  } else if (segment.type === 'special_free') {
    gain = 500;
    db.addCoins(userId, guildId, gain);
  } else if (segment.type === 'special_refund') {
    gain = mise;
    db.addCoins(userId, guildId, gain);
  } else if (segment.type === 'partial') {
    gain = Math.floor(segment.mult * mise);
    db.addCoins(userId, guildId, gain);
  }
  // lose: gain reste 0

  const balanceAfter = db.getUser(userId, guildId)?.balance || 0;

  // ── Ajouter à l'historique ─────────────────────────────────
  if (!spinHistory.has(guildId)) spinHistory.set(guildId, []);
  spinHistory.get(guildId).push({
    idx: finalIdx,
    gain: gain,
    emoji: segment.emoji,
    label: segment.label,
  });
  // Garder max 5
  if (spinHistory.get(guildId).length > 5) spinHistory.get(guildId).shift();

  // ── Résultat final ──────────────────────────────────────────
  let resTitle, resColor, resEmoji;

  if (segment.type === 'jackpot') {
    resColor = '#FFD700';
    resTitle = '🌟 ✨✨ JACKPOT ABSOLU ✨✨ 🌟';
    resEmoji = '🌟';
  } else if (segment.type === 'ultra') {
    resColor = '#E74C3C';
    resTitle = '👑 VICTOIRE ULTRA !';
    resEmoji = '👑';
  } else if (segment.type === 'mega') {
    resColor = '#9B59B6';
    resTitle = '💎 MÉGA VICTOIRE !';
    resEmoji = '💎';
  } else if (segment.type === 'win') {
    resColor = '#2ECC71';
    resTitle = '🎉 VICTOIRE !';
    resEmoji = '🎉';
  } else if (segment.type === 'special_double') {
    resColor = '#3498DB';
    resTitle = '🎁 MISE DOUBLÉE !';
    resEmoji = '🎁';
  } else if (segment.type === 'special_refund') {
    resColor = '#1ABC9C';
    resTitle = '✅ REMBOURSÉ !';
    resEmoji = '✅';
  } else if (segment.type === 'special_free') {
    resColor = '#16A085';
    resTitle = '🎯 BONUS GRATUIT !';
    resEmoji = '🎯';
  } else if (segment.type === 'partial') {
    resColor = '#95A5A6';
    resTitle = '🔄 REMBOURSEMENT PARTIEL';
    resEmoji = '🔄';
  } else {
    resColor = '#2C3E50';
    resTitle = '💀 PERTE';
    resEmoji = '💀';
  }

  const finalEmbed = new EmbedBuilder()
    .setColor(resColor)
    .setTitle(resTitle)
    .setDescription([
      renderFinalSegment(finalIdx),
      '',
      `**${segment.emoji} ${segment.label}**`,
      '',
      gain > 0 ? `💰 **+${gain.toLocaleString()} ${coin}**` : '❌ Pas de gain',
    ].join('\n'))
    .addFields(
      { name: '💵 Mise', value: `${mise.toLocaleString()} ${coin}`, inline: true },
      { name: '📊 Gain', value: `${gain.toLocaleString()} ${coin}`, inline: true },
      { name: '🏦 Solde', value: `${balanceAfter.toLocaleString()} ${coin}`, inline: true },
    )
    .setFooter({ text: 'Grande Roue Almosni Premium' })
    .setTimestamp();

  if (spinHistory.get(guildId).length > 0) {
    finalEmbed.addFields({
      name: '📊 Historique des 5 derniers tours',
      value: spinHistory.get(guildId).slice(-5).reverse()
        .map(h => `${h.emoji} **${h.label}** → ${h.gain >= 0 ? '+' : ''}${h.gain.toLocaleString()} ${coin}`)
        .join('\n'),
      inline: false,
    });
  }

  // ── Boutons ──────────────────────────────────────────────────
  const btnArr = [
    new ButtonBuilder()
      .setCustomId(`rf_spin_${userId}`)
      .setLabel('🎡 Retenter')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rf_history_${userId}`)
      .setLabel('📋 Historique')
      .setStyle(ButtonStyle.Secondary),
  ];

  if (gain > 0 && !['jackpot', 'ultra'].includes(segment.type)) {
    btnArr.push(
      new ButtonBuilder()
        .setCustomId(`rf_gamble_${userId}_${gain}`)
        .setLabel(`🎲 Double ou Rien (+${gain.toLocaleString()})`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  const btns = new ActionRowBuilder().addComponents(...btnArr);
  await msg.edit({ embeds: [finalEmbed], components: [btns] });
}

// ─── handleComponent ──────────────────────────────────────────
async function handleComponent(interaction, cid) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const cfg = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg.currency_emoji || '€';

  if (cid.startsWith('rf_spin_')) {
    const targetId = cid.replace('rf_spin_', '');
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    await playRoueFortune(interaction, userId, guildId, 100);
    return true;
  }

  if (cid.startsWith('rf_history_')) {
    const targetId = cid.replace('rf_history_', '');
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});

    const hist = spinHistory.get(guildId) || [];
    if (hist.length === 0) {
      await interaction.followUp({
        content: '📊 Aucun historique disponible.',
        ephemeral: true,
      }).catch(() => {});
      return true;
    }

    const lines = hist.slice(-10).reverse()
      .map((h, i) => `${i + 1}. ${h.emoji} **${h.label}** → ${h.gain >= 0 ? '+' : ''}${h.gain.toLocaleString()} ${coin}`);

    const histEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('📊 Historique des tours')
      .setDescription(lines.join('\n'))
      .setFooter({ text: '10 derniers tours affichés' });

    await interaction.followUp({ embeds: [histEmbed], ephemeral: true }).catch(() => {});
    return true;
  }

  if (cid.startsWith('rf_gamble_')) {
    const parts = cid.split('_');
    const targetId = parts[2];
    const gain = parseInt(parts[3]) || 0;

    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }

    await interaction.deferUpdate().catch(() => {});

    const won = Math.random() < 0.5;

    // Animation rapide
    const faces = ['🟡', '⚪', '🟡', '⚪'];
    for (const face of faces) {
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('🎲 Double ou Rien ?')
          .setDescription([
            `${face} La pièce tourne... ${face}`,
            '',
            `💰 **${gain.toLocaleString()} ${coin}** en jeu`,
          ].join('\n'))
        ],
      }).catch(() => {});
      await sleep(200);
    }

    if (won) {
      db.addCoins(userId, guildId, gain);
      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('🎲 DOUBLÉ ! 🎊')
          .setDescription(`💰 **+${(gain * 2).toLocaleString()} ${coin}**\nSolde: **${newBalance.toLocaleString()} ${coin}**`)
          .setFooter({ text: 'Le risque a payé !' })
        ],
      }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -gain);
      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🎲 PERDU... 💸')
          .setDescription(`-${gain.toLocaleString()} ${coin}\nSolde: **${newBalance.toLocaleString()} ${coin}**`)
          .setFooter({ text: 'Parfois il faut savoir s\'arrêter !' })
        ],
      }).catch(() => {});
    }
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue-fortune')
    .setDescription('🎡 Grande Roue Almosni Premium — Mise minimum 50€, pas de limite max')
    .addIntegerOption(o =>
      o.setName('mise')
        .setDescription('Montant à miser (minimum 50)')
        .setRequired(false)
        .setMinValue(50)
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise = interaction.options.getInteger('mise') || 100;
    await playRoueFortune(interaction, interaction.user.id, interaction.guildId, mise);
  },

  handleComponent,

  name: 'roue-fortune',
  aliases: ['roue', 'fortune', 'rf'],
  async run(message, args) {
    const mise = parseInt(args[0]) || 100;
    await playRoueFortune(message, message.author.id, message.guildId, mise);
  },
};
