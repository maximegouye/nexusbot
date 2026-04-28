const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteLeaderboard } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteleaderboard')
    .setDescription('Affiche le classement des invitations du serveur'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Récupérer le classement des invitations
      const leaderboard = getInviteLeaderboard(interaction.guildId, 10);

      if (!leaderboard || leaderboard.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Aucune donnée d\'invitation disponible pour ce serveur.');

        return interaction.editReply({ embeds: [errorEmbed] });
      }

      let description = '**Top 10 des inviteurs du serveur:**\n\n';

      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const effectiveScore = (entry.total_invites || 0) - (entry.left || 0) - (entry.fake || 0);

        description += `${medal} <@${entry.user_id}>\n`;
        description += `   📨 Total: **${entry.total_invites || 0}** | ✅ Actifs: **${entry.remaining || 0}** | ⭐ Score: **${effectiveScore}**\n\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🏆 Classement des invitations')
        .setDescription(description)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter({
          text: `${interaction.guild.name} - Mis à jour actuellement`
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande inviteleaderboard:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de la récupération du classement.');

      return interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
