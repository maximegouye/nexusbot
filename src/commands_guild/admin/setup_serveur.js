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
    .addSubcommand(s => s.setName('ajouter-nouveautes').setDescription("🆕 Ajoute SEULEMENT les nouvelles catégories (Casino, Jeux Fun, Événements, Communauté)"))
    .addSubcommand(s => s.setName('nettoyer-roles').setDescription("🧹 Trouve et liste les rôles en doublon (suppression sur confirmation)")
      .addBooleanOption(o => o.setName('supprimer').setDescription('true = supprime, false = liste seulement').setRequired(false)))
    .addSubcommand(s => s.setName('perfectionner').setDescription("✨ Applique des permissions et topics parfaits à tous les salons (existants + nouveaux)"))
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

    // ─── 🆕 AJOUTE UNIQUEMENT LES NOUVELLES CATÉGORIES ─────────
    if (sub === 'ajouter-nouveautes') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      // Catégories à ajouter (les NOUVELLES uniquement, pas celles qui existaient déjà)
      const NEW_ONLY = TEMPLATE.filter(t =>
        ['┈ ・ CASINO ・ ┈', '┈ ・ JEUX FUN ・ ┈', '┈ ・ ÉVÉNEMENTS ・ ┈', '┈ ・ COMMUNAUTÉ ・ ┈'].includes(t.category)
      );
      let created = 0, existed = 0;
      for (const def of NEW_ONLY) {
        let cat = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === def.category);
        if (!cat) {
          try { cat = await guild.channels.create({ name: def.category, type: ChannelType.GuildCategory }); created++; }
          catch (e) { console.error('[setup-serveur] cat create err:', e.message); continue; }
        } else { existed++; }
        for (const chDef of def.channels) {
          if (!guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === chDef.name)) {
            try { await guild.channels.create({ name: chDef.name, type: ChannelType.GuildText, parent: cat.id, topic: chDef.topic }); created++; }
            catch (e) { console.error('[setup-serveur] chan create err:', e.message); }
          } else { existed++; }
        }
      }
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🆕 ・ Nouveautés ajoutées ・')
        .setDescription('Seules les **4 nouvelles catégories** ont été ajoutées (Casino, Jeux Fun, Événements, Communauté). Tes catégories existantes n\'ont PAS été touchées.')
        .addFields({ name: '✅ Créés', value: `**${created}** nouveau(x)`, inline: true }, { name: '✓ Existaient déjà', value: `**${existed}**`, inline: true })
        .setTimestamp()] });
    }

    // ─── 🧹 NETTOYAGE RÔLES EN DOUBLON ─────────────────────────
    if (sub === 'nettoyer-roles') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const supprimer = interaction.options.getBoolean('supprimer') === true;

      // Groupe les rôles par nom (case-insensitive)
      const byName = new Map();
      for (const [, r] of guild.roles.cache) {
        if (r.managed || r.id === guild.id) continue; // skip @everyone et rôles bots
        const key = r.name.trim().toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(r);
      }
      // Filtrer ceux avec ≥ 2 occurrences
      const dupes = [];
      for (const [name, roles] of byName) {
        if (roles.length >= 2) dupes.push({ name, roles });
      }

      if (!dupes.length) {
        const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
        return respFn({ content: '✅ Aucun rôle en doublon détecté !' });
      }

      const lines = dupes.slice(0, 25).map(d => `• **${d.roles[0].name}** : ${d.roles.length} copies`).join('\n');
      const totalDupes = dupes.reduce((s, d) => s + (d.roles.length - 1), 0);

      if (!supprimer) {
        // Mode liste uniquement
        const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
        return respFn({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🧹 ・ Rôles en doublon détectés')
          .setDescription(lines + `\n\n**Total à nettoyer : ${totalDupes} rôle(s)**\n\n⚠️ Utilise \`/setup-serveur nettoyer-roles supprimer:true\` pour supprimer les doublons. **L'ORIGINAL (le 1er créé) est gardé**, les copies sont supprimées.`)
        ] });
      }

      // Mode suppression
      let deleted = 0, failed = 0;
      for (const { roles } of dupes) {
        // Trie par date de création asc (le plus ancien = original)
        roles.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        // Garde le 1er, supprime les autres
        for (let i = 1; i < roles.length; i++) {
          try {
            // Re-attribue les membres du rôle dupliqué à l'original avant suppression
            const original = roles[0];
            for (const [, member] of roles[i].members) {
              try { await member.roles.add(original).catch(() => {}); } catch {}
            }
            await roles[i].delete('Doublon — nettoyage par /setup-serveur').catch(() => {});
            deleted++;
          } catch (e) {
            console.error('[setup-serveur] delete role err:', e.message);
            failed++;
          }
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🧹 ・ Rôles en doublon supprimés')
        .addFields(
          { name: '🗑️ Supprimés', value: `**${deleted}**`, inline: true },
          { name: '❌ Échecs', value: `**${failed}**`, inline: true },
          { name: '✅ Reste', value: `Originaux conservés`, inline: true }
        )
        .setFooter({ text: 'Les membres ont été re-attribués au rôle original avant suppression.' })
        .setTimestamp()] });
    }

    // ─── ✨ PERFECTIONNER : permissions + topics + slowmode ──────
    if (sub === 'perfectionner') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;

      // Détection automatique des rôles staff
      const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed);
      const modRoles   = guild.roles.cache.filter(r =>
        r.permissions.has(PermissionFlagsBits.ManageMessages) || r.permissions.has(PermissionFlagsBits.KickMembers)
      );

      // Profils de permissions (par pattern nom de salon)
      const PROFILES = {
        // Lecture seule pour @everyone, écriture pour admins
        readOnly:  { everyone: { ViewChannel: true, SendMessages: false, AddReactions: true, ReadMessageHistory: true }, },
        // Privé staff uniquement
        staffOnly: { everyone: { ViewChannel: false }, },
        // Public normal (@everyone read+send)
        public:    { everyone: { ViewChannel: true, SendMessages: true, AddReactions: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, },
        // Public mais slowmode 5s (anti-spam) pour les jeux/économie
        publicSlow:{ everyone: { ViewChannel: true, SendMessages: true, AddReactions: true, ReadMessageHistory: true, AttachFiles: false, EmbedLinks: false }, slowmode: 5 },
        // Public médias (autorise images)
        media:     { everyone: { ViewChannel: true, SendMessages: true, AttachFiles: true, EmbedLinks: true, ReadMessageHistory: true }, },
      };

      // Mapping nom salon → profil + topic suggéré
      const RULES = [
        // Read-only (annonces, règles, bienvenue, partenaires, badges, classement, battle-pass)
        { test: /règles?|rules?/i,        profile: 'readOnly',  topic: '📋 Règles du serveur — lis attentivement.' },
        { test: /annonces?|announc/i,     profile: 'readOnly',  topic: '📣 Annonces officielles.' },
        { test: /bienvenue|welcome/i,     profile: 'readOnly',  topic: '👋 Accueil des nouveaux membres.' },
        { test: /partenaires?|partners?/i,profile: 'readOnly',  topic: '💎 Serveurs partenaires (auto via /partenariat).' },
        { test: /classement|leaderboard|top/i, profile: 'readOnly',topic: '🏆 Classement — /top € /top xp /badges top' },
        { test: /battle.?pass/i,          profile: 'readOnly',  topic: '🏆 /battlepass — récompenses progressives.' },
        { test: /partenariat/i,           profile: 'readOnly',  topic: '💎 Annonces des partenariats.' },
        { test: /badges?/i,               profile: 'readOnly',  topic: '🏅 /badges voir /badges liste — collectionnez.' },

        // Staff only
        { test: /bot.?logs?|moderation|mod-logs|admin/i, profile: 'staffOnly', topic: '🔒 Réservé au staff.' },
        { test: /diagnostic|tickets-?logs?/i, profile: 'staffOnly', topic: '🔍 /diagnostic — santé du bot (admin).' },
        { test: /config|configuration/i,  profile: 'staffOnly',  topic: '⚙️ Configuration.' },

        // Médias
        { test: /m[eé]dias?|images?|gifs?|photos?/i, profile: 'media', topic: '🖼 Images, GIFs et vidéos.' },

        // Public slowmode (jeux, casino, économie - anti-spam)
        { test: /slots?|mega.?slots?/i,   profile: 'publicSlow', topic: '🎰 /slots /mega-slots — machines à sous.' },
        { test: /roulette|roue/i,         profile: 'publicSlow', topic: '🎡 /roulette /roue-fortune' },
        { test: /cartes?|blackjack|baccarat|poker|videopoker|war/i, profile: 'publicSlow', topic: '🃏 Jeux de cartes — /blackjack /baccarat /videopoker /poker /war' },
        { test: /d[eé]s|sicbo|craps/i,    profile: 'publicSlow', topic: '🎲 /des /sicbo /craps' },
        { test: /mines|crash|plinko|coffre/i, profile: 'publicSlow', topic: '⛏️ /mines /crash /plinko /coffre-magique' },
        { test: /grattage|scratch/i,      profile: 'publicSlow', topic: '🎫 /grattage — cartes à gratter.' },
        { test: /casino/i,                profile: 'publicSlow', topic: '🎰 Salon casino — tous les jeux.' },
        { test: /mystery|mystère/i,       profile: 'publicSlow', topic: '🎁 /mystery ouvrir — boîte mystère 6h.' },
        { test: /spin|roue.?fortune/i,    profile: 'publicSlow', topic: '🎡 /spin tourner — roue gratuite quotidienne.' },
        { test: /animaux|pets?|pet/i,     profile: 'publicSlow', topic: '🐾 /pet adopter /pet voir /pet nourrir' },
        { test: /mini.?jeux|games?/i,     profile: 'publicSlow', topic: '🎯 /quiz /pendu /morpion /devine /enigme' },
        { test: /aventures?|donjon|chasse|rpg|ferme/i, profile: 'publicSlow', topic: '🗺️ /donjon /chasse /mine /rpg /ferme' },
        { test: /duels?|trivia/i,         profile: 'publicSlow', topic: '⚔️ /duel /trivia_duel' },
        { test: /immobilier|immo|maison|propri[eé]t[eé]/i, profile: 'publicSlow', topic: '🏠 /immobilier catalogue /immo marche' },
        { test: /banque|bank/i,           profile: 'publicSlow', topic: '🏦 /banque solde /banque interets /pret' },
        { test: /march[eé]|market/i,      profile: 'publicSlow', topic: '📊 /market voir /market vendre /meteo_marche' },
        { test: /[eé]conomie|economy|economic/i, profile: 'publicSlow', topic: '💰 /work /crime /heist /daily — gagner des €.' },
        { test: /loto|lotto|loterie/i,    profile: 'publicSlow', topic: '🎟️ /loto acheter /lotto — loterie hebdo.' },
        { test: /quêtes?|quests?/i,       profile: 'publicSlow', topic: '🗺️ /quest voir /missions — quêtes communautaires.' },
        { test: /tournois?|tournaments?/i,profile: 'publicSlow', topic: '🎪 /tournoi creer /tournoi rejoindre' },
        { test: /profils?|profiles?/i,    profile: 'publicSlow', topic: '👤 /profil — vos profils et statistiques.' },
        { test: /mariages?|marriages?/i,  profile: 'publicSlow', topic: '💕 /mariage — engagez-vous.' },
        { test: /famille/i,               profile: 'publicSlow', topic: '👨‍👩‍👧 /famille — créez votre famille.' },
        { test: /clans?/i,                profile: 'publicSlow', topic: '🏰 /clans — rejoignez ou créez un clan.' },
        { test: /r[eé]putation|rep/i,     profile: 'publicSlow', topic: '💖 /rep — donnez de la rep aux membres.' },
        { test: /suggestions?|sugges/i,   profile: 'publicSlow', topic: '💭 /suggestion — vos idées pour le serveur.' },
        { test: /humour|memes?|jokes?/i,  profile: 'public',     topic: '😂 Mèmes et blagues.' },
        { test: /liens?|links?/i,         profile: 'public',     topic: '🔗 Liens utiles.' },
        { test: /general|général|chat/i,  profile: 'public',     topic: '💬 Discussion générale.' },
        { test: /r[oô]les?/i,             profile: 'readOnly',   topic: '🎫 Choisissez vos rôles.' },
      ];

      let totalUpdated = 0, errors = 0;

      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        // Trouve le profil applicable
        let matched = null;
        for (const r of RULES) {
          if (r.test.test(ch.name)) { matched = r; break; }
        }
        if (!matched) continue; // Pas de règle = on ne touche pas

        const profile = PROFILES[matched.profile];
        if (!profile) continue;

        try {
          // Mode NON-DESTRUCTIF : on EDITE seulement les overrides @everyone, on ne touche PAS aux autres rôles/membres existants
          const allowEveryone = [], denyEveryone = [];
          for (const [perm, val] of Object.entries(profile.everyone || {})) {
            if (val === true) allowEveryone.push(perm);
            else if (val === false) denyEveryone.push(perm);
          }
          if (allowEveryone.length || denyEveryone.length) {
            await ch.permissionOverwrites.edit(everyone.id, Object.fromEntries([
              ...allowEveryone.map(p => [p, true]),
              ...denyEveryone.map(p => [p, false]),
            ])).catch(() => {});
          }

          // Pour staffOnly / readOnly : on AJOUTE les admins (sans toucher aux autres overrides)
          if (matched.profile === 'staffOnly') {
            for (const [, ar] of adminRoles) {
              await ch.permissionOverwrites.edit(ar.id, {
                ViewChannel: true, SendMessages: true, ManageMessages: true,
              }).catch(() => {});
            }
          }
          if (matched.profile === 'readOnly') {
            for (const [, ar] of adminRoles) {
              await ch.permissionOverwrites.edit(ar.id, {
                SendMessages: true, ManageMessages: true,
              }).catch(() => {});
            }
          }

          // Topic — préserve si déjà défini (sauf si vide)
          if (matched.topic && (!ch.topic || ch.topic.trim().length === 0)) {
            await ch.setTopic(matched.topic).catch(() => {});
          }

          // Slowmode — n'écrase pas si l'admin a déjà défini un slowmode différent
          if (profile.slowmode && (ch.rateLimitPerUser === 0)) {
            await ch.setRateLimitPerUser(profile.slowmode).catch(() => {});
          }

          totalUpdated++;
        } catch (e) {
          errors++;
          console.error('[setup-serveur] perfectionner err:', ch.name, e.message);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('✨ ・ Serveur perfectionné ・')
        .setDescription([
          `**${totalUpdated}** salon(s) optimisé(s) : permissions, topics, et slowmode appliqués.`,
          '',
          '✅ **Annonces / règles / classement** → lecture seule (admins postent)',
          '🔒 **Bot-logs / mod / config / diagnostic** → staff uniquement',
          '🎰 **Casino / jeux / éco / immobilier** → public + slowmode 5s anti-spam',
          '🖼 **Médias** → autorise images & embeds',
          '💬 **Général / humour / liens** → public normal',
          '',
          '*Tes rôles existants ne sont PAS modifiés.*',
        ].join('\n'))
        .addFields(
          { name: '✅ Salons mis à jour', value: `**${totalUpdated}**`, inline: true },
          { name: '❌ Erreurs', value: `**${errors}**`, inline: true },
        )
        .setTimestamp()] });
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
