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
    // interactionCreate.js a déjà fait deferReply({ ephemeral: false }) globalement.
    // On supprime ce message de chargement à la fin via deleteReply(), puis followUp ephémère.
    try {
      const titre    = interaction.options.getString('titre');
      const message  = interaction.options.getString('message');
      const salon    = interaction.options.getChannel('salon');
      const mention  = interaction.options.getString('mention') || 'none';
      const couleur  = interaction.options.getString('couleur') || '#FFD700';
      const imageUrl = interaction.options.getString('image_url');
      const rolePin  = interaction.options.getRole('ping_role');

      // Valider la couleur HEX
      if (!/^#[0-9A-Fa-f]{6}$/.test(couleur)) {
        return interaction.editReply({ content: '❌ Format couleur invalide. Utilise `#RRGGBB` (ex: `#FFD700`)' });
      }

      // Vérifier que le salon est textuel
      if (salon.isTextBased && !salon.isTextBased()) {
        return interaction.editReply({ content: '❌ Ce salon ne supporte pas les messages.' });
      }

      // Vérifier les permissions du bot dans le salon cible
      const botMember = interaction.guild.members.me;
      const perms = salon.permissionsFor(botMember);
      if (!perms || !perms.has('SendMessages')) {
        return interaction.editReply({ content: `❌ Je n'ai pas la permission d'envoyer des messages dans ${salon}.` });
      }
      if ((mention === 'everyone' || mention === 'here') && !perms.has('MentionEveryone')) {
        return interaction.editReply({ content: `❌ Je n'ai pas la permission de mentionner @everyone/@here dans ${salon}.\nDonne-moi la permission **Mentionner @everyone** dans ce salon.` });
      }

      // Construire l'embed
      const embed = new EmbedBuilder()
        .setColor(couleur)
        .setDescription(message)
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setFooter({ text: 'Annonce officielle • ' + new Date().toLocaleDateString('fr-FR') })
        .setTimestamp();

      if (titre)    embed.setTitle(titre);
      if (imageUrl) embed.setImage(imageUrl);

      // Construire le contenu + allowedMentions corrects
      let content = '';
      const allowedMentions = { parse: [] };

      if (rolePin) {
        content = `<@&${rolePin.id}>`;
        allowedMentions.parse = ['roles'];
        allowedMentions.roles = [rolePin.id];
      } else if (mention === 'everyone') {
        content = '@everyone';
        allowedMentions.parse = ['everyone'];
      } else if (mention === 'here') {
        content = '@here';
        allowedMentions.parse = ['everyone']; // 'everyone' active aussi @here
      }

      // Envoyer l'annonce dans le salon cible
      await salon.send({ content: content || undefined, embeds: [embed], allowedMentions });

      // Supprimer le message de chargement public + confirmation privée
      await interaction.deleteReply().catch(() => {});

      const mentionStr = rolePin ? `<@&${rolePin.id}>` : mention === 'none' ? '❌ Aucune' : `@${mention}`;
      const confirmEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('✅ Annonce envoyée !')
        .setDescription(`Message posté dans ${salon}`)
        .addFields(
          { name: '📝 Titre',   value: titre || '*(aucun)*', inline: true },
          { name: '📣 Mention', value: mentionStr,            inline: true },
          { name: '🎨 Couleur', value: couleur,               inline: true },
        )
        .setTimestamp();

      return interaction.followUp({ embeds: [confirmEmbed], ephemeral: true });

    } catch (error) {
      console.error('[ANNOUNCE] Erreur:', error?.message || error);
      const errMsg = `❌ Erreur : ${error?.message || 'Erreur inconnue'}`;
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply({ content: errMsg });
        else await interaction.reply({ content: errMsg, ephemeral: true });
      } catch (_) {}
    }
  }
};
