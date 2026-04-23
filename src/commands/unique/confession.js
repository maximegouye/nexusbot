const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Initialize DB tables and migrations
function initDB() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS confessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      message TEXT NOT NULL,
      message_id TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )`).run();

    db.db.prepare(`CREATE TABLE IF NOT EXISTS confession_bans (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT,
      banned_by TEXT,
      PRIMARY KEY(guild_id, user_id)
    )`).run();

    const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
    if (!gc.includes('confession_channel')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN confession_channel TEXT").run();
    }
  } catch (e) {
    // Tables already exist or migration already applied
  }
}

// Track cooldowns per user per guild
const cooldowns = new Map();

function getCooldownKey(userId, guildId) {
  return `${userId}-${guildId}`;
}

function checkCooldown(userId, guildId) {
  const key = getCooldownKey(userId, guildId);
  const now = Date.now();
  const cooldownTime = 30 * 60 * 1000; // 30 minutes

  if (cooldowns.has(key)) {
    const expirationTime = cooldowns.get(key);
    if (now < expirationTime) {
      return Math.ceil((expirationTime - now) / 1000);
    }
  }

  cooldowns.set(key, now + cooldownTime);
  return null;
}

function getConfessionNumber(guildId) {
  const result = db.db.prepare('SELECT COUNT(*) as count FROM confessions WHERE guild_id = ?').get(guildId);
  return result.count + 1;
}

function isUserBanned(userId, guildId) {
  const result = db.db.prepare('SELECT * FROM confession_bans WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  return !!result;
}

function getBanReason(userId, guildId) {
  const result = db.db.prepare('SELECT reason FROM confession_bans WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
  return result ? result.reason : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Partagez vos confessions anonymes')
    .addSubcommand(subcommand =>
      subcommand
        .setName('envoyer')
        .setDescription('Envoyer une confession anonyme')
        .addStringOption(option =>
          option
            .setName('message')
            .setDescription('Votre confession (max 500 caractères)')
            .setRequired(true)
            .setMaxLength(500)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurer le salon des confessions')
        .addChannelOption(option =>
          option
            .setName('salon')
            .setDescription('Salon où poster les confessions')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desactiver')
        .setDescription('Désactiver les confessions')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('bannir')
        .setDescription('Bannir un utilisateur des confessions')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à bannir')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('raison')
            .setDescription('Raison du bannissement')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('debannir')
        .setDescription('Débannir un utilisateur des confessions')
        .addUserOption(option =>
          option
            .setName('utilisateur')
            .setDescription('Utilisateur à débannir')
            .setRequired(true)
        )
    ),

  cooldown: 2,

  async execute(interaction) {
    initDB();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommand === 'envoyer') {
      // Check if confessions are enabled
      const guildConfig = db.getConfig(guildId);
      if (!guildConfig || !guildConfig.confession_channel) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Les confessions ne sont pas activées sur ce serveur.',
          ephemeral: true,
        });
      }

      // Check if user is banned
      if (isUserBanned(interaction.user.id, guildId)) {
        const reason = getBanReason(interaction.user.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `❌ Vous êtes bannis des confessions. Raison: ${reason || 'Non spécifiée'}`,
          ephemeral: true,
        });
      }

      // Check cooldown
      const cooldownRemaining = checkCooldown(interaction.user.id, guildId);
      if (cooldownRemaining) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `⏳ Vous devez attendre ${cooldownRemaining} secondes avant de pouvoir envoyer une nouvelle confession.`,
          ephemeral: true,
        });
      }

      const message = interaction.options.getString('message');
      const confessionNumber = getConfessionNumber(guildId);

      try {
        // Get confession channel
        const channel = await interaction.guild.channels.fetch(guildConfig.confession_channel).catch(() => null);
        if (!channel) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            content: '❌ Le salon des confessions n\'existe plus.',
            ephemeral: true,
          });
        }

        // Create confession embed
        const embed = new EmbedBuilder()
          .setColor('#9d4edd')
          .setTitle(`Confession #${confessionNumber}`)
          .setDescription(message)
          .setTimestamp()
          .setFooter({ text: 'Envoyée anonymement' });

        // Post to confession channel
        const postedMessage = await channel.send({ embeds: [embed] });

        // Store in database
        db.db.prepare('INSERT INTO confessions (guild_id, user_id, message, message_id, created_at) VALUES (?, ?, ?, ?, ?)').run(
          guildId,
          interaction.user.id,
          message,
          postedMessage.id,
          Math.floor(Date.now() / 1000)
        );

        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `✅ Votre confession a été envoyée anonymement! (#${confessionNumber})`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Confession error:', error);
        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Une erreur est survenue lors de l\'envoi de la confession.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'setup') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('salon');

      try {
        const guildConfig = db.getConfig(guildId);
        if (guildConfig) {
          db.db.prepare('UPDATE guild_config SET confession_channel = ? WHERE guild_id = ?').run(channel.id, guildId);
        } else {
          db.db.prepare('INSERT INTO guild_config (guild_id, confession_channel) VALUES (?, ?)').run(guildId, channel.id);
        }

        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `✅ Salon des confessions configuré: ${channel}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Setup error:', error);
        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Une erreur est survenue.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'desactiver') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      try {
        db.db.prepare('UPDATE guild_config SET confession_channel = NULL WHERE guild_id = ?').run(guildId);

        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '✅ Les confessions ont été désactivées.',
          ephemeral: true,
        });
      } catch (error) {
        console.error('Disable error:', error);
        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Une erreur est survenue.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'bannir') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser('utilisateur');
      const reason = interaction.options.getString('raison');

      try {
        db.db.prepare('INSERT OR REPLACE INTO confession_bans (guild_id, user_id, reason, banned_by) VALUES (?, ?, ?, ?)').run(
          guildId,
          user.id,
          reason,
          interaction.user.id
        );

        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `✅ ${user.tag} a été banni des confessions. Raison: ${reason}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Ban error:', error);
        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Une erreur est survenue.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'debannir') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      const user = interaction.options.getUser('utilisateur');

      try {
        db.db.prepare('DELETE FROM confession_bans WHERE guild_id = ? AND user_id = ?').run(guildId, user.id);

        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `✅ ${user.tag} a été débanni des confessions.`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Unban error:', error);
        (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '❌ Une erreur est survenue.',
          ephemeral: true,
        });
      }
    }
  },
};
