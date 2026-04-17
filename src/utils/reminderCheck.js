const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = async (client) => {
  const now = Math.floor(Date.now() / 1000);
  const due = db.db.prepare('SELECT * FROM reminders WHERE trigger_at <= ? AND triggered = 0').all(now);

  for (const r of due) {
    try {
      db.db.prepare('UPDATE reminders SET triggered = 1 WHERE id = ?').run(r.id);

      // DM à l'utilisateur
      const user = await client.users.fetch(r.user_id).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('⏰ Rappel !')
        .setDescription(r.message)
        .setFooter({ text: 'NexusBot — Rappel automatique' })
        .setTimestamp();

      let sent = false;
      if (user) {
        await user.send({ embeds: [embed] }).then(() => { sent = true; }).catch(() => {});
      }

      // Si DM échoue, poster dans le canal d'origine
      if (!sent) {
        const channel = client.channels.cache.get(r.channel_id);
        if (channel) {
          await channel.send({ content: `⏰ <@${r.user_id}> — Rappel !`, embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[ReminderCheck] Erreur:', err.message);
    }
  }
};
