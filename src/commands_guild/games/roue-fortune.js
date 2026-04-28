// ============================================================
// roue-fortune.js — La Roue de la Fortune v6 — VRAIE ROUE
// Représentation circulaire, animation rotative, 24 segments
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── 24 secteurs équilibrés ──────────────────────────────────
const SECTORS = [
  { label: '🟡 100',      type: 'win',     coins: 100,   color: '#F1C40F', emoji: '🟡' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🟠 300',      type: 'win',     coins: 300,   color: '#E67E22', emoji: '🟠' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🔵 500',      type: 'win',     coins: 500,   color: '#2980B9', emoji: '🔵' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🟢 750',      type: 'win',     coins: 750,   color: '#27AE60', emoji: '🟢' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🔴 1 000',   type: 'win',     coins: 1000,  color: '#E74C3C', emoji: '🔴' },
  { label: '⚡ ×2 MISE', type: 'double',  coins: 0,     color: '#F39C12', emoji: '⚡' },
  { label: '🟣 1 500',   type: 'win',     coins: 1500,  color: '#8E44AD', emoji: '🟣' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '⭐ 2 500',   type: 'win',     coins: 2500,  color: '#F39C12', emoji: '⭐' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🎁 MYSTÈRE', type: 'mystery', coins: 0,     color: '#9B59B6', emoji: '🎁' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🟡 200',      type: 'win',     coins: 200,   color: '#F1C40F', emoji: '🟡' },
  { label: '➡️ PASSE',   type: 'pass',    coins: 0,     color: '#7F8C8D', emoji: '➡️' },
  { label: '🔴 800',      type: 'win',     coins: 800,   color: '#E74C3C', emoji: '🔴' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '💎 5 000',   type: 'win',     coins: 5000,  color: '#1ABC9C', emoji: '💎' },
  { label: '💀 FAILLITE', type: 'lose',    coins: 0,     color: '#1a1a2e', emoji: '💀' },
  { label: '🔄 RELANCER', type: 'reroll',  coins: 150,   color: '#3498DB', emoji: '🔄' },
  { label: '🌟 JACKPOT', type: 'jackpot', coins: 15000, color: '#FFD700', emoji: '🌟' },
];

// Poids (index = secteur)
const WEIGHTS = [12, 14, 9, 14, 7, 14, 6, 14, 5, 4, 4, 14, 3, 14, 5, 14, 10, 5, 5, 14, 1, 14, 3, 1];

function weightedSpin() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SECTORS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ─── Roue circulaire — 8 secteurs autour d'un centre ──────────
// Layout :
//      [N-1] [N]  [N+1]
//  [N-2]              [N+2]
//  [N-3]    🎡       [N+3]
//      [N+6][N+5][N+4]
//             ▼
//        ❱❱ résultat ❰❰
function renderWheelCircle(idx, spinning = true, highlight = false) {
  const N = SECTORS.length;
  const g = (off) => {
    const i = ((idx + off) % N + N) % N;
    return SECTORS[i];
  };

  // 8 positions autour du centre + la position résultat (bas, idx lui-même)
  // Top row : N+12, N+11, N+10  (côté opposé de la roue)
  // Left : N+9, N+8
  // Right : N+1, N+2 (en descendant)  -- wait, actually going clockwise
  // Bottom row : N-1, N, N+1  (= la flèche pointe vers N)

  // Sens : la flèche est en bas. Les numéros "descendent" vers la flèche.
  // Tournage sens antihoraire = idx augmente à gauche de la flèche.

  const top1 = g(12); const top2 = g(11); const top3 = g(10);
  const midL1 = g(9);  const midL2 = g(8);
  const midR1 = g(1);  const midR2 = g(2);
  const bot1 = g(-1); const bot2 = g(0); const bot3 = g(1); // bot2 = current = g(0)

  // Pour la rangée du bas, l'index 0 est le résultat
  const botL = g(-1); const botC = g(0); const botR = g(1);

  // Top : opposé (milieu de la roue = ±12)
  const topL  = g(13); const topC = g(12); const topR = g(11);

  // Sides
  const leftUp   = g(10); const leftDown  = g(9);
  const rightUp  = g(2);  const rightDown = g(3);

  const fmtTop  = (s) => s.emoji;
  const fmtSide = (s) => s.emoji;
  const fmtBot  = (s, center) => center ? (highlight ? `❱${s.emoji}❰` : `◉${s.emoji}◉`) : s.emoji;
  const spin    = spinning ? '🌀' : '🎡';

  return [
    `        ${fmtTop(topL)}  ${fmtTop(topC)}  ${fmtTop(topR)}`,
    `      ╭─────────────────╮`,
    `  ${fmtSide(leftUp)}  │                 │  ${fmtSide(rightUp)}`,
    `  ${fmtSide(leftDown)}  │       ${spin}       │  ${fmtSide(rightDown)}`,
    `      ╰─────────────────╯`,
    `        ${fmtBot(botL,false)}  ${fmtBot(botC,true)}  ${fmtBot(botR,false)}`,
    `              ▲`,
    highlight ? `       ❱❱ ${botC.label} ❰❰` : `          (en cours...)`,
  ].join('\n');
}

// ─── Bande défilante (animation) ─────────────────────────────
function renderBand(centerIdx, wide = false) {
  const N = SECTORS.length;
  const window = wide ? 5 : 3;
  const parts = [];
  for (let off = -window; off <= window; off++) {
    const i = ((centerIdx + off) % N + N) % N;
    const s = SECTORS[i];
    if (off === 0) parts.push(`❱❱${s.emoji}${s.label}❰❰`);
    else if (Math.abs(off) === 1) parts.push(`${s.emoji}`);
    else parts.push(s.emoji);
  }
  return parts.join(' ') + '\n           ▲';
}

// ─── Jeu principal ────────────────────────────────────────────
async function playRoueFortune(source, userId, guildId) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (!u) {
    const err = '❌ Compte introuvable.';
    if (isInteraction) return source.editReply({ content: err });
    return source.reply(err);
  }

  // ── Cooldown 30 min ─────────────────────────────────────────
  const COOLDOWN_MS = 30 * 60 * 1000;
  const now = Date.now();
  try { db.db.prepare('ALTER TABLE users ADD COLUMN last_roue INTEGER DEFAULT 0').run(); } catch {}

  const rowCd    = db.db.prepare('SELECT last_roue FROM users WHERE user_id=? AND guild_id=?').get(userId, guildId);
  const lastRoue = (rowCd?.last_roue || 0) * 1000;
  const elapsed  = now - lastRoue;

  if (elapsed < COOLDOWN_MS) {
    const reste  = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
    const done   = Math.floor((elapsed / COOLDOWN_MS) * 20);
    const bar    = '█'.repeat(done) + '░'.repeat(20 - done);
    const embed  = new EmbedBuilder()
      .setColor('#7F8C8D')
      .setTitle('🎡 Roue de la Fortune')
      .setDescription([
        '```',
        '╔══════════════════════════════════╗',
        '║   ⏳  ROUE EN RECHARGE...  ⏳     ║',
        '╚══════════════════════════════════╝',
        '```',
        `**Rechargement :** \`[${bar}]\` ${Math.round(elapsed/COOLDOWN_MS*100)}%`,
        `⏰ Disponible dans **${reste} minute${reste > 1 ? 's' : ''}**`,
        '',
        '*Reviens bientôt pour tenter ta chance !*',
      ].join('\n'))
      .setFooter({ text: '🎡 Roue de la Fortune · Gratuit · Cooldown 30 min' });
    if (isInteraction) return source.editReply({ embeds: [embed] });
    return source.reply({ embeds: [embed] });
  }

  db.db.prepare('UPDATE users SET last_roue=? WHERE user_id=? AND guild_id=?')
    .run(Math.floor(now / 1000), userId, guildId);

  const finalIdx = weightedSpin();
  const N = SECTORS.length;

  // ── Intro ────────────────────────────────────────────────────
  let startPos = Math.floor(Math.random() * N);
  const introEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎡 ━━━ ROUE DE LA FORTUNE ━━━ 🎡')
    .setDescription([
      '```',
      '╔══════════════════════════════════════════╗',
      '║    🎵  Bienvenue — Tournez la Roue !  🎵  ║',
      '╚══════════════════════════════════════════╝',
      '```',
      renderWheelCircle(startPos, true),
      '',
      '🎬 *La roue commence à tourner...*',
    ].join('\n'))
    .setFooter({ text: '🎡 Roue de la Fortune · Gratuit · Cooldown 30 min' });

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [introEmbed] });
  else               msg = await source.reply({ embeds: [introEmbed] });

  // ── Animation par phases ─────────────────────────────────────
  const phases = [
    { steps: 8, jump: 5, delay: 90,  color: '#E74C3C', txt: '⚡ **La roue s\'élance à pleine vitesse !**',   bar: '▓▓▓▓▓▓▓▓▓▓ 100%' },
    { steps: 7, jump: 4, delay: 130, color: '#E67E22', txt: '🌀 **Elle tourne très vite...**',                bar: '▓▓▓▓▓▓▓▓░░  80%' },
    { steps: 6, jump: 3, delay: 200, color: '#F39C12', txt: '💨 **Ralentissement en cours...**',              bar: '▓▓▓▓▓▓░░░░  60%' },
    { steps: 5, jump: 2, delay: 320, color: '#F1C40F', txt: '🎯 **Le pointeur hésite...**',                   bar: '▓▓▓▓░░░░░░  40%' },
    { steps: 4, jump: 1, delay: 480, color: '#2ECC71', txt: '😮 **Tout se joue maintenant !**',               bar: '▓▓░░░░░░░░  20%' },
    { steps: 3, jump: 1, delay: 650, color: '#1ABC9C', txt: '🛑 **Arrêt imminent...**',                       bar: '▓░░░░░░░░░   5%' },
  ];

  let pos = startPos;
  for (const ph of phases) {
    for (let s = 0; s < ph.steps; s++) {
      pos = (pos + ph.jump) % N;
      const spinEmbed = new EmbedBuilder()
        .setColor(ph.color)
        .setTitle('🎡 ━━━ ROUE DE LA FORTUNE ━━━ 🎡')
        .setDescription([
          renderWheelCircle(pos, true),
          '',
          ph.txt,
          `\`${ph.bar}\``,
        ].join('\n'));
      await msg.edit({ embeds: [spinEmbed] }).catch(() => {});
      await sleep(ph.delay);
    }
  }

  // Aligner exactement sur finalIdx
  // Animation finale lente vers la cible
  let cur = pos;
  const diff = ((finalIdx - cur) % N + N) % N;
  for (let s = 0; s < diff; s++) {
    cur = (cur + 1) % N;
    const isLast = cur === finalIdx;
    const spinEmbed = new EmbedBuilder()
      .setColor(isLast ? '#FFFFFF' : '#3498DB')
      .setTitle(isLast ? '🛑 ✨ ARRÊT ! ✨ 🛑' : '🎡 ━━━ ROUE DE LA FORTUNE ━━━ 🎡')
      .setDescription([
        renderWheelCircle(cur, !isLast, isLast),
        '',
        isLast ? '🔔 **Clic ! La flèche s\'immobilise !**' : '🛑 *Dernier tour...*',
        `\`░░░░░░░░░░   0%\``,
      ].join('\n'));
    await msg.edit({ embeds: [spinEmbed] }).catch(() => {});
    await sleep(isLast ? 200 : 750);
  }

  await sleep(600);

  // ── Résultat ─────────────────────────────────────────────────
  const sector  = SECTORS[finalIdx];
  let gain = 0;
  const uFresh  = db.getUser(userId, guildId);

  if (sector.type === 'jackpot') {
    gain = sector.coins;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'win') {
    gain = sector.coins;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'double') {
    gain = uFresh.balance;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'mystery') {
    gain = Math.floor(Math.random() * 3000) + 300;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'reroll') {
    gain = sector.coins;
    db.addCoins(userId, guildId, gain);
    db.db.prepare('UPDATE users SET last_roue=0 WHERE user_id=? AND guild_id=?').run(userId, guildId);
  }

  const newBalance = db.getUser(userId, guildId)?.balance || 0;

  // ── Animations pré-résultat spectaculaires ───────────────────
  if (sector.type === 'jackpot') {
    const jpSeq = [
      { c:'#FFD700', t:'🌟 ★ JACKPOT ★ 🌟',     d:'```\n═══════════════════════════════\n    🌟  J A C K P O T  🌟    \n═══════════════════════════════\n```' },
      { c:'#FFA500', t:`🎆 💥 ${sector.coins.toLocaleString()} ${coin} ! 💥 🎆`, d:'*Le sol tremble, les euros pleuvent !*\n\n🎊 🥳 🎆 🎇 💰 🎇 🎆 🥳 🎊' },
      { c:'#FFD700', t:'✨ VOUS ENTREZ DANS LA LÉGENDE ! ✨',      d:renderWheelCircle(finalIdx, false, true) },
    ];
    for (const { c, t, d } of jpSeq) {
      await msg.edit({ embeds:[new EmbedBuilder().setColor(c).setTitle(t).setDescription(d)] }).catch(()=>{});
      await sleep(500);
    }
  } else if (sector.type === 'mystery') {
    const mSeq = [
      { c:'#6C3483', t:'🎁 SECTEUR MYSTÈRE...',         d:'*La boîte s\'ouvre lentement...*\n\n`▓░░░░░░░░░ 10%`' },
      { c:'#7D3C98', t:'🎁 Que cache-t-il ?',           d:'*La fortune réserve une surprise...*\n\n`▓▓▓▓░░░░░░ 40%`' },
      { c:'#9B59B6', t:'🎁 Voici ce que tu remportes !',d:`*Révélation !*\n\n\`▓▓▓▓▓▓▓▓▓▓ 100%\`\n\n💰 **+${gain.toLocaleString()} ${coin}**` },
    ];
    for (const { c, t, d } of mSeq) {
      await msg.edit({ embeds:[new EmbedBuilder().setColor(c).setTitle(t).setDescription(d)] }).catch(()=>{});
      await sleep(500);
    }
  } else if (sector.type === 'double') {
    const dSeq = [
      { c:'#F39C12', t:'⚡ MULTIPLICATEUR × 2 !', d:'```\n× 1.0 → × 1.25 → × 1.5 → × 1.75 → × 2.0 !!!\n```' },
      { c:'#E67E22', t:'⚡⚡ SOLDE DOUBLÉ ⚡⚡',   d:`*Ton solde vient de doubler !*\n\n💥 **+${gain.toLocaleString()} ${coin}**` },
    ];
    for (const { c, t, d } of dSeq) {
      await msg.edit({ embeds:[new EmbedBuilder().setColor(c).setTitle(t).setDescription(d)] }).catch(()=>{});
      await sleep(450);
    }
  }

  // ── Résultat final ───────────────────────────────────────────
  let resTitle, resDesc, resColor;

  if (sector.type === 'jackpot') {
    resColor = '#FFD700'; resTitle = '🌟 ✨ JACKPOT ABSOLU ✨ 🌟';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', '║   🌟  J A C K P O T   A B S O L U  🌟  ║', `║   🎊  +${String((gain.toLocaleString()+' '+coin)).padEnd(34)}║`, '╚══════════════════════════════════════════╝', '```'].join('\n');
  } else if (sector.type === 'double') {
    resColor = '#F39C12'; resTitle = '⚡ MISE DOUBLÉE !';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', `║  ⚡  ×2 ACTIVÉ ! +${String((gain.toLocaleString()+' '+coin)).padEnd(22)}║`, '╚══════════════════════════════════════════╝', '```'].join('\n');
  } else if (sector.type === 'win') {
    const stars = gain >= 2500 ? '⭐⭐⭐' : gain >= 1000 ? '⭐⭐' : '⭐';
    resColor = sector.color; resTitle = `${stars} Gagné ! ${stars}`;
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', `║  🎉  +${String((gain.toLocaleString()+' '+coin)).padEnd(34)}║`, '╚══════════════════════════════════════════╝', '```'].join('\n');
  } else if (sector.type === 'mystery') {
    resColor = '#9B59B6'; resTitle = '🎁 MYSTÈRE !';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', `║  🎁  MYSTÈRE ! +${String((gain.toLocaleString()+' '+coin)).padEnd(25)}║`, '╚══════════════════════════════════════════╝', '```'].join('\n');
  } else if (sector.type === 'reroll') {
    resColor = '#3498DB'; resTitle = '🔄 RELANCER !';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', '║  🔄  RELANCER — Cooldown réinitialisé !  ║', `║  🎡  +${String((gain+' '+coin)).padEnd(35)}║`, '╚══════════════════════════════════════════╝', '```'].join('\n');
  } else if (sector.type === 'pass') {
    resColor = '#7F8C8D'; resTitle = '➡️ PASSE';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '*Ni gagné, ni perdu — tu passes ce tour.*'].join('\n');
  } else {
    resColor = '#2C3E50'; resTitle = '💀 FAILLITE';
    resDesc = [renderWheelCircle(finalIdx, false, true), '', '```', '╔══════════════════════════════════════════╗', '║  💀  FAILLITE — La Fortune t\'a dit non ! ║', '╚══════════════════════════════════════════╝', '```', '*Courage ! La roue revient dans 30 min.*'].join('\n');
  }

  const finalEmbed = new EmbedBuilder()
    .setColor(resColor)
    .setTitle(resTitle)
    .setDescription(resDesc)
    .addFields(
      { name: '🎡 Secteur',  value: `**${sector.label}**`,                                     inline: true },
      { name: gain > 0 ? '💰 Gain' : '📊 Résultat', value: gain > 0 ? `**+${gain.toLocaleString()} ${coin}**` : '—', inline: true },
      { name: '🏦 Solde',    value: `**${newBalance.toLocaleString()} ${coin}**`,              inline: true },
    )
    .setFooter({ text: sector.type === 'reroll' ? '✅ Cooldown réinitialisé — rejoue maintenant !' : '⏳ Reviens dans 30 min · Roue de la Fortune · Gratuit' })
    .setTimestamp();

  // ── Boutons ──────────────────────────────────────────────────
  const canDouble = gain > 0 && !['reroll','jackpot','double'].includes(sector.type);
  const isReroll  = sector.type === 'reroll';

  const btnArr = [
    new ButtonBuilder()
      .setCustomId(isReroll ? `rf_reroll_${userId}` : `rf_cd_disabled_${userId}`)
      .setLabel(isReroll ? '🎡 Rejouer maintenant !' : '⏳ Reviens dans 30 min')
      .setStyle(isReroll ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!isReroll),
    new ButtonBuilder()
      .setCustomId(`rf_sectors_${userId}`)
      .setLabel('📋 Voir tous les secteurs')
      .setStyle(ButtonStyle.Secondary),
  ];

  if (canDouble) {
    btnArr.push(
      new ButtonBuilder()
        .setCustomId(`rf_doublerien_${userId}_${gain}`)
        .setLabel(`🎲 Double ou rien (+${gain.toLocaleString()})`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  const btns = new ActionRowBuilder().addComponents(...btnArr);
  await msg.edit({ embeds: [finalEmbed], components: [btns] });
}

// ─── handleComponent ──────────────────────────────────────────
async function handleComponent(interaction, cid) {
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;
  const coin    = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (cid.startsWith('rf_cd_disabled_')) {
    await interaction.reply({ content: '⏳ La roue est en recharge (30 min). Reviens plus tard !', ephemeral: true }).catch(() => {});
    return true;
  }

  if (cid.startsWith('rf_sectors_')) {
    const targetId = cid.replace('rf_sectors_', '');
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const total = WEIGHTS.reduce((a, b) => a + b, 0);
    const seen  = new Map();
    SECTORS.forEach((s, idx) => {
      if (!seen.has(s.label)) seen.set(s.label, { s, w: 0 });
      seen.get(s.label).w += WEIGHTS[idx];
    });
    const lines = [...seen.values()]
      .sort((a, b) => b.w - a.w)
      .map(({ s, w }) => {
        const pct   = ((w / total) * 100).toFixed(1);
        const prize = s.type === 'jackpot' ? `🌟 ${s.coins.toLocaleString()} ${coin}`
                    : s.type === 'win'     ? `+${s.coins.toLocaleString()} ${coin}`
                    : s.type === 'double'  ? '×2 ton solde'
                    : s.type === 'mystery' ? '🎁 300–3 300 (aléatoire)'
                    : s.type === 'reroll'  ? `🔄 ${s.coins} ${coin} + cooldown réinitialisé`
                    : s.type === 'pass'    ? 'Passe le tour'
                    : '💀 Faillite (0)';
        return `${s.emoji} **${s.label}** — *${pct}%* → ${prize}`;
      });
    const listEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('📋 Secteurs de la Roue — Probabilités')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${SECTORS.length} secteurs au total` });
    await interaction.followUp({ embeds: [listEmbed], ephemeral: true }).catch(() => {});
    return true;
  }

  if (cid.startsWith('rf_doublerien_')) {
    const parts    = cid.split('_');
    const targetId = parts[2];
    const gain     = parseInt(parts[3]) || 0;

    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    if (gain <= 0) {
      await interaction.reply({ content: '❌ Montant invalide.', ephemeral: true }).catch(() => {});
      return true;
    }

    await interaction.deferUpdate().catch(() => {});

    let disabledRow;
    try {
      const comps = interaction.message.components[0]?.components || [];
      disabledRow = new ActionRowBuilder().addComponents(
        comps.map(c => ButtonBuilder.from(c.toJSON()).setDisabled(true))
      );
    } catch {
      disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rf_done').setLabel('Terminé').setStyle(ButtonStyle.Secondary).setDisabled(true)
      );
    }

    const won = Math.random() < 0.5;

    // Animation pièce qui tourne
    const coinFaces = ['🟡', '⚪', '🟡', '⚪', '🟡', '⚪'];
    for (const face of coinFaces) {
      const frames = `${face} Double ou rien ? ${face}`;
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('🎲 Double ou Rien !')
        .setDescription([
          '```',
          '╔════════════════════════════╗',
          `║  ${face}  La pièce tourne...  ${face}  ║`,
          `║  💰  ${gain.toLocaleString().padEnd(8)} ${coin}  en jeu  ║`,
          '╚════════════════════════════╝',
          '```',
          '*Pile = Doublé  |  Face = Perdu*',
        ].join('\n'))
      ], components: [disabledRow] }).catch(() => {});
      await sleep(300);
    }

    if (won) {
      db.addCoins(userId, guildId, gain);
      const nb2 = db.getUser(userId, guildId)?.balance || 0;
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('🎲 DOUBLE OU RIEN → 🎊 DOUBLÉ !')
          .setDescription([
            '```',
            '╔══════════════════════════════════════════╗',
            '║  🎊  COUP DE MAÎTRE — GAIN DOUBLÉ !  🎊  ║',
            '╚══════════════════════════════════════════╝',
            '```',
            `🍀 **+${gain.toLocaleString()} ${coin}** supplémentaires !`,
          ].join('\n'))
          .addFields(
            { name: '💰 Gain total',    value: `**+${(gain*2).toLocaleString()} ${coin}**`, inline: true },
            { name: '🏦 Nouveau solde', value: `**${nb2.toLocaleString()} ${coin}**`,        inline: true },
          )
          .setFooter({ text: '🎲 Le risque a payé !' })
          .setTimestamp()],
        components: [disabledRow],
      }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -gain);
      const nb2 = db.getUser(userId, guildId)?.balance || 0;
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🎲 DOUBLE OU RIEN → 💸 PERDU !')
          .setDescription([
            '```',
            '╔══════════════════════════════════════════╗',
            '║  💸  MALCHANCE — GAIN PERDU !  💸         ║',
            '╚══════════════════════════════════════════╝',
            '```',
            `😔 **-${gain.toLocaleString()} ${coin}** retirés.`,
          ].join('\n'))
          .addFields(
            { name: '📉 Perte',         value: `**-${gain.toLocaleString()} ${coin}**`, inline: true },
            { name: '🏦 Nouveau solde', value: `**${nb2.toLocaleString()} ${coin}**`,   inline: true },
          )
          .setFooter({ text: '🎲 Parfois il faut savoir s\'arrêter !' })
          .setTimestamp()],
        components: [disabledRow],
      }).catch(() => {});
    }
    return true;
  }

  if (cid.startsWith('rf_reroll_')) {
    const targetId = cid.replace('rf_reroll_', '');
    if (userId !== targetId) {
      await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    await playRoueFortune(interaction, userId, guildId);
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue-fortune')
    .setDescription('🎡 La Roue de la Fortune — Vraie roue circulaire ! Gratuit · Cooldown 30 min'),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playRoueFortune(interaction, interaction.user.id, interaction.guildId);
  },

  handleComponent,

  name: 'roue-fortune',
  aliases: ['roue', 'fortune', 'rf'],
  async run(message) {
    await playRoueFortune(message, message.author.id, message.guildId);
  },
};
