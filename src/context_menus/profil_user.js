const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('👤 Voir le Profil')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
    if (!target) return interaction.editReply('❌ Membre introuvable.');

    const u = db.getUser(target.id, interaction.guildId);
    const level = db.getLevel(u.xp);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle(`👤 Profil de ${target.displayName}`)
      .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '📊 Niveau', value: `**${level}**`, inline: true },
        { name: '⭐ XP', value: `**${u.xp.toLocaleString('fr')}**`, inline: true },
        { name: '💰 Balance', value: `**${(u.balance + u.bank).toLocaleString('fr')}** 🪙`, inline: true },
        { name: '💬 Messages', value: `**${(u.message_count || 0).toLocaleString('fr')}**`, inline: true },
        { name: '🎙️ Vocal', value: `**${u.voice_minutes || 0}** min`, inline: true },
        { name: '👍 Réputation', value: `**${u.reputation || 0}**`, inline: true },
      )
      .setFooter({ text: `ID: ${target.id}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
