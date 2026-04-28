const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('🚨 Signaler ce message')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    try {
      const msg = interaction.targetMessage;

      const modal = new ModalBuilder()
        .setCustomId(`report_msg_${msg.id}`)
        .setTitle('🚨 Signaler un message');

      const raison = new TextInputBuilder()
        .setCustomId('raison')
        .setLabel('Raison du signalement')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Contenu inapproprié, spam, harcèlement...')
        .setRequired(true)
        .setMaxLength(200);

      modal.addComponents(new ActionRowBuilder().addComponents(raison));
      await interaction.showModal(modal);

      // Le handler dans interactionCreate gère report_msg_
    } catch (err) {
      console.error('[signaler_message.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(msg);
        } else {
          await interaction.reply(msg);
        }
      } catch {}
    }
  }
};
