const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('📌 Épingler ce message')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const msg = interaction.targetMessage;
      try {
        await msg.pin();
        return await interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('Green')
            .setDescription(`✅ Message de <@${msg.author.id}> épinglé avec succès dans <#${msg.channelId}> !`)
        ]});
      } catch (e) {
        return await interaction.editReply(`❌ Impossible d'épingler : ${e.message}`);
      }
    } catch (err) {
      console.error('[epingler_message.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply(msg);
      } catch {}
    }
  }
};
