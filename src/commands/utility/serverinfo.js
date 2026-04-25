const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

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


module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('📊 Affiche les informations du serveur'),
  cooldown: 10,

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();
    const cfg   = db.getConfig(guild.id);

    const bots    = guild.members.cache.filter(m => m.user.bot).size;
    const humans  = guild.memberCount - bots;
    const roles   = guild.roles.cache.size - 1;
    const emojis  = guild.emojis.cache.size;
    const stickers = guild.stickers.cache.size;
    const channels = guild.channels.cache.size;
    const boosts   = guild.premiumSubscriptionCount || 0;
    const tier     = guild.premiumTier;

    const verif = {
      0: 'Aucune',
      1: 'Faible',
      2: 'Moyenne',
      3: 'Élevée',
      4: 'Très élevée',
    }[guild.verificationLevel] || '?';

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setDescription(guild.description || '*Pas de description*')
      .addFields(
        { name: '👑 Propriétaire',     value: `<@${guild.ownerId}>`,        inline: true },
        { name: '🆔 ID',               value: `\`${guild.id}\``,            inline: true },
        { name: '📅 Créé le',          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Membres',          value: `**${humans}** 👤 + **${bots}** 🤖 = **${guild.memberCount}**`, inline: true },
        { name: '📁 Salons',           value: `**${channels}**`,            inline: true },
        { name: '🎭 Rôles',            value: `**${roles}**`,               inline: true },
        { name: '😀 Emojis',           value: `**${emojis}**`,              inline: true },
        { name: '🎁 Boosts',           value: `**${boosts}** (Niveau ${tier})`, inline: true },
        { name: '🔒 Vérification',     value: verif,                        inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }))
      .setFooter({ text: `NexusBot • ${guild.name}` })
      .setTimestamp();

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  },
  name: 'serverinfo',
  aliases: ["servinfo", "infoserveur"],
    async run(message, args) {
    const fake = mkFake(message, {});
    await this.execute(fake);
  },
};
