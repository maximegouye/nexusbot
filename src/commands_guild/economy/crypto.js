const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Migration
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS crypto_portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, symbol TEXT,
    quantite REAL DEFAULT 0, cout_moyen REAL DEFAULT 0,
    UNIQUE(guild_id, user_id, symbol)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS crypto_prices (
    symbol TEXT PRIMARY KEY, price REAL, change24h REAL, last_update INTEGER
  )`).run();
} catch {}

// Simulation de prix crypto (basé sur une seed pseudo-aléatoire par heure)
function getCryptoPrice(symbol) {
  const base = { BTC: 45000, ETH: 2800, SOL: 120, NEXUS: 1, DOGE: 0.12, BNB: 400, ADA: 0.5, XRP: 0.55, MATIC: 0.90, LINK: 12, AVAX: 35, DOT: 8, SHIB: 0.000012, LTC: 70, UNI: 6, ATOM: 10, FTM: 0.35, APT: 9, NEAR: 4 };
  const seed = Math.floor(Date.now() / 3600000); // Change chaque heure
  const hash = (symbol.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), seed) % 1000) / 1000;
  const variation = (hash - 0.5) * 0.1; // ±5%
  const price = (base[symbol] || 10) * (1 + variation);
  const change24h = ((hash - 0.45) * 20).toFixed(2); // ±9%
  return { price: Math.max(0.01, price), change24h: parseFloat(change24h) };
}

const CRYPTOS = ['BTC', 'ETH', 'SOL', 'NEXUS', 'DOGE', 'BNB', 'ADA', 'XRP', 'MATIC', 'LINK', 'AVAX', 'DOT', 'SHIB', 'LTC', 'UNI', 'ATOM', 'FTM', 'APT', 'NEAR'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('📈 Marché crypto simulé — achète, vends, enrichis-toi !')
    .addSubcommand(s => s.setName('marche').setDescription('📊 Voir les cours actuels'))
    .addSubcommand(s => s.setName('portefeuille').setDescription('💼 Voir ton portefeuille crypto')
      .addUserOption(o => o.setName('membre').setDescription('Voir le portefeuille d\'un autre membre')))
    .addSubcommand(s => s.setName('acheter').setDescription('💸 Acheter une crypto')
      .addStringOption(o => o.setName('crypto').setDescription('Symbole').setRequired(true).addChoices(
        ...CRYPTOS.map(s => ({ name: s, value: s }))
      ))
      .addIntegerOption(o => o.setName('montant').setDescription('Montant en €').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('vendre').setDescription('💰 Vendre une crypto')
      .addStringOption(o => o.setName('crypto').setDescription('Symbole').setRequired(true).addChoices(
        ...CRYPTOS.map(s => ({ name: s, value: s }))
      ))
      .addNumberOption(o => o.setName('quantite').setDescription('Quantité à vendre').setRequired(true).setMinValue(0.000001)))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top investisseurs')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId) || {};
    const coin = cfg.currency_emoji || '€';

    if (sub === 'marche') {
      const lines = CRYPTOS.map(s => {
        const { price, change24h } = getCryptoPrice(s);
        const arrow = change24h >= 0 ? '📈' : '📉';
        const sign = change24h >= 0 ? '+' : '';
        return `**${s}** — \`${price < 1 ? price.toFixed(6) : price.toFixed(2)} ${coin}\` ${arrow} \`${sign}${change24h}%\``;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F7931A')
          .setTitle('📈 Marché Crypto NexusBot')
          .setDescription(lines)
          .setFooter({ text: 'Prix mis à jour chaque heure • Cours simulés' })
          .setTimestamp()
      ]});
    }

    if (sub === 'portefeuille') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const portfolio = db.db.prepare('SELECT * FROM crypto_portfolio WHERE guild_id=? AND user_id=? AND quantite > 0').all(guildId, target.id);
      if (!portfolio.length) return interaction.editReply({ content: `❌ <@${target.id}> n'a aucun investissement.`, ephemeral: true });

      let totalValue = 0;
      const lines = portfolio.map(p => {
        const { price } = getCryptoPrice(p.symbol);
        const value = p.quantite * price;
        const gain = value - (p.quantite * p.cout_moyen);
        const gainPct = ((gain / (p.quantite * p.cout_moyen)) * 100).toFixed(1);
        totalValue += value;
        return `**${p.symbol}** — ${p.quantite.toFixed(6)} unités — \`${value.toFixed(2)} ${coin}\` (${gain >= 0 ? '📈 +' : '📉 '}${gainPct}%)`;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F7931A')
          .setTitle(`💼 Portefeuille Crypto — ${target.username}`)
          .setDescription(lines)
          .addFields({ name: '💎 Valeur totale', value: `**${totalValue.toFixed(2)} ${coin}**`, inline: true })
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'acheter') {
      const symbol = interaction.options.getString('crypto');
      const montant = interaction.options.getInteger('montant');
      const user = db.getUser(userId, guildId);
      if (!user) return interaction.editReply({ content: `❌ Compte introuvable.`, ephemeral: true });

      if (user.balance < montant) return interaction.editReply({ content: `❌ Tu n'as pas assez de ${coin}. Tu as **${(user.balance||0).toLocaleString('fr-FR')} ${coin}**.`, ephemeral: true });

      const { price } = getCryptoPrice(symbol);
      const qte = montant / price;

      db.addCoins(userId, guildId, -montant);

      const existing = db.db.prepare('SELECT * FROM crypto_portfolio WHERE guild_id=? AND user_id=? AND symbol=?').get(guildId, userId, symbol);
      if (existing) {
        const newQte = existing.quantite + qte;
        const newCost = (existing.quantite * existing.cout_moyen + montant) / newQte;
        db.db.prepare('UPDATE crypto_portfolio SET quantite=?, cout_moyen=? WHERE id=?').run(newQte, newCost, existing.id);
      } else {
        db.db.prepare('INSERT INTO crypto_portfolio (guild_id, user_id, symbol, quantite, cout_moyen) VALUES (?,?,?,?,?)').run(guildId, userId, symbol, qte, price);
      }

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('Green')
          .setTitle(`✅ Achat de ${symbol}`)
          .addFields(
            { name: '💸 Investi', value: `**${montant} ${coin}**`, inline: true },
            { name: '📦 Quantité achetée', value: `**${qte.toFixed(6)} ${symbol}**`, inline: true },
            { name: '💲 Prix unitaire', value: `**${price.toFixed(4)} ${coin}**`, inline: true },
          )
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'vendre') {
      const symbol = interaction.options.getString('crypto');
      const qteVente = interaction.options.getNumber('quantite');
      const existing = db.db.prepare('SELECT * FROM crypto_portfolio WHERE guild_id=? AND user_id=? AND symbol=?').get(guildId, userId, symbol);

      if (!existing || existing.quantite < qteVente) return interaction.editReply({ content: `❌ Tu n'as pas assez de **${symbol}**.`, ephemeral: true });

      const { price } = getCryptoPrice(symbol);
      const gain = qteVente * price;
      const gainNet = gain - (qteVente * existing.cout_moyen);

      db.addCoins(userId, guildId, Math.floor(gain));

      const newQte = existing.quantite - qteVente;
      if (newQte < 0.000001) {
        db.db.prepare('DELETE FROM crypto_portfolio WHERE id=?').run(existing.id);
      } else {
        db.db.prepare('UPDATE crypto_portfolio SET quantite=? WHERE id=?').run(newQte, existing.id);
      }

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(gainNet >= 0 ? 'Green' : 'Red')
          .setTitle(`${gainNet >= 0 ? '📈 Vente profitable !' : '📉 Vente à perte'} — ${symbol}`)
          .addFields(
            { name: '📦 Vendu', value: `**${qteVente.toFixed(6)} ${symbol}**`, inline: true },
            { name: '💰 Reçu', value: `**${Math.floor(gain)} ${coin}**`, inline: true },
            { name: `${gainNet >= 0 ? '✅ Bénéfice' : '❌ Perte'}`, value: `**${gainNet >= 0 ? '+' : ''}${gainNet.toFixed(0)} ${coin}**`, inline: true },
          )
          .setTimestamp()
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const portfolios = db.db.prepare('SELECT user_id, SUM(quantite * ?) as val FROM crypto_portfolio WHERE guild_id=? GROUP BY user_id ORDER BY val DESC LIMIT 10').all(1, guildId);
      if (!portfolios.length) return interaction.editReply({ content: '❌ Aucun investissement sur ce serveur.', ephemeral: true });

      const medals = ['🥇', '🥈', '🥉'];
      const lines = portfolios.map((p, i) => `${medals[i] || `**${i+1}.**`} <@${p.user_id}>`).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F7931A').setTitle('🏆 Top Investisseurs Crypto').setDescription(lines).setTimestamp()
      ], ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
