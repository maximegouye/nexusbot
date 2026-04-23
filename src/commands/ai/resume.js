/**
 * /resume — Résume les N derniers messages du salon (ou d'un salon donné).
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const ai = require('../../utils/aiService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('🧠 Résume les derniers messages du salon via l\'IA')
    .addChannelOption(o => o.setName('salon').setDescription('Salon à résumer (défaut: ici)').addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('langue').setDescription('Langue du résumé').setChoices(
      { name: 'Français', value: 'français' },
      { name: 'Anglais',  value: 'anglais' },
      { name: 'Espagnol', value: 'espagnol' },
      { name: 'Italien',  value: 'italien' },
      { name: 'Allemand', value: 'allemand' },
    )),
  cooldown: 10,

  async execute(interaction) {
    const n = parseInt(interaction.options.getString('messages')) ?? 50;
    const chan = interaction.options.getChannel('salon') ?? interaction.channel;
    const lang = interaction.options.getString('langue') ?? 'français';
    const cfg = ai.getAIConfig(interaction.guildId, db);

    if (!cfg.enabled) return interaction.editReply({ content: '❌ IA désactivée. Active-la via `/config` → 🧠 IA.', ephemeral: true });
    if (!ai.isAvailable()) return interaction.editReply({ content: '❌ Aucune clé API IA.', ephemeral: true });
    if (cfg.required_role && !interaction.member.roles.cache.has(cfg.required_role)) {
      return interaction.editReply({ content: `❌ Rôle requis : <@&${cfg.required_role}>`, ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const collection = await chan.messages.fetch({ limit: Math.min(n, 100) }).catch(() => null);
      if (!collection || collection.size === 0) {
        return interaction.editReply({ content: '❌ Aucun message à résumer dans ce salon.' });
      }

      const msgs = [...collection.values()]
        .filter(m => !m.author.bot && m.content && !m.content.startsWith('&') && !m.content.startsWith('/'))
        .reverse()
        .map(m => ({ authorName: m.member?.displayName || m.author.username, content: m.content.slice(0, 500) }));

      if (msgs.length < 3) {
        return interaction.editReply({ content: '❌ Pas assez de messages (min 3 non-bot et non-commandes).' });
      }

      const res = await ai.summarize({
        messages: msgs,
        guildId: interaction.guildId,
        userId:  interaction.user.id,
        cfg,
        language: lang,
      });

      const gcfg = db.getConfig(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: '🧠 Résumé de conversation', iconURL: interaction.client.user.displayAvatarURL() })
        .setTitle(`📝 ${msgs.length} messages résumés — ${chan.name}`)
        .setDescription(res.text.slice(0, 4000) || '*(résumé vide)*')
        .setFooter({ text: `${res.provider} • ${res.model} • demandé par ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') return interaction.editReply({ content: `⏱️ ${e.message}` });
      console.error('[/resume]', e.message);
      await interaction.editReply({ content: `❌ Erreur : ${e.message?.slice(0, 200)}` });
    }
  },
};
