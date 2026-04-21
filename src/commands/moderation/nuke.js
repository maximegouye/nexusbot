const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('💥 Supprimer tous les messages d\'un salon (clone + suppression)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 30,

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const nbMessages = interaction.options.getInteger('messages');

    if (nbMessages) {
      // Suppression de N messages (bulk delete)
      await interaction.deferReply({ ephemeral: true });
      try {
        const deleted = await interaction.channel.bulkDelete(nbMessages, true);
        return interaction.editReply({ content: `🗑️ **${deleted.size}** message${deleted.size > 1 ? 's' : ''} supprimé${deleted.size > 1 ? 's' : ''}.` });
      } catch (e) {
        return interaction.editReply({ content: `❌ Erreur : ${e.message}` });
      }
    }

    // Demande de confirmation pour le nuke complet
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nuke_confirm').setLabel('💥 Confirmer le Nuke').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('nuke_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('⚠️ Confirmation — Nuke du Salon')
      .setDescription(`Tu es sur le point de **nuker** le salon <#${interaction.channelId}>.\n\nCela va :\n• Cloner le salon (même paramètres)\n• Supprimer l'original\n• Tous les messages seront **définitivement perdus**\n\n**Es-tu sûr ?**`)
      .setFooter({ text: '15 secondes pour confirmer' });

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const filter  = i => i.user.id === interaction.user.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 15000, max: 1 });

    collector.on('collect', async (btn) => {
      await btn.deferUpdate();
      if (btn.customId === 'nuke_confirm') {
        try {
          const channel  = interaction.channel;
          const position = channel.position;
          const newCh    = await channel.clone({ reason: `Nuke par ${interaction.user.tag}` });
          await newCh.setPosition(position);
          await newCh.send({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('💥 Salon Nuké !')
              .setDescription(`Ce salon a été nuké par <@${interaction.user.id}>.`)
              .setTimestamp()
            ]
          });
          await channel.delete(`Nuke par ${interaction.user.tag}`);
        } catch (e) {
          interaction.followUp({ content: `❌ Erreur : ${e.message}`, ephemeral: true }).catch(() => {});
        }
      } else {
        await msg.edit({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('✅ Nuke annulé.')], components: [] });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });
  }
};
