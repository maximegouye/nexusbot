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

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ ...panel, ephemeral: true });
    } else {
      return interaction.reply({ ...panel, ephemeral: true });
    }
  },
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
