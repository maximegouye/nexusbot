const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS stats_channels (
    guild_id TEXT PRIMARY KEY,
    members_ch TEXT,
    bots_ch TEXT,
    online_ch TEXT,
    boosts_ch TEXT,
    channels_ch TEXT
  )
`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statschannel')
    .setDescription('📊 Configurer les salons de stats du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(s => s.setName('setup')
      .setDescription('Créer automatiquement les canaux de stats'))
    .addSubcommand(s => s.setName('retirer')
      .setDescription('Supprimer la configuration des stats'))
    .addSubcommand(s => s.setName('statut')
      .setDescription('Voir les canaux de stats configurés')),
  cooldown: 10,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });

      try {
        // Créer ou trouver la catégorie "📊 Stats"
        let category = interaction.guild.channels.cache.find(
          c => c.type === ChannelType.GuildCategory && c.name === '📊 Stats'
        );

        if (!category) {
          category = await interaction.guild.channels.create({
            name: '📊 Stats',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: ['Connect', 'SendMessages', 'ManageChannels']
              }
            ]
          });
        }

        // Créer les 5 canaux vocaux
        const membersChannel = await interaction.guild.channels.create({
          name: '👥 Membres: 0',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['Connect']
            }
          ]
        });

        const botsChannel = await interaction.guild.channels.create({
          name: '🤖 Bots: 0',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['Connect']
            }
          ]
        });

        const onlineChannel = await interaction.guild.channels.create({
          name: '🟢 En ligne: 0',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['Connect']
            }
          ]
        });

        const boostsChannel = await interaction.guild.channels.create({
          name: '🚀 Boosts: 0',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['Connect']
            }
          ]
        });

        const channelsChannel = await interaction.guild.channels.create({
          name: '📝 Salons: 0',
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: ['Connect']
            }
          ]
        });

        // Sauvegarder dans la DB
        db.db.prepare(
          'INSERT OR REPLACE INTO stats_channels (guild_id, members_ch, bots_ch, online_ch, boosts_ch, channels_ch) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(interaction.guildId, membersChannel.id, botsChannel.id, onlineChannel.id, boostsChannel.id, channelsChannel.id);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Canaux Stats Créés')
          .setDescription(`Catégorie **📊 Stats** créée avec 5 canaux vocaux.`)
          .addFields(
            { name: '👥 Membres', value: membersChannel.toString(), inline: true },
            { name: '🤖 Bots', value: botsChannel.toString(), inline: true },
            { name: '🟢 En ligne', value: onlineChannel.toString(), inline: true },
            { name: '🚀 Boosts', value: boostsChannel.toString(), inline: true },
            { name: '📝 Salons', value: channelsChannel.toString(), inline: true }
          )
          .setFooter({ text: 'Mis à jour toutes les 10 minutes' });

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur statschannel setup:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur lors de la création des canaux.' });
      }
    }

    if (sub === 'retirer') {
      await interaction.deferReply({ ephemeral: true });

      const stats = db.db.prepare(
        'SELECT * FROM stats_channels WHERE guild_id = ?'
      ).get(interaction.guildId);

      if (!stats) {
        return await interaction.editReply({ content: '❌ Aucun canal de stats configuré.' });
      }

      try {
        // Supprimer les canaux
        for (const chId of [stats.members_ch, stats.bots_ch, stats.online_ch, stats.boosts_ch, stats.channels_ch]) {
          const channel = interaction.guild.channels.cache.get(chId);
          if (channel) await channel.delete().catch(() => {});
        }

        // Supprimer de la DB
        db.db.prepare('DELETE FROM stats_channels WHERE guild_id = ?').run(interaction.guildId);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Configuration Supprimée')
          .setDescription('Les canaux de stats ont été supprimés.');

        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur statschannel retirer:', error);
        return await interaction.editReply({ content: '❌ Erreur lors de la suppression.' });
      }
    }

    if (sub === 'statut') {
      await interaction.deferReply({ ephemeral: true });

      const stats = db.db.prepare(
        'SELECT * FROM stats_channels WHERE guild_id = ?'
      ).get(interaction.guildId);

      if (!stats) {
        return await interaction.editReply({ content: '❌ Aucun canal de stats configuré.\nUtilise `/statschannel setup` pour en créer.' });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Canaux Stats Actuels')
        .addFields(
          { name: '👥 Membres', value: `<#${stats.members_ch}>`, inline: true },
          { name: '🤖 Bots', value: `<#${stats.bots_ch}>`, inline: true },
          { name: '🟢 En ligne', value: `<#${stats.online_ch}>`, inline: true },
          { name: '🚀 Boosts', value: `<#${stats.boosts_ch}>`, inline: true },
          { name: '📝 Salons', value: `<#${stats.channels_ch}>`, inline: true }
        )
        .setFooter({ text: 'Mis à jour toutes les 10 minutes' });

      return await interaction.editReply({ embeds: [embed] });
    }
  }
};
