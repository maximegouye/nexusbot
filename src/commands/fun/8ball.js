const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const RESPONSES = [
  // Positives
  { text: 'Oui, absolument ! 🎉',              type: 'positive' },
  { text: 'C\'est certain.',                    type: 'positive' },
  { text: 'Sans aucun doute.',                  type: 'positive' },
  { text: 'Tu peux compter dessus !',           type: 'positive' },
  { text: 'Les signes disent oui.',             type: 'positive' },
  { text: 'Tout indique que oui.',              type: 'positive' },
  { text: 'Clairement oui ! 🌟',               type: 'positive' },
  // Neutres
  { text: 'Réessaie plus tard...',              type: 'neutral' },
  { text: 'Difficile à dire maintenant.',       type: 'neutral' },
  { text: 'Concentrate-toi et repose la question.', type: 'neutral' },
  { text: 'Je ne peux pas prédire ça.',         type: 'neutral' },
  { text: 'La réponse n\'est pas claire.',       type: 'neutral' },
  // Negatives
  { text: 'Non. 😬',                            type: 'negative' },
  { text: 'J\'en doute beaucoup.',              type: 'negative' },
  { text: 'Mes sources disent non.',            type: 'negative' },
  { text: 'Les perspectives ne sont pas bonnes.', type: 'negative' },
  { text: 'Très peu probable.',                 type: 'negative' },
  { text: 'Oublie ça. 💀',                     type: 'negative' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('🎱 Pose une question à la boule magique')
    .addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true).setMaxLength(256)),
  cooldown: 3,

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const response = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const cfg      = db.getConfig(interaction.guildId);

    const color = {
      positive: '#2ECC71',
      neutral:  '#FFA500',
      negative: '#FF6B6B',
    }[response.type];

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎱 La Boule Magique a répondu...')
      .addFields(
        { name: '❓ Question', value: question,      inline: false },
        { name: '🎱 Réponse', value: response.text, inline: false },
      )
      .setFooter({ text: `Demandé par ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
