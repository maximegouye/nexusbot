const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('🛠️ Définir le niveau d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(o => o.setName('niveau').setDescription('Nouveau niveau').setMinValue(1).setRequired(true)),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }); } catch (e) { /* already ack'd */ }
    }

    try {
    const target = interaction.options.getUser('membre');
    const level  = interaction.options.getInteger('niveau');
    const xp     = Math.floor(100 * Math.pow(1.35, level - 1));

    db.db.prepare('UPDATE users SET level = ?, xp = ? WHERE user_id = ? AND guild_id = ?')
      .run(level, xp, target.id, interaction.guildId);

    await (interaction.deferred||interaction.replied ? interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${target.username}** est maintenant niveau **${level}** (${xp.toLocaleString('fr-FR')} XP).`)
      ]
    }) : interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${target.username}** est maintenant niveau **${level}** (${xp.toLocaleString('fr-FR')} XP).`)
      ]
    }));
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
  }}
};
