const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Cache en mémoire pour les messages supprimés/édités
const snipeCache    = new Map(); // channelId → { content, author, timestamp }
const editSnipeCache = new Map(); // channelId → { old, new, author, timestamp }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('🔍 Voir le dernier message supprimé dans ce salon'),
  cooldown: 5,

  execute: async (interaction) => {
    const cached = snipeCache.get(interaction.channelId);
    if (!cached) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#888888').setDescription('🔍 Aucun message supprimé récemment dans ce salon.')],
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🔍 Dernier message supprimé')
      .setDescription(cached.content || '*[Pas de texte]*')
      .setAuthor({ name: cached.authorTag, iconURL: cached.avatarURL })
      .setFooter({ text: `Supprimé` })
      .setTimestamp(cached.timestamp);

    await interaction.editReply({ embeds: [embed] });
  },

  // Méthode statique pour stocker depuis l'event messageDelete
  store: (message) => {
    if (message.author?.bot) return;
    snipeCache.set(message.channelId, {
      content:    message.content || null,
      authorTag:  message.author?.tag || 'Inconnu',
      avatarURL:  message.author?.displayAvatarURL(),
      timestamp:  Date.now(),
    });
    // Expirer après 5 minutes
    setTimeout(() => {
      const current = snipeCache.get(message.channelId);
      if (current?.timestamp === snipeCache.get(message.channelId)?.timestamp) {
        snipeCache.delete(message.channelId);
      }
    }, 300000);
  },

  storeEdit: (oldMsg, newMsg) => {
    if (oldMsg.author?.bot) return;
    editSnipeCache.set(oldMsg.channelId, {
      oldContent:  oldMsg.content,
      newContent:  newMsg.content,
      authorTag:   oldMsg.author?.tag,
      avatarURL:   oldMsg.author?.displayAvatarURL(),
      timestamp:   Date.now(),
    });
  },

  getEditCache: () => editSnipeCache,
};
