const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const u = match[2];
  const mult = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * mult[u] * 1000;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('🔇 Rendre un membre muet (timeout Discord natif)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à muter').setRequired(true))
    .addStringOption(o => o.setName('duree').setDescription('Durée ex: 10m, 1h, 2d (max 28j)').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    const target = interaction.options.getMember('membre');
    const durStr = interaction.options.getString('duree');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: '❌ Je ne peux pas muter ce membre.', ephemeral: true });

    const ms = parseDuration(durStr);
    if (!ms) return interaction.reply({ content: '❌ Format de durée invalide. Exemples : `10m`, `1h`, `2d`', ephemeral: true });
    if (ms > 28 * 24 * 3600 * 1000) return interaction.reply({ content: '❌ La durée maximale est de 28 jours.', ephemeral: true });

    await target.timeout(ms, `${interaction.user.tag}: ${raison}`);

    const expiresAt = Date.now() + ms;
    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle('🔇 Membre muet')
      .addFields(
        { name: '👤 Membre',     value: target.user.tag,        inline: true },
        { name: '👮 Modérateur', value: interaction.user.tag,   inline: true },
        { name: '⏱️ Durée',      value: durStr,                 inline: true },
        { name: '⏰ Fin',        value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
        { name: '📝 Raison',     value: raison,                 inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
