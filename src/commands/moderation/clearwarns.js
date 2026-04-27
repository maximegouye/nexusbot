const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('🧹 Effacer les avertissements d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(o => o.setName('warn_id').setDescription('ID du warn à supprimer (optionnel, sinon supprime tous)').setMinValue(1).setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    try {
    const target  = interaction.options.getUser('membre');
    const warnId  = interaction.options.getInteger('warn_id');

    if (warnId) {
      const result = db.db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ? AND user_id = ?')
        .run(warnId, interaction.guildId, target.id);
      if (result.changes === 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Warn #${warnId} introuvable pour ce membre.`, ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Avertissement **#${warnId}** supprimé pour **${target.username}**.`)] });
    }

    const count = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(interaction.guildId, target.id).c;
    db.db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(interaction.guildId, target.id);

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${count} avertissement${count > 1 ? 's' : ''}** effacé${count > 1 ? 's' : ''} pour **${target.username}**.`)
      ]
    });
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
