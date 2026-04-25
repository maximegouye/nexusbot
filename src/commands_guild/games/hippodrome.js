// ============================================================
// hippodrome.js — Course de chevaux animée en 3 phases
// /hippodrome cheval:3 mise:500  |  &hippodrome 3 500
// 6 chevaux, cotes probabilistes, animation départ → mi-course → arrivée
// ============================================================
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ─── Les 6 chevaux ───────────────────────────────────────────
const HORSES = [
  { id: 1, name: 'Tonnerre', emoji: '🏇', odds: 2.0  },
  { id: 2, name: 'Éclair',   emoji: '⚡', odds: 3.0  },
  { id: 3, name: 'Fantôme',  emoji: '👻', odds: 4.5  },
  { id: 4, name: 'Tempête',  emoji: '🌪️', odds: 6.0  },
  { id: 5, name: 'Diable',   emoji: '😈', odds: 8.0  },
  { id: 6, name: 'Mystère',  emoji: '🔮', odds: 12.0 },
];

// ─── Sélection du gagnant selon les cotes (probabiliste) ─────
function pickWinner() {
  const weights = HORSES.map(h => 1 / h.odds);
  const total   = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < HORSES.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return HORSES.length - 1;
}

// ─── Positions simulées par phase ────────────────────────────
function buildPositions(winnerIdx, phase) {
  // phase 0 = départ (0-40%), 1 = milieu (35-65%), 2 = arrivée
  return HORSES.map((_, i) => {
    if (phase === 2) {
      // Le gagnant arrive en premier, les autres à 60-97%
      return i === winnerIdx ? 100 : Math.floor(60 + Math.random() * 37);
    }
    const [min, max] = phase === 0 ? [8, 38] : [35, 65];
    const base  = min + Math.random() * (max - min);
    const bonus = (phase === 1 && i === winnerIdx) ? 8 : 0;
    return Math.min(99, Math.floor(base + bonus));
  });
}

// ─── Rendu visuel de la course ───────────────────────────────
const TRACK = 12;
function renderTrack(positions, winnerIdx, finished) {
  return HORSES.map((h, i) => {
    const pct    = Math.min(100, positions[i]);
    const pos    = Math.round((pct / 100) * TRACK);
    const before = '▰'.repeat(pos);
    const after  = '▱'.repeat(Math.max(0, TRACK - pos));
    const medal  = finished && i === winnerIdx ? '  🥇 **VAINQUEUR !**' : '';
    const label  = `${h.emoji} **${h.name}**`.padEnd(20);
    return `${label} ${before}${after} ${pct}%${medal}`;
  }).join('\n');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Module ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('hippodrome')
    .setDescription('🏇 Pariez sur un cheval et regardez la course se dérouler !')
    .addIntegerOption(o => o
      .setName('cheval')
      .setDescription('Numéro du cheval (1-6)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(6)
    )
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Mise (100–30 000 coins)')
      .setRequired(true)
      .setMinValue(100)
      .setMaxValue(30000)
    ),
  cooldown: 10,

  async execute(interaction) {
    const horseIdx = interaction.options.getInteger('cheval') - 1;
    const mise     = interaction.options.getInteger('mise');
    return runGame(interaction, horseIdx, mise, false);
  },

  run(message, args) {
    if (args.length < 2) return message.reply('❌ Usage : `&hippodrome <cheval 1-6> <mise>` — Ex : `&hippodrome 3 500`');
    const horseIdx = parseInt(args[0]) - 1;
    const mise     = parseInt(args[1]);
    if (isNaN(horseIdx) || horseIdx < 0 || horseIdx > 5)
      return message.reply('❌ Choisissez un cheval entre 1 et 6. Ex : `&hippodrome 3 500`');
    if (!mise || mise < 100 || mise > 30000)
      return message.reply('❌ Mise invalide (100–30 000 coins).');
    return runGame(message, horseIdx, mise, true);
  },
};

// ─── Logique partagée ────────────────────────────────────────
async function runGame(ctx, horseIdx, mise, isPrefix) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;
  const horse   = HORSES[horseIdx];

  const userData = db.getUser(userId, guildId);
  if (!userData || userData.balance < mise) {
    const msg = `❌ Solde insuffisant ! Tu as **${(userData?.balance || 0).toLocaleString()} 💰** pour une mise de **${mise.toLocaleString()} 💰**.`;
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  db.updateBalance(userId, guildId, -mise);

  const winnerIdx = pickWinner();
  const winner    = HORSES[winnerIdx];

  // ── Phase 0 : Tableau des partants ───────────────────────────
  const listStr = HORSES.map(h =>
    `${h.emoji} **${h.name}** — Cote : ×${h.odds}${h.id - 1 === horseIdx ? '  ◀ *Ton cheval*' : ''}`
  ).join('\n');

  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle("🏇 Hippodrome NexusBot — Les partants s'alignent !")
    .setDescription(
      `Ton pari : ${horse.emoji} **${horse.name}** · Cote ×${horse.odds} · Mise **${mise.toLocaleString()} 💰**\n\n` +
      listStr +
      '\n\n*🚀 Dans les starting-blocks... Le starter est prêt !*'
    )
    .setFooter({ text: 'NexusBot Casino • Hippodrome  |  La course commence dans 2s...' });

  let sentMsg;
  if (isPrefix) {
    sentMsg = await ctx.reply({ embeds: [startEmbed] });
  } else {
    await ctx.deferReply();
    await ctx.editReply({ embeds: [startEmbed] });
  }

  await sleep(2200);

  // ── Phase 1 : Mi-course ───────────────────────────────────────
  const pos1 = buildPositions(winnerIdx, 1);
  const midEmbed = new EmbedBuilder()
    .setColor('#E67E22')
    .setTitle('🏁 Mi-course — Les chevaux se disputent la tête !')
    .setDescription(renderTrack(pos1, winnerIdx, false))
    .setFooter({ text: 'NexusBot Casino • Hippodrome  |  La tension monte...' });

  if (isPrefix) await sentMsg.edit({ embeds: [midEmbed] }).catch(() => {});
  else await ctx.editReply({ embeds: [midEmbed] });

  await sleep(2800);

  // ── Phase 2 : Résultat final ──────────────────────────────────
  const pos2   = buildPositions(winnerIdx, 2);
  const didWin = winnerIdx === horseIdx;
  const gain   = didWin ? Math.floor(mise * horse.odds) : 0;

  if (gain > 0) {
    db.updateBalance(userId, guildId, gain);
    db.addXP(userId, guildId, Math.max(10, Math.floor(gain / 80)));
  }

  const winMsgs = [
    `🎊 **${horse.name}** franchit la ligne en PREMIER ! Bravo !`,
    `🥇 Course magistrale de **${horse.name}** — tu avais misé juste !`,
    `🏆 **${horse.name}** survole la concurrence. Champion incontesté !`,
  ];
  const loseMsgs = [
    `**${winner.name}** remporte la course... Ce n'était pas ton jour.`,
    `La victoire appartient à **${winner.name}**. Retente ta chance !`,
    `**${winner.name}** franchit la ligne le premier. Ton cheval s'est battu !`,
  ];

  const finalEmbed = new EmbedBuilder()
    .setColor(didWin ? '#FFD700' : '#E74C3C')
    .setTitle(didWin ? `🏆 VICTOIRE ! ${horse.emoji} ${horse.name} gagne !` : `😔 ${winner.emoji} ${winner.name} gagne...`)
    .setDescription(
      renderTrack(pos2, winnerIdx, true) +
      '\n\n' +
      (didWin
        ? `${winMsgs[Math.floor(Math.random() * winMsgs.length)]}\n💰 **+${gain.toLocaleString()} coins** *(×${horse.odds})*`
        : `${loseMsgs[Math.floor(Math.random() * loseMsgs.length)]}\n💸 Perdu : **${mise.toLocaleString()} coins**`)
    )
    .setFooter({ text: 'NexusBot Casino • Hippodrome' });

  if (isPrefix) await sentMsg.edit({ embeds: [finalEmbed] }).catch(() => {});
  else await ctx.editReply({ embeds: [finalEmbed] });
}
