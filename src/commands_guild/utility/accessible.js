/**
 * NexusBot — Mode accessibilité pour personnes malvoyantes / aveugles
 * UNIQUE : Toutes les réponses en texte brut, sans emojis, sans embeds
 * Les commandes lues facilement par les lecteurs d'écran
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS accessibility (
    guild_id TEXT, user_id TEXT,
    plain_text INTEGER DEFAULT 0,
    large_text INTEGER DEFAULT 0,
    no_emoji INTEGER DEFAULT 0,
    screen_reader INTEGER DEFAULT 0,
    PRIMARY KEY(guild_id, user_id)
  )`).run();
} catch {}

function getSettings(userId, guildId) {
  return db.db.prepare('SELECT * FROM accessibility WHERE guild_id=? AND user_id=?').get(guildId, userId) || {
    plain_text: 0, large_text: 0, no_emoji: 0, screen_reader: 0
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('accessible')
    .setDescription('♿ Paramètres d\'accessibilité — Optimisez pour les lecteurs d\'écran')
    .addSubcommand(s => s.setName('activer').setDescription('♿ Activer le mode accessibilité complet (lecteur d\'écran)'))
    .addSubcommand(s => s.setName('desactiver').setDescription('♿ Désactiver le mode accessibilité'))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir vos paramètres d\'accessibilité'))
    .addSubcommand(s => s.setName('textebrut').setDescription('📄 Activer/désactiver le mode texte brut (sans embeds)'))
    .addSubcommand(s => s.setName('sansemojis').setDescription('🚫 Activer/désactiver le mode sans emojis'))
    .addSubcommand(s => s.setName('aide').setDescription('❓ Guide d\'accessibilité — Comment utiliser NexusBot'))
    .addSubcommand(s => s.setName('commandes').setDescription('📋 Liste de toutes les commandes en texte accessible'))
    .addSubcommand(s => s.setName('lire').setDescription('🔊 Résumer les derniers messages du salon en texte pur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const settings = getSettings(userId, guildId);

    const upsert = (fields) => {
      db.db.prepare(`INSERT INTO accessibility (guild_id,user_id,plain_text,large_text,no_emoji,screen_reader)
        VALUES(?,?,?,?,?,?)
        ON CONFLICT(guild_id,user_id) DO UPDATE SET ${Object.keys(fields).map(k => `${k}=excluded.${k}`).join(',')}`)
        .run(guildId, userId, fields.plain_text ?? settings.plain_text, fields.large_text ?? settings.large_text, fields.no_emoji ?? settings.no_emoji, fields.screen_reader ?? settings.screen_reader);
    };

    if (sub === 'activer') {
      upsert({ plain_text: 1, no_emoji: 1, screen_reader: 1, large_text: 1 });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        content:
          'Mode accessibilite complet active.\n\n' +
          'Texte brut : Oui.\n' +
          'Sans emojis : Oui.\n' +
          'Lecteur ecran : Oui.\n\n' +
          'Toutes vos interactions avec NexusBot seront desormais optimisees pour les lecteurs d\'ecran.\n' +
          'Utilisez /accessible aide pour un guide complet.',
        ephemeral: true
      });
    }

    if (sub === 'desactiver') {
      upsert({ plain_text: 0, no_emoji: 0, screen_reader: 0, large_text: 0 });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Mode accessibilité désactivé. Retour à l\'affichage normal.', ephemeral: true });
    }

    if (sub === 'voir') {
      if (settings.screen_reader) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content:
            'Vos parametres d\'accessibilite :\n\n' +
            `Mode texte brut : ${settings.plain_text ? 'Actif' : 'Inactif'}\n` +
            `Sans emojis : ${settings.no_emoji ? 'Actif' : 'Inactif'}\n` +
            `Mode lecteur ecran : ${settings.screen_reader ? 'Actif' : 'Inactif'}\n\n` +
            'Utilisez /accessible activer pour tout activer, ou /accessible desactiver pour tout desactiver.',
          ephemeral: true
        });
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('♿ Vos paramètres d\'accessibilité')
        .addFields(
          { name: '📄 Texte brut', value: settings.plain_text ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '🚫 Sans emojis', value: settings.no_emoji ? '✅ Actif' : '❌ Inactif', inline: true },
          { name: '🔊 Lecteur d\'écran', value: settings.screen_reader ? '✅ Actif' : '❌ Inactif', inline: true },
        )
        .setFooter({ text: '/accessible activer pour tout activer en un clic' })
      ], ephemeral: true });
    }

    if (sub === 'textebrut') {
      const newVal = settings.plain_text ? 0 : 1;
      upsert({ plain_text: newVal });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Mode texte brut : **${newVal ? 'Activé' : 'Désactivé'}**`, ephemeral: true });
    }

    if (sub === 'sansemojis') {
      const newVal = settings.no_emoji ? 0 : 1;
      upsert({ no_emoji: newVal });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Mode sans emojis : **${newVal ? 'Activé' : 'Désactivé'}**`, ephemeral: true });
    }

    if (sub === 'aide') {
      const guide =
        'GUIDE D\'ACCESSIBILITE NEXUSBOT\n\n' +
        'NexusBot est entierement utilisable avec un lecteur d\'ecran.\n\n' +
        'ETAPE 1 : Activez le mode accessibilite\n' +
        'Tapez : /accessible activer\n' +
        'Cela active le texte brut, la suppression des emojis et le mode lecteur d\'ecran.\n\n' +
        'ETAPE 2 : Naviguer les commandes\n' +
        'Toutes les commandes commencent par /, puis le nom de la commande.\n' +
        'Exemple : /solde, /daily, /niveau, /ticket\n' +
        'Vous pouvez aussi utiliser le prefixe n! pour les commandes rapides.\n' +
        'Exemple : n!balance, n!daily, n!help\n\n' +
        'ETAPE 3 : Commandes les plus utiles\n' +
        '/solde : voir votre solde de monnaie virtuelle\n' +
        '/daily : gagner votre recompense quotidienne\n' +
        '/niveau : voir votre niveau et votre XP\n' +
        '/ticket : ouvrir un ticket de support\n' +
        '/profil : voir votre profil complet\n' +
        '/aide : aide generale\n\n' +
        'ETAPE 4 : Lire les messages\n' +
        'Utilisez /accessible lire pour obtenir un resume des derniers messages en texte pur.\n\n' +
        'Si vous avez des problemes, contactez un administrateur du serveur.';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: guide, ephemeral: true });
    }

    if (sub === 'commandes') {
      const liste =
        'LISTE DES COMMANDES PRINCIPALES DE NEXUSBOT\n\n' +
        'ECONOMIE :\n' +
        '/solde - Voir votre argent\n' +
        '/daily - Recompense quotidienne\n' +
        '/travailler - Gagner des coins\n' +
        '/payer - Envoyer des coins\n' +
        '/classement - Top joueurs\n' +
        '/shop - Boutique du serveur\n\n' +
        'NIVEAUX :\n' +
        '/niveau - Voir votre niveau\n' +
        '/top_xp - Classement XP\n\n' +
        'SOCIAL :\n' +
        '/rep - Reputation\n' +
        '/profil - Profil complet\n' +
        '/badge - Vos badges\n\n' +
        'JEUX :\n' +
        '/pile_ou_face - Jeu de pile ou face\n' +
        '/casino - Machines a sous\n' +
        '/pendu - Jeu du pendu\n' +
        '/morpion - Morpion contre un joueur\n\n' +
        'UNIUE :\n' +
        '/pet - Animal de compagnie\n' +
        '/espion - Missions d\'espionnage\n' +
        '/histoire - Histoires collaboratives\n' +
        '/maison - Maison virtuelle\n' +
        '/ville - Ville virtuelle\n' +
        '/famille - Famille virtuelle\n\n' +
        'TICKETS :\n' +
        '/ticket - Support et signalement\n\n' +
        'Pour plus de details sur une commande, tapez /aide ou n!aide';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: liste, ephemeral: true });
    }

    if (sub === 'lire') {
      const limit = parseInt(interaction.options.getString('nombre')) || 10;
      await interaction.deferReply({ ephemeral: true });

      const messages = await interaction.channel.messages.fetch({ limit });
      const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Filtrer les messages non-bots ou du bot si commandes
      const lines = sorted
        .filter(m => !m.author.bot || m.content.length > 0)
        .map(m => {
          const author = m.member?.displayName || m.author.username;
          const content = m.content || (m.embeds[0]?.description ? `[Embed: ${m.embeds[0].title || 'message'}]` : '[Media ou attachment]');
          const time = new Date(m.createdTimestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          // Enlever les emojis unicode si mode sans emojis
          const clean = settings.no_emoji
            ? content.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
            : content;
          return `[${time}] ${author} : ${clean}`;
        });

      const text = lines.join('\n') || 'Aucun message lisible.';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `Derniers messages :\n\n${text.slice(0, 1800)}` });
    }
  }
};
