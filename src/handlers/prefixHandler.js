// ============================================================
// prefixHandler.js — Handler de commandes avec préfixe &
// Emplacement : src/handlers/prefixHandler.js
// ============================================================
// À ajouter dans index.js / bot.js :
//   const { setupPrefixHandler } = require('./handlers/prefixHandler');
//   setupPrefixHandler(client);
// ============================================================

const fs   = require('fs');
const path = require('path');

const PREFIX = '&';

// Charge toutes les commandes avec la propriété `run`
function loadPrefixCommands(dir) {
  const commands = new Map();
  const aliases  = new Map();

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const cmd = require(path.join(dir, file));
      if (!cmd.run || !cmd.name) continue;

      commands.set(cmd.name, cmd);
      if (cmd.aliases) {
        for (const alias of cmd.aliases) aliases.set(alias, cmd.name);
      }
    } catch (e) {
      console.error(`[PrefixHandler] Erreur chargement ${file}:`, e.message);
    }
  }
  return { commands, aliases };
}

function setupPrefixHandler(client) {
  // Dossiers contenant des commandes avec `run`
  const gameDirs = [
    path.join(__dirname, '../commands_guild/games'),
    path.join(__dirname, '../commands_guild/economy'),
    path.join(__dirname, '../commands_guild/unique'),
  ];

  const allCommands = new Map();
  const allAliases  = new Map();

  for (const dir of gameDirs) {
    if (!fs.existsSync(dir)) continue;
    const { commands, aliases } = loadPrefixCommands(dir);
    for (const [k, v] of commands) allCommands.set(k, v);
    for (const [k, v] of aliases) allAliases.set(k, v);
  }

  console.log(`[PrefixHandler] ${allCommands.size} commandes préfixe chargées (préfixe: ${PREFIX})`);

  client.on('messageCreate', async message => {
    if (message.author.bot || message.author.system) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return;

    const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmdName = args.shift().toLowerCase();

    // Résoudre alias
    const resolvedName = allAliases.get(cmdName) || cmdName;
    const cmd = allCommands.get(resolvedName);

    if (!cmd) return; // Commande inconnue → ignorer silencieusement

    try {
      // Vérification blacklist si securityManager disponible
      try {
        const { isBlacklisted } = require('../utils/securityManager');
        if (isBlacklisted(message.author.id, message.guildId)) {
          return message.reply('🚫 Tu es blacklisté sur ce serveur.');
        }
      } catch {}

      await cmd.run(message, args);
    } catch (err) {
      console.error(`[PrefixHandler] Erreur commande "${resolvedName}":`, err);
      message.reply(`❌ Une erreur s'est produite lors de l'exécution de \`${PREFIX}${resolvedName}\`.`).catch(() => {});
    }
  });
}

module.exports = { setupPrefixHandler, PREFIX };
