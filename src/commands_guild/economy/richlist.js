const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('richlist')
    .setDescription('💰 Top 10 des membres les plus riches du serveur')
    .addStringOption(o => o.setName('type').setDescription('Classement par').setRequired(false)
      .addChoices(
        { name: '💳 Solde total (wallet + banque)', value: 'total' },
        { name: '👛 Portefeuille', value: 'balance' },
        { name: '🏦 Banque', value: 'bank' },
        { name: '💎 Total gagné (all-time)', value: 'earned' },
      )),

  async execute(interaction) {
    await interaction.deferReply();
    const type = interaction.options.getString('type') || 'total';

    let query, label;
    switch (type) {
      case 'balance': query = 'SELECT user_id, balance as amount FROM users WHERE guild_id=? ORDER BY balance DESC LIMIT 10'; label = '👛 Portefeuille'; break;
      case 'bank':    query = 'SELECT user_id, bank as amount FROM users WHERE guild_id=? ORDER BY bank DESC LIMIT 10'; label = '🏦 Banque'; break;
      case 'earned':  query = 'SELECT user_id, total_earned as amount FROM users WHERE guild_id=? ORDER BY total_earned DESC LIMIT 10'; label = '💎 Total gagné'; break;
      default:        query = 'SELECT user_id, (balance+bank) as amount FROM users WHERE guild_id=? ORDER BY (balance+bank) DESC LIMIT 10'; label = '💰 Solde total';
    }

    const rows = db.db.prepare(query).all(interaction.guildId);
    if (!rows.length) return interaction.editReply({ content: 'Aucune donnée économique.' });

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(rows.map(async (r, i) => {
      let name;
      try { const u = await interaction.client.users.fetch(r.user_id); name = u.username; } catch { name = `Utilisateur inconnu`; }
      const medal = medals[i] || `**${i+1}.**`;
      return `${medal} **${name}** — ${r.amount?.toLocaleString('fr') ?? 0} 🪙`;
    }));

    // Rang du joueur actuel
    const selfRow = db.db.prepare(
      type === 'total' ? 'SELECT COUNT(*)+1 as rank FROM users WHERE guild_id=? AND (balance+bank) > (SELECT balance+bank FROM users WHERE guild_id=? AND user_id=?)'
        : `SELECT COUNT(*)+1 as rank FROM users WHERE guild_id=? AND ${type} > (SELECT ${type} FROM users WHERE guild_id=? AND user_id=?)`
    ).get(interaction.guildId, interaction.guildId, interaction.user.id);

    const cfg = db.getConfig(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 Classement ${label} — ${interaction.guild.name}`)
      .setDescription(lines.join('\n'))
      .addFields({ name: '📊 Ton rang', value: `#${selfRow?.rank ?? '?'}`, inline: true })
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({ text: `Monnaie: ${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
