const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('💾 Sauvegarder et restaurer la configuration du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('creer')
      .setDescription('Créer une sauvegarde')
      .addStringOption(o => o.setName('nom').setDescription('Nom de la sauvegarde').setRequired(false).setMaxLength(100)))
    .addSubcommand(s => s.setName('restaurer')
      .setDescription('Restaurer une sauvegarde')
      .addIntegerOption(o => o.setName('id').setDescription('ID du backup').setRequired(true)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Voir les sauvegardes'))
    .addSubcommand(s => s.setName('supprimer')
      .setDescription('Supprimer une sauvegarde')
      .addIntegerOption(o => o.setName('id').setDescription('ID du backup').setRequired(true))),
  cooldown: 10,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'creer') {
      await interaction.deferReply({ ephemeral: true });

      try {
        // Vérifier le nombre de backups existants
        const isPrem = db.isPremium(interaction.guildId);
        const maxBackups = isPrem ? 20 : 5;
        const backupCount = db.db.prepare(
          'SELECT COUNT(*) as count FROM backups WHERE guild_id = ?'
        ).get(interaction.guildId).count;

        if (backupCount >= maxBackups) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            content: `❌ Limite de backups atteinte (${maxBackups}). Supprime-en pour en créer un nouveau.`
          });
        }

        // Récupérer les données
        const guildConfig = db.getConfig(interaction.guildId);
        const warningCount = db.db.prepare(
          'SELECT COUNT(*) as count FROM warnings WHERE guild_id = ?'
        ).get(interaction.guildId).count;

        const roles = (await interaction.guild.roles.fetch()).map(r => ({
          id: r.id,
          name: r.name,
          color: r.color
        }));

        const channels = interaction.guild.channels.cache.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        }));

        const premium = db.getPremium(interaction.guildId);

        const backupData = {
          guildName: interaction.guild.name,
          config: guildConfig,
          warningCount,
          rolesCount: roles.length,
          channelsCount: channels.length,
          isPremium: !!premium,
          timestamp: Date.now()
        };

        const backupName = interaction.options.getString('nom') || `Backup ${new Date().toLocaleDateString('fr-FR')}`;

        db.db.prepare(
          'INSERT INTO backups (guild_id, name, data) VALUES (?, ?, ?)'
        ).run(interaction.guildId, backupName, JSON.stringify(backupData));

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Sauvegarde Créée')
          .setDescription(`**${backupName}**`)
          .addFields(
            { name: '📋 Config', value: '✓ Sauvegardée', inline: true },
            { name: '⚠️ Avertissements', value: `${warningCount}`, inline: true },
            { name: '🏷️ Rôles', value: `${roles.length}`, inline: true },
            { name: '📍 Salons', value: `${channels.length}`, inline: true }
          );

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur backup creer:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur lors de la sauvegarde.' });
      }
    }

    if (sub === 'restaurer') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const backupId = interaction.options.getInteger('id');
        const backup = db.db.prepare(
          'SELECT * FROM backups WHERE id = ? AND guild_id = ?'
        ).get(backupId, interaction.guildId);

        if (!backup) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Sauvegarde non trouvée.' });
        }

        const data = JSON.parse(backup.data);

        // Restaurer la config
        const cfg = data.config;
        for (const key of Object.keys(cfg)) {
          if (key !== 'guild_id' && key !== 'created_at') {
            db.setConfig(interaction.guildId, key, cfg[key]);
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Sauvegarde Restaurée')
          .setDescription(`**${backup.name}** a été restaurée avec succès.`)
          .addFields(
            { name: '⚠️ Note', value: 'Seule la configuration a été restaurée. Les rôles, canaux et messages ne sont pas modifiés.' }
          );

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur backup restaurer:', error);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur lors de la restauration.' });
      }
    }

    if (sub === 'liste') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const backups = db.db.prepare(
          'SELECT * FROM backups WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10'
        ).all(interaction.guildId);

        const embed = new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle('💾 Sauvegardes');

        if (backups.length > 0) {
          const fields = backups.map(b => {
            const date = new Date(b.created_at * 1000).toLocaleDateString('fr-FR');
            return {
              name: `#${b.id} • ${b.name}`,
              value: `📅 ${date}`,
              inline: false
            };
          });
          embed.addFields(...fields);
        } else {
          embed.setDescription('Aucune sauvegarde trouvée.');
        }

        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur backup liste:', error);
        return await interaction.editReply({ content: '❌ Erreur lors de la récupération des sauvegardes.' });
      }
    }

    if (sub === 'supprimer') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const backupId = interaction.options.getInteger('id');
        const backup = db.db.prepare(
          'SELECT * FROM backups WHERE id = ? AND guild_id = ?'
        ).get(backupId, interaction.guildId);

        if (!backup) {
          return await interaction.editReply({ content: '❌ Sauvegarde non trouvée.' });
        }

        db.db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Sauvegarde Supprimée')
          .setDescription(`**${backup.name}** a été supprimée.`);

        return await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur backup supprimer:', error);
        return await interaction.editReply({ content: '❌ Erreur lors de la suppression.' });
      }
    }
  }
};
