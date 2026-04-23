const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteStats } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Affiche vos statistiques d\'invitation')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('Utilisateur dont voir les stats (par défaut: vous)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

      // Récupérer les stats d'invitation
      const stats = getInviteStats(interaction.guildId, targetUser.id);

      if (!stats) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Cet utilisateur n\'a pas de statistiques d\'invitation.');

        return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Statistiques d\'invitation')
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(`Statistiques pour ${targetUser}`)
        .addFields(
          {
            name: '📨 Invitations totales',
            value: `${stats.total_invites || 0}`
          },
          {
            name: '✅ Encore présents',
            value: `${stats.remaining || 0}`
          },
          {
            name: '❌ Partis',
            value: `${stats.left || 0}`
          },
          {
            name: '🚫 Invitations invalides',
            value: `${stats.fake || 0}`
          },
          {
            name: '⭐ Score effectif',
            value: `${stats.effective_score || 0}`
          }
        )
        .setFooter({
          text: 'Score effectif = Total - Partis - Invalides'
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande invites:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de la récupération des statistiques.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
