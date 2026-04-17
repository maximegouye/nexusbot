const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const CATEGORIES = {
  economy: {
    label: '💰 Économie',
    description: 'Gagnez et dépensez des coins',
    commands: [
      '`/balance` — Voir son solde',
      '`/daily` — Récompense quotidienne (streak !)',
      '`/work` — Travailler pour gagner des coins',
      '`/deposit` / `/withdraw` — Banque',
      '`/transfer` — Envoyer des coins',
      '`/shop` — Boutique du serveur',
      '`/buy` — Acheter un article',
      '`/inventory` — Voir son inventaire',
      '`/market` — Marché joueur-à-joueur',
      '`/gamble` — Slots, Coinflip, Blackjack',
      '`/crime` — Crimes (risqué !)',
      '`/rob` — Voler un membre',
    ]
  },
  leveling: {
    label: '⭐ Niveaux',
    description: 'Montez en niveau et progressez',
    commands: [
      '`/rank` — Carte de rang XP',
      '`/leaderboard` — Classement du serveur',
    ]
  },
  moderation: {
    label: '🛡️ Modération',
    description: 'Outils de modération du serveur',
    commands: [
      '`/ban` — Bannir un membre',
      '`/kick` — Expulser un membre',
      '`/mute` — Rendre muet (timeout)',
      '`/warn` — Avertir un membre',
      '`/warnings` — Voir les avertissements',
      '`/clearwarns` — Effacer des avertissements',
      '`/clear` — Supprimer des messages',
      '`/slowmode` — Mode lent',
      '`/lock` — Verrouiller un salon',
    ]
  },
  utility: {
    label: '🔧 Utilitaires',
    description: 'Outils pratiques',
    commands: [
      '`/serverinfo` — Infos du serveur',
      '`/userinfo` — Infos d\'un membre',
      '`/poll` — Créer un sondage',
      '`/remind` — Créer un rappel',
      '`/stats` — Statistiques du bot',
    ]
  },
  fun: {
    label: '🎮 Fun',
    description: 'Divertissement',
    commands: [
      '`/8ball` — Boule magique',
      '`/blague` — Blague aléatoire',
      '`/quizz` — Quiz culture générale',
      '`/rps` — Pierre-Feuille-Ciseaux',
      '`/coinflip` — Pile ou face rapide',
      '`/defi` — Défier un membre',
    ]
  },
  unique: {
    label: '✨ Fonctions Uniques',
    description: 'Ce qui rend NexusBot exceptionnel',
    commands: [
      '`/rep` — Donner de la réputation',
      '`/quest` — Quêtes communautaires',
      '`/giveaway` — Créer/gérer des giveaways',
      '`/ticket` — Système de tickets',
      '`/birthday` — Anniversaires',
      '`/health` — Rapport de santé du serveur',
      '`/reactionrole` — Rôles par réaction',
    ]
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📚 Affiche l\'aide de NexusBot'),
  cooldown: 5,

  async execute(interaction) {
    const cfg = db?.getConfig?.(interaction.guildId) || {};
    const color = cfg.color || '#7B2FBE';

    const buildEmbed = (cat) => {
      if (!cat || !CATEGORIES[cat]) {
        // Menu principal
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle('📚 NexusBot — Aide')
          .setDescription('Sélectionne une catégorie ci-dessous pour voir les commandes disponibles.')
          .setThumbnail(interaction.client.user.displayAvatarURL());

        for (const [key, c] of Object.entries(CATEGORIES)) {
          embed.addFields({ name: `${c.label}`, value: c.description, inline: true });
        }

        embed.setFooter({ text: 'NexusBot — Le bot Discord le plus complet ✨' });
        return embed;
      }

      const c = CATEGORIES[cat];
      return new EmbedBuilder()
        .setColor(color)
        .setTitle(c.label)
        .setDescription(c.commands.join('\n'))
        .setFooter({ text: 'Utilise /help pour revenir au menu principal' });
    };

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category')
        .setPlaceholder('📂 Choisir une catégorie...')
        .addOptions(
          { label: '🏠 Accueil', value: 'home', description: 'Menu principal' },
          ...Object.entries(CATEGORIES).map(([k, c]) => ({
            label: c.label,
            value: k,
            description: c.description,
          }))
        )
    );

    const msg = await interaction.reply({ embeds: [buildEmbed(null)], components: [menu], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: 'Ce n\'est pas ton aide.', ephemeral: true });
      const val = i.values[0];
      await i.update({ embeds: [buildEmbed(val === 'home' ? null : val)], components: [menu] });
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
  }
};

// Lazy require pour éviter la dépendance circulaire
let db;
try { db = require('../../database/db'); } catch {}
