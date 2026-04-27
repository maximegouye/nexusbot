const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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
    .setName('avatar')
    .setDescription('🖼️ Afficher l\'avatar d\'un membre en HD')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(false)),

  async execute(interaction) {
    try {
    const target = interaction.options.getMember('membre') || interaction.member;
    const user   = target.user || target;

    const globalAvatar = user.displayAvatarURL({ size: 4096, extension: 'png', forceStatic: false });
    const serverAvatar = target.displayAvatarURL?.({ size: 4096, extension: 'png', forceStatic: false });
    const banner = await user.fetch().then(u => u.bannerURL({ size: 4096 })).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle(`🖼️ Avatar de ${user.username}`)
      .setImage(serverAvatar || globalAvatar)
      .addFields(
        { name: '📎 PNG', value: `[Télécharger](${globalAvatar?.replace('.gif', '.png')})`, inline: true },
        { name: '📎 WebP', value: `[Télécharger](${globalAvatar?.replace('.png', '.webp')})`, inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Avatar global')
        .setStyle(ButtonStyle.Link)
        .setURL(globalAvatar),
    );

    if (serverAvatar && serverAvatar !== globalAvatar) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Avatar serveur')
          .setStyle(ButtonStyle.Link)
          .setURL(serverAvatar)
      );
    }
    if (banner) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Bannière')
          .setStyle(ButtonStyle.Link)
          .setURL(banner)
      );
    }

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: [row] });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }},
  name: 'avatar',
  aliases: ["pfp", "pp"],
    async run(message, args) {
    const target = message.mentions.members?.first() || message.member;
    const fake = mkFake(message, { getMember: () => target });
    await this.execute(fake);
  },
};
