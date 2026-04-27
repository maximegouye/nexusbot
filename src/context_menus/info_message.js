const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('📋 Infos du message')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const msg = interaction.targetMessage;
    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('📋 Informations du message')
      .addFields(
        { name: '🆔 ID message', value: msg.id, inline: true },
        { name: '👤 Auteur', value: `<@${msg.author.id}> (\`${msg.author.username}\`)`, inline: true },
        { name: '📅 Envoyé', value: `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`, inline: true },
        { name: '💬 Salon', value: `<#${msg.channelId}> (\`${msg.channelId}\`)`, inline: true },
        { name: '📝 Longueur', value: `${msg.content?.length ?? 0} caractères`, inline: true },
        { name: '📎 Pièces jointes', value: `${msg.attachments.size}`, inline: true },
        { name: '📌 Épinglé', value: msg.pinned ? '✅ Oui' : '❌ Non', inline: true },
        { name: '🔗 Lien direct', value: `[Aller au message](${msg.url})`, inline: true },
        { name: '😄 Réactions', value: msg.reactions.cache.size > 0 ? msg.reactions.cache.map(r => `${r.emoji} ×${r.count}`).join(' ') : 'Aucune', inline: false },
      )
      .setTimestamp();

    if (msg.content) embed.setDescription(`\`\`\`${msg.content.slice(0, 300)}\`\`\``);
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
  }
};
