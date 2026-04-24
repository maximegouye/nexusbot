const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const PREFIX = '&';
module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();
    const guildId = message.guild?.id;
    if (!guildId) return;
    const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);

    if (command === 'donner' || command === 'give') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      const mention = message.mentions.users.first();
      const montant = parseInt(args[1]);
      if (!mention || isNaN(montant) || montant <= 0) return message.reply('❌ Usage : `!donner @membre montant`');
      await db.run(`INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)`, [mention.id, guildId]);
      await db.run(`UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?`, [montant, mention.id, guildId]);
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [mention.id, guildId]);
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('💰 Coins ajoutés')
        .setDescription(`**${mention.username}** a reçu **+${montant.toLocaleString()} coins**.\nSolde : **${(row?.coins||0).toLocaleString()} coins**`)
        .setFooter({ text: `Action par ${message.author.username}` }).setTimestamp()] });
    }
    if (command === 'retirer' || command === 'remove') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      const mention = message.mentions.users.first();
      const montant = parseInt(args[1]);
      if (!mention || isNaN(montant) || montant <= 0) return message.reply('❌ Usage : `!retirer @membre montant`');
      await db.run(`INSERT OR IGNORE INTO economy (userId, guildId, coins) VALUES (?, ?, 0)`, [mention.id, guildId]);
      await db.run(`UPDATE economy SET coins = MAX(0, coins - ?) WHERE userId = ? AND guildId = ?`, [montant, mention.id, guildId]);
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [mention.id, guildId]);
      return message.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('➖ Coins retirés')
        .setDescription(`**${mention.username}** a perdu **${montant.toLocaleString()} coins**.\nSolde : **${(row?.coins||0).toLocaleString()} coins**`)
        .setFooter({ text: `Action par ${message.author.username}` }).setTimestamp()] });
    }
    if (command === 'reset') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      const mention = message.mentions.users.first();
      if (!mention) return message.reply('❌ Usage : `!reset @membre`');
      await db.run(`UPDATE economy SET coins = 0 WHERE userId = ? AND guildId = ?`, [mention.id, guildId]);
      return message.reply(`✅ Solde de **${mention.username}** remis à **0 coins**.`);
    }
    if (command === 'solde' || command === 'bal') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      const mention = message.mentions.users.first();
      if (!mention) return message.reply('❌ Usage : `!solde @membre`');
      const row = await db.get(`SELECT coins FROM economy WHERE userId = ? AND guildId = ?`, [mention.id, guildId]);
      return message.reply(`💰 **${mention.username}** : **${(row?.coins||0).toLocaleString()} coins**`);
    }
    if (command === 'cooldown' || command === 'cd') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      const mention = message.mentions.users.first();
      if (!mention) return message.reply('❌ Usage : `!cooldown @membre`');
      for (const t of ['peche_stats','travail','missions']) {
        try { await db.run(`UPDATE ${t} SET lastPeche=0, lastTravail=0, lastDaily=0 WHERE userId=? AND guildId=?`, [mention.id, guildId]); } catch {}
      }
      return message.reply(`✅ Cooldowns de **${mention.username}** réinitialisés.`);
    }
    if (command === 'config') {
      if (!isAdmin) return message.reply('🚫 Réservé aux administrateurs.');
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle(`⚙️ Config — ${message.guild.name}`)
        .addFields(
          { name: '🆔 Guild ID', value: message.guild.id, inline: true },
          { name: '👥 Membres', value: `${message.guild.memberCount}`, inline: true },
          { name: '💱 Préfixes', value: `/ et !`, inline: true }
        ).setTimestamp()] });
    }
    if (command === 'help' || command === 'aide') {
      if (!isAdmin) return;
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('📋 Commandes Admin !')
        .setDescription('`!donner @m montant` — Donner coins (bot finance)\n`!retirer @m montant` — Retirer coins\n`!reset @m` — Reset solde\n`!solde @m` — Voir solde\n`!cooldown @m` — Reset cooldowns\n`!config` — Config serveur\n\n> Aussi dispo avec `/admin`')
        .setTimestamp()] });
    }
  }
};
