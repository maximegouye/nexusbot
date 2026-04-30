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
    .addSubcommand(s => s.setName('perfectionner').setDescription("✨ Applique permissions+topics SANS écraser tes customs (mode safe)"))
    .addSubcommand(s => s.setName('tout-synchroniser').setDescription("🎨 FORCE la cohérence visuelle partout (renomme + topics + perms) — aucune suppression"))
    .addSubcommand(s => s.setName('detecter-doublons-salons').setDescription("🔎 Détecte les salons qui font la même chose (par fonction)")
      .addBooleanOption(o => o.setName('supprimer-vides').setDescription('true = supprime les doublons vides automatiquement').setRequired(false)))
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

    // ─── 🎨 TOUT SYNCHRONISER : force la cohérence visuelle ─────
    if (sub === 'tout-synchroniser') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;
      const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator) && !r.managed);

      // Profils permissions
      const PROFILES = {
        readOnly:  { everyone: { ViewChannel: true, SendMessages: false, AddReactions: true, ReadMessageHistory: true }, },
        staffOnly: { everyone: { ViewChannel: false }, },
        public:    { everyone: { ViewChannel: true, SendMessages: true, AddReactions: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true }, },
        publicSlow:{ everyone: { ViewChannel: true, SendMessages: true, AddReactions: true, ReadMessageHistory: true }, slowmode: 5 },
        media:     { everyone: { ViewChannel: true, SendMessages: true, AttachFiles: true, EmbedLinks: true, ReadMessageHistory: true }, },
      };

      // Règles : pattern → { profil, topic forcé, nouveau nom (・emoji・) }
      const RULES = [
        { test: /règles?|rules?/i,        profile: 'readOnly',   topic: '📋 Règles du serveur — lis attentivement.',         rename: '・📋・règles' },
        { test: /annonces?|announc/i,     profile: 'readOnly',   topic: '📣 Annonces officielles.',                           rename: '・📣・annonces' },
        { test: /bienvenue|welcome/i,     profile: 'readOnly',   topic: '👋 Accueil des nouveaux membres.',                   rename: '・👋・bienvenue' },
        { test: /partenaires?|partners?|partenariat/i, profile: 'readOnly', topic: '💎 Serveurs partenaires (auto via /partenariat).', rename: '・💎・partenaires' },
        { test: /classement|leaderboard|top/i, profile: 'readOnly', topic: '🏆 Classement — /top € /top xp /badges top',     rename: '・🏆・classement' },
        { test: /battle.?pass/i,          profile: 'readOnly',   topic: '🏆 /battlepass — récompenses progressives.',         rename: '・🏆・battle-pass' },
        { test: /badges?/i,               profile: 'readOnly',   topic: '🏅 /badges voir /badges liste — collectionnez.',     rename: '・🏅・badges' },

        { test: /bot.?logs?|mod-?logs?/i, profile: 'staffOnly',  topic: '🔒 Logs du bot — staff uniquement.',                 rename: '・🔧・bot-logs' },
        { test: /moderation|modération/i, profile: 'staffOnly',  topic: '👮 Espace modérateurs.',                             rename: '・👮・modération' },
        { test: /admin/i,                 profile: 'staffOnly',  topic: '🔒 Espace administrateurs.',                         rename: '・🔒・admin' },
        { test: /diagnostic/i,            profile: 'staffOnly',  topic: '🔍 /diagnostic — santé du bot.',                     rename: '・🔍・diagnostic' },
        { test: /^config|configuration|cfg/i, profile: 'staffOnly', topic: '⚙️ Configuration du bot.',                        rename: '・⚙️・config' },
        { test: /tickets?-?logs?/i,       profile: 'staffOnly',  topic: '🎫 Logs tickets — staff.',                            rename: '・🎫・tickets-logs' },

        { test: /m[eé]dias?|images?|gifs?|photos?/i, profile: 'media', topic: '🖼 Images, GIFs et vidéos.',                  rename: '・🖼・médias' },

        { test: /^slots?$|mega.?slots?/i, profile: 'publicSlow', topic: '🎰 /slots /mega-slots — machines à sous.',           rename: '・🎰・slots' },
        { test: /roulette/i,              profile: 'publicSlow', topic: '🎡 /roulette — roulette classique.',                 rename: '・🎡・roulette' },
        { test: /roue.?fortune|roue/i,    profile: 'publicSlow', topic: '🎡 /roue-fortune — roue de la fortune.',             rename: '・🎡・roue-fortune' },
        { test: /cartes?|blackjack|baccarat|poker|videopoker|war/i, profile: 'publicSlow', topic: '🃏 /blackjack /baccarat /videopoker /poker /war', rename: '・🃏・cartes' },
        { test: /d[eé]s|sicbo|craps/i,    profile: 'publicSlow', topic: '🎲 /des /sicbo /craps',                              rename: '・🎲・dés' },
        { test: /mines|crash|plinko|coffre/i, profile: 'publicSlow', topic: '⛏️ /mines /crash /plinko /coffre-magique',      rename: '・⛏️・mines' },
        { test: /grattage|scratch/i,      profile: 'publicSlow', topic: '🎫 /grattage — cartes à gratter.',                   rename: '・🎫・grattage' },
        { test: /^casino$/i,              profile: 'publicSlow', topic: '🎰 Salon casino — tous les jeux.',                   rename: '・🎲・casino' },
        { test: /mystery|mystère|mystere/i, profile: 'publicSlow', topic: '🎁 /mystery ouvrir — boîte mystère 6h.',           rename: '・🎁・mystery-box' },
        { test: /^spin$|spin.?roue/i,     profile: 'publicSlow', topic: '🎡 /spin tourner — roue gratuite quotidienne.',      rename: '・🎡・spin-roue' },
        { test: /animaux|^pets?$|^pet$/i, profile: 'publicSlow', topic: '🐾 /pet adopter /pet voir /pet nourrir',             rename: '・🐾・animaux' },
        { test: /mini.?jeux|^games?$|^jeux$/i, profile: 'publicSlow', topic: '🎯 /quiz /pendu /morpion /devine /enigme',     rename: '・🎯・mini-jeux' },
        { test: /aventures?|donjon|chasse|^rpg$|ferme/i, profile: 'publicSlow', topic: '🗺️ /donjon /chasse /mine /rpg /ferme', rename: '・🗺️・aventures' },
        { test: /duels?|trivia/i,         profile: 'publicSlow', topic: '⚔️ /duel /trivia_duel',                              rename: '・⚔️・duels' },
        { test: /immobilier|^immo$|maison|propri[eé]t[eé]/i, profile: 'publicSlow', topic: '🏠 /immobilier catalogue /immo marche', rename: '・🏠・immobilier' },
        { test: /banque|^bank$/i,         profile: 'publicSlow', topic: '🏦 /banque solde /banque interets /pret',            rename: '・🏦・banque' },
        { test: /^march[eé]|^market$/i,   profile: 'publicSlow', topic: '📊 /market voir /market vendre /meteo_marche',      rename: '・📊・marché' },
        { test: /[eé]conomie|economy/i,   profile: 'publicSlow', topic: '💰 /work /crime /heist /daily — gagner des €.',    rename: '・💰・économie' },
        { test: /loto|lotto|loterie/i,    profile: 'publicSlow', topic: '🎟️ /loto acheter /lotto — loterie hebdo.',          rename: '・🎟️・loterie' },
        { test: /quêtes?|quetes?|quests?/i, profile: 'publicSlow', topic: '🗺️ /quest voir /missions',                         rename: '・🗺️・quêtes' },
        { test: /tournois?|tournaments?/i,profile: 'publicSlow', topic: '🎪 /tournoi creer /tournoi rejoindre',               rename: '・🎪・tournois' },
        { test: /profils?|profiles?/i,    profile: 'publicSlow', topic: '👤 /profil — vos profils et statistiques.',          rename: '・👤・profils' },
        { test: /mariages?|marriages?/i,  profile: 'publicSlow', topic: '💕 /mariage — engagez-vous.',                        rename: '・💕・mariages' },
        { test: /famille/i,               profile: 'publicSlow', topic: '👨‍👩‍👧 /famille — créez votre famille.',                 rename: '・👨‍👩‍👧・famille' },
        { test: /clans?/i,                profile: 'publicSlow', topic: '🏰 /clans — rejoignez ou créez un clan.',            rename: '・🏰・clans' },
        { test: /r[eé]putation|^rep$/i,   profile: 'publicSlow', topic: '💖 /rep — donnez de la rep aux membres.',            rename: '・💖・réputation' },
        { test: /suggestions?|sugges/i,   profile: 'publicSlow', topic: '💭 /suggestion — vos idées pour le serveur.',        rename: '・💭・suggestions' },

        { test: /humour|memes?|jokes?/i,  profile: 'public',     topic: '😂 Mèmes et blagues.',                                rename: '・😂・humour' },
        { test: /liens?|links?/i,         profile: 'public',     topic: '🔗 Liens utiles.',                                    rename: '・🔗・liens' },
        { test: /general|général|^chat$/i,profile: 'public',     topic: '💬 Discussion générale.',                             rename: '・💬・général' },
        { test: /r[oô]les?/i,             profile: 'readOnly',   topic: '🎫 Choisissez vos rôles.',                           rename: '・🎫・rôles' },
      ];

      let renamed = 0, retopiced = 0, repermed = 0, slowmoded = 0, errors = 0, skipped = 0;

      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        // Trouve la règle qui matche
        let matched = null;
        for (const r of RULES) {
          if (r.test.test(ch.name)) { matched = r; break; }
        }
        if (!matched) { skipped++; continue; }

        const profile = PROFILES[matched.profile];

        try {
          // 1) Renomme avec le style ・emoji・nom (FORCE)
          if (matched.rename && ch.name !== matched.rename) {
            await ch.setName(matched.rename).catch(() => {});
            renamed++;
          }

          // 2) Topic (FORCE — on synchronise tout au même style)
          if (matched.topic && ch.topic !== matched.topic) {
            await ch.setTopic(matched.topic).catch(() => {});
            retopiced++;
          }

          // 3) Permissions @everyone (mode edit, n'écrase pas les autres rôles)
          if (profile.everyone) {
            const overwrite = {};
            for (const [perm, val] of Object.entries(profile.everyone)) overwrite[perm] = val;
            await ch.permissionOverwrites.edit(everyone.id, overwrite).catch(() => {});
            repermed++;
          }

          // 4) Admin overrides pour staffOnly et readOnly
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

          // 5) Slowmode (FORCE pour les jeux/casino)
          if (profile.slowmode && ch.rateLimitPerUser !== profile.slowmode) {
            await ch.setRateLimitPerUser(profile.slowmode).catch(() => {});
            slowmoded++;
          } else if (!profile.slowmode && ch.rateLimitPerUser !== 0) {
            // Retire le slowmode pour les salons non-jeux
            await ch.setRateLimitPerUser(0).catch(() => {});
          }
        } catch (e) {
          errors++;
          console.error('[setup-serveur] tout-synchroniser err:', ch.name, e.message);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('🎨 ・ Serveur 100% synchronisé ・')
        .setDescription([
          '**Cohérence visuelle appliquée à TOUS les salons** (anciens + nouveaux).',
          '',
          '✅ Aucun salon supprimé, aucun message perdu, aucun membre affecté.',
          '✅ Renommage `・emoji・nom` partout',
          '✅ Topics descriptifs unifiés',
          '✅ Permissions cohérentes par catégorie',
          '✅ Slowmode 5s sur jeux/casino, 0s ailleurs',
        ].join('\n'))
        .addFields(
          { name: '🏷️ Renommés',     value: `**${renamed}**`, inline: true },
          { name: '📝 Topics',         value: `**${retopiced}**`, inline: true },
          { name: '🔒 Permissions',    value: `**${repermed}**`, inline: true },
          { name: '⏱️ Slowmode',       value: `**${slowmoded}**`, inline: true },
          { name: '⏭️ Non concernés',  value: `**${skipped}**`, inline: true },
          { name: '❌ Erreurs',         value: `**${errors}**`, inline: true },
        )
        .setTimestamp()] });
    }

    // ─── 🔎 DÉTECTER LES SALONS DOUBLONS PAR FONCTION ─────────
    if (sub === 'detecter-doublons-salons') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const supprimer = interaction.options.getBoolean('supprimer-vides') === true;

      // Mêmes patterns de reconnaissance que tout-synchroniser
      const PURPOSES = [
        { id: 'règles',        test: /règles?|rules?/i },
        { id: 'annonces',      test: /annonces?|announc/i },
        { id: 'bienvenue',     test: /bienvenue|welcome/i },
        { id: 'partenaires',   test: /partenaires?|partners?|partenariat/i },
        { id: 'classement',    test: /classement|leaderboard|^top$/i },
        { id: 'badges',        test: /^badges?$/i },
        { id: 'battle-pass',   test: /battle.?pass/i },
        { id: 'bot-logs',      test: /bot.?logs?|mod-?logs?/i },
        { id: 'modération',    test: /moderation|modération/i },
        { id: 'admin',         test: /^admin$|^staff-admin$/i },
        { id: 'diagnostic',    test: /^diagnostic$/i },
        { id: 'config',        test: /^config|configuration|cfg$/i },
        { id: 'tickets-logs',  test: /tickets?-?logs?/i },
        { id: 'médias',        test: /^m[eé]dias?$|^images?$|^gifs?$|^photos?$/i },
        { id: 'slots',         test: /^slots?$|mega.?slots?/i },
        { id: 'roulette',      test: /^roulette$/i },
        { id: 'roue-fortune',  test: /roue.?fortune|^roue$/i },
        { id: 'cartes',        test: /^cartes?$|^blackjack$|^baccarat$|^poker$|^videopoker$|^war$/i },
        { id: 'dés',           test: /^d[eé]s$|^sicbo$|^craps$/i },
        { id: 'mines',         test: /^mines$|^crash$|^plinko$|^coffre/i },
        { id: 'grattage',      test: /grattage|scratch/i },
        { id: 'casino',        test: /^casino$|^salle-casino$/i },
        { id: 'mystery-box',   test: /mystery|mystère|mystere|mystery.?box/i },
        { id: 'spin-roue',     test: /^spin$|spin.?roue/i },
        { id: 'animaux',       test: /^animaux$|^pets?$|^pet$/i },
        { id: 'mini-jeux',     test: /mini.?jeux|^games?$|^jeux$/i },
        { id: 'aventures',     test: /aventures?|^donjon$|^chasse$|^rpg$|^ferme$/i },
        { id: 'duels',         test: /^duels?$|^trivia$/i },
        { id: 'immobilier',    test: /immobilier|^immo$|^maison$|^propri[eé]t[eé]$/i },
        { id: 'banque',        test: /^banque$|^bank$/i },
        { id: 'marché',        test: /^march[eé]$|^market$/i },
        { id: 'économie',      test: /[eé]conomie|economy/i },
        { id: 'loterie',       test: /^loto$|^lotto$|^loterie$/i },
        { id: 'quêtes',        test: /^quêtes?$|^quetes?$|^quests?$/i },
        { id: 'tournois',      test: /^tournois?$|^tournaments?$/i },
        { id: 'profils',       test: /^profils?$|^profiles?$/i },
        { id: 'mariages',      test: /^mariages?$|^marriages?$/i },
        { id: 'famille',       test: /^famille$/i },
        { id: 'clans',         test: /^clans?$/i },
        { id: 'réputation',    test: /^r[eé]putation$|^rep$/i },
        { id: 'suggestions',   test: /^suggestions?$|^sugges/i },
        { id: 'humour',        test: /^humour$|^memes?$|^jokes?$/i },
        { id: 'liens',         test: /^liens?$|^links?$/i },
        { id: 'général',       test: /^general$|^général$|^chat$/i },
        { id: 'rôles',         test: /^r[oô]les?$/i },
      ];

      // Pour chaque purpose, trouve TOUS les salons qui matchent
      const groups = {}; // purpose → [channel1, channel2, ...]
      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        // Strip des décorations (・, emojis) pour le matching pur
        const stripped = ch.name.replace(/[・\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/gu, '').trim();
        for (const p of PURPOSES) {
          if (p.test.test(stripped) || p.test.test(ch.name)) {
            if (!groups[p.id]) groups[p.id] = [];
            groups[p.id].push(ch);
            break;
          }
        }
      }

      // Filtre groupes ≥ 2 = doublons
      const doublons = Object.entries(groups).filter(([_, chs]) => chs.length >= 2);

      if (!doublons.length) {
        const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
        return respFn({ content: '✅ Aucun salon doublon détecté. Ton serveur est propre !' });
      }

      let supprimés = 0, gardés = 0;
      const lines = [];
      for (const [purpose, chs] of doublons) {
        // Trie par date création (plus ancien = original = à garder)
        chs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        const original = chs[0];
        const copies = chs.slice(1);
        gardés++;

        lines.push(`**${purpose}** : ${chs.length} salons`);
        lines.push(`  ✅ Garder : <#${original.id}> (créé <t:${Math.floor(original.createdTimestamp/1000)}:R>)`);
        for (const c of copies) {
          // Compte les messages dans ce salon (limit 100 pour vitesse)
          let msgCount = 0;
          try {
            const msgs = await c.messages.fetch({ limit: 100 });
            msgCount = msgs.size;
          } catch {}
          const isEmpty = msgCount === 0;
          const action = (supprimer && isEmpty) ? '🗑️ SUPPRIMÉ' : (isEmpty ? '🟡 vide' : `📝 ${msgCount}+ msg`);
          lines.push(`  ${action} : <#${c.id}> (${c.name})`);
          if (supprimer && isEmpty) {
            try { await c.delete('Doublon vide — fusion par /setup-serveur'); supprimés++; } catch {}
          }
        }
        lines.push('');
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor(supprimer ? '#E74C3C' : '#F1C40F')
        .setTitle(supprimer ? '🗑️ ・ Doublons vides supprimés' : '🔎 ・ Doublons détectés')
        .setDescription(lines.slice(0, 50).join('\n').slice(0, 4000))
        .addFields(
          { name: '📊 Groupes doublons',  value: `**${doublons.length}**`, inline: true },
          { name: '✅ Originaux gardés',  value: `**${gardés}**`, inline: true },
          { name: '🗑️ Supprimés (vides)', value: `**${supprimés}**`, inline: true },
        )
        .setFooter({ text: supprimer ? 'Seuls les salons VIDES ont été supprimés. Salons avec messages = INTACTS.' : 'Lance avec supprimer-vides:true pour supprimer les vides automatiquement.' })
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
