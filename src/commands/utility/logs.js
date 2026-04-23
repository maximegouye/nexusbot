const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('📋 Configurer les canaux de logs')
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer un canal de log')
      .addStringOption(o => o.setName('type').setDescription('Type de log').setRequired(true)
        .addChoices(
          { name: '📋 Logs généraux',         value: 'log_channel'     },
          { name: '🛡️ Logs de modération',    value: 'mod_log_channel' },
          { name: '🎉 Logs de bienvenue',      value: 'welcome_channel' },
          { name: '👋 Logs de départ',         value: 'leave_channel'   },
          { name: '🌟 Salon de niveau',        value: 'level_channel'   },
          { name: '⭐ Starboard',              value: 'starboard_channel'},
          { name: '🎂 Anniversaires',          value: 'birthday_channel' },
          { name: '❤️ Rapport de santé',       value: 'health_channel'  },
          { name: '🏆 Quêtes',                 value: 'quest_channel'   },
        ))
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible').setRequired(true)))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir la configuration actuelle'))
    .addSubcommand(s => s.setName('desactiver').setDescription('❌ Désactiver un type de log')
      .addStringOption(o => o.setName('type').setDescription('Type à désactiver').setRequired(true)
        .addChoices(
          { name: '📋 Logs généraux',         value: 'log_channel'     },
          { name: '🛡️ Logs de modération',    value: 'mod_log_channel' },
          { name: '🎉 Logs de bienvenue',      value: 'welcome_channel' },
          { name: '👋 Logs de départ',         value: 'leave_channel'   },
        )))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'setup') {
      const type   = interaction.options.getString('type');
      const salon  = interaction.options.getChannel('salon');
      db.setConfig(interaction.guildId, type, salon.id);

      const names = {
        log_channel: '📋 Logs généraux', mod_log_channel: '🛡️ Logs de modération',
        welcome_channel: '🎉 Bienvenue', leave_channel: '👋 Départ',
        level_channel: '🌟 Niveaux', starboard_channel: '⭐ Starboard',
        birthday_channel: '🎂 Anniversaires', health_channel: '❤️ Rapport de santé',
        quest_channel: '🏆 Quêtes',
      };

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ **${names[type] || type}** configuré sur ${salon} !`)
        ], ephemeral: true
      });
    }

    if (sub === 'desactiver') {
      const type = interaction.options.getString('type');
      db.setConfig(interaction.guildId, type, null);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`❌ Log \`${type}\` désactivé.`)], ephemeral: true
      });
    }

    if (sub === 'voir') {
      const channelName = (id) => id ? `<#${id}>` : '❌ Non configuré';
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('📋 Configuration des Logs')
          .addFields(
            { name: '📋 Logs généraux',       value: channelName(cfg.log_channel),      inline: true },
            { name: '🛡️ Modération',          value: channelName(cfg.mod_log_channel),  inline: true },
            { name: '🎉 Bienvenue',            value: channelName(cfg.welcome_channel),  inline: true },
            { name: '👋 Départ',               value: channelName(cfg.leave_channel),    inline: true },
            { name: '🌟 Niveaux',              value: channelName(cfg.level_channel),    inline: true },
            { name: '⭐ Starboard',            value: channelName(cfg.starboard_channel),inline: true },
            { name: '🎂 Anniversaires',        value: channelName(cfg.birthday_channel), inline: true },
            { name: '❤️ Rapport de santé',     value: channelName(cfg.health_channel),   inline: true },
            { name: '🏆 Quêtes',               value: channelName(cfg.quest_channel),    inline: true },
          )
        ], ephemeral: true
      });
    }
  }
};
