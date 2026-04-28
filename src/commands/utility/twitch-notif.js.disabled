const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { db } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('twitch-notif')
    .setDescription('Configure les notifications Twitch')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Ajoute un streamer Twitch à surveiller')
        .addStringOption(option =>
          option.setName('login')
            .setDescription('Nom de connexion ou URL du streamer Twitch')
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
        .setDescription('Supprime un streamer Twitch de la surveillance')
        .addStringOption(option =>
          option.setName('login')
            .setDescription('Nom de connexion ou URL du streamer')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('Liste tous les streamers surveillés')
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

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
      console.error('Erreur dans la commande twitch-notif:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du traitement de votre demande.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

function handleAdd(interaction) {
  try {
    const input = interaction.options.getString('login').trim();
    const channel = interaction.options.getChannel('channel');
    const customMessage = interaction.options.getString('message') || 'Le streamer est en direct!';

    // Extraire le nom d'utilisateur à partir de l'URL ou utiliser directement
    let login = input;
    if (input.includes('twitch.tv')) {
      const match = input.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (match) {
        login = match[1];
      }
    }

    login = login.toLowerCase();

    // Stocker dans la base de données
    try {
      db.db.prepare(`
        INSERT INTO twitch_subscriptions (guild_id, streamer_login, discord_channel_id, message, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(interaction.guildId, login, channel.id, customMessage, new Date().toISOString());
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        const errorEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription('❌ Ce streamer est déjà surveillé sur ce serveur.');

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
      }
      throw error;
    }

    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle('✅ Notification Twitch ajoutée')
      .addFields(
        {
          name: 'Streamer',
          value: login
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
      .setDescription('❌ Une erreur est survenue lors de l\'ajout du streamer.');

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
  }
}

function handleRemove(interaction) {
  try {
    const input = interaction.options.getString('login').trim();

    // Extraire le nom d'utilisateur
    let login = input;
    if (input.includes('twitch.tv')) {
      const match = input.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
      if (match) {
        login = match[1];
      }
    }

    login = login.toLowerCase();

    // Supprimer de la base de données
    const result = db.db.prepare(`
      DELETE FROM twitch_subscriptions
      WHERE guild_id = ? AND streamer_login = ?
    `).run(interaction.guildId, login);

    if (result.changes === 0) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Ce streamer n\'est pas surveillé sur ce serveur.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('✅ Notification Twitch supprimée')
      .setDescription(`Le streamer **${login}** n'est plus surveillé.`);

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleRemove:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de la suppression du streamer.');

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [errorEmbed], ephemeral: true });
  }
}

function handleList(interaction) {
  try {
    const subscriptions = db.db.prepare(`
      SELECT streamer_login, discord_channel_id, message
      FROM twitch_subscriptions
      WHERE guild_id = ?
    `).all(interaction.guildId);

    if (!subscriptions || subscriptions.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Aucune notification Twitch configurée sur ce serveur.');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    let description = '**Streamers surveillés:**\n\n';
    subscriptions.forEach((sub, index) => {
      description += `${index + 1}. **${sub.streamer_login}**\n`;
      description += `   Canal: <#${sub.discord_channel_id}>\n`;
      description += `   Message: ${sub.message}\n\n`;
    });

    const embed = new EmbedBuilder()
      .setColor('#9146FF')
      .setTitle('🎮 Notifications Twitch')
      .setDescription(description)
      .setFooter({
        text: `Total: ${subscriptions.length} streamer(s)`
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
