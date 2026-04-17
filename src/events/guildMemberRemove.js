const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild, user } = member;
    const cfg = db.getConfig(guild.id);

    db.incrementStat(guild.id, 'left_members');

    if (!cfg.leave_channel) return;
    const channel = guild.channels.cache.get(cfg.leave_channel);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('👋 Au revoir !')
      .setDescription(cfg.leave_msg
        ? cfg.leave_msg
            .replace('{user}', user.username)
            .replace('{server}', guild.name)
        : `**${user.username}** a quitté le serveur. On vous souhaitons bonne continuation ! 👋`)
      .setThumbnail(user.displayAvatarURL({ size: 128 }))
      .addFields({ name: '👥 Membres restants', value: `**${guild.memberCount}**`, inline: true })
      .setFooter({ text: guild.name })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  }
};
