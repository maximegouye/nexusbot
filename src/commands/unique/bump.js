const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Initialize DB tables and migrations
function initDB() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS bump_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      bumped_at INTEGER DEFAULT (strftime('%s','now'))
    )`).run();

    const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
    if (!gc.includes('bump_channel')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN bump_channel TEXT").run();
    }
    if (!gc.includes('bump_role')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN bump_role TEXT").run();
    }
    if (!gc.includes('last_bump')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN last_bump INTEGER").run();
    }
  } catch (e) {
    // Tables already exist or migration already applied
  }
}

// Track cooldowns per user per guild
const cooldowns = new Map();

function getCooldownKey(userId, guildId) {
  return `bump-fait-${userId}-${guildId}`;
}

function checkBumpCooldown(userId, guildId) {
  const key = getCooldownKey(userId, guildId);
  const now = Date.now();
  const cooldownTime = 2 * 60 * 60 * 1000; // 2 hours

  if (cooldowns.has(key)) {
    const expirationTime = cooldowns.get(key);
    if (now < expirationTime) {
      return Math.ceil((expirationTime - now) / 1000);
    }
  }

  cooldowns.set(key, now + cooldownTime);
  return null;
}

function getLastBumpTime(guildId) {
  const config = db.getConfig(guildId);
  return config && config.last_bump ? config.last_bump : null;
}

function setLastBumpTime(guildId, timestamp) {
  const config = db.getConfig(guildId);
  if (config) {
    db.db.prepare('UPDATE guild_config SET last_bump = ? WHERE guild_id = ?').run(timestamp, guildId);
  } else {
    db.db.prepare('INSERT INTO guild_config (guild_id, last_bump) VALUES (?, ?)').run(guildId, timestamp);
  }
}

function getTimeUntilNextBump(guildId) {
  const lastBump = getLastBumpTime(guildId);
  if (!lastBump) {
    return null;
  }

  const bumpInterval = 2 * 60 * 60; // 2 hours in seconds
  const nextBump = lastBump + bumpInterval;
  const now = Math.floor(Date.now() / 1000);

  if (now >= nextBump) {
    return null;
  }

  return nextBump - now;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

function addCoins(userId, guildId, amount) {
  try {
    if (typeof db.addCoins === 'function') {
      db.addCoins(userId, guildId, amount);
    } else {
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(amount, userId, guildId);
    }
    return true;
  } catch (error) {
    console.error('Error adding coins:', error);
    return false;
  }
}

function getBumpLeaderboard(guildId) {
  try {
    const leaderboard = db.db.prepare(`
      SELECT user_id, COUNT(*) as bump_count
      FROM bump_records
      WHERE guild_id = ?
      GROUP BY user_id
      ORDER BY bump_count DESC
      LIMIT 10
    `).all(guildId);
    return leaderboard;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bump')
    .setDescription('Système de bump serveur')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurer le salon de bump')
        .addChannelOption(option =>
          option
            .setName('salon')
            .setDescription('Salon pour les rappels de bump')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Rôle à mentionner (optionnel)')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ping')
        .setDescription('Envoyer un rappel de bump maintenant')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('statut')
        .setDescription('Voir quand est le prochain bump')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('classement')
        .setDescription('Voir le classement des bumps')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('fait')
        .setDescription('Confirmer que vous avez bumpé Disboard')
    ),

  cooldown: 2,

  async execute(interaction) {
    initDB();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommand === 'setup') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      const channel = interaction.options.getChannel('salon');
      const role = interaction.options.getRole('role') || null;

      try {
        const config = db.getConfig(guildId);
        if (config) {
          db.db.prepare('UPDATE guild_config SET bump_channel = ?, bump_role = ? WHERE guild_id = ?').run(
            channel.id,
            role ? role.id : null,
            guildId
          );
        } else {
          db.db.prepare('INSERT INTO guild_config (guild_id, bump_channel, bump_role) VALUES (?, ?, ?)').run(
            guildId,
            channel.id,
            role ? role.id : null
          );
        }

        const roleText = role ? ` et le rôle ${role}` : '';
        interaction.editReply({
          content: `✅ Système de bump configuré sur ${channel}${roleText}`,
          ephemeral: true,
        });
      } catch (error) {
        console.error('Setup error:', error);
        interaction.editReply({
          content: '❌ Une erreur est survenue lors de la configuration.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'ping') {
      // Check permissions
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.editReply({
          content: '❌ Vous devez être administrateur.',
          ephemeral: true,
        });
      }

      const config = db.getConfig(guildId);
      if (!config || !config.bump_channel) {
        return interaction.editReply({
          content: '❌ Le système de bump n\'est pas configuré. Utilisez `/bump setup`.',
          ephemeral: true,
        });
      }

      try {
        const channel = await interaction.guild.channels.fetch(config.bump_channel).catch(() => null);
        if (!channel) {
          return interaction.editReply({
            content: '❌ Le salon de bump n\'existe plus.',
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎯 Rappel de Bump!')
          .setDescription('Il est temps de bumper le serveur sur Disboard!')
          .addFields(
            { name: '📝 Comment?', value: 'Allez sur https://disboard.org/server/bump et cliquez sur "Bump"' },
            { name: '🎁 Récompense', value: 'Confirmez avec `/bump fait` pour recevoir 50 coins!' }
          )
          .setTimestamp()
          .setFooter({ text: 'Boost boost boost!' });

        const messageContent = config.bump_role ? `<@&${config.bump_role}>` : '@everyone';

        await channel.send({
          content: messageContent,
          embeds: [embed],
        });

        // Update last bump time
        setLastBumpTime(guildId, Math.floor(Date.now() / 1000));

        interaction.editReply({
          content: '✅ Rappel de bump envoyé!',
          ephemeral: true,
        });
      } catch (error) {
        console.error('Ping error:', error);
        interaction.editReply({
          content: '❌ Une erreur est survenue lors de l\'envoi du rappel.',
          ephemeral: true,
        });
      }
    }

    if (subcommand === 'statut') {
      const timeRemaining = getTimeUntilNextBump(guildId);

      if (timeRemaining === null) {
        return interaction.editReply({
          content: '✅ Le prochain bump est disponible maintenant!',
          ephemeral: true,
        });
      }

      const formattedTime = formatTime(timeRemaining);
      const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle('⏰ Statut du Bump')
        .setDescription(`Le prochain bump sera disponible dans **${formattedTime}**`)
        .setTimestamp()
        .setFooter({ text: 'Patience, c\'est bientôt!' });

      interaction.editReply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (subcommand === 'classement') {
      const leaderboard = getBumpLeaderboard(guildId);

      if (leaderboard.length === 0) {
        return interaction.editReply({
          content: '📊 Aucun bump enregistré pour le moment.',
          ephemeral: true,
        });
      }

      let leaderboardText = '';
      for (let i = 0; i < leaderboard.length; i++) {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        leaderboardText += `${medal} <@${leaderboard[i].user_id}> — **${leaderboard[i].bump_count}** bump(s)\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🏆 Classement des Bumps')
        .setDescription(leaderboardText)
        .setTimestamp()
        .setFooter({ text: 'Bravo à tous les bumpeurs!' });

      interaction.editReply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    if (subcommand === 'fait') {
      // Check cooldown
      const cooldownRemaining = checkBumpCooldown(interaction.user.id, guildId);
      if (cooldownRemaining) {
        return interaction.editReply({
          content: `⏳ Vous devez attendre ${formatTime(cooldownRemaining)} avant de pouvoir confirmer un nouveau bump.`,
          ephemeral: true,
        });
      }

      try {
        // Add coins
        const coinsAdded = addCoins(interaction.user.id, guildId, 50);

        // Record bump
        db.db.prepare('INSERT INTO bump_records (guild_id, user_id, bumped_at) VALUES (?, ?, ?)').run(
          guildId,
          interaction.user.id,
          Math.floor(Date.now() / 1000)
        );

        // Update last bump time
        setLastBumpTime(guildId, Math.floor(Date.now() / 1000));

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✨ Merci d\'avoir bumpé !')
          .setDescription(`${interaction.user.username}, tu as reçu **50 coins** pour ton bump !`)
          .addFields(
            { name: '⭐ Prochaine confirmation', value: `Disponible dans 2 heures` }
          )
          .setTimestamp()
          .setFooter({ text: 'Votre engagement compte!' });

        interaction.editReply({
          embeds: [embed],
          ephemeral: true,
        });
      } catch (error) {
        console.error('Fait error:', error);
        interaction.editReply({
          content: '❌ Une erreur est survenue lors de la confirmation du bump.',
          ephemeral: true,
        });
      }
    }
  },
};
