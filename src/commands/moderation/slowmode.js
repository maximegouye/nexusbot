const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('🐌 Activer/désactiver le mode lent sur un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 3,

  async execute(interaction) {
    const sec = parseInt(interaction.options.getString('secondes'));
    await interaction.channel.setRateLimitPerUser(sec, `Slowmode par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(sec === 0 ? '#2ECC71' : '#FFA500')
      .setTitle(sec === 0 ? '🐇 Mode lent désactivé' : '🐌 Mode lent activé')
      .setDescription(sec === 0
        ? `Le mode lent a été désactivé dans <#${interaction.channelId}>.`
        : `Mode lent de **${sec}s** activé dans <#${interaction.channelId}>.`
      );

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};
