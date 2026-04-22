// ============================================================
// plinko.js — Plinko avec animation de chute
// Emplacement : src/commands_guild/games/plinko.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Tableau des multiplicateurs par slot (9 slots, 8 rangées) ──
// Plus c'est au centre → multiplicateur bas, côtés → élevé
const MULTIPLIERS = {
  low:    [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
  medium: [13,  3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13 ],
  high:   [29,  4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29 ],
};

const RISK_LABELS = { low: '🟢 Faible', medium: '🟡 Moyen', high: '🔴 Élevé' };

// ─── Simuler la chute de la bille ─────────────────────────
function dropBall(rows = 8) {
  let pos = 4; // départ au milieu (sur 9 slots, index 0-8)
  const path = [pos];
  for (let r = 0; r < rows; r++) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    pos = Math.max(0, Math.min(8, pos + dir));
    path.push(pos);
  }
  return { finalSlot: pos, path };
}

// ─── Rendu de la grille ───────────────────────────────────
function renderBoard(currentPath, step, mults, finalSlot = null) {
  const rows = 8;
  const cols = 9;
  let board  = '';

  for (let r = 0; r <= rows; r++) {
    let row = '';
    for (let c = 0; c < cols; c++) {
      if (r < rows) {
        // Rangée de chevilles
        const isActive = r < step && currentPath[r] === c;
        row += isActive ? '⚫' : '⬜';
      } else {
        // Ligne de slots
        const isFinal = finalSlot !== null && c === finalSlot;
        const m = mults[c];
        row += isFinal ? `**[×${m}]**` : `×${m}`;
      }
      if (c < cols - 1) row += ' ';
    }
    board += row + '\n';
  }
  return board;
}

// ─── Jeu principal ────────────────────────────────────────
async function playPlinko(source, userId, guildId, mise, risk = 'medium') {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  const riskKey = risk.toLowerCase();
  if (!MULTIPLIERS[riskKey]) {
    const err = '❌ Risque invalide. Choisir : `faible`, `moyen`, ou `eleve`';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (!u || u.solde < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10 coins**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const mults = MULTIPLIERS[riskKey];
  const { finalSlot, path } = dropBall(8);
  const mult  = mults[finalSlot];
  const gain  = Math.floor(mise * mult);

  const startEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle('🎯 ・ Plinko ・')
    .setDescription('*Lâchez la bille !*\n\n⚫ entre dans le tableau...')
    .addFields(
      { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
    );

  let msg;
  if (isInteraction) {
    await source.deferReply();
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.editReply({ embeds: [startEmbed] });
  }

  // Animation bille tombe rangée par rangée
  for (let step = 1; step <= 8; step++) {
    await sleep(300);
    const board = renderBoard(path, step, mults);
    const e = new EmbedBuilder()
      .setColor('#2980B9')
      .setTitle('🎯 ・ Plinko ・')
      .setDescription(`\`\`\`\n${board}\`\`\``)
      .addFields({ name: '💰 Mise', value: `${mise} ${coin}`, inline: true });
    await msg.edit({ embeds: [e] });
  }

  await sleep(400);

  // Résultat final
  if (gain > 0) db.addCoins(userId, guildId, gain);

  const color = mult >= 2  ? '#2ECC71'
              : mult >= 1  ? '#F1C40F'
              : '#E74C3C';

  const desc = mult >= 2
    ? `🎉 La bille est tombée sur **×${mult}** — +**${gain} ${coin}** !`
    : mult >= 1
    ? `✅ La bille est tombée sur **×${mult}** — +**${gain} ${coin}**`
    : `💸 La bille est tombée sur **×${mult}** — **perte partielle** (-${mise - gain} ${coin})`;

  const finalBoard = renderBoard(path, 9, mults, finalSlot);
  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎯 ・ Plinko — Résultat ・')
    .setDescription(`\`\`\`\n${finalBoard}\`\`\`\n${desc}`)
    .addFields(
      { name: '⚠️ Risque', value: RISK_LABELS[riskKey], inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      { name: '📈 Multiplicateur', value: `×${mult}`, inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.solde || 0} ${coin}`, inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed] });
}

// ─── Mapping risque ────────────────────────────────────────
function parseRisk(s) {
  const m = { faible: 'low', low: 'low', moyen: 'medium', medium: 'medium', eleve: 'high', high: 'high', élevé: 'high' };
  return m[s?.toLowerCase()] || 'medium';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plinko')
    .setDescription('🎯 Plinko — lâchez la bille et regardez où elle tombe !')
    .addStringOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true))
    .addStringOption(o => o.setName('risque').setDescription('Niveau de risque').addChoices(
      { name: '🟢 Faible (multiplicateurs modérés)', value: 'low' },
      { name: '🟡 Moyen (recommandé)', value: 'medium' },
      { name: '🔴 Élevé (tout ou rien)', value: 'high' },
    )),

  async execute(interaction) {
    await playPlinko(
      interaction,
      interaction.user.id,
      interaction.guildId,
      parseInt(interaction.options.getString('mise')),
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
