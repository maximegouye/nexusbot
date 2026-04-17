const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('📊 Niveau & XP')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
    if (!target) return interaction.editReply('❌ Membre introuvable.');

    const u = db.getUser(target.id, interaction.guildId);
    const level = db.getLevel(u.xp);
    const nextXP = db.getXPForLevel(level + 1);
    const currXP = db.getXPForLevel(level);
    const progress = Math.floor(((u.xp - currXP) / (nextXP - currXP)) * 20);
    const bar = '█'.repeat(Math.max(0, progress)) + '░'.repeat(Math.max(0, 20 - progress));

    const rank = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND xp > ?').get(interaction.guildId, u.xp)?.c ?? 0;

    return interaction.editReply({ embeds: [
      new EmbedBuilder()
        .setColor('#00D4FF')
        .setTitle(`📊 Niveau — ${target.displayName}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '🏆 Niveau', value: `**${level}**`, inline: true },
          { name: '⭐ XP total', value: `**${u.xp.toLocaleString('fr')}**`, inline: true },
          { name: '🎯 Classement', value: `**#${rank + 1}**`, inline: true },
          { name: `Progression → Niv. ${level + 1}`, value: `\`[${bar}]\`\n${(u.xp - currXP).toLocaleString('fr')} / ${(nextXP - currXP).toLocaleString('fr')} XP`, inline: false },
        )
        .setTimestamp()
    ]});
  }
};
