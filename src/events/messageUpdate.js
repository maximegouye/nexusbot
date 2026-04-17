const snipe = require('../commands/utility/snipe');
const db    = require('../database/db');

module.exports = {
  name: 'messageUpdate',
  execute(oldMessage, newMessage) {
    if (!oldMessage.guild) return;
    if (oldMessage.partial || newMessage.partial) return;
    if (oldMessage.content === newMessage.content) return;
    if (oldMessage.author?.bot) return;

    // Alimenter le cache editsnipe
    snipe.storeEdit(oldMessage, newMessage);

    // Log modération si configuré
    const cfg = db.getConfig(oldMessage.guild.id);
    if (cfg.log_channel) {
      const logCh = oldMessage.guild.channels.cache.get(cfg.log_channel);
      if (!logCh) return;
      const { EmbedBuilder } = require('discord.js');
      logCh.send({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('✏️ Message modifié')
          .setURL(newMessage.url)
          .addFields(
            { name: '✍️ Auteur', value: `${oldMessage.author.tag} (<@${oldMessage.author.id}>)`, inline: true },
            { name: '📌 Salon', value: `<#${oldMessage.channel.id}>`, inline: true },
            { name: '📝 Avant', value: oldMessage.content?.slice(0, 512) || '*vide*', inline: false },
            { name: '✅ Après',  value: newMessage.content?.slice(0, 512) || '*vide*', inline: false },
          )
          .setTimestamp()
        ]
      }).catch(() => {});
    }
  }
};
