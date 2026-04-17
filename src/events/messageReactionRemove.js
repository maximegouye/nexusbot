const db = require('../database/db');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) try { await reaction.fetch(); } catch { return; }

    const { message, emoji } = reaction;
    if (!message.guild) return;

    // Reaction Roles — retirer le rôle
    const rr = db.db.prepare(
      'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?'
    ).get(message.guild.id, message.id, emoji.id || emoji.name);

    if (rr) {
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const role = message.guild.roles.cache.get(rr.role_id);
        if (role) await member.roles.remove(role).catch(() => {});
      }
    }
  }
};
