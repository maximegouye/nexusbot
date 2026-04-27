const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');

async function handleStarReaction(reaction, user, added) {
  try {
    if (user.bot) return;
    const msg = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    if (!msg.guild) return;

    const cfg = db.db.prepare('SELECT * FROM starboard_config WHERE guild_id=?').get(msg.guildId);
    if (!cfg) return;
    if (reaction.emoji.name !== cfg.emoji && reaction.emoji.toString() !== cfg.emoji) return;
    if (!cfg.self_star && msg.author.id === user.id) return;

    // Compter les vraies réactions
    await reaction.fetch();
    const count = reaction.count ?? 0;

    const existing = db.db.prepare('SELECT * FROM starboard_messages WHERE guild_id=? AND original_msg_id=?')
      .get(msg.guildId, msg.id);

    const starCh = msg.guild.channels.cache.get(cfg.channel_id);
    if (!starCh) return;

    if (!added && existing) {
      if (count < cfg.threshold) {
        // Retirer du starboard
        try { const sm = await starCh.messages.fetch(existing.star_msg_id); await sm.delete(); } catch {}
        db.db.prepare('DELETE FROM starboard_messages WHERE guild_id=? AND original_msg_id=?').run(msg.guildId, msg.id);
        return;
      }
    }

    if (count < cfg.threshold) return;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setAuthor({ name: msg.author.username, iconURL: msg.author.displayAvatarURL() })
      .setDescription(msg.content || '*[Pas de texte]*')
      .addFields(
        { name: '📌 Source', value: `[Aller au message](${msg.url})`, inline: true },
        { name: '📅 Date', value: `<t:${Math.floor(msg.createdTimestamp/1000)}:R>`, inline: true },
        { name: '💬 Salon', value: `<#${msg.channelId}>`, inline: true },
      )
      .setFooter({ text: `${cfg.emoji} ${count} étoile(s)` })
      .setTimestamp();

    // Image si présente
    const img = msg.attachments.find(a => a.contentType?.startsWith('image'));
    if (img) embed.setImage(img.url);

    if (existing) {
      // Mettre à jour
      try {
        const sm = await starCh.messages.fetch(existing.star_msg_id);
        await sm.edit({ embeds: [embed] });
        db.db.prepare('UPDATE starboard_messages SET stars=? WHERE id=?').run(count, existing.id);
      } catch {}
    } else {
      // Nouveau
      const sent = await starCh.send({ embeds: [embed] });
      db.db.prepare('INSERT OR IGNORE INTO starboard_messages (guild_id,original_msg_id,star_msg_id,channel_id,stars) VALUES (?,?,?,?,?)')
        .run(msg.guildId, msg.id, sent.id, msg.channelId, count);
    }
  } catch (e) { console.error('[Starboard]', e.message); }
}

module.exports = { handleStarReaction };
