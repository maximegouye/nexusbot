/**
 * NexusBot — /panel
 * Lance le panneau de configuration interactif (équivalent de &config)
 */
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildMainMenu } = require('../../utils/configPanel');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Ouvrir le panneau de configuration interactif du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 5,

  async execute(interaction, client) {
    const db  = require('../../database/db');
    const cfg = db.getConfig(interaction.guildId);

    const panel = buildMainMenu(cfg, interaction.guild, interaction.user.id);

    return interaction.reply({ ...panel, ephemeral: true });
  },
};
