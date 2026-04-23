const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { db } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('youtube-notif')
    .setDescription('Configure les notifications YouTube')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajoute une chaîne YouTube à surveiller')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('URL ou ID de la chaîne YouTube')
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Canal Discord où envoyer les notifications')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Message personnalisé (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Supprime une chaîne YouTube de la surveillance')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('URL ou ID de la chaîne YouTube')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Liste toutes les chaînes surveillées')
    ),

  async execute(interaction) {
    try {
      // Vérifier les permissions
      if (!interaction.member.permissions.has('ManageGuild')) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Vous avez besoin de la permission "Gérer le serveur" pour utiliser cette commande.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'add') {
        return handleAdd(interaction);
      } else if (subcommand === 'remove') {
        return handleRemove(interaction);
      } else if (subcommand === 'list') {
        return handleList(interaction);
      }
    } catch (error) {
      console.error('Erreur dans la commande youtube-notif:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du traitement de votre demande.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

function handleAdd(interaction) {
  try {
    const url = interaction.options.getString('url').trim();
    const channel = interaction.options.getChannel('channel');
    const customMessage = interaction.options.getString('message') || 'Nouvelle vidéo publiée!';

    // Extraire l'ID de la chaîne à partir de l'URL
    let channelId = url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:youtube\.com\/(?:user|c|channel)\/)([a-zA-Z0-9_-]+)|UC[a-zA-Z0-9_-]{22}/);
      if (match) {
        channelId = match[0].replace(/.*\//, '');
      }
    }

    // Stocker dans la base de données
    try {
      db.prepare(`
        INSERT INTO youtube_subscriptions (guild_id, channel_id, discord_channel_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(interaction.guildId, channelId, channel.id, customMessage, new Date().toISOString());
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Cette chaîne YouTube est déjà surveillée sur ce serveur.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('✅ Notification YouTube ajoutée')
      .addFields(
        {
          name: 'Chaîne',
          value: channelId
        },
        {
          name: 'Canal Discord',
          value: `${channel}`
        },
        {
          name: 'Message personnalisé',
          value: customMessage
        }
      );

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleAdd:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de l\'ajout de la chaîne.');

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
  }
}

function handleRemove(interaction) {
  try {
    const url = interaction.options.getString('url').trim();

    // Extraire l'ID de la chaîne
    let channelId = url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:youtube\.com\/(?:user|c|channel)\/)([a-zA-Z0-9_-]+)|UC[a-zA-Z0-9_-]{22}/);
      if (match) {
        channelId = match[0].replace(/.*\//, '');
      }
    }

    // Supprimer de la base de données
    const result = db.prepare(`
      DELETE FROM youtube_subscriptions
      WHERE guild_id = ? AND channel_id = ?
    `).run(interaction.guildId, channelId);

    if (result.changes === 0) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Cette chaîne n\'est pas surveillée sur ce serveur.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('✅ Notification YouTube supprimée')
      .setDescription(`La chaîne **${channelId}** n'est plus surveillée.`);

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleRemove:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de la suppression de la chaîne.');

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
  }
}

function handleList(interaction) {
  try {
    const subscriptions = db.prepare(`
      SELECT channel_id, discord_channel_id, message
      FROM youtube_subscriptions
      WHERE guild_id = ?
    `).all(interaction.guildId);

    if (!subscriptions || subscriptions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Aucune notification YouTube configurée sur ce serveur.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    let description = '**Chaînes surveillées:**\n\n';
    subscriptions.forEach((sub, index) => {
      description += `${index + 1}. **${sub.channel_id}**\n`;
      description += `   Canal: <#${sub.discord_channel_id}>\n`;
      description += `   Message: ${sub.message}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('📺 Notifications YouTube')
      .setDescription(description)
      .setFooter({
        text: `Total: ${subscriptions.length} chaîne(s)`
      });

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleList:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de la récupération de la liste.');

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
  }
}
