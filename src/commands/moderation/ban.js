const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Bannir un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false))
    .addIntegerOption(o => o.setName('jours').setDescription('Supprimer les messages des X derniers jours (0–7)').setMinValue(0).setMaxValue(7).setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const target  = interaction.options.getMember('membre');
    const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';
    const days    = interaction.options.getInteger('jours') || 0;

    if (!target) return interaction.editReply({ content: '❌ Membre introuvable.', ephemeral: true });
    if (!target.bannable) return interaction.editReply({ content: '❌ Je ne peux pas bannir ce membre (rôle supérieur).', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.editReply({ content: '❌ Tu ne peux pas te bannir toi-même.', ephemeral: true });

    // ── Confirmation ──────────────────────────────────────
    const confirmEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔨 Confirmation de bannissement')
      .setDescription(`Tu es sur le point de bannir **${target.user.username}** de ce serveur.`)
      .addFields(
        { name: '👤 Membre',     value: `${target.user.username} \`(${target.id})\``, inline: false },
        { name: '📝 Raison',     value: raison, inline: false },
        { name: '🗑️ Messages',   value: days > 0 ? `Suppression des ${days} derniers jours` : 'Aucune suppression', inline: true },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setFooter({ text: '⚠️ Cette action est irréversible ! Tu as 30 secondes.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ban_confirm').setLabel('✅ Confirmer le ban').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ban_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

    let btnInteraction;
    try {
      btnInteraction = await interaction.fetchReply().then(msg =>
        msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30_000 })
      );
    } catch {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('⏰ Délai dépassé').setDescription('Le bannissement a été annulé.')], components: [] });
    }

    if (btnInteraction.customId === 'ban_cancel') {
      return btnInteraction.update({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Bannissement annulé').setDescription('Aucune action effectuée.')], components: [] });
    }

    // ── Exécution du ban ──────────────────────────────────
    await target.user.send({
      embeds: [new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔨 Tu as été banni de ${interaction.guild.name}`)
        .addFields({ name: 'Raison', value: raison })
      ]
    }).catch(() => {});

    await target.ban({ reason: `${interaction.user.username}: ${raison}`, deleteMessageSeconds: days * 86400 });
    try { db.incrementStat(interaction.guildId, 'bans'); } catch {}

    const resultEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔨 Membre banni')
      .addFields(
        { name: '👤 Membre',     value: `${target.user.username}`,      inline: true },
        { name: '👮 Modérateur', value: `${interaction.user.username}`, inline: true },
        { name: '📝 Raison',     value: raison,                    inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await btnInteraction.update({ embeds: [resultEmbed], components: [] });
  }
};
