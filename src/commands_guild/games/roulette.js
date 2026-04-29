// ============================================================
// roulette.js — Roulette Époustouflante v8 — CASINO COMPLET
// TABLE COMPLÈTE, ANIMATION PREMIUM, MODES SPÉCIAUX, STATS SESSION
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');
const wheelImage = require('../../utils/wheelImage');
const balancer = require('../../utils/economyBalancer');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── DB historique ─────────────────────────────────────────────
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
    db.db.prepare(`DELETE FROM roulette_history WHERE guild_id=? AND rowid NOT IN (
      SELECT rowid FROM roulette_history WHERE guild_id=? ORDER BY rowid DESC LIMIT 300
    )`).run(guildId, guildId);
  } catch {}
}

function getHotCold(guildId) {
  try {
    const rows = db.db.prepare(
      `SELECT number, COUNT(*) as cnt FROM roulette_history WHERE guild_id=?
       GROUP BY number ORDER BY cnt DESC`
    ).all(guildId);
    if (rows.length < 5) return null;
    const hot  = rows.slice(0, 3).map(r => r.number);
    const cold = rows.slice(-3).reverse().map(r => r.number);
    return { hot, cold };
  } catch { return null; }
}

function getRecentSpins(guildId, count = 5) {
  try {
    const rows = db.db.prepare(
      `SELECT number FROM roulette_history WHERE guild_id=?
       ORDER BY rowid DESC LIMIT ?`
    ).all(guildId, count);
    return rows.map(r => r.number).reverse();
  } catch { return []; }
}

function getSessionStats(guildId, userId) {
  try {
    const rows = db.db.prepare(
      `SELECT number FROM roulette_history WHERE guild_id=?
       ORDER BY rowid DESC LIMIT 50`
    ).all(guildId);
    if (rows.length === 0) return null;

    // Compter les séries de couleurs
    let redStreak = 0, blackStreak = 0, maxRedStreak = 0, maxBlackStreak = 0;
    let redCount = 0, blackCount = 0;
    for (const row of rows) {
      if (row.number === 0) {
        redStreak = 0;
        blackStreak = 0;
      } else if (RED_NUMS.includes(row.number)) {
        redCount++;
        redStreak++;
        maxRedStreak = Math.max(maxRedStreak, redStreak);
        blackStreak = 0;
      } else {
        blackCount++;
        blackStreak++;
        maxBlackStreak = Math.max(maxBlackStreak, blackStreak);
        redStreak = 0;
      }
    }
    const totalNonZero = redCount + blackCount;
    const winRate = totalNonZero > 0 ? Math.round((redCount / totalNonZero) * 100) : 0;

    return {
      redStreak, blackStreak, maxRedStreak, maxBlackStreak,
      redCount, blackCount, winRate
    };
  } catch { return null; }
}

// ─── Roues: Européenne et Américaine ───────────────────────────
const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
const WHEEL_ORDER_EU = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WHEEL_ORDER_US = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,00,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14];

const VOISINS   = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS     = [5,8,10,11,13,16,23,24,27,30,33,36];
const ORPHELINS = [1,6,9,14,17,20,31,34];

// Voisins du X (5 numéros autour sur la roue réelle)
function getVoisinsNumber(num, wheelOrder) {
  const idx = wheelOrder.indexOf(num);
  if (idx === -1) return null;
  const neighbors = [];
  for (let i = -2; i <= 2; i++) {
    const n = ((idx + i) % wheelOrder.length + wheelOrder.length) % wheelOrder.length;
    neighbors.push(wheelOrder[n]);
  }
  return neighbors;
}

function numColor(n) {
  if (n === 0) return '🟩';
  return RED_NUMS.includes(n) ? '🔴' : '⚫';
}

function nStr(n) {
  return String(n).padStart(2, ' ');
}

// ─── TABLE COMPLÈTE ALMOSNI ───────────────────────────────────
function renderCompleteTable() {
  const lines = [];
  lines.push('🎡 TABLE DE ROULETTE ALMOSNI');
  lines.push('┌────┬────┬────┬────┬────┬────┐');
  lines.push('│ 3  │ 6  │ 9  │ 12 │ 15 │ 18 │ → 2-1');
  lines.push('│ 2  │ 5  │ 8  │ 11 │ 14 │ 17 │ → 2-1');
  lines.push('│ 1  │ 4  │ 7  │ 10 │ 13 │ 16 │ → 2-1');
  lines.push('├────┴────┴────┴────┴────┴────┤');
  lines.push('│ 1-12  │  13-24  │  25-36   │');
  lines.push('│ PAIR  │ IMPAIR  │ ROUGE ♥  │');
  lines.push('│MANQUE │ PASSE   │ NOIR ♠   │');
  lines.push('└──────────────────────────────┘');
  return lines.join('\n');
}

// ─── Roue circulaire AGRANDIE — pointeur ▼ fixe, cylindre défilant ──
// 9 numéros visibles en haut (case gagnante au centre), arc latéral, footer numéros
function renderWheelArc(centerIdx, wheelOrder, spinning = true, highlight = false) {
  const N = wheelOrder.length;
  const g = (off) => {
    const i = ((centerIdx + off) % N + N) % N;
    const n = wheelOrder[i];
    return { n, col: numColor(n) };
  };

  // Rangée du dessus : 9 numéros (offset -4..+4) — le 0 est sous le pointeur
  const topRow = [-4,-3,-2,-1,0,1,2,3,4].map(off => {
    const { n, col } = g(off);
    if (off === 0) {
      return highlight ? `❱${col}${nStr(n)}❰` : `❱${col}${nStr(n)}❰`;
    }
    return `${col}${nStr(n)}`;
  }).join(' ');

  // Arc latéral
  const { n: L1n, col: L1c } = g(-6);
  const { n: L2n, col: L2c } = g(-7);
  const { n: R1n, col: R1c } = g(6);
  const { n: R2n, col: R2c } = g(7);

  // Bottom : continuation du cylindre (vue arrière de la roue, offset à mi-chemin)
  const halfN = Math.floor(N / 2);
  const botRow = [-3,-2,-1,0,1,2,3].map(off => {
    const { n, col } = g(off + halfN);
    return `${col}${nStr(n)}`;
  }).join(' ');

  const ballMsg = spinning
    ? '⟳  ⚪ La bille file autour du cylindre...  ⟳'
    : '◉  La bille s\'est posée pile dans la case !';

  const center = highlight ? '🎯  CASE GAGNANTE  🎯' : '🎡       ALMOSNI       🎡';

  return [
    `                       ▼  POINTEUR  ▼`,
    `   ${topRow}`,
    `      ╔═══════════════════════════════════╗`,
    `${L2c}${nStr(L2n)} ${L1c}${nStr(L1n)} ║${' '.repeat(35)}║ ${R1c}${nStr(R1n)} ${R2c}${nStr(R2n)}`,
    `      ║   ${ballMsg.padEnd(31)} ║`,
    `      ║         ${center}        ║`,
    `      ║${' '.repeat(35)}║`,
    `      ╚═══════════════════════════════════╝`,
    `              ${botRow}`,
    highlight ? `                       ▲  GAGNANT  ▲` : `                       ▲`,
  ].join('\n');
}

// ─── Animation bille PREMIUM — 8+ frames ─────────────────────────
const BALL_PHASES = [
  { label:'⚡ 🎱 *La bille part comme une flèche !*',           color:'#C0392B', delay:50,  steps:8 },
  { label:'🌀 💨 *Vitesse maximale ! La bille tourbillonne !*', color:'#E74C3C', delay:70,  steps:8 },
  { label:'💨 🏓 *Ralentissement progressif...*',               color:'#D35400', delay:120, steps:7 },
  { label:'🏓 ⚪ *La bille rebondit sur les séparateurs !*',    color:'#E67E22', delay:180, steps:6 },
  { label:'🎯 ⚪ *Elle hésite entre deux cases...*',            color:'#F39C12', delay:260, steps:5 },
  { label:'🤫 ⚪ *Suspense absolu...*',                         color:'#F1C40F', delay:380, steps:4 },
  { label:'🔔 ⚪ *Derniers rebonds...*',                        color:'#2ECC71', delay:520, steps:3 },
  { label:'💫 ✨ *CLIC ! La bille se pose !*',                  color:'#27AE60', delay:280, steps:2 },
];

// ─── Parsing paris ─────────────────────────────────────────────
function parseBet(s_raw, maxNum = 36, wheelOrder = WHEEL_ORDER_EU) {
  const s = s_raw.toLowerCase().trim();
  if (s === 'rouge'  || s === 'red')   return { label:'🔴 Rouge (×2)',       numbers:RED_NUMS,   payout:1, type:'extérieur', key:s };
  if (s === 'noir'   || s === 'black') return { label:'⚫ Noir (×2)',        numbers:BLACK_NUMS, payout:1, type:'extérieur', key:s };
  if (s === 'pair'   || s === 'even')  return { label:'🔢 Pair (×2)',        numbers:[2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36], payout:1, type:'extérieur', key:s };
  if (s === 'impair' || s === 'odd')   return { label:'🔢 Impair (×2)',      numbers:[1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],  payout:1, type:'extérieur', key:s };
  if (s === 'bas'    || s === 'low'    || s === '1-18')  return { label:'⬇️ Manque 1-18 (×2)',  numbers:Array.from({length:18},(_,i)=>i+1),  payout:1, type:'extérieur', key:s };
  if (s === 'haut'   || s === 'high'   || s === '19-36') return { label:'⬆️ Passe 19-36 (×2)', numbers:Array.from({length:18},(_,i)=>i+19), payout:1, type:'extérieur', key:s };
  if (s === 'd1'     || s === '1-12')  return { label:'📊 Douzaine 1-12 (×3)', numbers:Array.from({length:12},(_,i)=>i+1),  payout:2, type:'douzaine', key:s };
  if (s === 'd2'     || s === '13-24') return { label:'📊 Douzaine 13-24 (×3)',  numbers:Array.from({length:12},(_,i)=>i+13), payout:2, type:'douzaine', key:s };
  if (s === 'd3'     || s === '25-36') return { label:'📊 Douzaine 25-36 (×3)',  numbers:Array.from({length:12},(_,i)=>i+25), payout:2, type:'douzaine', key:s };
  if (s === 'c1'     || s === 'col1')  return { label:'📋 Colonne 1 (×3)',    numbers:[1,4,7,10,13,16,19,22,25,28,31,34],  payout:2, type:'colonne', key:s };
  if (s === 'c2'     || s === 'col2')  return { label:'📋 Colonne 2 (×3)',    numbers:[2,5,8,11,14,17,20,23,26,29,32,35],  payout:2, type:'colonne', key:s };
  if (s === 'c3'     || s === 'col3')  return { label:'📋 Colonne 3 (×3)',    numbers:[3,6,9,12,15,18,21,24,27,30,33,36],  payout:2, type:'colonne', key:s };
  if (s === 'voisins' || s === 'vz')   return { label:'🎡 Voisins du Zéro (×2)', numbers:VOISINS,   payout:1, type:'section', key:'voisins' };
  if (s === 'tiers'   || s === 'tc')   return { label:'🎡 Tiers du Cylindre (×3)', numbers:TIERS, payout:2, type:'section', key:'tiers' };
  if (s === 'orphelins'|| s === 'orph')return { label:'🎡 Orphelins (×4)',    numbers:ORPHELINS, payout:3, type:'section', key:'orphelins' };

  // PARIS VOISINS — "voisins:X" pour 5 numéros autour de X
  const voisinMatch = s.match(/^voisins?:(\d+)$/) || s.match(/^vz:(\d+)$/);
  if (voisinMatch) {
    const num = parseInt(voisinMatch[1]);
    const neighbors = getVoisinsNumber(num, wheelOrder);
    if (neighbors) {
      return { label:`🎡 Voisins du ${num} (×2)`, numbers:neighbors, payout:1, type:'voisins_num', key:`vz:${num}` };
    }
  }

  // Cheval (2 numéros)
  const splitM = s.match(/^(\d+)[\/\+](\d+)$/) || s.match(/^(\d+)-(\d+)$/);
  if (splitM) {
    const a = parseInt(splitM[1]), b = parseInt(splitM[2]);
    if (a >= 0 && b <= maxNum && a !== b)
      return { label:`🔀 Cheval ${a}/${b} (×18)`, numbers:[a,b], payout:17, type:'cheval', key:`${a}-${b}` };
  }

  // Carré (4 numéros)
  const carreM = s.match(/^(\d+)x4$/);
  if (carreM) {
    const base = parseInt(carreM[1]);
    if (base > 0 && base <= maxNum - 3) {
      return { label:`🔲 Carré ${base}/${base+1}/${base+3}/${base+4} (×9)`, numbers:[base, base+1, base+3, base+4], payout:8, type:'carre', key:`carre-${base}` };
    }
  }

  // Plein (1 numéro)
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0 && num <= maxNum) {
    const payout = 35;
    return { label:`🎯 Plein ${num} (×${payout + 1})`, numbers:[num], payout: payout, type:'plein', key:`${num}` };
  }

  return null;
}

function parseBets(str, maxNum = 36, wheelOrder = WHEEL_ORDER_EU) {
  return str.split(/[,~]/).map(s=>s.trim()).filter(Boolean)
    .map(p=>parseBet(p, maxNum, wheelOrder)).filter(Boolean).slice(0, 3);
}

const BET_HELP = [
  '**════════ PARIS EXTÉRIEURS ════════**',
  '🔴 `rouge` / `noir`     → ×2  (48.6%)',
  '🔢 `pair` / `impair`    → ×2  (48.6%)',
  '⬇️ `bas` / `haut`        → ×2  (48.6%)',
  '',
  '**════════ PARIS INTÉRIEURS ════════**',
  '📊 `d1` / `d2` / `d3`   → ×3  (32.4%)  [Douzaines]',
  '📋 `c1` / `c2` / `c3`   → ×3  (32.4%)  [Colonnes]',
  '🔀 `1/2` ou `1-2`       → ×18  (5.4%)  [Cheval/2 num]',
  '🔲 `1x4`                → ×9  (10.8%) [Carré/4 num]',
  '🎯 `17`                 → ×36 (2.7%)  [Plein/1 num]',
  '',
  '**══ PARIS DU CYLINDRE ══**',
  '🎡 `voisins`            → ×2  (45.9%) [17 numéros]',
  '🎡 `voisins:14`         → ×2  (45.9%) [5 autour de 14]',
  '🎡 `tiers`              → ×3  (32.4%) [12 numéros]',
  '🎡 `orphelins`          → ×4  (21.6%) [8 numéros]',
  '',
  '**Multi-paris** : `rouge,d1,17` (max 3)',
].join('\n');

function chipDisplay(mise, coin) {
  const chip = mise >= 10000 ? '💎' : mise >= 5000 ? '🔴' : mise >= 1000 ? '🟣' : mise >= 500 ? '🔵' : mise >= 100 ? '🟢' : mise >= 50 ? '🟡' : '⚪';
  return `${chip} **${mise.toLocaleString('fr-FR')} ${coin}**`;
}

function header(mode = 'european') {
  const modeStr = mode === 'american' ? 'Roue Américaine · 0/00–36' : 'Roue Européenne · 0–36';
  const modeEmoji = mode === 'american' ? '🇺🇸' : '🇪🇺';
  return [
    '```',
    '╔══════════════════════════════════╗',
    '║  ✨  🎡  ROULETTE ROYALE  🎡  ✨  ║',
    `║  ${modeEmoji} ${modeStr}${' '.repeat(33 - modeStr.length - 4)}║`,
    '╚══════════════════════════════════╝',
    '```',
  ].join('\n');
}

function getModeStats(mode) {
  if (mode === 'american') {
    return { name: 'Américain (00)', rtp: '94.7%' };
  } else if (mode === 'french') {
    return { name: 'Français (La Partage)', rtp: '98.65%' };
  }
  return { name: 'Européen', rtp: '97.3%' };
}

function getRecentSpinsDisplay(guildId) {
  const recent = getRecentSpins(guildId, 5);
  if (recent.length === 0) return '';
  return '```\n' + 'Derniers : ' + recent.map(n => `${numColor(n)}${n}`).join(' ') + '\n```';
}

// ─── Jeu principal ─────────────────────────────────────────────
async function playRoulette(source, userId, guildId, mise, betString, mode = 'european') {
  if (!['european', 'american', 'french'].includes(mode)) mode = 'european';
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
  const WHEEL_ORDER = mode === 'american' ? WHEEL_ORDER_US : WHEEL_ORDER_EU;
  const maxNum = 36;
  const bets = parseBets(betString, maxNum, WHEEL_ORDER);

  if (!bets.length) {
    const err = `❌ Type de pari invalide.\n\n${BET_HELP}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  const totalMise = mise * bets.length;

  if (!u || u.balance < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance?.toLocaleString('fr-FR') || 0} ${coin}** (mise totale : **${totalMise.toLocaleString('fr-FR')} ${coin}**).`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 5) {
    const err = '❌ Mise minimale : **5** par pari.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);

  const betLabels = bets.map(b => b.label).join(' + ');
  const maxPot    = bets.reduce((s, b) => s + mise * (b.payout + 1), 0);

  const betDesc = bets.length === 1
    ? `**Pari :** ${bets[0].label}\n**Gain potentiel :** ${maxPot.toLocaleString('fr-FR')} ${coin} (×${bets[0].payout + 1})`
    : `**Paris (${bets.length}) :**\n${bets.map(b=>`▸ ${b.label} — pot. +${(mise*(b.payout+1)).toLocaleString('fr-FR')} ${coin}`).join('\n')}\n**Gain max :** ${maxPot.toLocaleString('fr-FR')} ${coin}`;

  let frameIdx = Math.floor(Math.random() * WHEEL_ORDER.length);

  const modeStats = getModeStats(mode);
  const modeEmoji = mode === 'american' ? '🇺🇸' : mode === 'french' ? '🇫🇷' : '🇪🇺';

  // ── Embed départ ──────────────────────────────────────────────
  const startEmbed = new EmbedBuilder()
    .setColor('#1A5276')
    .setTitle(`🎡 Roulette Royale ${modeEmoji}`)
    .setDescription([
      header(mode),
      '🎩 *"Messieurs-dames, faites vos jeux !"*',
      '',
      betDesc,
      `**Mise totale :** ${chipDisplay(totalMise, coin)}`,
      `**Mode :** ${modeStats.name} (RTP: ${modeStats.rtp})`,
      '',
      renderWheelArc(frameIdx, WHEEL_ORDER, true),
      '',
      '🎡 *La roue est lancée...*',
    ].join('\n'));

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [startEmbed] });
  else               msg = await source.reply({ embeds: [startEmbed] });

  // ── PRE-DÉTERMINATION DU RÉSULTAT — pour que l'animation converge dessus ──
  const maxResult = mode === 'american' ? 38 : 37;
  let result = Math.floor(Math.random() * maxResult);

  // Mode Français: La Partage
  let laPartageApplied = false;
  if (mode === 'french' && result === 0) {
    laPartageApplied = true;
  }

  const col = numColor(result);
  addToHistory(guildId, result);

  const resultIdx = WHEEL_ORDER.indexOf(result);

  // ── Animation bille v9 — GIF animé si dispo, sinon ASCII ────────
  const N_WHEEL = WHEEL_ORDER.length;
  const startIdx = frameIdx;

  // ── BRANCH 1 : VRAIE ROULETTE GIF (si libs canvas/gif dispo) ──
  if (wheelImage.isAvailable()) {
    let gifBuffer = null;
    try {
      gifBuffer = await wheelImage.generateRouletteGif(WHEEL_ORDER, resultIdx, {
        size: 420, frames: 28, rotations: 5, holdFrames: 8,
      });
    } catch (e) { console.error('[roulette] GIF gen error:', e.message); }

    if (gifBuffer) {
      const file = new AttachmentBuilder(gifBuffer, { name: 'roulette.gif' });
      const spinEmbed = new EmbedBuilder()
        .setColor('#1A5276')
        .setTitle('🎡 ROULETTE ROYALE — LA BILLE TOURNE !')
        .setDescription([
          header(mode),
          '🎬 *La bille file autour du cylindre...*',
          '',
          `**Paris :** ${betLabels}`,
          `**Mise totale :** ${chipDisplay(totalMise, coin)}`,
        ].join('\n'))
        .setImage('attachment://roulette.gif')
        .setFooter({ text: 'Roulette · Image animée temps réel' });

      await msg.edit({ embeds: [spinEmbed], files: [file] }).catch(() => {});
      // Durée du GIF : 28 frames + 8 hold ≈ ~6.2 sec total
      await sleep(6500);
      frameIdx = resultIdx; // math : la GIF s'arrête sur resultIdx
    } else {
      // GIF a échoué → fallback ASCII
      await runAsciiRouletteAnim();
    }
  } else {
    await runAsciiRouletteAnim();
  }

  // ── Helper : ancienne animation ASCII (fallback) ─────────────
  async function runAsciiRouletteAnim() {
    const totalRotations = 5;
    const ballDistance = totalRotations * N_WHEEL + ((resultIdx - startIdx + N_WHEEL) % N_WHEEL);
    const BALL_FRAMES = 18;

    const ballPhases = [
      { color:'#C0392B', label:'⚡ 🎱 *La bille part comme une flèche !*' },
      { color:'#E74C3C', label:'🌀 💨 *Vitesse maximale ! Le cylindre tourbillonne !*' },
      { color:'#D35400', label:'💨 🏓 *Frottement... la bille ralentit progressivement...*' },
      { color:'#E67E22', label:'🏓 ⚪ *Elle rebondit sur les séparateurs !*' },
      { color:'#F39C12', label:'🎯 ⚪ *Elle hésite entre deux cases...*' },
      { color:'#F1C40F', label:'🤫 ⚪ *Suspense absolu... silence dans le casino...*' },
      { color:'#2ECC71', label:'🔔 ⚪ *Derniers rebonds dans la pochette...*' },
      { color:'#27AE60', label:'💫 ✨ *CLIC ! La bille se pose pile dedans !*' },
    ];

    for (let f = 1; f <= BALL_FRAMES; f++) {
      const t = f / BALL_FRAMES;
      const ease = 1 - Math.pow(1 - t, 3);
      frameIdx = (startIdx + Math.round(ballDistance * ease)) % N_WHEEL;
      const phase = ballPhases[Math.min(ballPhases.length - 1, Math.floor(t * ballPhases.length))];

      const barFill = Math.round(t * 18);
      const bar = '▓'.repeat(barFill) + '░'.repeat(18 - barFill);

      const animDesc = [
        header(mode), `**${phase.label}**`, '',
        renderWheelArc(frameIdx, WHEEL_ORDER, true), '',
        `\`${bar}\` ${Math.round(t * 100)}%`,
        `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`,
      ].join('\n');

      await msg.edit({ embeds: [new EmbedBuilder().setColor(phase.color).setTitle('🎡 Roulette Royale').setDescription(animDesc)] }).catch(() => {});
      await sleep(Math.round(60 + 700 * Math.pow(t, 1.7)));
    }
  }
  // À ce stade : frameIdx === resultIdx (math garantie dans les 2 branches)

  // Pré-évaluation pour flash
  const betPreview = bets.map(bet => ({
    bet,
    won: bet.numbers.includes(result),
    gain: bet.numbers.includes(result) ? mise * (bet.payout + 1) : 0,
  }));
  const anyWon   = betPreview.some(r => r.won);
  const totalGainPre = betPreview.reduce((s, r) => s + r.gain, 0);
  const netPre   = totalGainPre - totalMise;

  // ── Flash révélation ─────────────────────────────────────────
  const resultDisplay = mode === 'american' && result === 37 ? '00' : String(result);
  const resultColor = result === 0 ? '#27AE60' : RED_NUMS.includes(result) ? '#C0392B' : '#2C3E50';
  const flashSeq = [
    { color:'#FFFFFF',   title:`🎡 💫 LA BILLE S'IMMOBILISE ! 💫 🎡` },
    { color: resultColor, title:`🎡 ${col}${col} NUMÉRO **${resultDisplay}** ! ${col}${col} 🎡` },
    { color: anyWon ? '#27AE60' : '#C0392B', title: anyWon ? `🎉✨ GAGNANT ! ✨🎉` : `💸 PERDU 💸` },
  ];
  for (const { color, title } of flashSeq) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle(title)
      .setDescription([
        header(mode), '',
        renderWheelArc(resultIdx, WHEEL_ORDER, false, true),
        '', `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`,
      ].join('\n'))
    ] }).catch(() => {});
    await sleep(320);
  }

  // ── Appliquer gains (avec balancer économique) ──────────────
  let totalGain = 0;
  const betResults = betPreview.map(({ bet, won, gain }) => {
    if (won) {
      const adjusted = balancer.adjustGain(gain, userId, guildId);
      db.addCoins(userId, guildId, adjusted);
      totalGain += adjusted;
      return { bet, won, gain: adjusted };
    }
    return { bet, won, gain };
  });
  const malaise = balancer.rollMalaise(userId, guildId);
  const netDiff = totalGain - totalMise;

  // ── Croupier ──────────────────────────────────────────────────
  let colWord;
  if (result === 0) {
    colWord = laPartageApplied ? '🟩 Zéro ! (La Partage — moitié rendu)' : '🟩 Zéro !';
  } else if (mode === 'american' && result === 37) {
    colWord = '🟩 Zéro double (00) !';
  } else {
    colWord = `${col === '🔴' ? 'Rouge' : 'Noir'}, numéro ${result} !`;
  }
  const croupier = `🎩 *"${colWord}"*`;

  // Informations sur le numéro
  const isRed    = RED_NUMS.includes(result);
  const isBlack  = BLACK_NUMS.includes(result);
  const parity   = result === 0 ? '—' : result % 2 === 0 ? '🔢 Pair' : '🔢 Impair';
  const range    = result === 0 ? '—' : result <= 18 ? '⬇️ Manque (1-18)' : '⬆️ Passe (19-36)';
  const dozaine  = result === 0 ? '—' : result <= 12 ? '1re Douzaine' : result <= 24 ? '2e Douzaine' : '3e Douzaine';
  const section  = VOISINS.includes(result) ? 'Voisins du 0' : TIERS.includes(result) ? 'Tiers' : ORPHELINS.includes(result) ? 'Orphelins' : result === 0 ? 'Zéro' : '—';

  // Boîte résultat
  let resultBox;
  if (anyWon && bets.length === 1 && bets[0].type === 'plein') {
    resultBox = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║   🏆  PLEIN SUR LE NUMÉRO ! JACKPOT ! 🏆 ║',
      `║       +${String((totalGain.toLocaleString('fr-FR')+' '+coin)).padEnd(33)}║`,
      '╚══════════════════════════════════════════╝',
      '```',
    ].join('\n');
  } else if (anyWon) {
    const sign = netDiff >= 0 ? '+' : '';
    resultBox = [
      '```',
      '╔══════════════════════════════════════════╗',
      `║  ${netDiff >= 0 ? '✅  GAGNANT !' : '⚠️  GAIN PARTIEL'}                        ║`,
      `║  Net : ${sign}${String((netDiff.toLocaleString('fr-FR')+' '+coin)).padEnd(33)}║`,
      '╚══════════════════════════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultBox = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  ❌  MANQUÉ !                            ║',
      `║  -${String((totalMise.toLocaleString('fr-FR')+' '+coin)).padEnd(39)}║`,
      '╚══════════════════════════════════════════╝',
      '```',
    ].join('\n');
  }

  const betDetail = betResults.map(r =>
    `${r.won ? '✅' : '❌'} ${r.bet.label} → ${r.won ? `**+${r.gain.toLocaleString('fr-FR')} ${coin}**` : `−${mise.toLocaleString('fr-FR')} ${coin}`}`
  ).join('\n');

  const hc = getHotCold(guildId);
  const hotColdLine = hc
    ? `\n🔥 **Chauds :** ${hc.hot.map(n=>`${numColor(n)}${n}`).join(' ')}  |  🧊 **Froids :** ${hc.cold.map(n=>`${numColor(n)}${n}`).join(' ')}`
    : '';

  // STATS SESSION
  const sessionStats = getSessionStats(guildId);
  let statsLine = '';
  if (sessionStats) {
    const streakEmoji = sessionStats.redStreak > 0 ? '🔴' : '⚫';
    const currentStreak = sessionStats.redStreak || sessionStats.blackStreak;
    statsLine = `\n📊 **Série :** ${streakEmoji}×${currentStreak} | **Taux victoire:** ${sessionStats.winRate}%`;
  }

  // RECOMMANDATION STRATÉGIE MARTINGALE
  let martingaleAdvice = '';
  if (sessionStats && sessionStats.blackStreak >= 3) {
    martingaleAdvice = '\n💡 **Martingale:** Après 3 noirs d\'affilée, vous pouvez suivre le rouge ×2';
  } else if (sessionStats && sessionStats.redStreak >= 3) {
    martingaleAdvice = '\n💡 **Martingale:** Après 3 rouges d\'affilée, vous pouvez suivre le noir ×2';
  }

  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const recentSpinsDisplay = getRecentSpinsDisplay(guildId);

  const finalDesc = [
    header(mode),
    croupier,
    '',
    renderWheelArc(resultIdx, WHEEL_ORDER, false, true),
    '',
    resultBox,
    '',
    '**Détails des paris:**',
    betDetail,
    '',
    `**Mise:** ${chipDisplay(totalMise, coin)} | **Solde:** ${newBal.toLocaleString('fr-FR')} ${coin}`,
    `📊 ${parity} · ${range} · ${dozaine} · ${section}`,
    hotColdLine,
    recentSpinsDisplay,
    statsLine,
    martingaleAdvice,
    balancer.malaiseEmbedText(malaise, coin),
  ].join('\n');

  const modeStr = mode === 'american' ? '🇺🇸' : mode === 'french' ? '🇫🇷' : '🇪🇺';
  const finalColor = result === 0 || (mode === 'american' && result === 37) ? '#27AE60' : RED_NUMS.includes(result) ? '#C0392B' : '#2C3E50';
  const finalTitle = anyWon
    ? (netDiff > 0 ? `🎡 🎉 VICTOIRE ! 🎉 ${modeStr}` : `🎡 ⚠️ GAIN PARTIEL ${modeStr}`)
    : `🎡 💸 PERDU ${modeStr}`;

  const encodedBets = bets.map(b => b.key).join('~');
  const row = makeGameRow('rl', userId, mise, encodedBets);

  const quickRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rl_quickbet_${userId}_${mise}_rouge`).setLabel('🔴 Rouge ×2').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rl_quickbet_${userId}_${mise}_noir`).setLabel('⚫ Noir ×2').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rl_table_${userId}`).setLabel('📋 Table').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rl_stats_${userId}`).setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
  );

  const footerText = mode === 'american'
    ? `Jouez responsable · Mise min : 5/pari · RTP: ${modeStats.rtp}`
    : mode === 'french'
    ? `Jouez responsable · Mise min : 5/pari · La Partage: moitié rendu sur 0`
    : `Jouez responsable · Mise min : 5/pari · RTP: ${modeStats.rtp}`;

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor(finalColor)
      .setTitle(finalTitle)
      .setDescription(finalDesc)
      .setFooter({ text: footerText })
      .setTimestamp()],
    components: [row, quickRow],
  });
}

// ─── Exports ───────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Roulette Royale — TABLE COMPLÈTE, MODES CASINO, VOISINS, STATS SESSION')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise par pari (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o.setName('pari').setDescription('Ex: rouge | d1,rouge | voisins:14 | 17,noir,c2 (max 3)').setRequired(true))
    .addStringOption(o => o.setName('mode').setDescription('Mode de jeu').setRequired(false)
      .addChoices(
        { name: 'Européen (0-36, RTP 97.3%)', value: 'european' },
        { name: 'Américain (0/00-36, RTP 94.7%)', value: 'american' },
        { name: 'Français (La Partage)', value: 'french' },
      )),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mode = interaction.options.getString('mode') || 'european';
    await playRoulette(interaction, interaction.user.id, interaction.guildId,
      interaction.options.getInteger('mise'), interaction.options.getString('pari'), mode);
  },

  name: 'roulette',
  aliases: ['rl', 'wheel', 'casino-roulette'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&roulette <mise> <pari> [mode]`\nEx: `&roulette 100 rouge` ou `&roulette 100 voisins:14 american`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') mise = bal;
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 5) return message.reply('❌ Usage : `&roulette <mise> <pari>`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    const mode = args[args.length - 1] === 'american' ? 'american' : args[args.length - 1] === 'french' ? 'french' : 'european';
    await playRoulette(message, message.author.id, message.guildId, mise, betType, mode);
  },

  betHelp: BET_HELP,

  async handleComponent(interaction, cid) {
    if (cid.startsWith('rl_quickbet_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betType = parts[4];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      const betStr = betType === 'pairimpair' ? (Math.random() < 0.5 ? 'pair' : 'impair') : betType;
      await playRoulette(interaction, userId, interaction.guildId, mise, betStr);
      return true;
    }

    if (cid.startsWith('rl_table_')) {
      const userId = cid.split('_')[2];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      const tableEmbed = new EmbedBuilder()
        .setColor('#1A5276')
        .setTitle('📋 TABLE DE ROULETTE COMPLÈTE')
        .setDescription('```\n' + renderCompleteTable() + '\n```\n' + BET_HELP)
        .setFooter({ text: 'Utilise /roulette mise pari pour jouer' });
      await interaction.editReply({ embeds: [tableEmbed], components: [] });
      return true;
    }

    if (cid.startsWith('rl_stats_')) {
      const userId = cid.split('_')[2];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      const stats = getSessionStats(interaction.guildId);
      let statsText = stats
        ? `🔴 **Rouges (derniers 50):** ${stats.redCount}\n⚫ **Noirs (derniers 50):** ${stats.blackCount}\n📊 **Taux rouge:** ${stats.winRate}%\n🔥 **Plus long série rouge:** ${stats.maxRedStreak}\n🧊 **Plus long série noir:** ${stats.maxBlackStreak}`
        : 'Pas assez de données.';
      const statsEmbed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('📊 STATISTIQUES SESSION')
        .setDescription(statsText)
        .setFooter({ text: 'Historique des 50 derniers tours' });
      await interaction.editReply({ embeds: [statsEmbed], components: [] });
      return true;
    }

    if (cid.startsWith('rl_replay_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betStr  = parts.slice(4).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      await playRoulette(interaction, userId, interaction.guildId, mise, betStr);
      return true;
    }

    if (cid.startsWith('rl_changemise_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.showModal(changeMiseModal('rl', userId, betStr));
      return true;
    }

    if (cid.startsWith('rl_modal_') && interaction.isModalSubmit()) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u       = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 5) {
        return interaction.reply({ content: '❌ Mise invalide (min 5/pari).', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
      await playRoulette(interaction, userId, interaction.guildId, newMise, betStr);
      return true;
    }

    return false;
  },
};
