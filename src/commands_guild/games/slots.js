// ============================================================
// slots.js — Machine à sous 5 rouleaux ultra-complète (v5)
// Nouveautés : bouton mise max + stats session + multiplicateur
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── Stats de session en mémoire (userId -> {gains, pertes}) ─
const sessionStats = new Map();

// ─── Symboles & poids ─────────────────────────────────────
const SYMBOLS = [
  { id: 'cherry',  emoji: '🍒', name: 'Cerise',    weight: 30, value: 2   },
  { id: 'lemon',   emoji: '🍋', name: 'Citron',    weight: 25, value: 3   },
  { id: 'orange',  emoji: '🍊', name: 'Orange',    weight: 20, value: 4   },
  { id: 'grape',   emoji: '🍇', name: 'Raisin',    weight: 15, value: 5   },
  { id: 'melon',   emoji: '🍉', name: 'Melon',     weight: 10, value: 8   },
  { id: 'bell',    emoji: '🔔', name: 'Cloche',    weight: 8,  value: 10  },
  { id: 'star',    emoji: '⭐', name: 'Étoile',    weight: 5,  value: 15  },
  { id: 'seven',   emoji: '7️⃣', name: 'Sept',     weight: 3,  value: 25  },
  { id: 'diamond', emoji: '💎', name: 'Diamant',   weight: 2,  value: 50  },
  { id: 'wild',    emoji: '🃏', name: 'WILD',      weight: 2,  value: 0   },
  { id: 'bonus',   emoji: '🎁', name: 'BONUS',     weight: 1,  value: 0   },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function spinReel() {
  let rng = Math.random() * TOTAL_WEIGHT;
  for (const sym of SYMBOLS) {
    rng -= sym.weight;
    if (rng <= 0) return sym;
  }
  return SYMBOLS[0];
}

// ─── DB Jackpot + Stats ───────────────────────────────────
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
    spins=spins+1,
    wins=wins+?,
    jackpots=jackpots+?,
    biggest=MAX(biggest,?)
    WHERE user_id=? AND guild_id=?
  `).run(won ? 1 : 0, isJackpot ? 1 : 0, amount, userId, guildId);
}

// ─── Gestion de la session utilisateur ───────────────────
function trackSessionGain(userId, gain) {
  if (!sessionStats.has(userId)) {
    sessionStats.set(userId, { gains: 0, losses: 0 });
  }
  const stats = sessionStats.get(userId);
  if (gain > 0) stats.gains += gain;
  else stats.losses += Math.abs(gain);
}
function getSessionStats(userId) {
  return sessionStats.get(userId) || { gains: 0, losses: 0 };
}

// ─── 5 rouleaux × 3 rangées ───────────────────────────────
function spinGrid() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => spinReel())
  );
}
function gridRow(grid, row) {
  return grid.map(col => col[row].emoji).join(' ');
}

// ─── Évaluation des lignes ────────────────────────────────
function evalLine(grid, row) {
  const cells = grid.map(col => col[row]);
  const wilds  = cells.filter(c => c.id === 'wild').length;
  const bonuses = cells.filter(c => c.id === 'bonus').length;
  const counts = {};
  for (const c of cells) {
    if (c.id === 'wild' || c.id === 'bonus') continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
  }
  if (bonuses >= 3) return { type: 'bonus', bonuses, mult: 0 };
  if (wilds === 5) return { type: 'jackpot', mult: 0 };
  let bestSym = null, bestCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count + wilds >= 3 && count > bestCount) {
      bestSym   = SYMBOLS.find(s => s.id === id);
      bestCount = count;
    }
  }
  if (!bestSym) return { type: 'miss', mult: 0 };
  const total = bestCount + wilds;
  const mult  = bestSym.value * (total === 3 ? 1 : total === 4 ? 3 : 8);
  return { type: 'win', symbol: bestSym, count: total, wilds, mult };
}

function evalGrid(grid) {
  const results = [];
  for (let row = 0; row < 3; row++) {
    results.push({ row, ...evalLine(grid, row) });
  }
  const hasJackpot = results.some(r => r.type === 'jackpot');
  const hasBonus   = results.some(r => r.type === 'bonus');
  const wins       = results.filter(r => r.type === 'win');
  return { results, hasJackpot, hasBonus, wins };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Animation de spin ──────────────────────────────────
// NOTE : Discord rate-limit ≈ 5 edits/5s → on garde ≤ 10 edits au total,
//        avec un minimum de 600ms entre chaque pour ne jamais déclencher le 429.
async function animateSpin(msg, grid, coin, mise, jackpot) {
  const SYM = ['🍒','🍋','🍊','🍇','🍉','🔔','⭐','7️⃣','💎','🃏'];
  const rndRow = () => Array.from({length:5}, () => SYM[Math.floor(Math.random()*SYM.length)]);

  // ── 2 frames rapides (démarrage) ────────────────────────
  const startData = [
    { color:'#F39C12', text:'⚡ Les rouleaux démarrent !' },
    { color:'#E67E22', text:'🌀 En pleine rotation !' },
  ];
  for (const { color, text } of startData) {
    const r1=rndRow(), r2=rndRow(), r3=rndRow();
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n${r1.join(' ')}\n${r2.join(' ')}\n${r3.join(' ')}\n\`\`\`\n*${text}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true},{name:'🏆 Jackpot',value:`${jackpot} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(600);
  }

  // ── 2 frames ralentissement ──────────────────────────────
  const slowData = [
    { color:'#7D3C98', text:'🔄 Ça ralentit...' },
    { color:'#5B2C7D', text:'⏳ Derniers symboles...' },
  ];
  for (const { color, text } of slowData) {
    const r1=rndRow(), r2=rndRow(), r3=rndRow();
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n${r1.join(' ')}\n${r2.join(' ')}\n${r3.join(' ')}\n\`\`\`\n*${text}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(650);
  }

  // ── 5 frames de révélation (1 rouleau par edit) ─────────
  const partial = Array.from({length:5}, () => Array.from({length:3}, () => ({emoji:'🌀'})));
  const stopColors = ['#6C3483','#1A5276','#1E8449','#117A65','#27AE60'];
  for (let col = 0; col < 5; col++) {
    partial[col] = grid[col];
    const rows = [0,1,2].map(row => partial.map(c => c[row]?.emoji || '🌀').join(' '));
    const rem = 4 - col;
    const stopTxt = rem > 0 ? `🌀 ${rem} rouleau${rem>1?'x':''} encore en rotation...` : '✅ Tous les rouleaux sont arrêtés !';
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(stopColors[col]).setTitle('🎰 SLOT MACHINE ROYALE 🎰')
      .setDescription(`\`\`\`\n${rows[0]}\n${rows[1]}\n${rows[2]}\n\`\`\`\n*${stopTxt}*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(col < 4 ? 620 : 400); // dernier rouleau un peu plus rapide
  }
}

// ─── Animation jackpot ──────────────────────────────────
async function animateJackpot(msg, amount, coin) {
  const frames = [
    { color: '#FFD700', text: '🎊 JACKPOT !! 🎊' },
    { color: '#FFA500', text: `🌟 +${amount} ${coin} 🌟` },
    { color: '#FFD700', text: '🏆 JACKPOT PROGRESSIF ! 🏆' },
  ];
  for (const { color, text } of frames) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color)
      .setTitle(text)
      .setDescription('```\n' + '='.repeat(30) + '\n' + ' '.repeat(8) + '🏆 JACKPOT 🏆\n' + '='.repeat(30) + '\n```')
    ]}).catch(() => {});
    await sleep(700);
  }
}

// ─── Animation pluie de pièces ─────────────────────────
async function animateCoinRain(msg, color, title) {
  const rainFrames = ['💰', '💸', '💶', '🪙'];
  const lines = [
    '*🌧️ Les euros pleuvent !*',
    '*💨 TEMPÊTE DE GAINS !!*',
    '*💰 FORTUNE DÉVERSÉE !!*',
  ];
  for (let i = 0; i < 3; i++) {
    const coins = Array.from({length: 3 + i}, () => rainFrames[Math.floor(Math.random()*rainFrames.length)]).join(' ');
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle(title)
      .setDescription(`${coins}\n\n${lines[i]}`)
    ]}).catch(() => {});
    await sleep(700);
  }
}

// ─── FREE SPINS — 5 vrais tours gratuits ──────────────
async function runFreeSpins(msg, userId, guildId, mise, coin) {
  const FREE_COUNT = 5;
  let totalFreeGain = 0;
  const spinSummary = [];

  const SYM = ['🍒','🍋','🍊','🍇','🍉','🔔','⭐','7️⃣','💎','🃏'];
  const rndRow = () => Array.from({length:5}, () => SYM[Math.floor(Math.random()*SYM.length)]);

  for (let s = 0; s < FREE_COUNT; s++) {
    // 1 frame de rotation (≥600ms entre chaque edit)
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`🎁 FREE SPIN ${s + 1}/${FREE_COUNT} 🎁`)
      .setDescription(`\`\`\`\n${rndRow().join(' ')}\n${rndRow().join(' ')}\n${rndRow().join(' ')}\n\`\`\`\n*🌀 Rotation en cours...*`)
      .addFields({name:'💰 Gain accumulé',value:`${totalFreeGain} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(700);

    // Evaluate this free spin
    const freeGrid = spinGrid();
    const { results, hasJackpot, wins } = evalGrid(freeGrid);
    let spinGain = 0;

    if (hasJackpot) {
      const jp = getJackpot(guildId);
      spinGain = jp;
      resetJackpot(guildId);
      db.addCoins(userId, guildId, jp);
    } else {
      for (const w of wins) {
        spinGain += Math.floor(mise * w.mult);
      }
      if (spinGain > 0) db.addCoins(userId, guildId, spinGain);
    }

    totalFreeGain += spinGain;

    // Show result for this spin
    const rows = [0,1,2].map(row => {
      const line = freeGrid.map(col => col[row].emoji).join(' ');
      const r = results[row];
      if (r.type === 'win')     return `**${line}** ✅ +${Math.floor(mise * r.mult)}`;
      if (r.type === 'jackpot') return `**${line}** 🏆 JACKPOT!`;
      return line;
    }).join('\n');

    spinSummary.push(`Spin ${s+1}: ${spinGain > 0 ? `+${spinGain} ${coin}` : '—'}`);

    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(spinGain > 0 ? '#2ECC71' : '#7F8C8D')
      .setTitle(`🎁 FREE SPIN ${s + 1}/${FREE_COUNT} — ${spinGain > 0 ? `+${spinGain} ${coin}` : 'Pas de gain'}`)
      .setDescription(`\`\`\`\n${rows}\n\`\`\``)
      .addFields({name:'💰 Gain accumulé',value:`${totalFreeGain} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(700);
  }

  return { totalFreeGain, spinSummary };
}

// ─── Jeu principal ────────────────────────────────────────
async function playSlots(source, userId, guildId, mise, lines = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';
  const jackpot = getJackpot(guildId);

  const totalMise = mise * lines;
  if (!u || u.balance < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}** (mise totale : ${totalMise}).`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 5) {
    const err = '❌ Mise minimale : **5 coins** par ligne.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);
  addToJackpot(guildId, Math.floor(totalMise * 0.02));

  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎰 SLOT MACHINE ROYALE 🎰')
    .setDescription('```\n╔═══════════════════════╗\n║ 🍒 🍋 🍊 🍇 🍉 ║\n║ 🔔 ⭐ 7️⃣ 💎 🃏 ║\n║ 🎯  ♠️  ♥️  ♦️  ♣️ ║\n╚═══════════════════════╝\n```\n*Lancement des rouleaux...*')
    .addFields(
      { name: '💰 Mise', value: `${totalMise} ${coin} (${lines} ligne${lines > 1 ? 's' : ''})`, inline: true },
      { name: '🏆 Jackpot', value: `**${jackpot} ${coin}**`, inline: true },
    );

  let msg;
  if (isInteraction) {
    if (!source.deferred && !source.replied) await source.deferReply();
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  const grid = spinGrid();
  await animateSpin(msg, grid, coin, totalMise, jackpot);

  // Évaluation
  const { results, hasJackpot, hasBonus, wins } = evalGrid(grid);

  let totalGain = 0;
  let color = '#E74C3C';
  let title = '🎰 SLOT MACHINE ROYALE 🎰';
  let desc  = '';
  let isJackpotWon = false;
  let isFreeSpins  = false;
  let maxMultiplier = 0;

  const rows = [0, 1, 2].map(row => {
    const r    = results[row];
    const line = grid.map(col => col[row].emoji).join(' ');
    if (r.type === 'win')     return `**${line}** ✅ ×${r.mult}`;
    if (r.type === 'jackpot') return `**${line}** 🏆 JACKPOT!`;
    if (r.type === 'bonus')   return `**${line}** 🎁 BONUS!`;
    return line;
  }).join('\n');

  if (hasJackpot) {
    isJackpotWon = true;
    const jp = getJackpot(guildId);
    totalGain = jp;
    resetJackpot(guildId);
    color  = '#FFD700';
    title  = '🏆 JACKPOT PROGRESSIF 🏆';
    desc   = `🎊 **FÉLICITATIONS !** Tu as décroché le **JACKPOT** !\n\n**+${jp} ${coin}** remportés !`;
    db.addCoins(userId, guildId, jp);
    await animateJackpot(msg, jp, coin);
    await animateCoinRain(msg, color, title);

  } else if (hasBonus) {
    // ── VRAIS FREE SPINS ─────────────────────────────────────
    isFreeSpins = true;
    color = '#9B59B6';
    title = '🎁 FREE SPINS × 5 🎁';
    await animateCoinRain(msg, color, title);

    // Afficher intro free spins
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎁 FREE SPINS DÉCLENCHÉS ! × 5 🎁')
      .setDescription(`\`\`\`\n${rows}\n\`\`\`\n\n🎰 **3 symboles BONUS !** Tu gagnes **5 tours gratuits** !\n*Les rouleaux se relancent...*`)
      .addFields({name:'💰 Mise initiale',value:`${totalMise} ${coin}`,inline:true})
    ]}).catch(() => {});
    await sleep(1500);

    const { totalFreeGain, spinSummary } = await runFreeSpins(msg, userId, guildId, mise, coin);
    totalGain = totalFreeGain;
    desc = [
      `🎁 **FREE SPINS terminés !**`,
      ``,
      spinSummary.join('\n'),
      ``,
      `**Total gagné : +${totalFreeGain} ${coin}**`,
    ].join('\n');

  } else if (wins.length > 0) {
    for (const w of wins) {
      totalGain += Math.floor(mise * w.mult);
      maxMultiplier = Math.max(maxMultiplier, w.mult);
    }
    db.addCoins(userId, guildId, totalGain);
    color = totalGain > totalMise * 3 ? '#F1C40F' : '#2ECC71';
    title = totalGain > totalMise * 5 ? '🌟 GROS GAIN ! 🌟' : '🎰 SLOT MACHINE ROYALE 🎰';
    desc  = wins.map(w =>
      `**Ligne ${w.row + 1}** : ${w.count}× ${w.symbol.emoji} ${w.symbol.name} → +${Math.floor(mise * w.mult)} ${coin}`
    ).join('\n');
    if (totalGain > 0) await animateCoinRain(msg, color, title);
  } else {
    // ── Détection Near-Miss ──────────────────────────────────
    let nearMissSymbol = null;
    for (let row = 0; row < 3; row++) {
      const cells = grid.map(col => col[row]);
      const counts = {};
      for (const c of cells) {
        if (c.id === 'wild' || c.id === 'bonus') continue;
        counts[c.id] = (counts[c.id] || 0) + 1;
      }
      const bestEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (bestEntry && bestEntry[1] === 2) {
        nearMissSymbol = SYMBOLS.find(s => s.id === bestEntry[0]);
        break;
      }
    }

    if (nearMissSymbol) {
      const nmFrames = [
        { color: '#F39C12', title: '🎰 PRESQUE ! 🎰', text: `😱 **PRESQUE !** Deux ${nearMissSymbol.emoji} ${nearMissSymbol.name}... mais la troisième !` },
        { color: '#E67E22', title: '💔 Si Proche ! 💔', text: `*La chance te fuit d'un souffle !*` },
        { color: '#D35400', title: '🍀 La Prochaine Fois ! 🍀', text: `*Continue, le jackpot t'attend !*` },
      ];
      for (const f of nmFrames) {
        await msg.edit({ embeds: [new EmbedBuilder()
          .setColor(f.color).setTitle(f.title)
          .setDescription(`\`\`\`\n${rows}\n\`\`\`\n\n${f.text}`)
        ]}).catch(() => {});
        await sleep(400);
      }
    }
    desc = nearMissSymbol
      ? `💔 **Presque !** Deux ${nearMissSymbol.emoji} mais pas trois...\nRetente ta chance !`
      : '😔 Pas de combinaison gagnante. Retente ta chance !';
  }

  trackSessionGain(userId, totalGain > 0 ? totalGain : -totalMise);
  addStats(userId, guildId, totalGain > 0, totalGain, isJackpotWon);

  const sessionData = getSessionStats(userId);
  const netSession = sessionData.gains - sessionData.losses;

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`\`\`\`\n${rows}\n\`\`\`\n\n${desc}`)
    .addFields(
      { name: '💰 Mise', value: `${totalMise} ${coin}`, inline: true },
      { name: totalGain > 0 ? '✅ Gain' : '❌ Perte', value: `${totalGain > 0 ? '+' : '-'}${totalGain > 0 ? totalGain : totalMise} ${coin}`, inline: true },
      { name: '🏆 Jackpot', value: `${getJackpot(guildId)} ${coin}`, inline: true },
    );

  // Ajouter champ multiplicateur si win
  if (maxMultiplier > 0) {
    finalEmbed.addFields({ name: '🎰 Multiplicateur', value: `×${maxMultiplier}`, inline: true });
  }

  // Ajouter champ session
  finalEmbed.addFields({
    name: '📈 Session',
    value: `${netSession >= 0 ? '+' : ''}${netSession} ${coin}`,
    inline: true
  });

  finalEmbed
    .setFooter({ text: `Solde : ${db.getUser(userId, guildId)?.balance || 0} ${coin}` })
    .setTimestamp();

  // ── Boutons : rejouer + changer mise + mise max + (gamble si gain) ──
  const replayRow = makeGameRow('slots', userId, mise, `${lines}`);

  // Ajouter le bouton Mise Max (plafonné à 10000)
  const maxMise = Math.min(u.balance, 10000);
  replayRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`slots_maxmise_${userId}_${maxMise}_${lines}`)
      .setLabel(`💎 Mise max (${maxMise})`)
      .setStyle(ButtonStyle.Primary)
  );

  // Ajouter le bouton Gamble si gain > 0 et pas jackpot / free spins
  if (totalGain > 0 && !isJackpotWon && !isFreeSpins) {
    replayRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`slots_gamble_${userId}_${totalGain}`)
        .setLabel(`🎲 Gamble ×2 (+${totalGain} → +${totalGain * 2})`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  await msg.edit({ embeds: [finalEmbed], components: [replayRow] });
}

// ─── Handle Component ──────────────────────────────────────
async function handleComponent(interaction) {
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  // ── Mise Max ──────────────────────────────────────────────
  if (interaction.customId.startsWith('slots_maxmise_')) {
    const parts        = interaction.customId.split('_');
    const customUserId = parts[2];
    const maxMise      = parseInt(parts[3]);
    const lines        = parseInt(parts[4]) || 1;
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playSlots(source, userId, guildId, maxMise, lines);

  // ── Rejouer ──────────────────────────────────────────────
  } else if (interaction.customId.startsWith('slots_replay_')) {
    const parts        = interaction.customId.split('_');
    const customUserId = parts[2];
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    const newMise  = parseInt(parts[3]);
    const newLines = parseInt(parts[4]) || 1;
    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playSlots(source, userId, guildId, newMise, newLines);

  // ── Changer la mise ──────────────────────────────────────
  } else if (interaction.customId.startsWith('slots_changemise_')) {
    const parts        = interaction.customId.split('_');
    const customUserId = parts[2];
    const lines        = parseInt(parts[3]) || 1;
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('slots', userId, `${lines}`));

  // ── Modal mise ───────────────────────────────────────────
  } else if (interaction.customId.startsWith('slots_modal_') && interaction.isModalSubmit()) {
    const parts        = interaction.customId.split('_');
    const customUserId = parts[2];
    const lines        = parseInt(parts[3]) || 1;
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce modal n\'est pas pour toi.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u       = db.getUser(userId, guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 5) {
      return interaction.reply({ content: '❌ Mise invalide (min 5 coins par ligne).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playSlots(interaction, userId, guildId, newMise, lines);

  // ── Gamble (double ou rien) ──────────────────────────────
  } else if (interaction.customId.startsWith('slots_gamble_')) {
    const parts        = interaction.customId.split('_');
    const customUserId = parts[2];
    const amount       = parseInt(parts[3]) || 0;
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    if (!amount || amount <= 0) {
      return interaction.reply({ content: '❌ Montant invalide.', ephemeral: true });
    }

    await interaction.deferUpdate();
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';
    const won  = Math.random() < 0.5;

    if (won) {
      db.addCoins(userId, guildId, amount); // double le gain (déjà crédité, on ajoute pareil)
      trackSessionGain(userId, amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      const winEmbed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('🎲 GAMBLE → 🎊 DOUBLÉ !')
        .setDescription(
          `🍀 **Incroyable ! Tu as doublé ton gain !**\n\n` +
          `**+${amount.toLocaleString()} ${coin}** supplémentaires !`
        )
        .addFields(
          { name: '💰 Gain total', value: `**+${(amount * 2).toLocaleString()} ${coin}**`, inline: true },
          { name: '🏦 Nouveau solde', value: `**${nb.toLocaleString()} ${coin}**`, inline: true },
        )
        .setFooter({ text: '🎲 Le risque a payé !' })
        .setTimestamp();
      await interaction.editReply({ embeds: [winEmbed], components: [] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount); // retire le gain
      trackSessionGain(userId, -amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      const loseEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🎲 GAMBLE → 💸 PERDU !')
        .setDescription(
          `😔 **Malchance ! Tu perds ton gain...**\n\n` +
          `**-${amount.toLocaleString()} ${coin}** retirés.`
        )
        .addFields(
          { name: '📉 Perte', value: `**-${amount.toLocaleString()} ${coin}**`, inline: true },
          { name: '🏦 Nouveau solde', value: `**${nb.toLocaleString()} ${coin}**`, inline: true },
        )
        .setFooter({ text: '🎲 La prochaine fois, garde tes gains !' })
        .setTimestamp();
      await interaction.editReply({ embeds: [loseEmbed], components: [] }).catch(() => {});
    }
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous — 5 rouleaux, jackpot progressif, free spins, gamble !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Mise par ligne (min 5)').setRequired(true).setMinValue(5))
    .addIntegerOption(o => o
      .setName('lignes').setDescription('Nombre de lignes (1-3, défaut 1)').setMinValue(1).setMaxValue(3)),

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
    const lignes  = parseInt(args[1]) || 1;
    if (!rawMise) return message.reply('❌ Usage : `&slots <mise> [lignes]`\nEx: `&slots 100 3`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout' || rawMise === 'max') mise = bal;
    else if (rawMise === 'moitie' || rawMise === 'half' || rawMise === '50%') mise = Math.floor(bal / 2);
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 5) return message.reply('❌ Usage : `&slots <mise> [lignes]`\nEx: `&slots 100 3`');
    await playSlots(message, message.author.id, message.guildId, mise, Math.min(3, Math.max(1, lignes)));
  },

  handleComponent,
};
