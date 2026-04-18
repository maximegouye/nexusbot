/**
 * &ia — Pose une question à l'IA (rendu identique au slash /ia).
 */
const { EmbedBuilder } = require('discord.js');
const ai = require('../../utils/aiService');

module.exports = {
  name: 'ia',
  aliases: ['ai', 'chat', 'ask', 'bot'],
  description: 'Pose une question à l\'IA du bot',
  category: 'IA',
  cooldown: 5,

  async execute(message, args, client, db) {
    const question = args.join(' ').trim();
    if (!question) {
      return message.reply({ content: '❌ Pose ta question : `&ia Comment fait-on une config qui claque ?`' });
    }

    const cfg = ai.getAIConfig(message.guild.id, db);

    if (!cfg.enabled) {
      return message.reply({ content: '❌ L\'IA n\'est pas activée sur ce serveur. Un admin peut l\'activer via `&config` → 🧠 IA.' });
    }
    if (!ai.isAvailable()) {
      return message.reply({ content: '❌ Aucune clé API IA configurée côté hébergement.' });
    }
    if (cfg.required_role && !message.member.roles.cache.has(cfg.required_role)) {
      return message.reply({ content: `❌ Rôle requis : <@&${cfg.required_role}>` });
    }
    if (Array.isArray(cfg.allowed_channels) && cfg.allowed_channels.length > 0 && !cfg.allowed_channels.includes(message.channel.id)) {
      return message.reply({ content: `❌ L'IA n'est pas autorisée dans ce salon.` });
    }

    // Indicateur "le bot écrit…"
    try { await message.channel.sendTyping(); } catch {}

    try {
      const res = await ai.askAI({
        prompt: question,
        guildId: message.guild.id,
        userId:  message.author.id,
        cfg,
      });

      const gcfg = db.getConfig(message.guild.id);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: `🧠 NexusBot IA`, iconURL: client.user.displayAvatarURL() })
        .setDescription(res.text.slice(0, 4000) || '*(réponse vide)*')
        .addFields({ name: '❓ Ta question', value: question.length > 1000 ? question.slice(0, 1000) + '…' : question, inline: false })
        .setFooter({ text: `${res.provider} • ${res.model} • ${(res.usage?.output_tokens || res.usage?.completion_tokens || 0)} tokens` })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') return message.reply({ content: `⏱️ ${e.message}` });
      console.error('[&ia] Erreur:', e.message);
      await message.reply({ content: `❌ Erreur IA : ${e.message?.slice(0, 200)}` });
    }
  },
};
