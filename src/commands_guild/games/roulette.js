// ============================================================
// roulette.js — Roulette européenne style casino authentique
// Emplacement : src/commands_guild/games/roulette.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Roue européenne (ordre authentique) ─────────────────────
const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

// Ordre authentique de la roue européenne
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function numColor(n) {
  if (n === 0) return '🟩';
  return RED_NUMS.includes(n) ? '🔴' : '⚫';
}

// ─── Rendu de la roue (5 cases, centre en surbrillance) ──────
function renderWheel(centerIdx) {
  const N = WHEEL_ORDER.length;
  const parts = [];
  for (let off = -2; off <= 2; off++) {
    const idx = ((centerIdx + off) % N + N) % N;
    const n   = WHEEL_ORDER[idx];
    const col = numColor(n);
    if (off === 0) {
      parts.push(`❱${col}**${n}**❰`);
    } else if (Math.abs(off) === 1) {
      parts.push(`${col}${n}`);
    } else {
      parts.push(`${col}`);
    }
  }
  return parts.join(' ── ') + '\n' + '　　　　　　▲';
}

// ─── Types de paris ──────────────────────────────────────────
function parseBet(betStr) {
  const s = betStr.toLowerCase().trim();

  if (s === 'rouge' || s === 'red')   return { label:'🔴 Rouge',           numbers:RED_NUMS,   payout:1, type:'extérieur' };
  if (s === 'noir'  || s === 'black') return { label:'⚫ Noir',            numbers:BLACK_NUMS, payout:1, type:'extérieur' };
  if (s === 'pair'  || s === 'even')  return { label:'🔢 Pair',            numbers:[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36], payout:1, type:'extérieur' };
  if (s === 'impair'|| s === 'odd')   return { label:'🔢 Impair',          numbers:[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],  payout:1, type:'extérieur' };
  if (s === 'bas'   || s === 'low'    || s === '1-18')  return { label:'⬇️ Manque (1-18)',  numbers:Array.from({length:18},(_,i)=>i+1),  payout:1, type:'extérieur' };
  if (s === 'haut'  || s === 'high'   || s === '19-36') return { label:'⬆️ Passe (19-36)',  numbers:Array.from({length:18},(_,i)=>i+19), payout:1, type:'extérieur' };
  if (s === 'd1'    || s === '1-12')  return { label:'📊 1ère Douzaine',   numbers:Array.from({length:12},(_,i)=>i+1),  payout:2, type:'douzaine' };
  if (s === 'd2'    || s === '13-24') return { label:'📊 2ème Douzaine',   numbers:Array.from({length:12},(_,i)=>i+13), payout:2, type:'douzaine' };
  if (s === 'd3'    || s === '25-36') return { label:'📊 3ème Douzaine',   numbers:Array.from({length:12},(_,i)=>i+25), payout:2, type:'douzaine' };
  if (s === 'c1'    || s === 'col1')  return { label:'📋 Colonne 1',       numbers:[1,4,7,10,13,16,19,22,25,28,31,34],  payout:2, type:'colonne' };
  if (s === 'c2'    || s === 'col2')  return { label:'📋 Colonne 2',       numbers:[2,5,8,11,14,17,20,23,26,29,32,35],  payout:2, type:'colonne' };
  if (s === 'c3'    || s === 'col3')  return { label:'📋 Colonne 3',       numbers:[3,6,9,12,15,18,21,24,27,30,33,36],  payout:2, type:'colonne' };

  // Cheval (split) ex: "1-2"
  const splitM = s.match(/^(\d+)-(\d+)$/);
  if (splitM) {
    const a = parseInt(splitM[1]), b = parseInt(splitM[2]);
    if (a >= 0 && b <= 36 && a !== b)
      return { label:`🔀 Cheval ${a}-${b}`, numbers:[a,b], payout:17, type:'cheval' };
  }

  // Numéro plein (0-36)
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0 && num <= 36)
    return { label:`🎯 Plein ${num}`, numbers:[num], payout:35, type:'plein' };

  return null;
}

const BET_HELP = [
  '**═══ TABLE DE MISE ═══**',
  '🔴 `rouge` / `noir`         → ×2 (50%)',
  '🔢 `pair` / `impair`        → ×2 (50%)',
  '⬇️ `bas` / `haut`            → ×2 (50%)',
  '📊 `d1` `d2` `d3`           → ×3 (33%)',
  '📋 `c1` `c2` `c3`           → ×3 (33%)',
  '🔀 `1-2` (cheval)           → ×18 (6%)',
  '🎯 `0` à `36` (plein)       → ×36 (3%)',
].join('\n');

// Phases d'animation de la roulette
const SPIN_PHASES = [
  { label:'⚡ La bille part à toute vitesse !', color:'#C0392B', delay:100, frames:6 },
  { label:'🌀 Elle tourne à vive allure...',    color:'#E74C3C', delay:160, frames:5 },
  { label:'💨 La roue ralentit doucement...',   color:'#D35400', delay:240, frames:4 },
  { label:'⏳ Elle ralentit encore...',         color:'#E67E22', delay:360, frames:3 },
  { label:'🎯 Presque arrêtée...',              color:'#F39C12', delay:520, frames:2 },
  { label:'🤫 Suspense...',                     color:'#F1C40F', delay:700, frames:1 },
];

// ─── Table casino (header décoratif) ─────────────────────────
function casinoHeader() {
  return [
    '```',
    '┌─────────────────────────────┐',
    '│    🎡  ROULETTE ROYALE  🎡   │',
    '│   — Roue Européenne 0-36 —  │',
    '└─────────────────────────────┘',
    '```',
  ].join('\n');
}

// Jeton visuel selon montant
function chipDisplay(mise, coin) {
  let chip = '⚪';
  if (mise >= 10000) chip = '💎';
  else if (mise >= 5000) chip = '🔴';
  else if (mise >= 1000) chip = '🟣';
  else if (mise >= 500)  chip = '🔵';
  else if (mise >= 100)  chip = '🟢';
  else if (mise >= 50)   chip = '🟡';
  else chip = '⚪';
  return `${chip} **${mise} ${coin}**`;
}

// ─── Jeu principal ────────────────────────────────────────────
async function playRoulette(source, userId, guildId, mise, betType) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

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

  // ── Embed de départ (annonce du croupier) ──
  const gainPot = mise * (bet.payout + 1);
  const startDesc = [
    casinoHeader(),
    `🎩 *"Messieurs-dames, faites vos jeux !"*`,
    '',
    `**Pari :** ${bet.label}`,
    `**Mise :** ${chipDisplay(mise, coin)}`,
    `**Gain potentiel :** ${gainPot} ${coin} (×${bet.payout + 1})`,
    '',
    '🎡 *La roue est lancée...*',
  ].join('\n');

  const startEmbed = new EmbedBuilder()
    .setColor('#1A5276')
    .setTitle('🎡 Roulette Royale')
    .setDescription(startDesc);

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  // ── Animation roue ──
  let frameIdx = Math.floor(Math.random() * WHEEL_ORDER.length);

  for (const phase of SPIN_PHASES) {
    for (let f = 0; f < phase.frames; f++) {
      frameIdx = (frameIdx + 1) % WHEEL_ORDER.length;
      const wheelLine = renderWheel(frameIdx);

      const animDesc = [
        casinoHeader(),
        `**${phase.label}**`,
        '',
        wheelLine,
        '',
        `**Pari :** ${bet.label}  |  **Mise :** ${chipDisplay(mise, coin)}`,
      ].join('\n');

      const animEmbed = new EmbedBuilder()
        .setColor(phase.color)
        .setTitle('🎡 Roulette Royale')
        .setDescription(animDesc);

      await msg.edit({ embeds: [animEmbed] });
      await sleep(phase.delay);
    }
  }

  // ── Résultat ──
  const result = Math.floor(Math.random() * 37);
  const col    = numColor(result);
  const won    = bet.numbers.includes(result);

  let gain   = 0;
  let color;
  let croupier;
  let resultBox;

  // Trouver la position du résultat sur la roue
  const resultIdx = WHEEL_ORDER.indexOf(result);
  const nearbyNums = [-2,-1,0,1,2].map(off => {
    const idx = ((resultIdx + off) % WHEEL_ORDER.length + WHEEL_ORDER.length) % WHEEL_ORDER.length;
    const n   = WHEEL_ORDER[idx];
    if (off === 0) return `❱${numColor(n)}**${n}**❰`;
    return `${numColor(n)}${n}`;
  }).join(' ── ') + '\n' + '　　　　　　▲';

  if (won) {
    gain = mise * (bet.payout + 1);
    db.addCoins(userId, guildId, gain);
    color    = '#27AE60';
    croupier = `🎩 *"${result === 0 ? 'Zéro !' : numColor(result) === '🔴' ? 'Rouge' : 'Noir'}, numéro ${result} !"*`;

    if (bet.type === 'plein') {
      resultBox = [
        '```',
        '╔══════════════════════════════╗',
        '║   🏆  PLEIN ! JACKPOT !  🏆  ║',
        `║        Numéro ${String(result).padStart(2,' ')} — ×36       ║`,
        `║   +${String(gain).padEnd(6,' ')} ${coin}             ║`,
        '╚══════════════════════════════╝',
        '```',
      ].join('\n');
    } else if (bet.payout >= 17) {
      resultBox = [
        '```',
        '╔══════════════════════════╗',
        '║  🥇  CHEVAL GAGNANT !  🥇 ║',
        `║  +${String(gain).padEnd(6,' ')} ${coin}         ║`,
        '╚══════════════════════════╝',
        '```',
      ].join('\n');
    } else {
      resultBox = [
        '```',
        '╔═════════════════════════╗',
        '║  ✅  GAGNANT !  ✅       ║',
        `║  +${String(gain).padEnd(6,' ')} ${coin}        ║`,
        '╚═════════════════════════╝',
        '```',
      ].join('\n');
    }
  } else {
    color    = result === 0 ? '#27AE60' : '#E74C3C';
    croupier = result === 0
      ? `🎩 *"Zéro ! La banque ramasse !"*`
      : `🎩 *"${numColor(result) === '🔴' ? 'Rouge' : 'Noir'}, numéro ${result}. Raté !"*`;
    resultBox = [
      '```',
      '╔══════════════════════════╗',
      '║  ❌  PERDU !  ❌           ║',
      `║  -${String(mise).padEnd(6,' ')} ${coin}        ║`,
      '╚══════════════════════════╝',
      '```',
    ].join('\n');
  }

  const newBal = db.getUser(userId, guildId)?.balance || 0;

  const finalDesc = [
    casinoHeader(),
    croupier,
    '',
    nearbyNums,
    '',
    resultBox,
    '',
    `**Pari :** ${bet.label}`,
    `**Mise :** ${chipDisplay(mise, coin)}  |  **Solde :** ${newBal} ${coin}`,
  ].join('\n');

  // Bouton rejouer
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rl_replay_${userId}_${mise}_${betType}`)
      .setLabel('🎡 Rejouer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`rl_table_${userId}`)
      .setLabel('📋 Table des mises')
      .setStyle(ButtonStyle.Secondary),
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎡 Roulette Royale — Résultat')
    .setDescription(finalDesc)
    .setFooter({ text: 'Jouez de manière responsable · Mise min : 5 coins' })
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed], components: [row] });

  // Collector boutons
  const filter = i => i.user.id === userId && (i.customId.startsWith('rl_replay_') || i.customId.startsWith('rl_table_'));
  const collector = msg.createMessageComponentCollector({ filter, time: 30_000 });

  collector.on('collect', async i => {
    await i.deferUpdate();
    collector.stop();

    if (i.customId.startsWith('rl_table_')) {
      const tableEmbed = new EmbedBuilder()
        .setColor('#1A5276')
        .setTitle('📋 Table des mises — Roulette Royale')
        .setDescription(casinoHeader() + '\n' + BET_HELP)
        .setFooter({ text: 'Utilise &roulette <mise> <pari> pour jouer' });
      await msg.edit({ embeds: [tableEmbed], components: [] });
      return;
    }

    // Rejouer
    const parts   = i.customId.split('_');
    const newMise = parseInt(parts[3]);
    const newBet  = parts.slice(4).join('_');
    await playRoulette(source, userId, guildId, newMise, newBet);
  });

  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Roulette européenne — style casino authentique !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant à miser (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o
      .setName('pari')
      .setDescription('Type de pari : rouge, noir, pair, 17, d1, c2, 3-6 …')
      .setRequired(true)),

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

  name: 'roulette',
  aliases: ['rl', 'wheel', 'casino-roulette'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 5) return message.reply('❌ Usage : `&roulette <mise> <pari>`\nEx: `&roulette 100 rouge`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    await playRoulette(message, message.author.id, message.guildId, mise, betType);
  },

  betHelp: BET_HELP,
};

