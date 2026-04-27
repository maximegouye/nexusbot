/**
 * &traduis <langue> <texte> — Traduit un texte.
 * Exemples :
 *   &traduis anglais Bonjour le monde
 *   &traduis Bonjour le monde   (→ français par défaut si déjà autre langue)
 */
const { EmbedBuilder } = require('discord.js');
const ai = require('../../utils/aiService');

const KNOWN_LANGS = new Set([
  'français','francais','fr','anglais','english','en','espagnol','español','es',
  'italien','italiano','it','allemand','deutsch','de','portugais','portuguese','pt',
  'japonais','japanese','ja','chinois','chinese','zh','russe','russian','ru','arabe','arabic','ar',
  'coréen','korean','ko','néerlandais','dutch','nl','turc','turkish','tr','polonais','polish','pl',
]);

module.exports = {
  name: 'traduis',
  aliases: ['translate', 'trad', 'tr'],
  description: 'Traduit un texte vers une autre langue',
  category: 'IA',
  cooldown: 5,

  async run(message, args, client, db) {
    if (!args.length) return message.reply('❌ Usage : `&traduis <langue> <texte>` ou `&traduis <texte>` (défaut: français).');

    let lang = 'français';
    let text;
    const first = args[0].toLowerCase();
    if (KNOWN_LANGS.has(first)) {
      lang = args.shift();
      text = args.join(' ');
    } else {
      text = args.join(' ');
    }
    if (!text.trim()) return message.reply('❌ Texte manquant.');

    const cfg = ai.getAIConfig(message.guild.id, db);
    if (!cfg.enabled)    return message.reply('❌ IA désactivée.');
    if (!ai.isAvailable()) return message.reply('❌ Aucune clé API IA.');

    try { await message.channel.sendTyping(); } catch {}
    try {
      const res = await ai.translate({ text, targetLang: lang, guildId: message.guild.id, userId: message.author.id, cfg });

      const gcfg = db.getConfig(message.guild.id);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: '🌍 Traduction', iconURL: client.user.displayAvatarURL() })
        .addFields(
          { name: '📝 Original', value: text.length > 1024 ? text.slice(0, 1020) + '…' : text, inline: false },
          { name: `🎯 ${lang.charAt(0).toUpperCase() + lang.slice(1)}`, value: res.text.slice(0, 1024) || '*(vide)*', inline: false },
        )
        .setFooter({ text: `${res.provider} • ${res.model}` })
        .setTimestamp();

      await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') return message.reply(`⏱️ ${e.message}`);
      console.error('[&traduis]', e.message);
      await message.reply(`❌ Erreur : ${e.message?.slice(0, 200)}`);
    }
  },
};
