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
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: '❌ Tu dois avoir la permission **Gérer le serveur** pour accéder à la configuration.',
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: '❌ Tu dois avoir la permission **Gérer le serveur** pour accéder à la configuration.',
          ephemeral: true,
        });
      }
    }

    const cfg   = db.getConfig(interaction.guildId);
    const panel = buildMainMenu(cfg, interaction.guild, interaction.user.id);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ ...panel, ephemeral: true });
    } else {
      return interaction.reply({ ...panel, ephemeral: true });
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
    }
  },
};
