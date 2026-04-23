const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Supprime une piste de la file d\'attente')
    .addStringOption(option =>
      option.setName('position')
        .setDescription('Position de la piste à supprimer (1 = première piste)')
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

      // Vérifier qu'il y a une queue active
      if (queue.songs.length === 0) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ La file d\'attente est vide.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      const position = parseInt(interaction.options.getString('position'));

      // Vérifier que la position est valide
      if (position > queue.songs.length) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription(`❌ La position ${position} n'existe pas. Il y a seulement ${queue.songs.length} piste(s).`);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      // Supprimer la piste
      const removed = queue.songs.splice(position - 1, 1)[0];

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🗑️ Piste supprimée')
        .addFields({
          name: 'Piste supprimée',
          value: `${removed.title}\nPar: ${removed.author}`
        },
        {
          name: 'Pistes restantes',
          value: `${queue.songs.length}`
        });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande remove:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de la suppression de la piste.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
