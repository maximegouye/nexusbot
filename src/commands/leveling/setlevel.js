const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('🛠️ Définir le niveau d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
  cooldown: 3,

  async execute(interaction) {
    const target = interaction.options.getUser('membre');
    const level  = parseInt(interaction.options.getString('niveau'));
    const xp     = Math.floor(100 * Math.pow(1.35, level - 1));

    db.db.prepare('UPDATE users SET level = ?, xp = ? WHERE user_id = ? AND guild_id = ?')
      .run(level, xp, target.id, interaction.guildId);

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${target.username}** est maintenant niveau **${level}** (${xp.toLocaleString('fr-FR')} XP).`)
      ]
    });
  }
};
