const db = require('../database/db');

module.exports = async (client) => {
  // Créditer 1 min de XP/coins aux membres actuellement en vocal
  const now = Math.floor(Date.now() / 1000);

  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = db.getConfig(guild.id);
      if (cfg.xp_enabled === 0) continue;

      for (const [, channel] of guild.channels.cache.filter(c => c.isVoiceBased())) {
        for (const [, member] of channel.members) {
          if (member.user.bot) continue;
          if (member.voice.selfMute && member.voice.selfDeaf) continue; // AFK

          const xpGain    = 3 * (cfg.xp_multiplier || 1);
          const coinsGain = 2;

          db.addXP(member.id, guild.id, xpGain);
          db.addCoins(member.id, guild.id, coinsGain);
          db.db.prepare('UPDATE users SET voice_minutes = voice_minutes + 1 WHERE user_id = ? AND guild_id = ?')
            .run(member.id, guild.id);
        }
      }
    } catch {}
  }
};
