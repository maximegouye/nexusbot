const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('📝 Créer et envoyer un embed personnalisé dans un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s
      .setName('simple')
      .setDescription('Créer un embed simple rapidement')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'embed').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Contenu de l\'embed').setRequired(true))
      .addStringOption(o => o.setName('couleur').setDescription('Couleur hex (ex: #7B2FBE)').setRequired(false))
      .addStringOption(o => o.setName('image').setDescription('URL d\'une image').setRequired(false))
      .addStringOption(o => o.setName('footer').setDescription('Texte du footer').setRequired(false))
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible (défaut: salon actuel)').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('annonce')
      .setDescription('Template d\'annonce officielle')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'annonce').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Contenu de l\'annonce').setRequired(true))
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('regles')
      .setDescription('Template de règles du serveur')
      .addStringOption(o => o.setName('regles').setDescription('Règles (séparées par | pour chaque point)').setRequired(true))
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible').setRequired(false))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getChannel('salon') || interaction.channel;

    if (sub === 'simple') {
      const titre  = interaction.options.getString('titre');
      const desc   = interaction.options.getString('description');
      const color  = interaction.options.getString('couleur') || '#7B2FBE';
      const image  = interaction.options.getString('image');
      const footer = interaction.options.getString('footer');

      const hexOk = /^#[0-9A-Fa-f]{6}$/.test(color);
      const embed = new EmbedBuilder()
        .setColor(hexOk ? color : '#7B2FBE')
        .setTitle(titre)
        .setDescription(desc)
        .setTimestamp();
      if (image) embed.setImage(image);
      if (footer) embed.setFooter({ text: footer });

      await target.send({ embeds: [embed] });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Embed envoyé dans <#${target.id}>`, ephemeral: true });
    }

    if (sub === 'annonce') {
      const titre = interaction.options.getString('titre');
      const msg   = interaction.options.getString('message');

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`📣 ${titre}`)
        .setDescription(msg)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: `Annonce par ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

      await target.send({ embeds: [embed] });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Annonce envoyée dans <#${target.id}>`, ephemeral: true });
    }

    if (sub === 'regles') {
      const reglesRaw = interaction.options.getString('regles');
      const points = reglesRaw.split('|').map(r => r.trim()).filter(Boolean);

      const desc = points.map((r, i) =>
        `**${i + 1}.** ${r}`
      ).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📜 Règles de ${interaction.guild.name}`)
        .setDescription(desc + '\n\n*Le non-respect des règles entraîne des sanctions.*')
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      await target.send({ embeds: [embed] });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Règles envoyées dans <#${target.id}>`, ephemeral: true });
    }
  }
};
