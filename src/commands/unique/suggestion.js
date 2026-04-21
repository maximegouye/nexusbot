const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
  ChannelType, StringSelectMenuBuilder
} = require('discord.js');
const db = require('../../database/db');

// ── Migrations ────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    texte TEXT NOT NULL,
    statut TEXT DEFAULT 'pending',
    message_id TEXT,
    channel_id TEXT,
    staff_id TEXT,
    staff_comment TEXT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('suggestion_channel')) db.db.prepare("ALTER TABLE guild_config ADD COLUMN suggestion_channel TEXT").run();
  if (!gc.includes('suggestion_log_channel')) db.db.prepare("ALTER TABLE guild_config ADD COLUMN suggestion_log_channel TEXT").run();
} catch {}

// ── Constantes ───────────────────────────────────────────
const STATUS_COLORS = {
  pending: '#FFD700',    // Or
  approved: '#2ECC71',   // Vert
  rejected: '#E74C3C',   // Rouge
  inprogress: '#E67E22'  // Orange
};

const STATUS_LABELS = {
  pending: '⏳ En attente',
  approved: '✅ Approuvée',
  rejected: '❌ Refusée',
  inprogress: '🔄 En cours'
};

function getStatusColor(statut) {
  return STATUS_COLORS[statut] || '#7B2FBE';
}

function getStatusLabel(statut) {
  return STATUS_LABELS[statut] || statut;
}

// ── Helpers ───────────────────────────────────────────────
function isStaff(member, cfg) {
  return (
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    (cfg.ticket_staff_role && member.roles.cache.has(cfg.ticket_staff_role))
  );
}

async function buildSuggestionEmbed(suggestion, guild) {
  const user = await guild.client.users.fetch(suggestion.user_id).catch(() => null);
  const userName = user?.username || 'Utilisateur inconnu';

  let embed = new EmbedBuilder()
    .setColor(getStatusColor(suggestion.statut))
    .setTitle(`💡 Suggestion #${suggestion.id}`)
    .setDescription(suggestion.texte)
    .addFields(
      { name: '👤 Auteur', value: `<@${suggestion.user_id}> (${userName})`, inline: true },
      { name: '📊 Statut', value: getStatusLabel(suggestion.statut), inline: true },
      { name: '👍 Votes positifs', value: String(suggestion.upvotes), inline: true },
      { name: '👎 Votes négatifs', value: String(suggestion.downvotes), inline: true }
    )
    .setFooter({ text: `ID: ${suggestion.id}` })
    .setTimestamp(suggestion.created_at * 1000);

  if (suggestion.staff_comment) {
    embed.addFields({
      name: '📝 Commentaire staff',
      value: suggestion.staff_comment,
      inline: false
    });
  }

  if (suggestion.staff_id && suggestion.statut !== 'pending') {
    const staff = await guild.client.users.fetch(suggestion.staff_id).catch(() => null);
    embed.addFields({
      name: '👨‍⚖️ Traité par',
      value: staff?.username || 'Utilisateur inconnu',
      inline: true
    });
  }

  return embed;
}

// ════════════════════════════════════════════════════════════
// COMMANDE PRINCIPALE
// ════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('💡 Système de suggestions')
    .addSubcommand(s => s
      .setName('envoyer')
      .setDescription('✉️ Envoyer une nouvelle suggestion')
      .addStringOption(o => o
        .setName('texte')
        .setDescription('Contenu de votre suggestion')
        .setRequired(true)
        .setMaxLength(2000)
      )
    )
    .addSubcommand(s => s
      .setName('approuver')
      .setDescription('✅ Approuver une suggestion (Staff)')
      .addStringOption(o => o
        .setName('id')
        .setDescription('ID de la suggestion')
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName('commentaire')
        .setDescription('Commentaire optionnel')
        .setRequired(false)
        .setMaxLength(1000)
      )
    )
    .addSubcommand(s => s
      .setName('refuser')
      .setDescription('❌ Refuser une suggestion (Staff)')
      .addStringOption(o => o
        .setName('id')
        .setDescription('ID de la suggestion')
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName('raison')
        .setDescription('Raison du refus')
        .setRequired(false)
        .setMaxLength(1000)
      )
    )
    .addSubcommand(s => s
      .setName('encours')
      .setDescription('🔄 Marquer une suggestion comme en cours (Staff)')
      .addStringOption(o => o
        .setName('id')
        .setDescription('ID de la suggestion')
        .setRequired(true)
      )
      .addStringOption(o => o
        .setName('commentaire')
        .setDescription('Commentaire optionnel')
        .setRequired(false)
        .setMaxLength(1000)
      )
    )
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('⚙️ Configurer les salons des suggestions (Admin)')
      .addChannelOption(o => o
        .setName('salon')
        .setDescription('Salon des suggestions')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption(o => o
        .setName('salon-logs')
        .setDescription('Salon des logs (optionnel)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
      )
    )
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('👀 Voir les détails d\'une suggestion')
      .addStringOption(o => o
        .setName('id')
        .setDescription('ID de la suggestion')
        .setRequired(true)
      )
    )
    .addSubcommand(s => s
      .setName('liste')
      .setDescription('📋 Voir la liste des suggestions')
      .addStringOption(o => o
        .setName('statut')
        .setDescription('Filtrer par statut')
        .setRequired(false)
        .addChoices(
          { name: '⏳ En attente', value: 'pending' },
          { name: '✅ Approuvées', value: 'approved' },
          { name: '❌ Refusées', value: 'rejected' },
          { name: '🔄 En cours', value: 'inprogress' }
        )
      )
    )
    .addSubcommand(s => s
      .setName('masuggestions')
      .setDescription('🧑‍💼 Voir vos suggestions et leur statut')
    ),

  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);
    const guild = interaction.guild;

    // ══════════════════════════════ ENVOYER ══════════════════
    if (sub === 'envoyer') {
      if (!cfg.suggestion_channel) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Aucun salon de suggestions configuré. Demandez à l\'admin d\'exécuter `/suggestion setup`.')
          ],
          ephemeral: true
        });
      }

      const texte = interaction.options.getString('texte');
      const channel = guild.channels.cache.get(cfg.suggestion_channel);

      if (!channel) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Le salon de suggestions n\'existe plus.')
          ],
          ephemeral: true
        });
      }

      // Insérer dans la DB
      const insert = db.db.prepare(`
        INSERT INTO suggestions (guild_id, user_id, texte, channel_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = insert.run(
        interaction.guildId,
        interaction.user.id,
        texte,
        channel.id,
        Math.floor(Date.now() / 1000)
      );
      const suggestionId = result.lastInsertRowid;

      // Créer l'embed
      const suggestionEmbed = new EmbedBuilder()
        .setColor(getStatusColor('pending'))
        .setTitle(`💡 Suggestion #${suggestionId}`)
        .setDescription(texte)
        .addFields(
          { name: '👤 Auteur', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📊 Statut', value: getStatusLabel('pending'), inline: true },
          { name: '👍 Votes positifs', value: '0', inline: true },
          { name: '👎 Votes négatifs', value: '0', inline: true }
        )
        .setFooter({ text: `ID: ${suggestionId}` })
        .setTimestamp();

      // Envoyer le message dans le salon
      const msg = await channel.send({ embeds: [suggestionEmbed] }).catch(() => null);
      if (!msg) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setDescription('❌ Impossible d\'envoyer la suggestion au salon configuré.')
          ],
          ephemeral: true
        });
      }

      // Mettre à jour les IDs dans la DB
      db.db.prepare('UPDATE suggestions SET message_id=? WHERE id=?').run(msg.id, suggestionId);

      // Ajouter les réactions
      try {
        await msg.react('👍');
        await msg.react('👎');
      } catch {}

      // Créer un thread
      const thread = await msg.startThread({
        name: `Discussion - Suggestion #${suggestionId}`,
        autoArchiveDuration: 4320 // 3 jours
      }).catch(() => null);

      if (thread) {
        const threadEmbed = new EmbedBuilder()
          .setColor('#7B2FBE')
          .setDescription(
            `Bienvenue dans la discussion pour la suggestion #${suggestionId}!\n\n` +
            `Voici un espace pour discuter de cette suggestion avec les autres membres.`
          );
        await thread.send({ embeds: [threadEmbed] }).catch(() => {});
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Suggestion envoyée')
          .setDescription(`Votre suggestion #${suggestionId} a été publiée avec succès!\n\n` +
            `Merci de votre contribution!`)
          .setFields(
            { name: '📍 Salon', value: `${channel}`, inline: true },
            { name: '🔗 Lien', value: `[Voir la suggestion](${msg.url})`, inline: true }
          )
        ],
        ephemeral: true
      });
    }

    // ══════════════════════════════ APPROUVER ════════════════
    if (sub === 'approuver') {
      if (!isStaff(interaction.member, cfg)) {
        return interaction.reply({
          content: '❌ Permission insuffisante.',
          ephemeral: true
        });
      }

      const id = parseInt(interaction.options.getString('id'));
      const commentaire = interaction.options.getString('commentaire');
      const suggestion = db.db.prepare('SELECT * FROM suggestions WHERE id=? AND guild_id=?')
        .get(id, interaction.guildId);

      if (!suggestion) {
        return interaction.reply({
          content: '❌ Suggestion introuvable.',
          ephemeral: true
        });
      }

      // Mettre à jour
      db.db.prepare('UPDATE suggestions SET statut=?, staff_id=?, staff_comment=? WHERE id=?')
        .run('approved', interaction.user.id, commentaire, id);

      // Mettre à jour le message
      if (suggestion.message_id && suggestion.channel_id) {
        const channel = guild.channels.cache.get(suggestion.channel_id);
        if (channel) {
          const msg = await channel.messages.fetch(suggestion.message_id).catch(() => null);
          if (msg) {
            const updatedEmbed = await buildSuggestionEmbed(
              { ...suggestion, statut: 'approved', staff_id: interaction.user.id, staff_comment: commentaire },
              guild
            );
            await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
          }
        }
      }

      // Log
      if (cfg.suggestion_log_channel) {
        const logChannel = guild.channels.cache.get(cfg.suggestion_log_channel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Suggestion approuvée')
            .addFields(
              { name: 'ID', value: String(id), inline: true },
              { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Contenu', value: suggestion.texte, inline: false }
            );
          if (commentaire) logEmbed.addFields({ name: 'Commentaire', value: commentaire, inline: false });
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ Suggestion #${id} approuvée avec succès!`)
        ],
        ephemeral: true
      });
    }

    // ══════════════════════════════ REFUSER ═══════════════════
    if (sub === 'refuser') {
      if (!isStaff(interaction.member, cfg)) {
        return interaction.reply({
          content: '❌ Permission insuffisante.',
          ephemeral: true
        });
      }

      const id = parseInt(interaction.options.getString('id'));
      const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée';
      const suggestion = db.db.prepare('SELECT * FROM suggestions WHERE id=? AND guild_id=?')
        .get(id, interaction.guildId);

      if (!suggestion) {
        return interaction.reply({
          content: '❌ Suggestion introuvable.',
          ephemeral: true
        });
      }

      // Mettre à jour
      db.db.prepare('UPDATE suggestions SET statut=?, staff_id=?, staff_comment=? WHERE id=?')
        .run('rejected', interaction.user.id, raison, id);

      // Mettre à jour le message
      if (suggestion.message_id && suggestion.channel_id) {
        const channel = guild.channels.cache.get(suggestion.channel_id);
        if (channel) {
          const msg = await channel.messages.fetch(suggestion.message_id).catch(() => null);
          if (msg) {
            const updatedEmbed = await buildSuggestionEmbed(
              { ...suggestion, statut: 'rejected', staff_id: interaction.user.id, staff_comment: raison },
              guild
            );
            await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
          }
        }
      }

      // Log
      if (cfg.suggestion_log_channel) {
        const logChannel = guild.channels.cache.get(cfg.suggestion_log_channel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('❌ Suggestion refusée')
            .addFields(
              { name: 'ID', value: String(id), inline: true },
              { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Contenu', value: suggestion.texte, inline: false },
              { name: 'Raison', value: raison, inline: false }
            );
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setDescription(`❌ Suggestion #${id} refusée.`)
        ],
        ephemeral: true
      });
    }

    // ══════════════════════════════ ENCOURS ═══════════════════
    if (sub === 'encours') {
      if (!isStaff(interaction.member, cfg)) {
        return interaction.reply({
          content: '❌ Permission insuffisante.',
          ephemeral: true
        });
      }

      const id = parseInt(interaction.options.getString('id'));
      const commentaire = interaction.options.getString('commentaire');
      const suggestion = db.db.prepare('SELECT * FROM suggestions WHERE id=? AND guild_id=?')
        .get(id, interaction.guildId);

      if (!suggestion) {
        return interaction.reply({
          content: '❌ Suggestion introuvable.',
          ephemeral: true
        });
      }

      // Mettre à jour
      db.db.prepare('UPDATE suggestions SET statut=?, staff_id=?, staff_comment=? WHERE id=?')
        .run('inprogress', interaction.user.id, commentaire, id);

      // Mettre à jour le message
      if (suggestion.message_id && suggestion.channel_id) {
        const channel = guild.channels.cache.get(suggestion.channel_id);
        if (channel) {
          const msg = await channel.messages.fetch(suggestion.message_id).catch(() => null);
          if (msg) {
            const updatedEmbed = await buildSuggestionEmbed(
              { ...suggestion, statut: 'inprogress', staff_id: interaction.user.id, staff_comment: commentaire },
              guild
            );
            await msg.edit({ embeds: [updatedEmbed] }).catch(() => {});
          }
        }
      }

      // Log
      if (cfg.suggestion_log_channel) {
        const logChannel = guild.channels.cache.get(cfg.suggestion_log_channel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor('#E67E22')
            .setTitle('🔄 Suggestion en cours')
            .addFields(
              { name: 'ID', value: String(id), inline: true },
              { name: 'Staff', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Contenu', value: suggestion.texte, inline: false }
            );
          if (commentaire) logEmbed.addFields({ name: 'Commentaire', value: commentaire, inline: false });
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E67E22')
          .setDescription(`🔄 Suggestion #${id} marquée comme en cours.`)
        ],
        ephemeral: true
      });
    }

    // ══════════════════════════════ SETUP ════════════════════
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: '❌ Permission insuffisante.',
          ephemeral: true
        });
      }

      const channel = interaction.options.getChannel('salon');
      const logChannel = interaction.options.getChannel('salon-logs');

      db.db.prepare('UPDATE guild_config SET suggestion_channel=? WHERE guild_id=?')
        .run(channel.id, interaction.guildId);

      if (logChannel) {
        db.db.prepare('UPDATE guild_config SET suggestion_log_channel=? WHERE guild_id=?')
          .run(logChannel.id, interaction.guildId);
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Configuration appliquée')
          .addFields(
            { name: '📍 Salon suggestions', value: `${channel}`, inline: true },
            { name: '📋 Salon logs', value: logChannel ? `${logChannel}` : 'Non configuré', inline: true }
          )
        ],
        ephemeral: true
      });
    }

    // ══════════════════════════════ VOIR ══════════════════════
    if (sub === 'voir') {
      const id = parseInt(interaction.options.getString('id'));
      const suggestion = db.db.prepare('SELECT * FROM suggestions WHERE id=? AND guild_id=?')
        .get(id, interaction.guildId);

      if (!suggestion) {
        return interaction.reply({
          content: '❌ Suggestion introuvable.',
          ephemeral: true
        });
      }

      const embed = await buildSuggestionEmbed(suggestion, guild);
      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ══════════════════════════════ LISTE ═════════════════════
    if (sub === 'liste') {
      const statut = interaction.options.getString('statut');
      let suggestions;

      if (statut) {
        suggestions = db.db.prepare('SELECT * FROM suggestions WHERE guild_id=? AND statut=? ORDER BY created_at DESC LIMIT 25')
          .all(interaction.guildId, statut);
      } else {
        suggestions = db.db.prepare('SELECT * FROM suggestions WHERE guild_id=? ORDER BY created_at DESC LIMIT 25')
          .all(interaction.guildId);
      }

      if (suggestions.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setDescription('📭 Aucune suggestion trouvée.')
          ],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📋 Liste des suggestions')
        .setDescription(
          suggestions.map(s =>
            `**#${s.id}** — ${getStatusLabel(s.statut)} | ${s.texte.substring(0, 50)}${s.texte.length > 50 ? '...' : ''}`
          ).join('\n')
        )
        .setFooter({ text: `Total: ${suggestions.length}` });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }

    // ══════════════════════════════ MASUGGESTIONS ═════════════
    if (sub === 'masuggestions') {
      const suggestions = db.db.prepare('SELECT * FROM suggestions WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 25')
        .all(interaction.guildId, interaction.user.id);

      if (suggestions.length === 0) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setDescription('📭 Vous n\'avez pas encore envoyé de suggestions.')
          ],
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🧑‍💼 Vos suggestions')
        .setDescription(
          suggestions.map(s =>
            `**#${s.id}** — ${getStatusLabel(s.statut)} | ${s.texte.substring(0, 50)}${s.texte.length > 50 ? '...' : ''}`
          ).join('\n')
        )
        .setFooter({ text: `Total: ${suggestions.length}` });

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  }
};
