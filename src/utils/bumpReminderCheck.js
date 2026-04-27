'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');

const BUMP_COOLDOWN_SECS = 7200; // 2 heures

async function checkBumpReminders(client) {
  const now = Math.floor(Date.now() / 1000);

  const due = db.db.prepare(
    'SELECT * FROM bump_reminders WHERE reminded=0 AND (bumped_at + ?) <= ?'
  ).all(BUMP_COOLDOWN_SECS, now);

  for (const reminder of due) {
    db.db.prepare('UPDATE bump_reminders SET reminded=1 WHERE id=?').run(reminder.id);

    try {
      const guild = client.guilds.cache.get(reminder.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(reminder.channel_id);
      if (!channel) continue;

      // Seul le rôle bump configuré est pingé — rien d'autre (pas owner, pas @everyone)
      const cfg      = db.db.prepare('SELECT bump_role FROM guild_config WHERE guild_id=?').get(reminder.guild_id);
      const bumpRole = cfg?.bump_role ? guild.roles.cache.get(cfg.bump_role) : null;
      const userId   = reminder.user_id !== '0' ? reminder.user_id : null;

      const pingContent = bumpRole
        ? `${bumpRole} 🔔 **C'est l'heure du bump !**`
        : '🔔 **C\'est l\'heure du bump !**';

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⏰ C\'est l\'heure du bump !')
        .setDescription(
          `**2 heures** se sont écoulées depuis le dernier bump DISBOARD !\n\n` +
          `🚀 Utilise \`/bump\` maintenant pour faire remonter le serveur dans les listes.\n\n` +
          `> 💡 Bumper régulièrement améliore le classement sur DISBOARD.`
        )
        .addFields(
          { name: '⏰ Dernier bump',    value: `<t:${reminder.bumped_at}:R>`,       inline: true },
          { name: '👤 Bumpé par',       value: userId ? `<@${userId}>` : 'Inconnu', inline: true },
          { name: '⏱️ Prochain rappel', value: 'Dans 2h après le prochain bump',    inline: true },
        )
        .setThumbnail('https://disboard.org/images/disboard-logo.png')
        .setFooter({ text: 'Rappel automatique NexusBot • DISBOARD Integration' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Ouvrir DISBOARD')
          .setURL('https://disboard.org')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🔗'),
      );

      await channel.send({
        content: pingContent,
        embeds: [embed],
        components: [row],
        allowedMentions: {
          roles: bumpRole ? [bumpRole.id] : [],
          users: [],   // jamais de mention utilisateur
          parse: [],   // pas de @everyone/@here
        },
      }).catch(() => {});

      // DM privé au propriétaire du serveur uniquement
      try {
        const owner = await guild.fetchOwner().catch(() => null);
        if (owner) {
          await owner.send({
            embeds: [
              new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('⏰ Rappel de bump — ' + guild.name)
                .setDescription(
                  `**2 heures** se sont écoulées depuis le dernier bump sur **${guild.name}** !\n\n` +
                  `🚀 N'oublie pas d'utiliser \`/bump\` sur DISBOARD pour faire remonter le serveur.`
                )
                .addFields(
                  { name: '⏰ Dernier bump', value: `<t:${reminder.bumped_at}:R>`, inline: true },
                  { name: '👤 Bumpé par',    value: userId ? `<@${userId}>` : 'Inconnu', inline: true },
                )
                .setFooter({ text: `NexusBot • Rappel privé — ${guild.name}` })
                .setTimestamp(),
            ],
            components: [row],
          }).catch(() => {});
        }
      } catch (_) {}

      console.log(`[BumpReminder] Rappel envoyé sur "${guild.name}" (guild ${reminder.guild_id})`);

    } catch (err) {
      console.error('[BumpReminder] Erreur pour guild', reminder.guild_id, ':', err?.message);
    }
  }
}

module.exports = { checkBumpReminders };
