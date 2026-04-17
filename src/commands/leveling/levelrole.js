const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelrole')
    .setDescription('🎭 Gérer les rôles automatiques par niveau')
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Assigner un rôle à un niveau')
      .addIntegerOption(o => o.setName('niveau').setDescription('Niveau requis').setRequired(true).setMinValue(1).setMaxValue(500))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer').setDescription('➖ Supprimer un level role')
      .addIntegerOption(o => o.setName('niveau').setDescription('Niveau du rôle à supprimer').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les level roles'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles))
      return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const sub = interaction.options.getSubcommand();

    if (sub === 'ajouter') {
      const niveau = interaction.options.getInteger('niveau');
      const role   = interaction.options.getRole('role');

      if (role.managed) return interaction.reply({ content: '❌ Ce rôle est géré par une intégration externe.', ephemeral: true });
      if (role.id === interaction.guild.id) return interaction.reply({ content: '❌ Tu ne peux pas utiliser le rôle @everyone.', ephemeral: true });

      db.db.prepare(`
        INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)
        ON CONFLICT(guild_id, level) DO UPDATE SET role_id = ?
      `).run(interaction.guildId, niveau, role.id, role.id);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Level Role Ajouté')
          .setDescription(`Le rôle ${role} sera attribué automatiquement aux membres atteignant le **niveau ${niveau}** !`)
        ]
      });
    }

    if (sub === 'supprimer') {
      const niveau = interaction.options.getInteger('niveau');
      const lr = db.db.prepare('SELECT * FROM level_roles WHERE guild_id = ? AND level = ?').get(interaction.guildId, niveau);
      if (!lr) return interaction.reply({ content: `❌ Aucun level role configuré pour le niveau ${niveau}.`, ephemeral: true });

      db.db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(interaction.guildId, niveau);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`🗑️ Level role du niveau **${niveau}** supprimé.`)]
      });
    }

    if (sub === 'liste') {
      const roles = db.getLevelRoles(interaction.guildId);
      if (!roles.length)
        return interaction.reply({ content: '❌ Aucun level role configuré sur ce serveur.', ephemeral: true });

      const list = roles.map(lr => `**Niveau ${lr.level}** → <@&${lr.role_id}>`).join('\n');
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🎭 Level Roles')
          .setDescription(list)
          .setFooter({ text: `${roles.length} level role${roles.length > 1 ? 's' : ''} configuré${roles.length > 1 ? 's' : ''}` })
        ]
      });
    }
  }
};
