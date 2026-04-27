// ============================================================
// hippodrome.js — Hippodrome avec animation de course
// Emplacement : src/commands_guild/games/hippodrome.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { C, chipStr, balanceLine, casinoFooter, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Sessions de jeu (pour rejouer avec les mêmes paramètres) ──
const hippoSessions = new Map(); // userId → { mise, selectedHorse }

// ─── Configuration des chevaux ────────────────────────────
const HORSES = [
  { id: 1, name: 'Éclair',   odds: 1.5 },
  { id: 2, name: 'Tonnerre', odds: 2.0 },
  { id: 3, name: 'Mistral',  odds: 3.0 },
  { id: 4, name: 'Alizé',    odds: 4.0 },
  { id: 5, name: 'Tempête',  odds: 6.0 },
  { id: 6, name: 'Ouragan',  odds: 10.0 },
];

const TRACK_LENGTH = 20; // longueur de la piste en caractères

// ─── Calcul du gagnant (pondéré par l'inverse des cotes) ──
function determineWinner() {
  // Plus les cotes sont élevées, moins le cheval a de chances de gagner
  // Poids = 1 / odds
  const weights = HORSES.map(h => 1 / h.odds);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let random = Math.random() * totalWeight;
  for (let i = 0; i < HORSES.length; i++) {
    random -= weights[i];
    if (random <= 0) return HORSES[i];
  }
  return HORSES[0]; // fallback
}

// ─── Générer positions aléatoires pour chaque étape ───────
function generateRacePositions() {
  const positions = {};
  HORSES.forEach(h => {
    positions[h.id] = [];
  });

  // 5 étapes d'animation (0%, 25%, 50%, 75%, 100%)
  for (let step = 0; step <= 4; step++) {
    const progress = (step / 4) * 0.95; // 95% max avant la ligne d'arrivée
    HORSES.forEach(h => {
      // Ajouter du bruit pour que ça paraisse moins linéaire
      const noise = (Math.random() - 0.5) * 0.1;
      positions[h.id].push(Math.floor((progress + noise) * TRACK_LENGTH));
    });
  }

  return positions;
}

// ─── Render la piste de course ───────────────────────────
function renderTrack(horseId, position) {
  const pos = Math.min(Math.max(position, 0), TRACK_LENGTH);
  const filled = Math.floor(pos);
  const progressPercent = Math.floor((pos / TRACK_LENGTH) * 100);

  let track = '';
  for (let i = 0; i < TRACK_LENGTH; i++) {
    if (i < filled) track += '█';
    else if (i === filled) track += '▓';
    else track += '░';
  }

  return { track, progressPercent };
}

// ─── Générer le podium (top 3 chevaux) ───────────────────
function generatePodium(positions, winner) {
  const finalPositions = Object.entries(positions).map(([horseId, posArr]) => ({
    id: parseInt(horseId),
    finalPos: posArr[4] || 0,
  })).sort((a, b) => b.finalPos - a.finalPos);

  const podium = finalPositions.slice(0, 3);
  let podiumStr = '';
  podium.forEach((p, idx) => {
    const h = HORSES.find(x => x.id === p.id);
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
    podiumStr += `${medal} #${h.id} ${h.name}\n`;
  });
  return podiumStr;
}

// ─── Générer l'embed de la course ────────────────────────
function buildRaceEmbed(positions, step, selectedHorse, mise, coin, isFinished = false) {
  const horse = HORSES.find(h => h.id === selectedHorse);
  const embed = new EmbedBuilder()
    .setColor(isFinished ? '#27AE60' : C.NEUTRAL)
    .setTitle(isFinished ? '🏇 Hippodrome — Résultats!' : '🏇 Hippodrome — La course en cours...')
    .setDescription('');

  let description = '';
  HORSES.forEach(h => {
    const pos = positions[h.id][step] || 0;
    const { track, progressPercent } = renderTrack(h.id, pos);
    const marker = h.id === selectedHorse ? '🎯 ' : '   ';
    description += `${marker}🐴${h.id} ${h.name.padEnd(10)} [${track}] ${progressPercent}%\n`;
  });

  embed.setDescription(description);
  embed.addFields(
    { name: '💰 Ta mise', value: chipStr(mise, coin), inline: true },
    { name: '🐴 Ton cheval', value: `#${selectedHorse} ${horse.name}`, inline: true },
  );

  return embed;
}

// ─── Jeu principal ───────────────────────────────────────
async function playHippodrome(source, userId, guildId, mise, selectedHorse) {
  const isInteraction = !!source.editReply;
  const u = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  // Validation
  if (!u) {
    const err = '❌ Utilisateur non trouvé dans la base de données.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  if (u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u.balance} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  if (mise < 5) {
    const err = '❌ Mise minimale : **5 coins**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  if (selectedHorse < 1 || selectedHorse > 6) {
    const err = '❌ Cheval invalide. Choisir un numéro entre 1 et 6.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  // Déduire la mise
  db.addCoins(userId, guildId, -mise);

  // Sauvegarder la session pour le bouton "Rejouer"
  hippoSessions.set(userId, { mise, selectedHorse });

  // Déterminer le gagnant et générer les positions
  const winner = determineWinner();
  const positions = generateRacePositions();

  // Message initial
  const startEmbed = new EmbedBuilder()
    .setColor(C.NEUTRAL)
    .setTitle('🏇 Hippodrome — Les chevaux se préparent...')
    .setDescription('Les chevaux arrivent sur la piste...\n🐴 Les paris sont fermés!\n⏳ La course commence...')
    .addFields(
      { name: '💰 Ta mise', value: chipStr(mise, coin), inline: true },
      { name: '🐴 Ton cheval', value: `#${selectedHorse} ${HORSES.find(h => h.id === selectedHorse).name}`, inline: true },
    )
    .setFooter({ text: casinoFooter('Hippodrome') });

  let msg;
  if (isInteraction) {
    if (!source.deferred && !source.replied) await source.deferReply();
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.channel.send({ embeds: [startEmbed] });
  }

  // Animation de la course (4 étapes)
  for (let step = 0; step < 4; step++) {
    await sleep(1500); // délai entre chaque étape

    const raceEmbed = buildRaceEmbed(positions, step, selectedHorse, mise, coin, false);
    raceEmbed.setFooter({ text: casinoFooter('Hippodrome') });

    if (isInteraction) {
      await source.editReply({ embeds: [raceEmbed] });
    } else {
      await msg.edit({ embeds: [raceEmbed] });
    }
  }

  // Étape finale : afficher le gagnant et le podium
  await sleep(1000);

  const isWin = winner.id === selectedHorse;
  const finalEmbed = buildRaceEmbed(positions, 4, selectedHorse, mise, coin, true);
  const podiumStr = generatePodium(positions, winner);

  let result = '';
  let newBalance = u.balance;

  if (isWin) {
    const winnings = Math.floor(mise * winner.odds);
    const gain = winnings - mise;
    newBalance = u.balance + winnings;
    db.addCoins(userId, guildId, winnings);

    finalEmbed.setColor(C.WIN);
    result = `🎉 **VICTOIRE!** Le cheval #${winner.id} ${winner.name} a gagné!\n`;
    result += `💰 Tu remportes **${winnings} ${coin}** (mise × ${winner.odds})!\n`;
    result += `${balanceLine(newBalance, gain, coin)}`;
  } else {
    const loss = mise;
    finalEmbed.setColor(C.LOSS);
    result = `❌ **DÉFAITE!** Le cheval #${winner.id} ${winner.name} a gagné...\n`;
    result += `Tu perds ta mise de **${mise} ${coin}**.\n`;
    result += `${balanceLine(newBalance, -loss, coin)}`;
  }

  finalEmbed.addFields(
    { name: '🏇 Podium', value: podiumStr, inline: true },
    { name: '🏁 Résultat', value: result }
  );
  finalEmbed.setFooter({ text: casinoFooter('Hippodrome') });

  // Boutons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hippo_replay_${userId}`)
      .setLabel('🔄 Rejouer (même cheval)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`hippo_changemise_${userId}`)
      .setLabel('💰 Changer la mise')
      .setStyle(ButtonStyle.Secondary),
  );

  if (isInteraction) {
    await source.editReply({ embeds: [finalEmbed], components: [row] });
  } else {
    await msg.edit({ embeds: [finalEmbed], components: [row] });
  }
}

// ─── Gestionnaire des composants (boutons, modal) ────────
async function handleComponent(interaction, customId, userId) {
  const coin = (db.getConfig ? db.getConfig(interaction.guildId) : null)?.currency_emoji || '🪙';

  // Rejouer avec le même cheval
  if (customId.startsWith(`hippo_replay_${userId}`)) {
    const session = hippoSessions.get(userId);
    if (!session) {
      return interaction.reply({ content: '⚠️ Session expirée, relance /hippodrome', ephemeral: true });
    }
    const { mise, selectedHorse } = session;
    await interaction.deferReply();
    await playHippodrome(interaction, userId, interaction.guildId, mise, selectedHorse);
    return true;
  }

  // Changer la mise
  if (customId.startsWith(`hippo_changemise_${userId}`)) {
    const modal = changeMiseModal('hippo', userId);
    await interaction.showModal(modal);
    return true;
  }

  // Traiter la soumission du modal
  if (customId.startsWith(`hippo_modal_${userId}`)) {
    const u = db.getUser(userId, interaction.guildId);
    if (!u) {
      await interaction.reply({ content: '❌ Utilisateur non trouvé.', ephemeral: true });
      return true;
    }

    const newMiseRaw = interaction.fields.getTextInputValue('newmise');
    const newMise = parseMise(newMiseRaw, u.balance);

    if (newMise === null) {
      await interaction.reply({ content: '❌ Mise invalide.', ephemeral: true });
      return true;
    }

    if (newMise < 5) {
      await interaction.reply({ content: `❌ Mise minimale : 5 ${coin}`, ephemeral: true });
      return true;
    }

    if (newMise > u.balance) {
      await interaction.reply({ content: `❌ Tu n'as que **${u.balance} ${coin}**`, ephemeral: true });
      return true;
    }

    // Redemander le numéro du cheval
    const embed = new EmbedBuilder()
      .setColor(C.NEUTRAL)
      .setTitle('🏇 Hippodrome — Nouvelle mise')
      .setDescription('Quel cheval veux-tu parier?\n\n' +
        HORSES.map(h => `**#${h.id}** — ${h.name} (×${h.odds})`).join('\n'))
      .addFields({ name: '💰 Mise', value: chipStr(newMise, coin) })
      .setFooter({ text: casinoFooter('Hippodrome') });

    // Créer les boutons pour sélectionner le cheval
    const horseButtons = new ActionRowBuilder().addComponents(
      ...HORSES.slice(0, 3).map(h =>
        new ButtonBuilder()
          .setCustomId(`hippo_selecthorse_${userId}_${h.id}_${newMise}`)
          .setLabel(`#${h.id} ${h.name}`)
          .setStyle(h.odds >= 6 ? ButtonStyle.Danger : h.odds >= 4 ? ButtonStyle.Primary : ButtonStyle.Success)
      )
    );

    const horseButtons2 = new ActionRowBuilder().addComponents(
      ...HORSES.slice(3, 6).map(h =>
        new ButtonBuilder()
          .setCustomId(`hippo_selecthorse_${userId}_${h.id}_${newMise}`)
          .setLabel(`#${h.id} ${h.name}`)
          .setStyle(h.odds >= 6 ? ButtonStyle.Danger : h.odds >= 4 ? ButtonStyle.Primary : ButtonStyle.Success)
      )
    );

    await interaction.reply({ embeds: [embed], components: [horseButtons, horseButtons2], ephemeral: true });
    return true;
  }

  // Sélection du cheval
  if (customId.startsWith(`hippo_selecthorse_${userId}`)) {
    const parts = customId.split('_');
    const selectedHorse = parseInt(parts[3]);
    const mise = parseInt(parts[4]);

    await interaction.deferReply();
    await playHippodrome(interaction, userId, interaction.guildId, mise, selectedHorse);
    return true;
  }

  return false;
}

// ─── Commande slash ───────────────────────────────────────
const data = new SlashCommandBuilder()
  .setName('hippodrome')
  .setDescription('🏇 Hippodrome — Mise sur le bon cheval et regarde la course!')
  .addIntegerOption(o =>
    o.setName('mise')
      .setDescription('Montant à miser')
      .setRequired(true)
      .setMinValue(1)
  )
  .addIntegerOption(o =>
    o.setName('cheval')
      .setDescription('Numéro du cheval (1-6)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(6)
  );

async function execute(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;
  const mise = interaction.options.getInteger('mise');
  const selectedHorse = interaction.options.getInteger('cheval');

  await interaction.deferReply();
  await playHippodrome(interaction, userId, guildId, mise, selectedHorse);
}

module.exports = {
  name: 'hippodrome',
  aliases: ['hippo', 'horse', 'course'],
  data,
  async execute(interaction) {
    return execute(interaction);
  },
  async handleComponent(interaction, customId) {
    const userId = interaction.user.id;
    if (!customId.startsWith('hippo_')) return false;
    return await handleComponent(interaction, customId, userId);
  },
  async run(message, args) {
    const mise   = parseInt(args[0]) || 50;
    const cheval = parseInt(args[1]) || 1;
    if (mise < 5) return message.reply('❌ Mise minimale : 5 coins. Usage : `&hippodrome <mise> [1-6]`');
    if (cheval < 1 || cheval > 6) return message.reply('❌ Choisir un cheval entre 1 et 6. Usage : `&hippodrome <mise> <cheval>`');
    const fake = {
      user: message.author, member: message.member,
      guild: message.guild, guildId: message.guildId,
      channel: message.channel, client: message.client,
      deferred: false, replied: false,
      options: {
        getInteger: (k) => k === 'mise' ? mise : k === 'cheval' ? cheval : null,
        getString: () => null, getUser: () => null, getBoolean: () => null,
      },
      deferReply: async () => {},
      editReply:  async (d) => message.channel.send(d).catch(() => {}),
      reply:      async (d) => message.reply(d).catch(() => message.channel.send(d).catch(() => {})),
      followUp:   async (d) => message.channel.send(d).catch(() => {}),
    };
    await execute(fake);
  },
};
