// admin_eco.js — /admin donner | retirer | reset | solde | cooldown
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🔐 Commandes administrateur économie')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('donner').setDescription('💰 Donner des coins à un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('retirer').setDescription('➖ Retirer des coins')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('reset').setDescription('🔄 Remettre le solde à zéro')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    .addSubcommand(s => s.setName('cooldown').setDescription('⏱️ Réinitialiser les cooldowns')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)))
    .addSubcommand(s => s.setName('solde').setDescription('👁️ Voir le solde d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '🚫 Réservé aux admins.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg = db.getConfig ? db.getConfig(guildId) : {};
    const sym = (cfg && cfg.currency_emoji) || '€';

    if (sub === 'donner') {
      const target = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)').run(target.id, guildId);
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(montant, target.id, guildId);
      const row = db.db.prepare('SELECT balance, bank FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('💰 Coins donnés')
        .setDescription(`+**${montant.toLocaleString('fr-FR')}${sym}** à <@${target.id}>`)
        .addFields({ name: 'Nouveau solde', value: `**${(row?.balance||0).toLocaleString('fr-FR')}${sym}**` })
        .setTimestamp()] });
    }

    if (sub === 'retirer') {
      const target = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?, ?)').run(target.id, guildId);
      db.db.prepare('UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(montant, target.id, guildId);
      const row = db.db.prepare('SELECT balance FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('➖ Coins retirés')
        .setDescription(`-**${montant.toLocaleString('fr-FR')}${sym}** de <@${target.id}>`)
        .addFields({ name: 'Nouveau solde', value: `**${(row?.balance||0).toLocaleString('fr-FR')}${sym}**` })
        .setTimestamp()] });
    }

    if (sub === 'reset') {
      const target = interaction.options.getUser('membre');
      db.db.prepare('UPDATE users SET balance = 0, bank = 0 WHERE user_id = ? AND guild_id = ?').run(target.id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('🔄 Solde remis à zéro')
        .setDescription(`<@${target.id}> a été remis à zéro.`).setTimestamp()] });
    }

    if (sub === 'cooldown') {
      const target = interaction.options.getUser('membre');
      db.db.prepare('UPDATE users SET last_daily=0, last_work=0, last_crime=0, last_rob=0 WHERE user_id = ? AND guild_id = ?').run(target.id, guildId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('⏱️ Cooldowns remis à zéro')
        .setDescription(`Cooldowns de <@${target.id}> réinitialisés (daily, travail, crime, vol).`).setTimestamp()] });
    }

    if (sub === 'solde') {
      const target = interaction.options.getUser('membre');
      const row = db.db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?').get(target.id, guildId);
      if (!row) return interaction.editReply({ content: `❌ <@${target.id}> n'a pas de compte.` });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle(`👁️ Solde de ${target.username}`)
        .addFields(
          { name: '💵 Portefeuille', value: `**${(row.balance||0).toLocaleString('fr-FR')}${sym}**`, inline: true },
          { name: '🏦 Banque', value: `**${(row.bank||0).toLocaleString('fr-FR')}${sym}**`, inline: true },
          { name: '⭐ Niveau', value: `**${row.level||1}** (${(row.xp||0).toLocaleString('fr-FR')} XP)`, inline: true }
        ).setThumbnail(target.displayAvatarURL()).setTimestamp()] });
    }
  }
};
