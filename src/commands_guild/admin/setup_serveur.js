// setup_serveur.js — Esthétique serveur avec ・
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const TEMPLATE = [
  { category: '┈ ・ INFORMATIONS ・ ┈', channels: [
    { name: '・📋・règles', topic: 'Règles du serveur.' },
    { name: '・📣・annonces', topic: 'Annonces officielles.' },
    { name: '・👋・bienvenue', topic: 'Accueil des nouveaux membres.' },
    { name: '・🎫・rôles', topic: 'Choisissez vos rôles.' },
  ]},
  { category: '┈ ・ GÉNÉRAL ・ ┈', channels: [
    { name: '・💬・général', topic: 'Discussion générale.' },
    { name: '・🖼・médias', topic: 'Images, GIFs et vidéos.' },
    { name: '・🔗・liens', topic: 'Liens utiles.' },
    { name: '・😂・humour', topic: 'Mèmes et blagues.' },
  ]},
  { category: '┈ ・ ÉCONOMIE ・ ┈', channels: [
    { name: '・💰・économie', topic: 'Commandes économiques.' },
    { name: '・🏦・banque', topic: '/banque solde /banque interets' },
    { name: '・📊・marché', topic: '/meteo_marche' },
    { name: '・🏆・classement', topic: '/top € /top xp' },
  ]},
  { category: '┈ ・ JEUX ・ ┈', channels: [
    { name: '・🎮・jeux', topic: 'Mini-jeux.' },
    { name: '・⚔️・tournois', topic: '/tournoi creer /tournoi rejoindre' },
    { name: '・🎲・casino', topic: 'Casino.' },
    { name: '・🃏・collectibles', topic: '/collectibles ouvrir' },
  ]},
  { category: '┈ ・ ADMINISTRATION ・ ┈', channels: [
    { name: '・🔧・bot-logs', topic: 'Logs du bot.' },
    { name: '・👮・modération', topic: 'Espace modérateurs.' },
    { name: '・⚙️・config', topic: 'Configuration.' },
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
