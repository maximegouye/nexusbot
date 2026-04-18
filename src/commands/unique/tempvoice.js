const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempvoice')
    .setDescription('Gestion des salons vocaux temporaires')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Configurer le système de salons vocaux temporaires (admin)')
        .addChannelOption(option =>
          option
            .setName('categorie-discord')
            .setDescription('Catégorie Discord où créer les salons vocaux')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('renommer')
        .setDescription('Renommer votre salon vocal temporaire')
        .addStringOption(option =>
          option
            .setName('nouveau-nom')
            .setDescription('Nouveau nom du salon vocal')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('limite')
        .setDescription("Définir la limite d'utilisateurs du salon")
        .addIntegerOption(option =>
          option
            .setName('nombre')
            .setDescription('Limite (0 = illimité)')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(99)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('lock')
        .setDescription('Verrouiller votre salon vocal')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unlock')
        .setDescription('Déverrouiller votre salon vocal')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('expulser')
        .setDescription("Expulser quelqu'un de votre salon vocal")
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Utilisateur à expulser')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transferer')
        .setDescription('Transférer la propriété de votre salon vocal')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('Utilisateur à qui transférer la propriété')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('statut')
        .setDescription('Afficher les infos de votre salon vocal')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('desactiver')
        .setDescription('Désactiver le système de salons temporaires (admin)')
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
    return interaction.reply({ content: '❌ Seuls les administrateurs peuvent configurer ce système.', ephemeral: true });
  }

  const category = interaction.options.getChannel('categorie-discord');

  if (category.type !== 4) {
    return interaction.reply({ content: '❌ Le salon sélectionné doit être une catégorie Discord.', ephemeral: true });
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
      .setTitle('✅ Système de Salons Vocaux Activé')
      .setDescription(`Le système de salons vocaux temporaires a été configuré avec succès !`)
      .addFields(
        { name: '📍 Salon Créateur', value: `<#${creatorChannel.id}>`, inline: false },
        { name: '📂 Catégorie', value: `${category.name}`, inline: false },
        { name: '💡 Comment ça fonctionne', value: 'Les membres rejoignent le salon créateur — un salon vocal personnel est créé automatiquement.', inline: false }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors de la configuration : ${error.message}`, ephemeral: true });
  }
}

async function handleRename(interaction, guildId, userId) {
  const newName = interaction.options.getString('nouveau-nom');

  // Find user's temp channel
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      // Clean up stale entry
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
    }

    await channel.setName(newName);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('✅ Salon Renommé')
      .setDescription(`Votre salon vocal a été renommé en : **${newName}**`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors du renommage : ${error.message}`, ephemeral: true });
  }
}

async function handleLimit(interaction, guildId, userId) {
  const limit = interaction.options.getInteger('nombre');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
    }

    await channel.setUserLimit(limit === 0 ? 0 : limit);

    const limitText = limit === 0 ? 'unlimited' : `${limit} users`;
    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('✅ Limite Mise à Jour')
      .setDescription(`La limite de votre salon vocal est maintenant : **${limitText}**`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors de la définition de la limite : ${error.message}`, ephemeral: true });
  }
}

async function handleLock(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
    }

    // Update permissions to prevent others from joining
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: false,
    });

    const embed = new EmbedBuilder()
      .setColor('#FF6600')
      .setTitle('🔒 Salon Verrouillé')
      .setDescription('Votre salon vocal est maintenant verrouillé. Seul le propriétaire peut inviter des membres.')
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors du verrouillage : ${error.message}`, ephemeral: true });
  }
}

async function handleUnlock(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
    }

    // Update permissions to allow others to join
    await channel.permissionOverwrites.edit(interaction.guild.id, {
      Connect: true,
    });

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('🔓 Salon Déverrouillé')
      .setDescription('Votre salon vocal est maintenant ouvert à tous.')
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors du déverrouillage : ${error.message}`, ephemeral: true });
  }
}

async function handleKick(interaction, guildId, userId) {
  const targetUser = interaction.options.getUser('user');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
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
      .setTitle('👢 Membre Expulsé')
      .setDescription(`**${targetUser.username}** a été expulsé de votre salon vocal.`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors de l'expulsion : ${error.message}`, ephemeral: true });
  }
}

async function handleTransfer(interaction, guildId, userId) {
  const newOwner = interaction.options.getUser('user');

  const tempChannel = db.db.prepare('SELECT channel_id FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  if (newOwner.id === userId) {
    return interaction.reply({ content: '❌ You can\'t transfer ownership to yourself.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
    }

    // Update the database with new owner
    db.db.prepare('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ?')
      .run(newOwner.id, tempChannel.channel_id);

    const embed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('👑 Propriété Transférée')
      .setDescription(`La propriété de votre salon a été transférée à **${newOwner.username}**.`)
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors du transfert : ${error.message}`, ephemeral: true });
  }
}

async function handleStatus(interaction, guildId, userId) {
  const tempChannel = db.db.prepare('SELECT channel_id, created_at FROM temp_channels WHERE guild_id = ? AND owner_id = ?')
    .get(guildId, userId);

  if (!tempChannel) {
    return interaction.reply({ content: '❌ Vous n\'avez pas de salon vocal temporaire actif.', ephemeral: true });
  }

  try {
    const channel = await interaction.guild.channels.fetch(tempChannel.channel_id);
    if (!channel) {
      db.db.prepare('DELETE FROM temp_channels WHERE channel_id = ?').run(tempChannel.channel_id);
      return interaction.reply({ content: "❌ Votre salon vocal temporaire n'existe plus.", ephemeral: true });
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
    interaction.reply({ content: `❌ Erreur lors de la récupération du statut : ${error.message}`, ephemeral: true });
  }
}

async function handleDisable(interaction, guildId) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Seuls les administrateurs peuvent désactiver ce système.', ephemeral: true });
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
      .setTitle('❌ Système de Salons Vocaux Désactivé')
      .setDescription('Le système de salons vocaux temporaires a été complètement désactivé.')
      .addFields(
        { name: '🗑️ Cleanup', value: `${channels.length} temporary voice channel(s) have been deleted.`, inline: false }
      )
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    interaction.reply({ content: `❌ Erreur lors de la désactivation : ${error.message}`, ephemeral: true });
  }
}
