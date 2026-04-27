const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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
    .setName('roleinfo')
    .setDescription('🎭 Informations détaillées sur un rôle')
    .addRoleOption(o => o.setName('role').setDescription('Le rôle').setRequired(true)),

  async execute(interaction) {
    try {
    const role = interaction.options.getRole('role');
    const memberCount = interaction.guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;

    const permsNames = {
      Administrator: '👑 Administrateur', ManageGuild: '⚙️ Gérer le serveur',
      ManageMessages: '🗑️ Gérer les messages', ManageChannels: '📋 Gérer les salons',
      ManageRoles: '🎭 Gérer les rôles', BanMembers: '🔨 Bannir',
      KickMembers: '👢 Expulser', ModerateMembers: '🔇 Mettre en sourdine',
      MentionEveryone: '📢 Mentionner @everyone', ManageWebhooks: '🪝 Webhooks',
      ViewAuditLog: '📋 Journal d\'audit',
    };

    const perms = Object.entries(permsNames)
      .filter(([p]) => role.permissions.has(p))
      .map(([, name]) => name);

    const embed = new EmbedBuilder()
      .setColor(role.hexColor || '#7B2FBE')
      .setTitle(`🎭 Rôle: ${role.name}`)
      .addFields(
        { name: '🆔 ID', value: `\`${role.id}\``, inline: true },
        { name: '🎨 Couleur', value: role.hexColor || 'Aucune', inline: true },
        { name: '📋 Position', value: `#${role.position}`, inline: true },
        { name: '👥 Membres', value: `${memberCount}`, inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(role.createdTimestamp/1000)}:R>`, inline: true },
        { name: '🤖 Géré par bot', value: role.managed ? 'Oui' : 'Non', inline: true },
        { name: '📢 Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
        { name: '🏷️ Hoisted', value: role.hoist ? 'Oui (affiché séparément)' : 'Non', inline: true },
      );

    if (perms.length) {
      embed.addFields({ name: '🔑 Permissions notables', value: perms.slice(0, 10).join('\n') });
    }

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
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
  name: 'roleinfo',
  aliases: ["inforole"],
    async run(message, args) {
    const role = message.mentions.roles.first() || message.guild.roles.cache.find(r => r.name.toLowerCase() === args[0]?.toLowerCase());
    if (!role) return message.reply('❌ Usage : `&roleinfo @role`');
    const fake = mkFake(message, { getRole: () => role });
    await this.execute(fake);
  },
};
