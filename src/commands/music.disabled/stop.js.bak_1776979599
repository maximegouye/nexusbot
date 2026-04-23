const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Arrête la musique et vide la file d\'attente'),

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

      // Vérifier qu'il y a une queue active
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à arrêter en ce moment.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      // Arrêter le lecteur audio
      if (queue.audioPlayer) {
        queue.audioPlayer.stop();
      }

      // Vider la queue
      queue.songs = [];
      queue.current = null;

      // Déconnecter du canal vocal
      if (botMember.voice.connection) {
        botMember.voice.connection.destroy();
      }

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⏹️ Musique arrêtée')
        .setDescription('La musique a été arrêtée et la file d\'attente a été vidée.')
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande stop:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de l\'arrêt de la musique.');

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
