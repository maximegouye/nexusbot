// ============================================================
// hippodrome.js — Hippodrome ultra-complet avec 3 types de paris
// ============================================================
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { C, chipStr, balanceLine, casinoFooter, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════════════════════
// DONNÉES
// ══════════════════════════════════════════════════════════

const HORSE_POOL = [
  { id: 1,  name: 'Éclair',   emoji: '⚡',  jockey: 'J. Dupont',   baseOdds: 1.8,  spec: 'sec',    form: '🟢🟢🟢🟡🟢' },
  { id: 2,  name: 'Tonnerre', emoji: '🌩️', jockey: 'M. Martin',   baseOdds: 2.5,  spec: 'pluie',  form: '🟢🟢🟡🟡🟢' },
  { id: 3,  name: 'Mistral',  emoji: '🌬️', jockey: 'P. Bernard',  baseOdds: 3.5,  spec: 'vent',   form: '🟡🟢🔴🟢🟡' },
  { id: 4,  name: 'Alizé',    emoji: '🌊',  jockey: 'S. Leblanc',  baseOdds: 5.0,  spec: 'pluie',  form: '🟡🔴🟢🟡🟡' },
  { id: 5,  name: 'Tempête',  emoji: '🌪️', jockey: 'A. Rousseau', baseOdds: 7.0,  spec: 'vent',   form: '🔴🟡🔴🟢🔴' },
  { id: 6,  name: 'Ouragan',  emoji: '💨',  jockey: 'C. Petit',    baseOdds: 10.0, spec: 'sec',    form: '🔴🔴🟡🔴🟢' },
  { id: 7,  name: 'Foudre',   emoji: '☁️',  jockey: 'T. Moreau',   baseOdds: 15.0, spec: 'pluie',  form: '🟡🔴🔴🔴🟡' },
  { id: 8,  name: 'Cyclone',  emoji: '🌀',  jockey: 'E. Leroy',    baseOdds: 20.0, spec: 'sec',    form: '🔴🔴🔴🟡🔴' },
  { id: 9,  name: 'Rafale',   emoji: '🌫️', jockey: 'N. Simon',    baseOdds: 28.0, spec: 'vent',   form: '🔴🔴🔴🔴🟡' },
  { id: 10, name: 'Zephyr',   emoji: '🍃',  jockey: 'L. Richard',  baseOdds: 40.0, spec: 'sec',    form: '🔴🔴🔴🔴🔴' },
];

// Conditions de piste du jour
const TRACK_CONDITIONS = [
  {
    id: 'sec', label: '☀️ Piste sèche', short: 'Sec',
    desc: 'Conditions optimales — les favoris sont avantagés',
    modifier: h => h.spec === 'sec' ? 0.78 : h.spec === 'pluie' ? 1.25 : 1.0,
  },
  {
    id: 'pluie', label: '🌧️ Piste mouillée', short: 'Pluie',
    desc: 'Piste glissante — les spécialistes pluie brillent',
    modifier: h => h.spec === 'pluie' ? 0.75 : h.spec === 'sec' ? 1.3 : 1.05,
  },
  {
    id: 'vent', label: '💨 Vent violent', short: 'Vent',
    desc: 'Rafales perturbantes — seuls les spécialistes résistent',
    modifier: h => h.spec === 'vent' ? 0.78 : 1.1,
  },
  {
    id: 'boue', label: '⛈️ Boue profonde', short: 'Boue',
    desc: 'Chaos total — les outsiders adorent ça !',
    modifier: h => h.baseOdds > 10 ? 0.65 : 1.35,
  },
];

const RACE_STEPS = 8;
const TRACK_W    = 15;

const LIVE_COMMENTS = [
  '🎙️ Les chevaux s\'élancent dans le premier virage !',
  '🎙️ Le peloton se forme — la stratégie commence !',
  '🎙️ Ça joue des coudes dans le groupe de tête !',
  '🎙️ Le public est en délire dans les tribunes !',
  '🎙️ Les jockeys donnent leurs dernières consignes !',
  '🎙️ On aborde le virage décisif — tout peut arriver !',
  '🎙️ Les chevaux entrent dans la ligne droite finale !',
  '🎙️ Sprint final — qui va franchir la ligne ?!',
];

// ══════════════════════════════════════════════════════════
// ÉTAT EN MÉMOIRE
// ══════════════════════════════════════════════════════════

const hippoSessions = new Map(); // userId → { mise, betType, horse1, horse2 }
const hippoStats    = new Map(); // userId → { wins, losses, wagered, won, gamesPlayed, bestWin }

function getStat(userId) {
  if (!hippoStats.has(userId))
    hippoStats.set(userId, { wins: 0, losses: 0, wagered: 0, won: 0, gamesPlayed: 0, bestWin: 0 });
  return hippoStats.get(userId);
}

// ══════════════════════════════════════════════════════════
// LOGIQUE DU JOUR
// ══════════════════════════════════════════════════════════

// 8 chevaux du jour (seed par date → cohérent toute la journée)
function getDayHorses() {
  const dateStr = new Date().toISOString().split('T')[0];
  let seed = dateStr.split('-').reduce((acc, n) => acc + parseInt(n, 10), 0);
  const pool = [...HORSE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    seed = ((seed * 1664525) + 1013904223) & 0x7fffffff;
    const j = seed % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 8);
}

// Condition du jour (change toutes les 6 heures)
function getDayCondition() {
  const slot = Math.floor(new Date().getHours() / 6);
  return TRACK_CONDITIONS[slot % TRACK_CONDITIONS.length];
}

function getAdjustedOdds(horse, condition) {
  return Math.round(horse.baseOdds * condition.modifier(horse) * 10) / 10;
}

// ══════════════════════════════════════════════════════════
// MOTEUR DE COURSE
// ══════════════════════════════════════════════════════════

// Gagnant pondéré inversement aux cotes
function pickWeighted(pool, condition) {
  const weights = pool.map(h => 1 / getAdjustedOdds(h, condition));
  const total   = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[0];
}

// Classement final complet (pondéré par les cotes)
function buildFinalRanking(horses, condition) {
  const ranked    = [];
  const remaining = [...horses];
  while (remaining.length > 0) {
    const winner = pickWeighted(remaining, condition);
    ranked.push(winner);
    remaining.splice(remaining.indexOf(winner), 1);
  }
  return ranked; // ranked[0] = 1er
}

// Cartes d'animation : pour chaque étape, position de chaque cheval (0..1)
function buildPositionMaps(ranking) {
  const n    = ranking.length;
  const maps = [];
  for (let step = 0; step <= RACE_STEPS; step++) {
    const t     = step / RACE_STEPS;
    const entry = {};
    ranking.forEach((horse, rank) => {
      const rankBonus = 1 - (rank / n) * 0.18;
      const noise     = (Math.random() - 0.5) * 0.1;
      entry[horse.id] = Math.max(0, Math.min(t * rankBonus + noise, step === RACE_STEPS ? 1 - rank * 0.07 : 0.93));
    });
    maps.push(entry);
  }
  // Garantir le classement à l'arrivée
  const last     = maps[RACE_STEPS];
  const maxOther = Math.max(...ranking.slice(1).map(h => last[h.id]));
  if (last[ranking[0].id] <= maxOther) last[ranking[0].id] = Math.min(1.0, maxOther + 0.06);
  return maps;
}

// ── Rendu d'une piste ─────────────────────────────────────
function renderTrack(progress) {
  const p    = Math.max(0, Math.min(progress, 1));
  const fill = Math.floor(p * TRACK_W);
  return '═'.repeat(fill) + '🐴' + '─'.repeat(TRACK_W - fill) + '🏁';
}

// ── Embed d'une frame de course ───────────────────────────
function buildRaceEmbed(step, posMap, horses, focusIds, mise, betLbl, coin) {
  const sorted  = [...horses].sort((a, b) => (posMap[b.id] || 0) - (posMap[a.id] || 0));
  const comment = step > 0 ? LIVE_COMMENTS[Math.min(step - 1, LIVE_COMMENTS.length - 1)] : '🎙️ Ils sont sur la ligne de départ !';

  const lines = sorted.map((h, idx) => {
    const pos    = posMap[h.id] || 0;
    const track  = renderTrack(pos);
    const marker = focusIds.includes(h.id) ? '👤' : `${idx + 1}.`;
    const pct    = Math.floor(pos * 100);
    return `${marker}${h.emoji}**${h.name.padEnd(9)}** ${track} ${pct}%`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(step === RACE_STEPS ? '#8E44AD' : C.NEUTRAL)
    .setTitle(`🏇 Course en direct — Tour ${step}/${RACE_STEPS}`)
    .setDescription(`${lines}\n\n${comment}`)
    .addFields(
      { name: '💰 Mise', value: chipStr(mise, coin), inline: true },
      { name: '🎯 Pari', value: betLbl,              inline: true },
    )
    .setFooter({ text: casinoFooter('Hippodrome') });
}

// ══════════════════════════════════════════════════════════
// CALCUL DES GAINS
// ══════════════════════════════════════════════════════════

function computePayout(betType, mise, horse1, horse2, ranking, condition) {
  const pos1  = ranking.findIndex(h => h.id === horse1.id);
  const odds1 = getAdjustedOdds(horse1, condition);

  if (betType === 'gagnant') {
    if (pos1 === 0) {
      const payout = Math.floor(mise * odds1);
      return { win: true, payout, desc: `🥇 **${horse1.emoji} ${horse1.name}** remporte la victoire ! Gain : **×${odds1}**` };
    }
    return { win: false, payout: 0, desc: `💨 **${horse1.emoji} ${horse1.name}** finit ${pos1 + 1}ème — raté de peu...` };
  }

  if (betType === 'place') {
    if (pos1 <= 2) {
      const placeOdds = Math.round(Math.max(1.3, odds1 / 3) * 10) / 10;
      const payout    = Math.floor(mise * placeOdds);
      const medal     = pos1 === 0 ? '🥇' : pos1 === 1 ? '🥈' : '🥉';
      return { win: true, payout, desc: `${medal} **${horse1.emoji} ${horse1.name}** finit ${pos1 + 1}ème — dans le top 3 ! (×${placeOdds})` };
    }
    return { win: false, payout: 0, desc: `💨 **${horse1.emoji} ${horse1.name}** finit ${pos1 + 1}ème — hors du top 3.` };
  }

  if (betType === 'couple' && horse2) {
    const pos2   = ranking.findIndex(h => h.id === horse2.id);
    const odds2  = getAdjustedOdds(horse2, condition);
    if (pos1 === 0 && pos2 === 1) {
      const coupleOdds = Math.round(odds1 * odds2 * 0.55 * 10) / 10;
      const payout     = Math.floor(mise * coupleOdds);
      return { win: true, payout, desc: `🎉 **Couplé gagnant !** ${horse1.emoji}${horse1.name} 1er & ${horse2.emoji}${horse2.name} 2ème ! (×${coupleOdds})` };
    }
    return { win: false, payout: 0, desc: `💨 Couplé raté — ${horse1.emoji}${horse1.name} finit ${pos1+1}ème, ${horse2.emoji}${horse2.name} finit ${pos2+1}ème.` };
  }

  return { win: false, payout: 0, desc: 'Résultat inconnu.' };
}

// ══════════════════════════════════════════════════════════
// INTERFACES DISCORD
// ══════════════════════════════════════════════════════════

function makeBetLabel(betType, h1, h2) {
  if (betType === 'gagnant') return `🏆 Gagnant — ${h1.emoji}${h1.name}`;
  if (betType === 'place')   return `🎯 Placé — ${h1.emoji}${h1.name}`;
  if (betType === 'couple')  return `🔗 Couplé — ${h1.emoji}${h1.name} + ${h2 ? h2.emoji + h2.name : '?'}`;
  return '?';
}

function buildPostRaceRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hippo_replay_${userId}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`hippo_newbet_${userId}`).setLabel('🎯 Nouveau pari').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`hippo_changemise_${userId}`).setLabel('💰 Changer mise').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hippo_stats_${userId}`).setLabel('📊 Stats').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hippo_cotes_${userId}`).setLabel('📋 Cotes').setStyle(ButtonStyle.Secondary),
  );
}

// ── Écran pré-course ──────────────────────────────────────
async function showPreRace(source, userId, guildId, mise, asReply = false) {
  const horses    = getDayHorses();
  const condition = getDayCondition();
  const cfg       = (db.getConfig ? db.getConfig(guildId) : null) || {};
  const coin      = cfg.currency_emoji || '🪙';

  const horseLines = horses.map((h, i) => {
    const adj    = getAdjustedOdds(h, condition);
    const isSpec = h.spec === condition.id;
    return `${isSpec ? '⭐' : '▫️'} ${h.emoji} **#${i + 1} ${h.name}** — ×${adj} | ${h.form} | 🏇 *${h.jockey}*${isSpec ? ' *(Spécialiste)*' : ''}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor('#2C3E50')
    .setTitle('🏇 Hippodrome — Programme du jour')
    .setDescription(
      `**${condition.label}** — *${condition.desc}*\n\n${horseLines}`
    )
    .addFields(
      { name: '💰 Mise', value: chipStr(mise, coin), inline: true },
      { name: '🏆 Gagnant', value: '×cote si 1er', inline: true },
      { name: '🎯 Placé', value: '×(cote÷3) si top 3', inline: true },
      { name: '🔗 Couplé', value: '×(c1×c2×0.55) si 1er+2ème en ordre', inline: false },
    )
    .setFooter({ text: '⭐ = Spécialiste de la condition du jour | 🟢=Victoire 🟡=Podium 🔴=Défaite' });

  const betRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hippo_bet_${userId}_gagnant_${mise}`).setLabel('🏆 Gagnant').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`hippo_bet_${userId}_place_${mise}`).setLabel('🎯 Placé top 3').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`hippo_bet_${userId}_couple_${mise}`).setLabel('🔗 Couplé').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`hippo_cotes_${userId}`).setLabel('📋 Cotes').setStyle(ButtonStyle.Secondary),
  );

  const opts = { embeds: [embed], components: [betRow] };
  if (asReply) await source.reply({ ...opts, ephemeral: true }).catch(() => {});
  else         await source.editReply(opts).catch(() => {});
}

// ── Sélection du cheval ───────────────────────────────────
async function showHorsePicker(source, userId, guildId, mise, betType, excludeHorseId = null, asReply = false) {
  const horses    = getDayHorses();
  const condition = getDayCondition();
  const available = excludeHorseId ? horses.filter(h => h.id !== excludeHorseId) : horses;

  const isSecond = excludeHorseId !== null;
  const prefix   = isSecond
    ? `hippo_h2_${userId}_${betType}_${mise}_${excludeHorseId}`
    : `hippo_h1_${userId}_${betType}_${mise}`;

  const descLines = available.map(h => {
    const adj    = getAdjustedOdds(h, condition);
    const isSpec = h.spec === condition.id;
    let gainInfo;
    if (betType === 'gagnant')       gainInfo = `🏆 ×${adj}`;
    else if (betType === 'place')    gainInfo = `🎯 ×${Math.round(Math.max(1.3, adj / 3) * 10) / 10}`;
    else if (!isSecond)              gainInfo = `🔗 cote ×${adj}`;
    else {
      const h1    = horses.find(x => x.id === excludeHorseId);
      const odds1 = getAdjustedOdds(h1, condition);
      gainInfo    = `🔗 ×${Math.round(odds1 * adj * 0.55 * 10) / 10} si gagnant`;
    }
    return `${isSpec ? '⭐' : '▫️'} ${h.emoji} **${h.name}** — ${gainInfo} — ${h.form}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(C.NEUTRAL)
    .setTitle(`🏇 Hippodrome — ${isSecond ? 'Choisis le 2ème cheval (couplé)' : 'Choisis ton cheval'}`)
    .setDescription(descLines)
    .setFooter({ text: casinoFooter('Hippodrome') });

  const rows = [];
  for (let i = 0; i < available.length; i += 4) {
    const chunk = available.slice(i, i + 4);
    rows.push(new ActionRowBuilder().addComponents(
      ...chunk.map(h => {
        const adj    = getAdjustedOdds(h, condition);
        const isSpec = h.spec === condition.id;
        const style  = adj <= 3 ? ButtonStyle.Success : adj <= 8 ? ButtonStyle.Primary : ButtonStyle.Danger;
        return new ButtonBuilder()
          .setCustomId(`${prefix}_${h.id}`)
          .setLabel(`${h.name} ×${adj}${isSpec ? '⭐' : ''}`)
          .setStyle(style);
      })
    ));
  }

  const opts = { embeds: [embed], components: rows };
  if (asReply) await source.reply({ ...opts, ephemeral: true }).catch(() => {});
  else         await source.editReply(opts).catch(() => {});
}

// ── Course principale ─────────────────────────────────────
async function runRace(source, userId, guildId, mise, betType, horse1Id, horse2Id) {
  const cfg       = (db.getConfig ? db.getConfig(guildId) : null) || {};
  const coin      = cfg.currency_emoji || '🪙';
  const u         = db.getUser(userId, guildId);
  const horses    = getDayHorses();
  const condition = getDayCondition();

  const horse1 = horses.find(h => h.id === horse1Id);
  const horse2 = horse2Id ? horses.find(h => h.id === horse2Id) : null;

  // Validations
  if (!u)      return source.editReply({ content: '❌ Profil introuvable.', components: [] }).catch(() => {});
  if (!horse1) return source.editReply({ content: '❌ Cheval introuvable.', components: [] }).catch(() => {});
  if (betType === 'couple' && !horse2)
    return source.editReply({ content: '❌ Sélectionne un 2ème cheval pour le couplé.', components: [] }).catch(() => {});
  if (mise < 5)
    return source.editReply({ content: '❌ Mise minimale : **5 coins**.', components: [] }).catch(() => {});
  if (mise > u.balance)
    return source.editReply({ content: `❌ Solde insuffisant — tu as **${u.balance.toLocaleString('fr-FR')} ${coin}**.`, components: [] }).catch(() => {});

  // Déduire la mise & sauvegarder session
  db.addCoins(userId, guildId, -mise);
  const balBefore = u.balance;
  hippoSessions.set(userId, { mise, betType, horse1: horse1Id, horse2: horse2Id || null });

  const focusIds = [horse1Id, horse2Id].filter(Boolean);
  const betLbl   = makeBetLabel(betType, horse1, horse2);

  // Générer le résultat & positions
  const ranking     = buildFinalRanking(horses, condition);
  const positionMaps = buildPositionMaps(ranking);

  // ── Prépration ──────────────────────────────────────────
  const horseSummary = horses.slice(0, 4).map(h => `${h.emoji}${h.name} ×${getAdjustedOdds(h, condition)}`).join(' | ') + '\n'
    + horses.slice(4).map(h => `${h.emoji}${h.name} ×${getAdjustedOdds(h, condition)}`).join(' | ');

  await source.editReply({
    embeds: [new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('🏇 Hippodrome — Préparation au départ')
      .setDescription(`**${condition.label}** — *${condition.desc}*\n\n${horseSummary}`)
      .addFields(
        { name: '💰 Mise', value: chipStr(mise, coin), inline: true },
        { name: '🎯 Ton pari', value: betLbl, inline: true },
      )
      .setFooter({ text: casinoFooter('Hippodrome') })
    ],
    components: [],
  }).catch(() => {});

  await sleep(900);

  // ── Compte à rebours ──────────────────────────────────────
  const countdown = [
    ['3…', '#E74C3C'], ['2…', '#E67E22'], ['1…', '#F1C40F'], ['🚀 PARTIS !', '#2ECC71'],
  ];
  for (const [txt, color] of countdown) {
    await source.editReply({
      embeds: [new EmbedBuilder()
        .setColor(color)
        .setTitle('🏁 Hippodrome — Départ !')
        .setDescription(`\n# ${txt}\n`)
        .setFooter({ text: casinoFooter('Hippodrome') })
      ],
    }).catch(() => {});
    await sleep(txt === '🚀 PARTIS !' ? 650 : 600);
  }

  // ── Animation de la course ───────────────────────────────
  for (let step = 1; step <= RACE_STEPS; step++) {
    const frame = buildRaceEmbed(step, positionMaps[step], horses, focusIds, mise, betLbl, coin);
    await source.editReply({ embeds: [frame] }).catch(() => {});
    await sleep(step === RACE_STEPS ? 500 : 950);
  }

  // ── Photo-finish ─────────────────────────────────────────
  await source.editReply({
    embeds: [new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('📸 Photo-finish en cours...')
      .setDescription('```\n⚡ Dépouillement de l\'image...\n```')
      .setFooter({ text: casinoFooter('Hippodrome') })
    ],
  }).catch(() => {});
  await sleep(1000);

  // ── Résultat ────────────────────────────────────────────
  const result = computePayout(betType, mise, horse1, horse2, ranking, condition);
  const stat   = getStat(userId);
  stat.gamesPlayed++;
  stat.wagered += mise;

  let gain, newBalance;
  if (result.win) {
    gain       = result.payout - mise;
    newBalance = balBefore - mise + result.payout;
    db.addCoins(userId, guildId, result.payout);
    stat.wins++;
    stat.won += result.payout;
    if (gain > stat.bestWin) stat.bestWin = gain;
  } else {
    gain       = -mise;
    newBalance = balBefore - mise;
    stat.losses++;
  }

  // Podium final
  const medals    = ['🥇', '🥈', '🥉'];
  const podiumStr = ranking.slice(0, 3).map((h, i) => {
    const adj = getAdjustedOdds(h, condition);
    return `${medals[i]} ${h.emoji} **${h.name}** (×${adj} | ${h.form})`;
  }).join('\n');

  const finalEmbed = new EmbedBuilder()
    .setColor(result.win ? C.WIN : C.LOSS)
    .setTitle(result.win ? '🏆 Hippodrome — Victoire !' : '❌ Hippodrome — Défaite')
    .addFields(
      { name: result.win ? '🎉 Résultat' : '💨 Résultat', value: result.desc, inline: false },
      { name: '🏇 Podium', value: podiumStr, inline: true },
      { name: '💰 Bilan', value: balanceLine(newBalance, gain, coin), inline: true },
      {
        name: '📊 Session',
        value: `✅ ${stat.wins} victoire${stat.wins > 1 ? 's' : ''}  ❌ ${stat.losses} défaite${stat.losses > 1 ? 's' : ''}  🎮 ${stat.gamesPlayed} partie${stat.gamesPlayed > 1 ? 's' : ''}`,
        inline: false,
      },
    )
    .setFooter({ text: casinoFooter('Hippodrome') });

  await source.editReply({ embeds: [finalEmbed], components: [buildPostRaceRow(userId)] }).catch(() => {});
}

// ══════════════════════════════════════════════════════════
// HANDLER DES COMPOSANTS
// ══════════════════════════════════════════════════════════

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('hippo_')) return false;

  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  // Vérif propriétaire (userId encodé en 3ème segment après hippo_xxx_)
  function isOwner(minParts) {
    const parts = customId.split('_');
    return parts.length >= minParts && parts[2] === userId;
  }

  // ── Sélection du type de pari ──────────────────────────
  // hippo_bet_{userId}_{betType}_{mise}
  if (customId.startsWith('hippo_bet_')) {
    if (!isOwner(5)) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton pari.', ephemeral: true }).catch(() => {});
      return true;
    }
    const parts   = customId.split('_');
    const betType = parts[3];
    const mise    = parseInt(parts[4]);
    await interaction.deferUpdate().catch(() => {});
    await showHorsePicker(interaction, userId, guildId, mise, betType);
    return true;
  }

  // ── 1er cheval choisi ──────────────────────────────────
  // hippo_h1_{userId}_{betType}_{mise}_{horseId}
  if (customId.startsWith('hippo_h1_')) {
    if (!isOwner(6)) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton pari.', ephemeral: true }).catch(() => {});
      return true;
    }
    const parts   = customId.split('_');
    const betType = parts[3];
    const mise    = parseInt(parts[4]);
    const horseId = parseInt(parts[5]);

    await interaction.deferUpdate().catch(() => {});
    if (betType === 'couple') {
      await showHorsePicker(interaction, userId, guildId, mise, 'couple', horseId);
    } else {
      await runRace(interaction, userId, guildId, mise, betType, horseId, null);
    }
    return true;
  }

  // ── 2ème cheval choisi (couplé) ────────────────────────
  // hippo_h2_{userId}_{betType}_{mise}_{horse1Id}_{horse2Id}
  if (customId.startsWith('hippo_h2_')) {
    if (!isOwner(7)) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton pari.', ephemeral: true }).catch(() => {});
      return true;
    }
    const parts  = customId.split('_');
    const betType = parts[3];
    const mise   = parseInt(parts[4]);
    const horse1 = parseInt(parts[5]);
    const horse2 = parseInt(parts[6]);
    await interaction.deferUpdate().catch(() => {});
    await runRace(interaction, userId, guildId, mise, betType, horse1, horse2);
    return true;
  }

  // ── Rejouer (même pari) ───────────────────────────────
  if (customId === `hippo_replay_${userId}`) {
    const session = hippoSessions.get(userId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Session expirée. Relance `/hippodrome`.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    await runRace(interaction, userId, guildId, session.mise, session.betType, session.horse1, session.horse2);
    return true;
  }

  // ── Nouveau pari (retour à l'écran pré-course) ─────────
  if (customId === `hippo_newbet_${userId}`) {
    const mise = hippoSessions.get(userId)?.mise || 100;
    await interaction.deferUpdate().catch(() => {});
    await showPreRace(interaction, userId, guildId, mise);
    return true;
  }

  // ── Changer la mise ───────────────────────────────────
  if (customId === `hippo_changemise_${userId}`) {
    await interaction.showModal(changeMiseModal('hippo', userId)).catch(() => {});
    return true;
  }

  // ── Modal mise ────────────────────────────────────────
  if (customId.startsWith(`hippo_modal_${userId}`)) {
    const u    = db.getUser(userId, guildId);
    const cfg  = (db.getConfig ? db.getConfig(guildId) : null) || {};
    const coin = cfg.currency_emoji || '🪙';
    if (!u) { await interaction.reply({ content: '❌ Profil introuvable.', ephemeral: true }).catch(() => {}); return true; }
    const raw     = interaction.fields.getTextInputValue('newmise');
    const newMise = parseMise(raw, u.balance);
    if (!newMise || isNaN(newMise) || newMise < 5) {
      await interaction.reply({ content: `❌ Mise invalide (min 5 ${coin}).`, ephemeral: true }).catch(() => {});
      return true;
    }
    if (newMise > u.balance) {
      await interaction.reply({ content: `❌ Solde insuffisant — tu as **${u.balance.toLocaleString('fr-FR')} ${coin}**.`, ephemeral: true }).catch(() => {});
      return true;
    }
    await showPreRace(interaction, userId, guildId, newMise, true);
    return true;
  }

  // ── Stats session ──────────────────────────────────────
  if (customId === `hippo_stats_${userId}`) {
    const stat    = getStat(userId);
    const cfg     = (db.getConfig ? db.getConfig(guildId) : null) || {};
    const coin    = cfg.currency_emoji || '🪙';
    const net     = stat.won - stat.wagered;
    const winRate = stat.gamesPlayed > 0 ? Math.round(stat.wins / stat.gamesPlayed * 100) : 0;
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Tes stats Hippodrome — Session')
        .addFields(
          { name: '🎮 Parties', value: `**${stat.gamesPlayed}**`, inline: true },
          { name: '✅ Victoires', value: `**${stat.wins}**`, inline: true },
          { name: '❌ Défaites', value: `**${stat.losses}**`, inline: true },
          { name: '📈 Win rate', value: `**${winRate}%**`, inline: true },
          { name: '💰 Total misé', value: `**${stat.wagered.toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: `${net >= 0 ? '📈' : '📉'} Bilan net`, value: `**${net >= 0 ? '+' : ''}${net.toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: '🏆 Meilleur gain', value: `**${stat.bestWin.toLocaleString('fr-FR')} ${coin}**`, inline: true },
        )
        .setFooter({ text: 'Stats de la session en cours uniquement' })
      ],
      ephemeral: true,
    }).catch(() => {});
    return true;
  }

  // ── Tableau des cotes ────────────────────────────────
  if (customId.startsWith('hippo_cotes_')) {
    const horses    = getDayHorses();
    const condition = getDayCondition();
    const cfg       = (db.getConfig ? db.getConfig(guildId) : null) || {};
    const coin      = cfg.currency_emoji || '🪙';

    const lines = horses.map((h, i) => {
      const adj    = getAdjustedOdds(h, condition);
      const place  = Math.round(Math.max(1.3, adj / 3) * 10) / 10;
      const isSpec = h.spec === condition.id;
      const chance = Math.round(100 / adj);
      return `${isSpec ? '⭐' : '▫️'} ${h.emoji} **${h.name}** *(${h.jockey})*\n` +
        `　└ 🏆 Gagnant: ×**${adj}** | 🎯 Placé: ×**${place}** | ~${chance}% de victoire | Forme: ${h.form}`;
    }).join('\n\n');

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`📋 Cotes du jour — ${condition.label}`)
        .setDescription(`*${condition.desc}*\n\n${lines}`)
        .setFooter({ text: '⭐ = Spécialiste de la condition | Cotes changent selon la météo du jour' })
      ],
      ephemeral: true,
    }).catch(() => {});
    return true;
  }

  return false;
}

// ══════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════

const data = new SlashCommandBuilder()
  .setName('hippodrome')
  .setDescription('🏇 Course de chevaux avec 3 types de paris — Gagnant, Placé, Couplé !')
  .addIntegerOption(o =>
    o.setName('mise')
      .setDescription('Montant à miser (min 5)')
      .setRequired(true)
      .setMinValue(1)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const mise   = interaction.options.getInteger('mise');

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply().catch(() => {});
  }
  await showPreRace(interaction, userId, guildId, mise);
}

async function run(message, args) {
  const mise = parseInt(args[0]);
  if (!mise || mise < 5) return message.reply('❌ Usage : `&hippodrome <mise>` — Mise minimale : 5 coins.');

  let sentMsg = null;
  const fake = {
    user:    message.author,
    member:  message.member,
    guild:   message.guild,
    guildId: message.guildId,
    channel: message.channel,
    client:  message.client,
    deferred: false,
    replied:  false,
    options:  { getInteger: (k) => k === 'mise' ? mise : null, getString: () => null, getUser: () => null, getBoolean: () => null },
    deferReply: async () => {},
    editReply:  async (d) => { if (sentMsg) { await sentMsg.edit(d).catch(() => {}); } else { sentMsg = await message.channel.send(d).catch(() => {}); } return sentMsg; },
    reply:      async (d) => message.reply(d).catch(() => message.channel.send(d).catch(() => {})),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
  };
  await execute(fake);
}

module.exports = { name: 'hippodrome', aliases: ['hippo', 'horse', 'course'], data, execute, run, handleComponent };
