// ============================================================
// keno.js — Keno : choisir 1-10 numéros parmi 40, le bot tire 20
// /keno numeros:5,12,34 mise:300  |  &keno 5,12,34 300
// ============================================================
'use strict';
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Table de gains selon nb choisi et nb matchés ────────────
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

// ─── Session store (pour le replay) ──────────────────────────
const kenoSessions = new Map();

// ─── Rendu visuel de la grille de numéros ────────────────────
function renderGrid(allNums, chosen, drawn) {
  let out = '';
  for (let i = 1; i <= 40; i++) {
    const isChosen = chosen.includes(i);
    const isDrawn  = drawn.includes(i);
    if (isChosen && isDrawn) out += `🟢`;
    else if (isChosen)       out += `🔵`;
    else if (isDrawn)        out += `🔴`;
    else                     out += `⬜`;
    if (i % 10 === 0) out += '\n';
    else out += ' ';
  }
  return out.trim();
}

// ─── Commande principale ─────────────────────────────────────
async function runGame(ctx, rawNums, mise, isPrefix = false) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;

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

  db.updateBalance(userId, guildId, -mise);

  // ── Tirage animé ─────────────────────────────────────────
  const sendFn = isPrefix
    ? (d) => ctx.reply(d)
    : (ctx.deferred || ctx.replied) ? ctx.editReply.bind(ctx) : ctx.reply.bind(ctx);

  let msgHandle;
  if (!isPrefix) {
    msgHandle = await sendFn({ embeds: [new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎱 Tirage Keno en cours...')
      .setDescription('```\n🎱  🎱  🎱  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n```\n*Les boules tombent...*')
    ]}).catch(() => {});

    await new Promise(r => setTimeout(r, 700));
    await ctx.editReply({ embeds: [new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('🎱 Tirage en cours...')
      .setDescription('```\n🔴 🔴 🔴 🔴 🔴 ·  ·  ·  ·  ·\n🔴 🔴 🔴 🔴 🔴 ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n```\n*15 boules restantes...*')
    ]}).catch(() => {});

    await new Promise(r => setTimeout(r, 700));
    await ctx.editReply({ embeds: [new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('🎱 Dernières boules...')
      .setDescription('```\n🔴 🔴 🔴 🔴 🔴 🔴 🔴 🔴 🔴 🔴\n🔴 🔴 🔴 🔴 🔴 🔴 🔴 🔴 🔴 ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n·  ·  ·  ·  ·  ·  ·  ·  ·  ·\n```\n*Suspense !*')
    ]}).catch(() => {});

    await new Promise(r => setTimeout(r, 700));
  }

  // ── Calcul du résultat ────────────────────────────────────
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const drawn = pool.slice(0, 20).sort((a, b) => a - b);
  const chosen  = parsed.length;
  const hit     = parsed.filter(n => drawn.includes(n)).length;
  const payoutMap = PAYOUT[chosen] || {};
  const mult = payoutMap[hit] || 0;
  const gain = Math.floor(mise * mult);

  if (gain > 0) {
    db.updateBalance(userId, guildId, gain);
    try { db.addXP(userId, guildId, Math.max(5, Math.floor(gain / 100))); } catch {}
  }

  // Sauvegarder pour replay
  kenoSessions.set(userId, { rawNums: parsed.join(','), mise, guildId });

  // ── Rendu final ───────────────────────────────────────────
  const grid = renderGrid(Array.from({ length: 40 }, (_, i) => i + 1), parsed, drawn);

  let color = '#5865F2', title = '🎱 Résultats du Keno';
  if (mult >= 100)       { color = '#FFD700'; title = '🏆 JACKPOT KENO !!!'; }
  else if (mult >= 20)   { color = '#FF6B35'; title = '🎊 ÉNORME GAIN !'; }
  else if (mult >= 5)    { color = '#2ECC71'; title = '🎉 Belle victoire !'; }
  else if (gain > 0)     { color = '#27AE60'; title = '✅ Gain !'; }
  else                   { color = '#E74C3C'; title = '😔 Pas de chance !'; }

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
    .setDescription(`*Les boules sont tombées :*\n\n${lines}`)
    .setFooter({ text: `🟢 Match · 🔵 Ton choix · 🔴 Tiré · ⬜ Rien • NexusBot Keno` });

  // ── Boutons de replay ─────────────────────────────────────
  const replayRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`keno_replay_${userId}_${mise}`)
      .setLabel('🔄 Rejouer (mêmes numéros)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`keno_info_${userId}`)
      .setLabel('📊 Table des gains')
      .setStyle(ButtonStyle.Secondary),
  );

  const sendOpts = { embeds: [embed], components: isPrefix ? [] : [replayRow] };
  if (isPrefix) return ctx.reply(sendOpts);
  return ctx.editReply ? ctx.editReply(sendOpts).catch(() => {}) : ctx.reply(sendOpts);
}

module.exports = {
  name: 'keno',
  aliases: ['loto', 'loterie'],
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
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
    const rawNums = interaction.options.getString('numeros');
    const mise    = interaction.options.getInteger('mise');
    return runGame(interaction, rawNums, mise, false);
  },

  async handleComponent(interaction, customId) {
    const userId = interaction.user.id;
    if (!customId.startsWith('keno_')) return false;

    // Table des gains
    if (customId.startsWith(`keno_info_${userId}`)) {
      const lines = Object.entries(PAYOUT).map(([chosen, payMap]) => {
        const gains = Object.entries(payMap).map(([m, x]) => `${m} matchs → ×${x}`).join(', ');
        return `**${chosen} numéro${parseInt(chosen) > 1 ? 's' : ''}** : ${gains}`;
      }).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Table des gains — Keno')
        .setDescription(lines)
        .setFooter({ text: 'Mise × multiplicateur = gain total' })
      ], ephemeral: true });
    }

    // Replay
    if (customId.startsWith(`keno_replay_${userId}`)) {
      const parts = customId.split('_');
      const mise  = parseInt(parts[parts.length - 1]);
      const sess  = kenoSessions.get(userId);
      if (!sess) {
        return interaction.reply({ content: '❌ Session expirée. Relance `/keno` pour jouer.', ephemeral: true });
      }
      const u = db.getUser(userId, interaction.guildId);
      if (!u || u.balance < mise) {
        return interaction.reply({ content: `❌ Solde insuffisant. Tu as **${u?.balance || 0} 💰**.`, ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply().catch(() => {});
      return runGame(interaction, sess.rawNums, mise, false);
    }

    return false;
  },

  run(message, args) {
    if (args.length < 2) return message.reply('❌ Usage : `&keno <numéros> <mise>` — Ex : `&keno 5,12,23,34 300`');
    const mise    = parseInt(args[args.length - 1]);
    const rawNums = args.slice(0, -1).join(' ');
    if (!mise || mise < 50 || mise > 100000) return message.reply('❌ Mise invalide (50–100 000 coins).');
    return runGame(message, rawNums, mise, true);
  },
};
