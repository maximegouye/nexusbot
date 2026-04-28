// ============================================================
// roulette.js — Roulette Européenne/Américaine v7 — ROUE AVANCÉE
// Représentation en arc, table de jeu, animation bille améliorée
// Mode sélectionnable + paris étendus + visuel amélioré
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

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

// ─── Roues: Européenne et Américaine ───────────────────────────
const RED_NUMS   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
const WHEEL_ORDER_EU = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const WHEEL_ORDER_US = [0,28,9,26,30,11,7,20,32,17,5,22,34,15,3,24,36,13,1,00,27,10,25,29,12,8,19,31,18,6,21,33,16,4,23,35,14];

const VOISINS   = [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25];
const TIERS     = [5,8,10,11,13,16,23,24,27,30,33,36];
const ORPHELINS = [1,6,9,14,17,20,31,34];

function numColor(n) {
  if (n === 0) return '🟩';
  return RED_NUMS.includes(n) ? '🔴' : '⚫';
}

function nStr(n) {
  return String(n).padStart(2, ' ');
}

// ─── Roue circulaire ───────────────────────────────────────────
// Montre la roue comme un arc avec la bille en bas (position courante)
// Layout :
//     [top-4] [top-3] [top-2] [top-1] [top]    ← arc supérieur
//   [L2]                                  [R2]  ← côtés
//   [L1]        ◉ La bille tourne         [R1]
//     [bot-2] [bot-1] [BOT] [bot+1] [bot+2]    ← résultat en bas
//                      ▲ ▲
function renderWheelArc(centerIdx, spinning = true, highlight = false) {
  const N = WHEEL_ORDER.length;
  const g = (off) => {
    const i = ((centerIdx + off) % N + N) % N;
    const n = WHEEL_ORDER[i];
    return { n, col: numColor(n) };
  };

  // Arc supérieur : 5 numéros opposés (center + 18)
  const topCenter = Math.floor(N / 2);
  const topRow = [-2,-1,0,1,2].map(off => {
    const { n, col } = g(topCenter + off);
    return `${col}${nStr(n)}`;
  }).join(' ');

  // Côtés
  const { n: L1n, col: L1c } = g(topCenter - 3);
  const { n: L2n, col: L2c } = g(topCenter + 3);
  const { n: R1n, col: R1c } = g(topCenter + 3);
  const { n: R2n, col: R2c } = g(topCenter - 3);

  // Arc inférieur : résultat au centre
  const botRow = [-2,-1,0,1,2].map(off => {
    const { n, col } = g(off);
    if (off === 0) {
      if (highlight) return `❱${col}**${nStr(n)}**❰`;
      return `❱${col}${nStr(n)}❰`;
    }
    return `${col}${nStr(n)}`;
  }).join(' ');

  const midLine = spinning
    ? `  ${L1c}${nStr(L1n)}  │   ⟳  bille en cours...   │  ${R1c}${nStr(R1n)}`
    : `  ${L1c}${nStr(L1n)}  │   ◉  la bille s'arrête   │  ${R1c}${nStr(R1n)}`;

  return [
    `         ${topRow}`,
    `       ╭───────────────────────╮`,
    midLine,
    `       ╰───────────────────────╯`,
    `         ${botRow}`,
    highlight ? `                 ▲  ▲  ▲` : `                 ▲`,
  ].join('\n');
}

// ─── Table de jeu visuelle ─────────────────────────────────────
function renderTable() {
  // Grille 3×12 classique de roulette + 0 + séparateurs
  const cols = [
    [3,6,9,12,15,18,21,24,27,30,33,36],
    [2,5,8,11,14,17,20,23,26,29,32,35],
    [1,4,7,10,13,16,19,22,25,28,31,34],
  ];
  const rows = Array.from({length: 12}, (_, i) => {
    const r = cols.map(col => {
      const n = col[i];
      const c = numColor(n);
      return `${c}${String(n).padStart(2,' ')}`;
    });
    return `│ ${r.join(' │ ')} │`;
  });
  return [
    '```',
    '╔═══╦═════╦═════╦═════╗',
    '║ 🟩 0 ║ Col1 │ Col2 │ Col3║',
    '╠═══╩═════╪═════╪═════╣',
    ...rows.slice(0, 4),
    '├─────────┼─────┼─────┤',
    ...rows.slice(4, 8),
    '├─────────┼─────┼─────┤',
    ...rows.slice(8, 12),
    '╚═════════╧═════╧═════╝',
    '```',
  ].join('\n');
}

// ─── Parsing paris ─────────────────────────────────────────────
function parseBet(s_raw, maxNum = 36) {
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

  // Cheval (2 numéros)
  const splitM = s.match(/^(\d+)[\/\+](\d+)$/) || s.match(/^(\d+)-(\d+)$/);
  if (splitM) {
    const a = parseInt(splitM[1]), b = parseInt(splitM[2]);
    if (a >= 0 && b <= maxNum && a !== b)
      return { label:`🔀 Cheval ${a}/${b} (×18)`, numbers:[a,b], payout:17, type:'cheval', key:`${a}-${b}` };
  }

  // Carré (4 numéros) : parse "1234" comme carré
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
    const payout = maxNum === 36 ? 35 : 35;
    return { label:`🎯 Plein ${num} (×${payout + 1})`, numbers:[num], payout: payout, type:'plein', key:`${num}` };
  }

  return null;
}

function parseBets(str, maxNum = 36) {
  return str.split(/[,~]/).map(s=>s.trim()).filter(Boolean)
    .map(p=>parseBet(p, maxNum)).filter(Boolean).slice(0, 3);
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

// ─── Animation de la bille — Frames améliorées ─────────────────
const BALL_PHASES = [
  { label:'⚡ 🎱 *La bille part comme une flèche !*',           color:'#C0392B', delay:60,  steps:6 },
  { label:'🌀 💨 *Vitesse maximale ! La bille tourbillonne !*', color:'#E74C3C', delay:85,  steps:7 },
  { label:'💨 🏓 *Ralentissement progressif...*',               color:'#D35400', delay:130, steps:6 },
  { label:'🏓 ⚪ *La bille rebondit sur les séparateurs !*',    color:'#E67E22', delay:200, steps:5 },
  { label:'🎯 ⚪ *Elle hésite entre deux cases...*',            color:'#F39C12', delay:280, steps:4 },
  { label:'🤫 ⚪ *Suspense absolu...*',                         color:'#F1C40F', delay:400, steps:3 },
  { label:'🔔 ⚪ *Derniers rebonds...*',                        color:'#2ECC71', delay:550, steps:2 },
  { label:'💫 ✨ *CLIC ! La bille se pose !*',                  color:'#27AE60', delay:300, steps:1 },
];

// ─── Jeu principal ─────────────────────────────────────────────
async function playRoulette(source, userId, guildId, mise, betString, mode = 'european') {
  if (!['european', 'american'].includes(mode)) mode = 'european';
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';
  const WHEEL_ORDER = mode === 'american' ? WHEEL_ORDER_US : WHEEL_ORDER_EU;
  const maxNum = mode === 'american' ? 36 : 36;
  const bets = parseBets(betString, maxNum);

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

  // ── Embed départ ──────────────────────────────────────────────
  const startEmbed = new EmbedBuilder()
    .setColor('#1A5276')
    .setTitle(`🎡 Roulette Royale ${mode === 'american' ? '🇺🇸' : '🇪🇺'}`)
    .setDescription([
      header(mode),
      '🎩 *"Messieurs-dames, faites vos jeux !"*',
      '',
      betDesc,
      `**Mise totale :** ${chipDisplay(totalMise, coin)}`,
      '',
      renderWheelArc(frameIdx, true),
      '',
      '🎡 *La roue est lancée...*',
    ].join('\n'));

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [startEmbed] });
  else               msg = await source.reply({ embeds: [startEmbed] });

  // ── Animation bille ───────────────────────────────────────────
  for (const phase of BALL_PHASES) {
    for (let f = 0; f < phase.steps; f++) {
      frameIdx = (frameIdx + 1) % WHEEL_ORDER.length;
      const animDesc = [
        header(mode),
        `**${phase.label}**`,
        '',
        renderWheelArc(frameIdx, true),
        '',
        `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`,
      ].join('\n');
      await msg.edit({ embeds: [new EmbedBuilder().setColor(phase.color).setTitle('🎡 Roulette Royale').setDescription(animDesc)] }).catch(() => {});
      await sleep(phase.delay);
    }
  }

  // ── Résultat ──────────────────────────────────────────────────
  const maxResult = mode === 'american' ? 38 : 37; // 0-36 en EU, 0-00-36 en US
  const result    = Math.floor(Math.random() * maxResult);
  const col       = numColor(result);
  addToHistory(guildId, result);

  const resultIdx = WHEEL_ORDER.indexOf(result);

  // Pré-évaluation pour flash
  const betPreview = bets.map(bet => ({
    bet, won: bet.numbers.includes(result),
    gain: bet.numbers.includes(result) ? mise * (bet.payout + 1) : 0,
  }));
  const anyWon   = betPreview.some(r => r.won);
  const totalGainPre = betPreview.reduce((s, r) => s + r.gain, 0);
  const netPre   = totalGainPre - totalMise;

  // ── Flash révélation ─────────────────────────────────────────
  const resultDisplay = mode === 'american' && result === 37 ? '00' : String(result);
  const flashSeq = [
    { color:'#FFFFFF',   title:`🎡 💫 LA BILLE S'IMMOBILISE ! 💫 🎡` },
    { color: anyWon ? '#F1C40F' : '#1a1a2e', title:`🎡 ${col}${col} NUMÉRO **${resultDisplay}** ! ${col}${col} 🎡` },
    { color: anyWon ? '#27AE60' : '#C0392B', title: anyWon ? `🎉✨ GAGNANT ! ✨🎉` : `💸 PERDU 💸` },
  ];
  for (const { color, title } of flashSeq) {
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor(color).setTitle(title)
      .setDescription([
        header(mode), '',
        renderWheelArc(resultIdx, false, true),
        '', `**Paris :** ${betLabels}  |  **Mise :** ${chipDisplay(totalMise, coin)}`,
      ].join('\n'))
    ] }).catch(() => {});
    await sleep(320);
  }

  // ── Appliquer gains ───────────────────────────────────────────
  let totalGain = 0;
  const betResults = betPreview.map(({ bet, won, gain }) => {
    if (won) { db.addCoins(userId, guildId, gain); totalGain += gain; }
    return { bet, won, gain };
  });
  const netDiff = totalGain - totalMise;

  // ── Croupier ──────────────────────────────────────────────────
  let colWord;
  if (result === 0) {
    colWord = '🟩 Zéro !';
  } else if (mode === 'american' && result === 37) {
    colWord = '🟩 Zéro double (00) !';
  } else {
    colWord = `${col === '🔴' ? 'Rouge' : 'Noir'}, numéro ${result} !`;
  }
  const croupier  = `🎩 *"${colWord}"*`;

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

  const newBal = db.getUser(userId, guildId)?.balance || 0;

  const finalDesc = [
    header(mode),
    croupier,
    '',
    renderWheelArc(resultIdx, false, true),
    '',
    resultBox,
    '',
    betDetail,
    '',
    `**Mise :** ${chipDisplay(totalMise, coin)}  |  **Solde :** ${newBal.toLocaleString('fr-FR')} ${coin}`,
    `📊 ${parity}  ·  ${range}  ·  ${dozaine}  ·  ${section}`,
    hotColdLine,
  ].join('\n');

  const modeStr = mode === 'american' ? '🇺🇸' : '🇪🇺';
  const finalColor = anyWon ? (netDiff >= 0 ? '#27AE60' : '#F39C12') : (result === 0 || result === 37 ? '#2ECC71' : '#E74C3C');
  const finalTitle = anyWon
    ? (netDiff > 0 ? `🎡 🎉 VICTOIRE ! 🎉 ${modeStr} Roulette` : `🎡 ⚠️ GAIN PARTIEL — ${modeStr} Roulette`)
    : `🎡 💸 PERDU — ${modeStr} Roulette`;

  const encodedBets = bets.map(b => b.key).join('~');
  const row = makeGameRow('rl', userId, mise, encodedBets);

  const quickRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rl_quickbet_${userId}_${mise}_rouge`).setLabel('🔴 Rouge ×2').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rl_quickbet_${userId}_${mise}_noir`).setLabel('⚫ Noir ×2').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rl_quickbet_${userId}_${mise}_pairimpair`).setLabel('🔢 Pair/Impair').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rl_table_${userId}`).setLabel('📋 Table').setStyle(ButtonStyle.Secondary),
  );

  const footerText = mode === 'american'
    ? 'Jouez responsable · Mise min : 5/pari · Max 3 paris · Roue Américaine 0/00-36'
    : 'Jouez responsable · Mise min : 5/pari · Max 3 paris · Roue Européenne 0-36';

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
    .setDescription('🎡 Roulette Royale — Européenne ou Américaine, multi-paris, sections !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise par pari (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o.setName('pari').setDescription('Ex: rouge | d1,rouge | voisins | 17,noir,c2 (max 3)').setRequired(true))
    .addStringOption(o => o.setName('mode').setDescription('Mode de jeu').setRequired(false)
      .addChoices(
        { name: 'Européenne (0-36)', value: 'european' },
        { name: 'Américaine (0/00-36)', value: 'american' },
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
    if (!rawMise) return message.reply('❌ Usage : `&roulette <mise> <pari> [mode]`\nEx: `&roulette 100 rouge` ou `&roulette 100 rouge american`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') mise = bal;
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 5) return message.reply('❌ Usage : `&roulette <mise> <pari>`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    const mode = args[args.length - 1] === 'american' ? 'american' : 'european';
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
        .setTitle('📋 Table des mises — Roulette Royale')
        .setDescription(header() + '\n' + BET_HELP)
        .setFooter({ text: 'Utilise /roulette mise pari pour jouer' });
      await interaction.editReply({ embeds: [tableEmbed], components: [] });
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
