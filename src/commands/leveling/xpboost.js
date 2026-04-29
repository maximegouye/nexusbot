const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('xpboost')
    .setDescription('⚡ Configurer le multiplicateur d\'XP du serveur')
    .addSubcommand(s => s.setName('set').setDescription('⚡ Définir le multiplicateur')
      .addNumberOption(o => o.setName('multiplicateur').setDescription('Multiplicateur (ex: 2 = double XP)').setRequired(true).setMinValue(0.5).setMaxValue(10)))
    .addSubcommand(s => s.setName('reset').setDescription('🔄 Remettre le multiplicateur à 1'))
    .addSubcommand(s => s.setName('info').setDescription('ℹ️ Voir le multiplicateur actuel'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = { content: '❌ Permission insuffisante.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(msg);
      } else {
        return await interaction.reply(msg);
      }
    }

    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'set') {
      const multi = interaction.options.getNumber('multiplicateur');
      db.setConfig(interaction.guildId, 'xp_multiplier', multi);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('⚡ XP Boost Activé !')
          .setDescription(`Le multiplicateur d'XP est maintenant de **×${multi}** !\n\nTous les membres gagnent **${multi}× plus d'XP** par message.`)
          .setFooter({ text: multi >= 3 ? '🔥 Mode turbo activé !' : multi >= 2 ? '⚡ Double XP !' : '✨ Boost actif' })
        ]
      }) : interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('⚡ XP Boost Activé !')
          .setDescription(`Le multiplicateur d'XP est maintenant de **×${multi}** !\n\nTous les membres gagnent **${multi}× plus d'XP** par message.`)
          .setFooter({ text: multi >= 3 ? '🔥 Mode turbo activé !' : multi >= 2 ? '⚡ Double XP !' : '✨ Boost actif' })
        ]
      }));
    }

    if (sub === 'reset') {
      db.setConfig(interaction.guildId, 'xp_multiplier', 1);
      return await (interaction.deferred||interaction.replied ? interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('🔄 Multiplicateur d\'XP remis à **×1** (normal).')]
      }) : interaction.reply({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('🔄 Multiplicateur d\'XP remis à **×1** (normal).')]
      }));
    }

    if (sub === 'info') {
      const multi = cfg.xp_multiplier || 1;
      return await (interaction.deferred||interaction.replied ? interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(multi > 1 ? '#F39C12' : '#3498DB')
          .setTitle('⚡ XP Boost — Statut')
          .addFields(
            { name: '✖️ Multiplicateur', value: `**×${multi}**`, inline: true },
            { name: '📬 XP par message', value: `**~${Math.floor(15 * multi)}–${Math.floor(25 * multi)} XP**`, inline: true },
            { name: '📊 Statut', value: multi > 1 ? '🔥 Boost actif !' : '✅ Normal', inline: true },
          )
        ]
      }) : interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(multi > 1 ? '#F39C12' : '#3498DB')
          .setTitle('⚡ XP Boost — Statut')
          .addFields(
            { name: '✖️ Multiplicateur', value: `**×${multi}**`, inline: true },
            { name: '📬 XP par message', value: `**~${Math.floor(15 * multi)}–${Math.floor(25 * multi)} XP**`, inline: true },
            { name: '📊 Statut', value: multi > 1 ? '🔥 Boost actif !' : '✅ Normal', inline: true },
          )
        ]
      }));
    }
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
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
