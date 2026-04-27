const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS xp_multipliers (
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    multiplier REAL NOT NULL,
    PRIMARY KEY (guild_id, role_id)
  )
`).run();

// Fonction d'export pour obtenir le multiplicateur maximal pour un membre
// Usage: getMultiplier(guildId, memberRoles) -> number
function getMultiplier(guildId, memberRoles) {
  if (!Array.isArray(memberRoles) || memberRoles.length === 0) {
    return 1.0;
  }

  const multipliers = db.db.prepare(
    'SELECT multiplier FROM xp_multipliers WHERE guild_id = ? AND role_id IN (' +
    memberRoles.map(() => '?').join(',') + ')'
  ).all(guildId, ...memberRoles);

  if (multipliers.length === 0) {
    return 1.0;
  }

  // Retourner le multiplicateur maximal
  return Math.max(...multipliers.map(m => m.multiplier));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpmult')
    .setDescription('⭐ Configurar le multiplicateur de XP par rôle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('definir')
      .setDescription('Définir un multiplicateur pour un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à configurer').setRequired(true))
      .addNumberOption(o => o.setName('multiplicateur').setDescription('Multiplicateur (1.0 - 10.0)').setRequired(true).setMinValue(1.0).setMaxValue(10.0)))
    .addSubcommand(s => s.setName('retirer')
      .setDescription('Retirer le multiplicateur d\'un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir les multiplicateurs configurés')),
  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'definir') {
      const role = interaction.options.getRole('role');
      const mult = interaction.options.getNumber('multiplicateur');

      try {
        db.db.prepare(
          'INSERT OR REPLACE INTO xp_multipliers (guild_id, role_id, multiplier) VALUES (?, ?, ?)'
        ).run(interaction.guildId, role.id, mult);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('⭐ Multiplicateur Défini')
          .setDescription(`<@&${role.id}> : **×${mult}** XP`);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        console.error('Erreur xpmult definir:', err);
        return interaction.reply({ content: '❌ Erreur lors de la configuration.', ephemeral: true });
      }
    }

    if (sub === 'retirer') {
      const role = interaction.options.getRole('role');

      const result = db.db.prepare(
        'DELETE FROM xp_multipliers WHERE guild_id = ? AND role_id = ?'
      ).run(interaction.guildId, role.id);

      if (result.changes === 0) {
        return interaction.reply({ content: '❌ Ce rôle n\'a pas de multiplicateur configuré.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('⭐ Multiplicateur Retiré')
        .setDescription(`<@&${role.id}> n'a plus de bonus XP`);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'liste') {
      const multipliers = db.db.prepare(
        'SELECT * FROM xp_multipliers WHERE guild_id = ? ORDER BY multiplier DESC'
      ).all(interaction.guildId);

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⭐ Multiplicateurs XP');

      if (multipliers.length > 0) {
        const fields = multipliers.map(m => ({
          name: `<@&${m.role_id}>`,
          value: `**×${m.multiplier}**`,
          inline: true
        }));
        embed.addFields(...fields);
      } else {
        embed.setDescription('Aucun multiplicateur configuré.');
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
};

// Export de la fonction
module.exports.getMultiplier = getMultiplier;
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
