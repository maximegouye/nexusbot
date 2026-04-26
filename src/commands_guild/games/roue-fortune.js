// ============================================================
// roue-fortune.js — La Roue de la Fortune (v4 — double ou rien, mystère, relancer)
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Secteurs de la roue ──────────────────────────────────────
const SECTORS = [
  { label: '🟡 100',       type: 'win',     coins: 100,   color: '#F1C40F', disp: '🟡 **100**'       },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e', disp: '💀 FAILLITE'       },
  { label: '🟠 250',       type: 'win',     coins: 250,   color: '#E67E22', disp: '🟠 **250**'       },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e', disp: '💀 FAILLITE'       },
  { label: '🔵 500',       type: 'win',     coins: 500,   color: '#2980B9', disp: '🔵 **500**'       },
  { label: '➡️ PASSE',    type: 'pass',    coins: 0,     color: '#7F8C8D', disp: '➡️ PASSE'          },
  { label: '🟢 750',       type: 'win',     coins: 750,   color: '#27AE60', disp: '🟢 **750**'       },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e', disp: '💀 FAILLITE'       },
  { label: '🔴 1 000',     type: 'win',     coins: 1000,  color: '#E74C3C', disp: '🔴 **1 000**'     },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e', disp: '💀 FAILLITE'       },
  { label: '🟣 1 500',     type: 'win',     coins: 1500,  color: '#8E44AD', disp: '🟣 **1 500**'     },
  { label: '⚡ x2 MISE',   type: 'double',  coins: 0,     color: '#F39C12', disp: '⚡ **×2 MISE**'    },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e', disp: '💀 FAILLITE'       },
  { label: '⭐ 2 000',     type: 'win',     coins: 2000,  color: '#F39C12', disp: '⭐ **2 000**'     },
  { label: '💎 5 000',     type: 'win',     coins: 5000,  color: '#1ABC9C', disp: '💎 **5 000**'     },
  { label: '🌟 JACKPOT',   type: 'jackpot', coins: 10000, color: '#FFD700', disp: '🌟 **JACKPOT**'    },
  { label: '🎁 MYSTÈRE',   type: 'mystery', coins: 0,     color: '#9B59B6', disp: '🎁 **MYSTÈRE**'    },
  { label: '🔄 RELANCER',  type: 'reroll',  coins: 150,   color: '#3498DB', disp: '🔄 **RELANCER**'  },
];

// Poids — 4 faillites très lourdes, jackpot rare
const WEIGHTS = [10, 13, 8, 13, 6, 5, 5, 13, 4, 13, 3, 3, 13, 2, 1, 1, 4, 3];

function weightedSpin() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SECTORS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ─── Rendu de la bande (5 secteurs visibles) ──────────────────
function renderBand(centerIdx, spinning = true) {
  const N = SECTORS.length;
  const parts = [];
  for (let off = -2; off <= 2; off++) {
    const idx = ((centerIdx + off) % N + N) % N;
    const s = SECTORS[idx];
    if (off === 0) {
      parts.push(`❱❱ ${s.label} ❰❰`);
    } else if (Math.abs(off) === 1) {
      parts.push(s.label);
    } else {
      parts.push(s.label.split(' ')[0]);
    }
  }
  const arrow = spinning
    ? '　　　　　　　　 ▲'
    : '　　　　　　　　 ▲  ← ICI !';
  return parts.join('  ╌  ') + '\n' + arrow;
}

// ─── Frames d'animation ───────────────────────────────────────
function buildFrames(finalIdx) {
  const N = SECTORS.length;
  let pos = Math.floor(Math.random() * N);
  const frames = [];
  for (let i = 0; i < 7; i++) { pos = (pos + 4) % N; frames.push({ pos, speed: 130, phase: 0 }); }
  for (let i = 0; i < 6; i++) { pos = (pos + 3) % N; frames.push({ pos, speed: 200, phase: 1 }); }
  for (let i = 0; i < 5; i++) { pos = (pos + 2) % N; frames.push({ pos, speed: 320, phase: 2 }); }
  for (let i = 0; i < 4; i++) { pos = (pos + 1) % N; frames.push({ pos, speed: 480, phase: 3 }); }
  for (let i = 0; i < 3; i++) { pos = (pos + 1) % N; frames.push({ pos, speed: 650, phase: 4 }); }
  frames.push({ pos: finalIdx, speed: 0, phase: 5 });
  return frames;
}

const PHASE_INFO = [
  { text: '⚡ **La roue s\'élance à pleine vitesse !**',   color: '#E74C3C', bar: '▓▓▓▓▓▓▓▓▓▓ 100%' },
  { text: '🌀 **Elle tourne encore très vite...**',         color: '#E67E22', bar: '▓▓▓▓▓▓▓▓░░  80%'  },
  { text: '💨 **Ralentissement en cours...**',              color: '#F39C12', bar: '▓▓▓▓▓▓░░░░  60%'  },
  { text: '🎯 **Le pointeur hésite...**',                   color: '#F1C40F', bar: '▓▓▓▓░░░░░░  40%'  },
  { text: '😮 **Tout se joue maintenant...**',              color: '#2ECC71', bar: '▓▓░░░░░░░░  20%'  },
  { text: '🛑 **Arrêt !**',                                 color: '#FFFFFF', bar: '░░░░░░░░░░   0%'  },
];

// ─── Jeu principal ────────────────────────────────────────────
async function playRoueFortune(source, userId, guildId) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (!u) {
    const err = '❌ Compte introuvable.';
    if (isInteraction) return source.editReply({ content: err });
    return source.reply(err);
  }

  // ── Cooldown 30 min ─────────────────────────────────────────
  const COOLDOWN_MS = 30 * 60 * 1000;
  const now = Date.now();

  try {
    db.db.prepare('ALTER TABLE users ADD COLUMN last_roue INTEGER DEFAULT 0').run();
  } catch {}

  const rowCd = db.db.prepare('SELECT last_roue FROM users WHERE user_id=? AND guild_id=?')
    .get(userId, guildId);
  const lastRoue = (rowCd?.last_roue || 0) * 1000;
  const elapsed  = now - lastRoue;

  if (elapsed < COOLDOWN_MS) {
    const reste  = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
    const barre  = Math.floor(((COOLDOWN_MS - elapsed) / COOLDOWN_MS) * 10);
    const barStr = '🔴'.repeat(barre) + '⚫'.repeat(10 - barre);
    const embed  = new EmbedBuilder()
      .setColor('#7F8C8D')
      .setTitle('🎡 ・ Roue de la Fortune ・')
      .setDescription([
        '⏳ **La roue se recharge !**',
        '',
        `Rechargement : ${barStr}`,
        `Disponible dans **${reste} minute${reste > 1 ? 's' : ''}**`,
        '',
        '*Reviens bientôt pour tenter ta chance !*',
      ].join('\n'))
      .setFooter({ text: 'Roue de la Fortune · Gratuit · Cooldown 30 min' });
    if (isInteraction) return source.editReply({ embeds: [embed] });
    return source.reply({ embeds: [embed] });
  }

  // Enregistrer cooldown immédiatement
  db.db.prepare('UPDATE users SET last_roue=? WHERE user_id=? AND guild_id=?')
    .run(Math.floor(now / 1000), userId, guildId);

  const finalIdx = weightedSpin();
  const frames   = buildFrames(finalIdx);

  // ── Intro TV show ────────────────────────────────────────────
  const introEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎡 ━━━ LA ROUE DE LA FORTUNE ━━━ 🎡')
    .setDescription([
      '```',
      '  🎵  Bienvenue dans La Roue de la Fortune !  🎵  ',
      '```',
      renderBand(frames[0].pos, true),
      '',
      '🎬 *La roue commence à tourner...*',
    ].join('\n'))
    .setFooter({ text: '🎡 La Roue de la Fortune · Gratuit · Cooldown 30 min' });

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [introEmbed] });
  } else {
    msg = await source.reply({ embeds: [introEmbed] });
  }

  // ── Animation ────────────────────────────────────────────────
  for (let f = 0; f < frames.length - 1; f++) {
    const { pos, speed, phase } = frames[f];
    const info = PHASE_INFO[phase] || PHASE_INFO[4];
    const e = new EmbedBuilder()
      .setColor(info.color)
      .setTitle('🎡 ━━━ LA ROUE DE LA FORTUNE ━━━ 🎡')
      .setDescription([
        renderBand(pos, true),
        '',
        info.text,
        '`' + info.bar + '`',
      ].join('\n'));
    await msg.edit({ embeds: [e] }).catch(() => {});
    if (speed > 0) await sleep(speed);
  }

  await sleep(1000);

  // ── Révélation ───────────────────────────────────────────────
  const sector = SECTORS[finalIdx];
  let gain = 0;
  const uFresh = db.getUser(userId, guildId);

  if (sector.type === 'jackpot') {
    gain = sector.coins;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'win') {
    gain = sector.coins;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'double') {
    gain  = uFresh.balance;
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'mystery') {
    gain = Math.floor(Math.random() * 2200) + 300; // 300 – 2500
    db.addCoins(userId, guildId, gain);
  } else if (sector.type === 'reroll') {
    gain = sector.coins; // 150 coins
    db.addCoins(userId, guildId, gain);
    // Reset cooldown → joueur peut rejouer immédiatement
    db.db.prepare('UPDATE users SET last_roue=0 WHERE user_id=? AND guild_id=?').run(userId, guildId);
  }

  const newBalance = db.getUser(userId, guildId)?.balance || 0;

  // ── Résultat embed ────────────────────────────────────────────
  let resTitle, resDesc, resColor;

  if (sector.type === 'jackpot') {
    resColor = '#FFD700';
    resTitle = '🌟 ✨ JACKPOT ABSOLU ✨ 🌟';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  🌟  J A C K P O T   A B S O L U  🌟    ║',
      '║  🎊  Félicitations extraordinaires !  🎊 ║',
      '╚══════════════════════════════════════════╝',
      '```',
      `🎉 Tu remportes **${gain.toLocaleString()} ${coin}** !`,
      '🎊 🥳 🎆 🎇 🎊 🥳 🎆 🎇 🎊',
    ].join('\n');

  } else if (sector.type === 'double') {
    resColor = '#F39C12';
    resTitle = '⚡ ・ MISE DOUBLÉE ！ ・ ⚡';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  ⚡  MULTIPLICATEUR × 2 ACTIVÉ !  ⚡     ║',
      '╚══════════════════════════════════════════╝',
      '```',
      `💥 Ton solde vient de **doubler** !`,
      `💰 +**${gain.toLocaleString()} ${coin}** ajoutés !`,
    ].join('\n');

  } else if (sector.type === 'win') {
    const stars = gain >= 2000 ? '⭐⭐⭐' : gain >= 1000 ? '⭐⭐' : '⭐';
    resColor = sector.color;
    resTitle = `${stars} Gagné ! ${stars}`;
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      `║  🎉  Gain : ${String(gain.toLocaleString() + ' ' + coin).padEnd(30)}║`,
      '╚══════════════════════════════════════════╝',
      '```',
      `💰 **+${gain.toLocaleString()} ${coin}** ajoutés à ton solde !`,
    ].join('\n');

  } else if (sector.type === 'mystery') {
    resColor = '#9B59B6';
    resTitle = '🎁 ・ MYSTÈRE ! ・ 🎁';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  🎁  SECTEUR MYSTÈRE — Surprise !  🎁    ║',
      `║  💰  +${String(gain.toLocaleString() + ' ' + coin).padEnd(35)}║`,
      '╚══════════════════════════════════════════╝',
      '```',
      `🎲 La Fortune t\'a réservé une **surprise de +${gain.toLocaleString()} ${coin}** !`,
    ].join('\n');

  } else if (sector.type === 'reroll') {
    resColor = '#3498DB';
    resTitle = '🔄 ・ RELANCER ! ・ 🔄';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  🔄  RELANCER — Cooldown réinitialisé !  ║',
      '║  🎡  Tu peux rejouer immédiatement !      ║',
      '╚══════════════════════════════════════════╝',
      '```',
      `💫 +**${gain} ${coin}** offerts et **cooldown réinitialisé** — rejoue maintenant !`,
    ].join('\n');

  } else if (sector.type === 'pass') {
    resColor = '#7F8C8D';
    resTitle = '➡️ ・ PASSE ・ ➡️';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  ➡️   Tu passes ton tour cette fois !    ║',
      '║       Ni gagné, ni perdu.                ║',
      '╚══════════════════════════════════════════╝',
      '```',
      '*La Fortune te montre la sortie... Pour l\'instant.*',
    ].join('\n');

  } else { // FAILLITE
    resColor = '#2C3E50';
    resTitle = '💀 ・ FAILLITE ・ 💀';
    resDesc  = [
      '```',
      '╔══════════════════════════════════════════╗',
      '║  💀  FAILLITE — Quelle malchance !  💀   ║',
      '║      La Fortune t\'a tourné le dos...     ║',
      '╚══════════════════════════════════════════╝',
      '```',
      '*Courage ! La roue se recharge dans 30 min.*',
    ].join('\n');
  }

  const finalEmbed = new EmbedBuilder()
    .setColor(resColor)
    .setTitle(resTitle)
    .setDescription(renderBand(finalIdx, false) + '\n\n' + resDesc)
    .addFields(
      { name: '🎡 Secteur',                    value: `**${sector.label}**`,                                     inline: true },
      { name: gain > 0 ? '💰 Gain' : '📊',     value: gain > 0 ? `**+${gain.toLocaleString()} ${coin}**` : '—',  inline: true },
      { name: '🏦 Nouveau solde',               value: `**${newBalance.toLocaleString()} ${coin}**`,              inline: true },
    )
    .setFooter({ text: sector.type === 'reroll' ? '✅ Cooldown réinitialisé ! Rejoue tout de suite.' : '⏳ Reviens dans 30 min · Roue de la Fortune · Gratuit' })
    .setTimestamp();

  // ── Boutons ──────────────────────────────────────────────────
  const canDoubleRien = gain > 0 && !['reroll', 'jackpot', 'double'].includes(sector.type);
  const isReroll      = sector.type === 'reroll';

  const btnComponents = [
    new ButtonBuilder()
      .setCustomId(isReroll ? `rf_reroll_${userId}` : 'rf_cd_disabled')
      .setLabel(isReroll ? '🎡 Rejouer maintenant !' : '⏳ Reviens dans 30 min')
      .setStyle(isReroll ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(!isReroll),
    new ButtonBuilder()
      .setCustomId(`rf_sectors_${userId}`)
      .setLabel('📋 Voir tous les secteurs')
      .setStyle(ButtonStyle.Secondary),
  ];

  if (canDoubleRien) {
    btnComponents.push(
      new ButtonBuilder()
        .setCustomId(`rf_doublerien_${userId}`)
        .setLabel(`🎲 Double ou rien (+${gain.toLocaleString()})`)
        .setStyle(ButtonStyle.Danger)
    );
  }

  const btns = new ActionRowBuilder().addComponents(...btnComponents);
  await msg.edit({ embeds: [finalEmbed], components: [btns] });

  // ── Collector ─────────────────────────────────────────────────
  const validIds = new Set([
    `rf_sectors_${userId}`,
    `rf_doublerien_${userId}`,
    `rf_reroll_${userId}`,
  ]);
  const filter = i => i.user.id === userId && validIds.has(i.customId);
  const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

  collector.on('collect', async i => {
    // ── Voir les secteurs ──────────────────────────────────────
    if (i.customId === `rf_sectors_${userId}`) {
      await i.deferUpdate().catch(() => {});
      const total = WEIGHTS.reduce((a, b) => a + b, 0);
      const seen  = new Map();
      SECTORS.forEach((s, idx) => {
        const key = s.label;
        if (!seen.has(key)) seen.set(key, { s, w: 0 });
        seen.get(key).w += WEIGHTS[idx];
      });
      const lines = [...seen.values()].map(({ s, w }) => {
        const pct   = ((w / total) * 100).toFixed(1);
        const prize = s.type === 'jackpot' ? `🌟 ${s.coins.toLocaleString()} ${coin}`
                    : s.type === 'win'     ? `+${s.coins.toLocaleString()} ${coin}`
                    : s.type === 'double'  ? '×2 ton solde'
                    : s.type === 'mystery' ? '🎁 300-2 500 (aléatoire)'
                    : s.type === 'reroll'  ? '🔄 150 coins + cooldown réinitialisé'
                    : s.type === 'pass'    ? 'Passe le tour'
                    : '0 (Faillite)';
        return `${s.label} → **${prize}** — *${pct}% de chances*`;
      });
      const listEmbed = new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('📋 ・ Secteurs de la Roue de la Fortune ・')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${SECTORS.filter(s => s.type === 'lose').length} secteurs FAILLITE sur ${SECTORS.length} total` });
      await i.followUp({ embeds: [listEmbed], ephemeral: true }).catch(() => {});

    // ── Double ou rien ─────────────────────────────────────────
    } else if (i.customId === `rf_doublerien_${userId}`) {
      await i.deferUpdate().catch(() => {});
      collector.stop('doubleried');

      const won = Math.random() < 0.5;
      // Rebuild disabled buttons
      const disabledRow = new ActionRowBuilder().addComponents(
        ...btnComponents.map(b => {
          const json = b.toJSON();
          return new ButtonBuilder(json).setDisabled(true);
        })
      );

      if (won) {
        db.addCoins(userId, guildId, gain);
        const nb2 = db.getUser(userId, guildId)?.balance || 0;
        const winEmbed = new EmbedBuilder()
          .setColor('#F1C40F')
          .setTitle('🎲 DOUBLE OU RIEN → 🎊 DOUBLÉ !')
          .setDescription(
            `**🍀 Incroyable ! Tu as doublé ton gain !**\n\n` +
            `**+${gain.toLocaleString()} ${coin}** supplémentaires empochés !`
          )
          .addFields(
            { name: '💰 Gain total', value: `**+${(gain * 2).toLocaleString()} ${coin}**`, inline: true },
            { name: '🏦 Nouveau solde', value: `**${nb2.toLocaleString()} ${coin}**`, inline: true },
          )
          .setFooter({ text: '🎲 Risqué mais payant !' })
          .setTimestamp();
        await msg.edit({ embeds: [winEmbed], components: [disabledRow] }).catch(() => {});
      } else {
        db.addCoins(userId, guildId, -gain);
        const nb2 = db.getUser(userId, guildId)?.balance || 0;
        const loseEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🎲 DOUBLE OU RIEN → 💸 PERDU !')
          .setDescription(
            `**😔 Malchance... Tu perds ton gain.**\n\n` +
            `**-${gain.toLocaleString()} ${coin}** retirés de ton solde.`
          )
          .addFields(
            { name: '📉 Perte', value: `**-${gain.toLocaleString()} ${coin}**`, inline: true },
            { name: '🏦 Nouveau solde', value: `**${nb2.toLocaleString()} ${coin}**`, inline: true },
          )
          .setFooter({ text: '🎲 Parfois il faut savoir s\'arrêter !' })
          .setTimestamp();
        await msg.edit({ embeds: [loseEmbed], components: [disabledRow] }).catch(() => {});
      }

    // ── Reroll ─────────────────────────────────────────────────
    } else if (i.customId === `rf_reroll_${userId}`) {
      await i.deferUpdate().catch(() => {});
      collector.stop('reroll');
      // Cooldown déjà remis à 0, rejouer
      await playRoueFortune(source, userId, guildId);
    }
  });

  collector.on('end', (_, reason) => {
    if (reason !== 'doubleried' && reason !== 'reroll') {
      msg.edit({ components: [] }).catch(() => {});
    }
  });
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue-fortune')
    .setDescription('🎡 La Roue de la Fortune — Tournez la roue ! Gratuit · Cooldown 30 min'),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playRoueFortune(interaction, interaction.user.id, interaction.guildId);
  },

  name: 'roue-fortune',
  aliases: ['roue', 'fortune', 'rf'],
  async run(message, args) {
    await playRoueFortune(message, message.author.id, message.guildId);
  },
};
