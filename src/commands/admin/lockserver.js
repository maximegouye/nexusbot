const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS lockserver_state (
    guild_id TEXT PRIMARY KEY,
    locked INTEGER DEFAULT 0,
    reason TEXT,
    locked_at INTEGER,
    channel_states TEXT
  )
`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockserver')
    .setDescription('🔐 Verrouiller TOUS les salons du serveur en urgence')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('verrouiller')
      .setDescription('Verrouiller tous les canaux texte')
      .addStringOption(o => o.setName('raison').setDescription('Raison du verrouillage').setRequired(false).setMaxLength(200)))
    .addSubcommand(s => s.setName('deverrouiller')
      .setDescription('Déverrouiller tous les canaux texte')),
  cooldown: 15,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'verrouiller') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const raison = interaction.options.getString('raison') || 'Modération requise';
        const now = Math.floor(Date.now() / 1000);

        // Récupérer tous les canaux texte
        const textChannels = interaction.guild.channels.cache.filter(
          c => c.isTextBased() && c.isSendable()
        );

        if (textChannels.size === 0) {
          return interaction.editReply({ content: '❌ Aucun canal texte à verrouiller.' });
        }

        const channelStates = {};
        let processed = 0;

        // Verrouiller chaque canal
        for (const channel of textChannels.values()) {
          try {
            // Sauvegarder l'état actuel
            const perms = channel.permissionsFor(interaction.guild.roles.everyone);
            channelStates[channel.id] = {
              name: channel.name,
              canSend: perms ? perms.has(PermissionFlagsBits.SendMessages) : true
            };

            // Verrouiller
            await channel.permissionOverwrites.edit(
              interaction.guild.roles.everyone,
              { SendMessages: false },
              'Lockserver par ' + interaction.user.tag
            );

            // Envoyer un message d'urgence
            const lockEmbed = new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🔐 SERVEUR VERROUILLÉ')
              .setDescription(raison)
              .setFooter({ text: 'Action par ' + interaction.user.username });

            await channel.send({ embeds: [lockEmbed] }).catch(() => {});

            processed++;
          } catch (err) {
            // Ignorer les erreurs pour les canaux spécifiques
          }
        }

        // Sauvegarder l'état dans la DB
        db.db.prepare(
          'INSERT OR REPLACE INTO lockserver_state (guild_id, locked, reason, locked_at, channel_states) VALUES (?, ?, ?, ?, ?)'
        ).run(interaction.guildId, 1, raison, now, JSON.stringify(channelStates));

        const embed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🔐 Serveur Verrouillé')
          .setDescription(`**${processed}** canal(aux) verrouillé(s)`)
          .addFields(
            { name: '📝 Raison', value: raison },
            { name: '🕐 Heure', value: new Date().toLocaleString('fr-FR') }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur lockserver verrouiller:', error);
        return interaction.editReply({ content: '❌ Erreur lors du verrouillage.' });
      }
    }

    if (sub === 'deverrouiller') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const state = db.db.prepare(
          'SELECT * FROM lockserver_state WHERE guild_id = ?'
        ).get(interaction.guildId);

        if (!state || !state.locked) {
          return interaction.editReply({ content: '❌ Le serveur n\'est pas verrouillé.' });
        }

        const channelStates = JSON.parse(state.channel_states || '{}');
        const textChannels = interaction.guild.channels.cache.filter(
          c => c.isTextBased() && c.isSendable()
        );

        let processed = 0;

        // Déverrouiller chaque canal
        for (const channel of textChannels.values()) {
          try {
            const prevState = channelStates[channel.id];

            // Si le canal avait SendMessages avant, le réactiver
            if (prevState && prevState.canSend) {
              await channel.permissionOverwrites.delete(
                interaction.guild.roles.everyone,
                'Unlock serveur par ' + interaction.user.tag
              );
            } else {
              // Sinon, garder bloqué
              await channel.permissionOverwrites.edit(
                interaction.guild.roles.everyone,
                { SendMessages: false }
              );
            }

            // Envoyer un message de déverrouillage
            const unlockEmbed = new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('🔓 SERVEUR DÉVERROUILLÉ')
              .setDescription('Le serveur est à nouveau actif.')
              .setFooter({ text: 'Action par ' + interaction.user.username });

            await channel.send({ embeds: [unlockEmbed] }).catch(() => {});

            processed++;
          } catch (err) {
            // Ignorer les erreurs
          }
        }

        // Mettre à jour la DB
        db.db.prepare(
          'UPDATE lockserver_state SET locked = 0 WHERE guild_id = ?'
        ).run(interaction.guildId);

        const embed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🔓 Serveur Déverrouillé')
          .setDescription(`**${processed}** canal(aux) déverrouillé(s)`)
          .setFooter({ text: new Date().toLocaleString('fr-FR') });

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Erreur lockserver deverrouiller:', error);
        return interaction.editReply({ content: '❌ Erreur lors du déverrouillage.' });
      }
    }
  }
};
