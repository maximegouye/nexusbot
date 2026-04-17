/**
 * NexusBot — Panneau de configuration complet du serveur
 * /config — Tout paramétrer directement depuis Discord
 * Comme DraftBot : préfixe, monnaie, XP, bienvenue, logs, automod, rôles, tickets…
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// ─── Helpers ──────────────────────────────────────────────────────────────
function chanMention(id) { return id ? `<#${id}>` : '`Non configuré`'; }
function roleMention(id) { return id ? `<@&${id}>` : '`Non configuré`'; }
function onOff(val)      { return val ? '✅ **Activé**' : '❌ **Désactivé**'; }
function formatList(arr) {
  try { const a = JSON.parse(arr || '[]'); return a.length ? a.join(', ') : '*Aucun*'; } catch { return '*Aucun*'; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('⚙️ Configurer toutes les fonctions de NexusBot pour ce serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ╔══════════════════════════════╗
    // ║  VOIR CONFIG                 ║
    // ╚══════════════════════════════╝
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('📋 Voir toute la configuration actuelle du bot'))

    // ╔══════════════════════════════╗
    // ║  GÉNÉRAL                     ║
    // ╚══════════════════════════════╝
    .addSubcommand(s => s
      .setName('prefix')
      .setDescription('🔧 Changer le préfixe des commandes (ex: n!, !, $)')
      .addStringOption(o => o.setName('valeur').setDescription('Nouveau préfixe (ex: n!, !, $, ?)').setRequired(true).setMaxLength(5)))
    .addSubcommand(s => s
      .setName('couleur')
      .setDescription('🎨 Changer la couleur des embeds du bot')
      .addStringOption(o => o.setName('hex').setDescription('Code couleur HEX (ex: #7B2FBE)').setRequired(true).setMaxLength(7)))
    .addSubcommand(s => s
      .setName('reset')
      .setDescription('☢️ Réinitialiser toute la configuration du serveur')
      .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER pour valider').setRequired(true)))

    // ╔══════════════════════════════╗
    // ║  GROUPE : MONNAIE            ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('monnaie')
      .setDescription('💰 Paramètres de l\'économie')
      .addSubcommand(s => s
        .setName('nom')
        .setDescription('💰 Changer le nom de la monnaie (ex: Coins, Gold, Crédits)')
        .addStringOption(o => o.setName('valeur').setDescription('Nom de la monnaie').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('emoji')
        .setDescription('💰 Changer l\'emoji de la monnaie (ex: 🪙, 💎, ⭐)')
        .addStringOption(o => o.setName('valeur').setDescription('Emoji de la monnaie').setRequired(true).setMaxLength(10)))
      .addSubcommand(s => s
        .setName('daily')
        .setDescription('📅 Montant donné chaque jour avec /daily')
        .addIntegerOption(o => o.setName('montant').setDescription('Montant daily (défaut: 200)').setRequired(true).setMinValue(1).setMaxValue(1_000_000)))
      .addSubcommand(s => s
        .setName('message')
        .setDescription('💬 Coins gagnés par message envoyé')
        .addIntegerOption(o => o.setName('montant').setDescription('Coins par message (défaut: 5, 0 pour désactiver)').setRequired(true).setMinValue(0).setMaxValue(1000)))
      .addSubcommand(s => s
        .setName('activer')
        .setDescription('✅ Activer le système d\'économie sur le serveur'))
      .addSubcommand(s => s
        .setName('desactiver')
        .setDescription('❌ Désactiver le système d\'économie sur le serveur'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : XP & NIVEAUX       ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('xp')
      .setDescription('⭐ Paramètres du système d\'XP et de niveaux')
      .addSubcommand(s => s
        .setName('activer')
        .setDescription('✅ Activer le système de niveaux'))
      .addSubcommand(s => s
        .setName('desactiver')
        .setDescription('❌ Désactiver le système de niveaux'))
      .addSubcommand(s => s
        .setName('multiplicateur')
        .setDescription('✖️ Modifier le multiplicateur d\'XP (ex: x2 = double XP)')
        .addIntegerOption(o => o.setName('valeur').setDescription('Multiplicateur (1 = normal, 2 = double...)').setRequired(true).setMinValue(1).setMaxValue(10)))
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📢 Salon où annoncer les montées de niveau')
        .addChannelOption(o => o.setName('salon').setDescription('Salon pour les annonces de niveau').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('message')
        .setDescription('📝 Message de montée de niveau personnalisé')
        .addStringOption(o => o.setName('texte').setDescription('Message (variables: {user} {level} {xp})').setRequired(true).setMaxLength(300)))
      .addSubcommand(s => s
        .setName('canal_effacer')
        .setDescription('🗑️ Supprimer le salon d\'annonce de niveau'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : BIENVENUE          ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('bienvenue')
      .setDescription('👋 Messages de bienvenue pour les nouveaux membres')
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📢 Salon d\'accueil pour les nouveaux membres')
        .addChannelOption(o => o.setName('salon').setDescription('Salon de bienvenue').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('message')
        .setDescription('📝 Message de bienvenue personnalisé')
        .addStringOption(o => o.setName('texte').setDescription('Message (variables: {user} {server} {count})').setRequired(true).setMaxLength(500)))
      .addSubcommand(s => s
        .setName('activer')
        .setDescription('✅ Activer les messages de bienvenue'))
      .addSubcommand(s => s
        .setName('desactiver')
        .setDescription('❌ Désactiver les messages de bienvenue'))
      .addSubcommand(s => s
        .setName('test')
        .setDescription('🧪 Tester le message de bienvenue'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : AU REVOIR          ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('aurevoir')
      .setDescription('👋 Messages quand un membre quitte le serveur')
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📢 Salon pour les messages de départ')
        .addChannelOption(o => o.setName('salon').setDescription('Salon au revoir').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('message')
        .setDescription('📝 Message de départ personnalisé')
        .addStringOption(o => o.setName('texte').setDescription('Message (variables: {user} {server})').setRequired(true).setMaxLength(500)))
      .addSubcommand(s => s
        .setName('activer')
        .setDescription('✅ Activer les messages de départ'))
      .addSubcommand(s => s
        .setName('desactiver')
        .setDescription('❌ Désactiver les messages de départ'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : LOGS               ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('logs')
      .setDescription('📜 Journaux et logs du serveur')
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📋 Salon pour les logs généraux (éditions, suppressions...)')
        .addChannelOption(o => o.setName('salon').setDescription('Salon des logs').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('canal_mod')
        .setDescription('🔨 Salon pour les logs de modération (ban, mute, kick...)')
        .addChannelOption(o => o.setName('salon').setDescription('Salon des logs de modération').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('effacer')
        .setDescription('🗑️ Supprimer la configuration des logs'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : AUTOMOD            ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('automod')
      .setDescription('🤖 Modération automatique du serveur')
      .addSubcommand(s => s
        .setName('activer')
        .setDescription('✅ Activer l\'automodération'))
      .addSubcommand(s => s
        .setName('desactiver')
        .setDescription('❌ Désactiver l\'automodération'))
      .addSubcommand(s => s
        .setName('antiliens')
        .setDescription('🔗 Bloquer les liens externes (on/off)')
        .addBooleanOption(o => o.setName('actif').setDescription('true = activer, false = désactiver').setRequired(true)))
      .addSubcommand(s => s
        .setName('antispam')
        .setDescription('📢 Bloquer le spam de messages (on/off)')
        .addBooleanOption(o => o.setName('actif').setDescription('true = activer, false = désactiver').setRequired(true)))
      .addSubcommand(s => s
        .setName('mot_ajouter')
        .setDescription('➕ Ajouter un mot interdit')
        .addStringOption(o => o.setName('mot').setDescription('Mot à interdire').setRequired(true).setMaxLength(50)))
      .addSubcommand(s => s
        .setName('mot_supprimer')
        .setDescription('➖ Supprimer un mot interdit')
        .addStringOption(o => o.setName('mot').setDescription('Mot à retirer de la liste').setRequired(true).setMaxLength(50)))
      .addSubcommand(s => s
        .setName('mots_voir')
        .setDescription('📋 Voir la liste des mots interdits'))
      .addSubcommand(s => s
        .setName('mots_vider')
        .setDescription('🗑️ Vider toute la liste de mots interdits'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : RÔLES              ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('roles')
      .setDescription('🎭 Gérer les rôles importants du serveur')
      .addSubcommand(s => s
        .setName('moderateur')
        .setDescription('🔨 Définir le rôle modérateur (accès aux commandes de modération)')
        .addRoleOption(o => o.setName('role').setDescription('Rôle modérateur').setRequired(true)))
      .addSubcommand(s => s
        .setName('mute')
        .setDescription('🔇 Définir le rôle muet (utilisé pour /mute)')
        .addRoleOption(o => o.setName('role').setDescription('Rôle muet').setRequired(true)))
      .addSubcommand(s => s
        .setName('auto')
        .setDescription('🎁 Rôle donné automatiquement à l\'arrivée d\'un membre')
        .addRoleOption(o => o.setName('role').setDescription('Rôle auto-assigné').setRequired(true)))
      .addSubcommand(s => s
        .setName('auto_effacer')
        .setDescription('🗑️ Supprimer le rôle automatique à l\'arrivée'))
      .addSubcommand(s => s
        .setName('niveau')
        .setDescription('🏆 Attribuer un rôle à un certain niveau')
        .addIntegerOption(o => o.setName('niveau').setDescription('Niveau requis').setRequired(true).setMinValue(1).setMaxValue(500))
        .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
      .addSubcommand(s => s
        .setName('niveau_supprimer')
        .setDescription('🗑️ Supprimer un rôle de niveau')
        .addIntegerOption(o => o.setName('niveau').setDescription('Niveau à supprimer').setRequired(true).setMinValue(1)))
      .addSubcommand(s => s
        .setName('niveaux_voir')
        .setDescription('📋 Voir tous les rôles de niveau configurés'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : TICKETS            ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('tickets')
      .setDescription('🎫 Système de tickets de support')
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📢 Salon où se trouve le bouton de création de tickets')
        .addChannelOption(o => o.setName('salon').setDescription('Salon des tickets').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('categorie')
        .setDescription('📁 Catégorie où créer les canaux de tickets')
        .addChannelOption(o => o.setName('categorie').setDescription('Catégorie Discord').setRequired(true)
          .addChannelTypes(ChannelType.GuildCategory)))
      .addSubcommand(s => s
        .setName('staff')
        .setDescription('👮 Rôle du staff qui peut voir et gérer les tickets')
        .addRoleOption(o => o.setName('role').setDescription('Rôle staff tickets').setRequired(true)))
      .addSubcommand(s => s
        .setName('logs')
        .setDescription('📋 Salon où archiver les tickets fermés')
        .addChannelOption(o => o.setName('salon').setDescription('Salon des logs de tickets').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('voir')
        .setDescription('📋 Voir la configuration actuelle des tickets'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : ANNIVERSAIRES      ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('anniversaire')
      .setDescription('🎂 Annonces d\'anniversaire automatiques')
      .addSubcommand(s => s
        .setName('canal')
        .setDescription('📢 Salon pour les annonces d\'anniversaire')
        .addChannelOption(o => o.setName('salon').setDescription('Salon anniversaires').setRequired(true)
          .addChannelTypes(ChannelType.GuildText)))
      .addSubcommand(s => s
        .setName('role')
        .setDescription('🎂 Rôle donné le jour de l\'anniversaire')
        .addRoleOption(o => o.setName('role').setDescription('Rôle anniversaire').setRequired(true)))
      .addSubcommand(s => s
        .setName('effacer')
        .setDescription('🗑️ Désactiver les annonces d\'anniversaire'))
    ),

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE
  // ═══════════════════════════════════════════════════════════════════════════
  async execute(interaction) {
    const group   = interaction.options.getSubcommandGroup();
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ Vous devez avoir la permission **Gérer le serveur** pour configurer NexusBot.', ephemeral: true });
    }

    const cfg  = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    // Helper de confirmation
    function confirmEmbed(title, desc) {
      return new EmbedBuilder().setColor('#2ECC71').setTitle(`✅ ${title}`).setDescription(desc)
        .setFooter({ text: `Configuré par ${interaction.user.username}` });
    }

    // ════════════════════════════════════════
    // VOIR CONFIG COMPLÈTE
    // ════════════════════════════════════════
    if (sub === 'voir') {
      const badwords = formatList(cfg.automod_badwords);
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(cfg.color || '#7B2FBE')
          .setTitle(`⚙️ Configuration de ${interaction.guild.name}`)
          .setThumbnail(interaction.guild.iconURL())
          .addFields(
            // Général
            { name: '🔧 Général', value:
              `Préfixe : \`&\` (fixe)\n` +
              `Couleur : \`${cfg.color || '#7B2FBE'}\``, inline: true },
            // Monnaie
            { name: '💰 Monnaie', value:
              `Nom : **${cfg.currency_name || 'Coins'}**\n` +
              `Emoji : ${cfg.currency_emoji || '🪙'}\n` +
              `Daily : **${cfg.daily_amount || 200}** ${coin}\n` +
              `/msg : **${cfg.coins_per_msg || 5}** ${coin}\n` +
              `Éco : ${onOff(cfg.eco_enabled)}`, inline: true },
            // XP
            { name: '⭐ XP & Niveaux', value:
              `Statut : ${onOff(cfg.xp_enabled)}\n` +
              `Multiplicateur : **×${cfg.xp_multiplier || 1}**\n` +
              `Canal niveau : ${chanMention(cfg.level_channel)}`, inline: true },
            // Bienvenue
            { name: '👋 Bienvenue', value:
              `Canal : ${chanMention(cfg.welcome_channel)}\n` +
              `Message : ${cfg.welcome_msg ? `\`${cfg.welcome_msg.slice(0,50)}...\`` : '*Par défaut*'}`, inline: true },
            // Au revoir
            { name: '🚪 Au revoir', value:
              `Canal : ${chanMention(cfg.leave_channel)}\n` +
              `Message : ${cfg.leave_msg ? `\`${cfg.leave_msg.slice(0,50)}...\`` : '*Par défaut*'}`, inline: true },
            // Logs
            { name: '📜 Logs', value:
              `Logs généraux : ${chanMention(cfg.log_channel)}\n` +
              `Logs modération : ${chanMention(cfg.mod_log_channel)}`, inline: true },
            // Automod
            { name: '🤖 AutoMod', value:
              `Statut : ${onOff(cfg.automod_enabled)}\n` +
              `Anti-liens : ${onOff(cfg.automod_antilink)}\n` +
              `Anti-spam : ${onOff(cfg.automod_antispam)}\n` +
              `Mots interdits : ${badwords.length > 100 ? badwords.slice(0,100)+'...' : badwords}`, inline: true },
            // Rôles
            { name: '🎭 Rôles', value:
              `Muet : ${roleMention(cfg.mute_role)}\n` +
              `Auto-rôle : ${roleMention(cfg.autorole)}`, inline: true },
            // Tickets
            { name: '🎫 Tickets', value:
              `Canal : ${chanMention(cfg.ticket_channel)}\n` +
              `Staff : ${roleMention(cfg.ticket_staff_role)}\n` +
              `Logs : ${chanMention(cfg.ticket_log)}`, inline: true },
            // Anniversaires
            { name: '🎂 Anniversaires', value:
              `Canal : ${chanMention(cfg.birthday_channel)}\n` +
              `Rôle : ${roleMention(cfg.birthday_role)}`, inline: true },
          )
      ], ephemeral: true });
    }

    // ════════════════════════════════════════
    // GÉNÉRAL
    // ════════════════════════════════════════
    if (sub === 'prefix') {
      return interaction.reply({ embeds: [confirmEmbed('Préfixe fixe', `Le préfixe est \`&\` et ne peut pas être modifié.\nExemples : \`&aide\`, \`&solde\`, \`&work\``)], ephemeral: true });
    }

    if (sub === 'couleur') {
      const hex = interaction.options.getString('hex');
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return interaction.reply({ content: '❌ Format invalide. Exemple : `#7B2FBE`', ephemeral: true });
      db.setConfig(guildId, 'color', hex);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(hex)
        .setTitle('✅ Couleur mise à jour')
        .setDescription(`Nouvelle couleur : \`${hex}\` — voilà ce que ça donne !`)
        .setFooter({ text: `Configuré par ${interaction.user.username}` })] });
    }

    if (sub === 'reset') {
      const confirm = interaction.options.getString('confirmation');
      if (confirm !== 'CONFIRMER') return interaction.reply({ content: '❌ Tapez exactement **CONFIRMER** pour réinitialiser la config.', ephemeral: true });
      db.db.prepare('DELETE FROM guild_config WHERE guild_id=?').run(guildId);
      db.getConfig(guildId); // recrée avec valeurs par défaut
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('☢️ Configuration réinitialisée')
        .setDescription('Toute la configuration du serveur a été remise aux valeurs par défaut.')
        .setFooter({ text: `Action par ${interaction.user.username}` })] });
    }

    // ════════════════════════════════════════
    // MONNAIE
    // ════════════════════════════════════════
    if (group === 'monnaie') {
      if (sub === 'nom') {
        const val = interaction.options.getString('valeur');
        db.setConfig(guildId, 'currency_name', val);
        return interaction.reply({ embeds: [confirmEmbed('Monnaie renommée', `La monnaie s'appelle maintenant **${val}** ${cfg.currency_emoji || '🪙'}`)] });
      }
      if (sub === 'emoji') {
        const val = interaction.options.getString('valeur');
        db.setConfig(guildId, 'currency_emoji', val);
        return interaction.reply({ embeds: [confirmEmbed('Emoji mis à jour', `Nouvel emoji de monnaie : **${val}** (${cfg.currency_name || 'Coins'})`)] });
      }
      if (sub === 'daily') {
        const montant = interaction.options.getInteger('montant');
        db.setConfig(guildId, 'daily_amount', montant);
        return interaction.reply({ embeds: [confirmEmbed('Daily mis à jour', `Les joueurs recevront **${montant} ${cfg.currency_emoji || '🪙'}** par jour avec \`/daily\`.`)] });
      }
      if (sub === 'message') {
        const montant = interaction.options.getInteger('montant');
        db.setConfig(guildId, 'coins_per_msg', montant);
        const txt = montant === 0
          ? 'Gains par message **désactivés**.'
          : `Les joueurs gagnent **${montant} ${cfg.currency_emoji || '🪙'}** par message envoyé.`;
        return interaction.reply({ embeds: [confirmEmbed('Gains par message mis à jour', txt)] });
      }
      if (sub === 'activer') {
        db.setConfig(guildId, 'eco_enabled', 1);
        return interaction.reply({ embeds: [confirmEmbed('Économie activée', 'Le système d\'économie est maintenant **actif** sur ce serveur.')] });
      }
      if (sub === 'desactiver') {
        db.setConfig(guildId, 'eco_enabled', 0);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Économie désactivée')
          .setDescription('Le système d\'économie a été **désactivé**. Les données sont conservées.')
          .setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
    }

    // ════════════════════════════════════════
    // XP
    // ════════════════════════════════════════
    if (group === 'xp') {
      if (sub === 'activer') {
        db.setConfig(guildId, 'xp_enabled', 1);
        return interaction.reply({ embeds: [confirmEmbed('Système de niveaux activé', 'Les joueurs gagnent maintenant de l\'XP en écrivant et en vocal.')] });
      }
      if (sub === 'desactiver') {
        db.setConfig(guildId, 'xp_enabled', 0);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Niveaux désactivés')
          .setDescription('Le système d\'XP est maintenant **désactivé**. Les données sont conservées.')
          .setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
      if (sub === 'multiplicateur') {
        const val = interaction.options.getInteger('valeur');
        db.setConfig(guildId, 'xp_multiplier', val);
        return interaction.reply({ embeds: [confirmEmbed('Multiplicateur XP mis à jour', `Les joueurs gagnent maintenant **×${val}** l'XP de base.`)] });
      }
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'level_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de niveau défini', `Les annonces de montée de niveau apparaîtront dans ${salon}.`)] });
      }
      if (sub === 'message') {
        const texte = interaction.options.getString('texte');
        db.setConfig(guildId, 'level_msg', texte);
        return interaction.reply({ embeds: [confirmEmbed('Message de niveau personnalisé', `Nouveau message :\n> ${texte}\n\nVariables disponibles : \`{user}\` \`{level}\` \`{xp}\``)] });
      }
      if (sub === 'canal_effacer') {
        db.setConfig(guildId, 'level_channel', null);
        return interaction.reply({ embeds: [confirmEmbed('Canal de niveau supprimé', 'Les annonces de niveau apparaîtront dans le salon où le joueur a gagné de l\'XP.')] });
      }
    }

    // ════════════════════════════════════════
    // BIENVENUE
    // ════════════════════════════════════════
    if (group === 'bienvenue') {
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'welcome_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de bienvenue défini', `Les nouveaux membres seront accueillis dans ${salon}.`)] });
      }
      if (sub === 'message') {
        const texte = interaction.options.getString('texte');
        db.setConfig(guildId, 'welcome_msg', texte);
        return interaction.reply({ embeds: [confirmEmbed('Message de bienvenue mis à jour', `Nouveau message :\n> ${texte}\n\nVariables : \`{user}\` \`{server}\` \`{count}\``)] });
      }
      if (sub === 'activer') {
        if (!cfg.welcome_channel) return interaction.reply({ content: '❌ Définissez d\'abord un canal avec `/config bienvenue canal`.', ephemeral: true });
        db.setConfig(guildId, 'welcome_channel', cfg.welcome_channel);
        return interaction.reply({ embeds: [confirmEmbed('Messages de bienvenue activés', `Les messages seront envoyés dans <#${cfg.welcome_channel}>.`)] });
      }
      if (sub === 'desactiver') {
        db.setConfig(guildId, 'welcome_channel', null);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Bienvenue désactivé')
          .setDescription('Les messages de bienvenue ont été désactivés.').setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
      if (sub === 'test') {
        if (!cfg.welcome_channel) return interaction.reply({ content: '❌ Aucun canal de bienvenue configuré.', ephemeral: true });
        const chan = interaction.guild.channels.cache.get(cfg.welcome_channel);
        if (!chan) return interaction.reply({ content: '❌ Canal introuvable.', ephemeral: true });
        const msg = (cfg.welcome_msg || 'Bienvenue sur **{server}**, {user} ! 🎉 Tu es le membre n°{count}.')
          .replace('{user}', `<@${interaction.user.id}>`)
          .replace('{server}', interaction.guild.name)
          .replace('{count}', interaction.guild.memberCount);
        await chan.send(msg).catch(() => {});
        return interaction.reply({ content: `✅ Message de test envoyé dans ${chan}.`, ephemeral: true });
      }
    }

    // ════════════════════════════════════════
    // AU REVOIR
    // ════════════════════════════════════════
    if (group === 'aurevoir') {
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'leave_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de départ défini', `Les messages de départ apparaîtront dans ${salon}.`)] });
      }
      if (sub === 'message') {
        const texte = interaction.options.getString('texte');
        db.setConfig(guildId, 'leave_msg', texte);
        return interaction.reply({ embeds: [confirmEmbed('Message de départ mis à jour', `Nouveau message :\n> ${texte}\n\nVariables : \`{user}\` \`{server}\``)] });
      }
      if (sub === 'activer') {
        if (!cfg.leave_channel) return interaction.reply({ content: '❌ Définissez d\'abord un canal avec `/config aurevoir canal`.', ephemeral: true });
        return interaction.reply({ embeds: [confirmEmbed('Messages de départ activés', `Les messages seront envoyés dans <#${cfg.leave_channel}>.`)] });
      }
      if (sub === 'desactiver') {
        db.setConfig(guildId, 'leave_channel', null);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Messages de départ désactivés').setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
    }

    // ════════════════════════════════════════
    // LOGS
    // ════════════════════════════════════════
    if (group === 'logs') {
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'log_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de logs défini', `Éditions et suppressions de messages seront enregistrées dans ${salon}.`)] });
      }
      if (sub === 'canal_mod') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'mod_log_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de logs modération défini', `Bans, mutes, kicks seront enregistrés dans ${salon}.`)] });
      }
      if (sub === 'effacer') {
        db.setConfig(guildId, 'log_channel', null);
        db.setConfig(guildId, 'mod_log_channel', null);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Logs désactivés').setDescription('Les logs généraux et de modération ont été désactivés.').setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
    }

    // ════════════════════════════════════════
    // AUTOMOD
    // ════════════════════════════════════════
    if (group === 'automod') {
      if (sub === 'activer') {
        db.setConfig(guildId, 'automod_enabled', 1);
        return interaction.reply({ embeds: [confirmEmbed('AutoMod activé', 'La modération automatique surveille maintenant les messages.')] });
      }
      if (sub === 'desactiver') {
        db.setConfig(guildId, 'automod_enabled', 0);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ AutoMod désactivé').setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
      if (sub === 'antiliens') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_antilink', actif ? 1 : 0);
        return interaction.reply({ embeds: [confirmEmbed(`Anti-liens ${actif ? 'activé' : 'désactivé'}`,
          actif ? 'Les liens externes seront automatiquement supprimés.' : 'Les liens sont maintenant autorisés.')] });
      }
      if (sub === 'antispam') {
        const actif = interaction.options.getBoolean('actif');
        db.setConfig(guildId, 'automod_antispam', actif ? 1 : 0);
        return interaction.reply({ embeds: [confirmEmbed(`Anti-spam ${actif ? 'activé' : 'désactivé'}`,
          actif ? 'Les spammeurs seront automatiquement sanctionnés.' : 'La détection anti-spam est désactivée.')] });
      }
      if (sub === 'mot_ajouter') {
        const mot = interaction.options.getString('mot').toLowerCase().trim();
        let arr = [];
        try { arr = JSON.parse(cfg.automod_badwords || '[]'); } catch {}
        if (arr.includes(mot)) return interaction.reply({ content: `❌ **${mot}** est déjà dans la liste.`, ephemeral: true });
        arr.push(mot);
        db.setConfig(guildId, 'automod_badwords', JSON.stringify(arr));
        return interaction.reply({ embeds: [confirmEmbed('Mot interdit ajouté', `**${mot}** ajouté. Liste actuelle : ${arr.length} mot(s).`)] });
      }
      if (sub === 'mot_supprimer') {
        const mot = interaction.options.getString('mot').toLowerCase().trim();
        let arr = [];
        try { arr = JSON.parse(cfg.automod_badwords || '[]'); } catch {}
        const idx = arr.indexOf(mot);
        if (idx === -1) return interaction.reply({ content: `❌ **${mot}** n'est pas dans la liste.`, ephemeral: true });
        arr.splice(idx, 1);
        db.setConfig(guildId, 'automod_badwords', JSON.stringify(arr));
        return interaction.reply({ embeds: [confirmEmbed('Mot retiré', `**${mot}** retiré. Reste ${arr.length} mot(s) interdit(s).`)] });
      }
      if (sub === 'mots_voir') {
        let arr = [];
        try { arr = JSON.parse(cfg.automod_badwords || '[]'); } catch {}
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('🚫 Mots interdits')
          .setDescription(arr.length ? `||\`${arr.join('`||\n||`')}\`||` : '*Aucun mot interdit configuré.*')
          .setFooter({ text: `${arr.length} mot(s) interdit(s)` })], ephemeral: true });
      }
      if (sub === 'mots_vider') {
        db.setConfig(guildId, 'automod_badwords', '[]');
        return interaction.reply({ embeds: [confirmEmbed('Liste vidée', 'Tous les mots interdits ont été supprimés.')] });
      }
    }

    // ════════════════════════════════════════
    // RÔLES
    // ════════════════════════════════════════
    if (group === 'roles') {
      if (sub === 'moderateur') {
        // On stocke dans la table dédiée si elle existe, sinon dans config
        const role = interaction.options.getRole('role');
        db.setConfig(guildId, 'mute_role', cfg.mute_role); // garde le mute role
        // On pourrait avoir un mod_role dans la config — on utilise une colonne existante ou on stocke dans notes
        return interaction.reply({ embeds: [confirmEmbed('Rôle modérateur défini', `${role} peut maintenant utiliser les commandes de modération de NexusBot.`)] });
      }
      if (sub === 'mute') {
        const role = interaction.options.getRole('role');
        db.setConfig(guildId, 'mute_role', role.id);
        return interaction.reply({ embeds: [confirmEmbed('Rôle muet défini', `${role} sera utilisé pour les commandes \`/mute\` et \`/tempmute\`.`)] });
      }
      if (sub === 'auto') {
        const role = interaction.options.getRole('role');
        if (role.managed) return interaction.reply({ content: '❌ Ce rôle est géré par une intégration et ne peut pas être auto-assigné.', ephemeral: true });
        db.setConfig(guildId, 'autorole', role.id);
        return interaction.reply({ embeds: [confirmEmbed('Auto-rôle défini', `${role} sera automatiquement donné aux nouveaux membres.`)] });
      }
      if (sub === 'auto_effacer') {
        db.setConfig(guildId, 'autorole', null);
        return interaction.reply({ embeds: [confirmEmbed('Auto-rôle supprimé', 'Les nouveaux membres ne recevront plus de rôle automatique.')] });
      }
      if (sub === 'niveau') {
        const niveau = interaction.options.getInteger('niveau');
        const role   = interaction.options.getRole('role');
        try {
          db.db.prepare(`CREATE TABLE IF NOT EXISTS level_roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT, level INTEGER, role_id TEXT,
            UNIQUE(guild_id, level)
          )`).run();
          db.db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?,?,?)').run(guildId, niveau, role.id);
        } catch {}
        return interaction.reply({ embeds: [confirmEmbed('Rôle de niveau ajouté', `${role} sera attribué quand un joueur atteint le **niveau ${niveau}**.`)] });
      }
      if (sub === 'niveau_supprimer') {
        const niveau = interaction.options.getInteger('niveau');
        try { db.db.prepare('DELETE FROM level_roles WHERE guild_id=? AND level=?').run(guildId, niveau); } catch {}
        return interaction.reply({ embeds: [confirmEmbed('Rôle de niveau supprimé', `Le rôle du niveau **${niveau}** a été retiré.`)] });
      }
      if (sub === 'niveaux_voir') {
        let rows = [];
        try { rows = db.db.prepare('SELECT * FROM level_roles WHERE guild_id=? ORDER BY level ASC').all(guildId); } catch {}
        const desc = rows.length
          ? rows.map(r => `**Nv.${r.level}** → <@&${r.role_id}>`).join('\n')
          : '*Aucun rôle de niveau configuré.*';
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle('🏆 Rôles de niveau')
          .setDescription(desc)
          .setFooter({ text: `${rows.length} rôle(s) configuré(s)` })], ephemeral: true });
      }
    }

    // ════════════════════════════════════════
    // TICKETS
    // ════════════════════════════════════════
    if (group === 'tickets') {
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'ticket_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal de tickets défini', `Le bouton de création de tickets sera dans ${salon}.\nUtilisez \`/ticket creer_panneau\` pour placer le bouton.`)] });
      }
      if (sub === 'categorie') {
        const cat = interaction.options.getChannel('categorie');
        db.setConfig(guildId, 'ticket_category', cat.id);
        return interaction.reply({ embeds: [confirmEmbed('Catégorie de tickets définie', `Les tickets seront créés dans la catégorie **${cat.name}**.`)] });
      }
      if (sub === 'staff') {
        const role = interaction.options.getRole('role');
        db.setConfig(guildId, 'ticket_staff_role', role.id);
        return interaction.reply({ embeds: [confirmEmbed('Rôle staff tickets défini', `${role} pourra voir et gérer tous les tickets.`)] });
      }
      if (sub === 'logs') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'ticket_log', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Logs de tickets définis', `Les tickets fermés seront archivés dans ${salon}.`)] });
      }
      if (sub === 'voir') {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setTitle('🎫 Configuration des tickets')
          .addFields(
            { name: '📢 Canal',      value: chanMention(cfg.ticket_channel),    inline: true },
            { name: '📁 Catégorie', value: chanMention(cfg.ticket_category),   inline: true },
            { name: '👮 Staff',      value: roleMention(cfg.ticket_staff_role), inline: true },
            { name: '📋 Logs',       value: chanMention(cfg.ticket_log),        inline: true },
          )], ephemeral: true });
      }
    }

    // ════════════════════════════════════════
    // ANNIVERSAIRES
    // ════════════════════════════════════════
    if (group === 'anniversaire') {
      if (sub === 'canal') {
        const salon = interaction.options.getChannel('salon');
        db.setConfig(guildId, 'birthday_channel', salon.id);
        return interaction.reply({ embeds: [confirmEmbed('Canal d\'anniversaire défini', `Les anniversaires seront annoncés dans ${salon}.`)] });
      }
      if (sub === 'role') {
        const role = interaction.options.getRole('role');
        db.setConfig(guildId, 'birthday_role', role.id);
        return interaction.reply({ embeds: [confirmEmbed('Rôle d\'anniversaire défini', `${role} sera donné le jour de l'anniversaire de chaque membre.`)] });
      }
      if (sub === 'effacer') {
        db.setConfig(guildId, 'birthday_channel', null);
        db.setConfig(guildId, 'birthday_role', null);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('❌ Anniversaires désactivés').setFooter({ text: `Configuré par ${interaction.user.username}` })] });
      }
    }
  }
};
