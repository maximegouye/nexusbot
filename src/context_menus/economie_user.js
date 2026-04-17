const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('💰 Économie du membre')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
    if (!target) return interaction.editReply('❌ Membre introuvable.');

    const u = db.getUser(target.id, interaction.guildId);
    const cfg = db.getConfig(interaction.guildId);
    const currency = cfg.currency_name || 'Coins';
    const emoji = cfg.currency_emoji || '🪙';

    const rank = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND (balance + bank) > ?').get(interaction.guildId, u.balance + u.bank)?.c ?? 0;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 Économie — ${target.displayName}`)
      .setThumbnail(target.user.displayAvatarURL())
      .addFields(
        { name: '👛 Portefeuille', value: `**${u.balance.toLocaleString('fr')}** ${emoji}`, inline: true },
        { name: '🏦 Banque', value: `**${u.bank.toLocaleString('fr')}** ${emoji}`, inline: true },
        { name: '💎 Total', value: `**${(u.balance + u.bank).toLocaleString('fr')}** ${emoji}`, inline: true },
        { name: '🏆 Classement', value: `**#${rank + 1}**`, inline: true },
      )
      .setFooter({ text: `Monnaie: ${currency}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
