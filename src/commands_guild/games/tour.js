// ============================================================
// tour.js — Tour d'Ascension : monte les étages, évite les pièges !
// /tour mise:500 difficulte:normal  |  &tour 500 normal
// Chaque étage : choisir la bonne porte. Raté = tout perdu.
// ============================================================
'use strict';
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ─── Config des difficultés ──────────────────────────────────
const CONFIGS = {
  facile:  { doors: 4, traps: 1, mult: 1.35, emoji: '🟢', label: 'Facile',  maxFloor: 15 },
  normal:  { doors: 3, traps: 1, mult: 1.65, emoji: '🟡', label: 'Normal',  maxFloor: 12 },
  difficile:{ doors: 2, traps: 1, mult: 2.20, emoji: '🔴', label: 'Difficile', maxFloor: 10 },
};

// ─── Store sessions en mémoire ───────────────────────────────
// key: userId_guildId → { mise, floor, mult, diff, userId, guildId, currentMult, started }
const sessions = new Map();

// ─── Rendu d'un étage ────────────────────────────────────────
const FLOOR_EMOJIS = [
  '🏠','🏢','🏛️','🗼','🏰','⛩️','🌆','🌇','🌃','🌉','🚀','🛸','⭐','🌙','👑',
];

function getFloorEmoji(floor) {
  return FLOOR_EMOJIS[Math.min(floor - 1, FLOOR_EMOJIS.length - 1)];
}

function buildProgressBar(floor, maxFloor) {
  const filled = Math.floor((floor / maxFloor) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${floor}/${maxFloor}`;
}

function buildEmbed(session, phase, trapDoor = null, chosenDoor = null) {
  const cfg = CONFIGS[session.diff];
  const floorE = getFloorEmoji(session.floor);
  const progress = buildProgressBar(session.floor, cfg.maxFloor);
  const gains = Math.floor(session.mise * session.currentMult);

  let color, title, desc;

  if (phase === 'playing') {
    color = session.floor >= cfg.maxFloor * 0.8 ? '#FFD700' : session.floor >= cfg.maxFloor * 0.5 ? '#F39C12' : '#5865F2';
    title = `${floorE} Étage ${session.floor} — Tour d'Ascension`;

    const tension = [
      'Choisis une porte... une seule mène au salut.',
      'Quelle porte cachera ton chemin vers la gloire ?',
      'Fais confiance à ton instinct — ou à la chance.',
      'Une erreur et tout s\'effondre. À toi de jouer.',
      'Tu peux encore t\'arrêter ou continuer à monter...',
    ];

    desc =
      `> *${tension[Math.min(session.floor - 1, tension.length - 1)]}*\n\n` +
      `${cfg.emoji} Difficulté : **${cfg.label}** · ${cfg.traps}/${cfg.doors} portes sont des pièges\n` +
      `📊 Progression : \`${progress}\`\n` +
      `💰 Gain actuel : **${gains.toLocaleString()} coins** (×${session.currentMult.toFixed(2)})\n` +
      `📈 Prochain palier : **${Math.floor(session.mise * session.currentMult * cfg.mult).toLocaleString()} coins** (×${(session.currentMult * cfg.mult).toFixed(2)})\n\n` +
      `**Choisis une porte :**`;
  }

  else if (phase === 'win_floor') {
    color = '#2ECC71';
    title = `✅ Bonne porte ! Étage ${session.floor} franchi`;
    desc =
      `🚪 Tu as choisi la **porte ${chosenDoor}** — elle était sûre !\n\n` +
      `${cfg.emoji} Difficulté : **${cfg.label}**\n` +
      `📊 Progression : \`${progress}\`\n` +
      `💰 Gain actuel : **${gains.toLocaleString()} coins** (×${session.currentMult.toFixed(2)})\n\n` +
      (session.floor < cfg.maxFloor
        ? `**Continue à monter ou encaisse tes gains ?**`
        : `**Tu as atteint le sommet ! 🏆**`
      );
  }

  else if (phase === 'lose') {
    color = '#E74C3C';
    title = `💥 PIÈGE ! Étage ${session.floor} — Game Over`;
    const loseMsgs = [
      'Tu as marché dans le piège. La tour t\'a vaincu.',
      'La mauvaise porte t\'a coûté tout. Mieux vaut réessayer !',
      'Brutal. La fortune ne t\'a pas souri cette fois.',
    ];
    desc =
      `🚪 La **porte ${chosenDoor}** cachait un piège !\n` +
      `💣 Trap révélé : porte **${trapDoor}** (c'était la même)\n\n` +
      `Étage atteint : **${session.floor - 1}** / ${cfg.maxFloor}\n` +
      `💸 Perdu : **${session.mise.toLocaleString()} coins**\n\n` +
      `*${loseMsgs[Math.floor(Math.random() * loseMsgs.length)]}*`;
  }

  else if (phase === 'cashout') {
    color = '#FFD700';
    title = `💰 Encaissement — Étage ${session.floor - 1} / ${cfg.maxFloor}`;
    const cashMsgs = [
      `Tu joues la sécurité — sage décision !`,
      `L'audace c'est bien, mais la prudence aussi !`,
      `Tu repars avec tes gains — c'est ça la vraie victoire !`,
    ];
    desc =
      `Tu as encaissé après l'**étage ${session.floor - 1}**.\n\n` +
      `💰 **+${gains.toLocaleString()} coins** (×${session.currentMult.toFixed(2)})\n\n` +
      `*${cashMsgs[Math.floor(Math.random() * cashMsgs.length)]}*`;
  }

  else if (phase === 'summit') {
    color = '#FFD700';
    title = `👑 SOMMET ATTEINT ! Tour conquise à 100% !`;
    const summit = Math.floor(session.mise * session.currentMult);
    desc =
      `Tu as survécu à **tous les ${cfg.maxFloor} étages** ! Incroyable !\n\n` +
      `🏆 Gain maximum : **+${summit.toLocaleString()} coins** (×${session.currentMult.toFixed(2)})\n` +
      `${cfg.emoji} Difficulté : **${cfg.label}** · Tous les pièges évités !\n\n` +
      `*La tour t'appartient. Tu es une légende.*`;
  }

  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc)
    .setFooter({ text: 'NexusBot Casino • Tour d\'Ascension' });
}

function buildDoorButtons(sessionId, cfg) {
  const doors = Array.from({ length: cfg.doors }, (_, i) =>
    new ButtonBuilder()
      .setCustomId(`tour_door_${sessionId}_${i + 1}`)
      .setLabel(`Porte ${i + 1}`)
      .setEmoji(['🚪','🔑','🗝️','🔐'][i] || '🚪')
      .setStyle(ButtonStyle.Primary)
  );
  return [new ActionRowBuilder().addComponents(...doors)];
}

function buildCashoutRow(sessionId, gains) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tour_cashout_${sessionId}`)
      .setLabel(`Encaisser ${gains.toLocaleString()} coins`)
      .setEmoji('💰')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tour_continue_${sessionId}`)
      .setLabel('Continuer à monter !')
      .setEmoji('⬆️')
      .setStyle(ButtonStyle.Danger),
  )];
}

// ─── Commande principale ─────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('tour')
    .setDescription('🗼 Tour d\'Ascension : monte les étages et évite les pièges !')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Montant à risquer (100–50 000 coins)')
      .setRequired(true)
      .setMinValue(100)
      .setMaxValue(50000)
    )
    .addStringOption(o => o
      .setName('difficulte')
      .setDescription('Difficulté de la tour (influence les gains)')
      .setRequired(false)
      .addChoices(
        { name: '🟢 Facile — 4 portes, 1 piège (×1.35/étage)', value: 'facile' },
        { name: '🟡 Normal — 3 portes, 1 piège (×1.65/étage)', value: 'normal' },
        { name: '🔴 Difficile — 2 portes, 1 piège (×2.20/étage)', value: 'difficile' },
      )
    ),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    try {
    const mise = interaction.options.getInteger('mise');
    const diff = interaction.options.getString('difficulte') || 'normal';
    return runGame(interaction, mise, diff, false);
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.editReply(_em).catch(() => {});
    } catch {}
  }},

  // Préfixe & (ex: &tour 500 normal)
  run(message, args) {
    const mise = parseInt(args[0]);
    const diff = (args[1] || 'normal').toLowerCase();
    if (!mise || mise < 100 || mise > 50000) return message.reply('❌ Usage : `&tour <mise> [facile|normal|difficile]` (100–50 000 coins).');
    if (!CONFIGS[diff]) return message.reply('❌ Difficulté invalide. Choisis : `facile`, `normal` ou `difficile`.');
    return runGame(message, mise, diff, true);
  },

  handleComponent,
};

// ─── Logique de démarrage ────────────────────────────────────
async function runGame(ctx, mise, diff, isPrefix) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;
  const cfg     = CONFIGS[diff] || CONFIGS.normal;
  const userData = db.getUser(userId, guildId);

  if (!userData || userData.balance < mise) {
    const msg = `❌ Solde insuffisant ! Tu as **${(userData?.balance || 0).toLocaleString()} 💰** pour une mise de **${mise.toLocaleString()} 💰**.`;
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  // Bloquer si déjà en session
  const key = `${userId}_${guildId}`;
  if (sessions.has(key)) {
    const msg = '❌ Tu as déjà une tour en cours ! Termine-la avant d\'en lancer une nouvelle.';
    return isPrefix ? ctx.reply(msg) : ctx.reply({ content: msg, ephemeral: true });
  }

  db.addCoins(userId, guildId, -mise);

  const session = {
    mise, diff,
    floor: 1,
    currentMult: 1.0,
    userId, guildId,
    started: Date.now(),
  };
  const sessionId = key;
  sessions.set(sessionId, session);

  // Timeout 10 min → cashout automatique
  setTimeout(() => {
    const s = sessions.get(sessionId);
    if (s) {
      const gains = Math.floor(s.mise * s.currentMult);
      if (gains > 0) db.addCoins(s.userId, s.guildId, gains);
      sessions.delete(sessionId);
    }
  }, 10 * 60 * 1000);

  const embed   = buildEmbed(session, 'playing');
  const buttons = buildDoorButtons(sessionId, cfg);
  const payload = { embeds: [embed], components: buttons };

  return isPrefix ? ctx.reply(payload) : ctx.reply(payload);
}

// ─── Gestion des boutons ─────────────────────────────────────
async function handleComponent(interaction, customId) {
  if (!customId.startsWith('tour_')) return false;

  const parts  = customId.split('_');
  const action = parts[1]; // door | cashout | continue

  const userId  = interaction.user.id;
  const guildId = interaction.guildId;
  const key     = `${userId}_${guildId}`;
  const session = sessions.get(key);

  if (!session) {
    await interaction.editReply({ content: '❌ Session expirée (10 min). Lance une nouvelle tour !', ephemeral: true });
    return true;
  }
  if (session.userId !== userId) {
    await interaction.editReply({ content: '❌ Ce n\'est pas ta tour !', ephemeral: true });
    return true;
  }

  await interaction.deferUpdate();

  const cfg = CONFIGS[session.diff];

  // ── Cashout ──────────────────────────────────────────────────
  if (action === 'cashout') {
    const gains = Math.floor(session.mise * session.currentMult);
    db.addCoins(session.userId, session.guildId, gains);
    db.addXP(session.userId, session.guildId, Math.max(5, Math.floor(gains / 100)));
    sessions.delete(key);

    const embed = buildEmbed(session, 'cashout');
    await interaction.editReply({ embeds: [embed], components: [] });
    return true;
  }

  // ── Continue → proposer les portes ───────────────────────────
  if (action === 'continue') {
    const embed   = buildEmbed(session, 'playing');
    const buttons = buildDoorButtons(key, cfg);
    await interaction.editReply({ embeds: [embed], components: buttons });
    return true;
  }

  // ── Door → choisir une porte ─────────────────────────────────
  if (action === 'door') {
    const chosenDoor = parseInt(parts[4]);
    if (!chosenDoor) return true;

    // Déterminer le(s) piège(s)
    const doorsList = Array.from({ length: cfg.doors }, (_, i) => i + 1);
    const shuffled  = [...doorsList].sort(() => Math.random() - 0.5);
    const trapDoors = shuffled.slice(0, cfg.traps);
    const isTrapped = trapDoors.includes(chosenDoor);

    if (isTrapped) {
      // 💥 Game Over
      sessions.delete(key);
      const embed = buildEmbed(session, 'lose', trapDoors[0], chosenDoor);
      await interaction.editReply({ embeds: [embed], components: [] });
    } else {
      // ✅ Passer l'étage
      session.currentMult = parseFloat((session.currentMult * cfg.mult).toFixed(4));
      session.floor++;
      sessions.set(key, session);

      const gains = Math.floor(session.mise * session.currentMult);

      if (session.floor > cfg.maxFloor) {
        // 👑 Sommet atteint
        db.addCoins(session.userId, session.guildId, gains);
        db.addXP(session.userId, session.guildId, Math.max(20, Math.floor(gains / 50)));
        sessions.delete(key);
        const embed = buildEmbed(session, 'summit');
        await interaction.editReply({ embeds: [embed], components: [] });
      } else {
        // Proposer cashout ou continuer
        const embed   = buildEmbed(session, 'win_floor', null, chosenDoor);
        const buttons = buildCashoutRow(key, gains);
        await interaction.editReply({ embeds: [embed], components: buttons });
      }
    }
    return true;
  }

  return false;
}
