// ============================================================
// slots.js — Machine à sous 5 rouleaux ULTRA-PREMIUM (v6)
// Nouveautés : Wild×2, Scatter, 5 paylines + diagonales,
//              Cascading reels, Win Tiers, Gamble+, Auto-Spin,
//              Bonus Mystery Box, Streak bonus, Animations enrichies
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── Maps de session en mémoire ──────────────────────────
const sessionStats = new Map(); // userId → {gains, losses, spins, biggestWin}
const streakStats  = new Map(); // userId → {current, best}
const bonusGames   = new Map(); // `${userId}_${guildId}` → {prizes, mise, lines, msgId}

// ─── Symboles & poids ─────────────────────────────────────
const SYMBOLS = [
  { id: 'cherry',  emoji: '🍒', name: 'Cerise',   weight: 28, value: 2  },
  { id: 'lemon',   emoji: '🍋', name: 'Citron',   weight: 22, value: 3  },
  { id: 'orange',  emoji: '🍊', name: 'Orange',   weight: 18, value: 4  },
  { id: 'grape',   emoji: '🍇', name: 'Raisin',   weight: 14, value: 5  },
  { id: 'melon',   emoji: '🍉', name: 'Melon',    weight: 9,  value: 8  },
  { id: 'bell',    emoji: '🔔', name: 'Cloche',   weight: 7,  value: 10 },
  { id: 'star',    emoji: '⭐', name: 'Étoile',   weight: 5,  value: 15 },
  { id: 'seven',   emoji: '7️⃣', name: 'Sept',     weight: 3,  value: 25 },
  { id: 'diamond', emoji: '💎', name: 'Diamant',  weight: 2,  value: 50 },
  { id: 'wild',    emoji: '🃏', name: 'WILD',     weight: 3,  value: 0  }, // substitue tout
  { id: 'wild2',   emoji: '🎴', name: 'WILD×2',   weight: 1,  value: 0  }, // substitue + double
  { id: 'scatter', emoji: '🌠', name: 'SCATTER',  weight: 2,  value: 0  }, // paie partout
  { id: 'bonus',   emoji: '🎁', name: 'BONUS',    weight: 1,  value: 0  }, // mystery box
];
const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

// ─── 5 Paylines pour grille 5×3 ──────────────────────────
// rows[col] = index de rangée (0=haut, 1=milieu, 2=bas)
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
function trackSession(userId, netGain) {
  const s = sessionStats.get(userId) || { gains: 0, losses: 0, spins: 0, biggestWin: 0 };
  s.spins++;
  if (netGain > 0) { s.gains += netGain; s.biggestWin = Math.max(s.biggestWin, netGain); }
  else s.losses += Math.abs(netGain);
  sessionStats.set(userId, s);
}
function getSession(userId) {
  return sessionStats.get(userId) || { gains: 0, losses: 0, spins: 0, biggestWin: 0 };
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
function gridDisplay(grid, highlightRows = null) {
  return [0, 1, 2].map(row => {
    const line = grid.map(col => col[row].emoji).join(' ');
    if (highlightRows && highlightRows.includes(row)) return `▶ ${line} ◀`;
    return `  ${line}  `;
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
    if (c.id === 'wild' || c.id === 'wild2' || c.id === 'scatter' || c.id === 'bonus') continue;
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
  const bonusCount   = allCells.filter(c => c.id === 'bonus').length;

  const hasJackpot = results.some(r => r.type === 'jackpot');
  const wins = results.filter(r => r.type === 'win');

  return { results, hasJackpot, scatterCount, bonusCount, wins };
}

// ─── Cascading reels ─────────────────────────────────────
function cascadeGrid(grid, winResults) {
  // Identifier les cellules gagnantes (positions payline qui ont gagné)
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

  // Créer une nouvelle grille avec remplacement des gagnants
  const newGrid = grid.map((col, ci) =>
    col.map((sym, ri) => {
      if (toReplace.has(`${ci}_${ri}`)) return spinReel();
      return sym;
    })
  );
  return newGrid;
}

// ─── Win Tier ─────────────────────────────────────────────
function getWinTier(gain, mise) {
  const ratio = gain / mise;
  if (ratio >= 100) return { label: '🌟 LEGENDARY WIN !! 🌟', color: '#FF00FF', delay: 1000 };
  if (ratio >= 50)  return { label: '🔥 EPIC WIN !!',         color: '#FF4500', delay: 900  };
  if (ratio >= 25)  return { label: '⚡ SUPER WIN !',         color: '#FFD700', delay: 800  };
  if (ratio >= 10)  return { label: '💥 MEGA WIN !',          color: '#FF8C00', delay: 700  };
  if (ratio >= 5)   return { label: '🎊 BIG WIN !',           color: '#00FF7F', delay: 600  };
  if (ratio >= 1)   return { label: '✅ GAIN !',              color: '#2ECC71', delay: 0    };
  return null;
}

// ─── Animations ──────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateSpin(msg, grid, coin, mise, jackpot) {
  const SYM = ['🍒','🍋','🍊','🍇','🍉','🔔','⭐','7️⃣','💎','🃏','🌠','🎴'];
  const rndRow = () => Array.from({ length: 5 }, () => SYM[Math.floor(Math.random()*SYM.length)]);

  // 2 frames démarrage
  for (const [color, text] of [['#F39C12','⚡ Les rouleaux démarrent !'],['#E67E22','🌀 En pleine rotation !']]) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n  ${rndRow().join(' ')}\n  ${rndRow().join(' ')}\n  ${rndRow().join(' ')}\n\`\`\`\n*${text}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true},{name:'🏆 Jackpot',value:`${jackpot} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(620);
  }

  // 2 frames ralentissement
  for (const [color, text] of [['#7D3C98','🔄 Ça ralentit...'],['#5B2C7D','⏳ Derniers symboles...']]) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n  ${rndRow().join(' ')}\n  ${rndRow().join(' ')}\n  ${rndRow().join(' ')}\n\`\`\`\n*${text}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(660);
  }

  // Révélation rouleau par rouleau
  const partial = Array.from({length:5}, () => Array.from({length:3}, () => ({emoji:'🌀'})));
  const stopColors = ['#6C3483','#1A5276','#1E8449','#117A65','#27AE60'];
  for (let col = 0; col < 5; col++) {
    partial[col] = grid[col];
    const rows = [0,1,2].map(r => partial.map(c => c[r]?.emoji || '🌀').join(' '));
    const rem = 4 - col;
    const txt = rem > 0 ? `🌀 ${rem} rouleau${rem>1?'x':''} encore...` : '✅ Tous arrêtés !';
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(stopColors[col]).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n  ${rows[0]}\n  ${rows[1]}\n  ${rows[2]}\n\`\`\`\n*${txt}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(col < 4 ? 630 : 350);
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
    ['#FFD700', '🎊 JACKPOT !! 🎊', `+${amount} ${coin}`],
    ['#FFA500', '🏆 JACKPOT PROGRESSIF ! 🏆', `*Fortune décrochée !*`],
    ['#FFD700', '🌟 LÉGENDAIRE 🌟', `+${amount.toLocaleString('fr-FR')} ${coin}`],
  ];
  for (const [color, title, desc] of frames) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle(title)
      .setDescription('```\n' + '='.repeat(30) + '\n  🏆  JACKPOT JACKPOT  🏆\n' + '='.repeat(30) + '\n```\n' + desc)
    ]}).catch(() => {});
    await sleep(750);
  }
}

async function animateCoinRain(msg, color, title) {
  const frames = ['💰 💸 💶 🪙', '🪙 💰 💸 💶 💰', '💸 💶 🪙 💰 💸 💶'];
  const texts  = ['*🌧️ Les euros pleuvent !*', '*💨 TEMPÊTE DE GAINS !!*', '*💰 FORTUNE DÉVERSÉE !!*'];
  for (let i = 0; i < 3; i++) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle(title)
      .setDescription(`${frames[i]}\n\n${texts[i]}`)
    ]}).catch(() => {});
    await sleep(700);
  }
}

// ─── Free Spins avec multiplicateur progressif ────────────
async function runFreeSpins(msg, userId, guildId, mise, coin, freeCount, startMult) {
  let totalGain = 0;
  let multiplier = startMult;
  const summary = [];

  for (let s = 0; s < freeCount; s++) {
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#9B59B6')
      .setTitle(`🌠 FREE SPIN ${s+1}/${freeCount} — ×${multiplier} 🌠`)
      .setDescription('```\n  🌀 🌀 🌀 🌀 🌀\n  🌀 🌀 🌀 🌀 🌀\n  🌀 🌀 🌀 🌀 🌀\n```\n*Spin gratuit en cours...*')
      .addFields({name:'💰 Gain accumulé',value:`${totalGain} ${coin}`,inline:true},{name:'🎯 Multiplicateur',value:`×${multiplier}`,inline:true})
    ]}).catch(() => {});
    await sleep(700);

    const freeGrid = spinGrid();
    const { wins, hasJackpot, scatterCount } = evalGridFull(freeGrid, 5);

    // Scatters supplémentaires pendant free spins = +2 spins
    let bonusSpins = scatterCount >= 3 ? 2 : 0;

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
    if (spinGain > 0) { multiplier = Math.min(10, multiplier + 1); }

    const rowsDisplay = gridDisplay(freeGrid);
    const spinLabel = spinGain > 0
      ? `+${spinGain.toLocaleString('fr-FR')} ${coin} (×${multiplier})`
      : '—';
    summary.push(`Spin ${s+1}: ${spinLabel}${bonusSpins > 0 ? ` +${bonusSpins} spins bonus!` : ''}`);

    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(spinGain > 0 ? '#2ECC71' : '#7F8C8D')
      .setTitle(`🌠 FREE SPIN ${s+1}/${freeCount} — ${spinGain > 0 ? `+${spinGain.toLocaleString('fr-FR')} ${coin}` : 'Pas de gain'}`)
      .setDescription(`\`\`\`\n${rowsDisplay}\n\`\`\``)
      .addFields(
        {name:'💰 Gain accumulé',value:`${totalGain.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🎯 Multiplicateur',value:`×${multiplier}`,inline:true},
      )
    ]}).catch(() => {});
    await sleep(750);

    if (bonusSpins > 0) freeCount += bonusSpins;
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
    const err = '❌ Mise minimale : **5 coins** par ligne.';
    return isInteraction
      ? source.editReply({ content: err })
      : source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);
  addToJackpot(guildId, Math.floor(totalMise * 0.02));

  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12').setTitle('🎰 SLOT MACHINE ROYALE 🎰')
    .setDescription('```\n  🍒 🍋 🍊 🍇 🍉\n  🔔 ⭐ 7️⃣ 💎 🃏\n  🎁 🌠 🎴 🍒 🍋\n```\n*Lancement des rouleaux...*')
    .addFields(
      { name: '💰 Mise', value: `${totalMise.toLocaleString('fr-FR')} ${coin} (${activeLines} ligne${activeLines>1?'s':''})`, inline: true },
      { name: '🏆 Jackpot', value: `**${jackpot.toLocaleString('fr-FR')} ${coin}**`, inline: true },
    );

  let msg;
  if (isInteraction) {
    if (!source.deferred && !source.replied) await source.deferReply().catch(() => {});
    msg = await source.editReply({ embeds: [startEmbed], components: [] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  const grid = spinGrid();
  await animateSpin(msg, grid, coin, totalMise, jackpot);

  const { results, hasJackpot, scatterCount, bonusCount, wins } = evalGridFull(grid, activeLines);

  let totalGain = 0;
  let color  = '#E74C3C';
  let title  = '🎰 SLOT MACHINE ROYALE 🎰';
  let desc   = '';
  let isJackpotWon = false;
  let isFreeSpins  = false;
  let isBonusGame  = false;
  let maxMultiplier = 0;

  // Grille de base
  const gridBase = gridDisplay(grid);

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

  // ── SCATTER FREE SPINS ─────────────────────────────────
  } else if (scatterCount >= 3) {
    isFreeSpins = true;
    const freeCount  = scatterCount === 3 ? 8 : scatterCount === 4 ? 12 : 20;
    const startMult  = scatterCount === 3 ? 1 : scatterCount === 4 ? 2 : 3;
    color = '#9B59B6'; title = `🌠 FREE SPINS × ${freeCount} 🌠`;
    await animateCoinRain(msg, color, title);
    await msg.edit({ embeds: [new EmbedBuilder().setColor('#9B59B6')
      .setTitle(`🌠 FREE SPINS DÉCLENCHÉS ! × ${freeCount} 🌠`)
      .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n🌠 **${scatterCount} SCATTER** détectés partout !\n${freeCount} tours gratuits · Multiplicateur de départ ×${startMult} (augmente à chaque win)`)
      .addFields({name:'💰 Mise initiale',value:`${totalMise.toLocaleString('fr-FR')} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(1500);

    const { totalGain: fg, summary, multiplier: finalMult } = await runFreeSpins(msg, userId, guildId, mise, coin, freeCount, startMult);
    totalGain = fg;
    desc = [`🌠 **FREE SPINS terminés !**`, ``, summary.slice(-8).join('\n'), ``, `**Total gagné : +${totalGain.toLocaleString('fr-FR')} ${coin}**`, `Multiplicateur final : ×${finalMult}`].join('\n');

  // ── BONUS MYSTERY BOX (3+ bonus) ──────────────────────
  } else if (bonusCount >= 3) {
    isBonusGame = true;
    color = '#E67E22'; title = '🎁 BONUS MYSTERY BOX 🎁';

    // Générer 3 prix mystères
    const prizes = [
      Math.floor(totalMise * (5 + Math.random() * 10)),
      Math.floor(totalMise * (2 + Math.random() * 5)),
      Math.floor(totalMise * (10 + Math.random() * 20)),
    ].sort(() => Math.random() - 0.5); // mélanger l'ordre

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

    // Ne pas continuer — le gain sera traité dans handleComponent
    addStats(userId, guildId, false, 0, false);
    return;

  // ── WINS NORMAUX ───────────────────────────────────────
  } else if (wins.length > 0) {
    // Calcul du gain de base
    for (const w of wins) {
      const g = Math.floor(mise * w.mult);
      totalGain += g;
      maxMultiplier = Math.max(maxMultiplier, w.mult);
    }

    // Streak bonus
    const streak = trackStreak(userId, true);
    const streakMult = getStreakMultiplier(streak.current);
    if (streakMult > 1) totalGain = Math.floor(totalGain * streakMult);

    db.addCoins(userId, guildId, totalGain);

    const tier = getWinTier(totalGain, totalMise);
    color = tier?.color || '#2ECC71';
    title = tier?.label || '🎰 SLOT MACHINE ROYALE 🎰';

    desc = wins.map(w => {
      const paylineName = w.payline?.name || '?';
      const g = Math.floor(mise * w.mult);
      const w2bonus = w.wild2Count > 0 ? ' (Wild×2 !)' : '';
      return `**Ligne ${paylineName}** : ${w.count}× ${w.symbol.emoji} ${w.symbol.name} → +${g.toLocaleString('fr-FR')} ${coin}${w2bonus}`;
    }).join('\n');

    if (streak.current >= 3) {
      desc += `\n\n🔥 **Streak ×${streak.current} !** Bonus +${Math.round((streakMult-1)*100)}% appliqué !`;
    }
    if (streak.best >= 5) desc += `\n🏅 Meilleur streak : **${streak.best}** consécutifs !`;

    if (tier && tier.delay > 0) await animateWinTier(msg, tier);
    if (totalGain > 0) await animateCoinRain(msg, color, title);

    // ── Cascading reels (jusqu'à 2 cascades) ──────────────
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
        .setDescription(`\`\`\`\n${gridDisplay(newGrid)}\n\`\`\`\n*Les symboles gagnants s'effondrent !*`)
        .addFields({name:'💰 Cascade gain',value:`+${cGain.toLocaleString('fr-FR')} ${coin}`,inline:true})
      ]}).catch(() => {});
      await sleep(800);
      currentCascadeGrid = newGrid;
    }

    if (cascadeCount > 0) {
      totalGain += cascadeGain;
      desc += `\n\n⚡ **${cascadeCount} CASCADE${cascadeCount>1?'S':''}** !\n${cascadeLog.join('\n')}\n**Total cascade : +${cascadeGain.toLocaleString('fr-FR')} ${coin}**`;
    }

  } else {
    // MISS + Near-Miss detection
    trackStreak(userId, false);
    let nearMiss = null;
    for (const res of results) {
      const cells = res.payline.rows.map((row, col) => grid[col][row]);
      const counts = {};
      for (const c of cells) {
        if (c.id === 'wild' || c.id === 'wild2' || c.id === 'scatter' || c.id === 'bonus') continue;
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
        ['#F39C12','🎰 PRESQUE ! 🎰',`😱 **PRESQUE !** Deux ${nearMiss.emoji}... mais pas trois !`],
        ['#E67E22','💔 Si proche !',`*La chance te fuit d'un souffle...*`],
        ['#D35400','🍀 Prochaine fois !',`*Continue, le jackpot t'attend !*`],
      ]) {
        await msg.edit({ embeds: [new EmbedBuilder().setColor(c).setTitle(t)
          .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n${txt}`)
        ]}).catch(() => {});
        await sleep(420);
      }
      desc = `💔 **Presque !** Deux ${nearMiss.emoji} mais pas trois...\nRetente ta chance !`;
    } else {
      desc = '😔 Pas de combinaison gagnante. Retente ta chance !';
    }
  }

  trackSession(userId, totalGain > 0 ? totalGain : -totalMise);
  if (!isFreeSpins && !isJackpotWon) trackStreak(userId, totalGain > 0);
  addStats(userId, guildId, totalGain > 0, totalGain, isJackpotWon);

  const session = getSession(userId);
  const netSession = session.gains - session.losses;
  const currentStreak = streakStats.get(userId) || { current: 0 };
  const newBalance = db.getUser(userId, guildId)?.balance || 0;

  const finalEmbed = new EmbedBuilder()
    .setColor(color).setTitle(title)
    .setDescription(`\`\`\`\n${gridBase}\n\`\`\`\n\n${desc}`)
    .addFields(
      { name: '💰 Mise', value: `${totalMise.toLocaleString('fr-FR')} ${coin}`, inline: true },
      { name: totalGain > 0 ? '✅ Gain' : '❌ Perte',
        value: `${totalGain > 0 ? '+' : '-'}${(totalGain > 0 ? totalGain : totalMise).toLocaleString('fr-FR')} ${coin}`, inline: true },
      { name: '🏆 Jackpot', value: `${getJackpot(guildId).toLocaleString('fr-FR')} ${coin}`, inline: true },
    );

  if (maxMultiplier > 0) finalEmbed.addFields({ name: '🎰 Multiplicateur max', value: `×${maxMultiplier}`, inline: true });
  if (currentStreak.current >= 2) finalEmbed.addFields({ name: '🔥 Streak', value: `${currentStreak.current}× consécutif`, inline: true });
  if (session.biggestWin > 0) finalEmbed.addFields({ name: '🏅 Plus gros gain session', value: `${session.biggestWin.toLocaleString('fr-FR')} ${coin}`, inline: true });
  finalEmbed.addFields({ name: '📈 Session', value: `${netSession >= 0 ? '+' : ''}${netSession.toLocaleString('fr-FR')} ${coin}`, inline: true });
  finalEmbed
    .setFooter({ text: `Solde : ${newBalance.toLocaleString('fr-FR')} ${coin} · Spins session : ${session.spins}` })
    .setTimestamp();

  // ── Boutons action ─────────────────────────────────────
  const rows = [];
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise}_${activeLines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`slots_changemise_${userId}_${activeLines}`).setLabel('💰 Changer la mise').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`slots_maxmise_${userId}_${Math.min(u.balance, 10000)}_${activeLines}`).setLabel(`💎 Mise max (${Math.min(u.balance, 10000).toLocaleString('fr-FR')})`).setStyle(ButtonStyle.Primary),
  );
  rows.push(row1);

  const row2Btns = [];
  if (totalGain > 0 && !isJackpotWon && !isFreeSpins) {
    row2Btns.push(
      new ButtonBuilder()
        .setCustomId(`slots_gamble_${userId}_${totalGain}_rouge`)
        .setLabel(`🔴 Rouge/Noir ×2 (+${totalGain.toLocaleString('fr-FR')})`)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`slots_gamble_${userId}_${totalGain}_or`)
        .setLabel(`🥇 Couleur ×4`)
        .setStyle(ButtonStyle.Danger),
    );
  }
  row2Btns.push(
    new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${activeLines}_5`).setLabel('⚡ Auto ×5').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${activeLines}_10`).setLabel('⚡ Auto ×10').setStyle(ButtonStyle.Secondary),
  );
  if (row2Btns.length > 0 && row2Btns.length <= 5) rows.push(new ActionRowBuilder().addComponents(row2Btns));

  await msg.edit({ embeds: [finalEmbed], components: rows });
}

// ─── Auto-Spin (N tours rapides) ─────────────────────────
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

    // Mise à jour rapide (tous les 5 spins)
    if ((i + 1) % 5 === 0 || i === count - 1) {
      const bal = db.getUser(userId, guildId)?.balance || 0;
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`⚡ AUTO-SPIN ${i+1}/${count}`)
        .setDescription(`*Spins en cours...*`)
        .addFields(
          {name:'✅ Gains',value:`${wins}`,inline:true},
          {name:'❌ Pertes',value:`${losses}`,inline:true},
          {name:'📊 Net',value:`${totalNet >= 0 ? '+' : ''}${totalNet.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'🏅 Meilleur',value:`${biggestWin.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'💳 Solde',value:`${bal.toLocaleString('fr-FR')} ${coin}`,inline:true},
        )
      ], components: [] }).catch(() => {});
      await sleep(600);
    } else {
      await sleep(200);
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

  // ── Boutons casino machine classique ──────────────────
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
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
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
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
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
      await interaction.reply({ content: '❌ Mise invalide (min 5 par ligne).', ephemeral: true });
      return true;
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playSlots(interaction, userId, guildId, newMise, lines);
    return true;
  }

  // ── Gamble Rouge/Noir (×2) ────────────────────────────
  if (cid.startsWith('slots_gamble_') && cid.endsWith('_rouge')) {
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
    const won  = Math.random() < 0.5;
    if (won) {
      db.addCoins(userId, guildId, amount);
      trackSession(userId, amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🔴 GAMBLE → 🎊 DOUBLÉ !')
        .setDescription(`🍀 **Tu as doublé ton gain !**\n\n**+${amount.toLocaleString('fr-FR')} ${coin}** supplémentaires !`)
        .addFields(
          {name:'💰 Gain total',value:`**+${(amount*2).toLocaleString('fr-FR')} ${coin}**`,inline:true},
          {name:'🏦 Nouveau solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true},
        ).setFooter({text:'Le risque a payé !'}).setTimestamp()
      ], components: [] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount);
      trackSession(userId, -amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔴 GAMBLE → 💸 PERDU !')
        .setDescription(`😔 **Malchance ! Tu perds ton gain...**\n\n**-${amount.toLocaleString('fr-FR')} ${coin}** retirés.`)
        .addFields(
          {name:'📉 Perte',value:`-${amount.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'🏦 Nouveau solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true},
        ).setFooter({text:'La prochaine fois, garde tes gains !'}).setTimestamp()
      ], components: [] }).catch(() => {});
    }
    return true;
  }

  // ── Gamble Or (couleur spécifique ×4) ─────────────────
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
    const won  = Math.random() < 0.25; // 25% de chance pour ×4
    if (won) {
      const gain = amount * 3; // +3× en plus = total ×4
      db.addCoins(userId, guildId, gain);
      trackSession(userId, gain);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle('🥇 GAMBLE OR → ⚡ ×4 !!')
        .setDescription(`🌟 **INCROYABLE ! ×4 !!**\n\n**+${gain.toLocaleString('fr-FR')} ${coin}** supplémentaires !`)
        .addFields(
          {name:'💰 Gain total',value:`**+${(amount*4).toLocaleString('fr-FR')} ${coin}**`,inline:true},
          {name:'🏦 Nouveau solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true},
        ).setFooter({text:'Le jackpot de la chance !'}).setTimestamp()
      ], components: [] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount);
      trackSession(userId, -amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🥇 GAMBLE OR → 💸 PERDU !')
        .setDescription(`😔 **25% c'était trop risqué...**\n\n**-${amount.toLocaleString('fr-FR')} ${coin}** retirés.`)
        .addFields(
          {name:'📉 Perte',value:`-${amount.toLocaleString('fr-FR')} ${coin}`,inline:true},
          {name:'🏦 Nouveau solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true},
        ).setFooter({text:'Trop gourmand !'}).setTimestamp()
      ], components: [] }).catch(() => {});
    }
    return true;
  }

  // ── Bonus Mystery Box ─────────────────────────────────
  if (cid.startsWith('slots_bonus_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2];
    const pick    = parseInt(parts[3]); // 1, 2, 3
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
    trackSession(userId, prize);
    const nb = db.getUser(userId, guildId)?.balance || 0;

    // Révéler toutes les boîtes
    const reveals = game.prizes.map((p, i) =>
      `🎁 Boîte ${i+1}: **${p.toLocaleString('fr-FR')} ${coin}**${i === pick-1 ? ' ← **TU AS CHOISI !**' : ''}`
    ).join('\n');

    await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#E67E22')
      .setTitle(`🎁 BONUS — +${prize.toLocaleString('fr-FR')} ${coin} !`)
      .setDescription(`Tu as ouvert la **Boîte ${pick}** !\n\n${reveals}`)
      .addFields(
        {name:'💰 Prix remporté',value:`**+${prize.toLocaleString('fr-FR')} ${coin}**`,inline:true},
        {name:'🏦 Nouveau solde',value:`${nb.toLocaleString('fr-FR')} ${coin}`,inline:true},
      ).setFooter({text:'Bonus Mystery Box !'}).setTimestamp()
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_replay_${userId}_${game.mise}_${game.activeLines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
    )] }).catch(() => {});

    addStats(userId, guildId, true, prize, false);
    bonusGames.delete(bonusKey);
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
      await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});
      return true;
    }
    const u = db.getUser(userId, guildId);
    if (!u || u.balance < mise * lines) {
      await interaction.reply({ content: '❌ Solde insuffisant pour l\'auto-spin.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const coin   = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

    const { totalNet, wins: w, losses: l, biggestWin: bw, finalBal } = await runAutoSpin(msgRef, userId, guildId, mise, lines, count, coin);

    const color = totalNet >= 0 ? '#2ECC71' : '#E74C3C';
    await msgRef.edit({ embeds: [new EmbedBuilder().setColor(color)
      .setTitle(`⚡ AUTO-SPIN × ${count} terminé !`)
      .setDescription(`**${w} gains** | **${l} pertes**`)
      .addFields(
        {name:'📊 Net',value:`${totalNet >= 0?'+':''}${totalNet.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'🏅 Meilleur gain',value:`${bw.toLocaleString('fr-FR')} ${coin}`,inline:true},
        {name:'💳 Solde final',value:`${finalBal.toLocaleString('fr-FR')} ${coin}`,inline:true},
      ).setFooter({text:`Auto-spin terminé · ${count} spins`}).setTimestamp()
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise}_${lines}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`slots_autospin_${userId}_${mise}_${lines}_${count}`).setLabel(`⚡ Auto ×${count} à nouveau`).setStyle(ButtonStyle.Secondary),
    )] }).catch(() => {});
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous ultra-premium — 5 paylines, Free Spins, Bonus, Auto-Spin !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise par ligne (min 5)').setRequired(true).setMinValue(5))
    .addIntegerOption(o => o
      .setName('lignes').setDescription('Nombre de paylines actives (1-5, défaut 1)').setMinValue(1).setMaxValue(5)),

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
    if (!mise || mise < 5) return message.reply('❌ Mise min 5 coins. Ex: `&slots 100 3`');
    await playSlots(message, message.author.id, message.guildId, mise, lignes);
  },

  handleComponent,
};
