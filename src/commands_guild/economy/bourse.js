const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bourse_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, symbol TEXT, name TEXT,
    price REAL DEFAULT 100, prev_price REAL DEFAULT 100,
    last_updated INTEGER DEFAULT 0,
    UNIQUE(guild_id, symbol)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bourse_portfolio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, symbol TEXT,
    quantity INTEGER DEFAULT 0, avg_buy_price REAL DEFAULT 0,
    UNIQUE(guild_id, user_id, symbol)
  )`).run();
} catch {}

const STOCKS = [
  { symbol: 'NXS', name: 'NexusCorp',      emoji: '🏢', volatility: 0.05 },
  { symbol: 'TCH', name: 'TechVision',     emoji: '💻', volatility: 0.08 },
  { symbol: 'GLD', name: 'GoldMine Inc',   emoji: '🥇', volatility: 0.03 },
  { symbol: 'CRY', name: 'CryptoBurst',    emoji: '₿',  volatility: 0.15 },
  { symbol: 'ENR', name: 'EnergyPlus',     emoji: '⚡', volatility: 0.06 },
  { symbol: 'FSH', name: 'FreshFood Co',   emoji: '🥗', volatility: 0.04 },
  { symbol: 'MED', name: 'MediHealth',     emoji: '💊', volatility: 0.07 },
  { symbol: 'SPX', name: 'SpaceXcel',      emoji: '🚀', volatility: 0.12 },
];

function getOrInitStock(guildId) {
  const now = Math.floor(Date.now() / 1000);
  const stocks = [];
  for (const s of STOCKS) {
    let row = db.db.prepare('SELECT * FROM bourse_actions WHERE guild_id=? AND symbol=?').get(guildId, s.symbol);
    if (!row) {
      const initPrice = 50 + Math.random() * 200;
      db.db.prepare('INSERT INTO bourse_actions (guild_id, symbol, name, price, prev_price, last_updated) VALUES (?,?,?,?,?,?)')
        .run(guildId, s.symbol, s.name, initPrice, initPrice, now);
      row = db.db.prepare('SELECT * FROM bourse_actions WHERE guild_id=? AND symbol=?').get(guildId, s.symbol);
    }

    // Mettre à jour les prix toutes les 30 minutes
    if (now - row.last_updated > 1800) {
      const change = 1 + (Math.random() * 2 - 1) * s.volatility;
      const newPrice = Math.max(1, row.price * change);
      db.db.prepare('UPDATE bourse_actions SET prev_price=price, price=?, last_updated=? WHERE guild_id=? AND symbol=?')
        .run(newPrice, now, guildId, s.symbol);
      row.prev_price = row.price;
      row.price = newPrice;
    }
    stocks.push({ ...s, ...row });
  }
  return stocks;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bourse')
    .setDescription('📈 Bourse virtuelle — Achetez et vendez des actions !')
    .addSubcommand(s => s.setName('marche').setDescription('📊 Voir le marché boursier actuel'))
    .addSubcommand(s => s.setName('acheter').setDescription('💰 Acheter des actions')
      .addStringOption(o => o.setName('action').setDescription('Symbole de l\'action').setRequired(true))
      .addIntegerOption(o => o.setName('quantite').setDescription('Quantité à acheter').setRequired(true).setMinValue(1).setMaxValue(100)))
    .addSubcommand(s => s.setName('vendre').setDescription('💸 Vendre des actions')
      .addStringOption(o => o.setName('action').setDescription('Symbole de l\'action').setRequired(true))
      .addIntegerOption(o => o.setName('quantite').setDescription('Quantité à vendre').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('portefeuille').setDescription('💼 Voir votre portefeuille d\'actions')
      .addUserOption(o => o.setName('membre').setDescription('Voir le portefeuille d\'un membre')))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top des investisseurs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const stocks = getOrInitStock(guildId);

    if (sub === 'marche') {
      const lines = stocks.map(s => {
        const change = ((s.price - s.prev_price) / s.prev_price * 100).toFixed(2);
        const arrow = s.price >= s.prev_price ? '📈' : '📉';
        const sign = s.price >= s.prev_price ? '+' : '';
        return `${s.emoji} **${s.symbol}** — ${Math.round(s.price)} ${coin} ${arrow} ${sign}${change}%\n> *${s.name}*`;
      }).join('\n\n');

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('📊 Marché Boursier')
          .setDescription(lines)
          .setFooter({ text: 'Prix mis à jour toutes les 30 minutes' })
      ]});
    }

    if (sub === 'acheter') {
      const symbol = interaction.options.getString('action').toUpperCase();
      const qty = interaction.options.getInteger('quantite');
      const stock = stocks.find(s => s.symbol === symbol);
      if (!stock) return interaction.reply({ content: `❌ Action **${symbol}** introuvable. Voir \`/bourse marche\`.`, ephemeral: true });

      const total = Math.round(stock.price * qty);
      const u = db.getUser(userId, guildId);
      if (u.balance < total) return interaction.reply({ content: `❌ Solde insuffisant. Coût: **${total} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -total);
      const existing = db.db.prepare('SELECT * FROM bourse_portfolio WHERE guild_id=? AND user_id=? AND symbol=?').get(guildId, userId, symbol);
      if (existing) {
        const newQty = existing.quantity + qty;
        const newAvg = (existing.avg_buy_price * existing.quantity + stock.price * qty) / newQty;
        db.db.prepare('UPDATE bourse_portfolio SET quantity=?, avg_buy_price=? WHERE guild_id=? AND user_id=? AND symbol=?').run(newQty, newAvg, guildId, userId, symbol);
      } else {
        db.db.prepare('INSERT INTO bourse_portfolio (guild_id, user_id, symbol, quantity, avg_buy_price) VALUES (?,?,?,?,?)').run(guildId, userId, symbol, qty, stock.price);
      }

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Achat effectué !')
          .setDescription(`Vous avez acheté **${qty}x ${stock.emoji} ${stock.symbol}** pour **${total} ${coin}**`)
          .addFields({ name: '💰 Prix unitaire', value: `${Math.round(stock.price)} ${coin}`, inline: true })
      ]});
    }

    if (sub === 'vendre') {
      const symbol = interaction.options.getString('action').toUpperCase();
      const qty = interaction.options.getInteger('quantite');
      const stock = stocks.find(s => s.symbol === symbol);
      if (!stock) return interaction.reply({ content: `❌ Action **${symbol}** introuvable.`, ephemeral: true });

      const portfolio = db.db.prepare('SELECT * FROM bourse_portfolio WHERE guild_id=? AND user_id=? AND symbol=?').get(guildId, userId, symbol);
      if (!portfolio || portfolio.quantity < qty) return interaction.reply({ content: `❌ Vous n'avez pas assez de **${symbol}** (vous en avez ${portfolio?.quantity || 0}).`, ephemeral: true });

      const total = Math.round(stock.price * qty);
      const profit = Math.round((stock.price - portfolio.avg_buy_price) * qty);
      db.addCoins(userId, guildId, total);

      if (portfolio.quantity === qty) {
        db.db.prepare('DELETE FROM bourse_portfolio WHERE guild_id=? AND user_id=? AND symbol=?').run(guildId, userId, symbol);
      } else {
        db.db.prepare('UPDATE bourse_portfolio SET quantity=quantity-? WHERE guild_id=? AND user_id=? AND symbol=?').run(qty, guildId, userId, symbol);
      }

      const profitSign = profit >= 0 ? '+' : '';
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(profit >= 0 ? '#2ECC71' : '#E74C3C').setTitle('💸 Vente effectuée !')
          .setDescription(`Vous avez vendu **${qty}x ${stock.emoji} ${stock.symbol}** pour **${total} ${coin}**`)
          .addFields(
            { name: '📊 P&L', value: `**${profitSign}${profit} ${coin}**`, inline: true },
            { name: '💰 Prix unitaire', value: `${Math.round(stock.price)} ${coin}`, inline: true },
          )
      ]});
    }

    if (sub === 'portefeuille') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const portfolio = db.db.prepare('SELECT * FROM bourse_portfolio WHERE guild_id=? AND user_id=?').all(guildId, target.id);

      if (!portfolio.length) return interaction.reply({ content: `❌ ${target.id === userId ? 'Votre portefeuille est vide.' : `<@${target.id}> n'a aucune action.`}`, ephemeral: true });

      let totalValue = 0;
      let totalCost = 0;
      const lines = portfolio.map(p => {
        const s = stocks.find(st => st.symbol === p.symbol) || { price: 0, emoji: '📊' };
        const value = Math.round(s.price * p.quantity);
        const cost = Math.round(p.avg_buy_price * p.quantity);
        const pnl = value - cost;
        const sign = pnl >= 0 ? '+' : '';
        totalValue += value;
        totalCost += cost;
        return `${s.emoji} **${p.symbol}** x${p.quantity} — Valeur: ${value} ${coin} (${sign}${pnl} ${coin})`;
      }).join('\n');

      const totalPnl = totalValue - totalCost;
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor(totalPnl >= 0 ? '#2ECC71' : '#E74C3C').setTitle(`💼 Portefeuille de ${target.username}`)
          .setDescription(lines)
          .addFields(
            { name: '💰 Valeur totale', value: `**${totalValue} ${coin}**`, inline: true },
            { name: '📊 P&L total', value: `**${totalPnl >= 0 ? '+' : ''}${totalPnl} ${coin}**`, inline: true },
          )
      ], ephemeral: target.id !== userId });
    }

    if (sub === 'classement') {
      const portfolios = db.db.prepare('SELECT user_id, SUM(quantity * avg_buy_price) as invested FROM bourse_portfolio WHERE guild_id=? GROUP BY user_id ORDER BY invested DESC LIMIT 10').all(guildId);
      if (!portfolios.length) return interaction.reply({ content: '❌ Aucun investisseur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = portfolios.map((p, i) => `${medals[i] || `**${i+1}.**`} <@${p.user_id}> — 💰 ${Math.round(p.invested)} ${coin} investis`).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Investisseurs').setDescription(lines)
      ]});
    }
  }
};
