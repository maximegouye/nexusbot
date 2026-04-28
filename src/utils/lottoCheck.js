const db = require('../database/db');

module.exports = async (client) => {
  // Déterminer la semaine actuelle
  const now = new Date();
  const week = `${now.getFullYear()}-W${String(Math.ceil(now.getDate() / 7)).padStart(2, '0')}`;

  // Récupérer tous les guilds actifs
  const guilds = db.db.prepare('SELECT DISTINCT guild_id FROM lotto WHERE week = ?').all(week);

  for (const { guild_id } of guilds) {
    try {
      const guild = client.guilds.cache.get(guild_id);
      if (!guild) continue;

      const cfg    = db.getConfig(guild_id);
      const entries = db.db.prepare('SELECT * FROM lotto WHERE guild_id = ? AND week = ? ORDER BY tickets DESC').all(guild_id, week);

      if (!entries.length) continue;

      // Construire la liste pondérée par tickets
      const pool = [];
      let total = 0;
      for (const e of entries) {
        total += e.amount;
        for (let i = 0; i < e.tickets; i++) pool.push(e.user_id);
      }

      if (!pool.length) continue;

      // Tirage au sort
      const winnerId = pool[Math.floor(Math.random() * pool.length)];
      const prize    = Math.floor(total * 0.9); // 10% de frais

      db.addCoins(winnerId, guild_id, prize);

      // Annonce
      const announceCh = cfg.quest_channel || cfg.welcome_channel;
      if (announceCh) {
        const ch = guild.channels.cache.get(announceCh);
        if (ch) {
          const { EmbedBuilder } = require('discord.js');
          await ch.send({
            embeds: [new EmbedBuilder()
              .setColor('#FFD700')
              .setTitle('🎰 RÉSULTATS DU LOTO HEBDOMADAIRE !')
              .setDescription(
                `🏆 **Félicitations à <@${winnerId}> !**\n\n` +
                `💰 Gain : **${prize.toLocaleString('fr-FR')} €**\n` +
                `🎟️ Participants : **${entries.length}**\n` +
                `🏦 Cagnotte totale : **${total.toLocaleString('fr-FR')} €**`
              )
              .setFooter({ text: `Semaine ${week} | Reviens la semaine prochaine !` })
            ]
          }).catch(() => {});
        }
      }
    } catch (e) {}
  }
};
