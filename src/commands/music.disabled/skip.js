const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Saute la piste actuelle')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de pistes à sauter (par défaut 1)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
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

      // Vérifier qu'il y a une queue active
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à sauter en ce moment.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const skipCount = interaction.options.getInteger('nombre') || 1;

      // Vérifier s'il y assez de pistes à sauter
      if (skipCount > queue.songs.length) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription(`❌ Il y a seulement ${queue.songs.length} piste(s) dans la file.`);

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      // Récupérer la piste qui va jouer après les sauts
      const skippedSongs = queue.songs.splice(0, skipCount);
      const nextSong = queue.songs[0];

      // Arrêter la piste actuelle pour forcer le passage à la suivante
      if (queue.audioPlayer) {
        queue.audioPlayer.stop();
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⏭️ Piste(s) sautée(s)')
        .setDescription(`${skipCount} piste(s) sautée(s).`)
        .addFields({
          name: 'Piste suivante',
          value: nextSong
            ? `🎵 ${nextSong.title}\nPar: ${nextSong.author}`
            : 'Aucune piste suivante - file d\'attente vide'
        });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande skip:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du saut de piste.');

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
