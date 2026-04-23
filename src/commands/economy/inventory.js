const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('🎒 Affiche ton inventaire')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const target = interaction.options.getUser('membre') || interaction.user;
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';

    const items = db.db.prepare(`
      SELECT i.quantity, i.expires_at, s.name, s.emoji, s.description, s.role_id
      FROM inventory i
      JOIN shop s ON i.item_id = s.id
      WHERE i.user_id = ? AND i.guild_id = ? AND i.quantity > 0
      ORDER BY s.name
    `).all(target.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`🎒 Inventaire de ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 128 }));

    if (!items.length) {
      embed.setDescription('L\'inventaire est vide.\nAchète des articles avec **/buy** !');
    } else {
      const now = Math.floor(Date.now() / 1000);
      let desc = '';
      for (const item of items) {
        const expStr = item.expires_at
          ? (item.expires_at < now ? ' *(expiré)*' : ` *(expire <t:${item.expires_at}:R>)*`)
          : '';
        desc += `${item.emoji || '📦'} **${item.name}** ×${item.quantity}${expStr}\n`;
        if (item.description) desc += `  ╰ *${item.description}*\n`;
      }
      embed.setDescription(desc);
      embed.setFooter({ text: `${items.length} type${items.length > 1 ? 's' : ''} d'article` });
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
