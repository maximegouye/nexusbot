/**
 * NexusBot — Gestionnaire de commandes PRÉFIXÉES
 *
 * Préfixe unique : &
 * Exemple : &ban, &aide, &solde
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

  // Préfixe unique et fixe : & — aucun autre préfixe n'est accepté
  const PREFIXES = ['&'];

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
  const commandNameRaw = args.shift().toLowerCase();
  if (!commandNameRaw) return false;

  // Charger le moteur custom (avec fallback sécurisé)
  let engine = null;
  try { engine = require('./customCommandsEngine'); } catch {}

  // 1) Résoudre alias (BDD d'abord, puis aliases définis dans les commandes JS)
  let commandName = commandNameRaw;
  if (engine) {
    const aliased = engine.resolveAlias(message.guild.id, commandNameRaw, db);
    if (aliased) commandName = aliased;
  }
  const resolvedName = prefixAliases.get(commandName) || commandName;
  const cmd = prefixCommands.get(resolvedName);

  if (!cmd) {
    // 2) Commande custom (BDD) — moteur riche (texte/embed/cooldown/rôle/salons)
    if (engine) {
      const handled = await engine.tryExecuteCustom(message, commandNameRaw, args, db);
      if (handled) return true;
    }
    return false;
  }

  // 3) Check toggle global pour cette commande
  if (engine && engine.isCommandDisabled(message.guild.id, cmd.name, db)) {
    await message.reply(`❌ La commande \`${usedPrefix}${cmd.name}\` est désactivée sur ce serveur.`).catch(() => {});
    return true;
  }

  // 4) Permissions statiques définies dans le fichier de la commande
  if (cmd.permissions && !message.member.permissions.has(BigInt(cmd.permissions))) {
    await message.reply(`❌ Permission manquante : \`${cmd.permissions}\``).catch(() => {});
    return true;
  }

  // 5) Cooldown (override BDD > défaut de la commande)
  const cdSeconds = engine
    ? engine.resolveCooldown(message.guild.id, cmd.name, cmd.cooldown || 0, db)
    : (cmd.cooldown || 0);
  if (cdSeconds > 0) {
    const key = `prefix_cd:${cmd.name}:${message.author.id}`;
    const exp = client._prefixCooldowns?.get(key);
    if (exp && Date.now() < exp) {
      const left = ((exp - Date.now()) / 1000).toFixed(1);
      await message.reply(`⏱️ Attends encore **${left}s**.`).catch(() => {});
      return true;
    }
    if (!client._prefixCooldowns) client._prefixCooldowns = new Map();
    client._prefixCooldowns.set(key, Date.now() + cdSeconds * 1000);
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
