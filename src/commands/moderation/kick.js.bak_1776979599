const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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

    await target.user.send({
      embeds: [new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`👢 Tu as été expulsé de ${interaction.guild.name}`)
        .addFields({ name: 'Raison', value: raison })
      ]
    }).catch(() => {});

    await target.kick(`${interaction.user.tag}: ${raison}`);

    const embed = new EmbedBuilder()
      .setColor('#FF6B6B')
      .setTitle('👢 Membre expulsé')
      .addFields(
        { name: '👤 Membre',     value: target.user.tag,           inline: true },
        { name: '👮 Modérateur', value: interaction.user.tag,      inline: true },
        { name: '📝 Raison',     value: raison,                    inline: false },
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
