// ============================================================
// activityRoleCheck.js — Vérifie et attribue les rôles d'activité
// Appelable depuis n'importe quel endroit du code
// ============================================================
const db = require('../database/db');

/**
 * Vérifie si un membre a atteint des paliers d'activité et lui attribue les rôles correspondants.
 * @param {string} userId
 * @param {string} guildId
 * @param {import('discord.js').Guild} guild
 */
async function checkActivityRoles(userId, guildId, guild) {
  try {
    const paliers = db.db.prepare(
      'SELECT type, threshold, role_id FROM activity_role_rewards WHERE guild_id=? ORDER BY threshold ASC'
    ).get ? db.db.prepare(
      'SELECT type, threshold, role_id FROM activity_role_rewards WHERE guild_id=? ORDER BY threshold ASC'
    ).all(guildId) : [];

    if (!paliers || paliers.length === 0) return;

    const user = db.db.prepare(
      'SELECT xp, level, message_count FROM users WHERE user_id=? AND guild_id=?'
    ).get(userId, guildId);
    if (!user) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    for (const palier of paliers) {
      let val = 0;
      if (palier.type === 'xp')       val = user.xp || 0;
      if (palier.type === 'messages')  val = user.message_count || 0;
      if (palier.type === 'level')     val = user.level || 0;

      if (val >= palier.threshold && !member.roles.cache.has(palier.role_id)) {
        const role = guild.roles.cache.get(palier.role_id);
        if (role) {
          await member.roles.add(role).catch(() => {});
        }
      }
    }
  } catch {
    // Silencieux — ne jamais bloquer le flux principal
  }
}

module.exports = { checkActivityRoles };
