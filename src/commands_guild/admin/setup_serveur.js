// setup_serveur.js — Esthétique serveur avec ・
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const TEMPLATE = [
  { category: '┈ ・ INFORMATIONS ・ ┈', channels: [
    { name: '・📋・règles', topic: 'Règles du serveur.' },
    { name: '・📣・annonces', topic: 'Annonces officielles.' },
    { name: '・👋・bienvenue', topic: 'Accueil des nouveaux membres.' },
    { name: '・🎫・rôles', topic: 'Choisissez vos rôles.' },
    { name: '・💎・partenaires', topic: 'Serveurs partenaires (auto via /partenariat).' },
  ]},
  { category: '┈ ・ GÉNÉRAL ・ ┈', channels: [
    { name: '・💬・général', topic: 'Discussion générale.' },
    { name: '・🖼・médias', topic: 'Images, GIFs et vidéos.' },
    { name: '・🔗・liens', topic: 'Liens utiles.' },
    { name: '・😂・humour', topic: 'Mèmes et blagues.' },
    { name: '・💭・suggestions', topic: '/suggestion — vos idées pour le serveur.' },
  ]},
  { category: '┈ ・ ÉCONOMIE ・ ┈', channels: [
    { name: '・💰・économie', topic: '/work /crime /heist /daily — gagner des €.' },
    { name: '・🏦・banque', topic: '/banque solde /banque interets /pret' },
    { name: '・📊・marché', topic: '/market voir /market vendre /meteo_marche' },
    { name: '・🏠・immobilier', topic: '/immobilier catalogue /immo marche' },
    { name: '・🏆・classement', topic: '/top € /top xp /badges top' },
  ]},
  { category: '┈ ・ CASINO ・ ┈', channels: [
    { name: '・🎰・slots', topic: '/slots /mega-slots' },
    { name: '・🎡・roulette', topic: '/roulette /roue-fortune' },
    { name: '・🃏・cartes', topic: '/blackjack /baccarat /videopoker /poker /war' },
    { name: '・🎲・dés', topic: '/des /sicbo /craps' },
    { name: '・⛏️・mines', topic: '/mines /crash /plinko /coffre-magique' },
    { name: '・🎫・grattage', topic: '/grattage' },
  ]},
  { category: '┈ ・ JEUX FUN ・ ┈', channels: [
    { name: '・🎁・mystery-box', topic: '/mystery ouvrir — boîte mystère toutes les 6h !' },
    { name: '・🎡・spin-roue', topic: '/spin tourner — roue gratuite quotidienne !' },
    { name: '・🐾・animaux', topic: '/pet adopter /pet voir — adoptez un animal !' },
    { name: '・🎯・mini-jeux', topic: '/quiz /pendu /morpion /devine /enigme' },
    { name: '・🗺️・aventures', topic: '/donjon /chasse /mine /rpg /ferme' },
    { name: '・⚔️・duels', topic: '/duel /trivia_duel — défier un membre.' },
  ]},
  { category: '┈ ・ ÉVÉNEMENTS ・ ┈', channels: [
    { name: '・🏅・badges', topic: '/badges voir /badges liste — collectionnez les badges.' },
    { name: '・🗺️・quêtes', topic: '/quest voir /missions — quêtes communautaires.' },
    { name: '・🎪・tournois', topic: '/tournoi creer /tournoi rejoindre' },
    { name: '・🎟️・loterie', topic: '/loto acheter /lotto — loterie hebdo.' },
    { name: '・🏆・battle-pass', topic: '/battlepass — récompenses progressives.' },
  ]},
  { category: '┈ ・ COMMUNAUTÉ ・ ┈', channels: [
    { name: '・👤・profils', topic: '/profil — vos profils et statistiques.' },
    { name: '・💕・mariages', topic: '/mariage — engagez-vous.' },
    { name: '・👨‍👩‍👧・famille', topic: '/famille — créez votre famille.' },
    { name: '・🏰・clans', topic: '/clans — rejoignez ou créez un clan.' },
    { name: '・💖・réputation', topic: '/rep — donnez de la rep aux membres.' },
  ]},
  { category: '┈ ・ ADMINISTRATION ・ ┈', channels: [
    { name: '・🔧・bot-logs', topic: 'Logs du bot.' },
    { name: '・👮・modération', topic: 'Espace modérateurs.' },
    { name: '・⚙️・config', topic: 'Configuration.' },
    { name: '・🎫・tickets', topic: 'Système de tickets support.' },
    { name: '・🔍・diagnostic', topic: '/diagnostic — santé du bot.' },
  ]},
];

const RENAME_MAP = [
  [/^g[eé]n[eé]ral$/i,'・💬・général'],[/^announcements?$/i,'・📣・annonces'],[/^annonces$/i,'・📣・annonces'],
  [/^r[eè]gles?$/i,'・📋・règles'],[/^rules?$/i,'・📋・règles'],[/^bienvenue$/i,'・👋・bienvenue'],
  [/^welcome$/i,'・👋・bienvenue'],[/^m[eé]dias?$/i,'・🖼・médias'],[/^humour$/i,'・😂・humour'],
  [/^memes?$/i,'・😂・humour'],[/^liens?$/i,'・🔗・liens'],[/^links?$/i,'・🔗・liens'],
  [/^econom/i,'・💰・économie'],[/^classement$/i,'・🏆・classement'],[/^leaderboard$/i,'・🏆・classement'],
  [/^banque?$/i,'・🏦・banque'],[/^bank$/i,'・🏦・banque'],[/^march[eé]?$/i,'・📊・marché'],
  [/^jeux$/i,'・🎮・jeux'],[/^games?$/i,'・🎮・jeux'],[/^casino$/i,'・🎲・casino'],
  [/^tournois?$/i,'・⚔️・tournois'],[/^collectibles?$/i,'・🃏・collectibles'],
  [/^bot-?logs?$/i,'・🔧・bot-logs'],[/^mod(eration)?$/i,'・👮・modération'],
  [/^r[oô]les?$/i,'・🎫・rôles'],[/^config$/i,'・⚙️・config'],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serveur')
    .setDescription("✨ Configure l'apparence du serveur avec ・")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('apercu').setDescription("👁️ Aperçu du modèle"))
    .addSubcommand(s => s.setName('renommer').setDescription("🏷️ Renomme les salons avec le style ・"))
    .addSubcommand(s => s.setName('creer').setDescription("✨ Crée les catégories et salons manquants"))
    .addSubcommand(s => s.setName('separateur').setDescription("➖ Ajoute un salon séparateur")
      .addStringOption(o => o.setName('nom').setDescription('Nom du séparateur').setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      const errFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return errFn({ content: '🔒 Réservé aux administrateurs.', ephemeral: true });
    }
    const sub = interaction.options.getSubcommand(), guild = interaction.guild;

    if (sub === 'apercu') {
      const lines = TEMPLATE.flatMap(t => [`\n**${t.category}**`, ...t.channels.map(ch => `　${ch.name}`)]).join('\n');
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('✨ ・ Modèle de serveur ・').setDescription(lines.slice(0,4090)).setFooter({ text: '/setup-serveur creer pour appliquer' })], ephemeral: true });
    }

    if (sub === 'renommer') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      let renamed = 0;
      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText && !c.name.includes('・'))) {
        for (const [pat, newName] of RENAME_MAP) {
          if (pat.test(ch.name)) { try { await ch.setName(newName); renamed++; } catch {} break; }
        }
      }
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🏷️ ・ Renommage terminé ・')
        .setDescription(renamed === 0 ? '⚠️ Aucun salon ne correspond.' : `**${renamed}** salon(s) renommé(s) avec le style ・.`).setTimestamp()] });
    }

    if (sub === 'creer') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      let created = 0, existed = 0;
      for (const def of TEMPLATE) {
        let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === def.category);
        if (!cat) { try { cat = await guild.channels.create({ name: def.category, type: ChannelType.GuildCategory }); created++; } catch { continue; } } else { existed++; }
        for (const chDef of def.channels) {
          if (!guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === chDef.name)) {
            try { await guild.channels.create({ name: chDef.name, type: ChannelType.GuildText, parent: cat.id, topic: chDef.topic }); created++; } catch {}
          } else { existed++; }
        }
      }
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✨ ・ Configuration terminée ・')
        .addFields({ name: '・ ✅ Créés', value: `**${created}**`, inline: true }, { name: '・ ✓ Existants', value: `**${existed}**`, inline: true }).setTimestamp()] });
    }

    if (sub === 'separateur') {
      const nom = interaction.options.getString('nom');
      try {
        const sep = await guild.channels.create({ name: nom, type: ChannelType.GuildText,
          permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['SendMessages','AddReactions'], allow: ['ViewChannel'] }] });
        const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
        return respFn({ embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('➖ ・ Séparateur créé').setDescription(`**${sep.name}** ・ Déplacez-le où vous voulez.`)], ephemeral: true });
      } catch (e) {
        const errFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
        return errFn({ content: `❌ Erreur : ${e.message}`, ephemeral: true });
      }
    }
  }
};
