// ============================================================
// roue-fortune.js — Roue de la Fortune (style émission TV)
// Emplacement : src/commands_guild/games/roue-fortune.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Secteurs de la roue ─────────────────────────────────────
const SECTORS = [
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e' },
  { label: '🟡 100',       type: 'win',     coins: 100,   color: '#F1C40F' },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e' },
  { label: '🟠 200',       type: 'win',     coins: 200,   color: '#E67E22' },
  { label: '➡️ PASSE',    type: 'pass',    coins: 0,     color: '#7F8C8D' },
  { label: '🟢 350',       type: 'win',     coins: 350,   color: '#27AE60' },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e' },
  { label: '🔵 500',       type: 'win',     coins: 500,   color: '#2980B9' },
  { label: '🟣 750',       type: 'win',     coins: 750,   color: '#8E44AD' },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e' },
  { label: '🔴 1 000',     type: 'win',     coins: 1000,  color: '#E74C3C' },
  { label: '⭐ 2 000',     type: 'win',     coins: 2000,  color: '#F39C12' },
  { label: '💀 FAILLITE',  type: 'lose',    coins: 0,     color: '#1a1a2e' },
  { label: '💎 5 000',     type: 'win',     coins: 5000,  color: '#1ABC9C' },
  { label: '🌟 JACKPOT',   type: 'jackpot', coins: 10000, color: '#FFD700' },
];

// Poids (grands gains plus rares)
const WEIGHTS = [14, 11, 14, 9, 7, 7, 14, 6, 5, 14, 4, 3, 14, 2, 1];

function weightedSpin() {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SECTORS.length; i++) {
    r -= WEIGHTS[i];
    if (r <= 0) return i;
  }
  return 0;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Rendu visuel de la roue ──────────────────────────────────
// La roue est affichée comme une bande horizontale
// Le pointeur (▼) est au centre — toujours en position 3 (sur 7 visibles)
function renderWheel(centerIdx) {
  const N = SECTORS.length;
  const slots = [];
  for (let offset = -3; offset <= 3; offset++) {
    const idx = ((centerIdx + offset) % N + N) % N;
    if (offset === 0) {
      slots.push(`❱❱${SECTORS[idx].label}❰❰`);
    } else {
      slots.push(SECTORS[idx].label);
    }
  }

  const top    = '┌─────────────────────────────────────────┐';
  const bottom = '└─────────────────────────────────────────┘';
  const row    = `│  ${slots.join('  ·  ')}  │`;
  const ptr    = '                      ▲                      ';

  return `\`\`\`\n${top}\n${row}\n${bottom}\n${ptr}\`\`\``;
}

// ─── Séquence d'animation ────────────────────────────────────
function buildFrames(finalIdx) {
  const N = SECTORS.length;
  let pos = Math.floor(Math.random() * N);
  const frames = [];

  // Phase 1 : rapide (pas de 4 ou 3)
  for (let i = 0; i < 6; i++) {
    pos = (pos + 4) % N;
    frames.push({ pos, speed: 160 });
  }
  // Phase 2 : ralentissement (pas de 2)
  for (let i = 0; i < 5; i++) {
    pos = (pos + 3) % N;
    frames.push({ pos, speed: 280 });
  }
  // Phase 3 : très lent (pas de 1)
  for (let i = 0; i < 5; i++) {
    pos = (pos + 2) % N;
    frames.push({ pos, speed: 420 });
  }
  // Phase 4 : dernier souffle
  for (let i = 0; i < 3; i++) {
    pos = (pos + 1) % N;
    frames.push({ pos, speed: 600 });
  }
  // Frame finale : le résultat
  frames.push({ pos: finalIdx, speed: 0 });

  return frames;
}

// ─── Jeu principal ────────────────────────────────────────────
async function playRoueFortune(source, userId, guildId) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  // Cooldown 30 min via colonne last_roue
  const COOLDOWN_MS = 30 * 60 * 1000;
  const now = Date.now();

  // Ajouter la colonne si elle n'existe pas
  try {
    db.db.prepare('ALTER TABLE users ADD COLUMN last_roue INTEGER DEFAULT 0').run();
  } catch {} // déjà présente

  const row = db.db.prepare('SELECT last_roue FROM users WHERE user_id=? AND guild_id=?').get(userId, guildId);
  const lastRoue = (row?.last_roue || 0) * 1000;

  if (now - lastRoue < COOLDOWN_MS) {
    const reste = Math.ceil((COOLDOWN_MS - (now - lastRoue)) / 60000);
    const msg = `⏳ La roue se recharge ! Reviens dans **${reste} min**.`;
    if (isInteraction) return source.editReply({ content: msg, ephemeral: true });
    return source.reply(msg);
  }

  // Enregistrer cooldown
  db.db.prepare('UPDATE users SET last_roue=? WHERE user_id=? AND guild_id=?')
    .run(Math.floor(now / 1000), userId, guildId);

  const finalIdx = weightedSpin();
  const frames   = buildFrames(finalIdx);

  // Embed de départ
  const intro = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎡 ・ Roue de la Fortune ・ 🎡')
    .setDescription(renderWheel(frames[0].pos))
    .addFields({ name: '✨ Statut', value: '**La roue commence à tourner...**', inline: false })
    .setFooter({ text: 'Bonne chance !' });

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [intro] });
  } else {
    msg = await source.reply({ embeds: [intro] });
  }

  // Animation frame par frame
  const phaseLabels = [
    '⚡ La roue tourne à toute allure !',
    '🌀 Elle ralentit doucement...',
    '🎯 Le pointeur hésite...',
    '🔮 Tout se joue maintenant...',
  ];

  for (let f = 0; f < frames.length - 1; f++) {
    const { pos, speed } = frames[f];
    const pct  = f / frames.length;
    const phase = pct < 0.35 ? 0 : pct < 0.60 ? 1 : pct < 0.80 ? 2 : 3;
    const color = pct < 0.5 ? '#E67E22' : pct < 0.8 ? '#E74C3C' : '#F39C12';

    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎡 ・ Roue de la Fortune ・ 🎡')
      .setDescription(renderWheel(pos))
      .addFields({ name: '💫 En cours', value: `*${phaseLabels[phase]}*`, inline: false })
      .setFooter({ text: `Frame ${f + 1} / ${frames.length}` });

    await msg.edit({ embeds: [e] }).catch(() => {});
    if (speed > 0) await sleep(speed);
  }

  // Petite pause dramatique avant révélation
  await sleep(800);

  // ── Résultat ──────────────────────────────────────────────
  const sector = SECTORS[finalIdx];
  let gain = 0;
  let resColor = sector.color;
  let resTitle = '🎡 ・ Roue de la Fortune — Résultat ・ 🎡';
  let resultText = '';

  if (sector.type === 'jackpot') {
    gain      = sector.coins;
    resColor  = '#FFD700';
    resTitle  = '🌟 ✨ JACKPOT ABSOLU ✨ 🌟';
    resultText = [
      '```',
      '╔══════════════════════════════════════╗',
      '║  🌟  J A C K P O T  A B S O L U  🌟 ║',
      '╚══════════════════════════════════════╝',
      '```',
      `🎊 **FÉLICITATIONS !** Tu remportes **${gain.toLocaleString()} ${coin}** !`,
      '🎉🎉🎉 Incroyable performance ! 🎉🎉🎉',
    ].join('\n');
    db.addCoins(userId, guildId, gain);

  } else if (sector.type === 'win') {
    gain      = sector.coins;
    resultText = [
      '```',
      '╔══════════════════════════════════════╗',
      `║  🎉 Gagné : ${String(gain + ' ' + coin).padEnd(26)} ║`,
      '╚══════════════════════════════════════╝',
      '```',
      `💰 **+${gain.toLocaleString()} ${coin}** ajoutés à ton solde !`,
    ].join('\n');
    db.addCoins(userId, guildId, gain);

  } else if (sector.type === 'pass') {
    resColor  = '#7F8C8D';
    resultText = [
      '```',
      '╔══════════════════════════════════════╗',
      '║  ➡️  PASSE — Tu passes ton tour !   ║',
      '╚══════════════════════════════════════╝',
      '```',
      '*Ni gagné, ni perdu... La roue te montre la sortie cette fois.*',
    ].join('\n');

  } else { // FAILLITE
    resColor  = '#2C3E50';
    resultText = [
      '```',
      '╔══════════════════════════════════════╗',
      '║  💀  FAILLITE ! Quelle malchance !  ║',
      '╚══════════════════════════════════════╝',
      '```',
      '*La Fortune t\'a tourné le dos... Reviens dans 30 min pour ta revanche !*',
    ].join('\n');
  }

  const solde = db.getUser(userId, guildId)?.balance || 0;

  const finalEmbed = new EmbedBuilder()
    .setColor(resColor)
    .setTitle(resTitle)
    .setDescription(
      renderWheel(finalIdx) + '\n\n' + resultText
    )
    .addFields(
      { name: '🎡 Secteur', value: `**${sector.label}**`, inline: true },
      { name: gain > 0 ? '💰 Gain' : '📊 Résultat', value: gain > 0 ? `**+${gain.toLocaleString()} ${coin}**` : '—', inline: true },
      { name: '🏦 Ton solde', value: `**${solde.toLocaleString()} ${coin}**`, inline: true },
    )
    .setFooter({ text: '⏳ La roue se recharge · Reviens dans 30 min !' })
    .setTimestamp();

  // Boutons
  const btns = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rf_cooldown`)
      .setLabel('⏳ Rejouer dans 30 min')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`rf_sectors_${userId}`)
      .setLabel('📋 Voir les secteurs')
      .setStyle(ButtonStyle.Secondary),
  );

  await msg.edit({ embeds: [finalEmbed], components: [btns] });

  // Collector bouton "voir secteurs"
  const filter  = i => i.user.id === userId && i.customId.startsWith('rf_sectors_');
  const collector = msg.createMessageComponentCollector({ filter, time: 60_000 });

  collector.on('collect', async i => {
    await i.deferUpdate();
    const seen = new Set();
    const uniqueSectors = SECTORS.filter(s => {
      const key = s.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const listEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('📋 ・ Secteurs de la Roue ・')
      .setDescription(
        uniqueSectors.map(s => {
          const idx = SECTORS.indexOf(s);
          const w   = WEIGHTS[idx] || WEIGHTS[SECTORS.lastIndexOf(s)];
          const pct = ((w / WEIGHTS.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
          const prize = s.type === 'jackpot' ? '🌟 JACKPOT' : s.type === 'win' ? `+${s.coins} ${coin}` : s.type === 'pass' ? 'Passe ton tour' : 'Rien 💀';
          return `${s.label} — **${prize}** *(~${pct}%)*`;
        }).join('\n')
      )
      .setFooter({ text: 'Il y a 4 secteurs FAILLITE sur la roue !' });

    await i.followUp({ embeds: [listEmbed], ephemeral: true }).catch(() => {});
  });

  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

// ─── Exports ──────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('roue-fortune')
    .setDescription('🎡 Roue de la Fortune — Tournez la roue ! (cooldown 30 min, gratuit)'),

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

