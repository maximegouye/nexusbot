// ============================================================
// prefixHandler.js — Handler de commandes avec préfixe &
// Charge src/commands_prefix/ (récursif) + alias + cooldowns
// ============================================================
'use strict';

const fs   = require('fs');
const path = require('path');

const PREFIX = '&';

// ── Chargement récursif ─────────────────────────────────────
function loadAllPrefixCommands(baseDir) {
  const commands = new Map();
  const aliases  = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.includes('disabled')) walk(full);
      } else if (entry.name.endsWith('.js') && !entry.name.includes('disabled')) {
        try {
          const cmd = require(full);
          // Accepte execute ou run
          const fn = cmd.execute || cmd.run;
          if (!fn || !cmd.name) continue;
          // Normalise : toujours exposer execute
          cmd.execute = fn;
          commands.set(cmd.name.toLowerCase(), cmd);
          if (Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) {
              aliases.set(alias.toLowerCase(), cmd.name.toLowerCase());
            }
          }
        } catch (e) {
          console.error(`[PrefixHandler] Erreur chargement ${entry.name}: ${e.message}`);
        }
      }
    }
  }

  walk(baseDir);
  return { commands, aliases };
}

// ── Setup ───────────────────────────────────────────────────
function setupPrefixHandler(client) {
  let db;
  try { db = require('../database/db'); } catch (e) {
    console.error('[PrefixHandler] DB non disponible:', e.message);
  }

  const prefixDir = path.join(__dirname, '../commands_prefix');
  const { commands: allCommands, aliases: allAliases } = loadAllPrefixCommands(prefixDir);

  console.log(`[PrefixHandler] ${allCommands.size} commandes & chargées depuis ${prefixDir}`);

  // Cooldowns en mémoire (userId:cmdName → timestamp)
  const cooldowns = new Map();

  client.on('messageCreate', async message => {
    if (message.author.bot || message.author.system) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmdName = args.shift()?.toLowerCase();
    if (!cmdName) return;

    const resolvedName = allAliases.get(cmdName) || cmdName;
    const cmd = allCommands.get(resolvedName);
    if (!cmd) return; // Commande inconnue — ignorer

    // ── Cooldown ─────────────────────────────────────────────
    if (cmd.cooldown) {
      const key = `${message.author.id}:${resolvedName}`;
      const now = Date.now();
      const expires = cooldowns.get(key) || 0;
      if (now < expires) {
        const left = ((expires - now) / 1000).toFixed(1);
        return message.reply(`⏳ Cooldown : attends encore **${left}s** avant de relancer \`${PREFIX}${resolvedName}\`.`).catch(() => {});
      }
      cooldowns.set(key, now + cmd.cooldown * 1000);
      setTimeout(() => cooldowns.delete(key), cmd.cooldown * 1000);
    }

    // ── Blacklist ─────────────────────────────────────────────
    try {
      const { isBlacklisted } = require('../utils/securityManager');
      if (isBlacklisted(message.author.id, message.guildId)) {
        return message.reply('🚫 Tu es blacklisté sur ce serveur.').catch(() => {});
      }
    } catch {}

    // ── Exécution ─────────────────────────────────────────────
    try {
      await cmd.execute(message, args, client, db);
    } catch (err) {
      console.error(`[PrefixHandler] Erreur "${resolvedName}":`, err.message || err);
      message.reply(`❌ Erreur lors de l'exécution de \`${PREFIX}${resolvedName}\`.`).catch(() => {});
    }
  });
}

module.exports = { setupPrefixHandler, PREFIX };
