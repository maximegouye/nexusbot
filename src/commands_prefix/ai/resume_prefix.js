/**
 * &resume [N] — Résume les N derniers messages du salon courant (défaut 50).
 */
const { EmbedBuilder } = require('discord.js');
const ai = require('../../utils/aiService');

module.exports = {
  name: 'resume',
  aliases: ['summary', 'tldr'],
  description: 'Résume les derniers messages du salon',
  category: 'IA',
  cooldown: 10,

  async run(message, args, client, db) {
    const n = Math.min(200, Math.max(10, parseInt(args[0], 10) || 50));
    const cfg = ai.getAIConfig(message.guild.id, db);

    if (!cfg.enabled)    return message.reply('❌ IA désactivée.');
    if (!ai.isAvailable()) return message.reply('❌ Aucune clé API IA.');
    if (cfg.required_role && !message.member.roles.cache.has(cfg.required_role)) {
      return message.reply(`❌ Rôle requis : <@&${cfg.required_role}>`);
    }

    try { await message.channel.sendTyping(); } catch {}

    try {
      const collection = await message.channel.messages.fetch({ limit: Math.min(n, 100), before: message.id });
      const msgs = [...collection.values()]
        .filter(m => !m.author.bot && m.content && !m.content.startsWith('&') && !m.content.startsWith('/'))
        .reverse()
        .map(m => ({ authorName: m.member?.displayName || m.author.username, content: m.content.slice(0, 500) }));

      if (msgs.length < 3) return message.reply('❌ Pas assez de messages à résumer.');

      const res = await ai.summarize({
        messages: msgs, guildId: message.guild.id, userId: message.author.id, cfg,
      });

      const gcfg = db.getConfig(message.guild.id);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: '🧠 Résumé de conversation', iconURL: client.user.displayAvatarURL() })
        .setTitle(`📝 ${msgs.length} messages résumés — #${message.channel.name}`)
        .setDescription(res.text.slice(0, 4000))
        .setFooter({ text: `${res.provider} • ${res.model} • demandé par ${message.author.username}` })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') return message.reply(`⏱️ ${e.message}`);
      console.error('[&resume]', e.message);
      await message.reply(`❌ Erreur : ${e.message?.slice(0, 200)}`);
    }
  },
};
