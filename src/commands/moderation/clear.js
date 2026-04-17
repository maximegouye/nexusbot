const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('🗑️ Supprimer des messages en masse')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('membre').setDescription('Filtrer par membre (optionnel)').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    const nb     = interaction.options.getInteger('nombre');
    const filter = interaction.options.getUser('membre');

    await interaction.deferReply({ ephemeral: true });

    let messages = await interaction.channel.messages.fetch({ limit: nb + 1 });
    // Exclure le message slash lui-même
    messages = messages.filter(m => m.id !== interaction.id);

    if (filter) messages = messages.filter(m => m.author.id === filter.id);

    // Discord ne peut supprimer en masse que les messages de moins de 14 jours
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const toDelete = messages.filter(m => m.createdTimestamp > twoWeeksAgo);

    if (!toDelete.size) {
      return interaction.editReply('❌ Aucun message récent à supprimer (les messages de plus de 14 jours ne peuvent pas être supprimés en masse).');
    }

    const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);

    const count = deleted?.size ?? 0;
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${count} message${count > 1 ? 's' : ''}** supprimé${count > 1 ? 's' : ''}${filter ? ` de ${filter.username}` : ''}.`)
      ]
    });
  }
};
