// setup_serveur.js — Esthétique serveur avec ・
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const TEMPLATE = [
  { category: '┈ ・ INFORMATIONS ・ ┈', channels: [
    { name: '┆・règles', topic: 'Règles du serveur.' },
    { name: '┆・annonces', topic: 'Annonces officielles.' },
    { name: '┆・bienvenue', topic: 'Accueil des nouveaux membres.' },
    { name: '┆・rôles', topic: 'Choisissez vos rôles.' },
    { name: '┆・partenaires', topic: 'Serveurs partenaires (auto via /partenariat).' },
  ]},
  { category: '┈ ・ GÉNÉRAL ・ ┈', channels: [
    { name: '┆・général', topic: 'Discussion générale.' },
    { name: '┆・médias', topic: 'Images, GIFs et vidéos.' },
    { name: '┆・liens', topic: 'Liens utiles.' },
    { name: '┆・humour', topic: 'Mèmes et blagues.' },
    { name: '┆・suggestions', topic: '/suggestion — vos idées pour le serveur.' },
  ]},
  { category: '┈ ・ ÉCONOMIE ・ ┈', channels: [
    { name: '┆・économie', topic: '/work /crime /heist /daily — gagner des €.' },
    { name: '┆・banque', topic: '/banque solde /banque interets /pret' },
    { name: '┆・marché', topic: '/market voir /market vendre /meteo_marche' },
    { name: '┆・immobilier', topic: '/immobilier catalogue /immo marche' },
    { name: '┆・classement', topic: '/top € /top xp /badges top' },
  ]},
  { category: '┈ ・ CASINO ・ ┈', channels: [
    { name: '┆・slots', topic: '/slots /mega-slots' },
    { name: '┆・roulette', topic: '/roulette /roue-fortune' },
    { name: '┆・cartes', topic: '/blackjack /baccarat /videopoker /poker /war' },
    { name: '┆・dés', topic: '/des /sicbo /craps' },
    { name: '┆・mines', topic: '/mines /crash /plinko /coffre-magique' },
    { name: '┆・grattage', topic: '/grattage' },
  ]},
  { category: '┈ ・ JEUX FUN ・ ┈', channels: [
    { name: '┆・mystery-box', topic: '/mystery ouvrir — boîte mystère toutes les 6h !' },
    { name: '┆・spin', topic: '/spin tourner — roue gratuite quotidienne !' },
    { name: '┆・animaux', topic: '/pet adopter /pet voir — adoptez un animal !' },
    { name: '┆・mini-jeux', topic: '/quiz /pendu /morpion /devine /enigme' },
    { name: '┆・aventures', topic: '/donjon /chasse /mine /rpg /ferme' },
    { name: '┆・duels', topic: '/duel /trivia_duel — défier un membre.' },
  ]},
  { category: '┈ ・ ÉVÉNEMENTS ・ ┈', channels: [
    { name: '┆・badges', topic: '/badges voir /badges liste — collectionnez les badges.' },
    { name: '┆・quêtes', topic: '/quest voir /missions — quêtes communautaires.' },
    { name: '┆・tournois', topic: '/tournoi creer /tournoi rejoindre' },
    { name: '┆・loterie', topic: '/loto acheter /lotto — loterie hebdo.' },
    { name: '┆・battle-pass', topic: '/battlepass — récompenses progressives.' },
  ]},
  { category: '┈ ・ COMMUNAUTÉ ・ ┈', channels: [
    { name: '┆・profils', topic: '/profil — vos profils et statistiques.' },
    { name: '┆・mariages', topic: '/mariage — engagez-vous.' },
    { name: '┆・famille', topic: '/famille — créez votre famille.' },
    { name: '┆・clans', topic: '/clans — rejoignez ou créez un clan.' },
    { name: '┆・réputation', topic: '/rep — donnez de la rep aux membres.' },
  ]},
  { category: '┈ ・ ADMINISTRATION ・ ┈', channels: [
    { name: '┆・bot-logs', topic: 'Logs du bot.' },
    { name: '┆・modération', topic: 'Espace modérateurs.' },
    { name: '┆・config', topic: 'Configuration.' },
    { name: '・🎫・tickets', topic: 'Système de tickets support.' },
    { name: '┆・diagnostic', topic: '/diagnostic — santé du bot.' },
  ]},
];

const RENAME_MAP = [
  [/^g[eé]n[eé]ral$/i,'┆・général'],[/^announcements?$/i,'┆・annonces'],[/^annonces$/i,'┆・annonces'],
  [/^r[eè]gles?$/i,'┆・règles'],[/^rules?$/i,'┆・règles'],[/^bienvenue$/i,'┆・bienvenue'],
  [/^welcome$/i,'┆・bienvenue'],[/^m[eé]dias?$/i,'┆・médias'],[/^humour$/i,'┆・humour'],
  [/^memes?$/i,'┆・humour'],[/^liens?$/i,'┆・liens'],[/^links?$/i,'┆・liens'],
  [/^econom/i,'┆・économie'],[/^classement$/i,'┆・classement'],[/^leaderboard$/i,'┆・classement'],
  [/^banque?$/i,'┆・banque'],[/^bank$/i,'┆・banque'],[/^march[eé]?$/i,'┆・marché'],
  [/^jeux$/i,'・🎮・jeux'],[/^games?$/i,'・🎮・jeux'],[/^casino$/i,'┆・casino'],
  [/^tournois?$/i,'・⚔️・tournois'],[/^collectibles?$/i,'・🃏・collectibles'],
  [/^bot-?logs?$/i,'┆・bot-logs'],[/^mod(eration)?$/i,'┆・modération'],
  [/^r[oô]les?$/i,'┆・rôles'],[/^config$/i,'┆・config'],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-serveur')
    .setDescription("✨ Configure l'apparence du serveur avec ・")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('apercu').setDescription("👁️ Aperçu du modèle"))
    .addSubcommand(s => s.setName('renommer').setDescription("🏷️ Renomme les salons avec le style ・"))
    .addSubcommand(s => s.setName('creer').setDescription("✨ Crée les catégories et salons manquants"))
    .addSubcommand(s => s.setName('ajouter-nouveautes').setDescription("🆕 Ajoute seulement les nouvelles catégories (Casino, Jeux Fun, etc.)"))
    .addSubcommand(s => s.setName('nettoyer-roles').setDescription("🧹 Trouve les rôles en doublon (avec option suppression)")
      .addBooleanOption(o => o.setName('supprimer').setDescription('true = supprime, false = liste').setRequired(false)))
    .addSubcommand(s => s.setName('perfectionner').setDescription("✨ Applique permissions+topics sans écraser tes customs"))
    .addSubcommand(s => s.setName('tout-synchroniser').setDescription("🎨 Force la cohérence visuelle partout — aucune suppression"))
    .addSubcommand(s => s.setName('detecter-doublons-salons').setDescription("🔎 Détecte les salons doublons par fonction")
      .addBooleanOption(o => o.setName('supprimer-vides').setDescription('true = supprime les doublons vides').setRequired(false))
      .addBooleanOption(o => o.setName('force-tout-supprimer').setDescription('true = supprime TOUS les doublons (même avec messages)').setRequired(false)))
    .addSubcommand(s => s.setName('synchronisation-totale').setDescription("🔧 BÉTONNAGE : catégories + salons + permissions staff verrouillées"))
    .addSubcommand(s => s.setName('fusion-intelligente').setDescription("🧠 Fusionne catégories doublons : déplace salons + supprime vides"))
    .addSubcommand(s => s.setName('garder-nouvelles').setDescription("⭐ Garde les nouvelles catégories + déplace contenu existant dedans"))
    .addSubcommand(s => s.setName('tout-parfaire').setDescription("✨ TOUT EN UN : fusion + synchro + permissions + nettoyage (1 commande)"))
    .addSubcommand(s => s.setName('force-rename-salons').setDescription("🔥 FORCE le renommage de TOUS les salons au format ┆・nom (sans exception)"))
    .addSubcommand(s => s.setName('force-rename-categories').setDescription("🔥 FORCE le renommage de TOUTES les catégories au format ╭┈ EMOJI NOM"))
    .addSubcommand(s => s.setName('force-tout').setDescription("💎 FORCE renomme catégories + salons + topics + permissions (ULTIME)"))
    .addSubcommand(s => s.setName('audit-total-360').setDescription("🛡️ AUDIT 360° : rôles + perms + hiérarchie + Staff global + salons accessibles"))
    .addSubcommand(s => s.setName('audit-rapide').setDescription("⚡ AUDIT 360° v2 OPTIMISÉ : 30s — perms en parallèle + bulk overwrites"))
    .addSubcommand(s => s.setName('autoconfig').setDescription("🤖 AUTOCONFIG : détecte les bons salons et configure tout (welcome/logs/levels/etc)"))
    .addSubcommand(s => s.setName('nettoyer-doublons-v2').setDescription("🧹 V2 : Supprime TOUS les rôles doublons (3+ exemplaires) avec smart-merge"))
    .addSubcommand(s => s.setName('organiser-hierarchie').setDescription("📐 Réordonne hiérarchie : Bots → Owner → Admin → Mod → Staff → Membres"))
    .addSubcommand(s => s.setName('hierarchie-pro').setDescription("👑 V2 PRO : crée Administrateur si manquant + hiérarchie inspirée des plus gros serveurs"))
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
        { test: /règles?|rules?/i,        profile: 'readOnly',   topic: '📋 Règles du serveur — lis attentivement.',         rename: '┆・règles' },
        { test: /annonces?|announc/i,     profile: 'readOnly',   topic: '📣 Annonces officielles.',                           rename: '┆・annonces' },
        { test: /bienvenue|welcome/i,     profile: 'readOnly',   topic: '👋 Accueil des nouveaux membres.',                   rename: '┆・bienvenue' },
        { test: /partenaires?|partners?|partenariat/i, profile: 'readOnly', topic: '💎 Serveurs partenaires (auto via /partenariat).', rename: '┆・partenaires' },
        { test: /classement|leaderboard|top/i, profile: 'readOnly', topic: '🏆 Classement — /top € /top xp /badges top',     rename: '┆・classement' },
        { test: /battle.?pass/i,          profile: 'readOnly',   topic: '🏆 /battlepass — récompenses progressives.',         rename: '┆・battle-pass' },
        { test: /badges?/i,               profile: 'readOnly',   topic: '🏅 /badges voir /badges liste — collectionnez.',     rename: '┆・badges' },

        { test: /bot.?logs?|mod-?logs?/i, profile: 'staffOnly',  topic: '🔒 Logs du bot — staff uniquement.',                 rename: '┆・bot-logs' },
        { test: /moderation|modération/i, profile: 'staffOnly',  topic: '👮 Espace modérateurs.',                             rename: '┆・modération' },
        { test: /admin/i,                 profile: 'staffOnly',  topic: '🔒 Espace administrateurs.',                         rename: '┆・admin' },
        { test: /diagnostic/i,            profile: 'staffOnly',  topic: '🔍 /diagnostic — santé du bot.',                     rename: '┆・diagnostic' },
        { test: /^config|configuration|cfg/i, profile: 'staffOnly', topic: '⚙️ Configuration du bot.',                        rename: '┆・config' },
        { test: /tickets?-?logs?/i,       profile: 'staffOnly',  topic: '🎫 Logs tickets — staff.',                            rename: '┆・tickets-logs' },

        { test: /m[eé]dias?|images?|gifs?|photos?/i, profile: 'media', topic: '🖼 Images, GIFs et vidéos.',                  rename: '┆・médias' },

        { test: /^slots?$|mega.?slots?/i, profile: 'publicSlow', topic: '🎰 /slots /mega-slots — machines à sous.',           rename: '┆・slots' },
        { test: /roulette/i,              profile: 'publicSlow', topic: '🎡 /roulette — roulette classique.',                 rename: '┆・roulette' },
        { test: /roue.?fortune|roue/i,    profile: 'publicSlow', topic: '🎡 /roue-fortune — roue de la fortune.',             rename: '┆・roue-fortune' },
        { test: /cartes?|blackjack|baccarat|poker|videopoker|war/i, profile: 'publicSlow', topic: '🃏 /blackjack /baccarat /videopoker /poker /war', rename: '┆・cartes' },
        { test: /d[eé]s|sicbo|craps/i,    profile: 'publicSlow', topic: '🎲 /des /sicbo /craps',                              rename: '┆・dés' },
        { test: /mines|crash|plinko|coffre/i, profile: 'publicSlow', topic: '⛏️ /mines /crash /plinko /coffre-magique',      rename: '┆・mines' },
        { test: /grattage|scratch/i,      profile: 'publicSlow', topic: '🎫 /grattage — cartes à gratter.',                   rename: '┆・grattage' },
        { test: /^casino$/i,              profile: 'publicSlow', topic: '🎰 Salon casino — tous les jeux.',                   rename: '┆・casino' },
        { test: /mystery|mystère|mystere/i, profile: 'publicSlow', topic: '🎁 /mystery ouvrir — boîte mystère 6h.',           rename: '┆・mystery-box' },
        { test: /^spin$|spin.?roue/i,     profile: 'publicSlow', topic: '🎡 /spin tourner — roue gratuite quotidienne.',      rename: '┆・spin' },
        { test: /animaux|^pets?$|^pet$/i, profile: 'publicSlow', topic: '🐾 /pet adopter /pet voir /pet nourrir',             rename: '┆・animaux' },
        { test: /mini.?jeux|^games?$|^jeux$/i, profile: 'publicSlow', topic: '🎯 /quiz /pendu /morpion /devine /enigme',     rename: '┆・mini-jeux' },
        { test: /aventures?|donjon|chasse|^rpg$|ferme/i, profile: 'publicSlow', topic: '🗺️ /donjon /chasse /mine /rpg /ferme', rename: '┆・aventures' },
        { test: /duels?|trivia/i,         profile: 'publicSlow', topic: '⚔️ /duel /trivia_duel',                              rename: '┆・duels' },
        { test: /immobilier|^immo$|maison|propri[eé]t[eé]/i, profile: 'publicSlow', topic: '🏠 /immobilier catalogue /immo marche', rename: '┆・immobilier' },
        { test: /banque|^bank$/i,         profile: 'publicSlow', topic: '🏦 /banque solde /banque interets /pret',            rename: '┆・banque' },
        { test: /^march[eé]|^market$/i,   profile: 'publicSlow', topic: '📊 /market voir /market vendre /meteo_marche',      rename: '┆・marché' },
        { test: /[eé]conomie|economy/i,   profile: 'publicSlow', topic: '💰 /work /crime /heist /daily — gagner des €.',    rename: '┆・économie' },
        { test: /loto|lotto|loterie/i,    profile: 'publicSlow', topic: '🎟️ /loto acheter /lotto — loterie hebdo.',          rename: '┆・loterie' },
        { test: /quêtes?|quetes?|quests?/i, profile: 'publicSlow', topic: '🗺️ /quest voir /missions',                         rename: '┆・quêtes' },
        { test: /tournois?|tournaments?/i,profile: 'publicSlow', topic: '🎪 /tournoi creer /tournoi rejoindre',               rename: '┆・tournois' },
        { test: /profils?|profiles?/i,    profile: 'publicSlow', topic: '👤 /profil — vos profils et statistiques.',          rename: '┆・profils' },
        { test: /mariages?|marriages?/i,  profile: 'publicSlow', topic: '💕 /mariage — engagez-vous.',                        rename: '┆・mariages' },
        { test: /famille/i,               profile: 'publicSlow', topic: '👨‍👩‍👧 /famille — créez votre famille.',                 rename: '┆・famille' },
        { test: /clans?/i,                profile: 'publicSlow', topic: '🏰 /clans — rejoignez ou créez un clan.',            rename: '┆・clans' },
        { test: /r[eé]putation|^rep$/i,   profile: 'publicSlow', topic: '💖 /rep — donnez de la rep aux membres.',            rename: '┆・réputation' },
        { test: /suggestions?|sugges/i,   profile: 'publicSlow', topic: '💭 /suggestion — vos idées pour le serveur.',        rename: '┆・suggestions' },

        { test: /humour|memes?|jokes?/i,  profile: 'public',     topic: '😂 Mèmes et blagues.',                                rename: '┆・humour' },
        { test: /liens?|links?/i,         profile: 'public',     topic: '🔗 Liens utiles.',                                    rename: '┆・liens' },
        { test: /general|général|^chat$/i,profile: 'public',     topic: '💬 Discussion générale.',                             rename: '┆・général' },
        { test: /r[oô]les?/i,             profile: 'readOnly',   topic: '🎫 Choisissez vos rôles.',                           rename: '┆・rôles' },
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
      const forceTout = interaction.options.getBoolean('force-tout-supprimer') === true;

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
          const willDelete = forceTout || (supprimer && isEmpty);
          const action = willDelete ? '🗑️ SUPPRIMÉ' : (isEmpty ? '🟡 vide' : `📝 ${msgCount}+ msg`);
          lines.push(`  ${action} : <#${c.id}> (${c.name})`);
          if (willDelete) {
            try { await c.delete(forceTout ? 'Doublon — force suppression' : 'Doublon vide — fusion'); supprimés++; } catch {}
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

    // ─── 🔧 SYNCHRONISATION TOTALE BÉTONNÉE ─────────────────────
    if (sub === 'synchronisation-totale') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;

      // ── Détection de TOUS les rôles staff (admin, mod, owner, dev, staff) ──
      const STAFF_NAME_PATTERNS = /admin|mod[eé]rateur|moderator|propri[eé]taire|owner|d[eé]veloppeur|developer|staff|h[eé]bergeur|fondateur|founder|gestionnaire|manager/i;
      const allRolesArray = [...guild.roles.cache.values()];
      const adminRoles = allRolesArray.filter(r =>
        !r.managed && r.id !== guild.id && (
          r.permissions.has(PermissionFlagsBits.Administrator) ||
          STAFF_NAME_PATTERNS.test(r.name)
        )
      );
      const modRoles = allRolesArray.filter(r =>
        !r.managed && r.id !== guild.id && !adminRoles.includes(r) && (
          r.permissions.has(PermissionFlagsBits.ManageMessages) ||
          r.permissions.has(PermissionFlagsBits.KickMembers) ||
          r.permissions.has(PermissionFlagsBits.BanMembers) ||
          r.permissions.has(PermissionFlagsBits.ManageGuild)
        )
      );
      const botRoles = allRolesArray.filter(r => r.managed); // Rôles bots gardent toujours accès

      // ── Catégories : renomme avec style ┈ ・ X ・ ┈ ──
      const CAT_RENAMES = [
        { test: /information|info/i,                         to: '┈ ・ INFORMATIONS ・ ┈' },
        { test: /general|général|chat/i,                          to: '┈ ・ GÉNÉRAL ・ ┈' },
        { test: /[eé]conomie|economy/i,                      to: '┈ ・ ÉCONOMIE ・ ┈' },
        { test: /casino/i,                                   to: '┈ ・ CASINO ・ ┈' },
        { test: /jeux.?fun|fun.?jeux|amusement/i,            to: '┈ ・ JEUX FUN ・ ┈' },
        { test: /[eé]v[eé]nement|event/i,                    to: '┈ ・ ÉVÉNEMENTS ・ ┈' },
        { test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ/i,                  to: '┈ ・ COMMUNAUTÉ ・ ┈' },
        { test: /administration|admin|staff/i,               to: '┈ ・ ADMINISTRATION ・ ┈' },
        { test: /jeux|games/i,                               to: '┈ ・ JEUX ・ ┈' },
      ];
      let catsRenamed = 0;
      for (const [, cat] of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)) {
        if (cat.name.startsWith('┈ ・')) continue; // déjà au format
        for (const cr of CAT_RENAMES) {
          if (cr.test.test(cat.name)) {
            try { await cat.setName(cr.to); catsRenamed++; } catch {}
            break;
          }
        }
      }

      // ── Profils permissions ──
      const PROFILES = {
        readOnly:  { everyone: { ViewChannel: true,  SendMessages: false, AddReactions: true, ReadMessageHistory: true, AttachFiles: false, EmbedLinks: false } },
        staffOnly: { everyone: { ViewChannel: false, SendMessages: false, ReadMessageHistory: false } }, // BÉTONNÉ : @everyone NE VOIT PAS
        public:    { everyone: { ViewChannel: true,  SendMessages: true, AddReactions: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true } },
        publicSlow:{ everyone: { ViewChannel: true,  SendMessages: true, AddReactions: true, ReadMessageHistory: true }, slowmode: 5 },
        media:     { everyone: { ViewChannel: true,  SendMessages: true, AttachFiles: true, EmbedLinks: true, ReadMessageHistory: true } },
      };

      const RULES = [
        { test: /règles?|rules?/i,                    profile: 'readOnly',   topic: '📋 Règles du serveur — lis attentivement.', rename: '┆・règles' },
        { test: /annonces?|announc/i,                 profile: 'readOnly',   topic: '📣 Annonces officielles.', rename: '┆・annonces' },
        { test: /bienvenue|welcome/i,                 profile: 'readOnly',   topic: '👋 Accueil des nouveaux membres.', rename: '┆・bienvenue' },
        { test: /partenaires?|partners?|partenariat/i,profile: 'readOnly',   topic: '💎 Serveurs partenaires.', rename: '┆・partenaires' },
        { test: /classement|leaderboard|^top$/i,      profile: 'readOnly',   topic: '🏆 /top € /top xp', rename: '┆・classement' },
        { test: /battle.?pass/i,                      profile: 'readOnly',   topic: '🏆 /battlepass', rename: '┆・battle-pass' },
        { test: /^badges?$/i,                         profile: 'readOnly',   topic: '🏅 /badges voir', rename: '┆・badges' },
        // STAFF / ADMIN — VERROUILLÉS
        { test: /bot.?logs?|mod-?logs?/i,             profile: 'staffOnly',  topic: '🔒 Logs du bot — STAFF uniquement.', rename: '┆・bot-logs' },
        { test: /moderation|modération|mod-?chat/i,   profile: 'staffOnly',  topic: '👮 Espace modérateurs.', rename: '┆・modération' },
        { test: /^admin$|admin-?chat|staff-?admin/i,  profile: 'staffOnly',  topic: '🔒 Espace administrateurs.', rename: '┆・admin' },
        { test: /^staff$|^equipe$|^team$/i,           profile: 'staffOnly',  topic: '🔒 Espace équipe.', rename: '┆・staff' },
        { test: /^diagnostic$/i,                      profile: 'staffOnly',  topic: '🔍 /diagnostic — santé du bot.', rename: '┆・diagnostic' },
        { test: /^config|configuration|cfg$/i,        profile: 'staffOnly',  topic: '⚙️ Configuration du bot.', rename: '┆・config' },
        { test: /tickets?-?logs?|tickets?-?staff/i,   profile: 'staffOnly',  topic: '🎫 Logs tickets — staff.', rename: '┆・tickets-logs' },
        { test: /audit/i,                             profile: 'staffOnly',  topic: '📜 Audit log.', rename: '┆・audit' },
        { test: /developer|dev-?chat|d[eé]v$/i,       profile: 'staffOnly',  topic: '🔒 Espace développeurs.', rename: '┆・dev' },
        // MÉDIA
        { test: /m[eé]dias?|images?|gifs?|photos?/i,  profile: 'media',      topic: '🖼 Images, GIFs et vidéos.', rename: '┆・médias' },
        // JEUX (slowmode 5s)
        { test: /^slots?$|mega.?slots?/i,             profile: 'publicSlow', topic: '🎰 /slots /mega-slots', rename: '┆・slots' },
        { test: /roulette/i,                          profile: 'publicSlow', topic: '🎡 /roulette', rename: '┆・roulette' },
        { test: /roue.?fortune|^roue$/i,              profile: 'publicSlow', topic: '🎡 /roue-fortune', rename: '┆・roue-fortune' },
        { test: /cartes?|blackjack|baccarat|poker|videopoker|war/i, profile: 'publicSlow', topic: '🃏 /blackjack /baccarat /poker', rename: '┆・cartes' },
        { test: /^d[eé]s$|sicbo|craps/i,              profile: 'publicSlow', topic: '🎲 /des /sicbo /craps', rename: '┆・dés' },
        { test: /^mines$|crash|plinko|coffre/i,       profile: 'publicSlow', topic: '⛏️ /mines /crash /plinko', rename: '┆・mines' },
        { test: /grattage|scratch/i,                  profile: 'publicSlow', topic: '🎫 /grattage', rename: '┆・grattage' },
        { test: /^casino$/i,                          profile: 'publicSlow', topic: '🎰 Casino général.', rename: '┆・casino' },
        { test: /mystery|mystère/i,                   profile: 'publicSlow', topic: '🎁 /mystery ouvrir', rename: '┆・mystery-box' },
        { test: /^spin$|spin.?roue/i,                 profile: 'publicSlow', topic: '🎡 /spin tourner', rename: '┆・spin' },
        { test: /animaux|^pets?$|^pet$/i,             profile: 'publicSlow', topic: '🐾 /pet adopter /pet voir', rename: '┆・animaux' },
        { test: /mini.?jeux|^games?$|^jeux$/i,        profile: 'publicSlow', topic: '🎯 /quiz /pendu /morpion', rename: '┆・mini-jeux' },
        { test: /aventures?|donjon|chasse|^rpg$|ferme/i, profile: 'publicSlow', topic: '🗺️ /donjon /chasse /rpg', rename: '┆・aventures' },
        { test: /duels?|trivia/i,                     profile: 'publicSlow', topic: '⚔️ /duel /trivia_duel', rename: '┆・duels' },
        { test: /immobilier|^immo$|maison|propri[eé]t[eé]/i, profile: 'publicSlow', topic: '🏠 /immobilier catalogue', rename: '┆・immobilier' },
        { test: /banque|^bank$/i,                     profile: 'publicSlow', topic: '🏦 /banque', rename: '┆・banque' },
        { test: /^march[eé]$|^market$/i,              profile: 'publicSlow', topic: '📊 /market voir', rename: '┆・marché' },
        { test: /[eé]conomie|economy/i,               profile: 'publicSlow', topic: '💰 /work /crime /heist', rename: '┆・économie' },
        { test: /loto|lotto|loterie/i,                profile: 'publicSlow', topic: '🎟️ /loto /lotto', rename: '┆・loterie' },
        { test: /quêtes?|quetes?|quests?/i,           profile: 'publicSlow', topic: '🗺️ /quest /missions', rename: '┆・quêtes' },
        { test: /tournois?|tournaments?/i,            profile: 'publicSlow', topic: '🎪 /tournoi', rename: '┆・tournois' },
        { test: /profils?|profiles?/i,                profile: 'publicSlow', topic: '👤 /profil', rename: '┆・profils' },
        { test: /mariages?|marriages?/i,              profile: 'publicSlow', topic: '💕 /mariage', rename: '┆・mariages' },
        { test: /^famille$/i,                         profile: 'publicSlow', topic: '👨‍👩‍👧 /famille', rename: '┆・famille' },
        { test: /^clans?$/i,                          profile: 'publicSlow', topic: '🏰 /clans', rename: '┆・clans' },
        { test: /r[eé]putation|^rep$/i,               profile: 'publicSlow', topic: '💖 /rep', rename: '┆・réputation' },
        { test: /suggestions?|sugges/i,               profile: 'publicSlow', topic: '💭 /suggestion', rename: '┆・suggestions' },
        // PUBLIC NORMAL
        { test: /humour|memes?|jokes?/i,              profile: 'public',     topic: '😂 Mèmes et blagues.', rename: '┆・humour' },
        { test: /liens?|links?/i,                     profile: 'public',     topic: '🔗 Liens utiles.', rename: '┆・liens' },
        { test: /general|général|^chat$/i,            profile: 'public',     topic: '💬 Discussion générale.', rename: '┆・général' },
        { test: /r[oô]les?/i,                         profile: 'readOnly',   topic: '🎫 Choisissez vos rôles.', rename: '┆・rôles' },
      ];

      let renamed = 0, retopiced = 0, repermed = 0, slowmoded = 0, errors = 0, skipped = 0;

      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        let matched = null;
        for (const r of RULES) {
          if (r.test.test(ch.name)) { matched = r; break; }
        }
        if (!matched) { skipped++; continue; }

        const profile = PROFILES[matched.profile];

        try {
          // 1) Renomme
          if (matched.rename && ch.name !== matched.rename) {
            await ch.setName(matched.rename).catch(() => {});
            renamed++;
          }
          // 2) Topic
          if (matched.topic && ch.topic !== matched.topic) {
            await ch.setTopic(matched.topic).catch(() => {});
            retopiced++;
          }
          // 3) Permissions @everyone
          if (profile.everyone) {
            const overwrite = {};
            for (const [perm, val] of Object.entries(profile.everyone)) overwrite[perm] = val;
            await ch.permissionOverwrites.edit(everyone.id, overwrite).catch(() => {});
            repermed++;
          }
          // 4) Permissions staff (BÉTONNÉ)
          if (matched.profile === 'staffOnly') {
            // Tous les rôles staff voient et postent
            for (const ar of adminRoles) {
              await ch.permissionOverwrites.edit(ar.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true,
              }).catch(() => {});
            }
            for (const mr of modRoles) {
              await ch.permissionOverwrites.edit(mr.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true,
              }).catch(() => {});
            }
            // Bots gardent accès aussi (sinon le bot ne peut plus poster)
            for (const br of botRoles) {
              await ch.permissionOverwrites.edit(br.id, {
                ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
              }).catch(() => {});
            }
          }
          if (matched.profile === 'readOnly') {
            for (const ar of adminRoles) {
              await ch.permissionOverwrites.edit(ar.id, {
                SendMessages: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true,
              }).catch(() => {});
            }
            for (const mr of modRoles) {
              await ch.permissionOverwrites.edit(mr.id, {
                SendMessages: true, ManageMessages: true,
              }).catch(() => {});
            }
          }
          // 5) Slowmode
          if (profile.slowmode && ch.rateLimitPerUser !== profile.slowmode) {
            await ch.setRateLimitPerUser(profile.slowmode).catch(() => {});
            slowmoded++;
          } else if (!profile.slowmode && matched.profile !== 'staffOnly' && ch.rateLimitPerUser !== 0) {
            await ch.setRateLimitPerUser(0).catch(() => {});
          }
        } catch (e) {
          errors++;
          console.error('[setup-serveur] sync-totale err:', ch.name, e.message);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('🔧 ・ Synchronisation totale ・')
        .setDescription([
          '**Tout le serveur a été uniformisé** (anciens + nouveaux), permissions BÉTONNÉES.',
          '',
          `🔍 **${adminRoles.length}** rôle(s) staff/admin détecté(s) : *${adminRoles.slice(0, 5).map(r => r.name).join(', ')}${adminRoles.length > 5 ? '...' : ''}*`,
          `🛡️ **${modRoles.length}** rôle(s) modération détecté(s)`,
          `🤖 **${botRoles.length}** rôle(s) bot conservé(s)`,
          '',
          '✅ Catégories renommées au style `┈ ・ X ・ ┈`',
          '✅ Salons renommés au style `・emoji・nom`',
          '✅ Topics descriptifs synchronisés partout',
          '✅ Salons staff INVISIBLES pour @everyone',
          '✅ Slowmode 5s sur jeux/casino',
        ].join('\n'))
        .addFields(
          { name: '🗂️ Catégories renommées', value: `**${catsRenamed}**`, inline: true },
          { name: '🏷️ Salons renommés',       value: `**${renamed}**`, inline: true },
          { name: '📝 Topics',                 value: `**${retopiced}**`, inline: true },
          { name: '🔒 Permissions',            value: `**${repermed}**`, inline: true },
          { name: '⏱️ Slowmode',               value: `**${slowmoded}**`, inline: true },
          { name: '⏭️ Non concernés',          value: `**${skipped}**`, inline: true },
        )
        .setFooter({ text: 'Aucun salon, message, ou membre supprimé. Permissions staff verrouillées.' })
        .setTimestamp()] });
    }

    // ─── 🧠 FUSION INTELLIGENTE des catégories doublons ─────────
    if (sub === 'fusion-intelligente') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      // Patterns par "fonction" — toutes les variantes possibles
      const CAT_PURPOSES = [
        { id: 'INFORMATIONS',   to: '┈ ・ INFORMATIONS ・ ┈',   test: /information|info|accueil|important/i },
        { id: 'GÉNÉRAL',        to: '┈ ・ GÉNÉRAL ・ ┈',         test: /general|général|chat/i },
        { id: 'ÉCONOMIE',       to: '┈ ・ ÉCONOMIE ・ ┈',        test: /[eé]conomie|economy/i },
        { id: 'CASINO',         to: '┈ ・ CASINO ・ ┈',           test: /casino/i },
        { id: 'JEUX FUN',       to: '┈ ・ JEUX FUN ・ ┈',         test: /jeux.?fun|fun.?jeux|amusement|fun$/i },
        { id: 'JEUX',           to: '┈ ・ JEUX ・ ┈',             test: /^[┈・\s]*jeux[┈・\s]*$|^games$/i },
        { id: 'ÉVÉNEMENTS',     to: '┈ ・ ÉVÉNEMENTS ・ ┈',       test: /[eé]v[eé]nements?|events?/i },
        { id: 'COMMUNAUTÉ',     to: '┈ ・ COMMUNAUTÉ ・ ┈',       test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ/i },
        { id: 'ADMINISTRATION', to: '┈ ・ ADMINISTRATION ・ ┈',   test: /administration|admin|staff/i },
      ];

      // Group catégories existantes par fonction
      const groups = {}; // purpose.id → [cat1, cat2, ...]
      for (const [, cat] of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)) {
        // Strip decorations pour matching
        const stripped = cat.name.replace(/[┈・\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/gu, '').trim();
        for (const p of CAT_PURPOSES) {
          if (p.test.test(stripped) || p.test.test(cat.name)) {
            if (!groups[p.id]) groups[p.id] = [];
            groups[p.id].push({ cat, purpose: p });
            break;
          }
        }
      }

      let moved = 0, deleted = 0, renamed = 0, errors = 0;
      const report = [];

      for (const [purposeId, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        const target = items[0].purpose.to;

        if (items.length === 1) {
          // Une seule catégorie → juste renommer si nécessaire
          const cat = items[0].cat;
          if (cat.name !== target) {
            try { await cat.setName(target); renamed++; report.push(`📝 ${cat.name} → ${target}`); } catch (e) { errors++; }
          }
          continue;
        }

        // Plusieurs catégories → FUSION
        // Trie par date création asc (plus ancienne = à garder)
        items.sort((a, b) => a.cat.createdTimestamp - b.cat.createdTimestamp);
        const keep = items[0].cat;       // l'originale (plus ancienne)
        const merge = items.slice(1).map(i => i.cat);

        report.push(`\n🧠 **${purposeId}** : fusion de ${items.length} catégories`);
        report.push(`  ✅ Garder : **${keep.name}** (créée <t:${Math.floor(keep.createdTimestamp/1000)}:R>)`);

        // Renomme la kept
        if (keep.name !== target) {
          try { await keep.setName(target); renamed++; } catch (e) { errors++; }
        }

        // Pour chaque catégorie à fusionner
        for (const dup of merge) {
          // Trouve les salons enfants de cette catégorie
          const children = guild.channels.cache.filter(c => c.parentId === dup.id);
          report.push(`  🔄 Fusionner : **${dup.name}** (${children.size} salon(s))`);

          // Déplace chaque salon vers la kept
          for (const [, child] of children) {
            try {
              await child.setParent(keep.id, { lockPermissions: false });
              moved++;
              report.push(`    ↪ <#${child.id}> déplacé`);
            } catch (e) {
              errors++;
              console.error('[fusion] move err:', child.name, e.message);
            }
          }

          // Supprime la catégorie vide
          try {
            await dup.delete('Fusion catégories doublons — /setup-serveur fusion-intelligente');
            deleted++;
            report.push(`    🗑️ Catégorie supprimée`);
          } catch (e) {
            errors++;
            console.error('[fusion] delete err:', dup.name, e.message);
          }
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder().setColor('#9B59B6').setTitle('🧠 ・ Fusion intelligente terminée ・')
        .setDescription([
          '**Catégories doublons fusionnées intelligemment :**',
          '✅ La catégorie originale (la + ancienne) est gardée',
          '✅ Tous les salons des doublons sont déplacés dedans',
          '✅ Les catégories vides sont supprimées',
          '✅ AUCUN salon ni message perdu',
          '',
          report.slice(0, 30).join('\n'),
        ].join('\n').slice(0, 4000))
        .addFields(
          { name: '📦 Salons déplacés', value: `**${moved}**`, inline: true },
          { name: '🗑️ Catégories supprimées', value: `**${deleted}**`, inline: true },
          { name: '🏷️ Renommées', value: `**${renamed}**`, inline: true },
          { name: '❌ Erreurs', value: `**${errors}**`, inline: true },
        )
        .setFooter({ text: 'Maintenant lance /setup-serveur synchronisation-totale pour finaliser le visuel.' })
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ─── ⭐ GARDER LES NOUVELLES CATÉGORIES (style ┈・X・┈) ─────
    if (sub === 'garder-nouvelles') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      // Patterns par fonction → nom NEW (qu'on veut garder)
      const CAT_TARGETS = [
        { id: 'INFORMATIONS',   to: '┈ ・ INFORMATIONS ・ ┈',   test: /information|info|accueil|important/i },
        { id: 'GÉNÉRAL',        to: '┈ ・ GÉNÉRAL ・ ┈',         test: /general|général|chat/i },
        { id: 'ÉCONOMIE',       to: '┈ ・ ÉCONOMIE ・ ┈',        test: /[eé]conomie|economy/i },
        { id: 'CASINO',         to: '┈ ・ CASINO ・ ┈',           test: /casino/i },
        { id: 'JEUX FUN',       to: '┈ ・ JEUX FUN ・ ┈',         test: /jeux.?fun|fun.?jeux|amusement|^fun$|gaming/i },
        { id: 'JEUX',           to: '┈ ・ JEUX ・ ┈',             test: /(^|\s)jeux(\s|$)|^games$/i },
        { id: 'ÉVÉNEMENTS',     to: '┈ ・ ÉVÉNEMENTS ・ ┈',       test: /[eé]v[eé]nements?|events?/i },
        { id: 'COMMUNAUTÉ',     to: '┈ ・ COMMUNAUTÉ ・ ┈',       test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ/i },
        { id: 'ADMINISTRATION', to: '┈ ・ ADMINISTRATION ・ ┈',   test: /administration|admin|staff/i },
      ];

      // Collecte toutes les catégories par purpose
      const groups = {}; // purposeId → [cats]
      for (const [, cat] of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)) {
        const stripped = cat.name.replace(/[┈・\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/gu, '').trim();
        for (const p of CAT_TARGETS) {
          if (p.test.test(stripped) || p.test.test(cat.name)) {
            if (!groups[p.id]) groups[p.id] = [];
            groups[p.id].push({ cat, target: p.to });
            break;
          }
        }
      }

      let moved = 0, deletedCats = 0, renamed = 0, kept = 0, errors = 0;
      const report = [];

      for (const [purposeId, items] of Object.entries(groups)) {
        if (items.length === 0) continue;
        const target = items[0].target;

        // Trouve la catégorie qui a DÉJÀ le bon nom (┈ ・ X ・ ┈) — c'est CELLE-LÀ qu'on garde
        let keep = items.find(i => i.cat.name === target)?.cat;

        if (!keep) {
          // Aucune au bon format — on prend la plus récente (probablement ma nouvelle) et on la renomme
          items.sort((a, b) => b.cat.createdTimestamp - a.cat.createdTimestamp); // desc = plus récente d'abord
          keep = items[0].cat;
          if (keep.name !== target) {
            try { await keep.setName(target); renamed++; } catch (e) { errors++; }
          }
        }

        kept++;
        report.push(`\n⭐ **${purposeId}** : garder \`${target}\` (id: ${keep.id})`);

        if (items.length === 1) {
          report.push(`  ℹ️ Pas de doublon, juste renommage si nécessaire`);
          continue;
        }

        // Pour chaque AUTRE catégorie de ce groupe (= les anciennes), on déplace les salons et on supprime
        const others = items.filter(i => i.cat.id !== keep.id).map(i => i.cat);
        for (const old of others) {
          const children = guild.channels.cache.filter(c => c.parentId === old.id);
          report.push(`  🔄 Vider et supprimer : **${old.name}** (${children.size} salon(s))`);

          for (const [, child] of children) {
            try {
              await child.setParent(keep.id, { lockPermissions: false });
              moved++;
              report.push(`    ↪ \`${child.name}\` déplacé`);
            } catch (e) { errors++; }
          }

          // Recompte après déplacement
          const remaining = guild.channels.cache.filter(c => c.parentId === old.id).size;
          if (remaining === 0) {
            try {
              await old.delete('Doublon de catégorie — fusion vers nouvelle');
              deletedCats++;
              report.push(`    🗑️ Catégorie supprimée`);
            } catch (e) { errors++; }
          }
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder().setColor('#9B59B6').setTitle('⭐ ・ Nouvelles catégories conservées ・')
        .setDescription([
          '**Stratégie : on garde les nouvelles catégories au format `┈ ・ X ・ ┈` et on déplace tout le contenu dedans.**',
          '',
          '✅ Catégories `┈ ・ X ・ ┈` GARDÉES',
          '✅ Salons des anciennes catégories DÉPLACÉS dedans',
          '✅ Anciennes catégories vides SUPPRIMÉES',
          '✅ Aucun message ni membre perdu',
          '',
          report.slice(0, 30).join('\n'),
        ].join('\n').slice(0, 4000))
        .addFields(
          { name: '⭐ Catégories gardées', value: `**${kept}**`, inline: true },
          { name: '📦 Salons déplacés', value: `**${moved}**`, inline: true },
          { name: '🗑️ Anciennes supprimées', value: `**${deletedCats}**`, inline: true },
          { name: '🏷️ Renommées', value: `**${renamed}**`, inline: true },
          { name: '❌ Erreurs', value: `**${errors}**`, inline: true },
        )
        .setFooter({ text: 'Lance maintenant /setup-serveur synchronisation-totale pour finaliser visuel + perms.' })
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ─── ✨ TOUT EN UN : la commande maître ───────────────────────
    if (sub === 'tout-parfaire') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;

      const STAFF_NAME_PATTERNS = /admin|mod[eé]rateur|moderator|propri[eé]taire|owner|d[eé]veloppeur|developer|staff|h[eé]bergeur|fondateur|founder|gestionnaire|manager/i;
      const allRolesArr = [...guild.roles.cache.values()];
      const adminRoles = allRolesArr.filter(r => !r.managed && r.id !== guild.id && (r.permissions.has(PermissionFlagsBits.Administrator) || STAFF_NAME_PATTERNS.test(r.name)));
      const modRoles   = allRolesArr.filter(r => !r.managed && r.id !== guild.id && !adminRoles.includes(r) && (
        r.permissions.has(PermissionFlagsBits.ManageMessages) || r.permissions.has(PermissionFlagsBits.KickMembers) || r.permissions.has(PermissionFlagsBits.BanMembers) || r.permissions.has(PermissionFlagsBits.ManageGuild)
      ));
      const botRoles = allRolesArr.filter(r => r.managed);

      // === ÉTAPE 1 : FUSION CATÉGORIES (garde nouvelles, déplace contenu) ===
      // 🎨 STYLE PRO DEMANDÉ : ╭┈ EMOJI NAME
      const CAT_TARGETS = [
        { id: 'INFORMATIONS',   to: '╭┈ 📜 INFORMATIONS',   test: /information|info|accueil|important/i },
        { id: 'GÉNÉRAL',        to: '╭┈ 💬 GÉNÉRAL',        test: /general|général|chat/i },
        { id: 'ÉCONOMIE',       to: '╭┈ 💰 ÉCONOMIE',       test: /[eé]conomie|economy/i },
        { id: 'CASINO',         to: '╭┈ 🎰 CASINO',          test: /casino/i },
        { id: 'JEUX FUN',       to: '╭┈ 🎮 JEUX FUN',        test: /jeux.?fun|fun.?jeux|amusement|^fun$|gaming/i },
        { id: 'JEUX',           to: '╭┈ 🎯 JEUX',            test: /(^|\s)jeux(\s|$)|^games$/i },
        { id: 'ÉVÉNEMENTS',     to: '╭┈ 🎪 ÉVÉNEMENTS',      test: /[eé]v[eé]nements?|events?/i },
        { id: 'COMMUNAUTÉ',     to: '╭┈ 👥 COMMUNAUTÉ',      test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ/i },
        { id: 'ADMINISTRATION', to: '╭┈ 🛡️ ADMINISTRATION', test: /administration|^admin$|^staff$/i },
        { id: 'ANNONCES',       to: '╭┈ 📣 ANNONCES',         test: /annonces?|announc/i },
        { id: 'VOCAUX',         to: '╭┈ 🔊 VOCAUX',           test: /vocaux|voice/i },
      ];

      const catGroups = {};
      for (const [, cat] of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)) {
        const stripped = cat.name.replace(/[┈・\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/gu, '').trim();
        for (const p of CAT_TARGETS) {
          if (p.test.test(stripped) || p.test.test(cat.name)) {
            if (!catGroups[p.id]) catGroups[p.id] = [];
            catGroups[p.id].push({ cat, target: p.to });
            break;
          }
        }
      }

      let movedChans = 0, deletedCats = 0, renamedCats = 0;
      for (const [, items] of Object.entries(catGroups)) {
        if (!items.length) continue;
        const target = items[0].target;
        let keep = items.find(i => i.cat.name === target)?.cat;
        if (!keep) {
          items.sort((a, b) => b.cat.createdTimestamp - a.cat.createdTimestamp);
          keep = items[0].cat;
          if (keep.name !== target) { try { await keep.setName(target); renamedCats++; } catch {} }
        }
        for (const i of items) {
          if (i.cat.id === keep.id) continue;
          const children = guild.channels.cache.filter(c => c.parentId === i.cat.id);
          for (const [, ch] of children) { try { await ch.setParent(keep.id, { lockPermissions: false }); movedChans++; } catch {} }
          try { await i.cat.delete('Doublon - tout-parfaire'); deletedCats++; } catch {}
        }
      }

      // === ÉTAPE 2 : SYNCHRONISATION SALONS (renommage + topic + perms) ===
      const PROFILES = {
        readOnly:  { everyone: { ViewChannel: true,  SendMessages: false, AddReactions: true, ReadMessageHistory: true } },
        staffOnly: { everyone: { ViewChannel: false, SendMessages: false, ReadMessageHistory: false } },
        public:    { everyone: { ViewChannel: true,  SendMessages: true, AddReactions: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true } },
        publicSlow:{ everyone: { ViewChannel: true,  SendMessages: true, AddReactions: true, ReadMessageHistory: true }, slowmode: 5 },
        media:     { everyone: { ViewChannel: true,  SendMessages: true, AttachFiles: true, EmbedLinks: true, ReadMessageHistory: true } },
      };
      const RULES = [
        { test: /règles?|rules?/i, profile: 'readOnly', topic: '📋 Règles du serveur.', rename: '┆・règles' },
        { test: /annonces?|announc/i, profile: 'readOnly', topic: '📣 Annonces officielles.', rename: '┆・annonces' },
        { test: /bienvenue|welcome/i, profile: 'readOnly', topic: '👋 Accueil des nouveaux.', rename: '┆・bienvenue' },
        { test: /partenaires?|partners?|partenariat/i, profile: 'readOnly', topic: '💎 Serveurs partenaires.', rename: '┆・partenaires' },
        { test: /classement|leaderboard|^top$/i, profile: 'readOnly', topic: '🏆 /top € /top xp', rename: '┆・classement' },
        { test: /battle.?pass/i, profile: 'readOnly', topic: '🏆 /battlepass', rename: '┆・battle-pass' },
        { test: /^badges?$/i, profile: 'readOnly', topic: '🏅 /badges voir', rename: '┆・badges' },
        { test: /bot.?logs?|mod-?logs?/i, profile: 'staffOnly', topic: '🔒 STAFF.', rename: '┆・bot-logs' },
        { test: /moderation|modération|mod-?chat/i, profile: 'staffOnly', topic: '👮 Modérateurs.', rename: '┆・modération' },
        { test: /^admin$|admin-?chat|staff-?admin/i, profile: 'staffOnly', topic: '🔒 Administrateurs.', rename: '┆・admin' },
        { test: /^staff$|^equipe$|^team$/i, profile: 'staffOnly', topic: '🔒 Équipe.', rename: '┆・staff' },
        { test: /^diagnostic$/i, profile: 'staffOnly', topic: '🔍 /diagnostic.', rename: '┆・diagnostic' },
        { test: /^config|configuration|cfg$/i, profile: 'staffOnly', topic: '⚙️ Config.', rename: '┆・config' },
        { test: /tickets?-?logs?|tickets?-?staff/i, profile: 'staffOnly', topic: '🎫 Logs tickets.', rename: '┆・tickets-logs' },
        { test: /audit/i, profile: 'staffOnly', topic: '📜 Audit.', rename: '┆・audit' },
        { test: /developer|dev-?chat|^d[eé]v$/i, profile: 'staffOnly', topic: '💻 Dev.', rename: '┆・dev' },
        { test: /m[eé]dias?|images?|gifs?|photos?/i, profile: 'media', topic: '🖼 Images & vidéos.', rename: '┆・médias' },
        { test: /^slots?$|mega.?slots?/i, profile: 'publicSlow', topic: '🎰 /slots /mega-slots', rename: '┆・slots' },
        { test: /roulette/i, profile: 'publicSlow', topic: '🎡 /roulette', rename: '┆・roulette' },
        { test: /roue.?fortune|^roue$/i, profile: 'publicSlow', topic: '🎡 /roue-fortune', rename: '┆・roue-fortune' },
        { test: /cartes?|blackjack|baccarat|poker|videopoker|war/i, profile: 'publicSlow', topic: '🃏 Cartes.', rename: '┆・cartes' },
        { test: /^d[eé]s$|sicbo|craps/i, profile: 'publicSlow', topic: '🎲 /des /sicbo /craps', rename: '┆・dés' },
        { test: /^mines$|crash|plinko|coffre/i, profile: 'publicSlow', topic: '⛏️ /mines /crash /plinko', rename: '┆・mines' },
        { test: /grattage|scratch/i, profile: 'publicSlow', topic: '🎫 /grattage', rename: '┆・grattage' },
        { test: /^casino$/i, profile: 'publicSlow', topic: '🎰 Casino.', rename: '┆・casino' },
        { test: /mystery|mystère/i, profile: 'publicSlow', topic: '🎁 /mystery ouvrir', rename: '┆・mystery-box' },
        { test: /^spin$|spin.?roue/i, profile: 'publicSlow', topic: '🎡 /spin tourner', rename: '┆・spin' },
        { test: /animaux|^pets?$|^pet$/i, profile: 'publicSlow', topic: '🐾 /pet adopter', rename: '┆・animaux' },
        { test: /mini.?jeux|^games?$|^jeux$/i, profile: 'publicSlow', topic: '🎯 /quiz /pendu', rename: '┆・mini-jeux' },
        { test: /aventures?|donjon|chasse|^rpg$|ferme/i, profile: 'publicSlow', topic: '🗺️ /donjon /rpg', rename: '┆・aventures' },
        { test: /duels?|trivia/i, profile: 'publicSlow', topic: '⚔️ /duel', rename: '┆・duels' },
        { test: /immobilier|^immo$|maison|propri[eé]t[eé]/i, profile: 'publicSlow', topic: '🏠 /immobilier', rename: '┆・immobilier' },
        { test: /banque|^bank$/i, profile: 'publicSlow', topic: '🏦 /banque', rename: '┆・banque' },
        { test: /^march[eé]$|^market$/i, profile: 'publicSlow', topic: '📊 /market', rename: '┆・marché' },
        { test: /[eé]conomie|economy/i, profile: 'publicSlow', topic: '💰 /work /crime', rename: '┆・économie' },
        { test: /loto|lotto|loterie/i, profile: 'publicSlow', topic: '🎟️ /loto /lotto', rename: '┆・loterie' },
        { test: /quêtes?|quetes?|quests?/i, profile: 'publicSlow', topic: '🗺️ /quest /missions', rename: '┆・quêtes' },
        { test: /tournois?|tournaments?/i, profile: 'publicSlow', topic: '🎪 /tournoi', rename: '┆・tournois' },
        { test: /profils?|profiles?/i, profile: 'publicSlow', topic: '👤 /profil', rename: '┆・profils' },
        { test: /mariages?|marriages?/i, profile: 'publicSlow', topic: '💕 /mariage', rename: '┆・mariages' },
        { test: /^famille$/i, profile: 'publicSlow', topic: '👨‍👩‍👧 /famille', rename: '┆・famille' },
        { test: /^clans?$/i, profile: 'publicSlow', topic: '🏰 /clans', rename: '┆・clans' },
        { test: /r[eé]putation|^rep$/i, profile: 'publicSlow', topic: '💖 /rep', rename: '┆・réputation' },
        { test: /suggestions?|sugges/i, profile: 'publicSlow', topic: '💭 /suggestion', rename: '┆・suggestions' },
        { test: /humour|memes?|jokes?/i, profile: 'public', topic: '😂 Mèmes.', rename: '┆・humour' },
        { test: /liens?|links?/i, profile: 'public', topic: '🔗 Liens.', rename: '┆・liens' },
        { test: /general|général|^chat$/i, profile: 'public', topic: '💬 Général.', rename: '┆・général' },
        { test: /r[oô]les?/i, profile: 'readOnly', topic: '🎫 Choisis tes rôles.', rename: '┆・rôles' },
      ];

      let renamedChans = 0, retopiced = 0, repermed = 0;
      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        let matched = null;
        for (const r of RULES) { if (r.test.test(ch.name)) { matched = r; break; } }
        if (!matched) continue;
        const profile = PROFILES[matched.profile];
        try {
          if (matched.rename && ch.name !== matched.rename) { await ch.setName(matched.rename).catch(() => {}); renamedChans++; }
          if (matched.topic && ch.topic !== matched.topic) { await ch.setTopic(matched.topic).catch(() => {}); retopiced++; }
          if (profile.everyone) {
            const ow = {}; for (const [p, v] of Object.entries(profile.everyone)) ow[p] = v;
            await ch.permissionOverwrites.edit(everyone.id, ow).catch(() => {});
            repermed++;
          }
          if (matched.profile === 'staffOnly') {
            for (const ar of adminRoles) await ch.permissionOverwrites.edit(ar.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
            for (const mr of modRoles) await ch.permissionOverwrites.edit(mr.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true }).catch(() => {});
            for (const br of botRoles) await ch.permissionOverwrites.edit(br.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
          }
          if (matched.profile === 'readOnly') {
            for (const ar of adminRoles) await ch.permissionOverwrites.edit(ar.id, { SendMessages: true, ManageMessages: true, AttachFiles: true, EmbedLinks: true }).catch(() => {});
            for (const mr of modRoles) await ch.permissionOverwrites.edit(mr.id, { SendMessages: true, ManageMessages: true }).catch(() => {});
          }
          if (profile.slowmode && ch.rateLimitPerUser !== profile.slowmode) await ch.setRateLimitPerUser(profile.slowmode).catch(() => {});
          else if (!profile.slowmode && matched.profile !== 'staffOnly' && ch.rateLimitPerUser !== 0) await ch.setRateLimitPerUser(0).catch(() => {});
        } catch {}
      }

      // === ÉTAPE 3 : SUPPRIMER SALONS DOUBLONS VIDES ===
      const PURPOSES = RULES.map(r => r.test);
      const chanGroups = {};
      for (const [, ch] of guild.channels.cache.filter(c => c.type === ChannelType.GuildText)) {
        for (let i = 0; i < PURPOSES.length; i++) {
          if (PURPOSES[i].test(ch.name) || PURPOSES[i].test(ch.name.replace(/[・\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]+/gu, '').trim())) {
            if (!chanGroups[i]) chanGroups[i] = [];
            chanGroups[i].push(ch);
            break;
          }
        }
      }
      let deletedChans = 0;
      for (const [, chs] of Object.entries(chanGroups)) {
        if (chs.length < 2) continue;
        chs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (let i = 1; i < chs.length; i++) {
          try {
            const msgs = await chs[i].messages.fetch({ limit: 5 });
            if (msgs.size === 0) { await chs[i].delete('Doublon vide - tout-parfaire'); deletedChans++; }
          } catch {}
        }
      }

      // === ÉTAPE 4 : NETTOYER RÔLES DOUBLONS ===
      const byName = new Map();
      for (const [, r] of guild.roles.cache) {
        if (r.managed || r.id === guild.id) continue;
        const k = r.name.trim().toLowerCase();
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(r);
      }
      let deletedRoles = 0;
      for (const [, roles] of byName) {
        if (roles.length < 2) continue;
        roles.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        for (let i = 1; i < roles.length; i++) {
          try {
            for (const [, m] of roles[i].members) await m.roles.add(roles[0]).catch(() => {});
            await roles[i].delete('Doublon rôle - tout-parfaire').catch(() => {});
            deletedRoles++;
          } catch {}
        }
      }

      // === RAPPORT FINAL ===
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('✨ ・ TOUT PARFAIT ・ ✨')
        .setDescription([
          '**Serveur entièrement transformé en 1 commande :**',
          '',
          `🔍 **${adminRoles.length}** rôle(s) admin/staff détecté(s) : *${adminRoles.slice(0, 4).map(r => r.name).join(', ')}*`,
          `🛡️ **${modRoles.length}** rôle(s) modération détecté(s)`,
          `🤖 **${botRoles.length}** rôle(s) bot conservé(s)`,
          '',
          '✅ Catégories doublons FUSIONNÉES (contenu déplacé vers nouvelles `┈ ・ X ・ ┈`)',
          '✅ Tous les salons RENOMMÉS au format `・emoji・nom`',
          '✅ Topics descriptifs uniformes',
          '✅ Permissions @everyone synchronisées',
          '✅ Salons staff INVISIBLES sauf admin/mod/owner/dev/bots',
          '✅ Salons doublons VIDES supprimés',
          '✅ Rôles doublons supprimés (membres réattribués)',
          '✅ Slowmode 5s sur jeux/casino',
        ].join('\n'))
        .addFields(
          { name: '🗂️ Cat. fusionnées', value: `**${deletedCats}** anciennes → nouvelles`, inline: true },
          { name: '📦 Salons déplacés', value: `**${movedChans}**`, inline: true },
          { name: '🏷️ Cat. renommées', value: `**${renamedCats}**`, inline: true },
          { name: '🏷️ Salons renommés', value: `**${renamedChans}**`, inline: true },
          { name: '📝 Topics', value: `**${retopiced}**`, inline: true },
          { name: '🔒 Permissions', value: `**${repermed}**`, inline: true },
          { name: '🗑️ Salons vides suppr.', value: `**${deletedChans}**`, inline: true },
          { name: '🗑️ Rôles doublons', value: `**${deletedRoles}**`, inline: true },
        )
        .setFooter({ text: 'Aucun salon utilisé, ni message, ni membre perdu. Vérifie ton serveur !' })
        .setTimestamp()] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔥 FORCE RENAME : applique le format ┆・ à TOUS les salons
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'force-rename-salons') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      // Helper : nettoie un nom (enlève emojis, ┆, ・, ╭, ┈, espaces multiples)
      const cleanName = (raw) => {
        let n = (raw || '')
          .replace(/[┆・╭╰┈]+/g, ' ')
          .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E6}-\u{1F1FF}]+/gu, ' ')
          .replace(/\s+/g, '-')
          .replace(/[-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .toLowerCase()
          .trim();
        if (!n) n = 'salon';
        // Discord limite à 100 chars, mais on garde court (90 pour préfixe)
        if (n.length > 90) n = n.slice(0, 90);
        return n;
      };

      const errors = [];
      let renamed = 0, skipped = 0, failed = 0, total = 0;

      // Récupérer TOUS les salons texte ET vocaux (sauf catégories)
      const channels = [...guild.channels.cache.values()].filter(c =>
        c.type === ChannelType.GuildText ||
        c.type === ChannelType.GuildVoice ||
        c.type === ChannelType.GuildAnnouncement ||
        c.type === ChannelType.GuildForum ||
        c.type === ChannelType.GuildStageVoice
      );
      total = channels.length;

      // Tri pour traiter dans l'ordre stable
      channels.sort((a, b) => (a.position || 0) - (b.position || 0));

      for (const ch of channels) {
        try {
          const cur = ch.name || '';
          // Si déjà au bon format ┆・, on saute
          if (cur.startsWith('┆・')) { skipped++; continue; }

          const cleaned = cleanName(cur);
          let newName;
          // Salons vocaux : pas de tiret au début (juste ┆・Nom avec majuscule)
          if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
            const pretty = cleaned.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            newName = `┆・${pretty}`;
          } else {
            newName = `┆・${cleaned}`;
          }

          // Vérifier la longueur Discord (max 100)
          if (newName.length > 100) newName = newName.slice(0, 100);

          await ch.setName(newName, 'force-rename-salons par Maxime');
          renamed++;

          // Anti rate-limit : Discord = 2 renames / 10min par salon
          // On met 800ms entre chaque pour être safe sur le batch global
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          failed++;
          if (errors.length < 10) errors.push(`#${ch.name} → ${e.message}`);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder()
        .setColor(failed === 0 ? '#2ECC71' : '#E67E22')
        .setTitle('🔥 ・ FORCE RENAME SALONS ・ Rapport')
        .setDescription([
          `**Total salons analysés :** ${total}`,
          `✅ **Renommés :** ${renamed}`,
          `⏭️ **Déjà OK :** ${skipped}`,
          `❌ **Échecs :** ${failed}`,
          '',
          renamed > 0 ? '🎨 Tous les salons sont maintenant au format `┆・nom`' : '',
          errors.length ? '\n**Erreurs :**\n' + errors.map(e => `• ${e}`).join('\n').slice(0, 1500) : '',
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Si Discord rate-limit certains salons, relance la commande dans 10min' })
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🔥 FORCE RENAME CATÉGORIES : ╭┈ EMOJI NOM
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'force-rename-categories') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const CAT_TARGETS = [
        { to: '╭┈ 📜 INFORMATIONS',   test: /information|info|accueil|important|r[èe]gles|annonce/i },
        { to: '╭┈ 💬 GÉNÉRAL',         test: /general|général|chat|discussion/i },
        { to: '╭┈ 💰 ÉCONOMIE',        test: /[eé]conomie|economy|argent|money/i },
        { to: '╭┈ 🎰 CASINO',          test: /casino/i },
        { to: '╭┈ 🎮 JEUX FUN',        test: /jeux.?fun|fun.?jeux|amusement|^fun$|gaming|fun/i },
        { to: '╭┈ 🎯 JEUX',            test: /(^|\s)jeux(\s|$)|^games$|mini.?jeux/i },
        { to: '╭┈ 🎪 ÉVÉNEMENTS',      test: /[eé]v[eé]nements?|events?|tournoi|loto/i },
        { to: '╭┈ 👥 COMMUNAUTÉ',      test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ|membres?/i },
        { to: '╭┈ 🛡️ ADMINISTRATION', test: /administration|^admin$|^staff$|mod[eé]ration|gestion/i },
        { to: '╭┈ 📣 ANNONCES',        test: /annonces?|announc/i },
        { to: '╭┈ 🔊 VOCAUX',          test: /vocaux|voice|salon.?vocal|voix/i },
        { to: '╭┈ 🎫 SUPPORT',         test: /support|tickets?|aide/i },
        { to: '╭┈ 🤖 BOT',             test: /^bot$|^bots$|nexus/i },
      ];

      let renamed = 0, skipped = 0, failed = 0, total = 0, kept = 0;
      const errors = [];

      const cats = [...guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).values()];
      total = cats.length;

      for (const cat of cats) {
        try {
          const stripped = cat.name.replace(/[┈・╭╰┆]+/g, ' ').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]+/gu, ' ').trim();
          let target = null;
          for (const p of CAT_TARGETS) {
            if (p.test.test(stripped) || p.test.test(cat.name)) { target = p.to; break; }
          }
          if (!target) {
            // Fallback : prend le nom existant nettoyé en majuscules avec format ╭┈
            const fallback = stripped.toUpperCase().slice(0, 80);
            if (fallback) target = `╭┈ ${fallback}`;
            else { kept++; continue; }
          }
          if (cat.name === target) { skipped++; continue; }
          await cat.setName(target, 'force-rename-categories par Maxime');
          renamed++;
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          failed++;
          if (errors.length < 10) errors.push(`${cat.name} → ${e.message}`);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder()
        .setColor(failed === 0 ? '#2ECC71' : '#E67E22')
        .setTitle('🔥 ・ FORCE RENAME CATÉGORIES ・ Rapport')
        .setDescription([
          `**Total catégories :** ${total}`,
          `✅ **Renommées :** ${renamed}`,
          `⏭️ **Déjà OK :** ${skipped}`,
          `🔒 **Conservées :** ${kept}`,
          `❌ **Échecs :** ${failed}`,
          errors.length ? '\n**Erreurs :**\n' + errors.map(e => `• ${e}`).join('\n').slice(0, 1500) : '',
        ].filter(Boolean).join('\n'))
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 💎 FORCE TOUT : catégories + salons en 1 commande
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'force-tout') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      // Étape 1 : Catégories
      const CAT_TARGETS = [
        { to: '╭┈ 📜 INFORMATIONS',   test: /information|info|accueil|important|r[èe]gles/i },
        { to: '╭┈ 💬 GÉNÉRAL',         test: /general|général|chat|discussion/i },
        { to: '╭┈ 💰 ÉCONOMIE',        test: /[eé]conomie|economy|argent|money/i },
        { to: '╭┈ 🎰 CASINO',          test: /casino/i },
        { to: '╭┈ 🎮 JEUX FUN',        test: /jeux.?fun|fun.?jeux|amusement|^fun$|gaming/i },
        { to: '╭┈ 🎯 JEUX',            test: /(^|\s)jeux(\s|$)|^games$|mini.?jeux/i },
        { to: '╭┈ 🎪 ÉVÉNEMENTS',      test: /[eé]v[eé]nements?|events?|tournoi|loto/i },
        { to: '╭┈ 👥 COMMUNAUTÉ',      test: /communaut[eé]|community|entraide|cr[eé]ativit[eé]|creativ|membres?/i },
        { to: '╭┈ 🛡️ ADMINISTRATION', test: /administration|^admin$|^staff$|mod[eé]ration|gestion/i },
        { to: '╭┈ 📣 ANNONCES',        test: /annonces?|announc/i },
        { to: '╭┈ 🔊 VOCAUX',          test: /vocaux|voice|salon.?vocal|voix/i },
        { to: '╭┈ 🎫 SUPPORT',         test: /support|tickets?|aide/i },
        { to: '╭┈ 🤖 BOT',             test: /^bot$|^bots$|nexus/i },
      ];

      let catRenamed = 0, catFailed = 0, chRenamed = 0, chFailed = 0, chSkipped = 0;
      const errors = [];

      // CAT
      for (const cat of [...guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).values()]) {
        try {
          const stripped = cat.name.replace(/[┈・╭╰┆]+/g, ' ').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}]+/gu, ' ').trim();
          let target = null;
          for (const p of CAT_TARGETS) {
            if (p.test.test(stripped) || p.test.test(cat.name)) { target = p.to; break; }
          }
          if (!target) {
            const fallback = stripped.toUpperCase().slice(0, 80);
            if (fallback) target = `╭┈ ${fallback}`;
            else continue;
          }
          if (cat.name === target) continue;
          await cat.setName(target, 'force-tout par Maxime');
          catRenamed++;
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          catFailed++;
          if (errors.length < 5) errors.push(`Cat ${cat.name} → ${e.message}`);
        }
      }

      // SALONS
      const cleanName = (raw) => {
        let n = (raw || '')
          .replace(/[┆・╭╰┈]+/g, ' ')
          .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1F1E6}-\u{1F1FF}]+/gu, ' ')
          .replace(/\s+/g, '-').replace(/[-]+/g, '-').replace(/^-+|-+$/g, '')
          .toLowerCase().trim();
        if (!n) n = 'salon';
        if (n.length > 90) n = n.slice(0, 90);
        return n;
      };

      const chans = [...guild.channels.cache.values()].filter(c =>
        c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice ||
        c.type === ChannelType.GuildAnnouncement || c.type === ChannelType.GuildForum ||
        c.type === ChannelType.GuildStageVoice
      );

      for (const ch of chans) {
        try {
          if ((ch.name || '').startsWith('┆・')) { chSkipped++; continue; }
          const cleaned = cleanName(ch.name);
          let newName;
          if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
            const pretty = cleaned.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            newName = `┆・${pretty}`;
          } else {
            newName = `┆・${cleaned}`;
          }
          if (newName.length > 100) newName = newName.slice(0, 100);
          await ch.setName(newName, 'force-tout par Maxime');
          chRenamed++;
          await new Promise(r => setTimeout(r, 800));
        } catch (e) {
          chFailed++;
          if (errors.length < 10) errors.push(`#${ch.name} → ${e.message}`);
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder()
        .setColor((catFailed + chFailed) === 0 ? '#9B59B6' : '#E67E22')
        .setTitle('💎 ・ FORCE TOUT ・ Serveur ULTIME ・')
        .setDescription([
          '**Catégories + Salons forcés au format pro :**',
          `╭┈ EMOJI NOM (catégories) • ┆・nom (salons)`,
          '',
          `🗂️ **Catégories renommées :** ${catRenamed} (échecs : ${catFailed})`,
          `📝 **Salons renommés :** ${chRenamed} (déjà OK : ${chSkipped}, échecs : ${chFailed})`,
          errors.length ? '\n**Erreurs :**\n' + errors.map(e => `• ${e}`).join('\n').slice(0, 1200) : '',
        ].filter(Boolean).join('\n'))
        .setFooter({ text: 'Si rate-limit Discord, relance dans 10min — les renames non faits seront repris.' })
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🛡️ AUDIT TOTAL 360° : rôles, perms, hiérarchie, Staff global, salons
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'audit-total-360') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;
      const me = guild.members.me;
      const myTopRolePos = me?.roles?.highest?.position || 0;
      const reportLines = [];
      const errors = [];

      // ─── 1. Détection des rôles ───────────────────────────────────
      const allRoles = [...guild.roles.cache.values()].filter(r => !r.managed && r.id !== guild.id);
      const STAFF_NAME = /admin|mod[eé]rateur|moderator|propri[eé]taire|owner|d[eé]veloppeur|developer|staff|h[eé]bergeur|fondateur|founder|gestionnaire|manager/i;
      const ADMIN_NAME = /admin|propri[eé]taire|owner|fondateur|founder|h[eé]bergeur|d[eé]veloppeur|developer/i;
      const MOD_NAME   = /mod[eé]rateur|moderator|gestionnaire|manager|staff/i;

      const adminRoles = allRoles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator) || ADMIN_NAME.test(r.name));
      const modRoles   = allRoles.filter(r => !adminRoles.includes(r) && (
        MOD_NAME.test(r.name) || r.permissions.has(PermissionFlagsBits.ManageMessages) || r.permissions.has(PermissionFlagsBits.KickMembers) || r.permissions.has(PermissionFlagsBits.BanMembers)
      ));
      const botRoles = [...guild.roles.cache.values()].filter(r => r.managed);

      reportLines.push(`🔍 **${adminRoles.length}** rôle(s) admin/owner • **${modRoles.length}** rôle(s) modération • **${botRoles.length}** rôle(s) bot`);

      // ─── 2. Création/repérage du rôle "Staff" global ───────────────
      let staffGlobal = guild.roles.cache.find(r => /^(@?staff|@?équipe|@?team)$/i.test(r.name) && !r.managed);
      let createdStaff = false;
      if (!staffGlobal) {
        try {
          staffGlobal = await guild.roles.create({
            name: 'Staff',
            color: '#3498DB',
            mentionable: true,
            hoist: true,
            permissions: [],
            reason: 'audit-total-360 — rôle global de mention staff',
          });
          createdStaff = true;
          reportLines.push(`✅ Rôle **@Staff** créé (mentionnable, bleu, hoisted)`);
        } catch (e) { errors.push(`Création @Staff : ${e.message}`); }
      } else {
        // Le rendre mentionnable s'il ne l'est pas
        try {
          if (!staffGlobal.mentionable) await staffGlobal.setMentionable(true, 'audit-total-360');
          reportLines.push(`✅ Rôle **@${staffGlobal.name}** existant — mentionnable activé`);
        } catch (e) { errors.push(`@Staff mentionnable : ${e.message}`); }
      }

      // Assigner @Staff à tous les membres avec un rôle admin/mod
      let staffAssigned = 0;
      if (staffGlobal && staffGlobal.position < myTopRolePos) {
        const members = await guild.members.fetch().catch(() => null);
        if (members) {
          for (const [, m] of members) {
            const isStaff = m.roles.cache.some(r => adminRoles.includes(r) || modRoles.includes(r));
            if (isStaff && !m.roles.cache.has(staffGlobal.id)) {
              try { await m.roles.add(staffGlobal, 'audit-total-360 - assignation staff global'); staffAssigned++; } catch {}
            }
          }
        }
      }
      if (staffAssigned) reportLines.push(`👥 **${staffAssigned}** membre(s) staff reçoivent @Staff`);

      // ─── 3. Configuration permissions admin/staff (tout sauf ban/kick) ──
      // Permissions safe (tout sauf Administrator + KickMembers + BanMembers)
      const ADMIN_SAFE_PERMS = [
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.ManageEmojisAndStickers,
        PermissionFlagsBits.ManageEvents,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.UseExternalStickers,
        PermissionFlagsBits.MentionEveryone,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.PrioritySpeaker,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.ModerateMembers, // timeout — peut timeout mais pas ban/kick
      ];
      const STAFF_PERMS = [
        PermissionFlagsBits.ManageRoles,       // staff peut gérer les rôles
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.UseExternalStickers,
        PermissionFlagsBits.MentionEveryone,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.Stream,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.ModerateMembers, // timeout
      ];

      // Configurer chaque rôle admin (tout sauf ban/kick)
      let permsAdminFixed = 0, permsModFixed = 0;
      for (const ar of adminRoles) {
        if (ar.position >= myTopRolePos) continue; // bot trop bas dans la hiérarchie
        // Si le rôle a Administrator, on le LAISSE (c'est l'owner). Sinon on set les perms safe.
        if (ar.permissions.has(PermissionFlagsBits.Administrator)) {
          // Skip - propriétaire/owner garde Admin (ne pas casser)
          continue;
        }
        try {
          await ar.setPermissions(ADMIN_SAFE_PERMS, 'audit-total-360 — admin sans ban/kick');
          permsAdminFixed++;
        } catch (e) { errors.push(`Perms admin ${ar.name} : ${e.message}`); }
      }

      // Configurer chaque rôle staff/mod (peut gérer rôles, mais pas ban/kick)
      for (const mr of modRoles) {
        if (mr.position >= myTopRolePos) continue;
        try {
          await mr.setPermissions(STAFF_PERMS, 'audit-total-360 — staff peut gérer rôles, sans ban/kick');
          permsModFixed++;
        } catch (e) { errors.push(`Perms mod ${mr.name} : ${e.message}`); }
      }

      // Le rôle Staff global lui-même : permissions de mod (peut mentionner @Staff partout)
      if (staffGlobal && staffGlobal.position < myTopRolePos) {
        try {
          await staffGlobal.setPermissions(STAFF_PERMS, 'audit-total-360 — Staff global = perms staff');
        } catch (e) { errors.push(`Perms @Staff : ${e.message}`); }
      }

      reportLines.push(`🔧 **${permsAdminFixed}** rôle(s) admin reconfiguré(s) (tout sauf ban/kick)`);
      reportLines.push(`🔧 **${permsModFixed}** rôle(s) staff reconfiguré(s) (peut gérer rôles)`);

      // ─── 4. Permissions @everyone propres ─────────────────────────
      // @everyone = perms de base saines, pas de spam, pas de mention everyone
      const EVERYONE_BASE = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
        PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ChangeNickname,
        PermissionFlagsBits.Stream,
      ];
      try {
        await everyone.setPermissions(EVERYONE_BASE, 'audit-total-360 — @everyone permissions saines');
        reportLines.push('✅ **@everyone** : permissions de base appliquées (sans MentionEveryone, sans Manage)');
      } catch (e) { errors.push(`@everyone : ${e.message}`); }

      // ─── 5. Hiérarchie : on n'inverse pas, mais on s'assure que Staff < Admin < Owner ──
      // (On ne peut pas remonter au-dessus de notre top role)
      let hierarchyFixed = 0;
      try {
        if (staffGlobal && staffGlobal.position < myTopRolePos) {
          // Staff doit être au-dessus de @everyone, en dessous des admins
          const minAdminPos = adminRoles.length ? Math.min(...adminRoles.map(r => r.position)) : myTopRolePos;
          const targetPos = Math.max(1, Math.min(staffGlobal.position, minAdminPos - 1));
          if (targetPos !== staffGlobal.position && targetPos < myTopRolePos) {
            try { await staffGlobal.setPosition(targetPos, { reason: 'audit-total-360 hiérarchie' }); hierarchyFixed++; } catch {}
          }
        }
      } catch {}
      if (hierarchyFixed) reportLines.push(`📐 Hiérarchie ajustée (${hierarchyFixed})`);

      // ─── 6. Audit salons : aucun salon inaccessible sans raison ────
      let chanFixed = 0, chanInaccessible = 0;
      const PUBLIC_CATS_RX = /information|général|economie|économie|casino|jeux|fun|événements|evenements|communaut|annonce|vocaux/i;
      const STAFF_CATS_RX  = /admin|staff|moderation|modération|support|tickets/i;

      for (const [, ch] of guild.channels.cache) {
        if (ch.type === ChannelType.GuildCategory) continue;
        try {
          const parent = ch.parent;
          const parentName = parent?.name || '';
          const isStaffChannel = STAFF_CATS_RX.test(parentName) || /admin|staff|mod|bot.?logs?|diagnostic|config|dev|audit/i.test(ch.name);
          const isPublicChannel = PUBLIC_CATS_RX.test(parentName);

          // Garantir : @Staff voit TOUT (sauf si rien à voir)
          if (staffGlobal) {
            await ch.permissionOverwrites.edit(staffGlobal.id, {
              ViewChannel: true, ReadMessageHistory: true, SendMessages: true,
              ManageMessages: true, ManageThreads: true, AttachFiles: true, EmbedLinks: true,
            }, { reason: 'audit-total-360 — Staff voit tout' }).catch(() => {});
          }
          // Admins voient TOUT
          for (const ar of adminRoles) {
            if (ar.position >= myTopRolePos) continue;
            await ch.permissionOverwrites.edit(ar.id, {
              ViewChannel: true, ReadMessageHistory: true, SendMessages: true,
              ManageMessages: true, ManageThreads: true, AttachFiles: true, EmbedLinks: true,
            }, { reason: 'audit-total-360 — Admin voit tout' }).catch(() => {});
          }
          // Bots gardent accès
          for (const br of botRoles) {
            await ch.permissionOverwrites.edit(br.id, {
              ViewChannel: true, ReadMessageHistory: true, SendMessages: true,
            }, { reason: 'audit-total-360 — Bots conservés' }).catch(() => {});
          }
          // Si salon est public mais @everyone ne peut pas le voir → corriger
          if (isPublicChannel && !isStaffChannel) {
            const owEv = ch.permissionOverwrites.cache.get(everyone.id);
            if (owEv && owEv.deny.has(PermissionFlagsBits.ViewChannel)) {
              await ch.permissionOverwrites.edit(everyone.id, { ViewChannel: true }, { reason: 'audit-total-360 — public débloqué' }).catch(() => {});
              chanFixed++;
            }
          }
          // Si salon staff : @everyone bloqué
          if (isStaffChannel) {
            await ch.permissionOverwrites.edit(everyone.id, {
              ViewChannel: false, SendMessages: false, ReadMessageHistory: false,
            }, { reason: 'audit-total-360 — staff only' }).catch(() => {});
            chanInaccessible++;
          }
        } catch (e) {
          if (errors.length < 15) errors.push(`#${ch.name} : ${e.message}`);
        }
      }
      reportLines.push(`📺 **${chanFixed}** salons publics débloqués`);
      reportLines.push(`🔒 **${chanInaccessible}** salons staff verrouillés correctement`);

      // ─── 7. Vérifier la présence des systèmes essentiels ──────────
      const hasTickets = guild.channels.cache.some(c => /tickets?/i.test(c.name));
      const hasBotLogs = guild.channels.cache.some(c => /bot.?logs?/i.test(c.name));
      const hasModLogs = guild.channels.cache.some(c => /mod.?logs?|modération/i.test(c.name));
      const hasAudit   = guild.channels.cache.some(c => /audit/i.test(c.name));
      const hasWelcome = guild.channels.cache.some(c => /bienvenue|welcome/i.test(c.name));
      const hasRules   = guild.channels.cache.some(c => /r[èe]gles?|rules?/i.test(c.name));

      reportLines.push('');
      reportLines.push('**Systèmes détectés :**');
      reportLines.push(`${hasTickets ? '✅' : '❌'} Tickets ${hasBotLogs ? '✅' : '❌'} Bot-logs ${hasModLogs ? '✅' : '❌'} Mod-logs`);
      reportLines.push(`${hasAudit ? '✅' : '❌'} Audit ${hasWelcome ? '✅' : '❌'} Bienvenue ${hasRules ? '✅' : '❌'} Règles`);

      // ─── 8. Rapport final ─────────────────────────────────────────
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const embed = new EmbedBuilder()
        .setColor(errors.length === 0 ? '#2ECC71' : '#E67E22')
        .setTitle('🛡️ ・ AUDIT TOTAL 360° ・ Rapport ・')
        .setDescription([
          '**Configuration pro appliquée automatiquement :**',
          '',
          ...reportLines,
          '',
          '**Règles appliquées :**',
          '• Admin = TOUT sauf ban/kick (Owner garde Admin)',
          '• Staff = peut gérer rôles, messages, threads, timeout',
          '• @Staff mentionnable, hoisted, bleu',
          '• @everyone = perms de base saines (sans Manage, sans MentionEveryone)',
          '• Salons publics débloqués si @everyone bloqué par erreur',
          '• Salons staff invisibles à @everyone',
          '• Tous les salons : @Staff + Admins voient TOUT',
          createdStaff ? '🆕 Rôle @Staff créé.' : '',
          errors.length ? `\n**Erreurs (${errors.length}) :**\n` + errors.slice(0, 10).map(e => `• ${e}`).join('\n').slice(0, 1500) : '',
        ].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: 'Si certains rôles n\'ont pas été mis à jour, c\'est qu\'ils sont au-dessus du bot dans la hiérarchie. Remonte le bot pour les inclure.' })
        .setTimestamp();
      return respFn({ embeds: [embed] });
    }

    // ═══════════════════════════════════════════════════════════════
    // ⚡ AUDIT 360° v2 OPTIMISÉ : utilise Promise.all + permissionOverwrites.set
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'audit-rapide') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const everyone = guild.roles.everyone;
      const me = guild.members.me;
      const myTopRolePos = me?.roles?.highest?.position || 0;
      const errors = [];

      const allRoles = [...guild.roles.cache.values()].filter(r => !r.managed && r.id !== guild.id);
      const ADMIN_NAME = /admin|propri[eé]taire|owner|fondateur|founder|h[eé]bergeur|d[eé]veloppeur|developer/i;
      const MOD_NAME = /mod[eé]rateur|moderator|gestionnaire|manager|^staff$/i;
      const adminRoles = allRoles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator) || ADMIN_NAME.test(r.name));
      const modRoles = allRoles.filter(r => !adminRoles.includes(r) && (MOD_NAME.test(r.name) || r.permissions.has(PermissionFlagsBits.ManageMessages)));
      const botRoles = [...guild.roles.cache.values()].filter(r => r.managed);

      // 1. Trouver/créer @Staff
      let staffGlobal = guild.roles.cache.find(r => /^staff$/i.test(r.name) && !r.managed);
      let createdStaff = false;
      if (!staffGlobal) {
        try {
          staffGlobal = await guild.roles.create({
            name: 'Staff', color: '#3498DB', mentionable: true, hoist: true, permissions: [],
            reason: 'audit-rapide',
          });
          createdStaff = true;
        } catch (e) { errors.push(`@Staff: ${e.message}`); }
      } else if (!staffGlobal.mentionable) {
        try { await staffGlobal.setMentionable(true); } catch {}
      }

      // 2. Construire la liste d'overwrites pré-calculée pour CHAQUE channel
      const ALLOW_ALL_STAFF = [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.AttachFiles, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AddReactions,
        PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers,
      ];
      const ALLOW_BOT = [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles,
      ];

      const STAFF_CHAN_RX = /admin|staff|^mod|bot.?logs?|diagnostic|^config$|^dev$|audit/i;
      const STAFF_CAT_RX = /admin|staff|moderation|modération|support/i;

      // Pré-calcul : pour chaque channel, on construit le tableau d'overwrites COMPLET
      const channels = [...guild.channels.cache.values()].filter(c => c.type !== ChannelType.GuildCategory);

      // 3. Configuration parallèle des perms — par lots de 5 pour respecter les rate limits
      let chFixed = 0, chFailed = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (ch) => {
          try {
            const isStaffChan = STAFF_CHAN_RX.test(ch.name) || STAFF_CAT_RX.test(ch.parent?.name || '');

            // On garde les overwrites existants des USERS (pas des roles), on remplace les role overwrites
            const existingUserOws = ch.permissionOverwrites.cache
              .filter(o => o.type === 1) // type 1 = member
              .map(o => ({ id: o.id, type: 1, allow: o.allow.bitfield, deny: o.deny.bitfield }));

            const overwrites = [...existingUserOws];

            // @everyone
            if (isStaffChan) {
              overwrites.push({ id: everyone.id, deny: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory,
              ]});
            }
            // @Staff voit TOUT
            if (staffGlobal && staffGlobal.position < myTopRolePos) {
              overwrites.push({ id: staffGlobal.id, allow: ALLOW_ALL_STAFF });
            }
            // Admin roles voient TOUT
            for (const ar of adminRoles) {
              if (ar.position >= myTopRolePos) continue;
              overwrites.push({ id: ar.id, allow: ALLOW_ALL_STAFF });
            }
            // Mod roles voient TOUT
            for (const mr of modRoles) {
              if (mr.position >= myTopRolePos) continue;
              overwrites.push({ id: mr.id, allow: ALLOW_ALL_STAFF });
            }
            // Bots
            for (const br of botRoles) {
              overwrites.push({ id: br.id, allow: ALLOW_BOT });
            }

            await ch.permissionOverwrites.set(overwrites, 'audit-rapide');
            chFixed++;
          } catch (e) {
            chFailed++;
            if (errors.length < 8) errors.push(`#${ch.name}: ${e.message.slice(0, 60)}`);
          }
        }));
      }

      // 4. Permissions @everyone (rôle global)
      const EVERYONE_BASE = [
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.UseVAD,
        PermissionFlagsBits.UseApplicationCommands, PermissionFlagsBits.ChangeNickname, PermissionFlagsBits.Stream,
      ];
      try { await everyone.setPermissions(EVERYONE_BASE, 'audit-rapide'); } catch (e) { errors.push(`@everyone: ${e.message}`); }

      // 5. Permissions des rôles admin/staff (si pas Administrator)
      const ADMIN_PERMS = [
        PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads, PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.ManageEmojisAndStickers, PermissionFlagsBits.ManageEvents, PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles, PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseExternalEmojis,
        PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream,
        PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.UseApplicationCommands, PermissionFlagsBits.ChangeNickname,
      ];
      const STAFF_PERMS = [
        PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ManageNicknames, PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.MentionEveryone, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.UseApplicationCommands,
        PermissionFlagsBits.ChangeNickname,
      ];
      let rolesFixed = 0;
      await Promise.all([
        ...adminRoles.filter(r => r.position < myTopRolePos && !r.permissions.has(PermissionFlagsBits.Administrator))
          .map(r => r.setPermissions(ADMIN_PERMS, 'audit-rapide').then(() => rolesFixed++).catch(() => {})),
        ...modRoles.filter(r => r.position < myTopRolePos)
          .map(r => r.setPermissions(STAFF_PERMS, 'audit-rapide').then(() => rolesFixed++).catch(() => {})),
        staffGlobal && staffGlobal.position < myTopRolePos ? staffGlobal.setPermissions(STAFF_PERMS, 'audit-rapide').then(() => rolesFixed++).catch(() => {}) : Promise.resolve(),
      ]);

      // 6. Rapport final
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder()
        .setColor(errors.length === 0 ? '#2ECC71' : '#E67E22')
        .setTitle('⚡ ・ AUDIT RAPIDE 360° ・ Résultat')
        .setDescription([
          '**Configuration pro appliquée en parallèle :**',
          '',
          createdStaff ? '🆕 Rôle **@Staff** créé (mentionnable, bleu, hoisted)' : `✅ Rôle **@${staffGlobal?.name || 'Staff'}** existant configuré`,
          `🔍 Détectés : **${adminRoles.length}** admin/owner • **${modRoles.length}** mod • **${botRoles.length}** bot`,
          `🔧 **${rolesFixed}** rôle(s) reconfiguré(s) (admin/staff sans ban/kick)`,
          `📺 **${chFixed}/${channels.length}** salons reconfigurés (perms bulk)`,
          chFailed ? `❌ **${chFailed}** salons en erreur` : '',
          `✅ **@everyone** : perms de base saines (sans Manage, sans MentionEveryone)`,
          '',
          '**Règles appliquées partout :**',
          '• Admin/Staff voient TOUT, peuvent tout faire SAUF ban/kick',
          '• Staff peut gérer les rôles (sans casser hiérarchie)',
          '• Salons staff invisibles à @everyone',
          '• Bots gardent leurs accès',
          errors.length ? '\n**Erreurs :**\n' + errors.map(e => `• ${e}`).join('\n') : '',
        ].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: 'Audit en parallèle • Si rôle plus haut que bot, monter NexusBot dans la hiérarchie.' })
        .setTimestamp()] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🤖 AUTOCONFIG : détecte les bons salons et configure tout
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'autoconfig') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const db = require('../../database/db');

      // Helper : trouve un salon par regex sur le nom
      const findChan = (regex) => {
        return [...guild.channels.cache.values()].find(c =>
          c.type === ChannelType.GuildText && regex.test(c.name)
        );
      };

      const detected = {};
      const skipped = [];
      const set = (key, regex) => {
        const ch = findChan(regex);
        if (ch) {
          try {
            db.setConfig(guild.id, key, ch.id);
            detected[key] = `<#${ch.id}>`;
          } catch (e) {
            skipped.push(`${key}: ${e.message}`);
          }
        } else {
          skipped.push(`${key}: aucun salon correspondant trouvé`);
        }
      };

      // 1. Welcome → #bienvenue
      set('welcome_channel', /bienvenue|welcome|arriv[eé]/i);
      // 2. Leave → même salon (départs)
      set('leave_channel', /bienvenue|welcome|arriv[eé]|d[eé]part/i);
      // 3. Mod log → #bot-logs ou #modération
      set('mod_log_channel', /bot.?logs?|mod.?logs?|mod[eé]ration|audit/i);
      // 4. Log général → idem
      set('log_channel', /bot.?logs?|logs?|audit/i);
      // 5. Level-up → #niveaux
      set('level_channel', /niveaux|levels?|level.?up/i);
      // 6. Quest channel → #quêtes
      set('quest_channel', /qu[eê]tes?|quests?|missions/i);
      // 7. Boost channel → #annonces
      set('boost_channel', /annonces?|boosts?|announc/i);
      // 8. Birthday channel → #annonces
      set('birthday_channel', /anniv|birth|annonces?/i);
      // 9. Ticket log → #bot-logs (différent canal pour audit tickets)
      set('ticket_log_channel', /bot.?logs?|tickets?-?logs?/i);

      // 10. Configuration des messages welcome/leave par défaut
      try {
        db.setConfig(guild.id, 'welcome_msg', '👋 Bienvenue {user} sur **{server}** ! Lis les règles dans <#1499359067414724718> et réagis pour avoir accès au reste !');
        detected.welcome_msg = '✅ Configuré';
      } catch (e) {
        skipped.push('welcome_msg: ' + e.message);
      }

      // 11. Couleur par défaut harmonisée
      try {
        const cfg = db.getConfig(guild.id);
        if (!cfg.color || cfg.color === '#7B2FBE') {
          db.setConfig(guild.id, 'color', '#9B59B6'); // violet
          detected.color = '#9B59B6 (violet harmonisé)';
        }
      } catch {}

      // 12. Vérifier que XP est activé
      try {
        const cfg = db.getConfig(guild.id);
        if (cfg.xp_enabled === 0 || cfg.xp_enabled === false) {
          // Note: on ne force pas l'XP si désactivé exprès, juste signaler
          skipped.push('xp_enabled: actuellement désactivé (vérifie /setup xp)');
        } else {
          detected.xp_enabled = '✅ Activé';
        }
      } catch {}

      // 13. Currency_emoji et name si pas définis
      try {
        const cfg = db.getConfig(guild.id);
        if (!cfg.currency_name) db.setConfig(guild.id, 'currency_name', 'Euros');
        if (!cfg.currency_emoji) db.setConfig(guild.id, 'currency_emoji', '€');
        detected.currency = `${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}`;
      } catch {}

      // RAPPORT
      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      const detectedEntries = Object.entries(detected).map(([k, v]) => `✅ **${k}** → ${v}`);
      const lines = [
        '**Configurations détectées et appliquées :**',
        '',
        ...detectedEntries.slice(0, 25),
        '',
        skipped.length ? `**Non configurés (${skipped.length}) :**\n` + skipped.slice(0, 8).map(s => `⚠️ ${s}`).join('\n') : '',
        '',
        '**Note :** Aucun auto-rôle n\'est configuré pour préserver le système de validation par réaction sur le règlement.',
      ].filter(Boolean).join('\n');

      return respFn({ embeds: [new EmbedBuilder()
        .setColor(skipped.length === 0 ? '#2ECC71' : '#F39C12')
        .setTitle('🤖 ・ AUTOCONFIG ・ Rapport')
        .setDescription(lines.slice(0, 4000))
        .setFooter({ text: 'Vérifie /setup voir pour confirmer • Personnaliser : /setup <sous-commande>' })
        .setTimestamp()] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 🧹 NETTOYER DOUBLONS V2 : supprime TOUS les rôles doublons
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'nettoyer-doublons-v2') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const me = guild.members.me;
      const myTopPos = me?.roles?.highest?.position || 0;

      // Grouper les rôles par nom (lowercase, normalisé)
      const allRoles = [...guild.roles.cache.values()].filter(r =>
        !r.managed && r.id !== guild.id // exclure @everyone et rôles bot
      );

      const groups = new Map();
      for (const r of allRoles) {
        const key = r.name.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }

      let totalDeleted = 0, totalMembersMoved = 0, totalGroupsCleaned = 0;
      const errors = [];
      const examples = [];

      for (const [name, roles] of groups) {
        if (roles.length < 2) continue; // pas un doublon
        totalGroupsCleaned++;

        // Trier par : 1) le plus ancien d'abord (gardé), 2) le plus de membres si égal
        roles.sort((a, b) => {
          if (a.members.size !== b.members.size) return b.members.size - a.members.size;
          return a.createdTimestamp - b.createdTimestamp;
        });

        const keep = roles[0];
        const toDelete = roles.slice(1);

        if (examples.length < 5) {
          examples.push(`**${name}** : ${roles.length}× → garde ${keep.name} (${keep.members.size} membres)`);
        }

        for (const r of toDelete) {
          // Sauter si rôle au-dessus de notre top
          if (r.position >= myTopPos) {
            errors.push(`${r.name} : au-dessus du bot`);
            continue;
          }
          try {
            // 1. Réassigner les membres au rôle gardé
            for (const [, m] of r.members) {
              if (!m.roles.cache.has(keep.id)) {
                try { await m.roles.add(keep, 'merge doublons-v2'); totalMembersMoved++; } catch {}
              }
            }
            // 2. Supprimer le rôle
            await r.delete(`Doublon supprimé (gardé: ${keep.name}) - nettoyer-doublons-v2`);
            totalDeleted++;
            // Petit délai pour éviter rate-limits
            await new Promise(r => setTimeout(r, 200));
          } catch (e) {
            errors.push(`${r.name}: ${e?.message || 'erreur'}`);
          }
        }
      }

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder()
        .setColor(errors.length === 0 ? '#2ECC71' : '#E67E22')
        .setTitle('🧹 ・ Nettoyage doublons V2 ・ Rapport')
        .setDescription([
          `**${totalGroupsCleaned}** groupe(s) de doublons traité(s)`,
          `🗑️ **${totalDeleted}** rôle(s) doublon(s) supprimé(s)`,
          `👥 **${totalMembersMoved}** membre(s) réassigné(s) au rôle gardé`,
          errors.length ? `❌ **${errors.length}** échec(s) (rôles au-dessus du bot)` : '',
          '',
          examples.length ? '**Exemples :**\n' + examples.join('\n') : '',
          errors.length && errors.length <= 5 ? '\n**Erreurs :**\n' + errors.map(e => `• ${e}`).join('\n') : '',
        ].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: 'Si erreurs : monte NexusBot dans la hiérarchie et relance.' })
        .setTimestamp()] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 📐 ORGANISER HIÉRARCHIE : Bot → Owner → Admin → Mod → Staff → Membres
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'organiser-hierarchie') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const me = guild.members.me;
      const myTopPos = me?.roles?.highest?.position || 0;

      // Patterns de classification (du plus haut prioritaire au plus bas)
      const TIERS = [
        { tier: 1,  name: 'Owner/Propriétaire',     test: /propri[eé]taire|^owner$|fondateur|founder/i },
        { tier: 2,  name: 'Admin/Hébergeur',         test: /^admin|^h[eé]bergeur|^d[eé]veloppeur|^developer/i },
        { tier: 3,  name: 'Modérateur',              test: /mod[eé]rateur|moderator|gestionnaire|manager/i },
        { tier: 4,  name: 'Staff',                   test: /^staff$|^équipe$|^team$/i },
        { tier: 5,  name: 'Helper/Support',          test: /helper|support/i },
        { tier: 6,  name: 'VIP/Premium',             test: /^vip$|premium|^pro$/i },
        { tier: 7,  name: 'Booster',                 test: /booster|boost/i },
        { tier: 8,  name: 'Partenaire',              test: /partenaire|partner/i },
        { tier: 9,  name: 'Actif/Top',               test: /actif|active|^top$/i },
        { tier: 10, name: 'Niveau (level roles)',    test: /^niveau\s|^level\s|^lvl\s|^lv\s/i },
        { tier: 11, name: 'Événements',              test: /[eé]v[eé]nements?|events?/i },
        { tier: 12, name: 'Membre',                  test: /^membre$|^member$|^v[eé]rifi[eé]/i },
        { tier: 13, name: 'Autres',                  test: /.*/ },
      ];

      // Classifier chaque rôle
      const allRoles = [...guild.roles.cache.values()].filter(r =>
        !r.managed && r.id !== guild.id
      );

      const classified = allRoles.map(r => {
        const tier = TIERS.find(t => t.test.test(r.name)) || TIERS[TIERS.length - 1];
        return { role: r, tier: tier.tier, tierName: tier.name };
      });

      // Trier : tier asc (1 = le plus haut)
      classified.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.role.name.localeCompare(b.role.name);
      });

      // Calculer les positions cibles : on commence juste en dessous du bot
      // Position max disponible = myTopPos - 1
      // On veut : tier 1 = position la plus haute, tier 13 = la plus basse
      const targetPositions = {};
      let nextPos = myTopPos - 1;
      for (const c of classified) {
        if (c.role.position >= myTopPos) continue; // skip rôles intouchables
        targetPositions[c.role.id] = nextPos--;
        if (nextPos < 1) break;
      }

      // Construction de la liste pour setPositions (Discord API bulk)
      const positionsArray = [];
      for (const [roleId, position] of Object.entries(targetPositions)) {
        positionsArray.push({ role: roleId, position: Math.max(1, position) });
      }

      let success = false;
      let errorMsg = null;
      try {
        // setPositions accepte un array d'updates en bulk
        await guild.roles.setPositions(positionsArray);
        success = true;
      } catch (e) {
        errorMsg = e?.message || 'Erreur inconnue';
      }

      // Compter le nombre de rôles intouchables
      const skipped = classified.filter(c => c.role.position >= myTopPos).length;

      // Préparer le résumé par tier
      const byTier = {};
      for (const c of classified) {
        if (!byTier[c.tierName]) byTier[c.tierName] = [];
        byTier[c.tierName].push(c.role.name);
      }
      const tierLines = Object.entries(byTier)
        .map(([tier, roles]) => `**${tier}** (${roles.length}) : ${roles.slice(0, 4).join(', ')}${roles.length > 4 ? '...' : ''}`)
        .join('\n');

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder()
        .setColor(success ? '#2ECC71' : '#E74C3C')
        .setTitle('📐 ・ Organisation hiérarchie ・ Rapport')
        .setDescription([
          success
            ? `✅ **${positionsArray.length}** rôle(s) repositionné(s) selon la hiérarchie standard`
            : `❌ **Erreur** lors du bulk setPositions : ${errorMsg}`,
          skipped ? `🔒 **${skipped}** rôle(s) intouchable(s) (au-dessus du bot)` : '',
          '',
          '**Ordre appliqué (du plus haut au plus bas) :**',
          tierLines.slice(0, 2500),
          '',
          '*Note : NexusBot lui-même reste à sa position actuelle (peut nécessiter remontée manuelle).*',
        ].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: 'Pour tout customiser : Paramètres serveur → Rôles' })
        .setTimestamp()] });
    }

    // ═══════════════════════════════════════════════════════════════
    // 👑 HIÉRARCHIE PRO : style des plus gros serveurs Discord
    // ═══════════════════════════════════════════════════════════════
    if (sub === 'hierarchie-pro') {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const me = guild.members.me;
      const myTopPos = me?.roles?.highest?.position || 0;

      // Tiers ULTRA précis comme dans les serveurs pro (du plus haut au plus bas)
      // Chaque pattern est testé dans l'ordre, le PREMIER matché gagne
      const TIERS = [
        // === STAFF ULTRA HAUT ===
        { tier: 1,  name: '👑 Propriétaire',         test: /^(👑|🦊)?\s*propri[eé]taire|^owner$|^fondateur$|^founder$/i },
        { tier: 2,  name: '🤴 Co-Propriétaire',      test: /co.?propri[eé]taire|co.?owner|co.?fondateur|co.?founder/i },
        { tier: 3,  name: '⚡ Administrateur',        test: /^(⚡|🛡|👮)?\s*administrateur|^admin$|^administrator$/i },
        { tier: 4,  name: '💻 Hébergeur/Dev',         test: /^h[eé]bergeur|^d[eé]veloppeur|^developer|^dev$|^tech.?lead/i },
        { tier: 5,  name: '🛡 Modérateur Senior',     test: /head.?mod|senior.?mod|mod.?senior|chef.?mod/i },
        { tier: 6,  name: '🛡 Modérateur',            test: /^(🛡|👮)?\s*mod[eé]rateur|^moderator$|gestionnaire|^manager$/i },
        { tier: 7,  name: '🆘 Helper/Support',        test: /^helper$|^support$/i },
        { tier: 8,  name: '🎪 Animateur/Event',       test: /animateur|event.?manager|gestionnaire.?event/i },
        { tier: 9,  name: '👥 Staff',                 test: /^(👥|👮)?\s*staff$|^équipe$|^team$/i },
        { tier: 10, name: '🎓 Trial/Stagiaire',       test: /trial.?mod|stagiaire/i },
        { tier: 11, name: '🤝 Partenaire',            test: /partenaire|partner/i },
        { tier: 12, name: '🎬 Streamer/YouTuber',     test: /streamer|youtuber|content.?creator/i },
        { tier: 13, name: '💎 VIP/Premium',           test: /^vip$|premium|donateur|donator/i },
        { tier: 14, name: '🚀 Server Booster',        test: /server.?booster|booster|nitro.?boost/i },
        { tier: 15, name: '✨ Actif/OG/Top',          test: /^actif$|^active$|^og$|^top$|^l[eé]gende$|legend|fid[eè]le/i },
        { tier: 16, name: '🌟 Niveaux',               test: /^(niveau|level|lvl|lv|nv)\s*\d+|^lv\d+$|^lvl\d+$/i },
        { tier: 17, name: '🎮 Gaming',                test: /gamer|gaming|^pro.?gamer|^semi.?pro/i },
        { tier: 18, name: '📢 Événements',            test: /[eé]v[eé]nements?|events?/i },
        { tier: 19, name: '🎨 Personnalité',          test: /senior|cr[eé]atif|creative|d[eé]v|dev/i },
        { tier: 20, name: '✅ Membre validé',         test: /^membre$|^member$|^v[eé]rifi[eé]|^verified/i },
        { tier: 21, name: '📋 Autres',                test: /.*/ },
      ];

      // 1. Vérifier que le rôle Administrateur existe, sinon le créer
      let adminRole = guild.roles.cache.find(r => /^(⚡|🛡|👮)?\s*administrateur$|^admin$/i.test(r.name) && !r.managed);
      let createdAdmin = false;
      if (!adminRole) {
        try {
          adminRole = await guild.roles.create({
            name: '⚡ Administrateur',
            color: '#E74C3C',
            mentionable: true,
            hoist: true,
            permissions: [
              PermissionFlagsBits.ManageGuild,
              PermissionFlagsBits.ManageRoles,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.ManageWebhooks,
              PermissionFlagsBits.ManageEmojisAndStickers,
              PermissionFlagsBits.ManageEvents,
              PermissionFlagsBits.ManageNicknames,
              PermissionFlagsBits.ManageThreads,
              PermissionFlagsBits.ViewAuditLog,
              PermissionFlagsBits.MentionEveryone,
              PermissionFlagsBits.ModerateMembers,
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.UseExternalEmojis,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.UseApplicationCommands,
              // PAS de BanMembers / KickMembers (règle user)
            ],
            reason: 'hierarchie-pro — création du rôle Administrateur',
          });
          createdAdmin = true;
        } catch (e) {
          // ignore
        }
      }

      // 2. Classifier tous les rôles
      const allRoles = [...guild.roles.cache.values()].filter(r =>
        !r.managed && r.id !== guild.id
      );

      const classified = allRoles.map(r => {
        const tier = TIERS.find(t => t.test.test(r.name)) || TIERS[TIERS.length - 1];
        return { role: r, tier: tier.tier, tierName: tier.name };
      });

      // Trier : tier asc (1 = le plus haut)
      classified.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.role.name.localeCompare(b.role.name);
      });

      // 3. Calculer les positions cibles : on commence juste en dessous du bot
      const targetPositions = {};
      let nextPos = myTopPos - 1;
      for (const c of classified) {
        if (c.role.position >= myTopPos) continue; // skip rôles intouchables
        targetPositions[c.role.id] = nextPos--;
        if (nextPos < 1) break;
      }

      // 4. Bulk setPositions
      const positionsArray = Object.entries(targetPositions).map(([roleId, position]) => ({
        role: roleId,
        position: Math.max(1, position),
      }));

      let success = false;
      let errorMsg = null;
      try {
        await guild.roles.setPositions(positionsArray);
        success = true;
      } catch (e) {
        errorMsg = e?.message || 'Erreur';
      }

      // 5. Préparer le résumé
      const skipped = classified.filter(c => c.role.position >= myTopPos).length;
      const byTier = {};
      for (const c of classified) {
        if (!byTier[c.tierName]) byTier[c.tierName] = [];
        byTier[c.tierName].push(c.role.name);
      }
      const tierLines = Object.entries(byTier)
        .map(([tier, roles]) => `**${tier}** (${roles.length}) : ${roles.slice(0, 4).join(', ')}${roles.length > 4 ? '...' : ''}`)
        .join('\n');

      const respFn = (interaction.deferred || interaction.replied) ? interaction.editReply.bind(interaction) : interaction.reply.bind(interaction);
      return respFn({ embeds: [new EmbedBuilder()
        .setColor(success ? '#9B59B6' : '#E74C3C')
        .setTitle('👑 ・ Hiérarchie PRO ・ Rapport')
        .setDescription([
          createdAdmin ? '🆕 Rôle **⚡ Administrateur** créé (rouge, hoisted, mentionnable, perms admin sans ban/kick)' : '✅ Rôle **Administrateur** existant détecté',
          success
            ? `✅ **${positionsArray.length}** rôle(s) repositionné(s) selon la hiérarchie PRO`
            : `❌ Erreur bulk setPositions : ${errorMsg}`,
          skipped ? `🔒 **${skipped}** rôle(s) intouchable(s) (au-dessus de NexusBot)` : '',
          '',
          '**Hiérarchie pro appliquée (du plus haut au plus bas) :**',
          tierLines.slice(0, 2500),
          '',
          '*NexusBot et autres rôles managés restent à leur position. Pour mettre NexusBot tout en haut → Paramètres → Rôles → glisser à la main.*',
        ].filter(Boolean).join('\n').slice(0, 4000))
        .setFooter({ text: 'Inspiré des plus gros serveurs Discord (style officiel)' })
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
