require('dotenv').config();
const {
  Client, GatewayIntentBits, Partials,
  Collection, REST, Routes
} = require('discord.js');
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

// ── Client ──────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
});

client.commands  = new Collection();
client.cooldowns = new Collection();

// ── Charger les commandes GLOBALES ─────────────────────
const allCommands      = [];   // → Routes.applicationCommands (global)
const guildOnlyCommands = [];  // → Routes.applicationGuildCommands (HOME_GUILD_ID)
const contextMenus     = [];   // → Routes.applicationCommands (global, type 2 ou 3)

function loadCommandsFromDir(dir, targetArray) {
  if (!fs.existsSync(dir)) return;
  const folders = fs.readdirSync(dir).filter(f =>
    !f.endsWith('.disabled') && fs.statSync(path.join(dir, f)).isDirectory()
  );
  for (const folder of folders) {
    const files = fs.readdirSync(path.join(dir, folder)).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const cmd = require(path.join(dir, folder, file));
        if (cmd?.data && cmd?.execute) {
          client.commands.set(cmd.data.name, cmd);
          targetArray.push(cmd.data.toJSON());
        }
      } catch (e) {
        console.error(`[CMD] Erreur chargement ${folder}/${file}:`, e.message);
      }
    }
  }
}

function loadContextMenusFromDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const cmd = require(path.join(dir, file));
      if (cmd?.data && cmd?.execute) {
        client.commands.set(cmd.data.name, cmd);
        contextMenus.push(cmd.data.toJSON());
      }
    } catch (e) {
      console.error(`[MENU] Erreur chargement ${file}:`, e.message);
    }
  }
}

loadCommandsFromDir(path.join(__dirname, 'commands'), allCommands);
loadCommandsFromDir(path.join(__dirname, 'commands_guild'), guildOnlyCommands);
loadContextMenusFromDir(path.join(__dirname, 'context_menus'));

// ── Charger les commandes PRÉFIXÉES (illimitées — aucune restriction Discord) ──
try {
  const { loadPrefixCommands } = require('./utils/prefixHandler');
  loadPrefixCommands();
} catch (e) { console.error('[PREFIX] Erreur init:', e.message); }

// ── Charger les events ──────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
  try {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  } catch (e) {
    console.error(`[EVT] Erreur chargement ${file}:`, e.message);
  }
}

// ── Ready ───────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  🚀 NexusBot v2.0 — ONLINE           ║`);
  console.log(`║  👤 ${client.user.tag.padEnd(32)}║`);
  console.log(`║  🌐 ${String(client.guilds.cache.size + ' serveurs').padEnd(32)}║`);
  console.log(`║  📋 ${String(client.commands.size + ' commandes').padEnd(32)}║`);
  console.log(`║  🌍 ${String(allCommands.length + ' global').padEnd(32)}║`);
  if (guildOnlyCommands.length) console.log(`║  🏠 ${String(guildOnlyCommands.length + ' guild-only').padEnd(32)}║`);
  if (contextMenus.length) console.log(`║  🖱️  ${String(contextMenus.length + ' context menus').padEnd(31)}║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // ── Cache des invitations (invite tracking) ──────────
  try {
    const { cacheGuildInvites } = require('./utils/inviteCache');
    for (const [, guild] of client.guilds.cache) {
      await cacheGuildInvites(guild).catch(() => {});
    }
    console.log('[INVITE] Cache des invitations initialisé');
  } catch (e) { console.error('[INVITE] Erreur init cache:', e.message); }

  // ── Enregistrer les commandes ──────────────────────────
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  // 1. Commandes globales (slash + context menus) — max 100 slash Discord
  const SLASH_LIMIT = 100;
  let trimmedSlash = allCommands;
  if (allCommands.length > SLASH_LIMIT) {
    console.warn(`[CMD] ⚠️  ${allCommands.length} global cmds > ${SLASH_LIMIT} max — tronqué ! Déplace les extras vers commands_guild/`);
    trimmedSlash = allCommands.slice(0, SLASH_LIMIT);
  }
  const globalPayload = [...trimmedSlash, ...contextMenus];
  try {
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: globalPayload });
    console.log(`[CMD] ${trimmedSlash.length}/${allCommands.length} slash + ${contextMenus.length} menus → global`);
  } catch (e) {
    console.error('[CMD] Erreur global:', e.message);
  }

  // 2. Commandes guild-only (HOME_GUILD_ID) — slot supplémentaire de 100
  const homeGuild = process.env.HOME_GUILD_ID;
  if (homeGuild && guildOnlyCommands.length) {
    try {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, homeGuild), { body: guildOnlyCommands });
      console.log(`[CMD] ${guildOnlyCommands.length} commandes guild-only → ${homeGuild}`);
    } catch (e) {
      console.error('[CMD] Erreur guild:', e.message);
    }
  }

  // ── TÂCHES PLANIFIÉES ──────────────────────────────
  // Helper pour exécuter une fonction async sans UnhandledRejection
  const safeRun = (fn) => {
    try {
      const result = fn();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (e) {}
  };

  // Stats channels (membres, boosts, bots) — toutes les 10 minutes
  cron.schedule('*/10 * * * *', () => {
    safeRun(() => require('./utils/statsChannelUpdater').updateStatsChannels(client));
  });

  // Notifications YouTube & Twitch (toutes les 5 minutes)
  cron.schedule('*/5 * * * *', () => {
    safeRun(() => require('./utils/notificationChecker').checkNotifications(client));
  });

  // Vérifier les giveaways terminés (toutes les minutes)
  cron.schedule('* * * * *', () => {
    safeRun(() => require('./utils/giveawayCheck')(client));
  });

  // Vérifier les rappels (toutes les minutes)
  cron.schedule('* * * * *', () => {
    safeRun(() => require('./utils/reminderCheck')(client));
  });

  // Vérifier les rôles temporaires (toutes les 5 minutes)
  cron.schedule('*/5 * * * *', () => {
    safeRun(() => require('./utils/tempRoleCheck')(client));
  });

  // Anniversaires (tous les jours à 8h)
  cron.schedule('0 8 * * *', () => {
    safeRun(() => require('./utils/birthdayCheck')(client));
  });

  // Rapport santé serveur (dimanche 9h — UNIQUE)
  cron.schedule('0 9 * * 0', () => {
    safeRun(() => require('./utils/healthReport')(client));
  });

  // Reset quêtes hebdomadaires (lundi 0h — UNIQUE)
  cron.schedule('0 0 * * 1', () => {
    safeRun(() => require('./utils/questReset')(client));
  });

  // XP vocal — créditer toutes les minutes
  cron.schedule('* * * * *', () => {
    safeRun(() => require('./utils/voiceXPTick')(client));
  });

  // Vérifier les tempbans expirés (toutes les minutes)
  cron.schedule('* * * * *', () => {
    safeRun(() => require('./utils/tempbanCheck')(client));
  });

  // Loto hebdomadaire (dimanche 20h)
  cron.schedule('0 20 * * 0', () => {
    safeRun(() => require('./utils/lottoCheck')(client));
  });

  // Auto-fermeture tickets inactifs (toutes les heures)
  cron.schedule('0 * * * *', () => {
    safeRun(() => require('./utils/ticketAutoClose').autoCloseInactiveTickets(client));
  });

  // Rappels DISBOARD bump (toutes les minutes — délai 2h)
  cron.schedule('* * * * *', () => {
    safeRun(() => require('./utils/bumpReminderCheck').checkBumpReminders(client));
  });

  // Relances tickets intelligentes (toutes les 30 minutes)
  cron.schedule('*/30 * * * *', () => {
    safeRun(() => require('./utils/ticketFollowUp').runTicketFollowUp(client));
  });

  // Rotation du statut
  const statuses = [
    { name: '/help pour commencer', type: 0 },
    { name: `${client.guilds.cache.size} communautés`, type: 3 },
    { name: 'la communauté grandir', type: 2 },
    { name: '⚡ NexusBot v2 — Meilleur que MEE6', type: 0 },
    { name: '/premium pour débloquer tout', type: 0 },
    { name: 'top.gg/bot/NexusBot', type: 3 },
  ];
  let si = 0;
  setInterval(() => {
    const s = statuses[si % statuses.length];
    client.user.setActivity(s.name, { type: s.type });
    si++;
  }, 20000);
});

// ── Invite tracking : nouveau serveur ──────────────────
client.on('guildCreate', async (guild) => {
  try {
    const { cacheGuildInvites } = require('./utils/inviteCache');
    await cacheGuildInvites(guild);
  } catch {}
});

// ── Boost serveur ──────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const wasBoost = oldMember.premiumSince;
    const isBoost  = newMember.premiumSince;
    if (!wasBoost && isBoost) {
      const db  = require('./database/db');
      const cfg = db.getConfig(newMember.guild.id);
      // Récompense XP + coins
      const u = db.getUser(newMember.id, newMember.guild.id);
      db.db.prepare('UPDATE users SET xp = xp + 500, balance = balance + 1000 WHERE user_id = ? AND guild_id = ?')
        .run(newMember.id, newMember.guild.id);

      // Notification dans le canal log ou général
      const channelId = cfg.boost_channel || cfg.log_channel;
      if (channelId) {
        const ch = newMember.guild.channels.cache.get(channelId);
        if (ch) {
          const { EmbedBuilder } = require('discord.js');
          ch.send({ embeds: [new EmbedBuilder()
            .setColor('#ff73fa')
            .setTitle('🚀 Nouveau Boost !')
            .setDescription(`**${newMember.user.username}** vient de booster le serveur !\nIl reçoit **+500 XP** et **+1000 🪙** en récompense !`)
            .setThumbnail(newMember.user.displayAvatarURL())
            .setFooter({ text: `${newMember.guild.premiumSubscriptionCount} boosts au total` })
          ]}).catch(() => {});
        }
      }
    }
  } catch {}
});

// ── Gestion erreurs globales ───────────────────────────
process.on('unhandledRejection', err => {
  console.error('[ERROR] UnhandledRejection:', err?.message || err);
});
process.on('uncaughtException', err => {
  console.error('[ERROR] UncaughtException:', err?.message || err);
});

client.login(process.env.TOKEN);
