// messageReactionRemove.js — ⚠️ MODIFIÉ : on NE retire plus le rôle
// par défaut pour éviter qu'enlever la réaction au règlement enlève le rôle
// Membre. Si l'admin veut un comportement "toggle", il peut activer la
// colonne `removable` dans la table reaction_roles (1 = retire le rôle).
const db = require('../database/db');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) try { await reaction.fetch(); } catch { return; }

    const { message, emoji } = reaction;
    if (!message.guild) return;

    // Reaction Roles : on ne retire le rôle QUE si la colonne removable=1
    let rr;
    try {
      rr = db.db.prepare(
        'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?'
      ).get(message.guild.id, message.id, emoji.id || emoji.name);
    } catch { return; }

    if (!rr) return;

    // Par défaut : on NE retire PAS le rôle (rôle permanent une fois donné)
    // Sauf si l'admin a explicitement coché "removable" sur ce reaction-role
    if (rr.removable !== 1) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member) {
      const role = message.guild.roles.cache.get(rr.role_id);
      if (role) await member.roles.remove(role).catch(() => {});
    }
  }
};
