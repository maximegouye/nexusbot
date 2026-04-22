const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const COLOR = 0xE74C3C;
module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Commandes réservées aux administrateurs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('donner').setDescription('Donner des coins (financé par le bot)')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('retirer').setDescription('Retirer des coins')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant').setRequired(true).setMinValue(1)))
    .addSubcommand(sub => sub.setName('reset').setDescription('Remettre le solde à zéro')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('cooldown').setDescription('Réinitialiser les cooldowns')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('solde').setDescription('Voir le solde d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(sub => sub.setName('config').setDescription('Configuration du serveur')),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
      return interaction.reply({ content: '🚫 Réservé aux administrateurs.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'donner') {
      const membre = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      await db.run(`INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)`, [membre.id, guildId]);
      await db.run(`UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?`, [montant, membre.id, guildId]);
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [membre.id, guildId]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('💰 Coins ajoutés')
        .setDescription(`**${membre.username}** a reçu **+${montant.toLocaleString()} coins** du bot.\nSolde : **${(row?.coins||0).toLocaleString()} coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }
    if (sub === 'retirer') {
      const membre = interaction.options.getUser('membre');
      const montant = interaction.options.getInteger('montant');
      await db.run(`INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)`, [membre.id, guildId]);
      await db.run(`UPDATE economy SET coins = MAX(0, coins - ?) WHERE userId = ? AND guildId = ?`, [montant, membre.id, guildId]);
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [membre.id, guildId]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('➖ Coins retirés')
        .setDescription(`**${membre.username}** a perdu **${montant.toLocaleString()} coins**.\nSolde : **${(row?.coins||0).toLocaleString()} coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }
    if (sub === 'reset') {
      const membre = interaction.options.getUser('membre');
      await db.run(`UPDATE economy SET coins = 0 WHERE userId = ? AND guildId = ?`, [membre.id, guildId]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('🔄 Solde remis à zéro')
        .setDescription(`Solde de **${membre.username}** → **0 coins**`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }
    if (sub === 'cooldown') {
      const membre = interaction.options.getUser('membre');
      for (const t of ['peche_stats','travail','missions']) {
        try { await db.run(`UPDATE ${t} SET lastPeche=0, lastTravail=0, lastDaily=0 WHERE userId=? AND guildId=?`, [membre.id, guildId]); } catch {}
      }
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('⏱️ Cooldowns réinitialisés')
        .setDescription(`Cooldowns de **${membre.username}** réinitialisés.`)
        .setFooter({ text: `Action par ${interaction.user.username}` }).setTimestamp()] });
    }
    if (sub === 'solde') {
      const membre = interaction.options.getUser('membre');
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [membre.id, guildId]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xF39C12).setTitle('👁️ Solde membre')
        .setDescription(`**${membre.username}** : **${(row?.coins||0).toLocaleString()} coins**`)
        .setFooter({ text: `Consulté par ${interaction.user.username}` }).setTimestamp()] });
    }
    if (sub === 'config') {
      const guild = interaction.guild;
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle(`⚙️ Config — ${guild.name}`)
        .addFields(
          { name: '🆔 Guild ID', value: guild.id, inline: true },
          { name: '👥 Membres', value: `${guild.memberCount}`, inline: true },
          { name: '💱 Préfixes', value: `/ et !`, inline: true },
          { name: '📊 DB', value: 'SQLite opérationnelle', inline: true }
        ).setTimestamp()] });
    }
  }
};
