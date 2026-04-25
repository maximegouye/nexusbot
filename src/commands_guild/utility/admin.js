/**
 * NexusBot — Panneau d'administration complet
 * /admin — Gérer la monnaie, l'XP, les utilisateurs, les sanctions et le serveur
 * Accessible uniquement aux administrateurs du serveur
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// ─── Vérification admin ────────────────────────────────────────────────────
function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
         member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function isMod(member) {
  return isAdmin(member) || member.permissions.has(PermissionFlagsBits.ModerateMembers);
}

// ─── Helpers visuels ──────────────────────────────────────────────────────
function progressBar(current, max, length = 15) {
  const filled = Math.min(length, Math.round((current / max) * length));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
function formatNum(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}
function tsAgo(ts) {
  if (!ts) return 'Jamais';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)   return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff/60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff/3600)}h`;
  return `il y a ${Math.floor(diff/86400)}j`;
}

// ─── Blacklist économie (table créée ici) ─────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS eco_blacklist (
    guild_id TEXT, user_id TEXT, reason TEXT DEFAULT '',
    added_by TEXT, added_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (guild_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-eco')
    .setDescription('🛡️ Panneau d\'administration complet de NexusBot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ╔══════════════════════════════╗
    // ║  GROUPE : MONNAIE            ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('monnaie')
      .setDescription('💰 Gérer la monnaie des joueurs')
      .addSubcommand(s => s
        .setName('donner')
        .setDescription('💰 Donner des coins à un joueur (aucune limite)')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Montant (nombre, all, 50%) — ILLIMITÉ').setRequired(true).setMaxLength(30))
        .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setMaxLength(200)))
      .addSubcommand(s => s
        .setName('retirer')
        .setDescription('💸 Retirer des coins à un joueur (aucune limite)')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Montant (nombre, all, 50%) — ILLIMITÉ').setRequired(true).setMaxLength(30))
        .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setMaxLength(200)))
      .addSubcommand(s => s
        .setName('definir')
        .setDescription('🔧 Définir exactement le solde d\'un joueur (aucune limite)')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Nouveau solde (nombre, underscores OK) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('reset')
        .setDescription('🗑️ Remettre à zéro le solde d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('reset_total')
        .setDescription('☢️ Remettre à zéro TOUTE l\'économie du serveur')
        .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER pour valider').setRequired(true)))
      .addSubcommand(s => s
        .setName('banque_definir')
        .setDescription('🏦 Définir le solde bancaire d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Nouveau solde bancaire (nombre) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('voir')
        .setDescription('👁️ Voir le solde complet d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : XP & NIVEAUX       ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('xp')
      .setDescription('⭐ Gérer l\'XP et les niveaux des joueurs')
      .addSubcommand(s => s
        .setName('donner')
        .setDescription('⭐ Donner de l\'XP à un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('XP à donner (ILLIMITÉ)').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('retirer')
        .setDescription('💔 Retirer de l\'XP à un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('XP à retirer (ILLIMITÉ)').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('definir')
        .setDescription('🔧 Définir l\'XP exact d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Nouvel XP (ILLIMITÉ)').setRequired(true).setMaxLength(30)))
      .addSubcommand(s => s
        .setName('niveau_definir')
        .setDescription('🏆 Définir le niveau d\'un joueur directement')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('niveau').setDescription('Nouveau niveau (ILLIMITÉ)').setRequired(true).setMaxLength(10)))
      .addSubcommand(s => s
        .setName('reset')
        .setDescription('🗑️ Remettre à zéro l\'XP et le niveau d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('reset_serveur')
        .setDescription('☢️ Remettre à zéro tout l\'XP du serveur')
        .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER pour valider').setRequired(true)))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : UTILISATEURS       ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('utilisateur')
      .setDescription('👤 Gérer les profils des utilisateurs')
      .addSubcommand(s => s
        .setName('info')
        .setDescription('📊 Fiche complète d\'un joueur (admin view)')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('reset_profil')
        .setDescription('🗑️ Réinitialiser tout le profil d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER pour valider').setRequired(true)))
      .addSubcommand(s => s
        .setName('blacklist')
        .setDescription('🚫 Blacklister un joueur de l\'économie')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('raison').setDescription('Raison').setMaxLength(200)))
      .addSubcommand(s => s
        .setName('unblacklist')
        .setDescription('✅ Retirer un joueur de la blacklist')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('reputation_definir')
        .setDescription('⭐ Définir la réputation d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('montant').setDescription('Nouvelle réputation (nombre, peut être négatif)').setRequired(true).setMaxLength(30)))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : SERVEUR            ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('serveur')
      .setDescription('📊 Statistiques et gestion du serveur')
      .addSubcommand(s => s
        .setName('stats')
        .setDescription('📊 Statistiques globales du serveur'))
      .addSubcommand(s => s
        .setName('circulation')
        .setDescription('💰 Total de monnaie en circulation'))
      .addSubcommand(s => s
        .setName('top_richesse')
        .setDescription('🏆 Top 10 des joueurs les plus riches'))
      .addSubcommand(s => s
        .setName('top_xp')
        .setDescription('⭐ Top 10 des joueurs avec le plus d\'XP'))
      .addSubcommand(s => s
        .setName('activite')
        .setDescription('📈 Rapport d\'activité du serveur (7 jours)'))
    )

    // ╔══════════════════════════════╗
    // ║  GROUPE : ITEMS              ║
    // ╚══════════════════════════════╝
    .addSubcommandGroup(g => g
      .setName('items')
      .setDescription('🎒 Gérer les inventaires des joueurs')
      .addSubcommand(s => s
        .setName('donner')
        .setDescription('🎁 Donner un item à un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('retirer')
        .setDescription('❌ Retirer un item d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
      .addSubcommand(s => s
        .setName('vider')
        .setDescription('🗑️ Vider tout l\'inventaire d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true))
        .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER pour valider').setRequired(true)))
      .addSubcommand(s => s
        .setName('voir')
        .setDescription('📋 Voir l\'inventaire complet d\'un joueur')
        .addUserOption(o => o.setName('joueur').setDescription('Joueur cible').setRequired(true)))
    ),

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTE
  // ═══════════════════════════════════════════════════════════════════════════
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const group = interaction.options.getSubcommandGroup();
    const sub   = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const adminId = interaction.user.id;

    // Vérif permissions
    if (!isAdmin(interaction.member)) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous devez être **administrateur** pour utiliser ce panneau.', ephemeral: true });
    }

    const cfg  = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const coinName = cfg.currency_name || 'Coins';

    // ════════════════════════════════════════
    // MONNAIE
    // ════════════════════════════════════════
    if (group === 'monnaie') {
      const target = interaction.options.getUser('joueur');
      // Parse le montant en String pour accepter tout (nombre, underscores, raccourcis, BigInt-compatible)
      const parseAmount = (raw, base) => {
        if (raw == null) return 0;
        const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
        if (!s) return 0;
        if (s === 'all' || s === 'tout' || s === 'max') return Number(base || 0);
        if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
        const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
        if (!m) return NaN;
        const n = parseFloat(m[1]);
        if (!isFinite(n) || n < 0) return NaN;
        if (m[2] === '%') return Math.floor(Number(base || 0) * Math.min(100, n) / 100);
        return Math.floor(n);
      };
      const rawMontant = interaction.options.getString('montant') ?? interaction.options.get('montant')?.value;
      const targetUser = db.getUser(target.id, guildId);
      const base = sub === 'retirer' ? targetUser.balance : (sub === 'banque_definir' ? targetUser.bank : targetUser.balance);
      const amount = parseAmount(rawMontant, base);
      if (!isFinite(amount) || amount < 0 || isNaN(amount)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Montant invalide. Accepte : nombres (500, 1_000_000_000), `all`, `50%`, `moitié`.', ephemeral: true });
      }
      const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée';

      if (sub === 'donner') {
        // Vérifie blacklist
        const bl = db.db.prepare('SELECT 1 FROM eco_blacklist WHERE guild_id=? AND user_id=?').get(guildId, target.id);
        if (bl) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** est blacklisté de l\'économie.`, ephemeral: true });

        db.addCoins(target.id, guildId, amount);
        const u = db.getUser(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle(`${coin} Coins donnés`)
          .addFields(
            { name: '👤 Joueur',      value: `<@${target.id}>`, inline: true },
            { name: '💰 Montant',     value: `+**${formatNum(amount)}** ${coin}`, inline: true },
            { name: '🏦 Nouveau solde', value: `${formatNum(u.balance)} ${coin}`, inline: true },
            { name: '📝 Raison',      value: raison, inline: false },
          )
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'retirer') {
        const u = db.getUser(target.id, guildId);
        const avail = u.balance || 0;
        const realAmount = Math.min(amount, avail);
        db.removeCoins(target.id, guildId, realAmount);
        const u2 = db.getUser(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle(`${coin} Coins retirés`)
          .addFields(
            { name: '👤 Joueur',       value: `<@${target.id}>`, inline: true },
            { name: '💸 Montant',      value: `-**${formatNum(realAmount)}** ${coin}`, inline: true },
            { name: '🏦 Nouveau solde', value: `${formatNum(u2.balance)} ${coin}`, inline: true },
            { name: '📝 Raison',       value: raison, inline: false },
          )
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'definir') {
        db.db.prepare('UPDATE users SET balance=? WHERE user_id=? AND guild_id=?').run(amount, target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setTitle(`${coin} Solde défini`)
          .setDescription(`Le solde de <@${target.id}> a été défini à **${formatNum(amount)} ${coin}**.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'reset') {
        db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95A5A6')
          .setDescription(`🗑️ L\'économie de <@${target.id}> a été remise à **zéro** (solde + banque + historique).`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'reset_total') {
        const confirm = interaction.options.getString('confirmation');
        if (confirm !== 'CONFIRMER') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous devez taper exactement **CONFIRMER** pour valider cette action dangereuse.', ephemeral: true });
        const count = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId);
        db.db.prepare('UPDATE users SET balance=0, bank=0, total_earned=0 WHERE guild_id=?').run(guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('☢️ Économie réinitialisée')
          .setDescription(`L\'économie de **${count.c} joueurs** a été remise à zéro.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'banque_definir') {
        db.db.prepare('UPDATE users SET bank=? WHERE user_id=? AND guild_id=?').run(amount, target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setDescription(`🏦 La banque de <@${target.id}> a été définie à **${formatNum(amount)} ${coin}**.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'voir') {
        const u = db.getUser(target.id, guildId);
        const bl = db.db.prepare('SELECT * FROM eco_blacklist WHERE guild_id=? AND user_id=?').get(guildId, target.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle(`💰 Fiche économique — ${target.username}`)
          .addFields(
            { name: '👛 Portefeuille',  value: `${formatNum(u.balance)} ${coin}`,  inline: true },
            { name: '🏦 Banque',        value: `${formatNum(u.bank)} ${coin}`,     inline: true },
            { name: '💎 Total gagné',   value: `${formatNum(u.total_earned)} ${coin}`, inline: true },
            { name: '📅 Daily',         value: tsAgo(u.last_daily), inline: true },
            { name: '💼 Travail',       value: tsAgo(u.last_work),  inline: true },
            { name: '🚫 Blacklist',     value: bl ? `Oui — ${bl.reason}` : 'Non', inline: true },
          )
          .setThumbnail(target.displayAvatarURL())
          .setFooter({ text: `ID: ${target.id}` })], ephemeral: true });
      }
    }

    // ════════════════════════════════════════
    // XP
    // ════════════════════════════════════════
    if (group === 'xp') {
      const target = interaction.options.getUser('joueur');
      const parseXP = (raw) => {
        if (raw == null) return NaN;
        const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
        if (!s) return NaN;
        const m = s.match(/^(-?\d+(?:\.\d+)?)$/);
        if (!m) return NaN;
        return Math.floor(parseFloat(m[1]));
      };
      const rawAmount = interaction.options.getString('montant') ?? interaction.options.get('montant')?.value;
      const amount = parseXP(rawAmount);
      if (sub !== 'reset' && sub !== 'reset_serveur' && sub !== 'niveau_definir' && (!Number.isFinite(amount) || isNaN(amount))) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Montant XP invalide. Accepte : nombres (500, 1_000_000_000).', ephemeral: true });
      }

      if (sub === 'donner') {
        db.db.prepare('UPDATE users SET xp = xp + ? WHERE user_id=? AND guild_id=?').run(amount, target.id, guildId);
        const u = db.getUser(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle('⭐ XP donné')
          .addFields(
            { name: '👤 Joueur',   value: `<@${target.id}>`, inline: true },
            { name: '⭐ Montant',  value: `+**${formatNum(amount)}** XP`, inline: true },
            { name: '🏆 XP total', value: `${formatNum(u.xp)} XP (Nv.${u.level})`, inline: true },
          )
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'retirer') {
        db.db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE user_id=? AND guild_id=?').run(amount, target.id, guildId);
        const u = db.getUser(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('💔 XP retiré')
          .addFields(
            { name: '👤 Joueur',   value: `<@${target.id}>`, inline: true },
            { name: '⭐ Montant',  value: `-**${formatNum(amount)}** XP`, inline: true },
            { name: '🏆 XP total', value: `${formatNum(u.xp)} XP (Nv.${u.level})`, inline: true },
          )
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'definir') {
        db.db.prepare('UPDATE users SET xp=? WHERE user_id=? AND guild_id=?').run(amount, target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setDescription(`⭐ L\'XP de <@${target.id}> a été défini à **${formatNum(amount)} XP**.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'niveau_definir') {
        const rawNiveau = interaction.options.getString('niveau') ?? interaction.options.get('niveau')?.value;
        const niveau = Math.max(1, Math.floor(Number(String(rawNiveau).replace(/[\s_,]/g, ''))) || 1);
        // Calcule l'XP minimum pour ce niveau
        const xpNeeded = db.getXPForLevel ? db.getXPForLevel(niveau) : Math.floor(100 * Math.pow(1.35, niveau - 1));
        db.db.prepare('UPDATE users SET level=?, xp=? WHERE user_id=? AND guild_id=?').run(niveau, xpNeeded, target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle('🏆 Niveau défini')
          .setDescription(`<@${target.id}> est maintenant **Niveau ${niveau}** (${formatNum(xpNeeded)} XP).`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'reset') {
        db.db.prepare('UPDATE users SET xp=0, level=1, voice_xp=0 WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95A5A6')
          .setDescription(`🗑️ L\'XP de <@${target.id}> a été remis à zéro (Niveau 1).`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'reset_serveur') {
        const confirm = interaction.options.getString('confirmation');
        if (confirm !== 'CONFIRMER') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tapez exactement **CONFIRMER**.', ephemeral: true });
        const count = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId);
        db.db.prepare('UPDATE users SET xp=0, level=1, voice_xp=0, message_count=0 WHERE guild_id=?').run(guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('☢️ XP du serveur réinitialisé')
          .setDescription(`L\'XP de **${count.c} joueurs** a été remis à zéro.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }
    }

    // ════════════════════════════════════════
    // UTILISATEURS
    // ════════════════════════════════════════
    if (group === 'utilisateur') {
      const target = interaction.options.getUser('joueur');

      if (sub === 'info') {
        const u = db.getUser(target.id, guildId);
        const xpNext = db.getXPForLevel ? db.getXPForLevel(u.level + 1) : Math.floor(100 * Math.pow(1.35, u.level));
        const bar = progressBar(u.xp, xpNext);
        const bl = db.db.prepare('SELECT * FROM eco_blacklist WHERE guild_id=? AND user_id=?').get(guildId, target.id);
        const inv = db.db.prepare('SELECT COUNT(*) as c, SUM(quantity) as total FROM inventory WHERE user_id=? AND guild_id=?').get(target.id, guildId);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7C3AED')
          .setTitle(`🛡️ Fiche Admin — ${target.username}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            // Économie
            { name: '💰 Économie', value:
              `👛 **${formatNum(u.balance)}** ${coin} en poche\n` +
              `🏦 **${formatNum(u.bank)}** ${coin} en banque\n` +
              `💎 **${formatNum(u.total_earned)}** ${coin} gagnés au total`, inline: true },
            // XP & Niveau
            { name: '⭐ XP & Niveaux', value:
              `🏆 **Niveau ${u.level}**\n` +
              `⭐ ${formatNum(u.xp)} / ${formatNum(xpNext)} XP\n` +
              `\`${bar}\``, inline: true },
            // Activité
            { name: '📊 Activité', value:
              `💬 **${formatNum(u.message_count)}** messages\n` +
              `🎙️ **${u.voice_minutes || 0}** min en vocal\n` +
              `⭐ **${u.reputation || 0}** réputation`, inline: true },
            // Cooldowns
            { name: '⏱️ Dernières actions', value:
              `📅 Daily : ${tsAgo(u.last_daily)}\n` +
              `💼 Travail : ${tsAgo(u.last_work)}\n` +
              `🔫 Crime : ${tsAgo(u.last_crime)}`, inline: true },
            // Inventaire
            { name: '🎒 Inventaire', value:
              `${inv?.c || 0} type(s) d'objet(s)\n${inv?.total || 0} objet(s) total`, inline: true },
            // Statut
            { name: '🚫 Statut', value:
              `Blacklist éco : **${bl ? `Oui (${bl.reason})` : 'Non'}**`, inline: true },
          )
          .setFooter({ text: `ID: ${target.id} | Streak: ${u.streak || 0}j` })], ephemeral: true });
      }

      if (sub === 'reset_profil') {
        const confirm = interaction.options.getString('confirmation');
        if (confirm !== 'CONFIRMER') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tapez exactement **CONFIRMER**.', ephemeral: true });
        db.db.prepare('UPDATE users SET balance=0,bank=0,total_earned=0,xp=0,level=1,voice_xp=0,voice_minutes=0,message_count=0,reputation=0,streak=0,last_daily=0,last_work=0,last_crime=0 WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        db.db.prepare('DELETE FROM inventory WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setDescription(`🗑️ Le profil complet de <@${target.id}> a été **réinitialisé** (coins, banque, XP, inventaire, réputation).`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'blacklist') {
        const raison = interaction.options.getString('raison') || 'Non spécifiée';
        db.db.prepare('INSERT OR REPLACE INTO eco_blacklist (guild_id,user_id,reason,added_by) VALUES(?,?,?,?)').run(guildId, target.id, raison, adminId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setDescription(`🚫 <@${target.id}> a été **blacklisté de l'économie**.\n📝 Raison : ${raison}`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'unblacklist') {
        db.db.prepare('DELETE FROM eco_blacklist WHERE guild_id=? AND user_id=?').run(guildId, target.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setDescription(`✅ <@${target.id}> a été **retiré de la blacklist** économique.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'reputation_definir') {
        const rawRep = interaction.options.getString('montant') ?? interaction.options.get('montant')?.value;
        const montant = Math.floor(Number(String(rawRep).replace(/[\s_,]/g, ''))) || 0;
        db.db.prepare('UPDATE users SET reputation=? WHERE user_id=? AND guild_id=?').run(montant, target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
          .setDescription(`⭐ La réputation de <@${target.id}> a été définie à **${montant}**.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }
    }

    // ════════════════════════════════════════
    // SERVEUR
    // ════════════════════════════════════════
    if (group === 'serveur') {

      if (sub === 'stats') {
        const totalUsers   = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId);
        const activeUsers  = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND message_count > 0').get(guildId);
        const totalCoins   = db.db.prepare('SELECT SUM(balance+bank) as total FROM users WHERE guild_id=?').get(guildId);
        const maxLevel     = db.db.prepare('SELECT MAX(level) as m FROM users WHERE guild_id=?').get(guildId);
        const avgLevel     = db.db.prepare('SELECT AVG(level) as a FROM users WHERE guild_id=?').get(guildId);
        const totalInv     = db.db.prepare('SELECT COUNT(*) as c FROM inventory WHERE guild_id=?').get(guildId);
        const shopItems    = db.db.prepare('SELECT COUNT(*) as c FROM shop WHERE guild_id=? AND active=1').get(guildId);

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7C3AED')
          .setTitle(`📊 Statistiques — ${interaction.guild.name}`)
          .addFields(
            { name: '👥 Joueurs enregistrés', value: `${totalUsers.c}`, inline: true },
            { name: '📊 Joueurs actifs',       value: `${activeUsers.c}`, inline: true },
            { name: '💰 Coins en circulation', value: `${formatNum(totalCoins.total || 0)} ${coin}`, inline: true },
            { name: '🏆 Niveau max atteint',   value: `${maxLevel.m || 1}`, inline: true },
            { name: '📈 Niveau moyen',          value: `${parseFloat(avgLevel.a || 1).toFixed(1)}`, inline: true },
            { name: '🎒 Total objets inventaire', value: `${totalInv.c}`, inline: true },
            { name: '🛒 Articles boutique actifs', value: `${shopItems.c}`, inline: true },
          )
          .setThumbnail(interaction.guild.iconURL())
          .setFooter({ text: `Serveur ID: ${guildId}` })], ephemeral: true });
      }

      if (sub === 'circulation') {
        const rows = db.db.prepare('SELECT SUM(balance) as sb, SUM(bank) as skb, SUM(total_earned) as ste, COUNT(*) as c FROM users WHERE guild_id=?').get(guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle(`💰 Économie en circulation — ${interaction.guild.name}`)
          .addFields(
            { name: '👛 Total en poche',  value: `${formatNum(rows.sb || 0)} ${coin}`, inline: true },
            { name: '🏦 Total en banque', value: `${formatNum(rows.skb || 0)} ${coin}`, inline: true },
            { name: '💎 Total circulant', value: `**${formatNum((rows.sb || 0) + (rows.skb || 0))} ${coin}**`, inline: true },
            { name: '📊 Total historique gagné', value: `${formatNum(rows.ste || 0)} ${coin}`, inline: false },
          )], ephemeral: true });
      }

      if (sub === 'top_richesse') {
        const top = db.db.prepare('SELECT user_id, balance+bank as total FROM users WHERE guild_id=? ORDER BY total DESC LIMIT 10').all(guildId);
        const medals = ['🥇','🥈','🥉'];
        const lines = top.map((r, i) => `${medals[i] || `**${i+1}.**`} <@${r.user_id}> — **${formatNum(r.total)} ${coin}**`).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle(`🏆 Top 10 des plus riches`)
          .setDescription(lines || 'Aucun joueur.')]});
      }

      if (sub === 'top_xp') {
        const top = db.db.prepare('SELECT user_id, xp, level FROM users WHERE guild_id=? ORDER BY xp DESC LIMIT 10').all(guildId);
        const medals = ['🥇','🥈','🥉'];
        const lines = top.map((r, i) => `${medals[i] || `**${i+1}.**`} <@${r.user_id}> — Nv.**${r.level}** (${formatNum(r.xp)} XP)`).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
          .setTitle(`⭐ Top 10 XP`)
          .setDescription(lines || 'Aucun joueur.')]});
      }

      if (sub === 'activite') {
        const since = Math.floor(Date.now() / 1000) - 7 * 86400;
        const actives = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND last_message > ?').get(guildId, since);
        const dailies = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND last_daily > ?').get(guildId, since);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#10B981')
          .setTitle('📈 Rapport d\'activité — 7 derniers jours')
          .addFields(
            { name: '💬 Joueurs actifs (messages)', value: `${actives.c}`, inline: true },
            { name: '📅 Daily réalisés', value: `${dailies.c}`, inline: true },
          )
          .setFooter({ text: `Depuis 7 jours` })], ephemeral: true });
      }
    }

    // ════════════════════════════════════════
    // ITEMS
    // ════════════════════════════════════════
    if (group === 'items') {
      const target  = interaction.options.getUser('joueur');
      const item_id = parseInt(interaction.options.getString('item_id'));
      const qty     = parseInt(interaction.options.getString('quantite')) || 1;

      if (sub === 'donner') {
        const shopItem = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(item_id, guildId);
        if (!shopItem) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Item #${item_id} introuvable dans la boutique.`, ephemeral: true });
        db.addItem(target.id, guildId, item_id, qty);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setDescription(`🎁 **${qty}× ${shopItem.emoji} ${shopItem.name}** donné(s) à <@${target.id}>.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'retirer') {
        db.removeItem(target.id, guildId, item_id, qty);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setDescription(`❌ Item #${item_id} (×${qty}) retiré de l\'inventaire de <@${target.id}>.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'vider') {
        const confirm = interaction.options.getString('confirmation');
        if (confirm !== 'CONFIRMER') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tapez exactement **CONFIRMER**.', ephemeral: true });
        db.db.prepare('DELETE FROM inventory WHERE user_id=? AND guild_id=?').run(target.id, guildId);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setDescription(`🗑️ Inventaire de <@${target.id}> entièrement vidé.`)
          .setFooter({ text: `Action par ${interaction.user.username}` })] });
      }

      if (sub === 'voir') {
        const items = db.db.prepare(`
          SELECT i.*, s.name, s.emoji, s.description FROM inventory i
          LEFT JOIN shop s ON i.item_id = s.id
          WHERE i.user_id=? AND i.guild_id=? ORDER BY i.quantity DESC
        `).all(target.id, guildId);
        if (!items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `🎒 <@${target.id}> a un inventaire vide.`, ephemeral: true });
        const lines = items.slice(0, 20).map(it => `${it.emoji || '📦'} **${it.name || `Item #${it.item_id}`}** ×${it.quantity}`).join('\n');
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#8B5CF6')
          .setTitle(`🎒 Inventaire de ${target.username}`)
          .setDescription(lines)
          .setFooter({ text: `${items.length} type(s) d'objet(s)` })], ephemeral: true });
      }
    }
  }
};
