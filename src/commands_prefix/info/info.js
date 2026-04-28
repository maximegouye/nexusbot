const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: 'userinfo',
    category: 'Informations',
    aliases: ['ui', 'user', 'profil', 'whois', 'who'],
    description: 'Infos sur un membre',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
      const u = db.getUser(target.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const roles = target.roles.cache.filter(r => r.id !== message.guild.id).sort((a,b) => b.position - a.position).map(r => `<@&${r.id}>`).slice(0, 10).join(' ') || 'Aucun';
      message.reply({ embeds: [new EmbedBuilder().setColor(target.displayHexColor || '#7B2FBE').setTitle(`👤 ${target.user.username}`).setThumbnail(target.user.displayAvatarURL({ size: 256 })).addFields(
        { name: '🆔 ID', value: target.id, inline: true },
        { name: '📅 Compte créé', value: `<t:${Math.floor(target.user.createdTimestamp/1000)}:R>`, inline: true },
        { name: '📥 Rejoint', value: `<t:${Math.floor(target.joinedTimestamp/1000)}:R>`, inline: true },
        { name: '⭐ Niveau', value: `**${u.level||1}** (${u.xp||0} XP)`, inline: true },
        { name: '💰 Solde', value: `**${(u.balance||0)} ${coin}**`, inline: true },
        { name: '🎭 Rôles', value: roles, inline: false },
      ).setTimestamp()] });
    }
  },
  {
    name: 'serverinfo',
    category: 'Informations',
    aliases: ['si', 'server', 'guild', 'serveur'],
    description: 'Infos sur le serveur',
    cooldown: 5,
    async run(message, args, client, db) {
      const g = message.guild;
      await g.members.fetch().catch(() => {});
      const bots = g.members.cache.filter(m => m.user.bot).size;
      const humans = g.memberCount - bots;
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle(`🏠 ${g.name}`).setThumbnail(g.iconURL()).addFields(
        { name: '🆔 ID', value: g.id, inline: true },
        { name: '👑 Propriétaire', value: `<@${g.ownerId}>`, inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(g.createdTimestamp/1000)}:R>`, inline: true },
        { name: '👥 Membres', value: `**${humans}** humains + **${bots}** bots`, inline: true },
        { name: '📋 Salons', value: `**${g.channels.cache.size}**`, inline: true },
        { name: '🎭 Rôles', value: `**${g.roles.cache.size}**`, inline: true },
        { name: '🚀 Boosts', value: `**${g.premiumSubscriptionCount||0}** (Niveau ${g.premiumTier})`, inline: true },
      ).setTimestamp()] });
    }
  },
  {
    name: 'avatar',
    category: 'Informations',
    aliases: ['av', 'pfp', 'photo'],
    description: 'Voir l\'avatar d\'un membre',
    usage: '[@membre]',
    cooldown: 3,
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const url = target.displayAvatarURL({ size: 4096 });
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle(`🖼️ Avatar de ${target.username}`).setImage(url).setDescription(`[PNG](${target.displayAvatarURL({ extension: 'png', size: 4096 })}) | [WebP](${url})`)] });
    }
  },
  {
    name: 'banner',
    category: 'Informations',
    aliases: ['bannière', 'header'],
    description: 'Voir la bannière d\'un utilisateur',
    usage: '[@membre]',
    cooldown: 3,
    async run(message, args, client) {
      const target = message.mentions.users.first() || message.author;
      const fetched = await client.users.fetch(target.id, { force: true });
      const url = fetched.bannerURL({ size: 4096 });
      if (!url) return message.reply(`❌ **${target.username}** n'a pas de bannière.`);
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle(`🖼️ Bannière de ${target.username}`).setImage(url)] });
    }
  },
  {
    name: 'roleinfo',
    category: 'Informations',
    aliases: ['ri', 'role'],
    description: 'Infos sur un rôle',
    usage: '@role',
    cooldown: 5,
    async run(message, args) {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
      if (!role) return message.reply('❌ Mentionnez un rôle valide.');
      message.reply({ embeds: [new EmbedBuilder().setColor(role.hexColor || '#7B2FBE').setTitle(`🎭 ${role.name}`).addFields(
        { name: '🆔 ID', value: role.id, inline: true },
        { name: '🎨 Couleur', value: role.hexColor, inline: true },
        { name: '👥 Membres', value: `**${role.members.size}**`, inline: true },
        { name: '📌 Position', value: `**${role.position}**`, inline: true },
        { name: '🤖 Bot', value: role.managed ? 'Oui' : 'Non', inline: true },
        { name: '🎯 Mentionnable', value: role.mentionable ? 'Oui' : 'Non', inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(role.createdTimestamp/1000)}:R>`, inline: true },
      ).setTimestamp()] });
    }
  },
  {
    name: 'botinfo',
    category: 'Informations',
    aliases: ['bot', 'stats', 'about', 'nexus'],
    description: 'Infos sur NexusBot',
    cooldown: 5,
    async run(message, args, client) {
      const uptime = process.uptime();
      const d = Math.floor(uptime / 86400), h = Math.floor((uptime % 86400) / 3600), m = Math.floor((uptime % 3600) / 60);
      const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('🤖 NexusBot v2.0').setThumbnail(client.user.displayAvatarURL()).addFields(
        { name: '📋 Commandes', value: `**${client.commands.size}** slash + **∞** prefix`, inline: true },
        { name: '🌐 Serveurs', value: `**${client.guilds.cache.size}**`, inline: true },
        { name: '👥 Utilisateurs', value: `**${client.users.cache.size.toLocaleString()}**`, inline: true },
        { name: '⏱️ Uptime', value: `${d}j ${h}h ${m}m`, inline: true },
        { name: '💾 Mémoire', value: `${mem} MB`, inline: true },
        { name: '⚡ Ping', value: `${client.ws.ping}ms`, inline: true },
        { name: '🔧 Version', value: `Node ${process.version}`, inline: true },
      ).setTimestamp()] });
    }
  },
  {
    name: 'ping',
    category: 'Informations',
    aliases: ['pong', 'latence', 'latency'],
    description: 'Ping du bot',
    cooldown: 3,
    async run(message, args, client) {
      const m = await message.reply('🏓 Calcul...');
      const latency = m.createdTimestamp - message.createdTimestamp;
      m.edit({ content: null, embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🏓 Pong !').addFields({ name: '🌐 Latence API', value: `**${client.ws.ping}ms**`, inline: true }, { name: '💬 Latence message', value: `**${latency}ms**`, inline: true })] });
    }
  },
  {
    name: 'channelinfo',
    category: 'Informations',
    aliases: ['ci', 'channel', 'salon'],
    description: 'Infos sur un salon',
    usage: '[#salon]',
    cooldown: 5,
    async run(message, args) {
      const channel = message.mentions.channels.first() || message.channel;
      const fields = [
        { name: '🆔 ID', value: channel.id, inline: true },
        { name: '📋 Type', value: channel.type.toString(), inline: true },
        { name: '📅 Créé', value: `<t:${Math.floor(channel.createdTimestamp/1000)}:R>`, inline: true },
      ];
      if (channel.topic) fields.push({ name: '📝 Sujet', value: channel.topic, inline: false });
      if (channel.rateLimitPerUser) fields.push({ name: '🐌 Mode lent', value: `${channel.rateLimitPerUser}s`, inline: true });
      if (channel.nsfw !== undefined) fields.push({ name: '🔞 NSFW', value: channel.nsfw ? 'Oui' : 'Non', inline: true });
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle(`📋 #${channel.name}`).addFields(...fields).setTimestamp()] });
    }
  },
  {
    name: 'membercount',
    category: 'Informations',
    aliases: ['mc', 'membres', 'count'],
    description: 'Nombre de membres du serveur',
    cooldown: 5,
    async run(message, args, client) {
      const g = message.guild;
      await g.members.fetch().catch(() => {});
      const bots = g.members.cache.filter(m => m.user.bot).size;
      const online = g.members.cache.filter(m => m.presence?.status !== 'offline').size;
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('👥 Membres').addFields({ name: '👥 Total', value: `**${g.memberCount}**`, inline: true }, { name: '👤 Humains', value: `**${g.memberCount - bots}**`, inline: true }, { name: '🤖 Bots', value: `**${bots}**`, inline: true }, { name: '🟢 En ligne', value: `**${online}**`, inline: true }).setTimestamp()] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
