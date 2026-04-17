/**
 * NexusBot — Gestionnaire de commandes PRÉFIXÉES
 *
 * ⚡ SECRET DES BOTS À MILLIERS DE COMMANDES :
 * Les slash commands Discord sont limitées à 100 global + 100 guild.
 * Les COMMANDES PRÉFIXÉES (!, ?, $, n!) n'ont AUCUNE limite Discord.
 * Elles sont gérées dans messageCreate sans aucune registration.
 * C'est comme ça que MEE6, Carl-bot, Dyno ont des milliers de commandes.
 *
 * NexusBot supporte DEUX préfixes en parallèle :
 *  - n! (préfixe principal)  → n!ban, n!help, n!balance...
 *  - !  (préfixe court)      → !ban, !help, !balance...
 */

const fs   = require('fs');
const path = require('path');

// Cache des commandes préfixées (chargées une fois au démarrage)
const prefixCommands = new Map();
const prefixAliases  = new Map();

/**
 * Charger toutes les commandes depuis src/commands_prefix/**
 */
function registerCmd(cmd, category) {
  if (!cmd?.name || !cmd?.execute) return;
  if (!cmd.category) cmd.category = category;
  prefixCommands.set(cmd.name.toLowerCase(), cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      prefixAliases.set(alias.toLowerCase(), cmd.name.toLowerCase());
    }
  }
}

function loadPrefixCommands() {
  const baseDir = path.join(__dirname, '../commands_prefix');
  if (!fs.existsSync(baseDir)) return;

  const categories = fs.readdirSync(baseDir).filter(f =>
    fs.statSync(path.join(baseDir, f)).isDirectory()
  );

  for (const cat of categories) {
    const files = fs.readdirSync(path.join(baseDir, cat)).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const exported = require(path.join(baseDir, cat, file));
        // Support des fichiers multi-commandes (array) ET single-commande (object)
        if (exported?.__isMulti && Array.isArray(exported)) {
          for (const cmd of exported) registerCmd(cmd, cat);
        } else if (Array.isArray(exported)) {
          for (const cmd of exported) registerCmd(cmd, cat);
        } else if (exported?.name) {
          registerCmd(exported, cat);
        }
      } catch (e) {
        console.error(`[PREFIX] Erreur chargement ${cat}/${file}:`, e.message);
      }
    }
  }
  console.log(`[PREFIX] ${prefixCommands.size} commandes préfixées chargées (${prefixAliases.size} aliases)`);
}

/**
 * Gérer un message entrant et détecter si c'est une commande préfixée
 */
async function handlePrefixMessage(message, client) {
  if (message.author.bot || !message.guild) return false;

  const db = require('../database/db');
  const cfg = db.getConfig(message.guild.id);

  // Préfixes supportés : configurable par guild, défaut n! et !
  const guildPrefix = cfg.prefix || 'n!';
  const PREFIXES = [guildPrefix, 'n!', '!', '&'].filter((p, i, a) => a.indexOf(p) === i);

  let usedPrefix = null;
  let content = message.content;

  for (const p of PREFIXES) {
    if (content.startsWith(p)) {
      usedPrefix = p;
      content = content.slice(p.length).trim();
      break;
    }
  }

  if (!usedPrefix) return false;

  const args = content.split(/\s+/);
  const commandName = args.shift().toLowerCase();
  if (!commandName) return false;

  // Résoudre alias
  const resolvedName = prefixAliases.get(commandName) || commandName;
  const cmd = prefixCommands.get(resolvedName);

  if (!cmd) {
    // Tenter les commandes custom du serveur
    const custom = db.getCustomCommand(message.guild.id, usedPrefix + commandName);
    if (custom) {
      const response = custom.response
        .replace('{user}', `<@${message.author.id}>`)
        .replace('{username}', message.author.username)
        .replace('{server}', message.guild.name)
        .replace('{args}', args.join(' '));
      await message.channel.send(response).catch(() => {});
      return true;
    }
    return false;
  }

  // Vérifier permissions
  if (cmd.permissions && !message.member.permissions.has(BigInt(cmd.permissions))) {
    await message.reply(`❌ Permission manquante : \`${cmd.permissions}\``).catch(() => {});
    return true;
  }

  // Vérifier cooldown
  if (cmd.cooldown) {
    const key = `prefix_cd:${cmd.name}:${message.author.id}`;
    const cd = client._prefixCooldowns?.get(key);
    if (cd && Date.now() < cd) {
      const left = ((cd - Date.now()) / 1000).toFixed(1);
      await message.reply(`⏱️ Attends encore **${left}s**.`).catch(() => {});
      return true;
    }
    if (!client._prefixCooldowns) client._prefixCooldowns = new Map();
    client._prefixCooldowns.set(key, Date.now() + cmd.cooldown * 1000);
  }

  try {
    await cmd.execute(message, args, client, db);
  } catch (e) {
    console.error(`[PREFIX] Erreur /${cmd.name}:`, e.message);
    await message.reply(`❌ Erreur : ${e.message?.slice(0, 200)}`).catch(() => {});
  }

  return true;
}

module.exports = { loadPrefixCommands, handlePrefixMessage, prefixCommands };
