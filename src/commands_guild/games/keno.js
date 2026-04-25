// ============================================================
// keno.js — Keno : choisir 1-10 numéros parmi 40, le bot tire 20
// /keno numeros:5,12,34 mise:300  |  &keno 5,12,34 300
// ============================================================
'use strict';
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ─── Table de gains selon nb choisi et nb matchés ────────────
// [chosen][matched] → multiplicateur
const PAYOUT = {
  1:  { 1: 3 },
  2:  { 1: 1, 2: 10 },
  3:  { 2: 2, 3: 30 },
  4:  { 2: 1, 3: 5,  4: 60  },
  5:  { 3: 2, 4: 10, 5: 150 },
  6:  { 3: 1, 4: 5,  5: 40,  6: 300  },
  7:  { 4: 2, 5: 15, 6: 100, 7: 700  },
  8:  { 5: 5, 6: 25, 7: 250, 8: 2000 },
  9:  { 6: 5, 7: 40, 8: 500, 9: 5000 },
  10: { 6: 2, 7: 20, 8: 200, 9: 2000, 10: 20000 },
};

// ─── Rendu visuel de la grille de numéros ────────────────────
function renderGrid(allNums, chosen, drawn) {
  let out = '';
  for (let i = 1; i <= 40; i++) {
    const isChosen = chosen.includes(i);
    const isDrawn  = drawn.includes(i);

    if (isChosen && isDrawn) out += `🟢`;      // ✅ match !
    else if (isChosen)       out += `🔵`;      // choisi mais pas tiré
    else if (isDrawn)        out += `🔴`;      // tiré mais pas choisi
    else                     out += `⬜`;      // neutre

    if (i % 10 === 0) out += '\n';
    else out += ' ';
  }
  return out.trim();
}

// ─── Commande principale ─────────────────────────────────────
async function runGame(ctx, rawNums, mise, isPrefix = false) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;

  // Parser les numéros
  const parsed = [...new Set(rawNums.split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 40))];
  if (parsed.length < 1 || parsed.length > 10) {
    const msg = '❌ Choisis entre **1 et 10 numéros** distincts entre 1 et 40.\nEx : `/keno numeros:5,12,23,34,40 mise:500`';
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  const userData = db.getUser(userId, guildId);
  if (!userData || userData.balance < mise) {
    const msg = `❌ Solde insuffisant ! Tu as **${(userData?.balance || 0).toLocaleString()} 💰** pour une mise de **${mise.toLocaleString()} 💰**.`;
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  // Débiter
  db.updateBalance(userId, guildId, -mise);

  // Tirage : 20 numéros aléatoires parmi 40
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const drawn = pool.slice(0, 20).sort((a, b) => a - b);

  // Calculer les matches
  const matches = parsed.filter(n => drawn.includes(n));
  const chosen  = parsed.length;
  const hit     = matches.length;

  const payoutMap = PAYOUT[chosen] || {};
  const mult = payoutMap[hit] || 0;
  const gain = Math.floor(mise * mult);

  // Créditer
  if (gain > 0) {
    db.updateBalance(userId, guildId, gain);
    db.addXP(userId, guildId, Math.max(5, Math.floor(gain / 100)));
  }

  // ─── Rendu ────────────────────────────────────────────────
  const grid = renderGrid(Array.from({ length: 40 }, (_, i) => i + 1), parsed, drawn);

  let color = '#5865F2', title = '🎱 Résultats du Keno';
  if (mult >= 100)       { color = '#FFD700'; title = '🏆 JACKPOT KENO !!!'; }
  else if (mult >= 20)   { color = '#FF6B35'; title = '🎊 ÉNORME GAIN !'; }
  else if (mult >= 5)    { color = '#2ECC71'; title = '🎉 Belle victoire !'; }
  else if (gain > 0)     { color = '#27AE60'; title = '✅ Gain !'; }
  else                   { color = '#E74C3C'; title = '😔 Pas de chance !'; }

  const matchMsgs = [
    'Voici tes résultats :',
    'Le tirage est terminé :',
    'Les boules sont tombées :',
  ];

  const tableStr = Object.entries(payoutMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([m, x]) => `${hit == parseInt(m) ? '**' : ''}${m} match = ×${x}${hit == parseInt(m) ? ' ◀' : ''}${hit == parseInt(m) ? '**' : ''}`)
    .join(' · ');

  const drawnStr = drawn.map(n => parsed.includes(n) ? `**\`${n}\`**` : `\`${n}\``).join(' ');

  const lines = [
    `🔵 Tes numéros : ${parsed.sort((a,b)=>a-b).map(n => `\`${n}\``).join(' ')}`,
    `🔴 Numéros tirés : ${drawnStr}`,
    `🟢 **${hit}/${chosen} match${hit !== 1 ? 'es' : ''}**`,
    '',
    `Grille (40 numéros) :`,
    grid,
    '',
    `Table des gains (${chosen} choisis) :`,
    tableStr || 'Aucun gain possible',
    '',
    gain > 0
      ? `💰 **GAIN : +${gain.toLocaleString()} coins** (×${mult})`
      : `💸 Perdu : **-${mise.toLocaleString()} coins**`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`*${matchMsgs[Math.floor(Math.random() * matchMsgs.length)]}*\n\n${lines}`)
    .setFooter({ text: `🟢 Match · 🔵 Ton choix · 🔴 Tiré · ⬜ Rien • NexusBot Keno` });

  return isPrefix ? ctx.reply({ embeds: [embed] }) : ctx.reply({ embeds: [embed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('keno')
    .setDescription('🎱 Keno : choisis tes numéros et tente le jackpot !')
    .addStringOption(o => o
      .setName('numeros')
      .setDescription('Tes numéros (1-40) séparés par des virgules — entre 1 et 10 numéros')
      .setRequired(true)
    )
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Montant à parier (50–100 000 coins)')
      .setRequired(true)
      .setMinValue(50)
      .setMaxValue(100000)
    ),
  cooldown: 5,

  async execute(interaction) {
    const rawNums = interaction.options.getString('numeros');
    const mise    = interaction.options.getInteger('mise');
    return runGame(interaction, rawNums, mise, false);
  },

  // Préfixe & (ex: &keno 5,12,23 500)
  run(message, args) {
    if (args.length < 2) return message.reply('❌ Usage : `&keno <numéros> <mise>` — Ex : `&keno 5,12,23,34 300`');
    const mise    = parseInt(args[args.length - 1]);
    const rawNums = args.slice(0, -1).join(' ');
    if (!mise || mise < 50 || mise > 100000) return message.reply('❌ Mise invalide (50–100 000 coins).');
    return runGame(message, rawNums, mise, true);
  },
};
