/**
 * NexusBot — Moteur d'exécution des commandes personnalisées
 *
 * Chaque commande custom peut être :
 *  - 'text'  : réponse texte brut (avec variables)
 *  - 'embed' : réponse embed complet (title/description/color/fields/footer/image/thumbnail/author)
 *
 * Supporte :
 *  - Cooldown par commande
 *  - Rôle requis
 *  - Permission Discord requise
 *  - Salons autorisés (whitelist, vide = tous)
 *  - Activation/désactivation
 *  - Suppression du message déclencheur
 *  - Variables : {user} {username} {server} {channel} {count} {args} {arg1} {arg2}…
 *
 * Utilisé depuis :
 *  - prefixHandler.js (messageCreate) pour les `&commande`
 *  - Possibilité future : slash `/run` qui exécute une commande custom
 */

const { PermissionFlagsBits } = require('discord.js');
const { rebuildEmbedFromData, applyVars, applyVarsToTemplate, safeJsonParse } = require('./configPanelAdvanced');

const _cooldowns = new Map(); // key: `${guildId}:${trigger}:${userId}` → expirationTs

/**
 * Tenter d'exécuter une commande custom à partir d'un message préfixe.
 * @param {import('discord.js').Message} message
 * @param {string} trigger (sans le préfixe &)
 * @param {string[]} args
 * @param {*} db
 * @returns {boolean} true si une commande a été exécutée
 */
async function tryExecuteCustom(message, trigger, args, db) {
  if (!message.guild) return false;
  const cmd = db.getCustomCommand(message.guild.id, trigger);
  if (!cmd) return false;

  // Activation
  if (cmd.enabled === 0) return false;

  // Rôle requis
  if (cmd.required_role) {
    if (!message.member.roles.cache.has(cmd.required_role)) {
      await message.reply({ content: `❌ Il te faut le rôle <@&${cmd.required_role}> pour utiliser cette commande.` }).catch(() => {});
      return true;
    }
  }

  // Permission requise
  if (cmd.required_perm) {
    const permFlag = PermissionFlagsBits[cmd.required_perm];
    if (permFlag && !message.member.permissions.has(permFlag)) {
      await message.reply({ content: `❌ Permission manquante : \`${cmd.required_perm}\`` }).catch(() => {});
      return true;
    }
  }

  // Salons autorisés
  const allowed = safeJsonParse(cmd.allowed_channels, []);
  if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(message.channel.id)) {
    await message.reply({ content: `❌ Cette commande n'est pas autorisée dans ce salon.` }).catch(() => {});
    return true;
  }

  // Cooldown
  if (cmd.cooldown > 0) {
    const key = `${message.guild.id}:${cmd.trigger}:${message.author.id}`;
    const exp = _cooldowns.get(key);
    if (exp && Date.now() < exp) {
      const left = ((exp - Date.now()) / 1000).toFixed(1);
      await message.reply({ content: `⏱️ Attends encore **${left}s** avant de refaire \`&${cmd.trigger}\`.` }).catch(() => {});
      return true;
    }
    _cooldowns.set(key, Date.now() + cmd.cooldown * 1000);
    setTimeout(() => _cooldowns.delete(key), cmd.cooldown * 1000);
  }

  // Contexte pour les variables
  const ctx = {
    userMention:    `<@${message.author.id}>`,
    username:       message.author.username,
    serverName:     message.guild.name,
    channelMention: `<#${message.channel.id}>`,
    memberCount:    message.guild.memberCount,
    args:           args.join(' '),
    argArray:       args,
  };

  // Construire la réponse
  try {
    if (cmd.response_type === 'embed' && cmd.embed_json) {
      const data = safeJsonParse(cmd.embed_json, {});
      const applied = applyVarsToTemplate(data, ctx);
      const eb = rebuildEmbedFromData(applied);
      await message.channel.send({ embeds: [eb] });
    } else {
      const text = applyVars(cmd.response || '', ctx);
      if (text) {
        await message.channel.send({ content: text, allowedMentions: { parse: ['users', 'roles'] } });
      }
    }
    // Incrémenter le compteur d'utilisations
    db.incrementCustomCommandUses(message.guild.id, cmd.trigger);

    // Supprimer le trigger si demandé
    if (cmd.delete_trigger) {
      try { await message.delete(); } catch {}
    }
  } catch (e) {
    console.error(`[CUSTOM-CMD] Erreur exécution &${cmd.trigger}:`, e);
    await message.reply({ content: `❌ Erreur lors de l'exécution : ${e.message?.slice(0, 150)}` }).catch(() => {});
  }

  return true;
}

/**
 * Résoudre un alias vers une commande cible.
 * @returns {string|null} nom de la commande cible, ou null si pas d'alias
 */
function resolveAlias(guildId, name, db) {
  try {
    const a = db.getAlias(guildId, name);
    return a?.target || null;
  } catch { return null; }
}

/**
 * Vérifie si une commande (slash ou préfixe) est désactivée pour ce serveur.
 */
function isCommandDisabled(guildId, commandName, db) {
  try { return !db.isCommandEnabled(guildId, commandName); } catch { return false; }
}

/**
 * Retourne le cooldown à utiliser pour une commande : override > défaut.
 */
function resolveCooldown(guildId, commandName, defaultSeconds, db) {
  try {
    const over = db.getCooldownOverride(guildId, commandName);
    return over != null ? over : defaultSeconds;
  } catch { return defaultSeconds; }
}

module.exports = {
  tryExecuteCustom,
  resolveAlias,
  isCommandDisabled,
  resolveCooldown,
};
