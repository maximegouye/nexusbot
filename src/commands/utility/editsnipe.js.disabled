const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const snipe = require('./snipe');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('✏️ Voir le dernier message modifié dans ce salon'),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const cache = snipe.getEditCache();
    const cached = cache.get(interaction.channelId);

    if (!cached) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#888888').setDescription('✏️ Aucun message modifié récemment dans ce salon.')],
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('✏️ Dernier Message Modifié')
      .setAuthor({ name: cached.authorTag, iconURL: cached.avatarURL })
      .addFields(
        { name: '📝 Avant', value: cached.oldContent?.slice(0, 1024) || '*[Vide]*', inline: false },
        { name: '✅ Après', value: cached.newContent?.slice(0, 1024) || '*[Vide]*', inline: false },
      )
      .setFooter({ text: 'Modifié' })
      .setTimestamp(cached.timestamp);

    await interaction.editReply({ embeds: [embed] });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
