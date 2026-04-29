/**
 * /ia — Pose une question à l'IA.
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');
const ai = require('../../utils/aiService');

function checkAllowed(member, cfg) {
  if (cfg.required_role && !member.roles.cache.has(cfg.required_role)) {
    return { ok: false, msg: `❌ Rôle requis : <@&${cfg.required_role}>` };
  }
  return { ok: true };
}

function checkChannel(channelId, cfg) {
  if (Array.isArray(cfg.allowed_channels) && cfg.allowed_channels.length > 0 && !cfg.allowed_channels.includes(channelId)) {
    return { ok: false, msg: `❌ L'IA n'est pas autorisée dans ce salon.` };
  }
  return { ok: true };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ia')
    .setDescription('🧠 Pose une question à l\'IA du bot')
    .addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true).setMaxLength(2000))
    .addBooleanOption(o => o.setName('prive').setDescription('Réponse visible uniquement par toi (défaut: non)')),
  cooldown: 5,

  async execute(interaction) {
    const priv = interaction.options.getBoolean('prive') ?? false;
    const question = interaction.options.getString('question');
    const cfg = ai.getAIConfig(interaction.guildId, db);

    if (!cfg.enabled) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ L\'IA n\'est pas activée sur ce serveur. Un admin peut l\'activer via `/config` → 🧠 IA.', ephemeral: true });
    }
    if (!ai.isAvailable()) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune clé API IA configurée côté hébergement. Ajoute `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` dans les variables Railway.', ephemeral: true });
    }
    const cA = checkAllowed(interaction.member, cfg);       if (!cA.ok) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: cA.msg, ephemeral: true });
    const cC = checkChannel(interaction.channelId, cfg);    if (!cC.ok) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: cC.msg, ephemeral: true });

    await interaction.deferReply({ ephemeral: priv }).catch(() => {});

    try {
      const res = await ai.askAI({
        prompt: question,
        guildId: interaction.guildId,
        userId:  interaction.user.id,
        cfg,
      });

      const gcfg = db.getConfig(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(gcfg.color || '#7B2FBE')
        .setAuthor({ name: `🧠 NexusBot IA`, iconURL: interaction.client.user.displayAvatarURL() })
        .setDescription(res.text.slice(0, 4000) || '*(réponse vide)*')
        .addFields({ name: '❓ Ta question', value: question.length > 1000 ? question.slice(0, 1000) + '…' : question, inline: false })
        .setFooter({ text: `${res.provider} • ${res.model} • ${(res.usage?.output_tokens || res.usage?.completion_tokens || 0)} tokens` })
        .setTimestamp();

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (e) {
      if (e.code === 'RATE_LIMIT') {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏱️ ${e.message}` });
      }
      console.error('[/ia] Erreur:', e.message);
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Erreur IA : ${e.message?.slice(0, 200)}` });
    }
  },
};
