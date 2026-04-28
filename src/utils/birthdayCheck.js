const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = async (client) => {
  const now   = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day   = String(now.getDate()).padStart(2, '0');
  const today = `${month}-${day}`;
  const dayNum   = now.getDate();
  const monthNum = now.getMonth() + 1;

  // Source 1 : ancienne table users.birthday (format MM-DD)
  const birthdaysLegacy = db.db.prepare(`
    SELECT u.user_id, u.guild_id, u.birth_year
    FROM users u
    WHERE u.birthday = ?
  `).all(today);

  // Source 2 : nouvelle table birthdays (jour + mois séparés)
  let birthdaysNew = [];
  try {
    birthdaysNew = db.db.prepare(`
      SELECT b.user_id, b.guild_id, NULL as birth_year
      FROM birthdays b
      WHERE b.jour=? AND b.mois=?
    `).all(dayNum, monthNum);
  } catch {}

  // Fusionner sans doublons
  const seen = new Set(birthdaysLegacy.map(b => `${b.guild_id}:${b.user_id}`));
  const birthdays = [...birthdaysLegacy, ...birthdaysNew.filter(b => !seen.has(`${b.guild_id}:${b.user_id}`))];

  for (const b of birthdays) {
    try {
      const cfg = db.getConfig(b.guild_id);
      if (!cfg.birthday_channel) continue;

      const guild   = client.guilds.cache.get(b.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.birthday_channel);
      if (!channel) continue;

      const member  = await guild.members.fetch(b.user_id).catch(() => null);
      if (!member) continue;

      const age = b.birth_year ? now.getFullYear() - b.birth_year : null;

      // Donner le rôle anniversaire si configuré
      if (cfg.birthday_role) {
        const role = guild.roles.cache.get(cfg.birthday_role);
        if (role) {
          await member.roles.add(role).catch(() => {});
          // Retirer après 24h
          setTimeout(async () => {
            await member.roles.remove(role).catch(() => {});
          }, 86400000);
        }
      }

      // Cadeau d'anniversaire
      const gift = cfg.daily_amount ? Math.floor((cfg.daily_amount || 200) * 2) : 400;
      db.addCoins(b.user_id, b.guild_id, gift);

      await channel.send({
        content: `<@${b.user_id}>`,
        embeds: [new EmbedBuilder()
          .setColor('#FF73FA')
          .setTitle('🎂 Joyeux Anniversaire !')
          .setDescription(`🎉 Toute l'équipe de **${guild.name}** souhaite un joyeux anniversaire à <@${b.user_id}> !${age ? ` **${age} ans** 🎈` : ''}`)
          .addFields({ name: '🎁 Cadeau', value: `**+${gift} ${cfg.currency_name || '€'}** ${cfg.currency_emoji || '€'}` })
          .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
          .setFooter({ text: 'NexusBot 🎂 — Bonne journée !' })
        ]
      });
    } catch (err) {
      console.error('[BirthdayCheck] Erreur:', err.message);
    }
  }
};
