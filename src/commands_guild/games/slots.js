// ============================================================
// slots.js — Machine à sous 5 rouleaux ÉPOUSTOUFLANTE (v8)
// GRILLE 5×3 VISIBLE | Animation 5 phases | Jackpot progressif
// Wild Reel Feature | Mega Win cinématique | 3 nouveaux symboles premium
// Free Spins améliorés | Session Stats RTP | Paytable dans embed
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── Maps de session en mémoire ──────────────────────────
const sessionStats = new Map(); // userId → {gains, losses, spins, biggestWin, totalWagered}
const streakStats  = new Map(); // userId → {current, best}
const bonusGames   = new Map(); // `${userId}_${guildId}` → {prizes, mise, lines, msgId}

// ─── Symboles & poids — V8 ENRICHIS ──────────────────────
const SYMBOLS = [
  { id: 'cherry',  emoji: '🍒', name: 'Cerise',   weight: 28, value: 2  },
  { id: 'lemon',   emoji: '🍋', name: 'Citron',   weight: 22, value: 3  },
  { id: 'orange',  emoji: '🍊', name: 'Orange',   weight: 18, value: 4  },
  { id: 'grape',   emoji: '🍇', name: 'Raisin',   weight: 14, value: 5  },
  { id: 'melon',   emoji: '🍉', name: 'Melon',    weight: 9,  value: 8  },
  { id: 'bell',    emoji: '🔔', name: 'Cloche',   weight: 7,  value: 10 },
  { id: 'star',    emoji: '⭐', name: 'Étoile',   weight: 5,  value: 20 }, // NOUVEAU PREMIUM
  { id: 'seven',   emoji: '7️⃣', name: 'Sept',     weight: 3,  value: 25 },
  { id: 'trophy',  emoji: '🏆', name: 'Trophée',  weight: 2,  value: 50 }, // NOUVEAU TRÈS RARE
  { id: 'diamond', emoji: '💎', name: 'Diamant',  weight: 2,  value: 40 },
  { id: 'bomb',    emoji: '💣', name: 'Bombe',    weight: 1,  value: 0  }, // SCATTER SPÉCIAL
  { id: 'wild',    emoji: '🃏', name: 'WILD',     weight: 3,  value: 0  },
  { id: 'wild2',   emoji: '🎴', name: 'WILD×2',   weight: 1,  value: 0  },
  { id: 'scatter', emoji: '🌠', name: 'SCATTER',  weight: 2,  value: 0  },
  { id: 'bonus',   emoji: '🎁', name: 'BONUS',    weight: 1,  value: 0  },
];
const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// ─── 5 Paylines pour grille 5×3 ──────────────────────────
const PAYLINES = [
  { id: 1, name: 'Milieu',  rows: [1,1,1,1,1] },
  { id: 2, name: 'Haut',    rows: [0,0,0,0,0] },
  { id: 3, name: 'Bas',     rows: [2,2,2,2,2] },
  { id: 4, name: 'V',       rows: [0,1,2,1,0] },
  { id: 5, name: '∧',       rows: [2,1,0,1,2] },
];

// ─── DB init ──────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS slots_jackpot (
    guild_id TEXT PRIMARY KEY,
    amount   INTEGER DEFAULT 5000
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS slots_stats (
    user_id  TEXT,
    guild_id TEXT,
    spins    INTEGER DEFAULT 0,
    wins     INTEGER DEFAULT 0,
    jackpots INTEGER DEFAULT 0,
    biggest  INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

// ─── Helpers DB ──────────────────────────────────────────
function getJackpot(guildId) {
  let row = db.db.prepare('SELECT amount FROM slots_jackpot WHERE guild_id=?').get(guildId);
  if (!row) {
    db.db.prepare('INSERT OR IGNORE INTO slots_jackpot (guild_id,amount) VALUES (?,5000)').run(guildId);
    row = { amount: 5000 };
  }
  return row.amount;
}
function addToJackpot(guildId, amount) {
  db.db.prepare('INSERT OR IGNORE INTO slots_jackpot (guild_id) VALUES (?)').run(guildId);
  db.db.prepare('UPDATE slots_jackpot SET amount=amount+? WHERE guild_id=?').run(amount, guildId);
}
function resetJackpot(guildId) {
  db.db.prepare('UPDATE slots_jackpot SET amount=5000 WHERE guild_id=?').run(guildId);
}
function addStats(userId, guildId, won, amount, isJackpot) {
  db.db.prepare('INSERT OR IGNORE INTO slots_stats (user_id,guild_id) VALUES (?,?)').run(userId, guildId);
  db.db.prepare(`UPDATE slots_stats SET
    spins=spins+1, wins=wins+?, jackpots=jackpots+?, biggest=MAX(biggest,?)
    WHERE user_id=? AND guild_id=?`
  ).run(won ? 1 : 0, isJackpot ? 1 : 0, amount, userId, guildId);
}

// ─── Helpers session ─────────────────────────────────────
function trackSession(userId, netGain, wagered = 0) {
  const s = sessionStats.get(userId) || { gains: 0, losses: 0, spins: 0, biggestWin: 0, totalWagered: 0 };
  s.spins++;
  s.totalWagered += wagered;
  if (netGain > 0) { s.gains += netGain; s.biggestWin = Math.max(s.biggestWin, netGain); }
  else s.losses += Math.abs(netGain);
  sessionStats.set(userId, s);
}
function getSession(userId) {
  return sessionStats.get(userId) || { gains: 0, losses: 0, spins: 0, biggestWin: 0, totalWagered: 0 };
}
function trackStreak(userId, won) {
  const s = streakStats.get(userId) || { current: 0, best: 0 };
  if (won) { s.current++; s.best = Math.max(s.best, s.current); }
  else s.current = 0;
  streakStats.set(userId, s);
  return s;
}
function getStreakMultiplier(streak) {
  if (streak >= 10) return 1.50;
  if (streak >= 5)  return 1.25;
  if (streak >= 3)  return 1.10;
  return 1.00;
}

// ─── Moteur de spin ──────────────────────────────────────
function spinReel() {
  let rng = Math.random() * TOTAL_WEIGHT;
  for (const sym of SYMBOLS) { rng -= sym.weight; if (rng <= 0) return sym; }
  return SYMBOLS[0];
}
function spinGrid() {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => spinReel()));
}

// ─── WILD REEL FEATURE (10% chance) ────────────────────
function applyWildReelFeature(grid) {
  if (Math.random() < 0.1) { // 10% de chance
    const wildCol = Math.floor(Math.random() * 5);
    const wildSymbol = SYMBOLS.find(s => s.id === 'wild');
    grid[wildCol] = [wildSymbol, wildSymbol, wildSymbol];
  }
  return grid;
}

// ─── Affichage grille 5×3 COMPLÈTE ──────────────────────
function gridDisplay(grid, highlightRows = null, activeLines = null) {
  const activeRowSet = new Set();
  if (activeLines !== null) {
    const usedPl = PAYLINES.slice(0, activeLines);
    for (const pl of usedPl) {
      if (pl.rows.every(r => r === pl.rows[0])) activeRowSet.add(pl.rows[0]);
    }
  }
  return [0, 1, 2].map(row => {
    const line = grid.map(col => col[row].emoji).join(' │ ');
    const marker = row === 1 ? '➤ ' : '   ';
    if (highlightRows && highlightRows.includes(row)) return `${marker}${line} ◀ WIN!`;
    if (activeLines !== null && activeRowSet.has(row)) return `${marker}${line} ◀`;
    return `   ${line}`;
  }).join('\n');
}

// ─── Évaluation d'une payline ─────────────────────────────
function evalPayline(grid, payline) {
  const cells = payline.rows.map((row, col) => grid[col][row]);
  const wilds  = cells.filter(c => c.id === 'wild' || c.id === 'wild2');
  const wildCount  = cells.filter(c => c.id === 'wild').length;
  const wild2Count = cells.filter(c => c.id === 'wild2').length;
  const totalWilds = wildCount + wild2Count;

  // Check left-to-right streak (3, 4 ou 5 symboles identiques + wilds)
  const counts = {};
  for (const c of cells) {
    if (c.id === 'wild' || c.id === 'wild2' || c.id === 'scatter' || c.id === 'bonus' || c.id === 'bomb') continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
  }

  // JACKPOT : 5 wilds (incluant wild2)
  if (totalWilds === 5) return { type: 'jackpot', mult: 0 };

  // Find best symbol match left-to-right
  let bestSym = null, bestCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count + totalWilds >= 3 && count > bestCount) {
      const sym = SYMBOLS.find(s => s.id === id);
      if (sym && (!bestSym || sym.value > bestSym.value)) {
        bestSym = sym;
        bestCount = count;
      }
    }
  }

  if (!bestSym) return { type: 'miss', mult: 0 };

  const total = bestCount + totalWilds;
  let mult = bestSym.value * (total === 3 ? 1 : total === 4 ? 3 : 8);

  // Wild×2 double le multiplicateur
  if (wild2Count > 0) mult *= 2;

  return { type: 'win', symbol: bestSym, count: total, wildCount, wild2Count, mult, payline };
}

// ─── Évaluation complète de la grille ────────────────────
function evalGridFull(grid, activeLines = 5) {
  const results = [];
  const usedPaylines = PAYLINES.slice(0, activeLines);

  for (const pl of usedPaylines) {
    results.push({ payline: pl, ...evalPayline(grid, pl) });
  }

  // Scatter : compte partout dans la grille
  const allCells = grid.flat();
  const scatterCount = allCells.filter(c => c.id === 'scatter').length;
  const bombCount    = allCells.filter(c => c.id === 'bomb').length;
  const bonusCount   = allCells.filter(c => c.id === 'bonus').length;

  const hasJackpot = results.some(r => r.type === 'jackpot');
  const wins = results.filter(r => r.type === 'win');

  return { results, hasJackpot, scatterCount, bombCount, bonusCount, wins };
}

// ─── Cascading reels ─────────────────────────────────────
function cascadeGrid(grid, winResults) {
  const toReplace = new Set();
  for (const w of winResults) {
    if (w.type === 'win' || w.type === 'jackpot') {
      for (let col = 0; col < 5; col++) {
        const row = w.payline.rows[col];
        toReplace.add(`${col}_${row}`);
      }
    }
  }
  if (toReplace.size === 0) return null;

  const newGrid = grid.map((col, ci) =>
    col.map((sym, ri) => {
      if (toReplace.has(`${ci}_${ri}`)) return spinReel();
      return sym;
    })
  );
  return newGrid;
}

// ─── Win Tier avec MEGA WIN ─────────────────────────────
function getWinTier(gain, mise) {
  const ratio = gain / mise;
  if (ratio >= 100) return { label: '🌟 LEGENDARY WIN !! 🌟', color: '#FF00FF', delay: 1000, mega: true };
  if (ratio >= 50)  return { label: '🔥 MEGA WIN !!', color: '#FF4500', delay: 900, mega: true };
  if (ratio >= 25)  return { label: '⚡ SUPER WIN !', color: '#FFD700', delay: 800 };
  if (ratio >= 10)  return { label: '💥 MEGA WIN !', color: '#FF8C00', delay: 700 };
  if (ratio >= 5)   return { label: '🎊 BIG WIN !', color: '#00FF7F', delay: 600 };
  if (ratio >= 1)   return { label: '✅ GAIN !', color: '#2ECC71', delay: 0 };
  return null;
}

// ─── Animations ──────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateSpin(msg, grid, coin, mise, jackpot) {
  const SYM = ['🍒','🍋','🍊','🍇','🍉','🔔','⭐','7️⃣','💎','🃏','🌠','🎴','🏆','💣'];
  const rndRow = () => Array.from({ length: 3 }, () => SYM[Math.floor(Math.random()*SYM.length)]);

  const rndGrid = () => [
    rndRow().join(' │ '),
    rndRow().join(' │ '),
    rndRow().join(' │ '),
  ];

  // PHASE 1: Démarrage explosive
  for (const [color, text] of [
    ['#F39C12', '⚡ ROULEAUX EN FUITE !'],
    ['#E67E22', '🌀 ROTATION TOTALE !']
  ]) {
    const [l1, l2, l3] = rndGrid();
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color)
      .setTitle('🎰 MACHINE ALMOSNI — 5 ROULEAUX')
      .setDescription(`\`\`\`\n   ${l1}\n➤ ${l2} ◀ PAYLINE 1\n   ${l3}\n\`\`\`\n*${text}*`)
      .addFields(
        {name:'💰 Mise',value:`${mise.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🌟 Jackpot',value:`${jackpot.toLocaleString('fr-FR')} ${coin}`,inline:true}
      )
    ]}).catch(() => {});
    await sleep(550);
  }

  // PHASE 2: Ralentissement
  for (const [color, text] of [
    ['#7D3C98', '🔄 RALENTISSEMENT...'],
    ['#5B2C7D', '⏳ DERNIERS SYMBOLES...']
  ]) {
    const [l1, l2, l3] = rndGrid();
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color)
      .setTitle('🎰 MACHINE ALMOSNI — 5 ROULEAUX')
      .setDescription(`\`\`\`\n   ${l1}\n➤ ${l2} ◀ PAYLINE 1\n   ${l3}\n\`\`\`\n*${text}*`)
      .addFields(
        {name:'💰 Mise',value:`${mise.toLocaleString('fr-FR')} ${coin}`,inline:true}
      )
    ]}).catch(() => {});
    await sleep(600);
  }

  // PHASE 3-5: Révélation rouleau par rouleau avec grille complète visible
  const partial = Array.from({length:5}, () => Array.from({length:3}, () => ({emoji:'🌀'})));
  const stopColors = ['#6C3483','#1A5276','#1E8449','#117A65','#27AE60'];

  for (let col = 0; col < 5; col++) {
    partial[col] = grid[col];
    const display = gridDisplay(partial);
    const rem = 4 - col;
    const txt = rem > 0 ? `🌀 ${rem} rouleau${rem>1?'x':''} encore...` : '✅ TOUS ARRÊTÉS!';

    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(stopColors[col])
      .setTitle('🎰 MACHINE ALMOSNI — 5 ROULEAUX')
      .setDescription(`\`\`\`\n${display}\n\`\`\`\n*${txt}*`)
      .addFields(
        {name:'💰 Mise',value:`${mise.toLocaleString('fr-FR')} ${coin}`,inline:true}
      )
    ]}).catch(() => {});
    await sleep(col < 4 ? 550 : 300);
  }
}

async function animateMegaWin(msg, amount, coin, tier) {
  const frames = [
    { color: '#FF00FF', title: '🌟✨ MEGA WIN CINÉMATIQUE ✨🌟', desc: '💥 EXPLOSION DE GAINS !' },
    { color: '#FFD700', title: '🎆 JACKPOT ! 🎆', desc: `+${amount.toLocaleString('fr-FR')} ${coin}` },
    { color: '#FF4500', title: '🔥 FORTUNE 🔥', desc: '💰 JACKPOT DÉVERROUILLÉ !' },
  ];
  for (const frame of frames) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(frame.color)
      .setTitle(frame.title)
      .setDescription('```\n' + '💣 '.repeat(15) + '\n' + frame.desc + '\n' + '💣 '.repeat(15) + '\n```')
    ]}).catch(() => {});
    await sleep(500);
  }
}

async function animateWinTier(msg, tier) {
  if (!tier || tier.delay === 0) return;
  const frames = [tier.label, `✨ ${tier.label} ✨`, tier.label];
  for (const frame of frames) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor(tier.color).setTitle(frame)
      .setDescription('```\n' + '★'.repeat(32) + '\n```')
    ]}).catch(() => {});
    await sleep(tier.delay);
  }
}

async function animateJackpot(msg, amount, coin) {
  const frames = [
    ['#FFD700', '🎊 JACKPOT PROGRESSIF !! 🎊', `+${amount.toLocaleString('fr-FR')} ${coin}`],
    ['#FFA500', '🏆 LÉGENDAIRE ! 🏆', `Fortune déverrouillée !`],
    ['#FF6B6B', '💎 QUINTUPLE WILD ! 💎', `+${amount.toLocaleString('fr-FR')} ${coin}`],
  ];
  for (const [color, title, desc] of frames) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle(title)
      .setDescription('```\n' + '='.repeat(30) + '\n  🏆 JACKPOT 🏆\n' + '='.repeat(30) + '\n```\n' + desc)
    ]}).catch(() => {});
    await sleep(750);
  }
}

async function animateCoinRain(msg, color, title) {
  const frames = ['💰 💸 💶 €', '€ 💰 💸 💶 💰', '💸 💶 € 💰 💸 💶'];
  const texts  = ['🌧️ Les euros pleuvent !', '💨 TEMPÊTE DE GAINS !!', '💰 FORTUNE DÉVERSÉE !!'];
  for (let i = 0; i < 3; i++) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle(title)
      .setDescription(`${frames[i]}\n\n*${texts[i]}*`)
    ]}).catch(() => {});
    await sleep(650);
  }
}

// ─── Free Spins avec multiplicateur progressif et BOMB SCATTER ─────
async function runFreeSpins(msg, userId, guildId, mise, coin, freeCount, startMult, activeLines = 5) {
  let totalGain = 0;
  let multiplier = startMult;
  let spinsLeft = freeCount;
  const summary = [];

  for (let s = 0; s < freeCount; s++) {
    const spinNum = freeCount - spinsLeft + 1;
    const progress = '█'.repeat(Math.ceil((spinNum / freeCount) * 10)) +
                     '░'.repeat(Math.max(0, 10 - Math.ceil((spinNum / freeCount) * 10)));

    await msg.edit({ embeds: [new EmbedBuilder().setColor('#9B59B6')
      .setTitle(`🎁 FREE SPIN ${spinNum}/${freeCount} — ×${multiplier} 🎁`)
      .setDescription(`\`\`\`\n${progress} ${Math.round((spinNum/freeCount)*100)}%\n\n   🌀 │ 🌀 │ 🌀 │ 🌀 │ 🌀\n➤ 🌀 │ 🌀 │ 🌀 │ 🌀 │ 🌀 ◀\n   🌀 │ 🌀 │ 🌀 │ 🌀 │ 🌀\n\`\`\`\n*Free spin gratuit en cours...*`)
      .addFields(
        {name:'💰 Gain accumulé',value:`${totalGain.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🎯 Multiplicateur',value:`×${multiplier}`,inline:true}
      )
    ]}).catch(() => {});
    await sleep(650);

    const freeGrid = spinGrid();
    const { wins, hasJackpot, scatterCount, bombCount } = evalGridFull(freeGrid, 5);

    // BOMB SCATTER: 3+ bombe = ×3 FREE SPINS
    let bonusSpins = 0;
    if (bombCount >= 3) {
      bonusSpins = Math.min(8, bombCount * 2);
      spinsLeft += bonusSpins;
    }
    // Scatters supplémentaires pendant free spins = +2 spins
    else if (scatterCount >= 3) {
      bonusSpins = 2;
      spinsLeft += bonusSpins;
    }

    let spinGain = 0;
    if (hasJackpot) {
      const jp = getJackpot(guildId);
      spinGain = jp * multiplier;
      resetJackpot(guildId);
      db.addCoins(userId, guildId, spinGain);
    } else {
      for (const w of wins) spinGain += Math.floor(mise * w.mult * multiplier);
      if (spinGain > 0) db.addCoins(userId, guildId, spinGain);
    }

    totalGain += spinGain;
    if (spinGain > 0) { multiplier = Math.min(10, multiplier + 0.5); }

    const rowsDisplay = gridDisplay(freeGrid, null, activeLines);
    const spinLabel = spinGain > 0
      ? `+${spinGain.toLocaleString('fr-FR')} ${coin} (×${multiplier.toFixed(1)})`
      : '—';
    summary.push(`Spin ${spinNum}: ${spinLabel}${bonusSpins > 0 ? ` +${bonusSpins} bonus!` : ''}`);

    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(spinGain > 0 ? '#2ECC71' : '#7F8C8D')
      .setTitle(`🎁 FREE SPIN ${spinNum}/${freeCount} — ${spinGain > 0 ? `+${spinGain.toLocaleString('fr-FR')} ${coin}` : 'Pas de gain'}`)
      .setDescription(`\`\`\`\n${rowsDisplay}\n\`\`\``)
      .addFields(
        {name:'💰 Gain accumulé',value:`${totalGain.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🎯 Multiplicateur',value:`×${multiplier.toFixed(1)}`,inline:true},
        {name:'🎁 Spins restants',value:`${spinsLeft}`,inline:true},
      )
    ]}).catch(() => {});
    await sleep(700);

    spinsLeft--;
  }

  return { totalGain, summary, multiplier };
}

// ─── Jeu principal ────────────────────────────────────────
async function playSlots(source, userId, guildId, mise, activeLines = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
  const jackpot = getJackpot(guildId);
  const totalMise = mise * activeLines;

  if (!u || u.balance < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${(u?.balance || 0).toLocaleString('fr-FR')} ${coin}** (mise totale : ${totalMise.toLocaleString('fr-FR')}).`;
    return isInteraction
      ? source.editReply({ content: err })
      : source.reply(err);
  }
  if (mise < 5) {
    const err = `❌ Mise minimale : **5 ${coin}** par ligne.`;
    return isInteraction
      ? source.editReply({ content: err })
      : source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);
  addToJackpot(guildId, Math.floor(totalMise * 0.02)); // 2% contribution au jackpot

  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12').setTitle('🎰 MACHINE ALMOSNI — 5 ROULEAUX')
    .setDescription('```\n   🍒 │ 🍋 │ 🍊 │ 🍇 │ 🍉\n➤ 🔔 │ ⭐ │ 7️⃣ │ 💎 │ 🃏 ◀\n   🎁 │ 🌠 │ 🎴 │ 🏆 │ 💣\n```\n*Lancement des rouleaux...*')
    .addFields(
      { name: '💰 Mise', value: `${totalMise.toLocaleString('fr-FR')} ${coin} (${activeLines} ligne${activeLines>1?'s':''})`, inline: true },
      { name: '🌟 Jackpot', value: `**${jackpot.toLocaleString('fr-FR')} ${coin}**`, inline: true },
    );

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [startEmbed], components: [] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  // WILD REEL FEATURE: 10% chance qu'un reel devienne entièrement WILD
  let grid = spinGrid();
  grid = applyWildReelFeature(grid);

  await animateSpin(msg, grid, coin, totalMise, jackpot);

  const { results, hasJackpot, scatterCount, bombCount, bonusCount, wins } = evalGridFull(grid, activeLines);

  let totalGain = 0;
  let color  = '#E74C3C';
  let title  = '🎰 MACHINE ALMOSNI 🎰';
  let desc   = '';
  let isJackpotWon = false;
  let isFreeSpins  = false;
  let isBonusGame  = false;
  let maxMultiplier = 0;

  const gridBase = gridDisplay(grid, null, activeLines);

  // ── JACKPOT ────────────────────────────────────────────
  if (hasJackpot) {
    isJackpotWon = true;
    const jp = getJackpot(guildId);
    totalGain = jp;
    resetJackpot(guildId);
    db.addCoins(userId, guildId, jp);
    color = '#FFD700'; title = '🏆 JACKPOT PROGRESSIF 🏆';
    desc  = `🎊 **FÉLICITATIONS !** Tu as décroché le **JACKPOT** !\n\n**+${jp.toLocaleString('fr-FR')} ${coin}** remportés !`;
    await animateJackpot(msg, jp, coin);
    await animateCoinRain(msg, color, title);

  // ── FREE SPINS (SCATTER ou BOMB) ──────────────────────
  } else if (scatterCount >= 3 || bombCount >= 3) {
    isFreeSpins = true;
    const isBomb = bombCount >= 3;
    const count = isBomb ? bombCount : scatterCount;
    const freeCount  = count === 3 ? 8 : count === 4 ? 12 : 20;
    const startMult  = count === 3 ? 1 : count === 4 ? 1.5 : 2;
    color = '#9B59B6'; title = `🎁 FREE SPINS × ${freeCount} 🎁`;

    const triggerType = isBomb ? `**${count} BOMBE** détectées` : `**${count} SCATTER** détectées`;
    await animateCoinRain(msg, color, title);
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#9B59B6')
      .setTitle(`🎁 FREE SPINS DÉCLENCHÉS ! × ${freeCount} 🎁`)
      .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n${triggerType} partout !\n${freeCount} tours gratuits · Multiplicateur de départ ×${startMult}`)
      .addFields({name:'💰 Mise initiale',value:`${totalMise.toLocaleString('fr-FR')} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(1500);

    const { totalGain: fg, summary } = await runFreeSpins(msg, userId, guildId, mise, coin, freeCount, startMult);
    totalGain = fg;
    desc = [`🎁 **FREE SPINS terminés !**`, ``, summary.slice(-8).join('\n'), ``, `**Total gagné : +${totalGain.toLocaleString('fr-FR')} ${coin}**`].join('\n');

  // ── BONUS MYSTERY BOX (3+ bonus) ──────────────────────
  } else if (bonusCount >= 3) {
    isBonusGame = true;
    color = '#E67E22'; title = '🎁 BONUS MYSTERY BOX 🎁';

    const prizes = [
      Math.floor(totalMise * (5 + Math.random() * 10)),
      Math.floor(totalMise * (2 + Math.random() * 5)),
      Math.floor(totalMise * (10 + Math.random() * 20)),
    ].sort(() => Math.random() - 0.5);

    bonusGames.set(`${userId}_${guildId}`, { prizes, mise, activeLines, claimed: false });

    await msg.edit({ embeds: [new EmbedBuilder().setColor('#E67E22')
      .setTitle('🎁 BONUS MYSTERY BOX 🎁')
      .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n🎁 **${bonusCount} BONUS** détectés !\nChoisis une des 3 boîtes mystère pour remporter ton prix !`)
      .addFields({name:'💰 Mise',value:`${totalMise.toLocaleString('fr-FR')} ${coin}`,inline:true})
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_bonus_${userId}_1`).setLabel('🎁 Boîte 1').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`slots_bonus_${userId}_2`).setLabel('🎁 Boîte 2').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`slots_bonus_${userId}_3`).setLabel('🎁 Boîte 3').setStyle(ButtonStyle.Primary),
    )]}).catch(() => {});

    addStats(userId, guildId, false, 0, false);
    return;

  // ── WINS NORMAUX ───────────────────────────────────────
  } else if (wins.length > 0) {
    for (const w of wins) {
      const g = Math.floor(mise * w.mult);
      totalGain += g;
      maxMultiplier = Math.max(maxMultiplier, w.mult);
    }

    const streak = trackStreak(userId, true);
    const streakMult = getStreakMultiplier(streak.current);
    if (streakMult > 1) totalGain = Math.floor(totalGain * streakMult);

    db.addCoins(userId, guildId, totalGain);

    const tier = getWinTier(totalGain, totalMise);
    color = tier?.color || '#2ECC71';
    title = tier?.label || '🎰 MACHINE ALMOSNI 🎰';

    desc = wins.map(w => {
      const paylineName = w.payline?.name || '?';
      const g = Math.floor(mise * w.mult);
      const w2bonus = w.wild2Count > 0 ? ' (Wild×2 !)' : '';
      return `**Ligne ${paylineName}** : ${w.count}× ${w.symbol.emoji} → +${g.toLocaleString('fr-FR')} ${coin}${w2bonus}`;
    }).join('\n');

    if (streak.current >= 3) {
      desc += `\n\n🔥 **Streak ×${streak.current} !** Bonus +${Math.round((streakMult-1)*100)}%`;
    }

    if (tier && tier.mega) {
      await animateMegaWin(msg, totalGain, coin, tier);
    } else if (tier && tier.delay > 0) {
      await animateWinTier(msg, tier);
    }
    if (totalGain > 0) await animateCoinRain(msg, color, title);

    // ── Cascading reels ─────────────────────────────────────
    let currentCascadeGrid = grid;
    let cascadeCount = 0;
    let cascadeGain = 0;
    const cascadeLog = [];

    for (let c = 0; c < 2; c++) {
      const newGrid = cascadeGrid(currentCascadeGrid, wins);
      if (!newGrid) break;
      const { wins: cWins, hasJackpot: cJp } = evalGridFull(newGrid, activeLines);
      if (cWins.length === 0 && !cJp) break;

      cascadeCount++;
      let cGain = 0;
      for (const w of cWins) cGain += Math.floor(mise * w.mult);
      if (cJp) {
        const jp2 = getJackpot(guildId); cGain = jp2; resetJackpot(guildId); db.addCoins(userId, guildId, jp2);
      } else if (cGain > 0) db.addCoins(userId, guildId, cGain);
      cascadeGain += cGain;
      cascadeLog.push(`Cascade ${cascadeCount}: +${cGain.toLocaleString('fr-FR')} ${coin}`);

      await msg.edit({ embeds: [new EmbedBuilder().setColor('#00BCD4')
        .setTitle(`⚡ CASCADE ${cascadeCount} ! +${cGain.toLocaleString('fr-FR')} ${coin}`)
        .setDescription(`\`\`\`\n${gridDisplay(newGrid, null, activeLines)}\n\`\`\`\n*Les symboles gagnants s'effondrent !*`)
        .addFields({name:'💰 Cascade gain',value:`+${cGain.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ]}).catch(() => {});
      await sleep(750);
      currentCascadeGrid = newGrid;
    }

    if (cascadeCount > 0) {
      totalGain += cascadeGain;
      desc += `\n\n⚡ **${cascadeCount} CASCADE${cascadeCount>1?'S':''}** ! ${cascadeLog.join(' | ')}`;
    }

  } else {
    trackStreak(userId, false);
    let nearMiss = null;
    for (const res of results) {
      const cells = res.payline.rows.map((row, col) => grid[col][row]);
      const counts = {};
      for (const c of cells) {
        if (c.id === 'wild' || c.id === 'wild2' || c.id === 'scatter' || c.id === 'bonus' || c.id === 'bomb') continue;
        counts[c.id] = (counts[c.id] || 0) + 1;
      }
      const best = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
      if (best && best[1] === 2) {
        nearMiss = SYMBOLS.find(s => s.id === best[0]);
        break;
      }
    }

    if (nearMiss) {
      for (const [c, t, txt] of [
        ['#F39C12','🎰 PRESQUE ! 🎰',`😱 Deux ${nearMiss.emoji}... mais pas trois !`],
        ['#E67E22','💔 Si proche !',`La chance te fuit d'un souffle...`],
        ['#D35400','🍀 Prochaine fois !',`Continue, le jackpot t'attend !`],
      ]) {
        await msg.edit({ embeds: [new EmbedBuilder().setColor(c).setTitle(t)
          .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n${txt}`)
        ]}).catch(() => {});
        await sleep(400);
      }
      desc = `💔 **Presque !** Deux ${nearMiss.emoji} mais pas trois...\nRetente ta chance !`;
    } else {
      desc = '😔 Pas de combinaison gagnante. Retente ta chance !';
    }
  }

  trackSession(userId, totalGain > 0 ? totalGain : -totalMise, totalMise);
  if (!isFreeSpins && !isJackpotWon) trackStreak(userId, totalGain > 0);
  addStats(userId, guildId, totalGain > 0, totalGain, isJackpotWon);

  const session = getSession(userId);
  const netSession = session.gains - session.losses;
  const rtp = session.totalWagered > 0 ? ((session.gains / session.totalWagered) * 100).toFixed(1) : 0;
  const currentStreak = streakStats.get(userId) || { current: 0 };
  const newBalance = db.getUser(userId, guildId)?.balance || 0;

  // Paytable compact dans l'embed
  const paytableCompact = `💎×5=${(SYMBOLS.find(s=>s.id==='diamond')?.value * 8) || '?'} | 🏆×5=50 | ⭐×3=20 | 🃏=WILD`;

  const plNames = PAYLINES.slice(0, activeLines).map(p => p.name).join(' · ');

  const finalEmbed = new EmbedBuilder()
    .setColor(color).setTitle(title)
    .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n${desc}`)
    .addFields(
      { name: '💰 Mise', value: `${totalMise.toLocaleString('fr-FR')} ${coin}`, inline: true },
      { name: totalGain > 0 ? '✅ Gain' : '❌ Perte',
        value: `${totalGain > 0 ? '+' : '-'}${(totalGain > 0 ? totalGain : totalMise).toLocaleString('fr-FR')} ${coin}`, inline: true },
      { name: '🌟 Jackpot', value: `${getJackpot(guildId).toLocaleString('fr-FR')} ${coin}`, inline: true },
    );

  if (maxMultiplier > 0) finalEmbed.addFields({ name: '🎰 Multiplicateur', value: `×${maxMultiplier}`, inline: true });
  if (currentStreak.current >= 2) finalEmbed.addFields({ name: '🔥 Streak', value: `${currentStreak.current}×`, inline: true });
  if (session.biggestWin > 0) finalEmbed.addFields({ name: '🏅 Meilleur gain', value: `${session.biggestWin.toLocaleString('fr-FR')} ${coin}`, inline: true });

  finalEmbed.addFields(
    { name: '📊 Paytable', value: paytableCompact, inline: false },
    { name: '📈 Session Stats', value: `RTP: ${rtp}% | Net: ${netSession >= 0 ? '+' : ''}${netSession.toLocaleString('fr-FR')} | Spins: ${session.spins}`, inline: false }
  );

  finalEmbed
    .setFooter({ text: `Solde: ${newBalance.toLocaleString('fr-FR')} ${coin} · Lignes: ${plNames}` })
    .setTimestamp();

  // ── Boutons action ─────────────────────────────────────
  const rows = [];
  const allInMise = Math.floor(newBalance / activeLines);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise}_${activeLines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`slots_changemise_${userId}_${activeLines}`).setLabel('💰 Changer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`slots_maxmise_${userId}_${Math.min(newBalance, 10000)}_${activeLines}`).setLabel(`💎 Max`).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`slots_paytable_${userId}`).setLabel('📊 Paytable').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`slots_allin_${userId}_${activeLines}`).setLabel('🎲 All-In').setStyle(ButtonStyle.Danger).setDisabled(allInMise < 5),
  );
  rows.push(row1);

  const row2Btns = [];
  if (totalGain > 0 && !isJackpotWon && !isFreeSpins) {
    row2Btns.push(
      new ButtonBuilder().setCustomId(`slots_gamble_${userId}_${totalGain}_rouge`).setLabel(`🔴 ×2`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`slots_gamble_${userId}_${totalGain}_or`).setLabel(`🥇 ×4 (25%)`).setStyle(ButtonStyle.Danger),
    );
  }

  // JACKPOT ROOM: 10× mise avec 2× chances jackpot
  if (newBalance >= mise * 10 * activeLines) {
    row2Btns.push(
      new ButtonBuilder().setCustomId(`slots_jackpotroom_${userId}_${mise * 10}_${activeLines}`).setLabel('💎 JACKPOT ROOM').setStyle(ButtonStyle.Primary),
    );
  }

  row2Btns.push(
    new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${activeLines}_5`).setLabel('⚡ ×5').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${activeLines}_10`).setLabel('⚡ ×10').setStyle(ButtonStyle.Secondary),
  );

  if (row2Btns.length > 0) {
    for (let i = 0; i < row2Btns.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(row2Btns.slice(i, i + 5)));
    }
  }

  await msg.edit({ embeds: [finalEmbed], components: rows });
}

// ─── Auto-Spin ──────────────────────────────────────────
async function runAutoSpin(msg, userId, guildId, mise, activeLines, count, coin) {
  let totalNet = 0;
  let wins = 0, losses = 0;
  let biggestWin = 0;
  const totalMise = mise * activeLines;

  for (let i = 0; i < count; i++) {
    const u = db.getUser(userId, guildId);
    if (!u || u.balance < totalMise) break;

    db.addCoins(userId, guildId, -totalMise);
    addToJackpot(guildId, Math.floor(totalMise * 0.02));

    const grid = spinGrid();
    const { wins: lineWins, hasJackpot, scatterCount } = evalGridFull(grid, activeLines);

    let spinGain = 0;
    if (hasJackpot) {
      const jp = getJackpot(guildId); spinGain = jp; resetJackpot(guildId); db.addCoins(userId, guildId, jp);
    } else if (scatterCount >= 3) {
      const freeCount = scatterCount === 3 ? 5 : scatterCount === 4 ? 8 : 12;
      for (let f = 0; f < freeCount; f++) {
        const fg = spinGrid();
        const { wins: fw } = evalGridFull(fg, activeLines);
        for (const w of fw) { const g = Math.floor(mise * w.mult); spinGain += g; db.addCoins(userId, guildId, g); }
      }
    } else {
      for (const w of lineWins) { const g = Math.floor(mise * w.mult); spinGain += g; }
      if (spinGain > 0) db.addCoins(userId, guildId, spinGain);
    }

    const net = spinGain > 0 ? spinGain : -totalMise;
    totalNet += net;
    if (spinGain > 0) { wins++; biggestWin = Math.max(biggestWin, spinGain); }
    else losses++;

    if ((i + 1) % 5 === 0 || i === count - 1) {
      const bal = db.getUser(userId, guildId)?.balance || 0;
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`⚡ AUTO-SPIN ${i+1}/${count}`)
        .setDescription(`*Spins automatiques en cours...*`)
        .addFields(
          {name:'✅ Gains',value:`${wins}`,inline:true},
          {name:'❌ Pertes',value:`${losses}`,inline:true},
          {name:'📊 Net',value:`${totalNet >= 0 ? '+' : ''}${totalNet.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'🏅 Meilleur',value:`${biggestWin.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'💳 Solde',value:`${bal.toLocaleString('fr-FR')} ${coin}`,inline:true},
        )
      ], components: [] }).catch(() => {});
      await sleep(500);
    } else {
      await sleep(150);
    }
  }

  const finalBal = db.getUser(userId, guildId)?.balance || 0;
  return { totalNet, wins, losses, biggestWin, finalBal };
}

// ─── Handle Component ──────────────────────────────────────
async function handleComponent(interaction) {
  const cid     = interaction.customId;
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  // ── Boutons casino classique ────────────────────────────
  if (cid.startsWith('cslot_')) {
    const ownerId = cid.split(':')[1];
    if (ownerId && ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    let mise = 100;
    try { const sess = db.kvGet && db.kvGet(guildId, `cslot:${userId}`); if (sess?.mise) mise = sess.mise; } catch {}
    if (cid.startsWith('cslot_quit')) {
      await interaction.deferUpdate().catch(() => {});
      await interaction.editReply({ content: '👋 Tu as quitté la machine.', embeds: [], components: [] }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const source = { editReply: (d) => msgRef.edit(d), deferred: true };
    await playSlots(source, userId, guildId, mise, 1);
    return true;
  }

  // ── Mise Max ──────────────────────────────────────────
  if (cid.startsWith('slots_maxmise_')) {
    const parts = cid.split('_');
    const ownerId = parts[2];
    const maxMise = parseInt(parts[3]);
    const lines   = parseInt(parts[4]) || 1;
    if (ownerId !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    await playSlots({ editReply: d => msgRef.edit(d), deferred: true }, userId, guildId, maxMise, lines);
    return true;
  }

  // ── Rejouer ───────────────────────────────────────────
  if (cid.startsWith('slots_replay_')) {
    const parts = cid.split('_');
    const ownerId = parts[2];
    if (ownerId !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    const newMise  = parseInt(parts[3]);
    const newLines = parseInt(parts[4]) || 1;
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    await playSlots({ editReply: d => msgRef.edit(d), deferred: true }, userId, guildId, newMise, newLines);
    return true;
  }

  // ── Changer la mise ───────────────────────────────────
  if (cid.startsWith('slots_changemise_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const lines   = parseInt(parts[3]) || 1;
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.showModal(changeMiseModal('slots', userId, `${lines}`));
    return true;
  }

  // ── Modal mise ────────────────────────────────────────
  if (cid.startsWith('slots_modal_') && interaction.isModalSubmit()) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const lines   = parseInt(parts[3]) || 1;
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce modal n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 5) {
      await interaction.reply({ content: '❌ Mise invalide (min 5 par ligne).', ephemeral: true }).catch(() => {});
      return true;
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playSlots(interaction, userId, guildId, newMise, lines);
    return true;
  }

  // ── Gamble Rouge (×2) ──────────────────────────────────
  if (cid.startsWith('slots_gamble_') && cid.endsWith('_rouge')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const amount  = parseInt(parts[3]);
    if (ownerId !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const won  = Math.random() < 0.5;
    if (won) {
      db.addCoins(userId, guildId, amount);
      trackSession(userId, amount, 0);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🔴 GAMBLE → 🎊 DOUBLÉ !')
        .setDescription(`🍀 Tu as doublé ton gain !\n\n**+${amount.toLocaleString('fr-FR')} ${coin}** supplémentaires !`)
        .addFields({name:'💳 Solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ], components: [] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount);
      trackSession(userId, -amount, 0);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔴 GAMBLE → 💸 PERDU !')
        .setDescription(`😔 Malchance !\n\n**-${amount.toLocaleString('fr-FR')} ${coin}**`)
        .addFields({name:'💳 Solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ], components: [] }).catch(() => {});
    }
    return true;
  }

  // ── Gamble Or (×4, 25%) ────────────────────────────────
  if (cid.startsWith('slots_gamble_') && cid.endsWith('_or')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const amount  = parseInt(parts[3]);
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const won  = Math.random() < 0.25;
    if (won) {
      const gain = amount * 3;
      db.addCoins(userId, guildId, gain);
      trackSession(userId, gain, 0);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🥇 GAMBLE OR → ⚡ ×4 !!')
        .setDescription(`🌟 INCROYABLE !\n\n**+${gain.toLocaleString('fr-FR')} ${coin}**`)
        .addFields({name:'💳 Solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ], components: [] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount);
      trackSession(userId, -amount, 0);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🥇 GAMBLE OR → 💸 PERDU !')
        .setDescription(`😔 25% c'était trop risqué...\n\n**-${amount.toLocaleString('fr-FR')} ${coin}**`)
        .addFields({name:'💳 Solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ], components: [] }).catch(() => {});
    }
    return true;
  }

  // ── Bonus Mystery Box ─────────────────────────────────
  if (cid.startsWith('slots_bonus_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const pick    = parseInt(parts[3]);
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    const bonusKey = `${userId}_${guildId}`;
    const game = bonusGames.get(bonusKey);
    if (!game || game.claimed) {
      await interaction.reply({ content: '❌ Ce bonus a déjà été réclamé.', ephemeral: true }).catch(() => {});
      return true;
    }
    game.claimed = true;
    await interaction.deferUpdate().catch(() => {});
    const msgRef  = interaction.message;
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const prize = game.prizes[pick - 1];
    db.addCoins(userId, guildId, prize);
    trackSession(userId, prize, 0);
    const nb = db.getUser(userId, guildId)?.balance || 0;

    const reveals = game.prizes.map((p, i) =>
      `🎁 Boîte ${i+1}: **${p.toLocaleString('fr-FR')} ${coin}**${i === pick-1 ? ' ← ✅' : ''}`
    ).join('\n');

    await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E67E22')
      .setTitle(`🎁 BONUS — +${prize.toLocaleString('fr-FR')} ${coin}`)
      .setDescription(`Tu as ouvert la **Boîte ${pick}** !\n\n${reveals}`)
      .addFields({name:'💳 Solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true})
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_replay_${userId}_${game.mise}_${game.activeLines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
    )] }).catch(() => {});

    addStats(userId, guildId, true, prize, false);
    bonusGames.delete(bonusKey);
    return true;
  }

  // ── Paytable ──────────────────────────────────────────
  if (cid.startsWith('slots_paytable_')) {
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const jp   = getJackpot(guildId);
    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('📊 PAYTABLE COMPLET')
      .setDescription(
        `**SYMBOLES PAYANTS (×3 / ×4 / ×5)**\n` +
        `🍒 Cerise: 2 / 6 / 16\n` +
        `🍋 Citron: 3 / 9 / 24\n` +
        `🍊 Orange: 4 / 12 / 32\n` +
        `🍇 Raisin: 5 / 15 / 40\n` +
        `🍉 Melon: 8 / 24 / 64\n` +
        `🔔 Cloche: 10 / 30 / 80\n` +
        `⭐ Étoile: 20 / 60 / 160\n` +
        `7️⃣ Sept: 25 / 75 / 200\n` +
        `💎 Diamant: 40 / 120 / 320\n` +
        `🏆 Trophée: 50 / 150 / 400\n\n` +
        `**SYMBOLES SPÉCIAUX**\n` +
        `🃏 WILD — Substitue tout\n` +
        `🎴 WILD×2 — Substitue + ×2 multiplicateur\n` +
        `🌠 SCATTER — 3+ = Free Spins (8-20)\n` +
        `💣 BOMBE — 3+ = Triple Free Spins\n` +
        `🎁 BONUS — 3+ = Mystery Box\n` +
        `🃏×5 JACKPOT — Quintuple WILD = **${jp.toLocaleString('fr-FR')} ${coin}**`
      )
      .addFields(
        { name: '⚡ Features', value: '• Wild Reel (10%)\n• Cascading Reels\n• Streak Bonus (+10% à ×10)\n• Jackpot Progressif', inline: false }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    return true;
  }

  // ── All-In ────────────────────────────────────────────
  if (cid.startsWith('slots_allin_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const lines   = parseInt(parts[3]) || 1;
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const u2 = db.getUser(userId, guildId);
    const allInMise2 = Math.floor((u2?.balance || 0) / lines);
    if (!allInMise2 || allInMise2 < 5) {
      await interaction.editReply({ content: '❌ Solde insuffisant.', ephemeral: true }).catch(() => {});
      return true;
    }
    const msgRef = interaction.message;
    await playSlots({ editReply: d => msgRef.edit(d), deferred: true }, userId, guildId, allInMise2, lines);
    return true;
  }

  // ── JACKPOT ROOM: ×10 mise avec 2× chances jackpot ───
  if (cid.startsWith('slots_jackpotroom_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const mise    = parseInt(parts[3]);
    const lines   = parseInt(parts[4]) || 1;
    if (ownerId !== userId) {
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;

    // Spin avec jackpot boost (2× chances)
    const u = db.getUser(userId, guildId);
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
    const totalMise = mise * lines;

    if (!u || u.balance < totalMise) {
      await interaction.editReply({ content: `❌ Solde insuffisant (${totalMise.toLocaleString('fr-FR')} ${coin} requis).`, ephemeral: true }).catch(() => {});
      return true;
    }

    db.addCoins(userId, guildId, -totalMise);
    addToJackpot(guildId, Math.floor(totalMise * 0.02));

    const embed = new EmbedBuilder()
      .setColor('#FF00FF')
      .setTitle('💎 JACKPOT ROOM — SPIN PREMIUM 💎')
      .setDescription(`*Spin ×${mise / Math.floor(mise / 10)}× avec **2× chances jackpot !***`)
      .addFields({ name: '💰 Mise', value: `${totalMise.toLocaleString('fr-FR')} ${coin}`, inline: true });

    await msgRef.edit({ embeds: [embed] }).catch(() => {});
    await sleep(1500);

    // Spin normal mais avec boost jackpot (simule 2× chances)
    const grid = spinGrid();
    const { hasJackpot, wins } = evalGridFull(grid, lines);

    if (hasJackpot || Math.random() < 0.1) { // 10% chance bonus jackpot
      const jp = getJackpot(guildId);
      const gain = jp * 2; // Double pour jackpot room
      db.addCoins(userId, guildId, gain);
      resetJackpot(guildId);
      trackSession(userId, gain, totalMise);
      addStats(userId, guildId, true, gain, true);

      await animateJackpot(msgRef, gain, coin);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder()
        .setColor('#FF00FF')
        .setTitle('💎 JACKPOT ROOM — GAGNÉ! 💎')
        .setDescription(`🏆 **+${gain.toLocaleString('fr-FR')} ${coin}** (×2 boost)\n\nFortune déverrouillée dans la Salle Premium!`)
        .addFields({ name: '💳 Solde', value: `${nb.toLocaleString('fr-FR')} ${coin}`, inline: true })
      ], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise / 10}_${lines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      )] }).catch(() => {});
    } else {
      let gain = 0;
      for (const w of wins) gain += Math.floor((mise / 10) * w.mult);
      if (gain > 0) db.addCoins(userId, guildId, gain);
      trackSession(userId, gain > 0 ? gain : -totalMise, totalMise);
      addStats(userId, guildId, gain > 0, gain, false);

      const display = gridDisplay(grid, null, lines);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder()
        .setColor(gain > 0 ? '#2ECC71' : '#E74C3C')
        .setTitle(gain > 0 ? '✨ Petit gain' : '💔 Pas de jackpot')
        .setDescription(`\`\`\`\n${display}\n\`\`\`\n${gain > 0 ? `**+${gain.toLocaleString('fr-FR')} ${coin}**` : 'Réessaye!'}`)
        .addFields({ name: '💳 Solde', value: `${nb.toLocaleString('fr-FR')} ${coin}`, inline: true })
      ], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise / 10}_${lines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      )] }).catch(() => {});
    }
    return true;
  }

  // ── Auto-Spin ─────────────────────────────────────────
  if (cid.startsWith('slots_autospin_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const mise    = parseInt(parts[3]);
    const lines   = parseInt(parts[4]) || 1;
    const count   = parseInt(parts[5]) || 5;
    if (ownerId !== userId) {
      await interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    const u = db.getUser(userId, guildId);
    if (!u || u.balance < mise * lines) {
      await interaction.reply({ content: '❌ Solde insuffisant.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const coin   = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

    const { totalNet, wins: w, losses: l, biggestWin: bw, finalBal } = await runAutoSpin(msgRef, userId, guildId, mise, lines, count, coin);

    const color = totalNet >= 0 ? '#2ECC71' : '#E74C3C';
    await msgRef.edit({ embeds: [new EmbedBuilder().setColor(color)
      .setTitle(`⚡ AUTO-SPIN ×${count} ✅`)
      .setDescription(`**${w} gains** | **${l} pertes**`)
      .addFields(
        {name:'📊 Net',value:`${totalNet >= 0?'+':''}${totalNet.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🏅 Meilleur',value:`${bw.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'💳 Solde',value:`${finalBal.toLocaleString('fr-FR')} ${coin}`,inline:true},
      )
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise}_${lines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${lines}_${count}`).setLabel(`⚡ ×${count} à nouveau`).setStyle(ButtonStyle.Secondary),
    )] }).catch(() => {});
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous époustouflante — Grille 5×3 | Free Spins | Jackpot Progressif!')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise par ligne (min 5)').setRequired(true).setMinValue(5))
    .addIntegerOption(o => o
      .setName('lignes').setDescription('Paylines (1-5, défaut 1)').setMinValue(1).setMaxValue(5)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise   = interaction.options.getInteger('mise');
    const lignes = interaction.options.getInteger('lignes') || 1;
    await playSlots(interaction, interaction.user.id, interaction.guildId, mise, lignes);
  },

  name: 'slots',
  aliases: ['slot', 'machine', 'jackpot'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    const lignes  = Math.min(5, Math.max(1, parseInt(args[1]) || 1));
    if (!rawMise) return message.reply('❌ Usage : `&slots <mise> [lignes 1-5]`\nEx: `&slots 100 3`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if      (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 5) return message.reply('❌ Mise min 5. Ex: `&slots 100 3`');
    await playSlots(message, message.author.id, message.guildId, mise, lignes);
  },

  handleComponent,
};
