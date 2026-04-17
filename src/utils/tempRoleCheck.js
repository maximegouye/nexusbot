const db = require('../database/db');

module.exports = async (client) => {
  const now     = Math.floor(Date.now() / 1000);
  const expired = db.db.prepare('SELECT * FROM temp_roles WHERE expires_at <= ?').all(now);

  for (const tr of expired) {
    try {
      const guild = client.guilds.cache.get(tr.guild_id);
      if (!guild) continue;

      const member = await guild.members.fetch(tr.user_id).catch(() => null);
      if (member) {
        const role = guild.roles.cache.get(tr.role_id);
        if (role) await member.roles.remove(role).catch(() => {});
      }

      db.db.prepare('DELETE FROM temp_roles WHERE id = ?').run(tr.id);
    } catch (err) {
      console.error('[TempRoleCheck] Erreur:', err.message);
    }
  }
};
