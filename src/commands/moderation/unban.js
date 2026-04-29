const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('🔓 Débannir un utilisateur')
    .addStringOption(o => o.setName('userid').setDescription('ID Discord de l\'utilisateur').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du débannissement').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers))
      return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const userId = interaction.options.getString('userid').trim();
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    // Vérifier que l'utilisateur est bien banni
    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) return interaction.editReply({ content: `❌ L'utilisateur \`${userId}\` n'est pas banni sur ce serveur.`, ephemeral: true });

    try {
      await interaction.guild.bans.remove(userId, `${raison} — par ${interaction.user.username}`);

      // Marquer le tempban comme terminé
      db.db.prepare('UPDATE tempbans SET unbanned = 1 WHERE guild_id = ? AND user_id = ? AND unbanned = 0')
        .run(interaction.guildId, userId);

      const cfg = db.getConfig(interaction.guildId);
      if (cfg.mod_log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.mod_log_channel);
        if (logCh) logCh.send({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('🔓 Débannissement')
            .addFields(
              { name: '👤 Utilisateur', value: `${ban.user.username} (\`${userId}\`)`, inline: true },
              { name: '🛡️ Modérateur', value: interaction.user.username, inline: true },
              { name: '📋 Raison', value: raison, inline: false },
            )
            .setTimestamp()
          ]
        }).catch(() => {});
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ **${ban.user.username}** a été débanni avec succès.\n📋 Raison : ${raison}`)
        ]
      });
    } catch (e) {
      await interaction.editReply({ content: `❌ Impossible de débannir cet utilisateur : ${e.message}`, ephemeral: true });
    }
  }
};
