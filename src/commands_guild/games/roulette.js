// ============================================================
// roulette.js — Roulette européenne complète avec animations
// Emplacement : src/commands_guild/games/roulette.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Roue européenne (0-36) ───────────────────────────────
const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

function numColor(n) {
  if (n === 0) return '🟩';
  return RED_NUMS.includes(n) ? '🔴' : '⚫';
}

// Ordre authentique roue européenne
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Types de paris ───────────────────────────────────────
// Format: { type, value, payout, numbers }
function parseBet(betStr) {
  const s = betStr.toLowerCase().trim();

  // Couleurs
  if (s === 'rouge' || s === 'red')   return { label: '🔴 Rouge',   numbers: RED_NUMS,   payout: 1 };
  if (s === 'noir'  || s === 'black') return { label: '⚫ Noir',    numbers: BLACK_NUMS, payout: 1 };

  // Parité
  if (s === 'pair' || s === 'even')   return { label: '🔢 Pair',    numbers: [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36], payout: 1 };
  if (s === 'impair'|| s === 'odd')   return { label: '🔢 Impair',  numbers: [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35], payout: 1 };

  // Moitiés
  if (s === 'bas' || s === 'low'  || s === '1-18')  return { label: '⬇️ 1-18',   numbers: Array.from({length:18},(_,i)=>i+1), payout: 1 };
  if (s === 'haut'|| s === 'high' || s === '19-36') return { label: '⬆️ 19-36',  numbers: Array.from({length:18},(_,i)=>i+19), payout: 1 };

  // Douzaines
  if (s === 'd1' || s === '1-12')  return { label: '📊 1ère douzaine',  numbers: Array.from({length:12},(_,i)=>i+1),  payout: 2 };
  if (s === 'd2' || s === '13-24') return { label: '📊 2ème douzaine',  numbers: Array.from({length:12},(_,i)=>i+13), payout: 2 };
  if (s === 'd3' || s === '25-36') return { label: '📊 3ème douzaine',  numbers: Array.from({length:12},(_,i)=>i+25), payout: 2 };

  // Colonnes
  if (s === 'c1' || s === 'col1') return { label: '📋 Colonne 1', numbers: [1,4,7,10,13,16,19,22,25,28,31,34], payout: 2 };
  if (s === 'c2' || s === 'col2') return { label: '📋 Colonne 2', numbers: [2,5,8,11,14,17,20,23,26,29,32,35], payout: 2 };
  if (s === 'c3' || s === 'col3') return { label: '📋 Colonne 3', numbers: [3,6,9,12,15,18,21,24,27,30,33,36], payout: 2 };

  // Cheval (split) ex: "1-2"
  const splitM = s.match(/^(\d+)-(\d+)$/);
  if (splitM) {
    const a = parseInt(splitM[1]), b = parseInt(splitM[2]);
    if (a >= 0 && b <= 36 && a !== b)
      return { label: `🔀 Cheval ${a}-${b}`, numbers: [a, b], payout: 17 };
  }

  // Numéro plein (0-36)
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0 && num <= 36)
    return { label: `🎯 Plein ${num}`, numbers: [num], payout: 35 };

  return null;
}

const BET_HELP = `
**Types de paris disponibles :**
🔴 \`rouge\` / \`noir\` — ×2
🔢 \`pair\` / \`impair\` — ×2
⬇️ \`bas\` (1-18) / \`haut\` (19-36) — ×2
📊 \`d1\` / \`d2\` / \`d3\` — Douzaine ×3
📋 \`c1\` / \`c2\` / \`c3\` — Colonne ×3
🔀 \`1-2\` (cheval) — ×18
🎯 \`0\` à \`36\` (plein) — ×36
`.trim();

// ─── Jeu principal ────────────────────────────────────────
async function playRoulette(source, userId, guildId, mise, betType) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  // Parse bet
  const bet = parseBet(betType);
  if (!bet) {
    const err = `❌ Type de pari invalide.\n\n${BET_HELP}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 5) {
    const err = '❌ Mise minimale : **5 coins**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Embed de départ
  const startEmbed = new EmbedBuilder()
    .setColor('#C0392B')
    .setTitle('🎡 ・ Roulette ・')
    .setDescription('**⚡ La bille s\'élance !**\n\n🎡 ══════════════════════════')
    .addFields(
      { name: '🎲 Paris', value: `${bet.label} — mise **${mise} ${coin}**`, inline: false },
      { name: '💵 Gain potentiel', value: `**${mise * (bet.payout + 1)} ${coin}** (×${bet.payout + 1})`, inline: false },
    );

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  // Animation améliorée : bille qui tourne sur la vraie roue
  const startIdx = Math.floor(Math.random() * WHEEL_ORDER.length);
  const spinPhases = [
    { frames:4, delay:140, color:'#C0392B', speed:'⚡ La bille s\u2019élance !' },
    { frames:4, delay:200, color:'#E74C3C', speed:'🌀 Elle tourne vite...' },
    { frames:3, delay:290, color:'#D35400', speed:'💨 Ralentissement...' },
    { frames:2, delay:420, color:'#E67E22', speed:'⏳ Elle ralentit encore...' },
    { frames:1, delay:600, color:'#F39C12', speed:'🎯 Presque arretée !' },
  ];

  let frameIdx = startIdx;
  for (const { frames, delay, color, speed } of spinPhases) {
    for (let f = 0; f < frames; f++) {
      frameIdx = (frameIdx + 1) % WHEEL_ORDER.length;
      const wi = frameIdx;
      const nums = [-2,-1,0,1,2].map(offset => {
        const idx = (wi + offset + WHEEL_ORDER.length) % WHEEL_ORDER.length;
        const n = WHEEL_ORDER[idx];
        return offset === 0 ? `**【${numColor(n)}${n}】**` : `${numColor(n)}${n}`;
      });
      const wheelLine = nums.join('  ');
      const e = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎡 ・ Roulette ・')
        .setDescription(`**${speed}**\n\n${wheelLine}\n\n▲`)
        .addFields({name:'🎲 Paris',value:`${bet.label} — mise **${mise} ${coin}**`,inline:false});
      await msg.edit({ embeds: [e] });
      await sleep(delay);
    }
  }

  // Résultat
  const result = Math.floor(Math.random() * 37); // 0-36
  const col    = numColor(result);
  const won    = bet.numbers.includes(result);

  let gain = 0;
  let statusMsg = '';
  let color;

  if (won) {
    gain = mise * (bet.payout + 1);
    db.addCoins(userId, guildId, gain);
    statusMsg = `🎉 **Gagné !** La bille s'est arrêtée sur **${col} ${result}**\n+**${gain} ${coin}** !`;
    color = '#2ECC71';
  } else {
    statusMsg = `💸 **Perdu.** La bille s'est arrêtée sur **${col} ${result}**\n-**${mise} ${coin}**`;
    color = '#E74C3C';
    if (result === 0) statusMsg = `🟩 **Zéro !** La bille est tombée sur **🟩 0**\n-**${mise} ${coin}**`;
  }

  // Affichage de la roue avec le numéro résultat
  const nearby = [
    (result - 2 + 37) % 37,
    (result - 1 + 37) % 37,
    result,
    (result + 1)      % 37,
    (result + 2)      % 37,
  ];
  const wheelStr = nearby.map((n, i) =>
    i === 2 ? `**[${numColor(n)}${n}]**` : `${numColor(n)}${n}`
  ).join(' ');

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎡 ・ Roulette — Résultat ・')
    .setDescription(`${wheelStr}\n\n${statusMsg}`)
    .addFields(
      { name: '🎲 Ton pari', value: bet.label, inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      { name: '🏦 Solde après', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
    )
    .setFooter({ text: 'Jouez de manière responsable · /roulette pour rejouer' })
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed] });
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Roulette européenne — misez et tentez votre chance !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant à miser (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o
      .setName('pari')
      .setDescription('Type de pari : rouge, noir, pair, 17, d1, c2, 3-6 …')
      .setRequired(true))
    .addSubcommand ? undefined : undefined, // pas de subcommands ici

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playRoulette(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('pari'),
    );
  },

  // Préfixe : !roulette <mise> <pari>
  name: 'roulette',
  aliases: ['rl', 'wheel'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 5) return message.reply('❌ Usage : `!roulette <mise> <pari>`\nEx: `!roulette 100 rouge`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    await playRoulette(message, message.author.id, message.guildId, mise, betType);
  },

  // Commande info séparée
  betHelp: BET_HELP,
};

