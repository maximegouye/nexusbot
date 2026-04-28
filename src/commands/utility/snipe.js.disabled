const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


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
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
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

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
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

  // Accès direct au cache (utilisé par le handler prefix &snipe)
  get: (channelId) => snipeCache.get(channelId),

  name: 'snipe',
  aliases: ['snipe2'],
  async run(message, args) {
    const fake = mkFake(message, {});
    await this.execute(fake);
  },
};
;
