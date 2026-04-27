const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('🔇 Timeout 10min')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
      if (!target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('❌ Membre introuvable.');
      if (!target.moderatable) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('❌ Je ne peux pas mettre ce membre en timeout.');

      try {
        const duration = 10 * 60 * 1000; // 10 minutes
        await target.timeout(duration, `Timeout rapide par ${interaction.user.username}`);

        // Log dans la DB
        try {
          db.db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason, type) VALUES (?,?,?,?,?)')
            .run(interaction.guildId, target.id, interaction.user.id, 'Timeout rapide 10min (menu contextuel)', 'timeout');
        } catch {}

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('Orange')
            .setTitle('🔇 Timeout appliqué')
            .setDescription(`<@${target.id}> est en timeout pour **10 minutes**.`)
            .addFields({ name: '👮 Modérateur', value: `<@${interaction.user.id}>`, inline: true })
            .setTimestamp()
        ]});
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(`❌ Erreur : ${e.message}`);
      }
    } catch (err) {
      console.error('[muter_user.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.editReply(msg);
      } catch {}
    }
  }
};
