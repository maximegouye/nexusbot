const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = async (client) => {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = db.getConfig(guild.id);
      if (!cfg.health_channel) continue;

      const channel = guild.channels.cache.get(cfg.health_channel);
      if (!channel) continue;

      const stats = db.getWeeklyStats(guild.id);
      await guild.fetch();

      const bots   = guild.members.cache.filter(m => m.user.bot).size;
      const humans = guild.memberCount - bots;

      const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
      const activeUsers  = db.db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM users WHERE guild_id = ? AND last_message > ?')
        .get(guild.id, sevenDaysAgo)?.c || 0;
      const actRate = humans > 0 ? Math.round((activeUsers / humans) * 100) : 0;

      const barLen  = 15;
      const filled  = Math.round(actRate / 100 * barLen);
      const bar     = '█'.repeat(filled) + '░'.repeat(barLen - filled);

      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('📊 Rapport Hebdomadaire — ' + guild.name)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👥 Membres',           value: `**${guild.memberCount}** (${humans} 👤)`,                     inline: true },
          { name: '📥 Nouvelles arrivées', value: `**${stats.joined_members || 0}**`,                           inline: true },
          { name: '🚪 Départs',           value: `**${stats.left_members || 0}**`,                             inline: true },
          { name: '💬 Messages',          value: `**${(stats.total_messages || 0).toLocaleString('fr')}**`,    inline: true },
          { name: '🔥 Membres actifs',    value: `**${activeUsers}** (${actRate}%) ${bar}`,                    inline: false },
        )
        .setFooter({ text: `Rapport auto. NexusBot • ${new Date().toLocaleDateString('fr')}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('[HealthReport] Erreur:', guild.id, err.message);
    }
  }
};
