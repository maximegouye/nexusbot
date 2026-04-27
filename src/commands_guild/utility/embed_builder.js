const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('✨ Créez et envoyez des embeds personnalisés')
    .addSubcommand(s => s.setName('envoyer').setDescription('✨ Créer et envoyer un embed dans un salon')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'embed').setMaxLength(256))
      .addStringOption(o => o.setName('description').setDescription('Contenu principal').setMaxLength(2000))
      .addStringOption(o => o.setName('couleur').setDescription('Couleur HEX (ex: #7B2FBE)'))
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible (défaut: salon actuel)').addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('image').setDescription('URL d\'une image'))
      .addStringOption(o => o.setName('thumbnail').setDescription('URL d\'une miniature'))
      .addStringOption(o => o.setName('footer').setDescription('Texte du pied de page'))
      .addStringOption(o => o.setName('auteur').setDescription('Nom de l\'auteur'))
      .addBooleanOption(o => o.setName('timestamp').setDescription('Afficher l\'heure actuelle')))
    .addSubcommand(s => s.setName('dm').setDescription('📨 Envoyer un embed en DM à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre à contacter').setRequired(true))
      .addStringOption(o => o.setName('titre').setDescription('Titre').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Contenu').setRequired(true).setMaxLength(2000))
      .addStringOption(o => o.setName('couleur').setDescription('Couleur HEX'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (!interaction.member.permissions.has(0x4000n)) // ManageMessages
      return interaction.reply({ content: '❌ Permission insuffisante (Gérer les messages).', ephemeral: true });

    if (sub === 'envoyer') {
      const titre = interaction.options.getString('titre');
      const desc = interaction.options.getString('description');
      const couleur = interaction.options.getString('couleur');
      const salon = interaction.options.getChannel('salon') || interaction.channel;
      const image = interaction.options.getString('image');
      const thumb = interaction.options.getString('thumbnail');
      const footer = interaction.options.getString('footer');
      const auteur = interaction.options.getString('auteur');
      const ts = interaction.options.getBoolean('timestamp');

      if (!titre && !desc) return interaction.reply({ content: '❌ Vous devez fournir au minimum un titre ou une description.', ephemeral: true });

      // Validation couleur
      let colorValid = '#7B2FBE';
      if (couleur) {
        const hex = couleur.replace('#','');
        if (/^[0-9A-Fa-f]{6}$/.test(hex)) colorValid = `#${hex}`;
        else return interaction.reply({ content: '❌ Couleur HEX invalide (ex: #7B2FBE).', ephemeral: true });
      }

      const embed = new EmbedBuilder().setColor(colorValid);
      if (titre) embed.setTitle(titre);
      if (desc)  embed.setDescription(desc);
      if (image) { try { embed.setImage(image); } catch {} }
      if (thumb) { try { embed.setThumbnail(thumb); } catch {} }
      if (footer) embed.setFooter({ text: footer });
      if (auteur) embed.setAuthor({ name: auteur });
      if (ts) embed.setTimestamp();

      try {
        await salon.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Embed envoyé dans ${salon} !`, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: `❌ Impossible d'envoyer : ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'dm') {
      const target = interaction.options.getUser('membre');
      const titre = interaction.options.getString('titre');
      const desc = interaction.options.getString('description');
      const couleur = interaction.options.getString('couleur') || '#7B2FBE';

      const embed = new EmbedBuilder().setColor(couleur.startsWith('#') ? couleur : '#7B2FBE')
        .setTitle(titre).setDescription(desc)
        .setFooter({ text: `Message de ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() });

      try {
        await target.send({ embeds: [embed] });
        return interaction.reply({ content: `✅ Message envoyé à <@${target.id}> en DM !`, ephemeral: true });
      } catch {
        return interaction.reply({ content: `❌ Impossible d'envoyer un DM à <@${target.id}> (DMs désactivés).`, ephemeral: true });
      }
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
