const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Ajuste le volume (0-100%)')
    .addIntegerOption(option =>
      option.setName('pourcentage')
        .setDescription('Nouveau volume en pourcentage (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
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

      // Vérifier qu'il y a une queue active
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à écouter en ce moment.');

        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }

      const newVolume = interaction.options.getInteger('pourcentage');

      // Mettre à jour le volume
      queue.volume = newVolume;

      // Créer une barre visuelle du volume
      const barLength = 20;
      const filledLength = Math.round((newVolume / 100) * barLength);
      const emptyLength = barLength - filledLength;
      const volumeBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🔊 Volume ajusté')
        .addFields({
          name: 'Volume',
          value: `${volumeBar} ${newVolume}%`
        });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande volume:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de l\'ajustement du volume.');

      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
