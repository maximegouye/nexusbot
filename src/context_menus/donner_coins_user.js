const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('🎁 Donner des €')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    try {
      const target = interaction.targetUser;
      if (target.bot) return await interaction.reply({ content: '❌ Impossible de transférer des € à un bot.', ephemeral: true });
      if (target.id === interaction.user.id) return await interaction.reply({ content: '❌ Tu ne peux pas te transférer des € à toi-même.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId(`give_coins_ctx_${target.id}`)
        .setTitle(`🎁 Donner des € à ${target.username}`);

      const montant = new TextInputBuilder()
        .setCustomId('montant')
        .setLabel('Montant à donner')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 500')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(montant));
      await interaction.showModal(modal);
    } catch (err) {
      console.error('[donner_coins_user.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply(msg);
      } catch {}
    }
  }
};
