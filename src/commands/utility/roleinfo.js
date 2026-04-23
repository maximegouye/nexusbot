const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('🎭 Informations détaillées sur un rôle')
    .addRoleOption(o => o.setName('role').setDescription('Le rôle').setRequired(true)),

  async execute(interaction) {
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
  }
};
