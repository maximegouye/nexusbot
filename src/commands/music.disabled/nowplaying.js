const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue, formatDuration } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Affiche la piste actuellement en lecture'),

  async execute(interaction) {
    try {
      const queue = getOrCreateQueue(interaction.guildId);

      // Vérifier qu'il y a une piste en lecture
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à écouter en ce moment.');

        return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
      }

      const current = queue.current;
      const duration = current.duration ? formatDuration(current.duration) : 'Durée inconnue';
      const timeStarted = queue.startedAt ? new Date(queue.startedAt).toLocaleTimeString('fr-FR') : 'N/A';

      // Créer une barre de progression approximative (basée sur le temps écoulé)
      let progressBar = '';
      if (queue.startedAt && current.duration) {
        const elapsed = Date.now() - queue.startedAt;
        const percentage = Math.min((elapsed / current.duration) * 100, 100);
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const emptyLength = barLength - filledLength;
        progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
        progressBar += ` ${Math.round(percentage)}%`;
      } else {
        const barLength = 20;
        progressBar = '░'.repeat(barLength) + ' 0%';
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🎵 Actuellement en lecture')
        .setThumbnail(current.thumbnail || null)
        .addFields(
          {
            name: 'Titre',
            value: current.title || 'N/A'
          },
          {
            name: 'Artiste',
            value: current.author || 'N/A'
          },
          {
            name: 'Durée',
            value: duration
          },
          {
            name: 'Progression',
            value: progressBar
          },
          {
            name: 'Commencée à',
            value: timeStarted
          },
          {
            name: 'Mode boucle',
            value: queue.loop || 'Aucun'
          },
          {
            name: 'Volume',
            value: `${queue.volume || 100}%`
          },
          {
            name: 'Prochaine piste',
            value: queue.songs.length > 0 ? `${queue.songs[0].title} par ${queue.songs[0].author}` : 'Aucune'
          }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande nowplaying:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de l\'affichage de la piste actuelle.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
