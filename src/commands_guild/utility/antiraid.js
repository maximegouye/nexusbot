/**
 * NexusBot — Anti-Raid Protection Avancée
 * /antiraid — Protège le serveur contre les raids et les attaques
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const db = require('../../database/db');

// Tables
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS antiraid_config (
    guild_id         TEXT PRIMARY KEY,
    enabled          INTEGER DEFAULT 0,
    join_threshold   INTEGER DEFAULT 10,
    join_window      INTEGER DEFAULT 30,
    action           TEXT DEFAULT 'kick',
    whitelist_roles  TEXT DEFAULT '[]',
    account_age_min  INTEGER DEFAULT 7,
    log_channel      TEXT,
    lockdown_active  INTEGER DEFAULT 0,
    updated_at       INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS antiraid_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, action TEXT, reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const joinTracker = new Map(); // guildId → [{userId, ts}]

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('🛡️ Protection anti-raid avancée')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand(s => s.setName('statut').setDescription('📊 Voir la configuration actuelle'))
    .addSubcommand(s => s.setName('activer').setDescription('✅ Activer la protection'))
    .addSubcommand(s => s.setName('desactiver').setDescription('❌ Désactiver la protection'))
    .addSubcommand(s => s.setName('configurer')
      .setDescription('⚙️ Configurer les paramètres')
      .addIntegerOption(o => o.setName('seuil').setDescription('Nb de joins pour déclencher (défaut: 10)').setMinValue(3).setMaxValue(50))
      .addIntegerOption(o => o.setName('fenetre').setDescription('Fenêtre de temps en secondes (défaut: 30)').setMinValue(5).setMaxValue(120))
      .addStringOption(o => o.setName('action').setDescription('Action à prendre')
        .addChoices(
          { name: '👢 Expulser', value: 'kick' },
          { name: '🔨 Bannir', value: 'ban' },
          { name: '🔇 Timeout 1h', value: 'timeout' },
          { name: '🚫 Lockdown serveur', value: 'lockdown' },
        ))
      .addIntegerOption(o => o.setName('age_compte').setDescription('Age minimum du compte en jours (anti-alts)').setMinValue(0).setMaxValue(365))
      .addChannelOption(o => o.setName('log').setDescription('Salon de logs anti-raid')))
    .addSubcommand(s => s.setName('lockdown')
      .setDescription('🚨 Activer/désactiver le lockdown d\'urgence')
      .addBooleanOption(o => o.setName('activer').setDescription('true = activer, false = désactiver').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du lockdown')))
    .addSubcommand(s => s.setName('historique').setDescription('📜 Voir les dernières actions anti-raid'))
    .addSubcommand(s => s.setName('test').setDescription('🧪 Tester la détection (simulation)')),

  cooldown: 5,
  joinTracker,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    let cfg = db.db.prepare('SELECT * FROM antiraid_config WHERE guild_id=?').get(guildId);
    if (!cfg) {
      db.db.prepare('INSERT OR IGNORE INTO antiraid_config (guild_id) VALUES (?)').run(guildId);
      cfg = db.db.prepare('SELECT * FROM antiraid_config WHERE guild_id=?').get(guildId);
    }

    if (sub === 'statut') {
      const embed = new EmbedBuilder()
        .setColor(cfg.enabled ? '#2ecc71' : '#e74c3c')
        .setTitle('🛡️ Anti-Raid — Configuration')
        .addFields(
          { name: '🔘 Statut',           value: cfg.enabled ? '✅ **Activé**' : '❌ **Désactivé**', inline: true },
          { name: '🔒 Lockdown',          value: cfg.lockdown_active ? '🚨 **ACTIF**' : '✅ Normal', inline: true },
          { name: '👥 Seuil',             value: `${cfg.join_threshold} joins`, inline: true },
          { name: '⏱️ Fenêtre',           value: `${cfg.join_window} secondes`, inline: true },
          { name: '⚡ Action',            value: cfg.action, inline: true },
          { name: '📅 Age min. compte',   value: `${cfg.account_age_min} jours`, inline: true },
          { name: '📋 Logs',              value: cfg.log_channel ? `<#${cfg.log_channel}>` : '*Non configuré*', inline: true },
        )
        .setFooter({ text: 'NexusBot Anti-Raid' })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'activer') {
      db.db.prepare('UPDATE antiraid_config SET enabled=1 WHERE guild_id=?').run(guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✅ Protection anti-raid **activée** !')] });
    }

    if (sub === 'desactiver') {
      db.db.prepare('UPDATE antiraid_config SET enabled=0 WHERE guild_id=?').run(guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('❌ Protection anti-raid **désactivée**.')] });
    }

    if (sub === 'configurer') {
      const seuil  = interaction.options.getInteger('seuil');
      const fenetre = interaction.options.getInteger('fenetre');
      const action = interaction.options.getString('action');
      const age    = interaction.options.getInteger('age_compte');
      const log    = interaction.options.getChannel('log');
      if (seuil)   db.db.prepare('UPDATE antiraid_config SET join_threshold=? WHERE guild_id=?').run(seuil, guildId);
      if (fenetre) db.db.prepare('UPDATE antiraid_config SET join_window=? WHERE guild_id=?').run(fenetre, guildId);
      if (action)  db.db.prepare('UPDATE antiraid_config SET action=? WHERE guild_id=?').run(action, guildId);
      if (age !== null) db.db.prepare('UPDATE antiraid_config SET account_age_min=? WHERE guild_id=?').run(age, guildId);
      if (log)     db.db.prepare('UPDATE antiraid_config SET log_channel=? WHERE guild_id=?').run(log.id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('✅ Configuration anti-raid mise à jour !')] });
    }

    if (sub === 'lockdown') {
      const activer = interaction.options.getBoolean('activer');
      const raison  = interaction.options.getString('raison') || 'Lockdown d\'urgence';
      db.db.prepare('UPDATE antiraid_config SET lockdown_active=? WHERE guild_id=?').run(activer ? 1 : 0, guildId);

      if (activer) {
        // Verrouiller tous les salons texte
        let locked = 0;
        for (const [, ch] of interaction.guild.channels.cache) {
          if (ch.isTextBased() && !ch.isThread()) {
            try {
              await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
              locked++;
            } catch {}
          }
        }
        const embed = new EmbedBuilder()
          .setColor('#e74c3c')
          .setTitle('🚨 LOCKDOWN D\'URGENCE ACTIVÉ')
          .setDescription(`Le serveur est en **lockdown d'urgence**.\n\n**Raison :** ${raison}\n**Salons verrouillés :** ${locked}\n\nUtilise \`/antiraid lockdown activer:false\` pour lever le lockdown.`)
          .setFooter({ text: `Activé par ${interaction.user.username}` })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } else {
        // Déverrouiller
        let unlocked = 0;
        for (const [, ch] of interaction.guild.channels.cache) {
          if (ch.isTextBased() && !ch.isThread()) {
            try {
              await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
              unlocked++;
            } catch {}
          }
        }
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Lockdown levé ! ${unlocked} salons déverrouillés.`)] });
      }
    }

    if (sub === 'historique') {
      const logs = db.db.prepare('SELECT * FROM antiraid_log WHERE guild_id=? ORDER BY created_at DESC LIMIT 20').all(guildId);
      if (!logs.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune action anti-raid enregistrée.')] });
      const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('📜 Historique Anti-Raid')
        .setDescription(logs.map(l => {
          const date = new Date(l.created_at * 1000).toLocaleDateString('fr-FR');
          return `• <@${l.user_id}> — **${l.action}** — ${l.reason} *(${date})*`;
        }).join('\n'))
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'test') {
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🧪 Test Anti-Raid')
        .setDescription(`**Simulation de détection de raid :**\n\n✅ Système anti-raid : **${cfg.enabled ? 'Actif' : 'Inactif'}**\n✅ Seuil configuré : **${cfg.join_threshold} joins en ${cfg.join_window}s**\n✅ Action : **${cfg.action}**\n✅ Filtre age compte : **${cfg.account_age_min} jours**\n\n*Aucune action réelle prise — simulation uniquement.*`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
