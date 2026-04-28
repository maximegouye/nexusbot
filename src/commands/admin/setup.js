const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configuration rapide de NexusBot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir la configuration actuelle'))
    .addSubcommand(s => s.setName('couleur').setDescription('🎨 Couleur des embeds')
      .addStringOption(o => o.setName('hex').setDescription('Couleur HEX (ex: #7B2FBE)').setRequired(true)))
    .addSubcommand(s => s.setName('monnaie').setDescription('💰 Configurer la monnaie')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la monnaie').setRequired(false).setMaxLength(20))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji de la monnaie').setRequired(false).setMaxLength(10)))
    .addSubcommand(s => s.setName('welcome').setDescription('👋 Canal de bienvenue')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('message').setDescription('Message ({user} = nom, {server} = serveur)').setRequired(false)))
    .addSubcommand(s => s.setName('leave').setDescription('🚪 Canal de départ')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('levels').setDescription('⭐ Canal des level-up')
      .addChannelOption(o => o.setName('canal').setDescription('Canal (0 = désactiver)').setRequired(true)))
    .addSubcommand(s => s.setName('autorole').setDescription('🤖 Rôle automatique à l\'arrivée')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à donner (aucun = désactiver)').setRequired(false)))
    .addSubcommand(s => s.setName('xp').setDescription('⭐ Paramètres XP')
      .addBooleanOption(o => o.setName('actif').setDescription('Activer/désactiver le gain d\'XP').setRequired(true))
      .addIntegerOption(o => o.setName('multiplicateur').setDescription('Multiplicateur XP').setMinValue(1).setMaxValue(10).setRequired(false)))
    .addSubcommand(s => s.setName('mod-log').setDescription('🛡️ Canal des logs de modération')
      .addChannelOption(o => o.setName('canal').setDescription('Canal de mod-log (vide = désactiver)').setRequired(false).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('🏆 Canal du classement hebdomadaire')
      .addChannelOption(o => o.setName('canal').setDescription('Canal pour le top hebdo (vide = désactiver)').setRequired(false).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('events').setDescription('🎯 Canal des événements automatiques')
      .addChannelOption(o => o.setName('canal').setDescription('Canal pour les quiz et défis (vide = désactiver)').setRequired(false).addChannelTypes(ChannelType.GuildText))),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }); } catch (e) { /* already ack'd */ }
    }

    try {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'voir') {
      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('⚙️ Configuration NexusBot')
        .setThumbnail(interaction.guild.iconURL())
        .addFields(
          { name: '🎨 Couleur',       value: cfg.color || '#7B2FBE',                      inline: true },
          { name: '💰 Monnaie',       value: `${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}`, inline: true },
          { name: '👋 Bienvenue',     value: cfg.welcome_channel ? `<#${cfg.welcome_channel}>` : '*Non configuré*', inline: true },
          { name: '🚪 Départ',        value: cfg.leave_channel   ? `<#${cfg.leave_channel}>` : '*Non configuré*', inline: true },
          { name: '⭐ Level-up',      value: cfg.level_channel   ? `<#${cfg.level_channel}>` : '*Non configuré*', inline: true },
          { name: '🤖 Auto-rôle',     value: cfg.autorole        ? `<@&${cfg.autorole}>` : '*Non configuré*',     inline: true },
          { name: '⭐ XP actif',      value: cfg.xp_enabled !== false ? '✅ Oui' : '❌ Non',                       inline: true },
          { name: '✖️ Multiplicateur', value: `×${cfg.xp_multiplier || 1}`,                                       inline: true },
          { name: '🎉 Daily €',   value: `**${cfg.daily_amount || 200}** €`,                              inline: true },
        )
        .setFooter({ text: 'Utilise /setup <sous-commande> pour modifier' });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'couleur') {
      const hex = interaction.options.getString('hex');
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format invalide. Exemple : `#7B2FBE`', ephemeral: true });
      db.setConfig(interaction.guildId, 'color', hex);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(hex).setDescription(`✅ Couleur définie sur **${hex}**.`)], ephemeral: true });
    }

    if (sub === 'monnaie') {
      const nom   = interaction.options.getString('nom');
      const emoji = interaction.options.getString('emoji');
      if (nom)   db.setConfig(interaction.guildId, 'currency_name', nom);
      if (emoji) db.setConfig(interaction.guildId, 'currency_emoji', emoji);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Monnaie : **${emoji || cfg.currency_emoji || '€'} ${nom || cfg.currency_name || 'Euros'}**.`)], ephemeral: true });
    }

    if (sub === 'welcome') {
      const canal = interaction.options.getChannel('canal');
      const msg   = interaction.options.getString('message');
      db.setConfig(interaction.guildId, 'welcome_channel', canal.id);
      if (msg) db.setConfig(interaction.guildId, 'welcome_msg', msg);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Canal de bienvenue : ${canal}.`)], ephemeral: true });
    }

    if (sub === 'leave') {
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'leave_channel', canal?.id || null);
      const msg = canal ? `✅ Canal de départ : ${canal}.` : '✅ Messages de départ **désactivés**.';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(canal ? '#2ECC71' : '#E74C3C').setDescription(msg)], ephemeral: true });
    }

    if (sub === 'levels') {
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'level_channel', canal.id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Canal level-up : ${canal}.`)], ephemeral: true });
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      db.setConfig(interaction.guildId, 'autorole', role?.id || null);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(role ? `✅ Auto-rôle : <@&${role.id}>.` : '✅ Auto-rôle désactivé.')], ephemeral: true });
    }

    if (sub === 'xp') {
      const actif = interaction.options.getBoolean('actif');
      const multi = interaction.options.getInteger('multiplicateur');
      db.setConfig(interaction.guildId, 'xp_enabled', actif ? 1 : 0);
      if (multi) db.setConfig(interaction.guildId, 'xp_multiplier', multi);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ XP ${actif ? 'activé' : 'désactivé'}${multi ? ` — Multiplicateur ×${multi}` : ''}.`)], ephemeral: true });
    }

    if (sub === 'mod-log') {
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'mod_log_channel', canal?.id || null);
      const msg = canal ? `✅ Canal mod-log : ${canal}.` : '✅ Canal mod-log **désactivé**.';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(canal ? '#2ECC71' : '#E74C3C').setDescription(msg)], ephemeral: true });
    }

    if (sub === 'leaderboard') {
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'leaderboard_channel', canal?.id || null);
      const msg = canal ? `✅ Canal classement hebdo : ${canal}.` : '✅ Classement hebdomadaire **désactivé**.';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(canal ? '#2ECC71' : '#E74C3C').setDescription(msg)], ephemeral: true });
    }

    if (sub === 'events') {
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'events_channel', canal?.id || null);
      const msg = canal ? `✅ Canal événements : ${canal}.` : '✅ Événements automatiques **désactivés**.';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(canal ? '#2ECC71' : '#E74C3C').setDescription(msg)], ephemeral: true });
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
