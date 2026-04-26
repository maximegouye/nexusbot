const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('🛒 Affiche la boutique du serveur'),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg   = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';

    const items = db.db.prepare('SELECT * FROM shop WHERE guild_id = ? AND active = 1 ORDER BY price ASC').all(interaction.guildId);

    if (!items.length) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle('🛒 Boutique')
          .setDescription('La boutique est vide pour l\'instant.\nUn admin peut ajouter des articles avec `/additem`.')
        ], ephemeral: true
      });
    }

    const guild = interaction.guild;
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const PAGE_SIZE = 8;
    const pages = Math.ceil(items.length / PAGE_SIZE);
    let page = 0;

    const buildEmbed = (p) => {
      const slice = items.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`🛒 Boutique — ${guild?.name || 'Serveur'}`)
        .setDescription(`Ton solde : **${user.balance.toLocaleString('fr-FR')} ${name}** ${emoji}\nUtilise **/buy <id>** pour acheter.`)
        .setFooter({ text: `Page ${p + 1}/${pages} • ${items.length} article${items.length > 1 ? 's' : ''}` });

      for (const item of slice) {
        const roleTag = item.role_id ? ` → <@&${item.role_id}>` : '';
        const duration = item.duration_hours ? ` *(${item.duration_hours}h)*` : '';
        embed.addFields({
          name: `#${item.id} ${item.emoji || '📦'} ${item.name}`,
          value: `${item.description || '*Pas de description*'}\n💰 **${item.price.toLocaleString('fr-FR')} ${name}**${roleTag}${duration}`,
          inline: false,
        });
      }
      return embed;
    };

    const buildRow = (p) => {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('shop_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId('shop_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1),
      );
    };

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildEmbed(0)], components: pages > 1 ? [buildRow(0)] : [], fetchReply: true });

    if (pages <= 1) return;

    const collector = msg.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'Cette boutique ne t\'appartient pas.', ephemeral: true });
      }
      if (i.customId === 'shop_prev') page = Math.max(0, page - 1);
      if (i.customId === 'shop_next') page = Math.min(pages - 1, page + 1);
      await i.update({ embeds: [buildEmbed(page)], components: [buildRow(page)] });
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};
