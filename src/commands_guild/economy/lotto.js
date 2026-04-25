const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lotto')
    .setDescription('🎟️ Participe à la loterie hebdomadaire du serveur !'),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg    = db.getConfig(interaction.guildId);
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';
    const qty    = parseInt(interaction.options.getString('tickets')) || 1;
    const price  = 100; // 100 coins par ticket
    const total  = qty * price;
    const user   = db.getUser(interaction.user.id, interaction.guildId);

    // Infos du lotto actuel
    const pot    = db.db.prepare('SELECT SUM(amount) as pot FROM lotto WHERE guild_id = ? AND week = strftime("%W", "now")').get(interaction.guildId)?.pot || 0;
    const count  = db.db.prepare('SELECT COUNT(*) as c FROM lotto WHERE guild_id = ? AND week = strftime("%W", "now")').get(interaction.guildId)?.c || 0;
    const myTickets = db.db.prepare('SELECT SUM(tickets) as t FROM lotto WHERE guild_id = ? AND user_id = ? AND week = strftime("%W", "now")').get(interaction.guildId, interaction.user.id)?.t || 0;

    if (!qty) {
      // Afficher les infos seulement
      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎟️ Loterie Hebdomadaire')
        .setDescription('Achète des tickets et tente de gagner la cagnotte ! Tirage chaque lundi à minuit.')
        .addFields(
          { name: '💰 Cagnotte actuelle', value: `**${(pot * 0.9).toLocaleString('fr-FR')} ${name}** (90% du pot)`, inline: true },
          { name: '🎟️ Tickets vendus',   value: `**${count}**`, inline: true },
          { name: '🎫 Tes tickets',       value: `**${myTickets}**`, inline: true },
        )
        .setFooter({ text: `Ticket = ${price} ${name} • Tirage lundi 00:00` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (user.balance < total) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu as besoin de **${total.toLocaleString('fr-FR')} ${name}** pour ${qty} ticket(s).`, ephemeral: true });

    db.removeCoins(interaction.user.id, interaction.guildId, total);

    // Insérer les tickets
    const week = new Date().getWeek ? new Date().getWeek() : Math.floor(Date.now() / (7 * 86400000));
    db.db.prepare(`INSERT INTO lotto (guild_id, user_id, tickets, amount, week, created_at)
      VALUES (?, ?, ?, ?, strftime('%W', 'now'), ?)
      ON CONFLICT(guild_id, user_id, week) DO UPDATE SET tickets = tickets + ?, amount = amount + ?`)
      .run(interaction.guildId, interaction.user.id, qty, total, Math.floor(Date.now() / 1000), qty, total);

    const newPot = pot + total;
    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🎟️ Tickets achetés !')
      .setDescription(`Tu as acheté **${qty} ticket(s)** pour **${total.toLocaleString('fr-FR')} ${name}** ${emoji} !`)
      .addFields(
        { name: '🎫 Total tes tickets', value: `**${myTickets + qty}** cette semaine`, inline: true },
        { name: '💰 Cagnotte actuelle', value: `**${(newPot * 0.9).toLocaleString('fr-FR')} ${name}**`, inline: true },
        { name: '⏰ Tirage',           value: `Lundi à minuit`, inline: true },
      )
      .setFooter({ text: 'Plus tu as de tickets, plus tu as de chances de gagner !' });

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};
