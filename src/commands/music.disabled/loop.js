const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Configure le mode boucle')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Mode de boucle à utiliser')
        .addChoices(
          { name: 'Aucun (par défaut)', value: 'none' },
          { name: 'Boucler la piste actuelle', value: 'track' },
          { name: 'Boucler toute la queue', value: 'queue' }
        )
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
      if (!queue.current) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Il n\'y a rien à écouter en ce moment.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      const mode = interaction.options.getString('mode');
      let modeLabel = '';
      let modeEmoji = '';

      switch (mode) {
        case 'none':
          queue.loop = null;
          modeLabel = 'Aucun';
          modeEmoji = '🔁';
          break;
        case 'track':
          queue.loop = 'track';
          modeLabel = 'Piste actuelle';
          modeEmoji = '🔂';
          break;
        case 'queue':
          queue.loop = 'queue';
          modeLabel = 'Entire queue';
          modeEmoji = '🔁';
          break;
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`${modeEmoji} Mode boucle`)
        .setDescription(`Le mode boucle est maintenant défini sur: **${modeLabel}**`)
        .setTimestamp();

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur dans la commande loop:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors de la modification du mode boucle.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};
