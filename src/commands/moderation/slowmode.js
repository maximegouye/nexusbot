const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('🐌 Activer/désactiver le mode lent sur un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('secondes').setDescription('Délai en secondes (0 = désactiver)').setMinValue(0).setMaxValue(21600).setRequired(true)),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const sec = interaction.options.getInteger('secondes') ?? 0;
    await interaction.channel.setRateLimitPerUser(sec, `Slowmode par ${interaction.user.username}`);

    const embed = new EmbedBuilder()
      .setColor(sec === 0 ? '#2ECC71' : '#FFA500')
      .setTitle(sec === 0 ? '🐇 Mode lent désactivé' : '🐌 Mode lent activé')
      .setDescription(sec === 0
        ? `Le mode lent a été désactivé dans <#${interaction.channelId}>.`
        : `Mode lent de **${sec}s** activé dans <#${interaction.channelId}>.`
      );

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
