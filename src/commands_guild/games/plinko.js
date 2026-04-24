// ============================================================
// plinko.js — Plinko avec animation de chute visuelle
// Emplacement : src/commands_guild/games/plinko.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

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
  const PEG  = '◦'; // chevilles
  const BALL = '🔵';
  const lines = [];

  for (let r = 0; r < ROWS; r++) {
    // Chevillage
    const pegCount = r + 2; // nb de chevilles par rangée (2 à 9)
    let rowStr = '';

    // Construire la rangée avec la balle si elle est là
    const ballCol = (step > r && r < path.length) ? path[r] : -1;

    for (let c = 0; c < COLS; c++) {
      if (c === ballCol) rowStr += BALL;
      else rowStr += PEG;
      if (c < COLS - 1) rowStr += ' ';
    }
    lines.push(rowStr);
  }

  // Ligne des slots avec multiplicateurs
  const slotLine = mults.map((m, i) => {
    const isFinal = finalSlot !== null && i === finalSlot;
    if (isFinal) {
      const color = m >= 2 ? '🟩' : m >= 1 ? '🟨' : '🟥';
      return `${color}`;
    }
    return m >= 10 ? '🟦' : m >= 2 ? '🟩' : m >= 1 ? '🟨' : '🟥';
  }).join(' ');

  const multLine = mults.map((m, i) => {
    const isFinal = finalSlot !== null && i === finalSlot;
    return isFinal ? `**×${m}**` : `×${m}`;
  }).join('  ');

  lines.push(slotLine);
  return { boardStr: lines.join('\n'), multLine };
}

// ─── Résumé compact de la grille (sans code block) ────────
function buildBoardEmbed(path, step, mults, mise, coin, riskKey, finalSlot = null, done = false) {
  const { boardStr, multLine } = renderBoard(path, step, mults, finalSlot);
  const color = done
    ? (mults[finalSlot] >= 2 ? '#27AE60' : mults[finalSlot] >= 1 ? '#F1C40F' : '#E74C3C')
    : RISK_COLORS[riskKey];

  const title = done ? '🎯 Plinko — Résultat' : '🎯 Plinko';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription('```\n' + boardStr + '\n```\n' + multLine)
    .addFields(
      { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise',   value: `${mise} ${coin}`,     inline: true },
    );
}

// ─── Jeu principal ────────────────────────────────────────
async function playPlinko(source, userId, guildId, mise, risk = 'medium') {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

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
    const err = '❌ Mise minimale : **10 coins**.';
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

  // Animation bille rangée par rangée
  const delays = [280, 270, 260, 250, 280, 300, 330, 360];
  for (let step = 1; step <= 8; step++) {
    await sleep(delays[step - 1] || 300);
    const e = buildBoardEmbed(path, step, mults, mise, coin, riskKey);
    await msg.edit({ embeds: [e] });
  }

  await sleep(400);

  // Résultat final
  if (gain > 0) db.addCoins(userId, guildId, gain);
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
  const { boardStr, multLine } = renderBoard(path, 9, mults, finalSlot);

  // Bouton rejouer
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`plinko_replay_${userId}_${mise}_${riskKey}`)
      .setLabel('🎯 Rejouer')
      .setStyle(ButtonStyle.Primary),
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(finalColor)
    .setTitle('🎯 Plinko — Résultat')
    .setDescription(
      '```\n' + boardStr + '\n```\n' + multLine + '\n\n' + resultMsg
    )
    .addFields(
      { name: '⚠️ Risque',        value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise',          value: `${mise} ${coin}`,     inline: true },
      { name: '📈 Multiplicateur', value: `×${mult}`,           inline: true },
      { name: '🏦 Solde',         value: `${newBal} ${coin}`,   inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed], components: [row] });

  // Collector rejouer
  const filter = i => i.user.id === userId && i.customId.startsWith(`plinko_replay_${userId}`);
  const collector = msg.createMessageComponentCollector({ filter, time: 30_000 });

  collector.on('collect', async i => {
    await i.deferUpdate();
    collector.stop();
    const parts     = i.customId.split('_');
    const newMise   = parseInt(parts[3]);
    const newRisk   = parts[4] || 'medium';
    await playPlinko(source, userId, guildId, newMise, newRisk);
  });

  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
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
  },

  name: 'plinko',
  aliases: ['bille', 'drop'],
  async run(message, args) {
    const mise  = parseInt(args[0]);
    const risk  = parseRisk(args[1]) || 'medium';
    if (!mise || mise < 10) return message.reply('❌ Usage : `&plinko <mise> [faible/moyen/eleve]`');
    await playPlinko(message, message.author.id, message.guildId, mise, risk);
  },
};

