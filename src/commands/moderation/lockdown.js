const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('🔒 Verrouiller / déverrouiller un salon ou le serveur entier')
    .addSubcommand(s => s.setName('salon').setDescription('🔒 Verrouiller ce salon')
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)))
    .addSubcommand(s => s.setName('debloque').setDescription('🔓 Déverrouiller ce salon'))
    .addSubcommand(s => s.setName('serveur').setDescription('🚨 Verrouiller TOUS les salons (urgence)')
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  cooldown: 5,

  async execute(interaction) {
    try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
      return interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true });

    const sub    = interaction.options.getSubcommand();
    const raison = interaction.options.getString('raison') || 'Raison non précisée';
    const everyone = interaction.guild.roles.everyone;

    await interaction.deferReply();

    if (sub === 'salon' || sub === 'debloque') {
      const locked = sub === 'salon';
      await interaction.channel.permissionOverwrites.edit(everyone, {
        SendMessages: locked ? false : null,
        AddReactions: locked ? false : null,
      });

      const embed = new EmbedBuilder()
        .setColor(locked ? '#E74C3C' : '#2ECC71')
        .setTitle(locked ? '🔒 Salon Verrouillé' : '🔓 Salon Déverrouillé')
        .setDescription(locked
          ? `Ce salon est maintenant verrouillé.\n📋 Raison : **${raison}**`
          : `Ce salon est maintenant accessible à tous.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Log
      const cfg = db.getConfig(interaction.guildId);
      if (cfg.mod_log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.mod_log_channel);
        if (logCh) logCh.send({ embeds: [embed.addFields({ name: '📌 Salon', value: `<#${interaction.channelId}>`, inline: true }, { name: '🛡️ Modérateur', value: interaction.user.username, inline: true })] }).catch(() => {});
      }
    }

    if (sub === 'serveur') {
      let count = 0;
      const textChannels = interaction.guild.channels.cache.filter(c => c.type === 0 || c.type === 5);
      for (const [, ch] of textChannels) {
        await ch.permissionOverwrites.edit(everyone, { SendMessages: false }).catch(() => {});
        count++;
      }

      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🚨 LOCKDOWN SERVEUR ACTIVÉ')
          .setDescription(`**${count} salons** ont été verrouillés !\n📋 Raison : **${raison}**\n\nUtilise \`/lockdown debloque\` dans chaque salon pour déverrouiller.`)
          .setTimestamp()
        ]
      });
    }
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
