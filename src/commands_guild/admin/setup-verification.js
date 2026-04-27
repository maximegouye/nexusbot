const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const COLOR = 0x5865F2;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verification')
    .setDescription('Configure le système de vérification anti-bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('activer')
      .setDescription('Activer la vérification anti-bot')
      .addRoleOption(o => o.setName('role').setDescription('Rôle "Non vérifié" à assigner').setRequired(true)))
    .addSubcommand(sub => sub.setName('desactiver')
      .setDescription('Désactiver la vérification anti-bot'))
    .addSubcommand(sub => sub.setName('statut')
      .setDescription('Afficher la configuration actuelle')),

  category: 'admin',

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply({ content: '🚫 Réservé aux modérateurs.', ephemeral: true }).catch(() => {});
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const reply = (data) => interaction.editReply(data).catch(() => {});

    // ── Activer ────────────────────────────────────────────────
    if (sub === 'activer') {
      const role = interaction.options.getRole('role');
      if (!role) {
        return reply({ embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Erreur')
          .setDescription('Le rôle spécifié est invalide.')
          .setTimestamp()] });
      }

      // Sauvegarder dans la DB
      try {
        db.setConfig(guildId, 'verification_role', role.id);
      } catch (e) {
        console.error('[VERIFICATION] setConfig error:', e);
        return reply({ embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Erreur DB')
          .setDescription(`Erreur lors de la sauvegarde: ${e?.message || 'Inconnue'}`)
          .setTimestamp()] });
      }

      return reply({ embeds: [new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Vérification activée')
        .setDescription(`Le rôle **${role.name}** sera assigné aux nouveaux membres pour vérification.`)
        .addFields(
          { name: '📋 Fonctionnement', value: 'Les nouveaux membres recevront un DM avec un bouton. Après clic, le rôle est retiré et ils peuvent accéder au serveur.', inline: false },
          { name: '⏱️ Délai d\'expiration', value: 'Les membres non vérifiés dans les 10 minutes seront expulsés.', inline: false }
        )
        .setFooter({ text: `Configuré par ${interaction.user.username}` })
        .setTimestamp()] });
    }

    // ── Désactiver ─────────────────────────────────────────────
    if (sub === 'desactiver') {
      try {
        db.setConfig(guildId, 'verification_role', null);
      } catch (e) {
        console.error('[VERIFICATION] setConfig error:', e);
        return reply({ embeds: [new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Erreur DB')
          .setDescription(`Erreur lors de la sauvegarde: ${e?.message || 'Inconnue'}`)
          .setTimestamp()] });
      }

      return reply({ embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Vérification désactivée')
        .setDescription('Les nouveaux membres ne recevront plus de demande de vérification.')
        .setFooter({ text: `Configuré par ${interaction.user.username}` })
        .setTimestamp()] });
    }

    // ── Statut ─────────────────────────────────────────────────
    if (sub === 'statut') {
      const cfg = db.getConfig(guildId);
      const isActive = cfg.verification_role ? true : false;

      let statusText = '❌ **Désactivée**';
      if (isActive) {
        const role = interaction.guild.roles.cache.get(cfg.verification_role);
        statusText = role
          ? `✅ **Activée**\n\nRôle de vérification: ${role}`
          : `⚠️ **Activée mais rôle introuvable** (ID: \`${cfg.verification_role}\`)`;
      }

      return reply({ embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🔒 Statut de la vérification anti-bot')
        .setDescription(statusText)
        .addFields(
          { name: '📋 Fonctionnement', value: 'Assign un rôle aux nouveaux membres. Après vérification, le rôle est retiré.', inline: false },
          { name: '⏱️ Timeout', value: '10 minutes sans vérification = expulsion', inline: false }
        )
        .setFooter({ text: `Serveur: ${interaction.guild.name}` })
        .setTimestamp()] });
    }
  }
};
