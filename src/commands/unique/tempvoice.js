const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Temporary voice channel management system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Set up the temporary voice channel system (admin only)')
        .addChannelOption(option =>
          option
            .setName('categorie-discord')
            .setDescription('The Discord category where the voice channels will be created')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('renommer')
        .setDescription('Rename your temporary voice channel')
        .addStringOption(option =>
          option
            .setName('nouveau-nom')
            .setDescription('The new name for your voice channel')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('limite')
        .setDescription('Set user limit for your temporary voice channel')
        .addIntegerOption(option =>
          option
            .setName('nombre')
            .setDescription('User limit (0 = unlimited)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lock')
        .setDescription('Lock your temporary voice channel (prevent others from joining)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlock')
        .setDescription('Unlock your temporary voice channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('expulser')
        .setDescription('Kick someone from your temporary voice channel')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to kick')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transferer')
        .setDescription('Transfer ownership of your temporary voice channel')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('The user to transfer ownership to')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('statut')
        .setDescription('Show information about your current temporary voice channel')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desactiver')
        .setDescription('Disable the temporary voice channel system (admin only)')
    ),

  cooldown: 2,

  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // Initialize database tables and columns
    initializeDatabase();

    switch (subcommand) {
      case 'setup':
        await handleSetup(interaction, guildId);
        break;
      case 'renommer':
        await handleRename(interaction, guildId, userId);
        break;
      case 'limite':
        await handleLimit(interaction, guildId, userId);
        break;
      case 'lock':
        await handleLock(interaction, guildId, userId);
        break;
      case 'unlock':
        await handleUnlock(interaction, guildId, userId);
        break;
      case 'expulser':
        await handleKick(interaction, guildId, userId);
        break;
      case 'transferer':
        await handleTransfer(interaction, guildId, userId);
        break;
      case 'statut':
        await handleStatus(interaction, guildId, userId);
        break;
      case 'desactiver':
        await handleDisable(interaction, guildId);
        break;
    }
  },
};

function initializeDatabase() {
  try {
    db.db.prepare(`
      CREATE TABLE IF NOT EXISTS temp_channels (
        channel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      )
    `).run();

    const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
    if (!gc.includes('tempvoice_category')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN tempvoice_category TEXT").run();
    }
    if (!gc.includes('tempvoice_creator')) {
      db.db.prepare("ALTER TABLE guild_config ADD COLUMN tempvoice_creator TEXT").run();
    }
  } catch (error) {
    // Silently ignore if tables already exist
  }
}

async function handleSetup(interaction, guildId) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Only administrators can set up the temporary voice system.', ephemeral: true });
  }

  const category = interaction.options.getChannel('categorie-discord');

  if (category.type !== 4) {
    return interaction.reply({ content: '❌ The selected channel must be a category.', ephemeral: true });
  }

  try {
    // Create the "➕ Créer un salon" channel in the category
    const creatorChannel = await category.guild.channels.create({
      name: '➕ Créer un salon',
      type: 2, // Voice channel
      parent: category.id,
      permissionOverwrites: [
        {
          id: category.guild.id,
          allow: ['Connect'],
        },
      ],
    });

    // Save the setup to database
    const config = db.getConfig(guildId);
    db.db.prepare('UPDATE guild_config SET tempvoice_category = ?, tempvoice_creator = ? WHERE guild_id = ?')
      .run(creatorChannel.id, 'enabled', guildId);

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Temporary Voice System Enabled')
      .setDescription(`The temporary voice channel system has been set up successfully!`)
      .addFields(
        { name: '📍 Creator Channel', value: `<#${creatorChannel.id}>`, inline: false },
        { name: '📂 Category', value: `${category.name}`, inline: false },
        { name: '💡 How it works', value: 'Users can join the creator channel and a personal voice channel will be automatically created for them.', inline: false }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error setting up the system: ${error.message}`, ephemeral: true });
  }
}

async function handleRename(interaction, guildId, userId) {
  const newName = interaction.options.getString('nouveau-nom');

  // Find user's temp channel
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      // Clean up stale entry
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    await channel.setName(newName);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('✅ Channel Renamed')
      .setDescription(`Your voice channel has been renamed to: **${newName}**`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error renaming channel: ${error.message}`, ephemeral: true });
  }
}

async function handleLimit(interaction, guildId, userId) {
  const limit = interaction.options.getInteger('nombre');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    await channel.setUserLimit(limit === 0 ? 0 : limit);

    const limitText = limit === 0 ? 'unlimited' : `${limit} users`;
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('✅ User Limit Updated')
      .setDescription(`Your voice channel user limit is now: **${limitText}**`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error setting user limit: ${error.message}`, ephemeral: true });
  }
}

async function handleLock(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    // Update permissions to prevent others from joining
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: false,
    });

    const embed = new EmbedBuilder()
      .setColor('#FF6600')
      .setTitle('🔒 Channel Locked')
      .setDescription('Your voice channel is now locked. Only the owner can invite users.')
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error locking channel: ${error.message}`, ephemeral: true });
  }
}

async function handleUnlock(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    // Update permissions to allow others to join
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: true,
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🔓 Channel Unlocked')
      .setDescription('Your voice channel is now unlocked. Everyone can join.')
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error unlocking channel: ${error.message}`, ephemeral: true });
  }
}

async function handleKick(interaction, guildId, userId) {
  const targetUser = interaction.options.getUser('user');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    // Get the member to kick
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    if (!member || member.voice.channelId !== channel.id) {
      return interaction.reply({ content: `❌ ${targetUser.username} is not in your voice channel.`, ephemeral: true });
    }

    // Disconnect the user
    await member.voice.disconnect('Kicked by voice channel owner');

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('👢 User Kicked')
      .setDescription(`**${targetUser.username}** has been kicked from your voice channel.`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error kicking user: ${error.message}`, ephemeral: true });
  }
}

async function handleTransfer(interaction, guildId, userId) {
  const newOwner = interaction.options.getUser('user');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  if (newOwner.id === userId) {
    return interaction.reply({ content: '❌ You can\'t transfer ownership to yourself.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    // Update the database with new owner
    db.db.prepare('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ?')
      .run(newOwner.id, tempChannel.channel_id);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('👑 Ownership Transferred')
      .setDescription(`Your voice channel ownership has been transferred to **${newOwner.username}**.`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error transferring ownership: ${error.message}`, ephemeral: true });
  }
}

async function handleStatus(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id, created_at FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ You don\'t have an active temporary voice channel.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: '❌ Your temporary voice channel no longer exists.', ephemeral: true });
    }

    const userCount = channel.members.size;
    const userLimit = channel.userLimit === 0 ? 'Unlimited' : `${channel.userLimit} users`;
    const isLocked = !channel.permissionsFor(interaction.guild.id).has('Connect');
    const createdAt = new Date(tempChannel.created_at * 1000);

    const memberList = channel.members.map(m => m.user.username).join('\n') || 'No one is currently in the channel';

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle(`📊 ${channel.name}`)
      .addFields(
        { name: '👤 Current Members', value: `${userCount} users in channel`, inline: true },
        { name: '👥 User Limit', value: userLimit, inline: true },
        { name: '🔐 Status', value: isLocked ? '🔒 Locked' : '🔓 Unlocked', inline: true },
        { name: '⏰ Created', value: `<t:${Math.floor(tempChannel.created_at)}:R>`, inline: false },
        { name: '👥 Members', value: memberList, inline: false }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error fetching channel status: ${error.message}`, ephemeral: true });
  }
}

async function handleDisable(interaction, guildId) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Only administrators can disable the temporary voice system.', ephemeral: true });
  }

  try {
    // Get all temp channels for this guild
    const channels = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ?').all(guildId);

    // Delete all temporary voice channels
    for (const row of channels) {
      try {
        const channel = await interaction.guild.channels.fetch(row.channel_id);
        if (channel) {
          await channel.delete();
        }
      } catch (error) {
        // Channel already deleted, ignore
      }
    }

    // Remove from database
    db.db.prepare('DELETE FROM temp_channels WHERE guild_id = ?').run(guildId);

    // Clear the configuration
    db.db.prepare('UPDATE guild_config SET tempvoice_category = ?, tempvoice_creator = ? WHERE guild_id = ?')
      .run(null, null, guildId);

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('❌ Temporary Voice System Disabled')
      .setDescription('The temporary voice channel system has been completely disabled.')
      .addFields(
        { name: '🗑️ Cleanup', value: `${channels.length} temporary voice channel(s) have been deleted.`, inline: false }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Error disabling the system: ${error.message}`, ephemeral: true });
  }
}
