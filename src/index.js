'use strict';
// ═══════════════════════════════════════════════
// src/index.js — Point d'entrée NexusBot v2
// ═══════════════════════════════════════════════
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ── Client Discord ──────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.GuildMember,
  ],
});

// ── Collections ─────────────────────────────────
client.commands  = new Collection();
client.cooldowns = new Collection();

// ── Chargement commandes slash ──────────────────
function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js')) {
      try {
        const cmd = require(fullPath);
        if (cmd.data && cmd.execute) {
          client.commands.set(cmd.data.name, cmd);
        }
      } catch (e) {
        console.error(`[Commands] Erreur chargement ${entry.name}:`, e.message);
      }
    }
  }
}

const commandsPath = path.join(__dirname, 'commands');
loadCommands(commandsPath);
loadCommands(path.join(__dirname, 'commands_guild/economy'));
console.log(`✅ ${client.commands.size} commande(s) slash chargée(s)`);

// ── Chargement événements ───────────────────────
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath)
    .filter(f => f.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const event = require(path.join(eventsPath, file));
      if (!event || !event.name) continue;
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }
      console.log(`✅ Événement : ${event.name}`);
    } catch (e) {
      console.error(`[Events] Erreur chargement ${file}:`, e.message);
    }
  }
}

// ── Prefix handler (&) ──────────────────────────
try {
  const { setupPrefixHandler } = require('./handlers/prefixHandler');
  setupPrefixHandler(client);
  console.log('✅ Prefix handler (&) actif');
} catch (e) {
  console.error('[PrefixHandler] Erreur:', e.message);
}

// ── Connexion Discord ───────────────────────────
const token = process.env.TOKEN
           || process.env.DISCORD_TOKEN
           || process.env.BOT_TOKEN;

if (!token) {
  console.error('❌ TOKEN introuvable ! Définis TOKEN dans Railway > Variables.');
  process.exit(1);
}

client.login(token)
  .then(() => console.log(`✅ NexusBot connecté en tant que ${client.user?.tag}`))
  .catch(err => {
    console.error('❌ Erreur connexion Discord:', err.message);
    process.exit(1);
  });
