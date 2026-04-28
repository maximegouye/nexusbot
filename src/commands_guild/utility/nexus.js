/**
 * NexusBot — Commande propriétaire /nexus
 * Accès exclusif au propriétaire du serveur (ownerId ou OWNER_ID env)
 * Couvre la totalité de la configuration du bot en une seule commande
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActivityType } = require('discord.js');
const db = require('../../database/db');

// ─── Création des tables de sécurité si absentes ──────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS nexus_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT,
    banned_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();

  db.db.prepare(`CREATE TABLE IF NOT EXISTS nexus_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    executor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─── Vérification propriétaire ────────────────────────────────────────────────
function isOwner(interaction) {
  return (
    interaction.user.id === interaction.guild?.ownerId ||
    interaction.user.id === process.env.OWNER_ID
  );
}

// ─── Enregistrement dans l'audit log ─────────────────────────────────────────
function auditLog(guildId, executorId, action, target = null, details = null) {
  try {
    db.db.prepare(
      'INSERT INTO nexus_audit_log (guild_id, executor_id, action, target, details) VALUES (?,?,?,?,?)'
    ).run(guildId, executorId, action, target, details);
  } catch {}
}

// ─── Embed de base professionnel ─────────────────────────────────────────────
function baseEmbed(title, color = '#7B2FBE') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setTimestamp()
    .setFooter({ text: 'NexusBot • Commande propriétaire' });
}

// ─── Construction de la commande ─────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('nexus')
    .setDescription('🔐 Administration complète — Propriétaire uniquement')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // ═══════════════════════ GROUPE : ECO ════════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('eco')
      .setDescription('💰 Gestion économique complète')

      .addSubcommand(s => s.setName('donner').setDescription('Donner des coins à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Montant à donner').setRequired(true).setMaxLength(30)))

      .addSubcommand(s => s.setName('retirer').setDescription('Retirer des coins à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Montant à retirer').setRequired(true).setMaxLength(30)))

      .addSubcommand(s => s.setName('definir-solde').setDescription('Définir précisément le solde d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Nouveau solde').setRequired(true).setMaxLength(30)))

      .addSubcommand(s => s.setName('donner-xp').setDescription('Donner de l\'XP à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('XP à donner').setRequired(true).setMaxLength(30)))

      .addSubcommand(s => s.setName('definir-niveau').setDescription('Définir le niveau d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
        .addStringOption(o => o.setName('niveau').setDescription('Nouveau niveau').setRequired(true).setMaxLength(10)))

      .addSubcommand(s => s.setName('reset-user').setDescription('Réinitialiser le profil économique d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre à réinitialiser').setRequired(true)))

      .addSubcommand(s => s.setName('reset-serveur').setDescription('⚠️ Réinitialiser l\'intégralité de l\'économie du serveur'))

      .addSubcommand(s => s.setName('info-user').setDescription('Voir toutes les données d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre à inspecter').setRequired(true)))

      .addSubcommand(s => s.setName('top-richesse').setDescription('Classement des membres les plus riches du serveur'))
    )

    // ═══════════════════════ GROUPE : CONFIG ═════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('config')
      .setDescription('⚙️ Configuration complète du serveur')

      .addSubcommand(s => s.setName('monnaie').setDescription('Configurer la monnaie du serveur')
        .addStringOption(o => o.setName('nom').setDescription('Nom de la monnaie').setRequired(false))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji de la monnaie').setRequired(false)))

      .addSubcommand(s => s.setName('daily').setDescription('Configurer la récompense journalière')
        .addIntegerOption(o => o.setName('montant').setDescription('Montant du daily').setRequired(true).setMinValue(1)))

      .addSubcommand(s => s.setName('xp-multiplicateur').setDescription('Configurer le multiplicateur d\'XP')
        .addNumberOption(o => o.setName('valeur').setDescription('Multiplicateur (ex: 1.5)').setRequired(true).setMinValue(0.1)))

      .addSubcommand(s => s.setName('coins-par-message').setDescription('Définir les coins gagnés par message')
        .addIntegerOption(o => o.setName('montant').setDescription('Coins par message').setRequired(true).setMinValue(0)))

      .addSubcommand(s => s.setName('bienvenue').setDescription('Configurer le canal et message de bienvenue')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de bienvenue').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Message ({user} = mention, {server} = serveur, {count} = membres)').setRequired(false)))

      .addSubcommand(s => s.setName('aurevoir').setDescription('Configurer le canal et message d\'au revoir')
        .addChannelOption(o => o.setName('canal').setDescription('Canal d\'au revoir').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Message de départ').setRequired(false)))

      .addSubcommand(s => s.setName('logs').setDescription('Configurer le canal de logs généraux')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de logs').setRequired(true)))

      .addSubcommand(s => s.setName('logs-mod').setDescription('Configurer le canal de logs de modération')
        .addChannelOption(o => o.setName('canal').setDescription('Canal de logs de modération').setRequired(true)))

      .addSubcommand(s => s.setName('automod').setDescription('Activer ou désactiver l\'automodération')
        .addBooleanOption(o => o.setName('actif').setDescription('Activer l\'automod').setRequired(true)))

      .addSubcommand(s => s.setName('autorole').setDescription('Définir le rôle automatique à l\'arrivée')
        .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))

      .addSubcommand(s => s.setName('niveau-role').setDescription('Attribuer un rôle à l\'atteinte d\'un niveau')
        .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))

      .addSubcommand(s => s.setName('niveau-canal').setDescription('Canal d\'annonce de montée de niveau')
        .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true)))

      .addSubcommand(s => s.setName('starboard').setDescription('Configurer le canal starboard')
        .addChannelOption(o => o.setName('canal').setDescription('Canal starboard').setRequired(true)))

      .addSubcommand(s => s.setName('voir').setDescription('Afficher la configuration complète actuelle du serveur'))
    )

    // ═══════════════════════ GROUPE : BOUTIQUE ════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('boutique')
      .setDescription('🏪 Gestion de la boutique')

      .addSubcommand(s => s.setName('ajouter').setDescription('Ajouter un article à la boutique')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true).setMaxLength(50))
        .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true).setMaxLength(200))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false))
        .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer à l\'achat').setRequired(false))
        .addIntegerOption(o => o.setName('prix').setDescription('Prix').setRequired(true).setMinValue(1))
        .addIntegerOption(o => o.setName('stock').setDescription('Stock (-1 = illimité)').setRequired(true).setMinValue(-1)))

      .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un article de la boutique')
        .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))

      .addSubcommand(s => s.setName('modifier-prix').setDescription('Modifier le prix d\'un article')
        .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))
        .addIntegerOption(o => o.setName('prix').setDescription('Nouveau prix').setRequired(true).setMinValue(1)))

      .addSubcommand(s => s.setName('modifier-stock').setDescription('Modifier le stock d\'un article')
        .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))
        .addIntegerOption(o => o.setName('stock').setDescription('Nouveau stock (-1 = illimité)').setRequired(true).setMinValue(-1)))

      .addSubcommand(s => s.setName('activer').setDescription('Activer ou désactiver un article')
        .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))
        .addBooleanOption(o => o.setName('actif').setDescription('Activer l\'article').setRequired(true)))

      .addSubcommand(s => s.setName('liste').setDescription('Afficher tous les articles (y compris inactifs)'))

      .addSubcommand(s => s.setName('vider').setDescription('⚠️ Supprimer tous les articles de la boutique'))
    )

    // ═══════════════════════ GROUPE : EVENTS ════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('events')
      .setDescription('🎉 Gestion des événements économiques')

      .addSubcommand(s => s.setName('creer').setDescription('Créer un événement économique')
        .addStringOption(o => o.setName('nom').setDescription('Nom de l\'événement').setRequired(true))
        .addStringOption(o => o.setName('type').setDescription('Type d\'événement').setRequired(true).addChoices(
          { name: '💎 Double Coins', value: 'double_coins' },
          { name: '⚡ Triple XP', value: 'triple_xp' },
          { name: '📅 Double Daily', value: 'double_daily' },
          { name: '💬 Bonus Messages', value: 'msg_bonus' },
          { name: '🎰 Jackpot (gains x5)', value: 'jackpot' }
        ))
        .addIntegerOption(o => o.setName('duree').setDescription('Durée en heures').setRequired(true).setMinValue(1).setMaxValue(720)))

      .addSubcommand(s => s.setName('terminer').setDescription('Terminer un événement en cours')
        .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))

      .addSubcommand(s => s.setName('liste').setDescription('Afficher les événements actifs et à venir'))
    )

    // ═══════════════════════ GROUPE : BOT ════════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('bot')
      .setDescription('🤖 Gestion du bot')

      .addSubcommand(s => s.setName('statut').setDescription('Modifier le statut en ligne du bot')
        .addStringOption(o => o.setName('type').setDescription('Statut').setRequired(true).addChoices(
          { name: '🟢 En ligne', value: 'online' },
          { name: '🟡 Absent', value: 'idle' },
          { name: '🔴 Ne pas déranger', value: 'dnd' },
          { name: '⚫ Invisible', value: 'invisible' }
        )))

      .addSubcommand(s => s.setName('activite').setDescription('Modifier l\'activité affichée du bot')
        .addStringOption(o => o.setName('type').setDescription('Type d\'activité').setRequired(true).addChoices(
          { name: '🎮 Joue à', value: 'PLAYING' },
          { name: '👁️ Regarde', value: 'WATCHING' },
          { name: '🎵 Écoute', value: 'LISTENING' },
          { name: '🏆 En compétition dans', value: 'COMPETING' }
        ))
        .addStringOption(o => o.setName('texte').setDescription('Texte de l\'activité').setRequired(true).setMaxLength(128)))

      .addSubcommand(s => s.setName('pseudo').setDescription('Changer le pseudo du bot sur ce serveur')
        .addStringOption(o => o.setName('nom').setDescription('Nouveau pseudo (vide = nom d\'origine)').setRequired(false).setMaxLength(32)))

      .addSubcommand(s => s.setName('info').setDescription('Voir les informations techniques et statistiques du bot'))

      .addSubcommand(s => s.setName('ping').setDescription('Tester la latence du bot'))
    )

    // ═══════════════════════ GROUPE : OUTILS ═════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('outils')
      .setDescription('🛠️ Outils d\'administration')

      .addSubcommand(s => s.setName('annonce').setDescription('Envoyer une annonce officielle dans un canal')
        .addChannelOption(o => o.setName('canal').setDescription('Canal cible').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Contenu de l\'annonce').setRequired(true))
        .addBooleanOption(o => o.setName('ping-everyone').setDescription('Mentionner @everyone').setRequired(false)))

      .addSubcommand(s => s.setName('dm').setDescription('Envoyer un message privé au nom du bot')
        .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('Contenu du message').setRequired(true)))

      .addSubcommand(s => s.setName('purge').setDescription('Supprimer des messages dans un canal')
        .addChannelOption(o => o.setName('canal').setDescription('Canal cible (par défaut : canal actuel)').setRequired(false)))

      .addSubcommand(s => s.setName('stats-serveur').setDescription('Statistiques détaillées du serveur'))

      .addSubcommand(s => s.setName('stats-eco').setDescription('Statistiques économiques du serveur'))

      .addSubcommand(s => s.setName('commande-perso').setDescription('Ajouter une commande personnalisée au bot')
        .addStringOption(o => o.setName('declencheur').setDescription('Mot ou phrase déclencheur').setRequired(true).setMaxLength(30))
        .addStringOption(o => o.setName('reponse').setDescription('Réponse du bot').setRequired(true).setMaxLength(500)))
    )

    // ═══════════════════════ GROUPE : SECURITE ════════════════════════════════
    .addSubcommandGroup(g => g
      .setName('securite')
      .setDescription('🔒 Sécurité et contrôle d\'accès')

      .addSubcommand(s => s.setName('blacklist').setDescription('Interdire l\'accès au bot à un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre à blacklister').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)))

      .addSubcommand(s => s.setName('unblacklist').setDescription('Lever le blacklist d\'un membre')
        .addUserOption(o => o.setName('membre').setDescription('Membre à retirer de la blacklist').setRequired(true)))

      .addSubcommand(s => s.setName('liste-blacklist').setDescription('Afficher tous les membres blacklistés'))

      .addSubcommand(s => s.setName('audit-log').setDescription('Consulter le journal des actions propriétaire'))

      .addSubcommand(s => s.setName('lockdown').setDescription('Activer ou désactiver le mode verrouillage du serveur')
        .addBooleanOption(o => o.setName('actif').setDescription('Activer le verrouillage').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison du verrouillage').setRequired(false)))
    ),

  // ═══════════════════════════════════════════════════════════════════════════
  // EXÉCUTION
  // ═══════════════════════════════════════════════════════════════════════════
  async execute(interaction) {
    // ── Vérification propriétaire ──────────────────────────────────────────
    if (!isOwner(interaction)) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [baseEmbed('🔐 Accès refusé', '#E74C3C')
          .setDescription('Cette commande est réservée exclusivement au propriétaire du serveur.')],
        ephemeral: true
      });
    }

    const sub   = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const cfg     = db.getConfig(guildId);
    const coin    = cfg.currency_emoji || '🪙';
    const now     = Math.floor(Date.now() / 1000);

    await interaction.deferReply({ ephemeral: true });

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE ECO
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'eco') {

      if (sub === 'donner') {
        const target  = interaction.options.getUser('membre');
        const montant = parseInt(interaction.options.getString('montant'));
        db.addCoins(target.id, guildId, montant);
        auditLog(guildId, userId, 'ECO_DONNER', target.id, `+${montant} coins`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Coins ajoutés', '#2ECC71')
            .addFields(
              { name: 'Membre', value: `<@${target.id}>`, inline: true },
              { name: 'Montant ajouté', value: `**+${montant.toLocaleString()} ${coin}**`, inline: true }
            )
        ]});
      }

      if (sub === 'retirer') {
        const target  = interaction.options.getUser('membre');
        const montant = parseInt(interaction.options.getString('montant'));
        db.addCoins(target.id, guildId, -montant);
        auditLog(guildId, userId, 'ECO_RETIRER', target.id, `-${montant} coins`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Coins retirés', '#E67E22')
            .addFields(
              { name: 'Membre', value: `<@${target.id}>`, inline: true },
              { name: 'Montant retiré', value: `**-${montant.toLocaleString()} ${coin}**`, inline: true }
            )
        ]});
      }

      if (sub === 'definir-solde') {
        const target  = interaction.options.getUser('membre');
        const montant = parseInt(interaction.options.getString('montant'));
        db.db.prepare('UPDATE users SET balance=? WHERE user_id=? AND guild_id=?').run(montant, target.id, guildId);
        auditLog(guildId, userId, 'ECO_DEFINIR_SOLDE', target.id, `solde → ${montant}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Solde défini', '#3498DB')
            .addFields(
              { name: 'Membre', value: `<@${target.id}>`, inline: true },
              { name: 'Nouveau solde', value: `**${montant.toLocaleString()} ${coin}**`, inline: true }
            )
        ]});
      }

      if (sub === 'donner-xp') {
        const target  = interaction.options.getUser('membre');
        const montant = parseInt(interaction.options.getString('montant'));
        db.db.prepare('UPDATE users SET xp=xp+? WHERE user_id=? AND guild_id=?').run(montant, target.id, guildId);
        auditLog(guildId, userId, 'ECO_DONNER_XP', target.id, `+${montant} XP`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ XP ajouté', '#9B59B6')
            .addFields(
              { name: 'Membre', value: `<@${target.id}>`, inline: true },
              { name: 'XP ajouté', value: `**+${montant.toLocaleString()} XP**`, inline: true }
            )
        ]});
      }

      if (sub === 'definir-niveau') {
        const target = interaction.options.getUser('membre');
        const niveau = parseInt(interaction.options.getString('niveau'));
        db.db.prepare('UPDATE users SET level=?, xp=0 WHERE user_id=? AND guild_id=?').run(niveau, target.id, guildId);
        auditLog(guildId, userId, 'ECO_DEFINIR_NIVEAU', target.id, `niveau → ${niveau}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Niveau défini', '#1ABC9C')
            .addFields(
              { name: 'Membre', value: `<@${target.id}>`, inline: true },
              { name: 'Nouveau niveau', value: `**Niveau ${niveau}**`, inline: true }
            )
        ]});
      }

      if (sub === 'reset-user') {
        const target = interaction.options.getUser('membre');
        db.db.prepare('UPDATE users SET balance=0, bank=0, xp=0, level=1, total_earned=0, streak=0 WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        auditLog(guildId, userId, 'ECO_RESET_USER', target.id, 'réinitialisation complète');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Profil réinitialisé', '#E74C3C')
            .setDescription(`Le profil économique de <@${target.id}> a été remis à zéro.`)
        ]});
      }

      if (sub === 'reset-serveur') {
        db.db.prepare('UPDATE users SET balance=0, bank=0, xp=0, level=1, total_earned=0, streak=0 WHERE guild_id=?').run(guildId);
        auditLog(guildId, userId, 'ECO_RESET_SERVEUR', null, 'réinitialisation globale');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('⚠️ Économie réinitialisée', '#E74C3C')
            .setDescription('L\'intégralité de l\'économie du serveur a été remise à zéro.')
        ]});
      }

      if (sub === 'info-user') {
        const target = interaction.options.getUser('membre');
        const u = db.db.prepare('SELECT * FROM users WHERE user_id=? AND guild_id=?').get(target.id, guildId);
        if (!u) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce membre n\'a pas encore de données.' });
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(`📋 Données — ${target.username}`)
            .addFields(
              { name: `${coin} Solde`, value: `${(u.balance||0).toLocaleString()}`, inline: true },
              { name: '🏦 Banque', value: `${(u.bank||0).toLocaleString()}`, inline: true },
              { name: '📊 Total gagné', value: `${(u.total_earned||0).toLocaleString()}`, inline: true },
              { name: '⚡ XP', value: `${(u.xp||0).toLocaleString()}`, inline: true },
              { name: '🏆 Niveau', value: `${u.level||1}`, inline: true },
              { name: '🔥 Streak', value: `${u.streak||0} jour(s)`, inline: true },
              { name: '💬 Messages', value: `${(u.message_count||0).toLocaleString()}`, inline: true },
              { name: '⭐ Réputation', value: `${u.reputation||0}`, inline: true },
              { name: '🎂 Anniversaire', value: u.birthday || 'Non défini', inline: true },
            )
            .setThumbnail(target.displayAvatarURL())
        ]});
      }

      if (sub === 'top-richesse') {
        const top = db.db.prepare('SELECT * FROM users WHERE guild_id=? ORDER BY balance+bank DESC LIMIT 15').all(guildId);
        if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun membre enregistré.' });
        const medals = ['🥇', '🥈', '🥉'];
        const lines = top.map((u, i) =>
          `${medals[i] || `**${i+1}.**`} <@${u.user_id}> — **${(u.balance+u.bank).toLocaleString()} ${coin}**`
        ).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('💰 Classement des richesses').setDescription(lines)
        ]});
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE CONFIG
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'config') {

      if (sub === 'monnaie') {
        const nom   = interaction.options.getString('nom');
        const emoji = interaction.options.getString('emoji');
        if (!nom && !emoji) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Indiquez au moins un paramètre (nom ou emoji).' });
        if (nom)   db.db.prepare('UPDATE guild_config SET currency_name=? WHERE guild_id=?').run(nom, guildId);
        if (emoji) db.db.prepare('UPDATE guild_config SET currency_emoji=? WHERE guild_id=?').run(emoji, guildId);
        auditLog(guildId, userId, 'CONFIG_MONNAIE', null, `nom=${nom} emoji=${emoji}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Monnaie mise à jour')
            .addFields(
              { name: 'Nom', value: nom || cfg.currency_name || 'Coins', inline: true },
              { name: 'Emoji', value: emoji || cfg.currency_emoji || '🪙', inline: true }
            )
        ]});
      }

      if (sub === 'daily') {
        const montant = interaction.options.getInteger('montant');
        db.db.prepare('UPDATE guild_config SET daily_amount=? WHERE guild_id=?').run(montant, guildId);
        auditLog(guildId, userId, 'CONFIG_DAILY', null, `montant=${montant}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Daily mis à jour')
            .addFields({ name: 'Nouveau montant', value: `**${montant.toLocaleString()} ${coin}**`, inline: true })
        ]});
      }

      if (sub === 'xp-multiplicateur') {
        const valeur = interaction.options.getNumber('valeur');
        db.db.prepare('UPDATE guild_config SET xp_multiplier=? WHERE guild_id=?').run(valeur, guildId);
        auditLog(guildId, userId, 'CONFIG_XP_MULT', null, `multiplicateur=${valeur}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Multiplicateur XP mis à jour')
            .addFields({ name: 'Nouveau multiplicateur', value: `**×${valeur}**`, inline: true })
        ]});
      }

      if (sub === 'coins-par-message') {
        const montant = interaction.options.getInteger('montant');
        db.db.prepare('UPDATE guild_config SET coins_per_msg=? WHERE guild_id=?').run(montant, guildId);
        auditLog(guildId, userId, 'CONFIG_COINS_MSG', null, `coins_per_msg=${montant}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Coins par message mis à jour')
            .addFields({ name: 'Coins par message', value: `**${montant} ${coin}**`, inline: true })
        ]});
      }

      if (sub === 'bienvenue') {
        const canal   = interaction.options.getChannel('canal');
        const message = interaction.options.getString('message');
        db.db.prepare('UPDATE guild_config SET welcome_channel=? WHERE guild_id=?').run(canal.id, guildId);
        if (message) db.db.prepare('UPDATE guild_config SET welcome_msg=? WHERE guild_id=?').run(message, guildId);
        auditLog(guildId, userId, 'CONFIG_WELCOME', canal.id, message);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Canal de bienvenue configuré')
            .addFields(
              { name: 'Canal', value: `<#${canal.id}>`, inline: true },
              { name: 'Message', value: message || cfg.welcome_msg || '(défaut)', inline: false }
            )
        ]});
      }

      if (sub === 'aurevoir') {
        const canal   = interaction.options.getChannel('canal');
        const message = interaction.options.getString('message');
        db.db.prepare('UPDATE guild_config SET leave_channel=? WHERE guild_id=?').run(canal.id, guildId);
        if (message) db.db.prepare('UPDATE guild_config SET leave_msg=? WHERE guild_id=?').run(message, guildId);
        auditLog(guildId, userId, 'CONFIG_LEAVE', canal.id, message);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Canal d\'au revoir configuré')
            .addFields({ name: 'Canal', value: `<#${canal.id}>`, inline: true })
        ]});
      }

      if (sub === 'logs') {
        const canal = interaction.options.getChannel('canal');
        db.db.prepare('UPDATE guild_config SET log_channel=? WHERE guild_id=?').run(canal.id, guildId);
        auditLog(guildId, userId, 'CONFIG_LOGS', canal.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Canal de logs configuré')
            .addFields({ name: 'Canal', value: `<#${canal.id}>`, inline: true })
        ]});
      }

      if (sub === 'logs-mod') {
        const canal = interaction.options.getChannel('canal');
        db.db.prepare('UPDATE guild_config SET mod_log_channel=? WHERE guild_id=?').run(canal.id, guildId);
        auditLog(guildId, userId, 'CONFIG_LOGS_MOD', canal.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Canal de logs de modération configuré')
            .addFields({ name: 'Canal', value: `<#${canal.id}>`, inline: true })
        ]});
      }

      if (sub === 'automod') {
        const actif = interaction.options.getBoolean('actif');
        db.db.prepare('UPDATE guild_config SET automod_enabled=? WHERE guild_id=?').run(actif ? 1 : 0, guildId);
        auditLog(guildId, userId, 'CONFIG_AUTOMOD', null, `actif=${actif}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(`✅ Automod ${actif ? 'activé' : 'désactivé'}`, actif ? '#2ECC71' : '#E74C3C')
        ]});
      }

      if (sub === 'autorole') {
        const role = interaction.options.getRole('role');
        db.db.prepare('UPDATE guild_config SET autorole=? WHERE guild_id=?').run(role.id, guildId);
        auditLog(guildId, userId, 'CONFIG_AUTOROLE', role.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Autorole configuré')
            .addFields({ name: 'Rôle', value: `<@&${role.id}>`, inline: true })
        ]});
      }

      if (sub === 'niveau-role') {
        const niveau = parseInt(interaction.options.getString('niveau'));
        const role   = interaction.options.getRole('role');
        try {
          db.db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?,?,?)').run(guildId, niveau, role.id);
          auditLog(guildId, userId, 'CONFIG_NIVEAU_ROLE', role.id, `niveau=${niveau}`);
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Rôle de niveau configuré')
              .addFields(
                { name: 'Niveau', value: `**${niveau}**`, inline: true },
                { name: 'Rôle', value: `<@&${role.id}>`, inline: true }
              )
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur lors de la configuration du rôle de niveau.' });
        }
      }

      if (sub === 'niveau-canal') {
        const canal = interaction.options.getChannel('canal');
        db.db.prepare('UPDATE guild_config SET level_channel=? WHERE guild_id=?').run(canal.id, guildId);
        auditLog(guildId, userId, 'CONFIG_NIVEAU_CANAL', canal.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Canal de niveau configuré')
            .addFields({ name: 'Canal', value: `<#${canal.id}>`, inline: true })
        ]});
      }

      if (sub === 'starboard') {
        const canal  = interaction.options.getChannel('canal');
        const seuil  = parseInt(interaction.options.getString('seuil'));
        db.db.prepare('UPDATE guild_config SET starboard_channel=? WHERE guild_id=?').run(canal.id, guildId);
        if (seuil) db.db.prepare('UPDATE guild_config SET starboard_threshold=? WHERE guild_id=?').run(seuil, guildId);
        auditLog(guildId, userId, 'CONFIG_STARBOARD', canal.id, `seuil=${seuil}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Starboard configuré')
            .addFields(
              { name: 'Canal', value: `<#${canal.id}>`, inline: true },
              { name: 'Seuil', value: `**${seuil || cfg.starboard_threshold || 3} ⭐**`, inline: true }
            )
        ]});
      }

      if (sub === 'voir') {
        const freshCfg = db.getConfig(guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('⚙️ Configuration du serveur')
            .addFields(
              { name: '💰 Monnaie', value: `${freshCfg.currency_emoji || '🪙'} ${freshCfg.currency_name || 'Coins'}`, inline: true },
              { name: '📅 Daily', value: `${(freshCfg.daily_amount||200).toLocaleString()} ${freshCfg.currency_emoji||'🪙'}`, inline: true },
              { name: '⚡ Multiplicateur XP', value: `×${freshCfg.xp_multiplier || 1}`, inline: true },
              { name: '💬 Coins/message', value: `${freshCfg.coins_per_msg || 5}`, inline: true },
              { name: '👋 Bienvenue', value: freshCfg.welcome_channel ? `<#${freshCfg.welcome_channel}>` : 'Non configuré', inline: true },
              { name: '🚪 Au revoir', value: freshCfg.leave_channel ? `<#${freshCfg.leave_channel}>` : 'Non configuré', inline: true },
              { name: '📋 Logs', value: freshCfg.log_channel ? `<#${freshCfg.log_channel}>` : 'Non configuré', inline: true },
              { name: '🔨 Logs mod', value: freshCfg.mod_log_channel ? `<#${freshCfg.mod_log_channel}>` : 'Non configuré', inline: true },
              { name: '🛡️ Automod', value: freshCfg.automod_enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
              { name: '🎭 Autorole', value: freshCfg.autorole ? `<@&${freshCfg.autorole}>` : 'Non configuré', inline: true },
              { name: '⭐ Starboard', value: freshCfg.starboard_channel ? `<#${freshCfg.starboard_channel}> (${freshCfg.starboard_threshold}⭐)` : 'Non configuré', inline: true },
            )
        ]});
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE BOUTIQUE
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'boutique') {

      if (sub === 'ajouter') {
        const nom       = interaction.options.getString('nom');
        const prix      = interaction.options.getInteger('prix');
        const desc      = interaction.options.getString('description');
        const emoji     = interaction.options.getString('emoji') || '📦';
        const role      = interaction.options.getRole('role');
        const stock     = interaction.options.getInteger('stock') ?? -1;

        const result = db.db.prepare(
          'INSERT INTO shop_items (guild_id, name, description, emoji, price, stock, role_id) VALUES (?,?,?,?,?,?,?)'
        ).run(guildId, nom, desc, emoji, prix, stock, role?.id || null);

        auditLog(guildId, userId, 'BOUTIQUE_AJOUTER', String(result.lastInsertRowid), nom);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Article ajouté à la boutique', '#2ECC71')
            .addFields(
              { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
              { name: 'Article', value: `${emoji} ${nom}`, inline: true },
              { name: 'Prix', value: `**${prix.toLocaleString()} ${coin}**`, inline: true },
              { name: 'Stock', value: stock === -1 ? 'Illimité' : `${stock}`, inline: true },
              { name: 'Rôle', value: role ? `<@&${role.id}>` : 'Aucun', inline: true }
            )
        ]});
      }

      if (sub === 'supprimer') {
        const id = parseInt(interaction.options.getString('id'));
        const item = db.db.prepare('SELECT * FROM shop_items WHERE id=? AND guild_id=?').get(id, guildId);
        if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.` });
        db.db.prepare('DELETE FROM shop_items WHERE id=?').run(id);
        auditLog(guildId, userId, 'BOUTIQUE_SUPPRIMER', String(id), item.name);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Article supprimé', '#E74C3C')
            .setDescription(`**${item.emoji} ${item.name}** (ID #${id}) a été supprimé de la boutique.`)
        ]});
      }

      if (sub === 'modifier-prix') {
        const id   = parseInt(interaction.options.getString('id'));
        const prix = interaction.options.getInteger('prix');
        const item = db.db.prepare('SELECT * FROM shop_items WHERE id=? AND guild_id=?').get(id, guildId);
        if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.` });
        db.db.prepare('UPDATE shop_items SET price=? WHERE id=?').run(prix, id);
        auditLog(guildId, userId, 'BOUTIQUE_PRIX', String(id), `${item.price} → ${prix}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Prix mis à jour')
            .addFields(
              { name: 'Article', value: `${item.emoji} ${item.name}`, inline: true },
              { name: 'Nouveau prix', value: `**${prix.toLocaleString()} ${coin}**`, inline: true }
            )
        ]});
      }

      if (sub === 'modifier-stock') {
        const id    = parseInt(interaction.options.getString('id'));
        const stock = interaction.options.getInteger('stock');
        const item  = db.db.prepare('SELECT * FROM shop_items WHERE id=? AND guild_id=?').get(id, guildId);
        if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.` });
        db.db.prepare('UPDATE shop_items SET stock=? WHERE id=?').run(stock, id);
        auditLog(guildId, userId, 'BOUTIQUE_STOCK', String(id), `stock → ${stock}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Stock mis à jour')
            .addFields(
              { name: 'Article', value: `${item.emoji} ${item.name}`, inline: true },
              { name: 'Nouveau stock', value: stock === -1 ? 'Illimité' : `${stock}`, inline: true }
            )
        ]});
      }

      if (sub === 'activer') {
        const id    = parseInt(interaction.options.getString('id'));
        const actif = interaction.options.getBoolean('actif');
        const item  = db.db.prepare('SELECT * FROM shop_items WHERE id=? AND guild_id=?').get(id, guildId);
        if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.` });
        db.db.prepare('UPDATE shop_items SET active=? WHERE id=?').run(actif ? 1 : 0, id);
        auditLog(guildId, userId, 'BOUTIQUE_ACTIVER', String(id), `actif=${actif}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(`✅ Article ${actif ? 'activé' : 'désactivé'}`, actif ? '#2ECC71' : '#95A5A6')
            .setDescription(`**${item.emoji} ${item.name}** est maintenant ${actif ? 'disponible' : 'masqué'} dans la boutique.`)
        ]});
      }

      if (sub === 'liste') {
        const items = db.db.prepare('SELECT * FROM shop_items WHERE guild_id=? ORDER BY active DESC, price ASC').all(guildId);
        if (!items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ La boutique est vide.' });
        const lines = items.map(i =>
          `${i.active ? '✅' : '❌'} **#${i.id}** ${i.emoji} ${i.name} — **${i.price.toLocaleString()} ${coin}** ${i.stock === -1 ? '' : `(stock: ${i.stock})`}`
        ).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('🏪 Articles de la boutique').setDescription(lines.substring(0, 4000))
        ]});
      }

      if (sub === 'vider') {
        const count = db.db.prepare('SELECT COUNT(*) as c FROM shop_items WHERE guild_id=?').get(guildId).c;
        db.db.prepare('DELETE FROM shop_items WHERE guild_id=?').run(guildId);
        auditLog(guildId, userId, 'BOUTIQUE_VIDER', null, `${count} articles supprimés`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Boutique vidée', '#E74C3C')
            .setDescription(`**${count}** article(s) ont été supprimés.`)
        ]});
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE EVENTS
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'events') {

      if (sub === 'creer') {
        const nom    = interaction.options.getString('nom');
        const type   = interaction.options.getString('type');
        const duree  = parseInt(interaction.options.getString('duree'));
        const endsAt = now + (duree * 3600);

        // Vérification table eco_events
        try {
          db.db.prepare(`CREATE TABLE IF NOT EXISTS eco_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT, name TEXT, type TEXT,
            active INTEGER DEFAULT 1,
            ends_at INTEGER,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )`).run();
        } catch {}

        const result = db.db.prepare(
          'INSERT INTO eco_events (guild_id, name, type, ends_at) VALUES (?,?,?,?)'
        ).run(guildId, nom, type, endsAt);

        const typeLabels = {
          double_coins: '💎 Double Coins',
          triple_xp:    '⚡ Triple XP',
          double_daily: '📅 Double Daily',
          msg_bonus:    '💬 Bonus Messages',
          jackpot:      '🎰 Jackpot ×5',
        };

        auditLog(guildId, userId, 'EVENT_CREER', String(result.lastInsertRowid), `${type} ${duree}h`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('🎉 Événement créé', '#F1C40F')
            .addFields(
              { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
              { name: 'Nom', value: nom, inline: true },
              { name: 'Type', value: typeLabels[type] || type, inline: true },
              { name: 'Durée', value: `${duree} heure(s)`, inline: true },
              { name: 'Fin', value: `<t:${endsAt}:R>`, inline: true }
            )
        ]});
      }

      if (sub === 'terminer') {
        const id = parseInt(interaction.options.getString('id'));
        try {
          const ev = db.db.prepare('SELECT * FROM eco_events WHERE id=? AND guild_id=?').get(id, guildId);
          if (!ev) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Événement #${id} introuvable.` });
          db.db.prepare('UPDATE eco_events SET active=0 WHERE id=?').run(id);
          auditLog(guildId, userId, 'EVENT_TERMINER', String(id), ev.name);
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Événement terminé', '#95A5A6')
              .setDescription(`L'événement **${ev.name}** a été mis fin.`)
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur : table d\'événements introuvable.' });
        }
      }

      if (sub === 'liste') {
        try {
          const events = db.db.prepare('SELECT * FROM eco_events WHERE guild_id=? AND active=1 ORDER BY ends_at ASC').all(guildId);
          if (!events.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun événement actif.' });
          const lines = events.map(e => `**#${e.id}** **${e.name}** — \`${e.type}\` — Fin : <t:${e.ends_at}:R>`).join('\n');
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('🎉 Événements actifs').setDescription(lines)
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun événement enregistré.' });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE BOT
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'bot') {

      if (sub === 'statut') {
        const type = interaction.options.getString('type');
        await interaction.client.user.setStatus(type);
        auditLog(guildId, userId, 'BOT_STATUT', null, type);
        const labels = { online: '🟢 En ligne', idle: '🟡 Absent', dnd: '🔴 Ne pas déranger', invisible: '⚫ Invisible' };
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Statut mis à jour').addFields({ name: 'Nouveau statut', value: labels[type], inline: true })
        ]});
      }

      if (sub === 'activite') {
        const type  = interaction.options.getString('type');
        const texte = interaction.options.getString('texte');
        const typeMap = {
          PLAYING:   ActivityType.Playing,
          WATCHING:  ActivityType.Watching,
          LISTENING: ActivityType.Listening,
          COMPETING: ActivityType.Competing,
        };
        await interaction.client.user.setActivity(texte, { type: typeMap[type] });
        auditLog(guildId, userId, 'BOT_ACTIVITE', null, `${type}: ${texte}`);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Activité mise à jour')
            .addFields(
              { name: 'Type', value: type, inline: true },
              { name: 'Texte', value: texte, inline: true }
            )
        ]});
      }

      if (sub === 'pseudo') {
        const nom = interaction.options.getString('nom') || null;
        try {
          await interaction.guild.members.me.setNickname(nom);
          auditLog(guildId, userId, 'BOT_PSEUDO', null, nom || 'réinitialisation');
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Pseudo mis à jour')
              .addFields({ name: 'Pseudo', value: nom || interaction.client.user.username, inline: true })
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de modifier le pseudo. Vérifiez les permissions.' });
        }
      }

      if (sub === 'info') {
        const client = interaction.client;
        const guilds = client.guilds.cache.size;
        const users  = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
        const uptime = Math.floor(client.uptime / 1000);
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = uptime % 60;
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('🤖 Informations — NexusBot')
            .addFields(
              { name: '🏷️ Version Discord.js', value: require('discord.js').version, inline: true },
              { name: '📦 Node.js', value: process.version, inline: true },
              { name: '🖥️ Mémoire RAM', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true },
              { name: '🌐 Serveurs', value: `${guilds}`, inline: true },
              { name: '👥 Utilisateurs', value: `${users.toLocaleString()}`, inline: true },
              { name: '⏱️ Uptime', value: `${h}h ${m}m ${s}s`, inline: true },
            )
        ]});
      }

      if (sub === 'ping') {
        const ws = interaction.client.ws.ping;
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('🏓 Latence du bot')
            .addFields({ name: 'WebSocket', value: `**${ws}ms**`, inline: true })
        ]});
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE OUTILS
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'outils') {

      if (sub === 'annonce') {
        const canal   = interaction.options.getChannel('canal');
        const message = interaction.options.getString('message');
        const ping    = interaction.options.getBoolean('ping-everyone') || false;

        const targetChannel = interaction.guild.channels.cache.get(canal.id);
        if (!targetChannel) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Canal introuvable.' });

        await targetChannel.send({
          content: ping ? '@everyone' : undefined,
          embeds: [
            new EmbedBuilder()
              .setColor(cfg.color || '#7B2FBE')
              .setTitle('📢 Annonce')
              .setDescription(message)
              .setFooter({ text: `Envoyé par ${interaction.user.username}` })
              .setTimestamp()
          ]
        });

        auditLog(guildId, userId, 'OUTILS_ANNONCE', canal.id, message.substring(0, 100));
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Annonce envoyée').addFields({ name: 'Canal', value: `<#${canal.id}>`, inline: true })
        ]});
      }

      if (sub === 'dm') {
        const target  = interaction.options.getUser('membre');
        const message = interaction.options.getString('message');
        try {
          await target.send({
            embeds: [
              new EmbedBuilder()
                .setColor(cfg.color || '#7B2FBE')
                .setTitle(`📩 Message de ${interaction.guild.name}`)
                .setDescription(message)
                .setTimestamp()
            ]
          });
          auditLog(guildId, userId, 'OUTILS_DM', target.id, message.substring(0, 100));
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Message privé envoyé').addFields({ name: 'Destinataire', value: `<@${target.id}>`, inline: true })
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible d\'envoyer le message. Le membre a peut-être désactivé ses messages privés.' });
        }
      }

      if (sub === 'purge') {
        const nombre  = parseInt(interaction.options.getString('nombre'));
        const canalOp = interaction.options.getChannel('canal');
        const channel = canalOp ? interaction.guild.channels.cache.get(canalOp.id) : interaction.channel;

        try {
          const deleted = await channel.bulkDelete(nombre, true);
          auditLog(guildId, userId, 'OUTILS_PURGE', channel.id, `${deleted.size} messages`);
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Messages supprimés', '#E74C3C')
              .addFields(
                { name: 'Supprimés', value: `**${deleted.size}**`, inline: true },
                { name: 'Canal', value: `<#${channel.id}>`, inline: true }
              )
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de supprimer les messages. Les messages de plus de 14 jours ne peuvent pas être supprimés en masse.' });
        }
      }

      if (sub === 'stats-serveur') {
        const guild = interaction.guild;
        await guild.members.fetch();
        const total   = guild.memberCount;
        const bots    = guild.members.cache.filter(m => m.user.bot).size;
        const humains = total - bots;
        const channels = guild.channels.cache;
        const texte   = channels.filter(c => c.type === 0).size;
        const vocal   = channels.filter(c => c.type === 2).size;
        const roles   = guild.roles.cache.size - 1;

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(`📊 Statistiques — ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
              { name: '👥 Membres', value: `${humains.toLocaleString()} humains + ${bots} bots`, inline: false },
              { name: '💬 Canaux texte', value: `${texte}`, inline: true },
              { name: '🔊 Canaux vocaux', value: `${vocal}`, inline: true },
              { name: '🎭 Rôles', value: `${roles}`, inline: true },
              { name: '📅 Création', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
              { name: '🪄 Niveau boost', value: `${guild.premiumTier}`, inline: true },
              { name: '⭐ Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
            )
        ]});
      }

      if (sub === 'stats-eco') {
        const totalUsers  = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId).c;
        const totalCoins  = db.db.prepare('SELECT SUM(balance+bank) as s FROM users WHERE guild_id=?').get(guildId).s || 0;
        const totalEarned = db.db.prepare('SELECT SUM(total_earned) as s FROM users WHERE guild_id=?').get(guildId).s || 0;
        const shopItems   = db.db.prepare('SELECT COUNT(*) as c FROM shop_items WHERE guild_id=? AND active=1').get(guildId).c;
        const richest     = db.db.prepare('SELECT user_id, balance+bank as total FROM users WHERE guild_id=? ORDER BY total DESC LIMIT 1').get(guildId);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('💰 Statistiques économiques')
            .addFields(
              { name: '👥 Membres enregistrés', value: `${totalUsers.toLocaleString()}`, inline: true },
              { name: `${coin} Coins en circulation`, value: totalCoins.toLocaleString(), inline: true },
              { name: '📈 Total distribué', value: totalEarned.toLocaleString(), inline: true },
              { name: '🏪 Articles en boutique', value: `${shopItems}`, inline: true },
              { name: '🏆 Membre le plus riche', value: richest ? `<@${richest.user_id}> — ${richest.total.toLocaleString()} ${coin}` : 'Aucun', inline: false },
            )
        ]});
      }

      if (sub === 'commande-perso') {
        const declencheur = interaction.options.getString('declencheur').toLowerCase();
        const reponse     = interaction.options.getString('reponse');
        try {
          db.db.prepare('INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, created_by) VALUES (?,?,?,?)').run(guildId, declencheur, reponse, userId);
          auditLog(guildId, userId, 'OUTILS_CMD_PERSO', declencheur, reponse.substring(0, 100));
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('✅ Commande personnalisée créée', '#2ECC71')
              .addFields(
                { name: 'Déclencheur', value: `\`${declencheur}\``, inline: true },
                { name: 'Réponse', value: reponse.substring(0, 200), inline: false }
              )
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Erreur lors de la création de la commande.' });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // GROUPE SECURITE
    // ══════════════════════════════════════════════════════════════════════
    if (group === 'securite') {

      if (sub === 'blacklist') {
        const target = interaction.options.getUser('membre');
        const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée';
        if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous blacklister vous-même.' });
        try {
          db.db.prepare('INSERT OR REPLACE INTO nexus_blacklist (guild_id, user_id, reason, banned_by) VALUES (?,?,?,?)').run(guildId, target.id, raison, userId);
          auditLog(guildId, userId, 'SECURITE_BLACKLIST', target.id, raison);
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
            baseEmbed('🚫 Membre blacklisté', '#E74C3C')
              .addFields(
                { name: 'Membre', value: `<@${target.id}>`, inline: true },
                { name: 'Raison', value: raison, inline: false }
              )
          ]});
        } catch {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce membre est déjà blacklisté.' });
        }
      }

      if (sub === 'unblacklist') {
        const target = interaction.options.getUser('membre');
        const result = db.db.prepare('DELETE FROM nexus_blacklist WHERE guild_id=? AND user_id=?').run(guildId, target.id);
        if (!result.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce membre n\'est pas blacklisté.' });
        auditLog(guildId, userId, 'SECURITE_UNBLACKLIST', target.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('✅ Blacklist levée', '#2ECC71')
            .setDescription(`<@${target.id}> peut à nouveau utiliser NexusBot.`)
        ]});
      }

      if (sub === 'liste-blacklist') {
        const list = db.db.prepare('SELECT * FROM nexus_blacklist WHERE guild_id=? ORDER BY created_at DESC').all(guildId);
        if (!list.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [baseEmbed('✅ Blacklist vide').setDescription('Aucun membre blacklisté.')]});
        const lines = list.map((b, i) =>
          `**${i+1}.** <@${b.user_id}> — ${b.reason} — <t:${b.created_at}:D>`
        ).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed('🚫 Membres blacklistés').setDescription(lines.substring(0, 4000))
        ]});
      }

      if (sub === 'audit-log') {
        const limite = parseInt(interaction.options.getString('limite')) || 15;
        const logs = db.db.prepare('SELECT * FROM nexus_audit_log WHERE guild_id=? ORDER BY created_at DESC LIMIT ?').all(guildId, limite);
        if (!logs.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune action enregistrée.' });
        const lines = logs.map(l => {
          const d = `<t:${l.created_at}:R>`;
          const target = l.target ? ` → \`${l.target}\`` : '';
          const details = l.details ? ` (${l.details})` : '';
          return `${d} **${l.action}**${target}${details}`;
        }).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(`📋 Journal des actions (${logs.length})`)
            .setDescription(lines.substring(0, 4000))
        ]});
      }

      if (sub === 'lockdown') {
        const actif  = interaction.options.getBoolean('actif');
        const raison = interaction.options.getString('raison') || 'Maintenance en cours.';

        const channels = interaction.guild.channels.cache.filter(c => c.type === 0);
        let count = 0;

        for (const [, channel] of channels) {
          try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: actif ? false : null
            });
            count++;
          } catch {}
        }

        auditLog(guildId, userId, actif ? 'SECURITE_LOCKDOWN_ON' : 'SECURITE_LOCKDOWN_OFF', null, raison);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          baseEmbed(actif ? '🔒 Serveur verrouillé' : '🔓 Verrouillage levé', actif ? '#E74C3C' : '#2ECC71')
            .addFields(
              { name: 'Canaux affectés', value: `${count}`, inline: true },
              { name: 'Raison', value: raison, inline: false }
            )
        ]});
      }
    }
  }
};
