const { ContextMenuCommandBuilder, ApplicationCommandType, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('💰 Économie du membre')
    .setType(ApplicationCommandType.User),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const target = interaction.targetMember || await interaction.guild.members.fetch(interaction.targetId).catch(() => null);
      if (!target) return await interaction.editReply('❌ Membre introuvable.');

      const u = db.getUser(target.id, interaction.guildId);
      const cfg = db.getConfig(interaction.guildId);
      const currency = cfg.currency_name || '€';
      const emoji = cfg.currency_emoji || '€';

      const rank = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND (balance + bank) > ?').get(interaction.guildId, u.balance + u.bank)?.c ?? 0;

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`💰 Économie — ${target.displayName}`)
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
          { name: '👛 Portefeuille', value: `**${u.balance.toLocaleString('fr-FR')}** ${emoji}`, inline: true },
          { name: '🏦 Banque', value: `**${u.bank.toLocaleString('fr-FR')}** ${emoji}`, inline: true },
          { name: '💎 Total', value: `**${(u.balance + u.bank).toLocaleString('fr-FR')}** ${emoji}`, inline: true },
          { name: '🏆 Classement', value: `**#${rank + 1}**`, inline: true },
        )
        .setFooter({ text: `Monnaie: ${currency}` })
        .setTimestamp();

      return await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[economie_user.js] execute error:', err?.message || err);
      try {
        const msg = { content: `❌ Erreur: ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
        else await interaction.reply(msg);
      } catch {}
    }
  }
};
