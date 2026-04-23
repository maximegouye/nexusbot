const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue, formatDuration } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Affiche la file d\'attente actuelle')
    .addStringOption(option =>
      option.setName('page')
        .setDescription('Numéro de la page (par défaut 1)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const queue = getOrCreateQueue(interaction.guildId);

      // Vérifier qu'il y a une queue active
      if (!queue.current && queue.songs.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ La file d\'attente est vide.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const pageNum = parseInt(interaction.options.getString('page')) || 1;
      const itemsPerPage = 10;
      const totalPages = Math.ceil(queue.songs.length / itemsPerPage);

      // Vérifier que le numéro de page est valide
      if (pageNum > totalPages && queue.songs.length > 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription(`❌ La page ${pageNum} n'existe pas. Il y a ${totalPages} page(s).`);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const startIndex = (pageNum - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageSongs = queue.songs.slice(startIndex, endIndex);

      let description = '';

      // Afficher la piste actuelle
      if (queue.current) {
        description += `**Actuellement en lecture:**\n🎵 ${queue.current.title}\nPar: ${queue.current.author}`;
        if (queue.current.duration) {
          description += ` | Durée: ${formatDuration(queue.current.duration)}`;
        }
        description += '\n\n';
      }

      // Afficher les pistes suivantes
      if (pageSongs.length > 0) {
        description += `**Pistes suivantes (Page ${pageNum}/${totalPages}):**\n`;
        pageSongs.forEach((song, index) => {
          const songNumber = startIndex + index + 1;
          const duration = song.duration ? ` | ${formatDuration(song.duration)}` : '';
          description += `${songNumber}. ${song.title}\nPar: ${song.author}${duration}\n`;
        });
      } else if (queue.current) {
        description += '**Pas de pistes en attente**';
      }

      // Ajouter les informations supplémentaires
      description += `\n\n**Mode boucle:** ${queue.loop || 'Aucun'}`;
      description += `\n**Volume:** ${queue.volume || 100}%`;
      description += `\n**Total en queue:** ${queue.songs.length} piste(s)`;

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🎵 File d\'attente')
        .setDescription(description)
        .setFooter({
          text: queue.songs.length > 0 ? `Page ${pageNum}/${totalPages}` : 'Vide'
        });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande queue:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de l\'affichage de la file d\'attente.');

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
