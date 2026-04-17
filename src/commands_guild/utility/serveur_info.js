const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serveur')
    .setDescription('🏠 Informations détaillées sur le serveur')
    .addSubcommand(s => s.setName('info').setDescription('📋 Voir les informations du serveur'))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques d\'activité'))
    .addSubcommand(s => s.setName('roles').setDescription('🎭 Liste des rôles du serveur'))
    .addSubcommand(s => s.setName('emojis').setDescription('😀 Emojis personnalisés du serveur'))
    .addSubcommand(s => s.setName('boosts').setDescription('💎 Informations sur les boosts Nitro')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    await guild.members.fetch();

    if (sub === 'info') {
      const owner = await guild.fetchOwner();
      const createdAt = Math.floor(guild.createdAt.getTime() / 1000);
      const verif = ['Aucune', 'Faible', 'Moyenne', 'Élevée', 'Très élevée'];

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🏠 ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Propriétaire', value: `${owner.user}`, inline: true },
          { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
          { name: '📅 Créé le', value: `<t:${createdAt}:D>`, inline: true },
          { name: '👥 Membres', value: `**${guild.memberCount}**`, inline: true },
          { name: '🤖 Bots', value: `**${guild.members.cache.filter(m => m.user.bot).size}**`, inline: true },
          { name: '💬 Salons', value: `**${guild.channels.cache.size}** (texte: ${guild.channels.cache.filter(c => c.type === 0).size}, vocal: ${guild.channels.cache.filter(c => c.type === 2).size})`, inline: true },
          { name: '🎭 Rôles', value: `**${guild.roles.cache.size}**`, inline: true },
          { name: '😀 Emojis', value: `**${guild.emojis.cache.size}**`, inline: true },
          { name: '🛡️ Vérification', value: verif[guild.verificationLevel] || '?', inline: true },
          { name: '💎 Nitro', value: `Niv.**${guild.premiumTier}** | **${guild.premiumSubscriptionCount || 0}** boost(s)`, inline: true },
        );

      if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'stats') {
      const members = guild.members.cache;
      const online = members.filter(m => m.presence?.status === 'online').size;
      const idle = members.filter(m => m.presence?.status === 'idle').size;
      const dnd = members.filter(m => m.presence?.status === 'dnd').size;
      const offline = guild.memberCount - online - idle - dnd;

      const cfg = db.getConfig(guild.id);
      const coin = cfg.currency_emoji || '🪙';

      // Stats de la base de données
      const dbStats = db.db.prepare('SELECT COUNT(*) as users, SUM(messages) as msgs, SUM(balance) as coins FROM users WHERE guild_id=?').get(guild.id);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle(`📊 Stats — ${guild.name}`)
          .addFields(
            { name: '🟢 En ligne', value: `**${online}**`, inline: true },
            { name: '🟡 Absent', value: `**${idle}**`, inline: true },
            { name: '🔴 Ne pas déranger', value: `**${dnd}**`, inline: true },
            { name: '⚫ Hors ligne', value: `**${offline}**`, inline: true },
            { name: '👤 Total membres', value: `**${guild.memberCount}**`, inline: true },
            { name: '💬 Messages (DB)', value: `**${dbStats.msgs || 0}**`, inline: true },
            { name: `${coin} Coins en circulation`, value: `**${dbStats.coins || 0}**`, inline: true },
          )
      ]});
    }

    if (sub === 'roles') {
      const roles = guild.roles.cache.filter(r => r.id !== guild.id).sort((a, b) => b.position - a.position);
      const lines = roles.map(r => `${r} — ${r.members.size} membre(s)`).slice(0, 25).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle(`🎭 Rôles de ${guild.name} (${roles.size})`)
          .setDescription(lines || 'Aucun rôle')
          .setFooter({ text: roles.size > 25 ? `Affichage des 25 premiers sur ${roles.size}` : '' })
      ], ephemeral: true });
    }

    if (sub === 'emojis') {
      const emojis = guild.emojis.cache;
      if (!emojis.size) return interaction.reply({ content: '❌ Aucun emoji personnalisé.', ephemeral: true });
      const lines = emojis.map(e => `${e} \`${e.name}\``).slice(0, 40).join(' ');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`😀 Emojis de ${guild.name} (${emojis.size})`)
          .setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'boosts') {
      const boostLevels = {
        0: { label: 'Aucun (Niv.0)', emoji: '⚪', perks: 'Aucun avantage' },
        1: { label: 'Niveau 1', emoji: '🟣', perks: '50 emojis, stream 720p60, son 128kbps' },
        2: { label: 'Niveau 2', emoji: '🔵', perks: '100 emojis, stream 1080p60, son 256kbps' },
        3: { label: 'Niveau 3', emoji: '💎', perks: '250 emojis, stream 4K, son 384kbps' },
      };
      const level = guild.premiumTier;
      const info = boostLevels[level] || boostLevels[0];

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#FF73FA').setTitle(`💎 Boosts Nitro — ${guild.name}`)
          .addFields(
            { name: '🏆 Niveau', value: `${info.emoji} **${info.label}**`, inline: true },
            { name: '💎 Boosts', value: `**${guild.premiumSubscriptionCount || 0}** / ${[0,2,7,14][level]} requis pour niveau suivant`, inline: true },
            { name: '🎁 Avantages', value: info.perks, inline: false },
          )
      ]});
    }
  }
};
