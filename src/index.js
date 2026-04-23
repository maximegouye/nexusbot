module.exports = {
name: ‘interactionCreate’,
async execute(interaction, client) {
try {

  if (
    (interaction.isButton() || interaction.isStringSelectMenu()) &&
    !interaction.deferred &&
    !interaction.replied
  ) {
    await interaction.deferUpdate().catch(() => {});
  }
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await interaction.deferReply();
      await cmd.execute(interaction, client);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.editReply('❌ Erreur dans la commande.');
      }
    }
    return;
  }
  if (interaction.isButton()) {
    const cmd = client.commands.get('giveaway');
    if (cmd && cmd.handleGiveawayButton) {
      return cmd.handleGiveawayButton(interaction);
    }
  }
} catch (err) {
  console.error('[INTERACTION]', err);
  try {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Une erreur est survenue.',
        ephemeral: true
      });
    } else {
      await interaction.editReply({
        content: '❌ Une erreur est survenue.'
      });
    }
  } catch {}
}

}
};