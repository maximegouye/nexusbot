const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('🗑️ Supprimer des messages en masse')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages à supprimer (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('membre').setDescription('Filtrer par membre (optionnel)').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const nb     = interaction.options.getInteger('nombre');
    const filter = interaction.options.getUser('membre');

    // ── Confirmation ──────────────────────────────────────
    const confirmEmbed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🗑️ Confirmation de suppression')
      .setDescription(`Tu es sur le point de supprimer jusqu'à **${nb} message${nb > 1 ? 's' : ''}**${filter ? ` de **${filter.username}**` : ''} dans ce salon.`)
      .addFields(
        { name: '📢 Salon',   value: `<#${interaction.channelId}>`,                       inline: true },
        { name: '🔢 Nombre',  value: `Jusqu'à **${nb}** messages`,                        inline: true },
        ...(filter ? [{ name: '👤 Filtre', value: `**${filter.username}** seulement`, inline: true }] : []),
      )
      .setFooter({ text: '⚠️ Messages < 14 jours uniquement. Tu as 30 secondes pour confirmer.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('clear_confirm').setLabel(`🗑️ Supprimer ${nb} message${nb > 1 ? 's' : ''}`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('clear_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

    let btnInteraction;
    try {
      btnInteraction = await interaction.fetchReply().then(msg =>
        msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30_000 })
      );
    } catch {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('⏰ Délai dépassé').setDescription('La suppression a été annulée.')], components: [] });
    }

    if (btnInteraction.customId === 'clear_cancel') {
      return btnInteraction.update({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Suppression annulée').setDescription('Aucun message supprimé.')], components: [] });
    }

    // ── Exécution de la suppression ───────────────────────
    await btnInteraction.deferUpdate().catch(() => {});

    // ⚠️ FIX BUG : récupérer l'ID du message de confirmation pour l'EXCLURE de la suppression
    let replyMessageId = null;
    try {
      const replyMsg = await interaction.fetchReply();
      replyMessageId = replyMsg?.id;
    } catch {}

    let messages;
    try {
      messages = await interaction.channel.messages.fetch({ limit: Math.min(nb + 5, 100) });
    } catch (e) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`❌ Impossible de fetch les messages : ${e.message}`)], components: [] }).catch(() => {});
    }

    // Exclure : le message de confirmation du bot + filtrer par membre si spécifié
    if (replyMessageId) messages = messages.filter(m => m.id !== replyMessageId);
    if (filter) messages = messages.filter(m => m.author.id === filter.id);

    // Limiter au nombre demandé
    const sorted = [...messages.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, nb);

    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const toDelete = sorted.filter(m => m.createdTimestamp > twoWeeksAgo);

    if (!toDelete.length) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95A5A6').setDescription('❌ Aucun message récent à supprimer (messages > 14 jours exclus).')], components: [] }).catch(() => {});
    }

    let count = 0;
    try {
      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      count = deleted?.size ?? 0;
    } catch (e) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`❌ Erreur suppression : ${e.message}`)], components: [] }).catch(() => {});
    }

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${count} message${count > 1 ? 's' : ''}** supprimé${count > 1 ? 's' : ''}${filter ? ` de **${filter.username}**` : ''}.`)
        .setFooter({ text: `Action par ${interaction.user.username}` })
        .setTimestamp()
      ],
      components: []
    }).catch(() => {});
  }
};
