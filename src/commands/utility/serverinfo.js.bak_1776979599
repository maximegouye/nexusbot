const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('📊 Affiche les informations du serveur'),
  cooldown: 10,

  async execute(interaction) {
    const guild = interaction.guild;
    await guild.fetch();
    const cfg   = db.getConfig(guild.id);

    const bots    = guild.members.cache.filter(m => m.user.bot).size;
    const humans  = guild.memberCount - bots;
    const roles   = guild.roles.cache.size - 1;
    const emojis  = guild.emojis.cache.size;
    const stickers = guild.stickers.cache.size;
    const channels = guild.channels.cache.size;
    const boosts   = guild.premiumSubscriptionCount || 0;
    const tier     = guild.premiumTier;

    const verif = {
      0: 'Aucune',
      1: 'Faible',
      2: 'Moyenne',
      3: 'Élevée',
      4: 'Très élevée',
    }[guild.verificationLevel] || '?';

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setDescription(guild.description || '*Pas de description*')
      .addFields(
        { name: '👑 Propriétaire',     value: `<@${guild.ownerId}>`,        inline: true },
        { name: '🆔 ID',               value: `\`${guild.id}\``,            inline: true },
        { name: '📅 Créé le',          value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '👥 Membres',          value: `**${humans}** 👤 + **${bots}** 🤖 = **${guild.memberCount}**`, inline: true },
        { name: '📁 Salons',           value: `**${channels}**`,            inline: true },
        { name: '🎭 Rôles',            value: `**${roles}**`,               inline: true },
        { name: '😀 Emojis',           value: `**${emojis}**`,              inline: true },
        { name: '🎁 Boosts',           value: `**${boosts}** (Niveau ${tier})`, inline: true },
        { name: '🔒 Vérification',     value: verif,                        inline: true },
      )
      .setImage(guild.bannerURL({ size: 1024 }))
      .setFooter({ text: `NexusBot • ${guild.name}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
