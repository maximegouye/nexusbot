const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('📌 Épingler ce message')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const msg = interaction.targetMessage;
    try {
      await msg.pin();
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('Green')
          .setDescription(`✅ Message de <@${msg.author.id}> épinglé avec succès dans <#${msg.channelId}> !`)
      ]});
    } catch (e) {
      return interaction.editReply(`❌ Impossible d'épingler : ${e.message}`);
    }
  }
};
