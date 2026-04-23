const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Mélange aléatoirement la file d\'attente'),

  async execute(interaction) {
    try {
      const member = interaction.guild.members.cache.get(interaction.user.id);

      // Vérifier que l'utilisateur est dans un canal vocal
      if (!member.voice.channel) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Vous devez être dans un canal vocal pour utiliser cette commande.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      // Vérifier que le bot est dans le même canal
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!botMember.voice.channel || botMember.voice.channel.id !== member.voice.channel.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Je dois être dans le même canal vocal que vous.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      const queue = getOrCreateQueue(interaction.guildId);

      // Vérifier qu'il y a au moins 2 pistes
      if (queue.songs.length < 2) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il faut au moins 2 pistes dans la file pour la mélanger.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      // Algorithme de Fisher-Yates pour mélanger
      const songs = [...queue.songs];
      for (let i = songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songs[i], songs[j]] = [songs[j], songs[i]];
      }

      queue.songs = songs;

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🔀 File d\'attente mélangée')
        .setDescription(`✅ La file d'attente avec ${queue.songs.length} piste(s) a été mélangée aléatoirement.`)
        .setTimestamp();

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande shuffle:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du mélange de la file d\'attente.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
