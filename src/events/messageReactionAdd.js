const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user, client) {
    if (user.bot) return;
    if (reaction.partial) {
      try { await reaction.fetch(); } catch (e) { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch (e) { return; }
    }

    const { message, emoji } = reaction;
    const guild = message.guild;
    if (!guild) return;

    const cfg = db.getConfig(guild.id);

    // ── Reaction Roles ─────────────────────────────
    const rr = db.db.prepare(
      'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?'
    ).get(guild.id, message.id, emoji.id || emoji.name);

    if (rr) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (member) {
        const role = guild.roles.cache.get(rr.role_id);
        if (role) await member.roles.add(role).catch(() => {});
      }
    }

    // ── Starboard avancé (table starboard_config) ─
    try {
      const { handleStarReaction } = require('../utils/starboardHandler');
      await handleStarReaction(reaction, user, true);
    } catch {}

    // ── Starboard legacy ────────────────────────────
    const starEmojis = ['⭐', '🌟', '💫'];
    if (!starEmojis.includes(emoji.name)) return;
    if (!cfg.starboard_channel) return;
    if (message.channel.id === cfg.starboard_channel) return;
    if (message.author.id === user.id) return; // pas d'auto-star

    const starCount = reaction.count;
    const threshold = cfg.starboard_threshold || 3;

    let starEntry = db.db.prepare('SELECT * FROM starboard WHERE guild_id = ? AND message_id = ?').get(guild.id, message.id);

    if (!starEntry) {
      db.db.prepare('INSERT INTO starboard (guild_id, message_id, channel_id, author_id, stars) VALUES (?, ?, ?, ?, ?)')
        .run(guild.id, message.id, message.channel.id, message.author.id, starCount);
      starEntry = db.db.prepare('SELECT * FROM starboard WHERE guild_id = ? AND message_id = ?').get(guild.id, message.id);
    } else {
      db.db.prepare('UPDATE starboard SET stars = ? WHERE id = ?').run(starCount, starEntry.id);
    }

    if (starCount < threshold) return;

    const starChannel = guild.channels.cache.get(cfg.starboard_channel);
    if (!starChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setDescription(message.content || '*[Pas de texte]*')
      .addFields({ name: '🔗 Source', value: `[Voir le message](${message.url})` })
      .setFooter({ text: `#${message.channel.name}` })
      .setTimestamp(message.createdAt);

    if (message.attachments.first()) {
      embed.setImage(message.attachments.first().url);
    }

    const starLabel = `⭐ **${starCount}**`;

    if (starEntry.starboard_msg_id) {
      try {
        const existing = await starChannel.messages.fetch(starEntry.starboard_msg_id);
        await existing.edit({ content: starLabel, embeds: [embed] });
      } catch {
        const sent = await starChannel.send({ content: starLabel, embeds: [embed] });
        db.db.prepare('UPDATE starboard SET starboard_msg_id = ? WHERE id = ?').run(sent.id, starEntry.id);
      }
    } else {
      const sent = await starChannel.send({ content: starLabel, embeds: [embed] });
      db.db.prepare('UPDATE starboard SET starboard_msg_id = ? WHERE id = ?').run(sent.id, starEntry.id);
    }
  }
};
