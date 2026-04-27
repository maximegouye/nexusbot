const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('qrcode')
    .setDescription('📱 Générer un QR code')
    .addSubcommand(s => s.setName('generer').setDescription('📱 Générer un QR code à partir d\'un texte ou URL')
      .addStringOption(o => o.setName('contenu').setDescription('Texte ou URL à encoder').setRequired(true))
      .addStringOption(o => o.setName('taille').setDescription('Taille du QR code').addChoices(
        { name: 'Petit (150px)', value: '150' },
        { name: 'Moyen (300px)', value: '300' },
        { name: 'Grand (500px)', value: '500' },
      ))),

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const contenu = interaction.options.getString('contenu');
    const taille = interaction.options.getString('taille') || '300';

    if (contenu.length > 500) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Contenu trop long (500 caractères max).', ephemeral: true });

    const encoded = encodeURIComponent(contenu);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${taille}x${taille}&data=${encoded}&format=png&margin=10`;

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
      new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📱 QR Code généré')
        .setDescription(`Contenu : \`${contenu.slice(0, 100)}${contenu.length > 100 ? '...' : ''}\``)
        .setImage(url)
        .setFooter({ text: `Taille: ${taille}×${taille}px • Scannable avec n'importe quel smartphone` })
        .setTimestamp()
    ]});
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

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
