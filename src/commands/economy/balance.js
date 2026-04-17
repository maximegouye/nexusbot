const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💶 Affiche ton solde ou celui d\'un autre membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    const target  = interaction.options.getUser('membre') || interaction.user;
    const cfg     = db.getConfig(interaction.guildId);
    const user    = db.getUser(target.id, interaction.guildId);
    const symbol  = cfg.currency_emoji || '€';
    const name    = cfg.currency_name  || 'Euros';

    // Classement par richesse totale (portefeuille + banque)
    const rank = db.db.prepare(
      'SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND (balance + bank) > ?'
    ).get(interaction.guildId, user.balance + user.bank).r + 1;

    // Total des membres avec de l'argent
    const totalMembers = db.db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE guild_id = ? AND (balance + bank) > 0"
    ).get(interaction.guildId).c;

    const netWorth = user.balance + user.bank;
    const percentile = totalMembers > 1 ? Math.round((1 - (rank - 1) / totalMembers) * 100) : 100;

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`💶 Solde — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👛 Portefeuille',      value: `**${user.balance.toLocaleString('fr')}${symbol}**`,  inline: true },
        { name: '🏦 Banque',            value: `**${user.bank.toLocaleString('fr')}${symbol}**`,     inline: true },
        { name: '💎 Fortune totale',    value: `**${netWorth.toLocaleString('fr')}${symbol}**`,      inline: true },
        { name: '📈 Total gagné',       value: `**${user.total_earned.toLocaleString('fr')}${symbol}**`, inline: true },
        { name: '🏆 Classement',        value: `**#${rank}** sur ${totalMembers} membres`,           inline: true },
        { name: '📊 Percentile',        value: `**Top ${100 - percentile + 1}%**`,                   inline: true },
      )
      .setFooter({ text: `💡 /daily • /work • /crime pour gagner plus !` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
