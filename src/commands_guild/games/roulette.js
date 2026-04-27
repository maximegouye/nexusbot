// ============================================================
// roulette.js — Roulette européenne (v5)
// Nouveautés : 3 boutons de paris rapides
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── DB : historique des numéros (hot/cold) ───────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS roulette_history (
    guild_id TEXT NOT NULL,
    number   INTEGER NOT NULL,
    spun_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

function addToHistory(guildId, number) {
  try {
    db.db.prepare('INSERT INTO roulette_history (guild_id, number) VALUES (?,?)').run(guildId, number);
    // Garder seulement les 200 derniers
    db.db.prepare(`DELETE FROM roulette_history WHERE guild_id=? AND rowid NOT IN (
      SELECT rowid FROM roulette_history WHERE guild_id=? ORDER BY rowid DESC LIMIT 200
    )`).run(guildId, guildId);
  } catch {}
}

function getHotCold(guildId) {
  try {
    const rows = db.db.prepare(
      `SELECT number, COUNT(*) as cnt FROM roulette_history WHERE guild_id=?
       GROUP BY number ORDER BY cnt DESC`
    ).all(guildId);
    if (rows.length < 3) return null;
    const hot  = rows.slice(0, 3).map(r => r.number);
    const cold = rows.slice(-3).reverse().map(r => r.number);
    return { hot, cold };
  } catch { return null; }
}

// ─── Roue européenne ─────────────────────────────────────
const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

// Sections du cylindre (paris annoncés)
const VOISINS   = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];  // 17 numéros
const TIERS     = [5,8,10,11,13,16,23,24,27,30,33,36];               // 12 numéros
const ORPHELINS = [1,6,9,14,17,20,31,34];                            // 8 numéros

function numColor(n) {
  if (n === 0) return '🟩';
  return RED_NUMS.includes(n) ? '🔴' : '⚫';
}

function renderWheel(centerIdx) {
  const N = WHEEL_ORDER.length;
  const parts = [];
  for (let off = -2; off <= 2; off++) {
    const idx = ((centerIdx + off) % N + N) % N;
    const n   = WHEEL_ORDER[idx];
    const col = numColor(n);
    if (off === 0)          parts.push(`❱${col}**${n}**❰`);
    else if (Math.abs(off) === 1) parts.push(`${col}${n}`);
    else                    parts.push(`${col}`);
  }
  return parts.join(' ── ') + '\n' + '　　　　　　▲';
}

// ─── Parsing d'un seul pari ────────────────────────────────
function parseBet(s_raw) {
  const s = s_raw.toLowerCase().trim();

  if (s === 'rouge'  || s === 'red')   return { label:'🔴 Rouge',              numbers:RED_NUMS,   payout:1, type:'extérieur', key:s };
  if (s === 'noir'   || s === 'black') return { label:'⚫ Noir',               numbers:BLACK_NUMS, payout:1, type:'extérieur', key:s };
  if (s === 'pair'   || s === 'even')  return { label:'🔢 Pair',               numbers:[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36], payout:1, type:'extérieur', key:s };
  if (s === 'impair' || s === 'odd')   return { label:'🔢 Impair',             numbers:[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35], payout:1, type:'extérieur', key:s };
  if (s === 'bas'    || s === 'low'    || s === '1-18')  return { label:'⬇️ Manque (1-18)',  numbers:Array.from({length:18},(_,i)=>i+1),  payout:1, type:'extérieur', key:s };
  if (s === 'haut'   || s === 'high'   || s === '19-36') return { label:'⬆️ Passe (19-36)',  numbers:Array.from({length:18},(_,i)=>i+19), payout:1, type:'extérieur', key:s };
  if (s === 'd1'     || s === '1-12')  return { label:'📊 1ère Douzaine',      numbers:Array.from({length:12},(_,i)=>i+1),  payout:2, type:'douzaine', key:s };
  if (s === 'd2'     || s === '13-24') return { label:'📊 2ème Douzaine',      numbers:Array.from({length:12},(_,i)=>i+13), payout:2, type:'douzaine', key:s };
  if (s === 'd3'     || s === '25-36') return { label:'📊 3ème Douzaine',      numbers:Array.from({length:12},(_,i)=>i+25), payout:2, type:'douzaine', key:s };
  if (s === 'c1'     || s === 'col1')  return { label:'📋 Colonne 1',          numbers:[1,4,7,10,13,16,19,22,25,28,31,34],  payout:2, type:'colonne', key:s };
  if (s === 'c2'     || s === 'col2')  return { label:'📋 Colonne 2',          numbers:[2,5,8,11,14,17,20,23,26,29,32,35],  payout:2, type:'colonne', key:s };
  if (s === 'c3'     || s === 'col3')  return { label:'📋 Colonne 3',          numbers:[3,6,9,12,15,18,21,24,27,30,33,36],  payout:2, type:'colonne', key:s };

  // ── Paris de sections du cylindre ─────────────────────────
  if (s === 'voisins' || s === 'vz' || s === 'voisins-zero')
    return { label:'🎡 Voisins du Zéro',       numbers:VOISINS,   payout:1, type:'section', key:'voisins' };
  if (s === 'tiers' || s === 'tc' || s === 'tiers-cylindre')
    return { label:'🎡 Tiers du Cylindre',     numbers:TIERS,     payout:2, type:'section', key:'tiers' };
  if (s === 'orphelins' || s === 'orph')
    return { label:'🎡 Orphelins',             numbers:ORPHELINS, payout:3, type:'section', key:'orphelins' };

  // Cheval (split) ex: "1/2" ou "3+4"
  const splitM = s.match(/^(\d+)[\/\+](\d+)$/) || s.match(/^(\d+)-(\d+)$/) ;
  if (splitM) {
    const a = parseInt(splitM[1]), b = parseInt(splitM[2]);
    if (a >= 0 && b <= 36 && a !== b)
      return { label:`🔀 Cheval ${a}-${b}`, numbers:[a,b], payout:17, type:'cheval', key:`${a}-${b}` };
  }

  // Numéro plein (0-36)
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0 && num <= 36)
    return { label:`🎯 Plein ${num}`, numbers:[num], payout:35, type:'plein', key:`${num}` };

  return null;
}

// ─── Parsing multi-paris (séparateur , ou ~ dans customId) ─
function parseBets(str) {
  const parts = str.split(/[,~]/).map(s => s.trim()).filter(Boolean);
  const bets  = parts.map(p => parseBet(p)).filter(Boolean);
  return bets.slice(0, 3); // max 3 paris simultanés
}

const BET_HELP = [
  '**═══ TABLE DE MISE ═══**',
  '🔴 `rouge` / `noir`         → ×2 (46%)',
  '🔢 `pair` / `impair`        → ×2 (49%)',
  '⬇️ `bas` / `haut`            → ×2 (49%)',
  '📊 `d1` `d2` `d3`           → ×3 (32%)',
  '📋 `c1` `c2` `c3`           → ×3 (32%)',
  '🔀 `1/2` (cheval)           → ×18  (5%)',
  '🎯 `0` à `36` (plein)       → ×36  (3%)',
  '',
  '**═══ SECTIONS DU CYLINDRE ═══**',
  '🎡 `voisins` (17 nos)       → ×2 (46%)',
  '🎡 `tiers` (12 nos)         → ×3 (32%)',
  '🎡 `orphelins` (8 nos)      → ×4 (22%)',
  '',
  '**Multi-paris** : `rouge,d1,17` (jusqu\'à 3 simultanés)',
].join('\n');

// ─── Phases d'animation ───────────────────────────────────
const SPIN_PHASES = [
  { label:'⚡ *La bille part comme une flèche !*',           color:'#C0392B', delay:80,  frames:4 },
  { label:'🌀 *Vitesse maximale ! La bille tourbillonne !*', color:'#E74C3C', delay:110, frames:5 },
  { label:'💨 *Elle commence à ralentir...*',               color:'#D35400', delay:160, frames:4 },
  { label:'🏓 *La bille rebondit sur les séparateurs !*',    color:'#E67E22', delay:220, frames:3 },
  { label:'🎯 *Elle hésite entre deux cases...*',            color:'#F39C12', delay:320, frames:3 },
  { label:'🤫 *Suspense total...*',                          color:'#F1C40F', delay:480, frames:2 },
  { label:'🔔 *Clic ! La bille se pose !*',                  color:'#2ECC71', delay:700, frames:2 },
  { label:'💫 *La bille claque dans sa case finale !*',      color:'#27AE60', delay:500, frames:1 },
];

function casinoHeader() {
  return [
    '```',
    '╔═════════════════════════════╗',
    '║  ✨  🎡  ROULETTE ROYALE  🎡  ✨  ║',
    '║    Roue Européenne 0-36     ║',
    '║   💎 Casino Premium 💎       ║',
    '╚═════════════════════════════╝',
    '```',
  ].join('\n');
}

function chipDisplay(mise, coin) {
  let chip = '⚪';
  if (mise >= 10000) chip = '💎';
  else if (mise >= 5000) chip = '🔴';
  else if (mise >= 1000) chip = '🟣';
  else if (mise >= 500)  chip = '🔵';
  else if (mise >= 100)  chip = '🟢';
  else if (mise >= 50)   chip = '🟡';
  return `${chip} **${mise} ${coin}**`;
}

// ─── Jeu principal ────────────────────────────────────────
async function playRoulette(source, userId, guildId, mise, betString) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  const bets = parseBets(betString);

  if (!bets.length) {
    const err = `❌ Type de pari invalide.\n\n${BET_HELP}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  const totalMise = mise * bets.length;

  if (!u || u.balance < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}** (mise totale : **${totalMise} ${coin}**).`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 5) {
    const err = '❌ Mise minimale : **5 coins** par pari.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);

  // ── Embed départ ──────────────────────────────────────────
  const betLabels  = bets.map(b => b.label).join('  +  ');
  const maxPot     = bets.reduce((s, b) => s + mise * (b.payout + 1), 0);
  const betDesc    = bets.length === 1
    ? `**Pari :** ${bets[0].label}\n**Gain potentiel :** ${maxPot} ${coin} (×${bets[0].payout + 1})`
    : `**Paris (${bets.length}) :**\n${bets.map(b => `▸ ${b.label} — pot. +${mise*(b.payout+1)} ${coin}`).join('\n')}\n**Gain max total :** ${maxPot} ${coin}`;

  const startDesc = [
    casinoHeader(),
    `🎩 *"Messieurs-dames, faites vos jeux !"*`,
    '',
    betDesc,
    `**Mise totale :** ${chipDisplay(totalMise, coin)}`,
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

  // ── Animation ────────────────────────────────────────────
  let frameIdx = Math.floor(Math.random() * WHEEL_ORDER.length);

  for (const phase of SPIN_PHASES) {
    for (let f = 0; f < phase.frames; f++) {
      frameIdx = (frameIdx + 1) % WHEEL_ORDER.length;
      const animDesc = [
        casinoHeader(),
        `**${phase.label}**`,
        '',
        renderWheel(frameIdx),
        '',
        `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`,
      ].join('\n');
      await msg.edit({ embeds: [new EmbedBuilder().setColor(phase.color).setTitle('🎡 Roulette Royale').setDescription(animDesc)] });
      await sleep(phase.delay);
    }
  }

  // ── Résultat ──────────────────────────────────────────────
  const result   = Math.floor(Math.random() * 37);
  const col      = numColor(result);
  addToHistory(guildId, result);

  const resultIdx = WHEEL_ORDER.indexOf(result);
  const nearbyNums = [-2,-1,0,1,2].map(off => {
    const idx = ((resultIdx + off) % WHEEL_ORDER.length + WHEEL_ORDER.length) % WHEEL_ORDER.length;
    const n   = WHEEL_ORDER[idx];
    if (off === 0) return `❱${numColor(n)}**${n}**❰`;
    return `${numColor(n)}${n}`;
  }).join(' ── ') + '\n' + '　　　　　　▲';

  // ── Pré-évaluation (sans DB) pour l'animation flash ────
  const betPreview = bets.map(bet => ({
    bet,
    won:  bet.numbers.includes(result),
    gain: bet.numbers.includes(result) ? mise * (bet.payout + 1) : 0,
  }));
  const anyWonPre  = betPreview.some(r => r.won);
  const totalGainPre = betPreview.reduce((s, r) => s + r.gain, 0);
  const netPre     = totalGainPre - totalMise;

  // ── 🎬 Flash révélation — bille claque dans sa case ─────
  const flashWheelStr = nearbyNums + '\n\n**📢 La bille s\'immobilise !**';
  const flashSeq = [
    { color: '#FFFFFF', title: `🎡 💫 LA BILLE S'ARRÊTE ! 💫 🎡` },
    { color: anyWonPre ? '#F1C40F' : '#1a1a2e', title: `🎡 ${col} NUMÉRO **${result}** ! ${col} 🎡` },
    { color: anyWonPre ? '#FFD700'  : '#C0392B', title: anyWonPre ? `🎉✨ GAGNANT ! ✨🎉` : `💸 PERDU 💸` },
    { color: anyWonPre ? '#2ECC71'  : '#E74C3C', title: `${col}${col} ${result} ${col}${col}` },
  ];
  for (const { color, title } of flashSeq) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle(title)
      .setDescription([casinoHeader(), '', flashWheelStr, '', `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`].join('\n'))
    ] }).catch(() => {});
    await sleep(320);
  }

  // ── Appliquer les gains en DB ────────────────────────────
  let totalGain = 0;
  const betResults = betPreview.map(({ bet, won, gain }) => {
    if (won) {
      db.addCoins(userId, guildId, gain);
      totalGain += gain;
    }
    return { bet, won, gain };
  });

  const anyWon  = anyWonPre;
  const netDiff = totalGain - totalMise;

  // ── Croupier ────────────────────────────────────────────
  const croupier = result === 0
    ? `🎩 *"Zéro !"*`
    : `🎩 *"${col === '🔴' ? 'Rouge' : 'Noir'}, numéro ${result} !"*`;

  // ── Boîte résultat ──────────────────────────────────────
  let resultBox;
  if (anyWon && bets.length === 1 && bets[0].type === 'plein') {
    resultBox = [
      '```',
      '╔══════════════════════════════╗',
      '║   🏆  PLEIN ! JACKPOT !  🏆  ║',
      `║        Numéro ${String(result).padStart(2,' ')} — ×36       ║`,
      `║   +${String(totalGain).padEnd(6,' ')} ${coin}             ║`,
      '╚══════════════════════════════╝',
      '```',
    ].join('\n');
  } else if (anyWon) {
    const sign = netDiff >= 0 ? '+' : '';
    resultBox = [
      '```',
      '╔══════════════════════════════╗',
      `║  ${netDiff >= 0 ? '✅  GAGNANT !' : '⚠️  PARTIEL'}              ║`,
      `║  Net : ${sign}${String(netDiff).padEnd(6,' ')} ${coin}      ║`,
      '╚══════════════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultBox = [
      '```',
      '╔══════════════════════════════╗',
      '║  ❌  PERDU !  ❌              ║',
      `║  -${String(totalMise).padEnd(6,' ')} ${coin}          ║`,
      '╚══════════════════════════════╝',
      '```',
    ].join('\n');
  }

  // Détail de chaque pari
  const betDetail = betResults.map(r =>
    `${r.won ? '✅' : '❌'} ${r.bet.label} → ${r.won ? `**+${r.gain} ${coin}**` : `−${mise} ${coin}`}`
  ).join('\n');

  // Numéros chauds/froids
  const hc = getHotCold(guildId);
  const hotColdLine = hc
    ? `\n🔥 **Chauds :** ${hc.hot.map(n => `${numColor(n)}${n}`).join(' ')}  |  🧊 **Froids :** ${hc.cold.map(n => `${numColor(n)}${n}`).join(' ')}`
    : '';

  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const finalDesc = [
    casinoHeader(),
    croupier,
    '',
    nearbyNums,
    '',
    resultBox,
    '',
    betDetail,
    '',
    `**Mise :** ${chipDisplay(totalMise, coin)}  |  **Solde :** ${newBal} ${coin}`,
    hotColdLine,
  ].join('\n');

  const finalColor  = anyWon ? (netDiff >= 0 ? '#27AE60' : '#F39C12') : (result === 0 ? '#27AE60' : '#E74C3C');
  const finalTitle  = anyWon
    ? (netDiff > 0 ? '🎡 🎉 VICTOIRE 🎉 Roulette Royale' : '🎡 ⚠️ PARTIEL Roulette Royale')
    : '🎡 💸 PERDU 💸 Roulette Royale';

  // Encoder les paris pour le bouton replay (~ comme séparateur)
  const encodedBets = bets.map(b => b.key).join('~');
  const row = makeGameRow('rl', userId, mise, encodedBets);

  // Ajouter une deuxième ActionRow avec les boutons rapides
  const quickBetsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rl_quickbet_${userId}_${mise}_rouge`)
      .setLabel('🔴 Rouge x2')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`rl_quickbet_${userId}_${mise}_noir`)
      .setLabel('⚫ Noir x2')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rl_quickbet_${userId}_${mise}_pairimpair`)
      .setLabel('🟢 Pair/Impair')
      .setStyle(ButtonStyle.Primary),
  );

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor(finalColor)
      .setTitle(finalTitle)
      .setDescription(finalDesc)
      .setFooter({ text: 'Jouez de manière responsable · Mise min : 5 coins/pari · Max 3 paris simultanés' })
      .setTimestamp()],
    components: [row, quickBetsRow],
  });
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Roulette européenne — multi-paris, sections du cylindre, numéros chauds !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise par pari (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o
      .setName('pari')
      .setDescription('Ex: rouge  |  d1,rouge  |  voisins  |  17,noir,c2 (max 3 paris)')
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
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&roulette <mise> <pari>`\nEx: `&roulette 100 rouge`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 5) return message.reply('❌ Usage : `&roulette <mise> <pari>`\nEx: `&roulette 100 rouge`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    await playRoulette(message, message.author.id, message.guildId, mise, betType);
  },

  betHelp: BET_HELP,

  async handleComponent(interaction, cid) {
    // ── Pari rapide (rouge, noir, pair/impair) ─────────────
    if (cid.startsWith('rl_quickbet_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betType = parts[4]; // rouge, noir, ou pairimpair
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      
      // Convertir le type de pari en string pour playRoulette
      let betStr = betType;
      if (betType === 'pairimpair') {
        // Choisir aléatoirement pair ou impair
        betStr = Math.random() < 0.5 ? 'pair' : 'impair';
      }
      
      await playRoulette(interaction, userId, interaction.guildId, mise, betStr);
      return true;
    }

    // ── Table des mises ────────────────────────────────────
    if (cid.startsWith('rl_table_')) {
      const userId = cid.split('_')[2];
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      const tableEmbed = new EmbedBuilder()
        .setColor('#1A5276')
        .setTitle('📋 Table des mises — Roulette Royale')
        .setDescription(casinoHeader() + '\n' + BET_HELP)
        .setFooter({ text: 'Utilise /roulette mise pari pour jouer' });
      await interaction.editReply({ embeds: [tableEmbed], components: [] });
      return true;
    }

    // ── Rejouer ────────────────────────────────────────────
    if (cid.startsWith('rl_replay_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betStr  = parts.slice(4).join('_'); // encoded with ~
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      await playRoulette(interaction, userId, interaction.guildId, mise, betStr);
      return true;
    }

    // ── Changer la mise ────────────────────────────────────
    if (cid.startsWith('rl_changemise_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.showModal(changeMiseModal('rl', userId, betStr));
      return true;
    }

    // ── Modal mise ─────────────────────────────────────────
    if (cid.startsWith('rl_modal_') && interaction.isModalSubmit()) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u       = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 5) {
        return interaction.editReply({ content: '❌ Mise invalide (min 5 coins/pari).', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
      await playRoulette(interaction, userId, interaction.guildId, newMise, betStr);
      return true;
    }

    return false;
  },
};
