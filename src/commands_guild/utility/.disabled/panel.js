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
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const db  = require('../../database/db');
    const cfg = db.getConfig(interaction.guildId);

    const panel = buildMainMenu(cfg, interaction.guild, interaction.user.id);

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ ...panel, ephemeral: true });
  },
};
