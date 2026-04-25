const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS loto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, ticket_count INTEGER DEFAULT 0,
    week TEXT DEFAULT (strftime('%Y-%W', 'now')),
    UNIQUE(guild_id, user_id, week)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS loto_config (
    guild_id TEXT PRIMARY KEY, jackpot INTEGER DEFAULT 10000,
    last_draw TEXT, ticket_price INTEGER DEFAULT 100
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loto')
    .setDescription('🎰 Loterie hebdomadaire avec jackpot')
    .addSubcommand(s => s.setName('acheter').setDescription('🎟️ Acheter des tickets de loto')
    .addSubcommand(s => s.setName('jackpot').setDescription('💰 Voir le jackpot actuel et ton nombre de tickets'))
    .addSubcommand(s => s.setName('classement').setDescription('📋 Qui a le plus de chances de gagner ?'))
    .addSubcommand(s => s.setName('tirage').setDescription('🎲 Effectuer le tirage au sort (Admin)')
      .addBooleanOption(o => o.setName('forcer').setDescription('Forcer le tirage maintenant').setRequired(true)))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const week = new Date().toISOString().slice(0, 7);

    let lotoCfg = db.db.prepare('SELECT * FROM loto_config WHERE guild_id=?').get(guildId);
    if (!lotoCfg) {
      db.db.prepare('INSERT OR IGNORE INTO loto_config (guild_id) VALUES (?)').run(guildId);
      lotoCfg = db.db.prepare('SELECT * FROM loto_config WHERE guild_id=?').get(guildId);
    }

    if (sub === 'acheter') {
      const qte = parseInt(interaction.options.getString('quantite'));
      const prix = (lotoCfg.ticket_price || 100) * qte;
      const u = db.getUser(userId, guildId);

      if (u.balance < prix) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Il te faut **${prix} ${coin}** pour acheter ${qte} ticket(s).`, ephemeral: true });

      db.addCoins(userId, guildId, -prix);
      // Ajouter les tickets
      const existing = db.db.prepare('SELECT * FROM loto WHERE guild_id=? AND user_id=? AND week=?').get(guildId, userId, week);
      if (existing) {
        db.db.prepare('UPDATE loto SET ticket_count=ticket_count+? WHERE id=?').run(qte, existing.id);
      } else {
        db.db.prepare('INSERT INTO loto (guild_id, user_id, ticket_count, week) VALUES (?,?,?,?)').run(guildId, userId, qte, week);
      }
      // Augmenter le jackpot
      db.db.prepare('UPDATE loto_config SET jackpot=jackpot+? WHERE guild_id=?').run(Math.floor(prix * 0.8), guildId);

      const newTickets = (existing?.ticket_count || 0) + qte;
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold')
          .setTitle('🎟️ Tickets achetés !')
          .setDescription(`Tu possèdes maintenant **${newTickets} ticket(s)** pour cette semaine !\nJackpot actuel : **${lotoCfg.jackpot + Math.floor(prix * 0.8)} ${coin}**`)
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'jackpot') {
      const myTickets = db.db.prepare('SELECT ticket_count FROM loto WHERE guild_id=? AND user_id=? AND week=?').get(guildId, userId, week);
      const totalTickets = db.db.prepare('SELECT SUM(ticket_count) as t FROM loto WHERE guild_id=? AND week=?').get(guildId, week);
      const total = totalTickets?.t || 0;
      const myChance = total > 0 && myTickets ? ((myTickets.ticket_count / total) * 100).toFixed(1) : '0';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold')
          .setTitle('🎰 Loterie Hebdomadaire')
          .addFields(
            { name: '💰 Jackpot actuel', value: `**${lotoCfg.jackpot} ${coin}**`, inline: true },
            { name: '🎟️ Tes tickets', value: `**${myTickets?.ticket_count || 0}**`, inline: true },
            { name: '📊 Tes chances', value: `**${myChance}%**`, inline: true },
            { name: '🎟️ Total tickets vendus', value: `**${total}**`, inline: true },
            { name: '💲 Prix par ticket', value: `**${lotoCfg.ticket_price} ${coin}**`, inline: true },
            { name: '📅 Tirage', value: 'Chaque dimanche à 20h', inline: true },
          )
          .setFooter({ text: 'Plus tu as de tickets, plus tu as de chances !' })
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM loto WHERE guild_id=? AND week=? ORDER BY ticket_count DESC LIMIT 10').all(guildId, week);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Personne n\'a encore acheté de ticket cette semaine.', ephemeral: true });

      const total = top.reduce((a, r) => a + r.ticket_count, 0);
      const lines = top.map((r, i) => `**${i+1}.** <@${r.user_id}> — **${r.ticket_count}** ticket(s) (${((r.ticket_count/total)*100).toFixed(1)}%)`).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold')
          .setTitle('📊 Classement Loto de la semaine')
          .setDescription(lines)
          .setFooter({ text: `Jackpot: ${lotoCfg.jackpot} ${coin}` })
          .setTimestamp()
      ]});
    }

    if (sub === 'tirage') {
      if (!interaction.member.permissions.has('ManageGuild')) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé aux admins.', ephemeral: true });

      const participants = db.db.prepare('SELECT * FROM loto WHERE guild_id=? AND week=? AND ticket_count > 0').all(guildId, week);
      if (!participants.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Personne n\'a participé cette semaine.', ephemeral: true });

      // Tirage pondéré
      const pool = [];
      for (const p of participants) {
        for (let i = 0; i < p.ticket_count; i++) pool.push(p.user_id);
      }
      const winner = pool[Math.floor(Math.random() * pool.length)];
      const prize = lotoCfg.jackpot;

      db.addCoins(winner, guildId, prize);
      db.db.prepare('UPDATE loto_config SET jackpot=10000, last_draw=datetime("now") WHERE guild_id=?').run(guildId);
      db.db.prepare('DELETE FROM loto WHERE guild_id=? AND week=?').run(guildId, week);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Gold')
          .setTitle('🎰 Résultat du Tirage Loto !')
          .setDescription(`🎉 **Le grand gagnant est <@${winner}>** !\n\nIl/Elle remporte **${prize} ${coin}** !`)
          .addFields({ name: '🎟️ Participants', value: `${participants.length}`, inline: true })
          .setTimestamp()
      ]});
    }
  }
};
