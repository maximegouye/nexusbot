// ============================================================
// admin_eco.js — Commandes admin économie
// /admin donner | /admin retirer | /admin reset | /admin solde | /admin cooldown
// ============================================================
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🔐 Commandes réservées aux administrateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('donner')
      .setDescription('💰 Donner des coins à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à donner').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub
      .setName('retirer')
      .setDescription('➖ Retirer des coins à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant à retirer').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub
      .setName('reset')
      .setDescription('🔄 Remettre à zéro le solde d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('cooldown')
      .setDescription('⏱️ Réinitialiser tous les cooldowns d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('solde')
      .setDescription('👁️ Voir le solde exact d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '🚫 Commande réservée aux administrateurs.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg     = db.getConfig(guildId);
    const symbol  = cfg?.currency_emoji || '€';

    // ── DONNER ──────────────────────────────────────────────
    if (sub === 'donner') {
      const target  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)').run(target.id, guildId);
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(montant, target.id, guildId);
      const row = db.db.prepare('SELECT balance, bank FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('💰 Coins donnés')
          .setDescription(`**${montant.toLocaleString('fr-FR')}${symbol}** ajoutés à <@${target.id}>`)
          .addFields(
            { name: 'Nouveau solde', value: `**${(row?.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: 'Banque', value: `**${(row?.bank || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true }
          )
          .setTimestamp()
        ]
      });
    }

    // ── RETIRER ─────────────────────────────────────────────
    if (sub === 'retirer') {
      const target  = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)').run(target.id, guildId);
      db.db.prepare('UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(montant, target.id, guildId);
      const row = db.db.prepare('SELECT balance, bank FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('➖ Coins retirés')
          .setDescription(`**${montant.toLocaleString('fr-FR')}${symbol}** retirés de <@${target.id}>`)
          .addFields(
            { name: 'Nouveau solde', value: `**${(row?.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true }
          )
          .setTimestamp()
        ]
      });
    }

    // ── RESET ───────────────────────────────────────────────
    if (sub === 'reset') {
      const target = interaction.options.getUser('membre');
      db.db.prepare('UPDATE users SET balance = 0, bank = 0, total_earned = 0 WHERE user_id = ? AND guild_id = ?').run(target.id, guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle('🔄 Solde réinitialisé')
          .setDescription(`Le solde de <@${target.id}> a été remis à zéro.`)
          .setTimestamp()
        ]
      });
    }

    // ── COOLDOWN ─────────────────────────────────────────────
    if (sub === 'cooldown') {
      const target = interaction.options.getUser('membre');
      db.db.prepare(`UPDATE users SET
        last_daily = 0,
        last_work = 0,
        last_crime = 0,
        last_rob = 0
        WHERE user_id = ? AND guild_id = ?`
      ).run(target.id, guildId);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('⏱️ Cooldowns réinitialisés')
          .setDescription(`Tous les cooldowns de <@${target.id}> ont été remis à zéro.\n(daily, travail, crime, vol)`)
          .setTimestamp()
        ]
      });
    }

    // ── SOLDE ────────────────────────────────────────────────
    if (sub === 'solde') {
      const target = interaction.options.getUser('membre');
      const row = db.db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      if (!row) return interaction.editReply({ content: `❌ <@${target.id}> n'a pas encore de compte économique.` });
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`👁️ Solde de ${target.username}`)
          .addFields(
            { name: '💵 Portefeuille', value: `**${(row.balance || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '🏦 Banque', value: `**${(row.bank || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '📈 Total gagné', value: `**${(row.total_earned || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: '⭐ Niveau', value: `**${row.level || 1}** (${(row.xp || 0).toLocaleString('fr-FR')} XP)`, inline: true },
            { name: '💬 Messages', value: `**${(row.message_count || 0).toLocaleString('fr-FR')}**`, inline: true }
          )
          .setThumbnail(target.displayAvatarURL())
          .setTimestamp()
        ]
      });
    }
  }
};
