const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db, isPremium, getPremium, activatePremium, validatePremiumCode } = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Gère votre abonnement premium')
    .addSubcommand(subcommand =>
      subcommand
        .setName('activate')
        .setDescription('Active le premium avec un code')
        .addStringOption(option =>
          option.setName('code')
            .setDescription('Code premium à activer')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Affiche vos informations premium')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('benefits')
        .setDescription('Affiche les avantages du premium')
    ),

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'activate') {
        return handleActivate(interaction);
      } else if (subcommand === 'info') {
        return handleInfo(interaction);
      } else if (subcommand === 'benefits') {
        return handleBenefits(interaction);
      }
    } catch (error) {
      console.error('Erreur dans la commande premium:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Une erreur est survenue lors du traitement de votre demande.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

async function handleActivate(interaction) {
  try {
    const code = interaction.options.getString('code').trim().toUpperCase();

    // Vérifier que l'utilisateur a les permissions MANAGE_GUILD
    if (!interaction.member.permissions.has('ManageGuild')) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Vous avez besoin de la permission "Gérer le serveur" pour activer le premium.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Valider le code
    const validCode = validatePremiumCode(code);
    if (!validCode) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Code premium invalide ou déjà utilisé.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }

    // Activer le premium
    const result = activatePremium(interaction.guildId, code);

    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription(`❌ ${result.message || 'Erreur lors de l\'activation du premium.'}`);

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle('✅ Premium activé')
      .setDescription(`Le serveur a maintenant le premium jusqu'au ${new Date(result.expiresAt).toLocaleDateString('fr-FR')}.`)
      .addFields({
        name: 'Plan',
        value: validCode.plan || 'Standard'
      },
      {
        name: 'Durée',
        value: `${validCode.duration_days || 30} jours`
      });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleActivate:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de l\'activation du premium.');

    return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleInfo(interaction) {
  try {
    const premium = getPremium(interaction.guildId);

    if (!premium || !premium.is_premium) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setDescription('❌ Ce serveur n\'a pas le premium activé.');

      return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
    }

    const expiresAt = new Date(premium.expires_at);
    const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    const activated = premium.activated_by ? `<@${premium.activated_by}>` : 'Inconnu';

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('⭐ Statut Premium')
      .addFields(
        {
          name: 'Statut',
          value: '✅ Premium actif'
        },
        {
          name: 'Expire le',
          value: expiresAt.toLocaleDateString('fr-FR')
        },
        {
          name: 'Jours restants',
          value: `${daysLeft} jour(s)`
        },
        {
          name: 'Activé par',
          value: activated
        }
      );

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleInfo:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de la récupération des informations premium.');

    return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleBenefits(interaction) {
  try {
    const benefits = `
✨ **Avantages Premium:**

1️⃣ **Commandes personnalisées illimitées** - Créez autant de commandes que vous le souhaitez (gratuit: 5 max)
2️⃣ **Cartes de rang avancées** - Cartes de profil personnalisées avec thèmes
3️⃣ **Images de bienvenue personnalisées** - Personnalisez entièrement vos messages de bienvenue
4️⃣ **Multiplicateur XP prioritaire** - XP x1.5 pour tous les membres
5️⃣ **Fonctionnalités d'économie étendues** - Jeux d'économie supplémentaires et boutiques
6️⃣ **Notifications YouTube/Twitch** - Recevez des notifications pour vos créateurs préférés
7️⃣ **Statut du bot personnalisé** - Définissez un message de statut personnalisé pour le serveur
`;

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('⭐ Avantages du Premium')
      .setDescription(benefits)
      .setFooter({
        text: 'Activez le premium pour débloquer tous ces avantages!'
      });

    return interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Erreur dans handleBenefits:', error);
    const errorEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription('❌ Une erreur est survenue lors de l\'affichage des avantages.');

    return interaction.editReply({ embeds: [errorEmbed], ephemeral: true });
  }
}
