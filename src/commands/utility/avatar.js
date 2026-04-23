const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('🖼️ Afficher l\'avatar d\'un membre en HD')
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('membre') || interaction.member;
    const user   = target.user || target;

    const globalAvatar = user.displayAvatarURL({ size: 4096, extension: 'png', forceStatic: false });
    const serverAvatar = target.displayAvatarURL?.({ size: 4096, extension: 'png', forceStatic: false });
    const banner = await user.fetch().then(u => u.bannerURL({ size: 4096 })).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle(`🖼️ Avatar de ${user.username}`)
      .setImage(serverAvatar || globalAvatar)
      .addFields(
        { name: '📎 PNG', value: `[Télécharger](${globalAvatar?.replace('.gif', '.png')})`, inline: true },
        { name: '📎 WebP', value: `[Télécharger](${globalAvatar?.replace('.png', '.webp')})`, inline: true },
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Avatar global')
        .setStyle(ButtonStyle.Link)
        .setURL(globalAvatar),
    );

    if (serverAvatar && serverAvatar !== globalAvatar) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Avatar serveur')
          .setStyle(ButtonStyle.Link)
          .setURL(serverAvatar)
      );
    }
    if (banner) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Bannière')
          .setStyle(ButtonStyle.Link)
          .setURL(banner)
      );
    }

    return interaction.editReply({ embeds: [embed], components: [row] });
  }
};
