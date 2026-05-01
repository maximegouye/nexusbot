const db = require('../database/db');
const { checkActivityRoles } = require('./activityRoleCheck');

// 🎉 Bonus Vocal Weekend : ×2 du vendredi 18h au dimanche minuit (Paris)
// pour pousser les membres à se connecter en vocal pendant le weekend.
function isVocalBoostActive() {
  const now = new Date();
  const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
  const parisHour = (now.getUTCHours() + parisOffset) % 24;
  const day = now.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
  // Vendredi à partir de 18h Paris
  if (day === 5 && parisHour >= 18) return true;
  // Samedi toute la journée
  if (day === 6) return true;
  // Dimanche jusqu'à minuit (toute la journée)
  if (day === 0) return true;
  return false;
}

module.exports = async (client) => {
  // Créditer 1 min de XP/coins aux membres actuellement en vocal
  const now = Math.floor(Date.now() / 1000);
  const vocalBoost = isVocalBoostActive() ? 2 : 1;

  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = db.getConfig(guild.id);
      if (cfg.xp_enabled === 0) continue;

      for (const [, channel] of guild.channels.cache.filter(c => c.isVoiceBased())) {
        for (const [, member] of channel.members) {
          if (member.user.bot) continue;
          if (member.voice.selfMute && member.voice.selfDeaf) continue; // AFK

          const xpGain    = 3 * (cfg.xp_multiplier || 1) * vocalBoost;
          const coinsGain = 2 * vocalBoost;

          db.addXP(member.id, guild.id, xpGain);
          db.addCoins(member.id, guild.id, coinsGain);
          db.db.prepare('UPDATE users SET voice_minutes = voice_minutes + 1 WHERE user_id = ? AND guild_id = ?')
            .run(member.id, guild.id);

          // Vérifier les paliers d'activité toutes les 5 minutes (toutes les 5 ticks)
          if (Math.random() < 0.2) {
            checkActivityRoles(member.id, guild.id, guild).catch(() => {});
          }
        }
      }
    } catch {}
  }
};
