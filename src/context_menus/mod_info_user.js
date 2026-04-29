const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('⚠️ Infos Modération')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
      if (!target) return await interaction.editReply('❌ Membre introuvable.');

      const warns = db.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 5').all(interaction.guildId, target.id);
      const cases = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?').get(interaction.guildId, target.id);

      const embed = new EmbedBuilder()
        .setColor(warns.length > 2 ? 'Red' : warns.length > 0 ? 'Orange' : 'Green')
        .setTitle(`⚠️ Dossier modération — ${target.displayName}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '🆔 ID', value: target.id, inline: true },
          { name: '📅 Rejoint le', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: '📋 Total avertissements', value: `**${cases?.c ?? 0}**`, inline: true },
          { name: '🔇 Timeout actif', value: target.communicationDisabledUntil ? `<t:${Math.floor(target.communicationDisabledUntilTimestamp / 1000)}:R>` : 'Non', inline: true },
          { name: '🚨 5 derniers warns', value: warns.length
            ? warns.map(w => `• ${w.reason} *(par <@${w.mod_id}>)*`).join('\n')
            : '✅ Aucun avertissement', inline: false },
        )
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[mod_info_user.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply(msg);
      } catch {}
    }
  }
};
