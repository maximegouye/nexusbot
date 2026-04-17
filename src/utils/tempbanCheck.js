const db = require('../database/db');

module.exports = async (client) => {
  const now = Math.floor(Date.now() / 1000);
  const expired = db.db.prepare('SELECT * FROM tempbans WHERE expires_at <= ? AND unbanned = 0').all(now);

  for (const ban of expired) {
    try {
      const guild = client.guilds.cache.get(ban.guild_id);
      if (!guild) continue;

      await guild.bans.remove(ban.user_id, `[TempBan] Durée écoulée — débannissement automatique`).catch(() => {});

      db.db.prepare('UPDATE tempbans SET unbanned = 1 WHERE id = ?').run(ban.id);

      // Log
      const cfg = db.getConfig(ban.guild_id);
      if (cfg.mod_log_channel) {
        const logCh = guild.channels.cache.get(cfg.mod_log_channel);
        if (logCh) {
          const { EmbedBuilder } = require('discord.js');
          logCh.send({
            embeds: [new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('🔓 Débannissement Automatique (TempBan)')
              .addFields(
                { name: '👤 Utilisateur', value: `<@${ban.user_id}> (\`${ban.user_id}\`)`, inline: true },
                { name: '📋 Raison originale', value: ban.reason || 'Aucune', inline: false },
              )
              .setTimestamp()
            ]
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }
};
