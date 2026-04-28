const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS no_xp (
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, type, target_id)
  )
`).run();

// Fonction d'export pour être utilisée dans messageCreate.js
// Usage: isNoXP(guildId, channelId, memberRoles) -> boolean
function isNoXP(guildId, channelId, memberRoles) {
  // Vérifier le canal
  const channelCheck = db.db.prepare(
    'SELECT * FROM no_xp WHERE guild_id = ? AND type = ? AND target_id = ?'
  ).get(guildId, 'channel', channelId);

  if (channelCheck) return true;

  // Vérifier les rôles du membre
  if (Array.isArray(memberRoles)) {
    for (const roleId of memberRoles) {
      const roleCheck = db.db.prepare(
        'SELECT * FROM no_xp WHERE guild_id = ? AND type = ? AND target_id = ?'
      ).get(guildId, 'role', roleId);

      if (roleCheck) return true;
    }
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('noxp')
    .setDescription('⛔ Configurer les canaux/rôles sans XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('canal_ajouter')
      .setDescription('Ajouter un canal sans XP')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('canal_retirer')
      .setDescription('Retirer un canal de la liste sans XP')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('role_ajouter')
      .setDescription('Ajouter un rôle sans XP')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)))
    .addSubcommand(s => s.setName('role_retirer')
      .setDescription('Retirer un rôle de la liste sans XP')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir la liste des canaux/rôles sans XP')),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'canal_ajouter') {
      const canal = interaction.options.getChannel('canal');

      try {
        db.db.prepare(
          'INSERT INTO no_xp (guild_id, type, target_id) VALUES (?, ?, ?)'
        ).run(interaction.guildId, 'channel', canal.id);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Canal Ajouté')
          .setDescription(`${canal} n'accordera plus d'XP`);

        return interaction.editReply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        return interaction.editReply({ content: '❌ Ce canal est déjà configuré.', ephemeral: true });
      }
    }

    if (sub === 'canal_retirer') {
      const canal = interaction.options.getChannel('canal');

      const result = db.db.prepare(
        'DELETE FROM no_xp WHERE guild_id = ? AND type = ? AND target_id = ?'
      ).run(interaction.guildId, 'channel', canal.id);

      if (result.changes === 0) {
        return interaction.editReply({ content: '❌ Ce canal n\'est pas configuré.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Canal Retiré')
        .setDescription(`${canal} accordera à nouveau de l'XP`);

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'role_ajouter') {
      const role = interaction.options.getRole('role');

      try {
        db.db.prepare(
          'INSERT INTO no_xp (guild_id, type, target_id) VALUES (?, ?, ?)'
        ).run(interaction.guildId, 'role', role.id);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Rôle Ajouté')
          .setDescription(`Les membres avec <@&${role.id}> n'auront plus d'XP`);

        return interaction.editReply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        return interaction.editReply({ content: '❌ Ce rôle est déjà configuré.', ephemeral: true });
      }
    }

    if (sub === 'role_retirer') {
      const role = interaction.options.getRole('role');

      const result = db.db.prepare(
        'DELETE FROM no_xp WHERE guild_id = ? AND type = ? AND target_id = ?'
      ).run(interaction.guildId, 'role', role.id);

      if (result.changes === 0) {
        return interaction.editReply({ content: '❌ Ce rôle n\'est pas configuré.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Rôle Retiré')
        .setDescription(`Les membres avec <@&${role.id}> auront à nouveau de l'XP`);

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'liste') {
      const canals = db.db.prepare(
        'SELECT * FROM no_xp WHERE guild_id = ? AND type = ?'
      ).all(interaction.guildId, 'channel');

      const roles = db.db.prepare(
        'SELECT * FROM no_xp WHERE guild_id = ? AND type = ?'
      ).all(interaction.guildId, 'role');

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📋 Configuration NoXP');

      if (canals.length > 0) {
        embed.addFields({
          name: '📍 Canaux',
          value: canals.map(c => `<#${c.target_id}>`).join('\n'),
          inline: true
        });
      }

      if (roles.length > 0) {
        embed.addFields({
          name: '🏷️ Rôles',
          value: roles.map(r => `<@&${r.target_id}>`).join('\n'),
          inline: true
        });
      }

      if (canals.length === 0 && roles.length === 0) {
        embed.setDescription('Aucun canal ou rôle configuré actuellement.');
      }

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
  }
};

// Export de la fonction pour messageCreate
module.exports.isNoXP = isNoXP;
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
