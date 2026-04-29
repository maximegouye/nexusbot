const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const db = require('../../database/db');

// Cache anti-nuke : {guildId: {userId: {action: count, lastReset: timestamp}}}
const nukeCache = new Map();
const THRESHOLDS = { ban: 3, kick: 5, channel_delete: 3, role_delete: 3, webhook_create: 5 };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('🛡️ Configuration de la protection anti-nuke')
    .addSubcommand(s => s.setName('activer').setDescription('✅ Activer la protection anti-nuke'))
    .addSubcommand(s => s.setName('desactiver').setDescription('❌ Désactiver la protection anti-nuke'))
    .addSubcommand(s => s.setName('statut').setDescription('📊 Voir le statut de la protection'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'activer') {
      db.setConfig(interaction.guildId, 'automod_enabled', 1);
      db.db.prepare("UPDATE guild_config SET automod_enabled = 1 WHERE guild_id = ?").run(interaction.guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🛡️ Anti-Nuke Activé !')
          .setDescription(
            'Le système anti-nuke surveille maintenant les actions suspectes :\n\n' +
            `🔨 Bans en masse : > ${THRESHOLDS.ban} en 10s → kick + ban du responsable\n` +
            `👢 Kicks en masse : > ${THRESHOLDS.kick} en 10s → kick du responsable\n` +
            `📛 Suppressions de salons : > ${THRESHOLDS.channel_delete} en 10s → kick\n` +
            `🎭 Suppressions de rôles : > ${THRESHOLDS.role_delete} en 10s → kick\n` +
            `🪝 Webhooks suspects : > ${THRESHOLDS.webhook_create} en 10s → kick`
          )
          .setFooter({ text: 'Configurez un salon de logs pour être alerté !' })
        ]
      });
    }

    if (sub === 'desactiver') {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setDescription('❌ Protection anti-nuke désactivée.\n\n⚠️ Votre serveur n\'est plus protégé contre les nukes !')
        ]
      });
    }

    if (sub === 'statut') {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(cfg.automod_enabled ? '#2ECC71' : '#E74C3C')
          .setTitle('🛡️ Statut Anti-Nuke')
          .setDescription(cfg.automod_enabled ? '✅ Protection **ACTIVE**' : '❌ Protection **INACTIVE**')
          .addFields(
            { name: '🔨 Seuil Bans', value: `${THRESHOLDS.ban}/10s`, inline: true },
            { name: '👢 Seuil Kicks', value: `${THRESHOLDS.kick}/10s`, inline: true },
            { name: '📛 Seuil Suppressions', value: `${THRESHOLDS.channel_delete}/10s`, inline: true },
          )
        ]
      });
    }
  },

  // Méthode à appeler depuis les events guild
  async checkNuke(guild, userId, action) {
    const cfg = db.getConfig(guild.id);
    if (!cfg.automod_enabled) return;

    // Ignorer le propriétaire
    if (guild.ownerId === userId) return;

    if (!nukeCache.has(guild.id)) nukeCache.set(guild.id, new Map());
    const guildCache = nukeCache.get(guild.id);
    if (!guildCache.has(userId)) guildCache.set(userId, { counts: {}, lastReset: Date.now() });

    const userData = guildCache.get(userId);
    const now = Date.now();

    // Reset toutes les 10 secondes
    if (now - userData.lastReset > 10000) {
      userData.counts = {};
      userData.lastReset = now;
    }

    userData.counts[action] = (userData.counts[action] || 0) + 1;
    const threshold = THRESHOLDS[action];

    if (threshold && userData.counts[action] >= threshold) {
      // Réinitialiser pour éviter les doublons
      userData.counts[action] = 0;

      const member = guild.members.cache.get(userId);
      if (!member) return;

      try {
        // Retirer tous les rôles dangereux
        await member.roles.set([]);
        await member.ban({ reason: `[Anti-Nuke] ${action} en masse détecté` });

        // Alerte
        const cfg2 = db.getConfig(guild.id);
        const alertCh = guild.channels.cache.get(cfg2.mod_log_channel || cfg2.log_channel);
        if (alertCh) {
          alertCh.send({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚨 ANTI-NUKE — ACTION AUTOMATIQUE')
              .setDescription(
                `**${member.user.username}** a été **banni automatiquement** pour avoir effectué des actions massives !\n\n` +
                `⚠️ Action : **${action}** (${userData.counts[action] + threshold} fois)\n` +
                `🛡️ Serveur protégé !`
              )
              .setTimestamp()
            ]
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
