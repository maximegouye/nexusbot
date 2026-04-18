/**
 * NexusBot — /config
 * UNIFIÉ avec &config : ouvre le MÊME panneau interactif.
 *
 * Le panneau est totalement libre : tout se configure depuis Discord,
 * avec navigation (boutons, menus, sous-menus, modals).
 *
 * Voir : src/utils/configPanel.js
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const { buildMainMenu } = require('../../utils/configPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Ouvrir le panneau de configuration complet de NexusBot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ Tu dois avoir la permission **Gérer le serveur** pour accéder à la configuration.',
        ephemeral: true,
      });
    }

    const cfg   = db.getConfig(interaction.guildId);
    const panel = buildMainMenu(cfg, interaction.guild, interaction.user.id);

    return interaction.reply({ ...panel, ephemeral: true });
  },
};
