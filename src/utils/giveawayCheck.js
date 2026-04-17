const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = async (client) => {
  const expired = db.getActiveGiveaways();
  if (!expired.length) return;

  for (const gw of expired) {
    try {
      const guild = client.guilds.cache.get(gw.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(gw.channel_id);
      const entries = JSON.parse(gw.entries || '[]');

      // Sélectionner les gagnants
      const pool = [...entries];
      const winners = [];
      for (let i = 0; i < Math.min(gw.winners_count, pool.length); i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
      }

      db.db.prepare('UPDATE giveaways SET status = "ended", winner_ids = ? WHERE id = ?')
        .run(JSON.stringify(winners), gw.id);

      if (!channel) continue;

      const winnerMentions = winners.length > 0
        ? winners.map(id => `<@${id}>`).join(', ')
        : '*Aucun participant*';

      // Mettre à jour le message original
      if (gw.message_id) {
        try {
          const msg = await channel.messages.fetch(gw.message_id);
          const endEmbed = new EmbedBuilder()
            .setColor('#888888')
            .setTitle(`🎉 GIVEAWAY TERMINÉ — ${gw.prize}`)
            .setDescription([
              `🏆 **Gagnant${winners.length > 1 ? 's' : ''} :** ${winnerMentions}`,
              `👑 **Organisé par :** <@${gw.host_id}>`,
              `🎟️ **Participants :** ${entries.length}`,
            ].join('\n'))
            .setTimestamp();
          await msg.edit({ embeds: [endEmbed], components: [] });
        } catch {}
      }

      // Annoncer les gagnants
      if (winners.length > 0) {
        await channel.send({
          content: `🎊 Félicitations ${winnerMentions} ! Vous avez gagné **${gw.prize}** !`,
          embeds: [new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Gagnants du giveaway !')
            .setDescription(`${winnerMentions} remporte${winners.length > 1 ? 'nt' : ''} **${gw.prize}** !\n\n*Contactez <@${gw.host_id}> pour récupérer votre prix.*`)
          ]
        });
      } else {
        await channel.send({ content: '😕 Pas assez de participants pour ce giveaway.' });
      }
    } catch (err) {
      console.error('[GiveawayCheck] Erreur:', err.message);
    }
  }
};
