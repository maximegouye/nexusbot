const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('⛔ Bannir temporairement un membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
    .addIntegerOption(o => o.setName('duree').setDescription('Durée du ban en heures').setMinValue(1).setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
      return interaction.editReply.bind(interaction)({ content: '❌ Permission insuffisante.', ephemeral: true });

    const target  = interaction.options.getUser('membre');
    const duree   = interaction.options.getInteger('duree');
    const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';
    const member  = interaction.guild.members.cache.get(target.id);

    if (target.id === interaction.user.id)
      return interaction.editReply.bind(interaction)({ content: '❌ Tu ne peux pas te bannir toi-même.', ephemeral: true });

    if (member && member.roles.highest.position >= interaction.member.roles.highest.position)
      return interaction.editReply.bind(interaction)({ content: '❌ Tu ne peux pas bannir ce membre (rôle supérieur ou égal).', ephemeral: true });

    const expiresAt = Math.floor(Date.now() / 1000) + duree * 3600;

    try {
      // DM avant le ban
      await target.send({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle(`⛔ Tu as été banni de ${interaction.guild.name}`)
          .addFields(
            { name: '⏱️ Durée', value: `${duree} heure${duree > 1 ? 's' : ''}`, inline: true },
            { name: '📋 Raison', value: raison, inline: true },
            { name: '📅 Débannissement', value: `<t:${expiresAt}:R>`, inline: true },
          )
        ]
      }).catch(() => {});

      await interaction.guild.bans.create(target, { reason: `[TempBan ${duree}h] ${raison} — par ${interaction.user.username}` });

      // Sauvegarder en DB
      db.db.prepare('INSERT INTO tempbans (guild_id, user_id, mod_id, reason, expires_at) VALUES (?, ?, ?, ?, ?)')
        .run(interaction.guildId, target.id, interaction.user.id, raison, expiresAt);

      // Log
      const cfg = db.getConfig(interaction.guildId);
      if (cfg.mod_log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.mod_log_channel);
        if (logCh) logCh.send({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('⛔ Bannissement Temporaire')
            .addFields(
              { name: '👤 Membre', value: `${target.tag} (<@${target.id}>)`, inline: true },
              { name: '🛡️ Modérateur', value: `${interaction.user.username}`, inline: true },
              { name: '⏱️ Durée', value: `${duree}h`, inline: true },
              { name: '📅 Fin', value: `<t:${expiresAt}:F>`, inline: true },
              { name: '📋 Raison', value: raison, inline: false },
            )
            .setTimestamp()
          ]
        }).catch(() => {});
      }

      await interaction.editReply.bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setDescription(`✅ **${target.tag}** a été banni pour **${duree}h**.\n📋 Raison : ${raison}\n🔓 Débannissement : <t:${expiresAt}:R>`)
        ]
      });

    } catch (e) {
      await interaction.editReply.bind(interaction)({ content: `❌ Impossible de bannir ce membre : ${e.message}`, ephemeral: true });
    }
  }
};
