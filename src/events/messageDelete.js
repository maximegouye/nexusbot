const snipe = require('../commands/utility/snipe');
const db    = require('../database/db');

module.exports = {
  name: 'messageDelete',
  execute(message) {
    if (!message.guild) return;

    // Alimenter le cache snipe
    if (message.partial) return; // message pas en cache, impossible de récupérer le contenu
    snipe.store(message);

    // Log modération si configuré
    const cfg = db.getConfig(message.guild.id);
    if (cfg.log_channel) {
      const logCh = message.guild.channels.cache.get(cfg.log_channel);
      if (!logCh) return;
      const { EmbedBuilder } = require('discord.js');
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🗑️ Message supprimé')
          .addFields(
            { name: '✍️ Auteur', value: message.author ? `${message.author.tag} (<@${message.author.id}>)` : 'Inconnu', inline: true },
            { name: '📌 Salon', value: `<#${message.channel.id}>`, inline: true },
            { name: '📝 Contenu', value: message.content?.slice(0, 1024) || '*[Pas de texte]*', inline: false },
          )
          .setTimestamp()
        ]
      }).catch(() => {});
    }
  }
};
