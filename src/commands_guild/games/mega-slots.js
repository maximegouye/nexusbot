// ============================================================
// mega-slots.js — Machine à sous ULTRA-HAUTE MISE (VIP)
// Mises : 1 000€ → 500 000€ par spin
// Jackpots progressifs : Mini / Maxi / MEGA / GRAND
// Features : Wild×3, Hold & Spin, Free Spins, Multiplier Trail
//            Risk Game ×2/×3/×5, Auto-Spin, Scatter Trail
// ============================================================
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const db = require('../../database/db');

// ─── Tables DB ───────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mega_jackpot (
    guild_id  TEXT PRIMARY KEY,
    mini      INTEGER DEFAULT 50000,
    maxi      INTEGER DEFAULT 500000,
    mega      INTEGER DEFAULT 2000000,
    grand     INTEGER DEFAULT 10000000
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mega_slots_stats (
    user_id   TEXT,
    guild_id  TEXT,
    spins     INTEGER DEFAULT 0,
    wins      INTEGER DEFAULT 0,
    jackpots  INTEGER DEFAULT 0,
    biggest   INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

// ─── Jackpots ────────────────────────────────────────────
function getJackpots(guildId) {
  try {
    let row = db.db.prepare('SELECT * FROM mega_jackpot WHERE guild_id=?').get(guildId);
    if (!row) {
      db.db.prepare('INSERT INTO mega_jackpot(guild_id) VALUES(?)').run(guildId);
      row = { mini: 50000, maxi: 500000, mega: 2000000, grand: 10000000 };
    }
    return row;
  } catch { return { mini: 50000, maxi: 500000, mega: 2000000, grand: 10000000 }; }
}

function addToJackpots(guildId, mise) {
  try {
    const contrib = Math.floor(mise * 0.02); // 2% de la mise alimente les jackpots
    db.db.prepare(`UPDATE mega_jackpot SET
      mini  = mini  + ?,
      maxi  = maxi  + ?,
      mega  = mega  + ?,
      grand = grand + ?
      WHERE guild_id=?`).run(
        Math.floor(contrib * 0.5),
        Math.floor(contrib * 0.3),
        Math.floor(contrib * 0.15),
        Math.floor(contrib * 0.05),
        guildId
      );
  } catch {}
}

function resetJackpot(guildId, type) {
  const base = { mini: 50000, maxi: 500000, mega: 2000000, grand: 10000000 };
  try { db.db.prepare(`UPDATE mega_jackpot SET ${type}=? WHERE guild_id=?`).run(base[type], guildId); } catch {}
}

function addMegaStats(userId, guildId, won, amount, jackpot) {
  try {
    const existing = db.db.prepare('SELECT * FROM mega_slots_stats WHERE user_id=? AND guild_id=?').get(userId, guildId);
    if (existing) {
      db.db.prepare(`UPDATE mega_slots_stats SET spins=spins+1, wins=wins+?, jackpots=jackpots+?,
        biggest=MAX(biggest,?) WHERE user_id=? AND guild_id=?`).run(won?1:0, jackpot?1:0, amount, userId, guildId);
    } else {
      db.db.prepare(`INSERT INTO mega_slots_stats VALUES(?,?,1,?,?,?)`).run(userId, guildId, won?1:0, jackpot?1:0, amount);
    }
  } catch {}
}

// ─── Symboles VIP ────────────────────────────────────────
const MEGA_SYMBOLS = [
  // id,       emoji,  name,         weight, value (× mise)
  ['coin',     '💰',  'Pièce',       30,     1.5  ],
  ['gem',      '💠',  'Gemme',       22,     2    ],
  ['ruby',     '❤️',  'Rubis',       16,     3    ],
  ['emerald',  '💚',  'Émeraude',    12,     4    ],
  ['sapphire', '💙',  'Saphir',      9,      6    ],
  ['crown',    '👑',  'Couronne',    6,      10   ],
  ['diamond',  '💎',  'Diamant',     4,      20   ],
  ['platinum', '⚗️', 'Platine',     3,      40   ],
  ['goldbar',  '🥇',  'Lingot d\'Or',2,      80   ],
  ['black',    '🖤',  'Black Diamond',1.5,   200  ],
  // Spéciaux
  ['wild',     '🃏',  'WILD',        2.5,    0    ], // substitue + ×1.5
  ['wildx3',   '🎴',  'WILD×3',      0.8,    0    ], // substitue + ×3
  ['scatter',  '🌠',  'SCATTER',     1.5,    0    ], // paie partout (3 → free spins)
  ['hold',     '🔒',  'HOLD',        1,      0    ], // Hold & Spin feature
  ['jackpot',  '💰',  'JACKPOT',     0.5,    0    ], // 3 → jackpot progressif
];
const SYM_MAP = Object.fromEntries(MEGA_SYMBOLS.map(([id,...rest]) => [id, {id, emoji:rest[0], name:rest[1], weight:rest[2], value:rest[3]}]));
const TOTAL_W = MEGA_SYMBOLS.reduce((s,[,,, w]) => s + w, 0);

// ─── Sessions ────────────────────────────────────────────
const holdSessions  = new Map(); // `${uid}_${gid}` → {reels, mise, multiplier, heldCols, freeSpins}
const riskSessions  = new Map(); // `${uid}_${gid}` → {amount, stage}

// ─── Utils ───────────────────────────────────────────────
function coin(guildId) { try { return db.getConfig(guildId)?.currency_emoji || '€'; } catch { return '€'; } }

function drawSym() {
  let r = Math.random() * TOTAL_W, cumul = 0;
  for (const [id,,, w] of MEGA_SYMBOLS) { cumul += w; if (r < cumul) return id; }
  return 'coin';
}

function spinReels(held) {
  if (!held) held = [];
  // 3×3 grille : reels[col][row]
  const reels = [];
  for (let c = 0; c < 3; c++) {
    const col = [];
    for (let r = 0; r < 3; r++) {
      col.push(held[c]?.[r] ?? drawSym());
    }
    reels.push(col);
  }
  return reels;
}

function formatGrid(reels, heldCols = []) {
  let s = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const sym = SYM_MAP[reels[c][r]];
      s += sym?.emoji ?? '❓';
      if (c < 2) s += ' ';
    }
    if (r === 1) s += heldCols.length ? `  ◄ **Ligne centrale**` : '';
    s += '\n';
  }
  return s;
}

// ─── Calcul des gains ────────────────────────────────────
// Paylines : ligne haute, milieu, basse, diag ↘, diag ↗
const PAYLINES_3 = [
  [0,0], [0,1], [0,2], // rangées : col0-row, col1-row, col2-row
]; // Simplifié : ligne du milieu + haut + bas

function calcWin(reels, mise) {
  let totalMult = 0;
  let wildx3Count = 0;
  let jackpotHit = null;
  let scatterCount = 0;
  let holdCount = 0;
  let freeSpinsTriggered = false;
  let holdTriggered = false;
  const lines = [];

  // Compte les spéciaux partout sur la grille
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) {
      const s = reels[c][r];
      if (s === 'scatter') scatterCount++;
      if (s === 'hold')    holdCount++;
      if (s === 'wildx3')  wildx3Count++;
    }
  }

  // 3+ scatters = 10 free spins
  if (scatterCount >= 3) freeSpinsTriggered = true;
  // 3+ hold = hold & spin
  if (holdCount >= 3) holdTriggered = true;

  // Check paylines (haut, milieu, bas)
  for (let row = 0; row < 3; row++) {
    const syms = [reels[0][row], reels[1][row], reels[2][row]];
    // Remplace wilds
    const nonWild = syms.filter(s => s !== 'wild' && s !== 'wildx3' && s !== 'scatter' && s !== 'hold' && s !== 'jackpot');

    // 3x jackpot
    if (syms.filter(s => s === 'jackpot').length === 3) {
      jackpotHit = 'mini'; // au moins mini jackpot
      continue;
    }
    // Tous identiques (ou wild)
    const base = nonWild[0];
    if (!base) continue;
    const allMatch = syms.every(s => s === base || s === 'wild' || s === 'wildx3');
    if (allMatch) {
      const sym = SYM_MAP[base];
      const wildBonus = syms.filter(s => s === 'wildx3').length;
      const mult = sym.value * (wildBonus ? 3 : 1);
      totalMult += mult;
      lines.push({ row, sym, mult, wild: wildBonus > 0 });
    }
  }

  // Diagonales
  const diagMain = [reels[0][0], reels[1][1], reels[2][2]];
  const diagAnti = [reels[0][2], reels[1][1], reels[2][0]];
  for (const [diag, label] of [[diagMain, 'diag↘'], [diagAnti, 'diag↗']]) {
    const nonWild = diag.filter(s => s !== 'wild' && s !== 'wildx3' && s !== 'scatter' && s !== 'hold' && s !== 'jackpot');
    const base = nonWild[0];
    if (!base) continue;
    const allMatch = diag.every(s => s === base || s === 'wild' || s === 'wildx3');
    if (allMatch) {
      const sym = SYM_MAP[base];
      const wildBonus = diag.filter(s => s === 'wildx3').length;
      const mult = sym.value * (wildBonus ? 3 : 1);
      totalMult += mult;
      lines.push({ label, sym, mult, wild: wildBonus > 0 });
    }
  }

  // Jackpot progressif : 3 jackpots sur la ligne du milieu
  const midRow = [reels[0][1], reels[1][1], reels[2][1]];
  const jackpotMid = midRow.filter(s => s === 'jackpot').length;
  if (jackpotMid === 3) jackpotHit = 'grand';
  else if (jackpotMid === 2 && midRow.includes('wildx3')) jackpotHit = 'mega';

  // Black Diamond bonus (toute grille)
  const blacks = [reels[0][1]].filter(s => s === 'black').length +
                 [reels[1][1]].filter(s => s === 'black').length;
  if (blacks >= 2) totalMult += SYM_MAP['black'].value * blacks;

  const grossGain = Math.round(totalMult * mise);
  return { grossGain, totalMult, lines, jackpotHit, freeSpinsTriggered, holdTriggered, scatterCount };
}

// ─── Affichage embed ─────────────────────────────────────
function buildEmbed(userId, guildId, mise, reels, result, bal, freeSpinsLeft, heldCols, multiplierTrail) {
  const coin_ = coin(guildId);
  const jp    = getJackpots(guildId);
  const net   = result.grossGain - mise;
  const color = result.jackpotHit ? '#FFD700' : result.grossGain > mise * 5 ? '#9B59B6' : result.grossGain > 0 ? '#2ECC71' : '#E74C3C';

  let title = '🎰 MEGA SLOTS';
  if (result.jackpotHit === 'grand') title = '💰💰💰 GRAND JACKPOT !!!! 💰💰💰';
  else if (result.jackpotHit === 'mega') title = '🌟 MEGA JACKPOT !!!';
  else if (result.jackpotHit === 'maxi') title = '💎 MAXI JACKPOT !!';
  else if (result.jackpotHit === 'mini') title = '🏅 MINI JACKPOT !';
  else if (result.grossGain >= mise * 50) title = '⚡⚡ ÉNORME VICTOIRE !! ⚡⚡';
  else if (result.grossGain >= mise * 10) title = '🎊 GRANDE VICTOIRE !';
  else if (result.grossGain > 0)          title = '✅ Victoire';
  else if (result.freeSpinsTriggered)     title = '🌠 FREE SPINS !';
  else if (result.holdTriggered)          title = '🔒 HOLD & SPIN !';
  else                                    title = '💸 Perdu';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `**╔══════════════╗**\n` +
      `${formatGrid(reels, heldCols)}` +
      `**╚══════════════╝**\n\n` +
      (multiplierTrail > 1 ? `⚡ **Multiplicateur ×${multiplierTrail}** actif !\n\n` : '') +
      (freeSpinsLeft > 0   ? `🌠 **${freeSpinsLeft} Free Spin${freeSpinsLeft>1?'s':''} restant${freeSpinsLeft>1?'s':''}**\n\n` : '')
    );

  // Résultat
  if (result.jackpotHit) {
    const jpVal = jp[result.jackpotHit];
    embed.addFields({ name: `🏆 ${result.jackpotHit.toUpperCase()} JACKPOT`, value: `**+${jpVal.toLocaleString('fr-FR')} ${coin_}**`, inline: false });
  } else if (result.grossGain > 0) {
    const lines_ = result.lines.map(l => `Ligne **${l.sym.emoji}** × ${l.mult}`).join('\n') || `× ${result.totalMult}`;
    embed.addFields({ name: '🎯 Combinaisons', value: lines_, inline: true });
    embed.addFields({ name: '💰 Gain brut', value: `**+${result.grossGain.toLocaleString('fr-FR')} ${coin_}**`, inline: true });
  } else {
    embed.addFields({ name: '💸 Résultat', value: `**-${mise.toLocaleString('fr-FR')} ${coin_}**`, inline: true });
  }

  embed.addFields(
    { name: '🎲 Mise', value: `${mise.toLocaleString('fr-FR')} ${coin_}`, inline: true },
    { name: '💳 Solde', value: `${bal.toLocaleString('fr-FR')} ${coin_}`, inline: true },
  );

  // Jackpots progressifs
  embed.addFields({
    name: '🏆 Jackpots progressifs',
    value: [
      `🏅 Mini  : **${jp.mini.toLocaleString('fr-FR')} ${coin_}**`,
      `💎 Maxi  : **${jp.maxi.toLocaleString('fr-FR')} ${coin_}**`,
      `🌟 Mega  : **${jp.mega.toLocaleString('fr-FR')} ${coin_}**`,
      `💰 Grand : **${jp.grand.toLocaleString('fr-FR')} ${coin_}**`,
    ].join('\n'),
    inline: false,
  });

  embed.setFooter({ text: `🎰 Mega Slots VIP | Mise min 1 000€ | 2% → jackpots` }).setTimestamp();
  return embed;
}

// ─── Boutons ─────────────────────────────────────────────
function buildButtons(userId, mise, freeSpinsLeft, grossGain, holdTriggered, heldCols) {
  const rows = [];
  const row1 = new ActionRowBuilder();

  if (freeSpinsLeft > 0) {
    row1.addComponents(
      new ButtonBuilder().setCustomId(`ms_freespin_${userId}_${mise}_${freeSpinsLeft}`).setLabel(`🌠 Free Spin (${freeSpinsLeft} restant${freeSpinsLeft>1?'s':''})`).setStyle(ButtonStyle.Success),
    );
  } else if (holdTriggered) {
    // Boutons hold pour chaque colonne
    const holdRow = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const held = heldCols.includes(c);
      holdRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ms_hold_${userId}_${mise}_${c}`)
          .setLabel(`${held ? '🔒' : '🔓'} Col.${c+1}`)
          .setStyle(held ? ButtonStyle.Danger : ButtonStyle.Secondary)
      );
    }
    rows.push(holdRow);

    row1.addComponents(
      new ButtonBuilder().setCustomId(`ms_holdspin_${userId}_${mise}`).setLabel('🔒 Spin avec Hold').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ms_replay_${userId}_${mise}`).setLabel('🔄 Rejouer sans Hold').setStyle(ButtonStyle.Primary),
    );
  } else {
    row1.addComponents(
      new ButtonBuilder().setCustomId(`ms_replay_${userId}_${mise}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ms_mise_${userId}`).setLabel('💰 Changer la mise').setStyle(ButtonStyle.Primary),
    );

    if (grossGain > 0) {
      row1.addComponents(
        new ButtonBuilder().setCustomId(`ms_risk2_${userId}_${grossGain}`).setLabel('⚡ ×2 (50%)').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ms_risk3_${userId}_${grossGain}`).setLabel('🔥 ×3 (33%)').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ms_risk5_${userId}_${grossGain}`).setLabel('💀 ×5 (20%)').setStyle(ButtonStyle.Danger),
      );
    }
  }

  rows.unshift(row1);

  // Auto-spin row
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ms_auto_${userId}_${mise}_5`).setLabel('⚡ Auto ×5').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ms_auto_${userId}_${mise}_10`).setLabel('⚡ Auto ×10').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ms_auto_${userId}_${mise}_25`).setLabel('⚡ Auto ×25').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ms_quit_${userId}`).setLabel('🚪 Quitter').setStyle(ButtonStyle.Secondary),
  );
  rows.push(row2);

  return rows.slice(0, 5);
}

// ─── Jouer un spin ───────────────────────────────────────
async function playMegaSlots(source, userId, guildId, mise, freeSpinsLeft = 0, held = null, multiplierTrail = 1) {
  const isInteraction = !!source.editReply;
  const coin_  = coin(guildId);
  const u = db.getUser(userId, guildId);

  if (!u) {
    const err = '❌ Compte introuvable. Utilise `/daily` pour créer ton profil.';
    return isInteraction ? source.editReply({ content: err }) : source.reply(err);
  }

  const cost = freeSpinsLeft > 0 ? 0 : mise;
  if (u.balance < cost) {
    const err = `❌ Solde insuffisant. Tu as **${u.balance.toLocaleString('fr-FR')} ${coin_}** mais la mise est **${mise.toLocaleString('fr-FR')} ${coin_}**.`;
    return isInteraction ? source.editReply({ content: err }) : source.reply(err);
  }

  if (cost > 0) db.addCoins(userId, guildId, -cost);
  addToJackpots(guildId, mise);

  const reels    = spinReels(held);
  const result   = calcWin(reels, mise);
  let finalGain  = result.grossGain;
  let jackpotWon = 0;

  // Jackpot progressif
  if (result.jackpotHit) {
    const jp  = getJackpots(guildId);
    jackpotWon = jp[result.jackpotHit];
    finalGain  = jackpotWon;
    resetJackpot(guildId, result.jackpotHit);
  }

  // Multiplicateur trail
  if (multiplierTrail > 1) finalGain = Math.round(finalGain * multiplierTrail);

  const newMult = result.grossGain >= mise * 10 ? Math.min(10, multiplierTrail + 1) : 1;

  if (finalGain > 0) db.addCoins(userId, guildId, finalGain);

  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const heldCols = [];

  const newFreeSpins = freeSpinsLeft > 0 ? freeSpinsLeft - 1 : (result.freeSpinsTriggered ? 10 : 0);
  const resultForDisplay = { ...result, grossGain: finalGain };

  const embed  = buildEmbed(userId, guildId, mise, reels, resultForDisplay, newBal, newFreeSpins, heldCols, newMult);
  const comps  = buildButtons(userId, mise, newFreeSpins, finalGain, result.holdTriggered, heldCols);

  addMegaStats(userId, guildId, finalGain > 0, Math.max(0, finalGain - mise), !!result.jackpotHit);

  // Sauvegarder l'état hold si nécessaire
  if (result.holdTriggered) {
    holdSessions.set(`${userId}_${guildId}`, { reels, mise, multiplierTrail: newMult, heldCols: [], freeSpins: newFreeSpins });
  }

  let msg;
  if (!isInteraction || source.deferred || source.replied) {
    msg = await (isInteraction ? source.editReply : source.reply.bind(source))({ embeds: [embed], components: comps });
  } else {
    await source.deferReply().catch(() => {});
    msg = await source.editReply({ embeds: [embed], components: comps });
  }

  return msg;
}

// ─── Auto-Spin ───────────────────────────────────────────
async function runMegaAutoSpin(msgRef, userId, guildId, mise, count, coin_) {
  let totalNet = 0, wins = 0, losses = 0, biggestWin = 0, finalBal = 0;

  for (let i = 0; i < count; i++) {
    const u = db.getUser(userId, guildId);
    if (!u || u.balance < mise) break;

    db.addCoins(userId, guildId, -mise);
    addToJackpots(guildId, mise);

    const reels  = spinReels();
    const result = calcWin(reels, mise);

    let gain = result.grossGain;
    if (result.jackpotHit) {
      const jp = getJackpots(guildId);
      gain = jp[result.jackpotHit];
      resetJackpot(guildId, result.jackpotHit);
    }

    if (gain > 0) { db.addCoins(userId, guildId, gain); wins++; if (gain > biggestWin) biggestWin = gain; }
    else losses++;

    totalNet += gain - mise;
    addMegaStats(userId, guildId, gain > 0, Math.max(0, gain - mise), !!result.jackpotHit);

    // Update live toutes les 5 spins
    if ((i + 1) % 5 === 0) {
      const curBal = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder()
        .setColor('#7c3aed')
        .setTitle(`⚡ Auto-Spin ${i+1}/${count}...`)
        .setDescription(`🎰 En cours... **${wins}W / ${losses}L**`)
        .addFields(
          { name: '📊 Net', value: `${totalNet >= 0?'+':''}${totalNet.toLocaleString('fr-FR')} ${coin_}`, inline: true },
          { name: '🏅 Meilleur', value: `${biggestWin.toLocaleString('fr-FR')} ${coin_}`, inline: true },
        )
      ], components: [] }).catch(() => {});
      await new Promise(r => setTimeout(r, 800));
    }
  }

  finalBal = db.getUser(userId, guildId)?.balance || 0;
  return { totalNet, wins, losses, biggestWin, finalBal };
}

// ─── handleComponent ─────────────────────────────────────
async function handleComponent(interaction, cid) {
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;
  const coin_   = coin(guildId);

  // ── Quitter ──────────────────────────────────────────
  if (cid.startsWith('ms_quit_')) {
    const ownerId = cid.split('_')[2];
    if (ownerId !== userId) { await interaction.reply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    await interaction.deferUpdate().catch(() => {});
    await interaction.message.edit({ components: [] }).catch(() => {});
    return true;
  }

  // ── Changer mise (modal) ─────────────────────────────
  if (cid.startsWith('ms_mise_')) {
    const ownerId = cid.split('_')[2];
    if (ownerId !== userId) { await interaction.reply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    const modal = new ModalBuilder().setCustomId(`ms_modal_${userId}`).setTitle('🎰 Mega Slots — Nouvelle mise');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('ms_new_mise').setLabel('Nouvelle mise (min 1 000€)').setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 50000 ou 100k').setRequired(true)
    ));
    await interaction.showModal(modal).catch(() => {});
    return true;
  }

  // ── Modal submit ─────────────────────────────────────
  if (cid.startsWith('ms_modal_')) {
    const ownerId = cid.split('_')[2];
    if (ownerId !== userId) { await interaction.reply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    if (!interaction.isModalSubmit()) return false;
    const raw  = interaction.fields.getTextInputValue('ms_new_mise').toLowerCase().trim();
    const u    = db.getUser(userId, guildId);
    const bal  = u?.balance || 0;
    let mise;
    if      (raw === 'all' || raw === 'max') mise = bal;
    else if (raw.endsWith('k')) mise = Math.floor(parseFloat(raw) * 1000);
    else if (raw.endsWith('m')) mise = Math.floor(parseFloat(raw) * 1000000);
    else mise = parseInt(raw);
    if (!mise || mise < 1000) {
      if (!interaction.replied) await interaction.reply({ content: '❌ Mise minimum : 1 000€.', ephemeral: true }).catch(() => {});
      return true;
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});
    await playMegaSlots(interaction, userId, guildId, mise);
    return true;
  }

  // ── Replay ───────────────────────────────────────────
  if (cid.startsWith('ms_replay_')) {
    const parts = cid.split('_');
    const ownerId = parts[2]; const mise = parseInt(parts[3]);
    if (ownerId !== userId) { await interaction.editReply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    await interaction.deferUpdate().catch(() => {});
    const src = { editReply: d => interaction.message.edit(d).catch(() => {}), deferred: true };
    await playMegaSlots(src, userId, guildId, mise);
    return true;
  }

  // ── Free Spin ────────────────────────────────────────
  if (cid.startsWith('ms_freespin_')) {
    const parts = cid.split('_');
    const ownerId = parts[2]; const mise = parseInt(parts[3]); const left = parseInt(parts[4]);
    if (ownerId !== userId) { await interaction.editReply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    await interaction.deferUpdate().catch(() => {});
    const src = { editReply: d => interaction.message.edit(d).catch(() => {}), deferred: true };
    await playMegaSlots(src, userId, guildId, mise, left);
    return true;
  }

  // ── Hold (toggle colonne) ────────────────────────────
  if (cid.startsWith('ms_hold_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2]; const mise = parseInt(parts[3]); const col = parseInt(parts[4]);
    if (ownerId !== userId) { await interaction.editReply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    await interaction.deferUpdate().catch(() => {});
    const key = `${userId}_${guildId}`;
    const sess = holdSessions.get(key);
    if (!sess) { await interaction.message.edit({ components: [] }).catch(() => {}); return true; }
    const idx = sess.heldCols.indexOf(col);
    if (idx >= 0) sess.heldCols.splice(idx, 1); else sess.heldCols.push(col);
    const comps = buildButtons(userId, mise, sess.freeSpins, 0, true, sess.heldCols);
    await interaction.message.edit({ components: comps }).catch(() => {});
    return true;
  }

  // ── Hold & Spin ──────────────────────────────────────
  if (cid.startsWith('ms_holdspin_')) {
    const parts = cid.split('_');
    const ownerId = parts[2]; const mise = parseInt(parts[3]);
    if (ownerId !== userId) { await interaction.editReply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    await interaction.deferUpdate().catch(() => {});
    const key  = `${userId}_${guildId}`;
    const sess = holdSessions.get(key);
    const held = sess ? sess.heldCols.map(c => sess.reels[c]) : undefined;
    const heldMap = sess?.heldCols.reduce((m, c) => { m[c] = sess.reels[c]; return m; }, {});
    holdSessions.delete(key);
    const src = { editReply: d => interaction.message.edit(d).catch(() => {}), deferred: true };
    await playMegaSlots(src, userId, guildId, mise, 0, heldMap, sess?.multiplierTrail || 1);
    return true;
  }

  // ── Risk ×2 / ×3 / ×5 ───────────────────────────────
  if (cid.startsWith('ms_risk')) {
    const parts    = cid.split('_');
    const mult_str = parts[1].replace('risk','');   // '2', '3', '5'
    const ownerId  = parts[2];
    const amount   = parseInt(parts[3]);
    if (ownerId !== userId) { await interaction.editReply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    const mult    = parseInt(mult_str);
    const chances = { 2: 0.5, 3: 0.333, 5: 0.2 };
    const chance  = chances[mult] || 0.5;
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    const won    = Math.random() < chance;
    if (won) {
      const totalGain = amount * mult - amount; // gain supplémentaire
      db.addCoins(userId, guildId, totalGain);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`⚡ RISK ×${mult} — GAGNÉ !! 🎊`)
        .setDescription(`🚀 **Tu as multiplié ton gain par ${mult} !**\n\n**+${totalGain.toLocaleString('fr-FR')} ${coin_}** supplémentaires !`)
        .addFields(
          { name: '💰 Gain total', value: `**${(amount * mult).toLocaleString('fr-FR')} ${coin_}**`, inline: true },
          { name: '💳 Nouveau solde', value: `${nb.toLocaleString('fr-FR')} ${coin_}`, inline: true },
        ).setTimestamp()
      ], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ms_replay_${userId}_1000`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success)
      )] }).catch(() => {});
    } else {
      db.addCoins(userId, guildId, -amount);
      const nb = db.getUser(userId, guildId)?.balance || 0;
      await msgRef.edit({ embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`⚡ RISK ×${mult} — PERDU 💸`)
        .setDescription(`😔 **Malchance ! Tu perds ton gain de ${amount.toLocaleString('fr-FR')} ${coin_}**\n\nLes ${Math.round(chance * 100)}% ne t'ont pas souri cette fois.`)
        .addFields({ name: '💳 Solde', value: `${nb.toLocaleString('fr-FR')} ${coin_}`, inline: true })
        .setTimestamp()
      ], components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ms_replay_${userId}_1000`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success)
      )] }).catch(() => {});
    }
    return true;
  }

  // ── Auto-Spin ────────────────────────────────────────
  if (cid.startsWith('ms_auto_')) {
    const parts   = cid.split('_');
    const ownerId = parts[2]; const mise = parseInt(parts[3]); const count = parseInt(parts[4]);
    if (ownerId !== userId) { await interaction.reply({ content: '❌ Pas ton jeu.', ephemeral: true }).catch(() => {}); return true; }
    const u = db.getUser(userId, guildId);
    if (!u || u.balance < mise * count) {
      await interaction.reply({ content: `❌ Solde insuffisant pour ${count} auto-spins à ${mise.toLocaleString('fr-FR')} ${coin_}.`, ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    const msgRef = interaction.message;
    await msgRef.edit({ embeds: [new EmbedBuilder().setColor('#7c3aed').setTitle(`⚡ Auto-Spin ×${count} en cours...`).setDescription('🎰 Les rouleaux tournent...')], components: [] }).catch(() => {});

    const { totalNet, wins, losses, biggestWin, finalBal } = await runMegaAutoSpin(msgRef, userId, guildId, mise, count, coin_);
    const color = totalNet >= 0 ? '#2ECC71' : '#E74C3C';
    await msgRef.edit({ embeds: [new EmbedBuilder()
      .setColor(color)
      .setTitle(`⚡ Mega Auto-Spin ×${count} terminé !`)
      .setDescription(`**${wins} gains** | **${losses} pertes**`)
      .addFields(
        { name: '📊 Net', value: `${totalNet >= 0?'+':''}${totalNet.toLocaleString('fr-FR')} ${coin_}`, inline: true },
        { name: '🏅 Meilleur gain', value: `${biggestWin.toLocaleString('fr-FR')} ${coin_}`, inline: true },
        { name: '💳 Solde final', value: `${finalBal.toLocaleString('fr-FR')} ${coin_}`, inline: true },
      ).setTimestamp()
    ], components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ms_replay_${userId}_${mise}`).setLabel('🔄 Rejouer').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ms_auto_${userId}_${mise}_${count}`).setLabel(`⚡ Relancer ×${count}`).setStyle(ButtonStyle.Secondary),
    )] }).catch(() => {});
    return true;
  }

  return false;
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mega-slots')
    .setDescription('🎰💎 Machine à sous VIP — Jackpots progressifs, Hold & Spin, mise min 1 000€')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Mise par spin (min 1 000€, max 500 000€)')
      .setRequired(true)
      .setMinValue(1000)
      .setMaxValue(500000)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const mise = interaction.options.getInteger('mise');
    await playMegaSlots(interaction, interaction.user.id, interaction.guildId, mise);
  },

  name: 'mega-slots',
  aliases: ['megaslots', 'vipslots', 'highroller'],
  async run(message, args) {
    const raw = (args[0] || '').toLowerCase().trim();
    if (!raw) return message.reply('❌ Usage : `&mega-slots <mise>` (min 1 000€)\nEx: `&mega-slots 10000` ou `&mega-slots 50k`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if      (raw === 'all' || raw === 'max') mise = bal;
    else if (raw.endsWith('k')) mise = Math.floor(parseFloat(raw) * 1000);
    else if (raw.endsWith('m')) mise = Math.floor(parseFloat(raw) * 1000000);
    else mise = parseInt(raw);
    if (!mise || mise < 1000) return message.reply('❌ Mise minimum : **1 000€**. Ex: `&mega-slots 10000`');
    await playMegaSlots(message, message.author.id, message.guildId, mise);
  },

  handleComponent,
};
