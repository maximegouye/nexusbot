const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tempvoice_config (
    guild_id TEXT PRIMARY KEY,
    hub_channel_id TEXT,
    category_id TEXT,
    default_limit INTEGER DEFAULT 0,
    default_name TEXT DEFAULT '{username} vocal'
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS tempvoice_channels (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT, owner_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('🔊 Système de salons vocaux temporaires')
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer le hub vocal (Admin)')
      .addChannelOption(o => o.setName('hub').setDescription('Salon hub (rejoindre = créer un vocal)').setRequired(true))
      .addChannelOption(o => o.setName('categorie').setDescription('Catégorie où créer les vocaux'))
      .addStringOption(o => o.setName('nom').setDescription('Format du nom (ex: {username} vocal, {count} 🎮)'))
    .addSubcommand(s => s.setName('voir').setDescription('📋 Voir la configuration'))
    .addSubcommand(s => s.setName('disable').setDescription('🗑️ Désactiver les vocaux temporaires'))
    .addSubcommand(s => s.setName('rename').setDescription('✏️ Renommer votre salon vocal')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('limite').setDescription('👥 Changer la limite de votre salon')
    .addSubcommand(s => s.setName('lock').setDescription('🔒 Verrouiller/déverrouiller votre salon'))
    .addSubcommand(s => s.setName('kick').setDescription('👢 Expulser quelqu\'un de votre salon')
      .addUserOption(o => o.setName('membre').setDescription('Membre à expulser').setRequired(true)))
    .addSubcommand(s => s.setName('transfer').setDescription('🔑 Transférer la propriété du salon')
      .addUserOption(o => o.setName('membre').setDescription('Nouveau propriétaire').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const guild = interaction.guild;
    const userId = interaction.user.id;

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
      }
      const hub = interaction.options.getChannel('hub');
      const cat = interaction.options.getChannel('categorie');
      const nom = interaction.options.getString('nom') || '{username} vocal';
      const limite = interaction.options.getInteger('limite') ?? 0;

      if (hub.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: '❌ Le hub doit être un salon vocal.', ephemeral: true });
      }

      db.db.prepare('INSERT OR REPLACE INTO tempvoice_config (guild_id, hub_channel_id, category_id, default_limit, default_name) VALUES (?,?,?,?,?)')
        .run(guildId, hub.id, cat?.id || null, limite, nom);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('🔊 TempVoice configuré !')
          .addFields(
            { name: '🔗 Hub', value: `${hub}`, inline: true },
            { name: '📁 Catégorie', value: cat ? cat.name : 'Même que le hub', inline: true },
            { name: '🏷️ Format', value: `\`${nom}\``, inline: true },
            { name: '👥 Limite défaut', value: limite === 0 ? 'Illimité' : `${limite}`, inline: true },
          )
          .setDescription('Quand un membre rejoint le hub, un salon vocal lui est créé automatiquement.')
      ], ephemeral: true });
    }

    if (sub === 'voir') {
      const cfg = db.db.prepare('SELECT * FROM tempvoice_config WHERE guild_id=?').get(guildId);
      if (!cfg) return interaction.reply({ content: '❌ TempVoice non configuré. Utilisez `/tempvoice setup`.', ephemeral: true });

      const actives = db.db.prepare('SELECT COUNT(*) as c FROM tempvoice_channels WHERE guild_id=?').get(guildId);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('🔊 Configuration TempVoice')
          .addFields(
            { name: '🔗 Hub', value: cfg.hub_channel_id ? `<#${cfg.hub_channel_id}>` : 'Non défini', inline: true },
            { name: '📁 Catégorie', value: cfg.category_id ? `<#${cfg.category_id}>` : 'Auto', inline: true },
            { name: '🏷️ Format', value: `\`${cfg.default_name}\``, inline: true },
            { name: '👥 Limite défaut', value: cfg.default_limit === 0 ? 'Illimité' : `${cfg.default_limit}`, inline: true },
            { name: '🔊 Salons actifs', value: `**${actives?.c || 0}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'disable') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Admin uniquement.', ephemeral: true });
      }
      db.db.prepare('DELETE FROM tempvoice_config WHERE guild_id=?').run(guildId);
      return interaction.reply({ content: '✅ TempVoice désactivé.', ephemeral: true });
    }

    // Commandes pour gérer son propre salon
    const ownedChannel = db.db.prepare('SELECT * FROM tempvoice_channels WHERE guild_id=? AND owner_id=?').get(guildId, userId);
    if (!ownedChannel) {
      return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
    }
    const voiceChannel = guild.channels.cache.get(ownedChannel.channel_id);
    if (!voiceChannel) {
      db.db.prepare('DELETE FROM tempvoice_channels WHERE channel_id=?').run(ownedChannel.channel_id);
      return interaction.reply({ content: '❌ Votre salon vocal n\'existe plus.', ephemeral: true });
    }

    if (sub === 'rename') {
      const nom = interaction.options.getString('nom');
      await voiceChannel.setName(nom).catch(() => {});
      return interaction.reply({ content: `✅ Salon renommé en **${nom}**.`, ephemeral: true });
    }

    if (sub === 'limite') {
      const nb = interaction.options.getInteger('nombre');
      await voiceChannel.setUserLimit(nb).catch(() => {});
      return interaction.reply({ content: `✅ Limite mise à **${nb === 0 ? 'illimité' : nb}**.`, ephemeral: true });
    }

    if (sub === 'lock') {
      const isLocked = !voiceChannel.permissionOverwrites.cache.get(guild.id)?.deny?.has('Connect');
      if (isLocked) {
        await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: false });
        return interaction.reply({ content: '🔒 Salon verrouillé — plus personne ne peut rejoindre.', ephemeral: true });
      } else {
        await voiceChannel.permissionOverwrites.edit(guild.id, { Connect: null });
        return interaction.reply({ content: '🔓 Salon déverrouillé — tout le monde peut rejoindre.', ephemeral: true });
      }
    }

    if (sub === 'kick') {
      const target = interaction.options.getMember('membre');
      if (!target?.voice?.channelId || target.voice.channelId !== ownedChannel.channel_id) {
        return interaction.reply({ content: '❌ Ce membre n\'est pas dans votre salon.', ephemeral: true });
      }
      await target.voice.disconnect('TempVoice kick').catch(() => {});
      return interaction.reply({ content: `✅ **${target.user.username}** a été expulsé de votre salon.`, ephemeral: true });
    }

    if (sub === 'transfer') {
      const newOwner = interaction.options.getMember('membre');
      if (!newOwner?.voice?.channelId || newOwner.voice.channelId !== ownedChannel.channel_id) {
        return interaction.reply({ content: '❌ Ce membre n\'est pas dans votre salon.', ephemeral: true });
      }
      db.db.prepare('UPDATE tempvoice_channels SET owner_id=? WHERE channel_id=?').run(newOwner.id, ownedChannel.channel_id);
      return interaction.reply({ content: `✅ Propriété transférée à **${newOwner.user.username}**.`, ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
