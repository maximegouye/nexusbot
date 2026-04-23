const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('compter')
    .setDescription('🔢 Gestion du jeu du comptage')
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer le salon de comptage')
      .addChannelOption(o => o.setName('salon').setDescription('Salon de comptage').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('📊 Voir le comptage actuel'))
    .addSubcommand(s => s.setName('reset').setDescription('🔄 Remettre le compteur à zéro (Admin)')),
  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

      const salon = interaction.options.getChannel('salon');
      db.db.prepare(`
        INSERT INTO counting (guild_id, channel_id, current, last_user_id, record)
        VALUES (?, ?, 0, NULL, 0)
        ON CONFLICT(guild_id) DO UPDATE SET channel_id = ?
      `).run(interaction.guildId, salon.id, salon.id);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🔢 Jeu du Comptage Configuré !')
          .setDescription(`Le salon ${salon} est maintenant le salon de comptage !\n\nLes membres doivent écrire les nombres dans l'ordre, **un par un**.\n⚠️ On ne peut pas compter deux fois de suite.`)
          .setFooter({ text: 'Commencez par écrire 1 dans le salon !' })
        ], ephemeral: true
      });
    }

    if (sub === 'info') {
      const counting = db.db.prepare('SELECT * FROM counting WHERE guild_id = ?').get(interaction.guildId);
      if (!counting || !counting.channel_id)
        return interaction.reply({ content: '❌ Le jeu du comptage n\'est pas configuré.', ephemeral: true });

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('🔢 Jeu du Comptage')
          .addFields(
            { name: '📌 Salon', value: `<#${counting.channel_id}>`, inline: true },
            { name: '🔢 Compteur actuel', value: `**${counting.current}**`, inline: true },
            { name: '🏆 Record', value: `**${counting.record || 0}**`, inline: true },
            { name: '👤 Dernier à compter', value: counting.last_user_id ? `<@${counting.last_user_id}>` : 'Personne', inline: true },
          )
        ]
      });
    }

    if (sub === 'reset') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

      db.db.prepare('UPDATE counting SET current = 0, last_user_id = NULL WHERE guild_id = ?').run(interaction.guildId);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription('🔄 Compteur remis à zéro !')], ephemeral: true
      });
    }
  }
};
