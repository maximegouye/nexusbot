const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('🐌 Activer/désactiver le mode lent sur un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('secondes').setDescription('Délai en secondes (0 = désactiver, max 21600)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  cooldown: 3,

  async execute(interaction) {
    const sec = interaction.options.getInteger('secondes');
    await interaction.channel.setRateLimitPerUser(sec, `Slowmode par ${interaction.user.tag}`);

    const embed = new EmbedBuilder()
      .setColor(sec === 0 ? '#2ECC71' : '#FFA500')
      .setTitle(sec === 0 ? '🐇 Mode lent désactivé' : '🐌 Mode lent activé')
      .setDescription(sec === 0
        ? `Le mode lent a été désactivé dans <#${interaction.channelId}>.`
        : `Mode lent de **${sec}s** activé dans <#${interaction.channelId}>.`
      );

    await interaction.reply({ embeds: [embed] });
  }
};
