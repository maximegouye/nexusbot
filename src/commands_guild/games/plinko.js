// ============================================================
// plinko.js — Plinko avec animation de chute visuelle
// Emplacement : src/commands_guild/games/plinko.js
// ============================================================
const balancer = require('../../utils/economyBalancer');

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');
const wheelImage = require('../../utils/wheelImage');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Tableau des multiplicateurs par slot (9 slots, 8 rangées) ──
const MULTIPLIERS = {
  low:    [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
  medium: [13,  3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13 ],
  high:   [29,  4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29 ],
};

const RISK_LABELS   = { low: '🟢 Faible', medium: '🟡 Moyen', high: '🔴 Élevé' };
const RISK_COLORS   = { low: '#27AE60',   medium: '#F39C12',  high: '#E74C3C'   };

// ─── Simuler la chute de la bille ─────────────────────────
function dropBall(rows = 8) {
  let pos = 4; // départ au milieu (0-8)
  const path = [pos];
  for (let r = 0; r < rows; r++) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    pos = Math.max(0, Math.min(8, pos + dir));
    path.push(pos);
  }
  return { finalSlot: pos, path };
}

// ─── Rendu visuel de la grille avec emoji ─────────────────
function renderBoard(path, step, mults, finalSlot = null) {
  const ROWS = 8;
  const COLS = 9;
  const PEG  = '◦'; // chevilles stylisées
  const BALL = '🎯';
  const TRAIL = '●'; // traînée visuelle
  const lines = [];

  for (let r = 0; r < ROWS; r++) {
    let rowStr = '';

    // Construire la rangée avec la balle et sa traînée
    const ballCol = (step > r && r < path.length) ? path[r] : -1;
    const trailCol = (step > r + 1 && r < path.length - 1) ? path[r + 1] : -1;

    for (let c = 0; c < COLS; c++) {
      if (c === ballCol) rowStr += BALL;
      else if (c === trailCol) rowStr += TRAIL;
      else rowStr += PEG;
      if (c < COLS - 1) rowStr += '  ';
    }
    lines.push(rowStr);
  }

  // Ligne des slots avec multiplicateurs (plus colorés)
  const slotLine = mults.map((m, i) => {
    const isFinal = finalSlot !== null && i === finalSlot;
    if (isFinal) {
      if (m >= 10) return '🔷';
      if (m >= 5) return '🔶';
      if (m >= 2) return '🟨';
      if (m >= 1) return '🟧';
      return '🟥';
    }
    if (m >= 10) return '🟦';
    if (m >= 5) return '🟩';
    if (m >= 2) return '🟨';
    if (m >= 1) return '🟧';
    return '🟥';
  }).join('  ');

  const multLine = mults.map((m, i) => {
    const isFinal = finalSlot !== null && i === finalSlot;
    const isHighlight = isFinal ? '**' : '';
    return `${isHighlight}×${m}${isHighlight}`;
  }).join('   ');

  lines.push('─'.repeat(50));
  lines.push(slotLine);
  lines.push(multLine);
  return { boardStr: lines.join('\n'), multLine: '' };
}

// ─── Résumé compact de la grille (sans code block) ────────
function buildBoardEmbed(path, step, mults, mise, coin, riskKey, finalSlot = null, done = false) {
  const { boardStr } = renderBoard(path, step, mults, finalSlot);
  const color = done
    ? (mults[finalSlot] >= 2 ? '#27AE60' : mults[finalSlot] >= 1 ? '#F1C40F' : '#E74C3C')
    : RISK_COLORS[riskKey];

  const title = done ? '🎯 Plinko — Résultat' : '🎯 Plinko — La bille tombe...';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription('```\n' + boardStr + '\n```')
    .addFields(
      { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise',   value: `${mise} ${coin}`,     inline: true },
    );
}

// ─── Jeu principal ────────────────────────────────────────
async function playPlinko(source, userId, guildId, mise, risk = 'medium') {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  const riskKey = risk.toLowerCase();
  if (!MULTIPLIERS[riskKey]) {
    const err = '❌ Risque invalide. Choisir : `faible`, `moyen`, ou `eleve`';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10 €**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const mults  = MULTIPLIERS[riskKey];
  const { finalSlot, path } = dropBall(8);
  const mult   = mults[finalSlot];
  const gain   = Math.floor(mise * mult);

  // Embed de départ
  const startEmbed = new EmbedBuilder()
    .setColor(RISK_COLORS[riskKey])
    .setTitle('🎯 Plinko')
    .setDescription('🔵 *La bille est lâchée...*\n\n◦ ◦ ◦ ◦ ◦ ◦ ◦ ◦ ◦')
    .addFields(
      { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise',   value: `${mise} ${coin}`,     inline: true },
    );

  let msg;
  if (isInteraction) {
    if (!source.deferred && !source.replied) await source.deferReply();
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  // ── BRANCH GIF : génère vraie animation graphique si dispo ──
  let gifBuffer = null;
  if (wheelImage.isAvailable()) {
    try {
      gifBuffer = await wheelImage.generatePlinkoGif(path, mults);
    } catch (e) { console.error('[plinko] GIF gen error:', e.message); }
  }

  if (gifBuffer) {
    const file = new AttachmentBuilder(gifBuffer, { name: 'plinko.gif' });
    const spinEmbed = new EmbedBuilder()
      .setColor(RISK_COLORS[riskKey])
      .setTitle('🎯 PLINKO — La bille tombe !')
      .setDescription('🔵 *La bille rebondit à travers les pegs...*')
      .setImage('attachment://plinko.gif')
      .addFields(
        { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
        { name: '💰 Mise',   value: `${mise} ${coin}`,     inline: true },
      )
      .setFooter({ text: 'Plinko · Image animée temps réel' });
    await msg.edit({ embeds: [spinEmbed], files: [file] }).catch(() => {});
    // Durée GIF: 8 rows × 3 steps × 60ms + 8 hold × 220ms ≈ ~3.2 sec
    await sleep(3500);
  } else {
    // ── FALLBACK ASCII : animation textuelle d'origine ──
    const baseDelays = [320, 300, 270, 240, 220, 200, 180, 160];
    for (let step = 1; step <= 8; step++) {
      const delayPerFrame = Math.floor(baseDelays[step - 1] / 3);
      for (let frame = 0; frame < 3; frame++) {
        const e = buildBoardEmbed(path, step, mults, mise, coin, riskKey);
        await msg.edit({ embeds: [e] });
        await sleep(delayPerFrame);
      }
    }
    await sleep(300);
  }

  // Animation finale dramatique : explosion/impact quand la bille arrive
  for (let pulse = 0; pulse < 3; pulse++) {
    const highlightEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💥 IMPACT ! 💥')
      .setDescription(`*La bille a atteint le slot ${finalSlot + 1}...*\n\n✨ **×${mults[finalSlot]}** ✨`)
      .addFields(
        { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
        { name: '💰 Mise',   value: `${mise} ${coin}`,     inline: true },
      );
    await msg.edit({ embeds: [highlightEmbed] }).catch(() => {});
    await sleep(100);

    const normalEmbed = buildBoardEmbed(path, 9, mults, mise, coin, riskKey, finalSlot, true);
    await msg.edit({ embeds: [normalEmbed] }).catch(() => {});
    await sleep(100);
  }

  await sleep(200);

  // 🎰 RTP réaliste plinko (97%) + cap
  try {
    const rtp = require('../../utils/realCasinoEngine');
    if (gain > 0) {
      gain = rtp.applyRtp('plinko', mise, gain);
      gain = rtp.capWin('plinko', mise, gain);
    }
  } catch (_) {}

  // Résultat final (balancer économique : taxe riches / boost owner)
  const adjustedGain = gain > 0 ? balancer.adjustGain(gain, userId, guildId) : 0;
  if (adjustedGain > 0) db.addCoins(userId, guildId, adjustedGain);
  const malaise = balancer.rollMalaise(userId, guildId);
  const newBal = db.getUser(userId, guildId)?.balance || 0;

  let resultMsg;
  if (mult >= 5) {
    resultMsg = [
      '```',
      '╔══════════════════════════════╗',
      `║  🏆  JACKPOT ×${String(mult).padEnd(4,' ')}  🏆    ║`,
      `║  +${String(gain).padEnd(6,' ')} ${coin}              ║`,
      '╚══════════════════════════════╝',
      '```',
    ].join('\n');
  } else if (mult >= 2) {
    resultMsg = [
      '```',
      '╔══════════════════════╗',
      '║  🎉  GAGNÉ !  🎉       ║',
      `║  +${String(gain).padEnd(5,' ')} ${coin}       ║`,
      '╚══════════════════════╝',
      '```',
    ].join('\n');
  } else if (mult >= 1) {
    resultMsg = [
      '```',
      '╔══════════════════════╗',
      '║  ✅  Récupéré         ║',
      `║  +${String(gain).padEnd(5,' ')} ${coin}       ║`,
      '╚══════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultMsg = [
      '```',
      '╔══════════════════════╗',
      '║  ❌  PERDU            ║',
      `║  -${String(mise - gain).padEnd(5,' ')} ${coin}       ║`,
      '╚══════════════════════╝',
      '```',
    ].join('\n');
  }

  const finalColor = mult >= 2 ? '#27AE60' : mult >= 1 ? '#F1C40F' : '#E74C3C';
  const { boardStr } = renderBoard(path, 9, mults, finalSlot);

  // Boutons rejouer + changer mise + quick risk switch
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plinko_replay_${userId}_${mise}_${riskKey}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`plinko_changemise_${userId}_${riskKey}`).setLabel('💰 Changer mise').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`plinko_allin_${userId}_${riskKey}`).setLabel('🎲 All-In').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`plinko_replay_${userId}_${mise}_low`).setLabel('🟢 Faible').setStyle(riskKey === 'low' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`plinko_replay_${userId}_${mise}_medium`).setLabel('🟡 Moyen').setStyle(riskKey === 'medium' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`plinko_replay_${userId}_${mise}_high`).setLabel('🔴 Élevé').setStyle(riskKey === 'high' ? ButtonStyle.Danger : ButtonStyle.Secondary),
  );

  const malaiseText = balancer.malaiseEmbedText(malaise, coin);
  const finalEmbed = new EmbedBuilder()
    .setColor(malaise ? '#8E44AD' : finalColor)
    .setTitle('🎯 Plinko — Résultat')
    .setDescription(
      '```\n' + boardStr + '\n```\n' + resultMsg + malaiseText
    )
    .addFields(
      { name: '⚠️ Risque',        value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise',          value: `${mise} ${coin}`,     inline: true },
      { name: '📈 Multiplicateur', value: `×${mult}`,           inline: true },
      { name: '🏦 Solde',         value: `${newBal} ${coin}`,   inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed], components: [row1, row2] });
}

// ─── Mapping risque ────────────────────────────────────────
function parseRisk(s) {
  const m = { faible:'low', low:'low', moyen:'medium', medium:'medium', eleve:'high', high:'high', élevé:'high' };
  return m[s?.toLowerCase()] || 'medium';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plinko')
    .setDescription('🎯 Plinko — lâchez la bille et regardez où elle tombe !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10))
    .addStringOption(o => o.setName('risque').setDescription('Niveau de risque').addChoices(
      { name: '🟢 Faible (multiplicateurs modérés)', value: 'low' },
      { name: '🟡 Moyen (recommandé)',               value: 'medium' },
      { name: '🔴 Élevé (tout ou rien)',             value: 'high' },
    )),

  async execute(interaction) {
    try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playPlinko(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('risque') || 'medium',
    );
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.editReply(_em).catch(() => {});
    } catch {}
  }},

  name: 'plinko',
  aliases: ['bille', 'drop'],
  async run(message, args) {
    const mise  = parseInt(args[0]);
    const risk  = parseRisk(args[1]) || 'medium';
    if (!mise || mise < 10) return message.reply('❌ Usage : `&plinko <mise> [faible/moyen/eleve]`');
    await playPlinko(message, message.author.id, message.guildId, mise, risk);
  },

  async handleComponent(interaction, cid) {
    if (cid.startsWith('plinko_allin_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const riskKey = parts[3] || 'medium';
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate().catch(() => {});
      const u2 = db.getUser(userId, interaction.guildId);
      const allIn = u2?.balance || 0;
      if (allIn < 10) {
        await interaction.editReply({ content: '❌ Solde insuffisant pour un All-In (min 10).', ephemeral: true }).catch(() => {});
        return true;
      }
      await playPlinko(interaction, userId, interaction.guildId, allIn, riskKey);
      return true;
    }
    if (cid.startsWith('plinko_replay_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const mise = parseInt(parts[3]);
      const newRisk = parts[4] || 'medium';
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate().catch(() => {});
      await playPlinko(interaction, userId, interaction.guildId, mise, newRisk);
      return true;
    }
    if (cid.startsWith('plinko_changemise_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const riskKey = parts[3] || 'medium';
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.showModal(changeMiseModal('plinko', userId, riskKey)).catch(() => {});
      return true;
    }
    if (cid.startsWith('plinko_modal_') && interaction.isModalSubmit()) {
      const parts = cid.split('_');
      const userId = parts[2];
      const riskKey = parts[3] || 'medium';
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 10) {
        return interaction.reply({ content: '❌ Mise invalide (min 10 €).', ephemeral: true }).catch(() => {});
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});
      await playPlinko(interaction, userId, interaction.guildId, newMise, riskKey);
      return true;
    }
    return false;
  },
};

