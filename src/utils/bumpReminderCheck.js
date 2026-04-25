/**
 * bumpReminderCheck.js
 * Vérifie toutes les 60s s'il faut envoyer un rappel DISBOARD.
 * Persistant entre les redémarrages (données en DB SQLite).
 * Améliorations :
 *   - Ping du rôle bump configuré (/bump setrole)
 *   - DM au dernier bumpeur en fallback
 *   - Timestamp Discord natif (affichage relatif)
 */
'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');

const BUMP_COOLDOWN_SECS = 7200; // 2 heures

async function checkBumpReminders(client) {
  const now = Math.floor(Date.now() / 1000);

  const due = db.prepare(
    'SELECT * FROM bump_reminders WHERE reminded=0 AND (bumped_at + ?) <= ?'
  ).all(BUMP_COOLDOWN_SECS, now);

  for (const reminder of due) {
    // Marquer immédiatement → éviter les doublons si le process plante
    db.prepare('UPDATE bump_reminders SET reminded=1 WHERE id=?').run(reminder.id);

    try {
      const guild = client.guilds.cache.get(reminder.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(reminder.channel_id);
      if (!channel) continue;

      // Récupérer le rôle bump configuré (optionnel)
      const cfg      = db.prepare('SELECT bump_role FROM guild_config WHERE guild_id=?').get(reminder.guild_id);
      const bumpRole = cfg?.bump_role ? guild.roles.cache.get(cfg.bump_role) : null;
      const userId   = reminder.user_id !== '0' ? reminder.user_id : null;

      // Construire le ping : rôle > @dernier bumpeur > message simple
      const pingContent = bumpRole
        ? `${bumpRole} 🔔 **C'est l'heure du bump !**`
        : userId
          ? `<@${userId}> 🔔 **Rappel de bump !**`
          : '🔔 **Rappel de bump !**';

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('⏰ C\'est l\'heure du bump !')
        .setDescription(
          `**2 heures** se sont écoulées depuis le dernier bump DISBOARD !\n\n` +
          `🚀 Utilise \`/bump\` maintenant pour faire remonter le serveur dans les listes et attirer de nouveaux membres.\n\n` +
          `> 💡 Bumper régulièrement améliore le classement sur DISBOARD.`
        )
        .addFields(
          { name: '⏰ Dernier bump',    value: `<t:${reminder.bumped_at}:R>`,           inline: true },
          { name: '👤 Bumpé par',       value: userId ? `<@${userId}>` : 'Inconnu',     inline: true },
          { name: '⏱️ Prochain rappel', value: 'Dans 2h après le prochain bump',        inline: true },
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
          users: !bumpRole && userId ? [userId] : [],
        },
      }).catch(() => {});

      // DM au dernier bumpeur si pas de rôle configuré
      if (!bumpRole && userId) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            await member.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('#5865F2')
                  .setTitle('⏰ Rappel de bump — NexusBot')
                  .setDescription(
                    `Il est temps de bumper **${guild.name}** sur DISBOARD !\n\n` +
                    `Rends-toi dans <#${reminder.channel_id}> et tape \`/bump\`.`
                  )
                  .setFooter({ text: 'NexusBot • Bump Reminder' })
                  .setTimestamp(),
              ],
            }).catch(() => {}); // DMs désactivés → silencieux
          }
        } catch (_) {}
      }

      console.log(`[BumpReminder] Rappel envoyé sur "${guild.name}" (guild ${reminder.guild_id})`);

    } catch (err) {
      console.error('[BumpReminder] Erreur pour guild', reminder.guild_id, ':', err?.message);
    }
  }
}

module.exports = { checkBumpReminders };
