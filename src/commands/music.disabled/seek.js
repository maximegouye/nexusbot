const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue, formatDuration } = require('../../utils/musicManager');
const play = require('play-dl');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Saute à une position spécifique de la piste')
    .addStringOption(option =>
      option.setName('temps')
        .setDescription('Temps de position (format: 1:30 ou 90 pour secondes)')
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);

      // Vérifier que l'utilisateur est dans un canal vocal
      if (!member.voice.channel) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Vous devez être dans un canal vocal pour utiliser cette commande.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      // Vérifier que le bot est dans le même canal
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember.voice.channel || botMember.voice.channel.id !== member.voice.channel.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Je dois être dans le même canal vocal que vous.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const queue = getOrCreateQueue(interaction.guildId);

      // Vérifier qu'il y a une piste en lecture
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à écouter en ce moment.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const timeString = interaction.options.getString('temps').trim();
      let seekSeconds = 0;

      // Parser le temps
      if (timeString.includes(':')) {
        const parts = timeString.split(':');
        if (parts.length === 2) {
          const minutes = parseInt(parts[0]);
          const seconds = parseInt(parts[1]);
          if (isNaN(minutes) || isNaN(seconds)) {
            const errorEmbed = new EmbedBuilder()
              .setColor('#FF0000')
              .setDescription('❌ Format de temps invalide. Utilisez MM:SS ou nombre de secondes.');

            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
          }
          seekSeconds = minutes * 60 + seconds;
        } else {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription('❌ Format de temps invalide. Utilisez MM:SS ou nombre de secondes.');

          return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      } else {
        seekSeconds = parseInt(timeString);
        if (isNaN(seekSeconds)) {
          const errorEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setDescription('❌ Format de temps invalide. Utilisez MM:SS ou nombre de secondes.');

          return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }

      // Vérifier que le temps est dans les limites
      if (queue.current.duration && seekSeconds > queue.current.duration) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription(`❌ Le temps ${formatDuration(seekSeconds)} dépasse la durée de la piste (${formatDuration(queue.current.duration)}).`);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      if (seekSeconds < 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Le temps ne peut pas être négatif.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      // Mettre à jour le temps de démarrage pour simuler le seek
      queue.startedAt = Date.now() - (seekSeconds * 1000);

      // Si la piste provient d'une URL YouTube/Spotify, on peut utiliser seek avec play-dl
      if (queue.current.url && queue.audioPlayer) {
        try {
          // Arrêter la piste actuelle
          queue.audioPlayer.stop();

          // La prochaine piste sera lue avec le seek via les options de play-dl
          queue.seekPosition = seekSeconds;
        } catch (error) {
          console.error('Erreur lors du seek:', error);
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⏩ Position modifiée')
        .addFields({
          name: 'Nouvelle position',
          value: formatDuration(seekSeconds)
        },
        {
          name: 'Piste',
          value: queue.current.title
        });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande seek:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du seek.');

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
