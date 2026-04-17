/**
 * bumpReminderCheck.js
 * Vérifie toutes les minutes s'il faut envoyer un rappel DISBOARD.
 * 2h après le dernier bump → mention du bumpeur dans le salon d'origine.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');

// Migration : table bump_reminders
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS bump_reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id   TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      bumped_at  INTEGER NOT NULL,
      reminded   INTEGER DEFAULT 0
    )
  `).run();
} catch {}

const BUMP_COOLDOWN_SECS = 7200; // 2 heures

async function checkBumpReminders(client) {
  const now = Math.floor(Date.now() / 1000);

  // Récupérer les rappels dont le délai de 2h est dépassé et pas encore envoyés
  const due = db.prepare(
    'SELECT * FROM bump_reminders WHERE reminded = 0 AND (bumped_at + ?) <= ?'
  ).all(BUMP_COOLDOWN_SECS, now);

  for (const reminder of due) {
    // Marquer immédiatement pour éviter les doublons si le traitement plante
    db.prepare('UPDATE bump_reminders SET reminded = 1 WHERE id = ?').run(reminder.id);

    try {
      const guild = client.guilds.cache.get(reminder.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(reminder.channel_id);
      if (!channel) continue;

      await channel.send({
        content: `<@${reminder.user_id}>`,
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⏰ C\'est l\'heure du bump !')
            .setDescription(
              `**2 heures se sont écoulées** depuis le dernier bump DISBOARD !\n\n` +
              `🚀 Utilise \`/bump\` maintenant pour faire remonter le serveur dans les listes et attirer de nouveaux membres.\n\n` +
              `> 💡 Bumper régulièrement augmente la visibilité du serveur et améliore son classement sur DISBOARD.`
            )
            .addFields(
              { name: '⏰ Dernier bump',        value: `<t:${reminder.bumped_at}:R>`, inline: true },
              { name: '👤 Bumpé par',           value: `<@${reminder.user_id}>`,      inline: true },
              { name: '⏱️ Prochain rappel',     value: 'Dans 2h après le prochain bump', inline: true },
            )
            .setThumbnail('https://disboard.org/images/disboard-logo.png')
            .setFooter({ text: 'Rappel automatique NexusBot • DISBOARD Integration' })
            .setTimestamp(),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel('Voir DISBOARD')
              .setURL('https://disboard.org')
              .setStyle(ButtonStyle.Link)
              .setEmoji('🔗'),
          ),
        ],
      }).catch(() => {});

    } catch { /* ignorer les erreurs individuelles */ }
  }
}

module.exports = { checkBumpReminders };
