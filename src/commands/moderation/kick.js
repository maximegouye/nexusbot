const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('👢 Expulser un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à expulser').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    const target = interaction.options.getMember('membre');
    const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

    if (!target) return interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: '❌ Je ne peux pas expulser ce membre.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas t\'expulser toi-même.', ephemeral: true });

    // ── Confirmation ──────────────────────────────────────
    const confirmEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('👢 Confirmation d\'expulsion')
      .setDescription(`Tu es sur le point d'expulser **${target.user.username}** du serveur.`)
      .addFields(
        { name: '👤 Membre', value: `${target.user.username} \`(${target.id})\``, inline: false },
        { name: '📝 Raison', value: raison, inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setFooter({ text: '⚠️ Le membre pourra revenir avec une invitation. Tu as 30 secondes.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('kick_confirm').setLabel('✅ Confirmer l\'expulsion').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('kick_cancel').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [confirmEmbed], components: [row], ephemeral: true });

    let btnInteraction;
    try {
      btnInteraction = await interaction.fetchReply().then(msg =>
        msg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30_000 })
      );
    } catch {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('⏰ Délai dépassé').setDescription('L\'expulsion a été annulée.')], components: [] });
    }

    if (btnInteraction.customId === 'kick_cancel') {
      return btnInteraction.update({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Expulsion annulée').setDescription('Aucune action effectuée.')], components: [] });
    }

    // ── Exécution du kick ─────────────────────────────────
    await target.user.send({
      embeds: [new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`👢 Tu as été expulsé de ${interaction.guild.name}`)
        .addFields({ name: 'Raison', value: raison })
      ]
    }).catch(() => {});

    await target.kick(`${interaction.user.username}: ${raison}`);

    const resultEmbed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('👢 Membre expulsé')
      .addFields(
        { name: '👤 Membre',     value: target.user.username,           inline: true },
        { name: '👮 Modérateur', value: interaction.user.username,      inline: true },
        { name: '📝 Raison',     value: raison,                    inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await btnInteraction.update({ embeds: [resultEmbed], components: [] });
  }
};
