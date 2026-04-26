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

// Charge toutes les commandes avec la propriété `run` OU les commandes prefix-only (_prefixOnly: true)
function loadPrefixCommands(dir) {
  const commands = new Map();
  const aliases  = new Map();

  if (!fs.existsSync(dir)) return { commands, aliases };

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.includes('.disabled') && !f.includes('.test.') && !f.includes('.spec.'));
  for (const file of files) {
    try {
      const cmd = require(path.join(dir, file));

      // Commandes avec run() natif
      if (cmd.run && cmd.name) {
        commands.set(cmd.name, cmd);
        if (cmd.aliases) {
          for (const alias of cmd.aliases) aliases.set(alias, cmd.name);
        }
        continue;
      }

      // Commandes prefix-only (slash désactivé, execute via fake interaction)
      if (cmd._prefixOnly && cmd.name && cmd.execute) {
        commands.set(cmd.name, cmd);
        if (cmd.data?.name && cmd.data.name !== cmd.name) {
          commands.set(cmd.data.name, cmd);
        }
      }
    } catch (e) {
      console.error(`[PrefixHandler] Erreur chargement ${file}:`, e.message);
    }
  }
  return { commands, aliases };
}

/**
 * Crée un faux objet Interaction à partir d'un Message Discord.
 * Permet d'appeler cmd.execute(fakeInteraction) depuis le handler préfixe.
 */
function buildFakeInteraction(message, args, client) {
  const [sub, ...rest] = args;

  // Parse les options nommées : &cmd sous --key valeur
  const optValues = {};
  let currentKey = null;
  for (const a of rest) {
    if (a.startsWith('--')) { currentKey = a.slice(2); }
    else if (currentKey) { optValues[currentKey] = a; currentKey = null; }
  }
  // Premier argument positionnel sans clé → 'valeur' par défaut
  if (!currentKey && rest.length && !rest[0].startsWith('--')) {
    optValues._arg0 = rest[0];
    optValues._args = rest.join(' ');
  }

  let _replied = false;

  const fakeInteraction = {
    user:      message.author,
    member:    message.member,
    guild:     message.guild,
    guildId:   message.guildId,
    channel:   message.channel,
    channelId: message.channelId,
    client,
    deferred: false,
    replied:  false,

    async deferReply() { this.deferred = true; },
    async reply(opts) {
      if (_replied) return this.followUp(opts);
      _replied = true; this.replied = true;
      return message.reply(typeof opts === 'string' ? { content: opts } : opts).catch(() => {});
    },
    async editReply(opts) {
      return message.channel.send(typeof opts === 'string' ? { content: opts } : opts).catch(() => {});
    },
    async followUp(opts) {
      return message.channel.send(typeof opts === 'string' ? { content: opts } : opts).catch(() => {});
    },

    options: {
      getSubcommand: (required) => sub || (required ? null : null),
      getString:     (name) => optValues[name] ?? optValues._args ?? null,
      getInteger:    (name) => optValues[name] != null ? parseInt(optValues[name]) : null,
      getNumber:     (name) => optValues[name] != null ? parseFloat(optValues[name]) : null,
      getBoolean:    (name) => optValues[name] === 'true',
      getUser:       ()     => message.mentions.users.first() ?? null,
      getMember:     ()     => message.mentions.members?.first() ?? null,
      getChannel:    ()     => message.mentions.channels?.first() ?? null,
      getRole:       ()     => message.mentions.roles?.first() ?? null,
      get:           (name) => optValues[name] != null ? { value: optValues[name] } : null,
    },

    isCommand:            () => false,
    isChatInputCommand:   () => false,
    isRepliable:          () => true,
  };

  return fakeInteraction;
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

      if (cmd.run) {
        // Commande avec handler natif pour messages
        await cmd.run(message, args);
      } else if (cmd._prefixOnly && cmd.execute) {
        // Commande prefix-only : appel via fake interaction
        const fakeInteraction = buildFakeInteraction(message, args, client);
        await cmd.execute(fakeInteraction);
      }
    } catch (err) {
      console.error(`[PrefixHandler] Erreur commande "${resolvedName}":`, err);
      message.reply(`❌ Une erreur s'est produite lors de l'exécution de \`${PREFIX}${resolvedName}\`.`).catch(() => {});
    }
  });
}

module.exports = { setupPrefixHandler, PREFIX };
