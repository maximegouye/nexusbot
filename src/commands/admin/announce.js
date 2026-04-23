const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('📢 Créer une annonce professionnelle')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('message').setDescription('Contenu principal').setRequired(true).setMaxLength(4000))
    .addChannelOption(o => o.setName('salon').setDescription('Salon de destination').setRequired(true))
    .addStringOption(o => o.setName('titre').setDescription('Titre de l\'annonce').setRequired(false).setMaxLength(256))
    .addStringOption(o => o.setName('mention')
      .setDescription('Type de mention')
      .setRequired(false)
      .addChoices(
        { name: '❌ Aucune', value: 'none' },
        { name: '📣 @everyone', value: 'everyone' },
        { name: '📢 @here', value: 'here' }
      ))
    .addStringOption(o => o.setName('couleur')
      .setDescription('Couleur HEX (défaut: #FFD700 doré)')
      .setRequired(false)
      .setMaxLength(7))
    .addStringOption(o => o.setName('image_url')
      .setDescription('URL d\'une image')
      .setRequired(false)
      .setMaxLength(500))
    .addRoleOption(o => o.setName('ping_role')
      .setDescription('Rôle à mentionner (en priorité)')
      .setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    try {
      const titre = interaction.options.getString('titre');
      const message = interaction.options.getString('message');
      const salon = interaction.options.getChannel('salon');
      const mention = interaction.options.getString('mention') || 'none';
      const couleur = interaction.options.getString('couleur') || '#FFD700';
      const imageUrl = interaction.options.getString('image_url');
      const rolePin = interaction.options.getRole('ping_role');

      // Valider la couleur HEX
      if (!/^#[0-9A-Fa-f]{6}$/.test(couleur)) {
        return interaction.editReply({ content: '❌ Format couleur invalide. Utilise `#RRGGBB` (ex: `#FFD700`)', ephemeral: true });
      }

      // Construire l'embed
      const embed = new EmbedBuilder()
        .setColor(couleur)
        .setDescription(message)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: 'Annonce officielle • ' + new Date().toLocaleDateString('fr-FR') })
        .setTimestamp();

      if (titre) {
        embed.setTitle(titre);
      }

      if (imageUrl) {
        embed.setImage(imageUrl);
      }

      // Construire le contenu du message
      let content = '';
      if (rolePin) {
        content = `<@&${rolePin.id}>`;
      } else if (mention === 'everyone') {
        content = '@everyone';
      } else if (mention === 'here') {
        content = '@here';
      }

      // Envoyer dans le salon
      await salon.send({
        content: content || undefined,
        embeds: [embed],
        allowedMentions: {
          parse: mention !== 'none' ? ['roles', 'users'] : [],
          roles: rolePin ? [rolePin.id] : []
        }
      });

      // Confirmation ephémère
      const confirmEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Annonce Envoyée')
        .setDescription(`Message posté dans ${salon}`)
        .setFooter({ text: 'Merci de l\'avoir utilisé !' });

      return interaction.editReply({ embeds: [confirmEmbed], ephemeral: true });

    } catch (error) {
      console.error('Erreur announce:', error);
      return interaction.editReply({ content: '❌ Erreur lors de l\'envoi de l\'annonce.', ephemeral: true });
    }
  }
};
