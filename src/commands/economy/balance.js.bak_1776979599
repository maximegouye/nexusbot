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

    // Portefeuille crypto
    let cryptoValue = 0;
    let cryptoLines = '';
    try {
      const wallet = db.getWallet(target.id, interaction.guildId);
      if (wallet && wallet.length) {
        const market = new Map((db.getCryptoMarket() || []).map(c => [c.symbol, c]));
        for (const w of wallet) {
          const m = market.get(w.crypto);
          if (!m) continue;
          const val = Math.floor(w.amount * m.price);
          cryptoValue += val;
          cryptoLines += `${m.emoji} **${w.crypto}** · ${w.amount.toFixed(6)} → ${val.toLocaleString('fr-FR')}${symbol}\n`;
        }
      }
    } catch {}

    const netWorth = user.balance + user.bank + cryptoValue;
    const percentile = totalMembers > 1 ? Math.round((1 - (rank - 1) / totalMembers) * 100) : 100;

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`💶 Portefeuille — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👛 Liquide',           value: `**${user.balance.toLocaleString('fr-FR')}${symbol}**`,  inline: true },
        { name: '🏦 Banque',            value: `**${user.bank.toLocaleString('fr-FR')}${symbol}**`,     inline: true },
        { name: '💹 Crypto',            value: `**${cryptoValue.toLocaleString('fr-FR')}${symbol}**`,   inline: true },
        { name: '💎 Fortune totale',    value: `**${netWorth.toLocaleString('fr-FR')}${symbol}**`,      inline: false },
        { name: '📈 Total gagné',       value: `**${user.total_earned.toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '🏆 Classement',        value: `**#${rank}** sur ${totalMembers} membres`,           inline: true },
        { name: '📊 Percentile',        value: `**Top ${100 - percentile + 1}%**`,                   inline: true },
      );

    if (cryptoLines) {
      embed.addFields({ name: '💰 Détails crypto', value: cryptoLines.slice(0, 1000), inline: false });
    }

    embed.setFooter({ text: `💡 /daily · /work · /crime · /crypto · /casino pour jouer !` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
