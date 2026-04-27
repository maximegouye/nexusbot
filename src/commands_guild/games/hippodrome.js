// ============================================================
// hippodrome.js — Hippodrome ultra-complet avec animations
// ============================================================
'use strict';

const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');
const { C, chipStr, balanceLine, casinoFooter, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Sessions & stats par joueur ──────────────────────────
const hippoSessions = new Map(); // userId → { mise, selectedHorse }
const hippoStats    = new Map(); // userId → { wins, losses, totalWagered, totalWon, gamesPlayed, biggestWin }

function getStat(userId) {
  if (!hippoStats.has(userId)) {
    hippoStats.set(userId, { wins: 0, losses: 0, totalWagered: 0, totalWon: 0, gamesPlayed: 0, biggestWin: 0 });
  }
  return hippoStats.get(userId);
}

// ─── Configuration des chevaux ────────────────────────────
const HORSES = [
  { id: 1, name: 'Éclair',   emoji: '⚡', odds: 1.8,  color: '🟢', tier: 'Favori'   },
  { id: 2, name: 'Tonnerre', emoji: '⛈️', odds: 2.5,  color: '🟢', tier: 'Solide'   },
  { id: 3, name: 'Mistral',  emoji: '🌬️', odds: 3.5,  color: '🟡', tier: 'Correct'  },
  { id: 4, name: 'Alizé',    emoji: '🌊', odds: 5.0,  color: '🟡', tier: 'Risqué'   },
  { id: 5, name: 'Tempête',  emoji: '🌪️', odds: 8.0,  color: '🔴', tier: 'Longshot' },
  { id: 6, name: 'Ouragan',  emoji: '💨', odds: 15.0, color: '🔴', tier: 'Outsider' },
];

const TRACK_LEN = 18;
const STEPS     = 6; // étapes d'animation

// ─── Gagnant pondéré inversement aux cotes ────────────────
function determineWinner() {
  const weights  = HORSES.map(h => 1 / h.odds);
  const total    = weights.reduce((a, b) => a + b, 0);
  let r          = Math.random() * total;
  for (let i = 0; i < HORSES.length; i++) {
    r -= weights[i];
    if (r <= 0) return HORSES[i];
  }
  return HORSES[0];
}

// ─── Positions simulées sur N étapes ─────────────────────
function generatePositions(winner) {
  // Chaque cheval a une progression de base + bruit
  // Le gagnant est garanti d'être en tête à la fin
  const base = {};
  HORSES.forEach(h => {
    base[h.id] = { speed: 0.8 + Math.random() * 0.4, positions: [] };
  });

  for (let step = 0; step <= STEPS; step++) {
    const t = step / STEPS;
    HORSES.forEach(h => {
      const progress = t * base[h.id].speed + (Math.random() - 0.5) * 0.08;
      base[h.id].positions.push(Math.min(Math.max(progress, 0), 0.95 + t * 0.05));
    });
  }

  // Garantir que le gagnant est en premier à la fin
  const lastStep  = STEPS;
  const maxOthers = Math.max(...HORSES.filter(h => h.id !== winner.id).map(h => base[h.id].positions[lastStep]));
  if (base[winner.id].positions[lastStep] <= maxOthers) {
    base[winner.id].positions[lastStep] = Math.min(maxOthers + 0.05 + Math.random() * 0.1, 1.0);
  }

  return base;
}

// ─── Rendu visuel d'une piste ─────────────────────────────
function renderTrack(progress) {
  const filled = Math.min(Math.floor(progress * TRACK_LEN), TRACK_LEN - 1);
  let track = '';
  for (let i = 0; i < TRACK_LEN; i++) {
    if (i < filled)      track += '▬';
    else if (i === filled) track += '🐴';
    else                 track += '░';
  }
  track += '🏁';
  return track;
}

// ─── Tri des positions à une étape donnée ─────────────────
function getRanking(positions, step) {
  return HORSES
    .map(h => ({ horse: h, pos: positions[h.id].positions[step] }))
    .sort((a, b) => b.pos - a.pos);
}

// ─── Embed d'animation ───────────────────────────────────
function buildRaceEmbed(positions, step, selected, mise, coin, state = 'racing') {
  const ranking = getRanking(positions, step);
  const colors  = { racing: C.NEUTRAL, win: C.WIN, loss: C.LOSS };

  const desc = ranking.map((r, idx) => {
    const { horse, pos } = r;
    const track   = renderTrack(pos);
    const marker  = horse.id === selected ? '👤' : `${idx + 1}.`;
    const pct     = Math.floor(pos * 100);
    return `${marker} ${horse.emoji}**${horse.name.padEnd(8)}** ${track} ${pct}%`;
  }).join('\n');

  const selectedHorse = HORSES.find(h => h.id === selected);
  const embed = new EmbedBuilder()
    .setColor(colors[state] || C.NEUTRAL)
    .setTitle(state === 'racing'
      ? `🏇 Hippodrome — Étape ${step}/${STEPS}`
      : state === 'win' ? '🏆 Hippodrome — VICTOIRE !' : '❌ Hippodrome — Défaite')
    .setDescription(`\`\`\`\n${desc}\n\`\`\``)
    .addFields(
      { name: '💰 Mise', value: chipStr(mise, coin), inline: true },
      { name: `${selectedHorse.emoji} Ton cheval`, value: `**#${selected} ${selectedHorse.name}**`, inline: true },
      { name: '📊 Cote', value: `**×${selectedHorse.odds}**`, inline: true },
    )
    .setFooter({ text: casinoFooter('Hippodrome') });

  return embed;
}

// ─── Podium final ─────────────────────────────────────────
function buildPodium(positions, winner) {
  const ranking = getRanking(positions, STEPS);
  const medals  = ['🥇', '🥈', '🥉'];
  return ranking.slice(0, 3)
    .map((r, i) => `${medals[i]} **${r.horse.emoji} ${r.horse.name}** (×${r.horse.odds})`)
    .join('\n');
}

// ─── Boutons post-course ──────────────────────────────────
function buildGameRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hippo_replay_${userId}`)
      .setLabel('🔄 Rejouer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`hippo_changemise_${userId}`)
      .setLabel('💰 Changer la mise')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`hippo_stats_${userId}`)
      .setLabel('📊 Mes stats')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`hippo_cotes_${userId}`)
      .setLabel('📋 Cotes')
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─── Jeu principal ───────────────────────────────────────
async function playRace(source, userId, guildId, mise, selectedHorse) {
  const cfg  = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg?.currency_emoji || '🪙';
  const u    = db.getUser(userId, guildId);

  // Validations
  if (!u) return source.editReply({ content: '❌ Profil introuvable.', ephemeral: true }).catch(() => {});
  if (mise < 5)     return source.editReply({ content: '❌ Mise minimale : **5 coins**.', ephemeral: true }).catch(() => {});
  if (mise > u.balance) return source.editReply({ content: `❌ Solde insuffisant — tu as **${u.balance.toLocaleString('fr-FR')} ${coin}**.`, ephemeral: true }).catch(() => {});
  if (selectedHorse < 1 || selectedHorse > 6) return source.editReply({ content: '❌ Cheval invalide (1–6).', ephemeral: true }).catch(() => {});

  // Déduire la mise
  db.addCoins(userId, guildId, -mise);
  const balBeforeMise = u.balance;

  // Sauvegarder session
  hippoSessions.set(userId, { mise, selectedHorse });

  // Déterminer résultat et positions
  const winner    = determineWinner();
  const positions = generatePositions(winner);
  const horse     = HORSES.find(h => h.id === selectedHorse);

  // ─── Phase 1 : Préparation ────────────────────────────
  const prepEmbed = new EmbedBuilder()
    .setColor(C.NEUTRAL)
    .setTitle('🏇 Hippodrome — Les chevaux se préparent...')
    .setDescription(
      '```\n' +
      HORSES.map(h => `  ${h.emoji} ${h.name.padEnd(9)} — ×${h.odds} (${h.tier})`).join('\n') +
      '\n```'
    )
    .addFields(
      { name: '💰 Mise', value: chipStr(mise, coin), inline: true },
      { name: `${horse.emoji} Cheval choisi`, value: `**#${selectedHorse} ${horse.name}** (×${horse.odds})`, inline: true },
    )
    .setFooter({ text: casinoFooter('Hippodrome') });

  await source.editReply({ embeds: [prepEmbed], components: [] }).catch(() => {});
  await sleep(1200);

  // ─── Phase 2 : Compte à rebours ───────────────────────
  for (const txt of ['3…', '2…', '1…', '🚀 PARTIS !']) {
    const countEmbed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('🏇 Hippodrome — Départ imminent !')
      .setDescription(`\n# ${txt}\n`)
      .setFooter({ text: casinoFooter('Hippodrome') });
    await source.editReply({ embeds: [countEmbed] }).catch(() => {});
    await sleep(txt === '🚀 PARTIS !' ? 800 : 700);
  }

  // ─── Phase 3 : Animation de la course ─────────────────
  for (let step = 1; step <= STEPS; step++) {
    const raceEmbed = buildRaceEmbed(positions, step, selectedHorse, mise, coin, 'racing');
    await source.editReply({ embeds: [raceEmbed] }).catch(() => {});
    await sleep(step === STEPS ? 500 : 1100);
  }

  // ─── Phase 4 : Photo-finish ───────────────────────────
  const photoEmbed = new EmbedBuilder()
    .setColor('#8E44AD')
    .setTitle('📸 Hippodrome — PHOTO-FINISH !')
    .setDescription('```\n⚡ Analyse de l\'arrivée en cours...\n```')
    .setFooter({ text: casinoFooter('Hippodrome') });
  await source.editReply({ embeds: [photoEmbed] }).catch(() => {});
  await sleep(900);

  // ─── Phase 5 : Résultat ───────────────────────────────
  const isWin = winner.id === selectedHorse;
  const stat  = getStat(userId);

  stat.gamesPlayed++;
  stat.totalWagered += mise;

  let gain, newBalance, resultText;

  if (isWin) {
    const winnings = Math.floor(mise * winner.odds);
    gain       = winnings - mise;
    newBalance = balBeforeMise - mise + winnings;
    db.addCoins(userId, guildId, winnings);
    stat.wins++;
    stat.totalWon += winnings;
    if (gain > stat.biggestWin) stat.biggestWin = gain;
    resultText = `🎉 **${winner.emoji} ${winner.name} gagne la course !**\nTu remportes **${winnings.toLocaleString('fr-FR')} ${coin}** × ${winner.odds} !`;
  } else {
    gain       = -mise;
    newBalance = balBeforeMise - mise;
    stat.losses++;
    resultText = `💨 **${winner.emoji} ${winner.name} remporte la victoire...**\nTon cheval **${horse.emoji} ${horse.name}** n'a pas suffi.`;
  }

  const podium   = buildPodium(positions, winner);
  const finalEmbed = buildRaceEmbed(positions, STEPS, selectedHorse, mise, coin, isWin ? 'win' : 'loss');
  finalEmbed.setDescription(null);
  finalEmbed.addFields(
    { name: isWin ? '🏆 Résultat' : '❌ Résultat', value: resultText, inline: false },
    { name: '🏇 Podium', value: podium, inline: true },
    { name: '💰 Bilan', value: balanceLine(newBalance, gain, coin), inline: true },
    {
      name: '📊 Session',
      value: `✅ ${stat.wins}V  ❌ ${stat.losses}D  🎮 ${stat.gamesPlayed} parties`,
      inline: false,
    },
  );

  await source.editReply({ embeds: [finalEmbed], components: [buildGameRow(userId)] }).catch(() => {});
}

// ─── Sélection du cheval (embed + boutons) ────────────────
async function showHorseSelection(source, userId, guildId, mise, isReply = false) {
  const cfg  = db.getConfig ? db.getConfig(guildId) : {};
  const coin = cfg?.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(C.NEUTRAL)
    .setTitle('🏇 Hippodrome — Choisis ton cheval')
    .setDescription(
      HORSES.map(h =>
        `${h.color} **#${h.id} ${h.emoji} ${h.name}** — Cote ×${h.odds} *(${h.tier})*`
      ).join('\n')
    )
    .addFields({ name: '💰 Mise', value: chipStr(mise, coin) })
    .setFooter({ text: 'Plus la cote est élevée, plus le gain est grand — mais la victoire est rare !' });

  const row1 = new ActionRowBuilder().addComponents(
    ...HORSES.slice(0, 3).map(h =>
      new ButtonBuilder()
        .setCustomId(`hippo_pick_${userId}_${h.id}_${mise}`)
        .setLabel(`${h.name} ×${h.odds}`)
        .setEmoji(h.id === 1 ? '⚡' : h.id === 2 ? '🌩️' : '🌬️')
        .setStyle(h.odds <= 2.5 ? ButtonStyle.Success : ButtonStyle.Primary)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    ...HORSES.slice(3, 6).map(h =>
      new ButtonBuilder()
        .setCustomId(`hippo_pick_${userId}_${h.id}_${mise}`)
        .setLabel(`${h.name} ×${h.odds}`)
        .setEmoji(h.id === 4 ? '🌊' : h.id === 5 ? '🌪️' : '💨')
        .setStyle(ButtonStyle.Danger)
    )
  );

  const opts = { embeds: [embed], components: [row1, row2] };
  if (isReply) {
    await source.reply({ ...opts, ephemeral: true }).catch(() => {});
  } else {
    await source.editReply(opts).catch(() => {});
  }
}

// ─── handleComponent ─────────────────────────────────────
module.exports.handleComponent = async function(interaction, customId) {
  if (!customId.startsWith('hippo_')) return false;

  const userId = interaction.user.id;

  // ── Sélection de cheval ──
  if (customId.startsWith(`hippo_pick_`)) {
    const parts = customId.split('_');
    // hippo_pick_{userId}_{horseId}_{mise}
    const targetUser  = parts[2];
    if (targetUser !== userId) {
      await interaction.reply({ content: '❌ Ce n\'est pas ton jeu.', ephemeral: true }).catch(() => {});
      return true;
    }
    const selectedHorse = parseInt(parts[3]);
    const mise          = parseInt(parts[4]);
    await interaction.deferUpdate().catch(() => {});
    await playRace(interaction, userId, interaction.guildId, mise, selectedHorse);
    return true;
  }

  // ── Rejouer ──
  if (customId.startsWith(`hippo_replay_${userId}`)) {
    const session = hippoSessions.get(userId);
    if (!session) {
      await interaction.reply({ content: '⚠️ Session expirée. Relance `/hippodrome`.', ephemeral: true }).catch(() => {});
      return true;
    }
    await interaction.deferUpdate().catch(() => {});
    await playRace(interaction, userId, interaction.guildId, session.mise, session.selectedHorse);
    return true;
  }

  // ── Changer la mise ──
  if (customId.startsWith(`hippo_changemise_${userId}`)) {
    await interaction.showModal(changeMiseModal('hippo', userId)).catch(() => {});
    return true;
  }

  // ── Modal mise ──
  if (customId.startsWith(`hippo_modal_${userId}`)) {
    const u        = db.getUser(userId, interaction.guildId);
    const cfg      = db.getConfig ? db.getConfig(interaction.guildId) : {};
    const coin     = cfg?.currency_emoji || '🪙';
    const rawMise  = interaction.fields.getTextInputValue('newmise');
    const newMise  = parseMise(rawMise, u?.balance || 0);

    if (!u) {
      await interaction.reply({ content: '❌ Profil introuvable.', ephemeral: true }).catch(() => {});
      return true;
    }
    if (newMise === null || isNaN(newMise)) {
      await interaction.reply({ content: '❌ Mise invalide.', ephemeral: true }).catch(() => {});
      return true;
    }
    if (newMise < 5) {
      await interaction.reply({ content: `❌ Mise minimale : 5 ${coin}`, ephemeral: true }).catch(() => {});
      return true;
    }
    if (newMise > u.balance) {
      await interaction.reply({ content: `❌ Solde insuffisant — tu as **${u.balance.toLocaleString('fr-FR')} ${coin}**`, ephemeral: true }).catch(() => {});
      return true;
    }

    await showHorseSelection(interaction, userId, interaction.guildId, newMise, true);
    return true;
  }

  // ── Stats session ──
  if (customId.startsWith(`hippo_stats_${userId}`)) {
    const stat = getStat(userId);
    const netGain = stat.totalWon - stat.totalWagered;
    const winRate = stat.gamesPlayed > 0 ? Math.round((stat.wins / stat.gamesPlayed) * 100) : 0;
    const cfg  = db.getConfig ? db.getConfig(interaction.guildId) : {};
    const coin = cfg?.currency_emoji || '🪙';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 Tes stats Hippodrome (session)')
      .addFields(
        { name: '🎮 Parties', value: `**${stat.gamesPlayed}**`, inline: true },
        { name: '✅ Victoires', value: `**${stat.wins}**`, inline: true },
        { name: '❌ Défaites', value: `**${stat.losses}**`, inline: true },
        { name: '📈 Win rate', value: `**${winRate}%**`, inline: true },
        { name: '💰 Total misé', value: `**${stat.totalWagered.toLocaleString('fr-FR')} ${coin}**`, inline: true },
        { name: `${netGain >= 0 ? '📈' : '📉'} Bilan net`, value: `**${netGain >= 0 ? '+' : ''}${netGain.toLocaleString('fr-FR')} ${coin}**`, inline: true },
        { name: '🏆 Plus gros gain', value: `**${stat.biggestWin.toLocaleString('fr-FR')} ${coin}**`, inline: true },
      )
      .setFooter({ text: 'Stats réinitialisées à chaque redémarrage du bot' });

    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    return true;
  }

  // ── Cotes ──
  if (customId.startsWith(`hippo_cotes_${userId}`)) {
    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('📋 Tableau des cotes — Hippodrome')
      .setDescription(
        HORSES.map(h => {
          const chance = Math.round((1 / h.odds) * 100 * 10) / 10; // Probabilité approximative
          return `${h.color} **${h.emoji} #${h.id} ${h.name}** — ×${h.odds} *(${h.tier})* — ~${chance}% de victoire`;
        }).join('\n')
      )
      .setFooter({ text: 'Les cotes sont pondérées — le favori ne gagne pas toujours !' });

    await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    return true;
  }

  return false;
};

// ─── Données slash ────────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('hippodrome')
  .setDescription('🏇 Hippodrome — Mise sur un cheval et regarde la course en direct !')
  .addIntegerOption(o =>
    o.setName('mise')
      .setDescription('Montant à miser (min 5)')
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption(o =>
    o.setName('cheval')
      .setDescription('Numéro du cheval (1=Favori ×1.8 → 6=Outsider ×15)')
      .setRequired(false)
      .setMinValue(1)
      .setMaxValue(6)
  );

// ─── execute ──────────────────────────────────────────────
async function execute(interaction) {
  const userId        = interaction.user.id;
  const guildId       = interaction.guildId;
  const mise          = interaction.options.getInteger('mise');
  const selectedHorse = interaction.options.getInteger('cheval');

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply().catch(() => {});
  }

  if (selectedHorse) {
    await playRace(interaction, userId, guildId, mise, selectedHorse);
  } else {
    await showHorseSelection(interaction, userId, guildId, mise);
  }
}

// ─── run (préfixe &) ─────────────────────────────────────
async function run(message, args) {
  const mise   = parseInt(args[0]);
  const cheval = parseInt(args[1]) || null;

  if (!mise || mise < 5) {
    return message.reply('❌ Usage : `&hippodrome <mise> [1-6]` — Mise minimale : 5 coins.');
  }
  if (cheval !== null && (cheval < 1 || cheval > 6)) {
    return message.reply('❌ Cheval invalide. Choisis entre 1 et 6.');
  }

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
    options: {
      getInteger: (k) => k === 'mise' ? mise : k === 'cheval' ? cheval : null,
      getString:  () => null,
      getUser:    () => null,
      getBoolean: () => null,
    },
    deferReply: async () => {},
    editReply:  async (d) => {
      if (sentMsg) { await sentMsg.edit(d).catch(() => {}); }
      else { sentMsg = await message.channel.send(d).catch(() => {}); }
      return sentMsg;
    },
    reply:   async (d) => message.reply(d).catch(() => message.channel.send(d).catch(() => {})),
    followUp: async (d) => message.channel.send(d).catch(() => {}),
  };

  await execute(fake);
}

module.exports = {
  name: 'hippodrome',
  aliases: ['hippo', 'horse', 'course'],
  data,
  execute,
  run,
  handleComponent: module.exports.handleComponent,
};
