const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    const { guild, user } = member;
    const cfg = db.getConfig(guild.id);

    db.incrementStat(guild.id, 'left_members');

    // Priorité : table system_messages(event='leave') > cfg.leave_msg > défaut
    const sysMsg = db.getSystemMessage ? db.getSystemMessage(guild.id, 'leave') : null;
    const sysEnabled = sysMsg ? (sysMsg.enabled ?? 1) : 1;
    if (!sysEnabled) return;

    const channelId = (sysMsg && sysMsg.channel_id) || cfg.leave_channel;
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const defaultMsg = `**{username}** a quitté le serveur. On te souhaite bonne continuation ! 👋`;
    const rawText = (sysMsg && sysMsg.content) || cfg.leave_msg || defaultMsg;
    const msg = rawText
      .replace(/\{user\}/g,     `<@${user.id}>`)
      .replace(/\{username\}/g, user.username)
      .replace(/\{server\}/g,   guild.name)
      .replace(/\{count\}/g,    guild.memberCount.toLocaleString('fr'));

    // Embed custom ?
    let customEmbedData = sysMsg && sysMsg.embed_json
      ? (() => { try { return JSON.parse(sysMsg.embed_json); } catch { return null; } })()
      : null;

    let embed;
    if (customEmbedData) {
      try {
        const { rebuildEmbedFromData, applyVarsToTemplate } = require('../utils/configPanelAdvanced');
        embed = rebuildEmbedFromData(applyVarsToTemplate(customEmbedData, {
          userMention: `<@${user.id}>`,
          username: user.username,
          serverName: guild.name,
          memberCount: guild.memberCount,
        }));
      } catch { embed = null; }
    }
    if (!embed) {
      embed = new EmbedBuilder()
        .setColor(cfg.color || '#FF6B6B')
        .setTitle('👋 Au revoir !')
        .setDescription(msg)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .addFields({ name: '👥 Membres restants', value: `**${guild.memberCount}**`, inline: true })
        .setFooter({ text: guild.name })
        .setTimestamp();
    }

    const mode = (sysMsg && sysMsg.mode) || 'embed';
    const payload = {};
    if (mode === 'text') {
      payload.content = msg;
    } else {
      payload.embeds = [embed];
      if (mode === 'both') payload.content = msg;
    }

    await channel.send(payload).catch(() => {});
  }
};
