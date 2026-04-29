'use strict';
/**
 * NexusBot — /staff-channel
 * Crée ou configure un salon privé réservé aux admins et modérateurs.
 */
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ChannelType, OverwriteType
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-channel')
    .setDescription('🔒 Gérer le salon staff privé (admins + mods)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s
      .setName('creer')
      .setDescription('✨ Crée la catégorie et les salons staff')
      .addRoleOption(o => o.setName('role-mod').setDescription('Rôle modérateur à autoriser').setRequired(false))
      .addRoleOption(o => o.setName('role-admin').setDescription('Rôle admin (en plus de la permission Admin)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('ajouter-role')
      .setDescription('➕ Donner accès au staff-channel à un rôle')
      .addRoleOption(o => o.setName('role').setDescription('Rôle à autoriser').setRequired(true))
      .addChannelOption(o => o.setName('salon').setDescription('Salon staff cible (laissez vide = auto-détecter)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('verrou')
      .setDescription('🔐 Vérouiller/déverrouiller le salon staff pour @everyone')
      .addBooleanOption(o => o.setName('lock').setDescription('true = verrouiller, false = déverrouiller').setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* déjà ack */ }
    }

    const reply = async (data) => {
      try { return await interaction.editReply(data); }
      catch (e) { console.error('[staff-channel] editReply:', e?.message); }
    };

    const guild   = interaction.guild;
    const sub     = interaction.options.getSubcommand();
    const everyone = guild.roles.everyone;

    // ─── Créer ──────────────────────────────────────────────────────────────
    if (sub === 'creer') {
      const roleMod   = interaction.options.getRole('role-mod');
      const roleAdmin = interaction.options.getRole('role-admin');

      // Permissions de base : @everyone bloqué
      const permOverwrites = [
        { id: everyone.id,       deny:  [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ];
      if (roleMod)   permOverwrites.push({ id: roleMod.id,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
      if (roleAdmin) permOverwrites.push({ id: roleAdmin.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });

      // Cherche si la catégorie existe déjà
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('staff')
      );

      if (!category) {
        category = await guild.channels.create({
          name: '┈ ・ STAFF ・ ┈',
          type: ChannelType.GuildCategory,
          permissionOverwrites: permOverwrites,
          reason: '/staff-channel creer',
        });
      }

      const created = [];
      const toCreate = [
        { name: '・🛡️・staff-général',       topic: 'Discussion interne staff.' },
        { name: '・📋・décisions',            topic: 'Décisions et votes modération.' },
        { name: '・🔨・sanctions-log',        topic: 'Log manuel des sanctions. Voir aussi /admin' },
        { name: '・📢・annonces-staff',       topic: 'Annonces réservées au staff.' },
        { name: '・🤖・commandes-bot',        topic: 'Commandes bot en privé.' },
      ];

      for (const ch of toCreate) {
        const exists = guild.channels.cache.find(
          c => c.name === ch.name && c.parentId === category.id
        );
        if (!exists) {
          const newCh = await guild.channels.create({
            name: ch.name,
            type: ChannelType.GuildText,
            topic: ch.topic,
            parent: category.id,
            permissionOverwrites: permOverwrites,
            reason: '/staff-channel creer',
          });
          created.push(newCh.toString());
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🔒 Salon Staff créé')
        .setDescription(
          created.length
            ? `**${created.length} salon(s) créé(s) :**\n${created.join('\n')}`
            : '✅ Tous les salons staff existent déjà.'
        )
        .addFields(
          { name: '📁 Catégorie',     value: category.toString(), inline: true },
          { name: '🛡️ Rôle Mod',     value: roleMod  ? roleMod.toString()   : '*Non spécifié*', inline: true },
          { name: '👑 Rôle Admin',    value: roleAdmin ? roleAdmin.toString() : '*Non spécifié*', inline: true },
          { name: '🚫 @everyone',     value: '❌ Accès refusé', inline: true },
        )
        .setFooter({ text: 'Utilise /staff-channel ajouter-role pour ajouter d\'autres rôles' })
        .setTimestamp();

      return reply({ embeds: [embed] });
    }

    // ─── Ajouter rôle ───────────────────────────────────────────────────────
    if (sub === 'ajouter-role') {
      const role  = interaction.options.getRole('role');
      let channel = interaction.options.getChannel('salon');

      if (!channel) {
        channel = guild.channels.cache.find(
          c => c.name.includes('staff-général') || c.name.includes('staff-general')
        );
      }
      if (!channel) return reply({ content: '❌ Aucun salon staff trouvé. Lance `/staff-channel creer` d\'abord.' });

      // Appliquer la permission à toute la catégorie si possible
      const targets = channel.parent
        ? guild.channels.cache.filter(c => c.parentId === channel.parent.id)
        : [channel];

      for (const ch of targets.values()) {
        await ch.permissionOverwrites.edit(role, {
          ViewChannel: true,
          SendMessages: true,
        }).catch(() => {});
      }

      return reply({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ ${role} a maintenant accès au staff channel (${targets.size} salon(s) mis à jour).`)
      ]});
    }

    // ─── Verrou ─────────────────────────────────────────────────────────────
    if (sub === 'verrou') {
      const lock = interaction.options.getBoolean('lock');

      const staffChannels = guild.channels.cache.filter(
        c => c.name.includes('staff') && c.type === ChannelType.GuildText
      );
      if (!staffChannels.size) return reply({ content: '❌ Aucun salon staff trouvé.' });

      for (const ch of staffChannels.values()) {
        await ch.permissionOverwrites.edit(everyone, {
          ViewChannel: false,
          SendMessages: lock ? false : null,
        }).catch(() => {});
      }

      return reply({ embeds: [new EmbedBuilder()
        .setColor(lock ? '#E74C3C' : '#2ECC71')
        .setDescription(`${lock ? '🔐 Salons staff verrouillés' : '🔓 Salons staff déverrouillés'} pour @everyone (${staffChannels.size} salon(s)).`)
      ]});
    }
  },
};
