/**
 * /traduis — Traduit un texte vers une autre langue via l'IA.
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const ai = require('../../utils/aiService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('traduis')
    .setDescription('🌍 Traduit un texte vers une autre langue')
    .addStringOption(o => o.setName('texte').setDescription('Texte à traduire').setRequired(true).setMaxLength(2000))
    .addStringOption(o => o.setName('langue').setDescription('Langue cible (défaut: français)').setMaxLength(30)),
  cooldown: 5,

  async execute(interaction) {
    const text = interaction.options.getString('texte');
    const lang = interaction.options.getString('langue') ?? 'français';
    const cfg = ai.getAIConfig(interaction.guildId, db);

    if (!cfg.enabled)    return interaction.editReply({ content: '❌ IA désactivée.', ephemeral: true });
    if (!ai.isAvailable()) return interaction.editReply({ content: '❌ Aucune clé API IA.', ephemeral: true });

    await interaction.deferReply();
    try {
      const res = await ai.translate({ text, targetLang: lang, guildId: interaction.guildId, userId: interaction.user.id, cfg });

      const gcfg = db.getConfig(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: '🌍 Traduction', iconURL: interaction.client.user.displayAvatarURL() })
        .addFields(
          { name: '📝 Original', value: text.length > 1024 ? text.slice(0, 1020) + '…' : text, inline: false },
          { name: `🎯 ${lang.charAt(0).toUpperCase() + lang.slice(1)}`, value: res.text.slice(0, 1024) || '*(vide)*', inline: false },
        )
        .setFooter({ text: `${res.provider} • ${res.model}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') return interaction.editReply({ content: `⏱️ ${e.message}` });
      console.error('[/traduis]', e.message);
      await interaction.editReply({ content: `❌ Erreur : ${e.message?.slice(0, 200)}` });
    }
  },
};
