const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Cache pour éviter de spammer (userId -> { keyword -> lastSent timestamp })
const cooldowns = new Map();

async function handleHighlight(message) {
  if (!message.guild || message.author.bot) return;
  const content = message.content.toLowerCase();
  if (!content) return;

  // Récupérer tous les highlights du serveur
  const rows = db.db.prepare('SELECT * FROM highlights WHERE guild_id=?').all(message.guildId);
  if (!rows.length) return;

  const toNotify = new Map(); // userId -> [keywords matched]

  for (const row of rows) {
    if (row.user_id === message.author.id) continue; // pas de self-notif
    if (!content.includes(row.keyword)) continue;

    // Vérif cooldown (1 highlight par mot par user toutes les 5 min)
    const key = `${row.user_id}:${row.keyword}`;
    const last = cooldowns.get(key) || 0;
    if (Date.now() - last < 5 * 60 * 1000) continue;
    cooldowns.set(key, Date.now());

    if (!toNotify.has(row.user_id)) toNotify.set(row.user_id, []);
    toNotify.get(row.user_id).push(row.keyword);
  }

  for (const [userId, keywords] of toNotify) {
    try {
      // Vérifier que l'user peut voir le salon
      const member = await message.guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      const perms = message.channel.permissionsFor(member);
      if (!perms?.has('ViewChannel')) continue;

      const user = await message.client.users.fetch(userId).catch(() => null);
      if (!user) continue;

      // Extraire contexte (2 messages avant)
      const context = await message.channel.messages.fetch({ limit: 3, before: message.id }).catch(() => null);
      const contextStr = context ? [...context.values()].reverse()
        .map(m => `**${m.author.username}**: ${m.content.slice(0, 80)}`).join('\n') : '';

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🔔 Highlight détecté !')
        .setDescription(`**${message.author.username}** a mentionné \`${keywords.join('`, `')}\` dans <#${message.channelId}>`)
        .addFields(
          { name: '💬 Message', value: message.content.slice(0, 500) || '*vide*' },
          { name: '📎 Lien', value: `[Aller au message](${message.url})` },
        )
        .setFooter({ text: message.guild.name })
        .setTimestamp();

      if (contextStr) embed.addFields({ name: '📜 Contexte', value: contextStr.slice(0, 500) });

      await user.send({ embeds: [embed] }).catch(() => {});
    } catch {}
  }
}

module.exports = { handleHighlight };
