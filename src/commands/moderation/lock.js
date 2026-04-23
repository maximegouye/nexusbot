const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('🔒 Verrouiller / déverrouiller un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('action').setDescription('lock ou unlock').setRequired(false)
      .addChoices({ name: '🔒 Verrouiller', value: 'lock' }, { name: '🔓 Déverrouiller', value: 'unlock' })),
  cooldown: 3,

  async execute(interaction) {
    const action = interaction.options.getString('action') || 'lock';
    const everyone = interaction.guild.roles.everyone;
    const currentPerms = interaction.channel.permissionsFor(everyone);
    const isLocked = !currentPerms.has(PermissionFlagsBits.SendMessages);

    if (action === 'lock' || (action === undefined && !isLocked)) {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: false });
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔒 Salon verrouillé')
          .setDescription(`<#${interaction.channelId}> est verrouillé par **${interaction.user.username}**.`)
        ]
      });
    } else {
      await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: null });
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🔓 Salon déverrouillé')
          .setDescription(`<#${interaction.channelId}> est de nouveau ouvert.`)
        ]
      });
    }
  }
};
