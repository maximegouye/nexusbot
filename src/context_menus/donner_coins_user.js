const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('🎁 Donner des Coins')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    const target = interaction.targetUser;
    if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de donner des coins à un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas te donner des coins à toi-même.', ephemeral: true });

    const modal = new ModalBuilder()
      .setCustomId(`give_coins_ctx_${target.id}`)
      .setTitle(`🎁 Donner des Coins à ${target.username}`);

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
  }
};
