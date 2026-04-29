// ============================================================
// roue-fortune.js — 🎡 GRANDE ROUE ALMOSNI PREMIUM 🎡
// Animation épique multi-phases, 12 segments multiplicateurs,
// historique des 5 derniers tours, bonus spéciaux dynamiques
// Mise minimum: 50€, pas de limite max
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const wheelImage = require('../../utils/wheelImage');
const balancer = require('../../utils/economyBalancer');
const { announceBigWin } = require('../../utils/bigWinAnnouncer');

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

// ─── Rendu de la GRANDE ROUE VERTICALE — pointeur fixe en haut, segments défilants ──
function renderWheelFrame(centerIdx, hilite = false) {
  const N = SEGMENTS.length;
  const seg = (off) => SEGMENTS[((centerIdx + off) % N + N) % N];
  const pad = (s, w = 17) => {
    const trimmed = String(s);
    return trimmed.length >= w ? trimmed.slice(0, w) : trimmed + ' '.repeat(w - trimmed.length);
  };
  const lines = [];
  lines.push('```');
  lines.push('              ▼   POINTEUR   ▼');
  lines.push('       ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  for (let off = -2; off <= 2; off++) {
    const s = seg(off);
    if (off === 0) {
      const m = hilite ? '★' : '▶';
      lines.push(`       ┃ ${m} ${s.emoji}  ${pad(s.label)} ${m} ┃`);
    } else {
      const fadeL = (off === -2 || off === 2) ? '·' : ' ';
      lines.push(`       ┃ ${fadeL} ${s.emoji}  ${pad(s.label)} ${fadeL} ┃`);
    }
  }
  lines.push('       ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('              ▲   GAGNANT    ▲');
  lines.push('```');
  return lines.join('\n');
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

  // ── Identifiant joueur (interaction OU message prefix) ───────
  const playerName = (source.user && source.user.username) || (source.author && source.author.username) || 'Joueur';
  const N = SEGMENTS.length;
  let startPos = Math.floor(Math.random() * N);

  // ── MODE GIF : génère une vraie roue qui tourne (image animée Discord) ──
  // Lance la génération en parallèle de l'embed initial pour gagner du temps.
  let gifPromise = null;
  if (wheelImage.isAvailable()) {
    // Mappe SEGMENTS → format wheelImage (label court, color)
    const drawSegs = SEGMENTS.map(s => ({
      label: s.label,
      shortLabel: s.label.replace(/×/g, 'x').slice(0, 12),
      color: s.color,
    }));
    gifPromise = wheelImage.generateWheelGif(drawSegs, finalIdx, {
      size: 380,
      frames: 26,
      rotations: 4,
      holdFrames: 7,
    }).catch(err => { console.error('[roue-fortune] GIF gen error:', err.message); return null; });
  }

  const introEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎡 ━━━ GRANDE ROUE ALMOSNI PREMIUM ━━━ 🎡')
    .setDescription([
      `**${playerName}** mise **${mise.toLocaleString()} ${coin}**`,
      '',
      renderWheelFrame(startPos, false),
      '',
      '🎬 *Préparation de la roue...*',
    ].join('\n'))
    .setFooter({ text: 'Grande Roue Almosni Premium · Jeu de hasard' });

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [introEmbed] });
  else               msg = await source.reply({ embeds: [introEmbed] });

  // ── BRANCH GIF : envoie l'image animée et attend la fin ──
  const gifBuffer = gifPromise ? await gifPromise : null;
  if (gifBuffer) {
    const file = new AttachmentBuilder(gifBuffer, { name: 'wheel.gif' });
    const spinEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🎡 LA ROUE TOURNE...')
      .setDescription([
        `**${playerName}** mise **${mise.toLocaleString()} ${coin}**`,
        '',
        '🎬 *La grande roue est lancée — fixe le pointeur en haut !*',
      ].join('\n'))
      .setImage('attachment://wheel.gif')
      .setFooter({ text: 'Grande Roue Almosni Premium · Image animée' });

    await msg.edit({ embeds: [spinEmbed], files: [file] }).catch(() => {});

    // Durée du GIF: 26 frames + 7 hold ≈ ~5.5 sec d'animation + flash
    // Délais : ease-out 40-260ms + hold 220ms × 7 = ~5.4s total
    await sleep(5800);
  } else {
    // ── FALLBACK ASCII : ancienne animation textuelle ──
    for (const [cnt, col] of [['3️⃣','#FF4500'],['2️⃣','#FF8C00'],['1️⃣','#FFD700']]) {
      await msg.edit({ embeds: [new EmbedBuilder()
        .setColor(col)
        .setTitle(`🎡 LANCEMENT ${cnt}`)
        .setDescription([
          renderWheelFrame(startPos, false),
          '',
          `## ${cnt}`,
          `**${playerName}** · Mise : **${mise.toLocaleString()} ${coin}**`,
        ].join('\n'))
      ]}).catch(() => {});
      await sleep(380);
    }

    const totalRotations = 4;
    const distance = totalRotations * N + ((finalIdx - startPos + N) % N);
    const FRAMES = 16;
    let pos = startPos;

    for (let f = 1; f <= FRAMES; f++) {
      const t = f / FRAMES;
      const ease = 1 - Math.pow(1 - t, 3);
      pos = (startPos + Math.round(distance * ease)) % N;
      const isLast = (f === FRAMES);

      let title, hint, color, barFill;
      if (isLast) {
        title = '🛑 ✨ ARRÊT ! ✨ 🛑';
        hint = '🔔 **CLIC ! La roue s\'immobilise sur le segment !**';
        color = '#FFD700'; barFill = 14;
      } else if (t < 0.30) {
        title = '🎡 ⚡ PLEINE VITESSE ⚡ 🎡';
        hint = '🌀 **La roue tourne à toute allure !**';
        color = '#E74C3C'; barFill = Math.round(t * 14);
      } else if (t < 0.65) {
        title = '🎡 💨 RALENTISSEMENT 💨 🎡';
        hint = '⏳ **Le frottement ralentit la roue...**';
        color = '#E67E22'; barFill = Math.round(t * 14);
      } else if (t < 0.90) {
        title = '🎡 🎯 DERNIERS CRANS 🎯 🎡';
        hint = '😬 *Plus que quelques segments...*';
        color = '#F39C12'; barFill = Math.round(t * 14);
      } else {
        title = '🎡 🤫 SUSPENSE ABSOLU 🤫 🎡';
        hint = '🔇 *La roue hésite... va-t-elle s\'arrêter ici ?*';
        color = '#2ECC71'; barFill = Math.round(t * 14);
      }

      const bar = '▓'.repeat(barFill) + '░'.repeat(14 - barFill);

      await msg.edit({ embeds: [new EmbedBuilder()
        .setColor(color).setTitle(title)
        .setDescription([
          renderWheelFrame(pos, isLast), '',
          hint,
          `\`${bar}\` ${Math.round(t * 100)}%`,
        ].join('\n'))
      ]}).catch(() => {});
      const delay = Math.round(70 + 1100 * Math.pow(t, 1.6));
      await sleep(delay);
    }
    await sleep(450);
  }

  // ── Calcul du gain ──────────────────────────────────────────
  let gain = 0;
  const balanceBefore = db.getUser(userId, guildId)?.balance || 0;

  // Calcul du gain BRUT selon le segment
  if (segment.type === 'jackpot') {
    gain = segment.mult * mise;
  } else if (segment.type === 'win' || segment.type === 'mega' || segment.type === 'ultra') {
    gain = Math.floor(segment.mult * mise);
  } else if (segment.type === 'special_double') {
    gain = mise;
  } else if (segment.type === 'special_free') {
    gain = 500;
  } else if (segment.type === 'special_refund') {
    gain = mise;
  } else if (segment.type === 'partial') {
    gain = Math.floor(segment.mult * mise);
  }
  // lose: gain reste 0

  // Application du balancer (taxe riches / boost owner)
  if (gain > 0) {
    gain = balancer.adjustGain(gain, userId, guildId);
    db.addCoins(userId, guildId, gain);
  }
  const malaise = balancer.rollMalaise(userId, guildId);

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
      balancer.malaiseEmbedText(malaise, coin),
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

  // Big Win Announcer : annonce des gains importants
  if (gain >= 10000 && msg.client) {
    const winType = segment.type === 'jackpot' ? 'jackpot' : (gain >= 50000 ? 'mega' : 'win');
    announceBigWin(msg.client, guildId, userId, gain, 'roue-fortune', winType).catch(() => {});
  }
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
