const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('🔨 Bannir un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
    .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false)),
  cooldown: 3,

  async execute(interaction) {
    const target  = interaction.options.getMember('membre');
    const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';
    const days    = parseInt(interaction.options.getString('jours')) || 0;

    if (!target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Membre introuvable.', ephemeral: true });
    if (!target.bannable) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Je ne peux pas bannir ce membre (rôle supérieur).', ephemeral: true });
    if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas te bannir toi-même.', ephemeral: true });

    // DM avant bannissement
    await target.user.send({
      embeds: [new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔨 Tu as été banni de ${interaction.guild.name}`)
        .addFields({ name: 'Raison', value: raison })
      ]
    }).catch(() => {});

    await target.ban({ reason: `${interaction.user.tag}: ${raison}`, deleteMessageSeconds: days * 86400 });

    db.incrementStat(interaction.guildId, 'bans');

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('🔨 Membre banni')
      .addFields(
        { name: '👤 Membre',     value: `${target.user.tag}`,           inline: true },
        { name: '👮 Modérateur', value: `${interaction.user.tag}`,      inline: true },
        { name: '📝 Raison',     value: raison,                         inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};
