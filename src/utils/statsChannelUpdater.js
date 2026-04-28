const db = require('../database/db');

// Garder trace des derniers noms pour éviter les rate limits
const lastNameUpdates = {};

async function updateStatsChannels(client) {
  try {
    // Récupérer toutes les configs de stats_channels
    const statsConfigs = db.db.prepare('SELECT * FROM stats_channels').all();

    if (statsConfigs.length === 0) {
      return;
    }

    for (const config of statsConfigs) {
      try {
        const guild = await client.guilds.fetch(config.guild_id).catch(() => null);
        if (!guild) continue;

        // Récupérer les infos du serveur (une seule fois)
        const allMembers = await guild.members.fetch().catch(() => null);
        if (!allMembers) continue;
        const memberCount = allMembers.size;
        const botCount = allMembers.filter(m => m.user.bot).size;
        const onlineCount = allMembers.filter(
          m => m.presence && m.presence.status !== 'offline'
        ).size;
        const boostCount = guild.premiumSubscriptionCount || 0;
        const channelCount = guild.channels.cache.size;

        // Noms à définir
        const newNames = {
          members_ch: `👥 Membres: ${memberCount}`,
          bots_ch: `🤖 Bots: ${botCount}`,
          online_ch: `🟢 En ligne: ${onlineCount}`,
          boosts_ch: `🚀 Boosts: ${boostCount}`,
          channels_ch: `📝 Salons: ${channelCount}`
        };

        // Mettre à jour chaque canal si le nom a changé
        for (const [key, newName] of Object.entries(newNames)) {
          const channelId = config[key];
          if (!channelId) continue;

          const channel = guild.channels.cache.get(channelId);
          if (!channel) continue;

          const oldName = channel.name;
          const lastUpdate = lastNameUpdates[channelId] || 0;
          const now = Date.now();

          // Vérifier si le nom a changé et si on n'a pas updaté trop récemment
          if (oldName !== newName && (now - lastUpdate > 10 * 60 * 1000)) {
            try {
              await channel.setName(newName, 'Mise à jour des stats');
              lastNameUpdates[channelId] = now;
            } catch (err) {
              // Erreur de rate limit ou permissions - ignorer
              if (err.code !== 'MISSING_PERMISSIONS' && !err.message.includes('rate limit')) {
                console.error(`Erreur updateStatsChannels pour canal ${channelId}:`, err.message);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Erreur updateStatsChannels pour serveur ${config.guild_id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Erreur updateStatsChannels global:', error.message);
  }
}

module.exports = { updateStatsChannels };
