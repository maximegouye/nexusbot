'use strict';
// ═══════════════════════════════════════════════
// src/index.js — Point d'entrée NexusBot v2
// ═══════════════════════════════════════════════
console.log(`🚀 [${new Date().toISOString()}] src/index.js démarré (PID ${process.pid})`);
require('dotenv').config();
console.log(`✓ dotenv chargé`);

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs   = require('fs');
const path = require('path');
console.log(`✓ discord.js chargé (version: ${require('discord.js').version || '?'})`);

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
  // ── Stabilité WebSocket sur Railway (proxy/NAT) ─
  ws: { large_threshold: 50 },
  rest: { timeout: 30_000, retries: 3 },
});

// ── Collections ─────────────────────────────────
client.commands          = new Collection();
client.cooldowns         = new Collection();
client.globalCommandsList = []; // pour enregistrement global (src/commands/)
client.guildCommandsList  = []; // pour enregistrement guild  (src/commands_guild/)

// ── Chargement commandes slash ──────────────────
// tag = 'global' | 'guild' — détermine l'endpoint REST utilisé dans ready.js
function loadCommands(dir, tag) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Ignore les dossiers marqués .disabled (ex: music.disabled)
      if (!entry.name.includes('.disabled')) {
        loadCommands(fullPath, tag);
      }
    } else if (entry.name.endsWith('.js') && !entry.name.includes('.disabled') && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      try {
        const cmd = require(fullPath);
        if (cmd.data && cmd.execute) {
          cmd._sourceDir = tag;
          client.commands.set(cmd.data.name, cmd); // guild écrase global si même nom
          if (cmd._prefixOnly) {
            // Commande prefix-only : chargée pour &cmd mais NON enregistrée comme slash
            // (ne compte pas vers la limite de 100 commandes Discord)
          } else if (tag === 'global') {
            client.globalCommandsList.push(cmd.data);
          } else {
            client.guildCommandsList.push(cmd.data);
          }
        }
      } catch (e) {
        console.error(`[Commands] Erreur chargement ${entry.name}:`, e.message);
      }
    }
  }
}

const commandsPath      = path.join(__dirname, 'commands');
const commandsGuildPath = path.join(__dirname, 'commands_guild');

loadCommands(commandsPath,      'global'); // 109 commandes → endpoint global
loadCommands(commandsGuildPath, 'guild');  // 122 commandes → endpoint guild

console.log(`✅ ${client.commands.size} commande(s) slash chargée(s) (global:${client.globalCommandsList.length} guild:${client.guildCommandsList.length})`);

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

async function connectWithRetry() {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      console.log(`🔐 [${new Date().toISOString()}] Tentative ${attempt} de connexion à Discord...`);
      await client.login(token);
      console.log(`✅ NexusBot connecté en tant que ${client.user?.username}`);
      return; // Connexion réussie — sort de la boucle
    } catch (err) {
      const msg = err.message || String(err);

      // Token invalide → log critique + attente longue (pas de crash)
      if (msg.includes('TOKEN_INVALID') || msg.includes('Incorrect login') || msg.includes('disallowed intents')) {
        console.error('');
        console.error('🚨 ======================================================');
        console.error('🚨  TOKEN DISCORD INVALIDE OU INTENTS MANQUANTS !');
        console.error('🚨  → Va sur https://discord.com/developers/applications');
        console.error('🚨  → Régénère le token du bot NexusBot');
        console.error('🚨  → Mets à jour la variable TOKEN dans Railway > Variables');
        console.error('🚨  → Ou vérifie que les Privileged Intents sont activés');
        console.error('🚨 ======================================================');
        console.error('');
        console.error(`   Erreur: ${msg}`);
        console.log('⏳ Nouvelle tentative dans 10 minutes...');
        await new Promise(r => setTimeout(r, 600_000));
        continue;
      }

      // Sessions épuisées → attendre jusqu'au reset
      const resetMatch = msg.match(/resets at (.+)/);
      if (resetMatch) {
        const resetTime = new Date(resetMatch[1]).getTime();
        const waitMs = Math.max(resetTime - Date.now() + 10_000, 60_000);
        console.log(`⏳ Sessions Discord épuisées. Attente ${Math.ceil(waitMs / 1000)}s jusqu'au reset (${resetMatch[1]})...`);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // Erreur réseau ou autre → backoff exponentiel, max 10min, jamais d'exit
      const delay = Math.min(30_000 * Math.pow(2, Math.min(attempt - 1, 5)), 600_000);
      console.error(`❌ Erreur connexion Discord (tentative ${attempt}): ${msg}`);
      console.log(`⏳ Nouvelle tentative dans ${Math.ceil(delay / 1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

connectWithRetry();

// ── Dashboard web (démarre après connexion Discord) ──────
try {
  const dashboard = require('../dashboard/server');
  client.once('clientReady', () => dashboard.start(client));
} catch (e) {
  console.warn('[Dashboard] Non disponible:', e.message);
}

// ── Gestionnaires de crash globaux — évite les redémarrages intempestifs ──
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRASH] Promise non gérée:', reason?.message || reason, '| Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('[CRASH] Exception non capturée:', err?.message || err);
  console.error(err?.stack || '');
  // Ne pas appeler process.exit() — Railway redémarre de toute façon si nécessaire
});
