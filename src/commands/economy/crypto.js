/**
 * /crypto — Marché crypto RÉEL · portefeuille · trading.
 *
 * 12 vraies cryptos avec prix en direct depuis CoinGecko :
 *   BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK, AVAX, DOT, MATIC, SHIB
 *
 * Les prix sont mis à jour toutes les 5 minutes via l'API publique CoinGecko
 * (voir src/utils/cryptoPriceWorker.js).
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../../database/db');

// Menu déroulant qui liste toutes les cryptos avec leur prix réel en direct
function buildCryptoSelect(userId, mode /* 'buy' | 'sell' */) {
  const market = db.getCryptoMarket();
  const options = market.slice(0, 25).map(c => {
    const delta = Number.isFinite(c.change_24h) ? c.change_24h : 0;
    const arrow = delta > 0.5 ? '🟢' : delta < -0.5 ? '🔴' : '⚪';
    return {
      label: `${c.symbol} · ${c.name}`,
      value: c.symbol,
      description: `${fmtPrice(c.price)} $ ${arrow} ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} % (24 h)`,
      emoji: c.emoji || '🪙',
    };
  });
  const placeholder = mode === 'buy' ? '🟢 Choisis la crypto à acheter' : '🔴 Choisis la crypto à vendre';
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`crypto_pick:${mode}:${userId}`)
      .setPlaceholder(placeholder)
      .addOptions(options)
  );
}

function fmtPrice(p) {
  if (p >= 1000)   return p.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (p >= 1)      return p.toFixed(2);
  if (p >= 0.01)   return p.toFixed(4);
  return p.toFixed(8);
}

function buildMarketEmbed(cfg, userId, guildId) {
  const market = db.getCryptoMarket();
  const symbol = cfg.currency_emoji || '€';

  // Les prix CoinGecko sont en USD. On convertit en currency du serveur (1 USD = 1 coin).
  const lines = market.map(c => {
    const delta24 = Number.isFinite(c.change_24h) ? c.change_24h : 0;
    const delta   = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
    const arrow24 = delta24 > 0.5 ? '🟢' : delta24 < -0.5 ? '🔴' : '⚪';
    const arrow5m = delta > 0.1 ? '📈' : delta < -0.1 ? '📉' : '';
    const change24Txt = `${arrow24} 24 h : **${delta24 >= 0 ? '+' : ''}${delta24.toFixed(2)} %**`;
    return `${c.emoji} **${c.symbol}** · ${c.name}\n**${fmtPrice(c.price)} ${symbol}** ${arrow5m}  ·  ${change24Txt}`;
  }).join('\n\n');

  // Date de mise à jour (prend la plus récente du marché)
  const lastUpd = Math.max(...market.map(c => c.updated_at || 0), 0);
  const ts = lastUpd ? `<t:${lastUpd}:R>` : 'à l\'instant';

  return new EmbedBuilder()
    .setColor(cfg.color || '#F39C12')
    .setTitle('💰 Marché Crypto — Prix réels (CoinGecko)')
    .setDescription(lines || '*Marché vide.*')
    .setFooter({ text: `📊 Prix réels · dernière maj : ${new Date(lastUpd * 1000).toLocaleTimeString('fr-FR')} · 1 coin = 1 USD` })
    .setTimestamp();
}

function buildWalletEmbed(cfg, userId, guildId, user) {
  const wallet = db.getWallet(userId, guildId);
  const market = new Map(db.getCryptoMarket().map(c => [c.symbol, c]));
  const symbol = cfg.currency_emoji || '€';

  let totalValue = 0;
  const lines = wallet.map(w => {
    const m = market.get(w.crypto);
    if (!m) return null;
    const value = w.amount * m.price;
    totalValue += value;
    const profit = (m.price - w.avg_buy) * w.amount;
    const profitPct = w.avg_buy > 0 ? ((m.price - w.avg_buy) / w.avg_buy) * 100 : 0;
    const arrow = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
    return `${m.emoji} **${w.crypto}** — ${w.amount.toFixed(6)} × ${fmtPrice(m.price)}${symbol}\n${arrow} Valeur : **${Math.floor(value).toLocaleString('fr-FR')}${symbol}** · PnL : ${profit >= 0 ? '+' : ''}${Math.floor(profit).toLocaleString('fr-FR')}${symbol} (${profitPct.toFixed(2)}%)`;
  }).filter(Boolean).join('\n\n');

  return new EmbedBuilder()
    .setColor(cfg.color || '#2ECC71')
    .setTitle(`💼 Portefeuille crypto`)
    .setDescription(lines || '*Aucune crypto.*\n\nUtilise **Acheter** pour commencer à trader.')
    .addFields(
      { name: `💰 Valeur totale`,     value: `**${Math.floor(totalValue).toLocaleString('fr-FR')}${symbol}**`,     inline: true },
      { name: `${symbol} Solde disponible`, value: `**${(user.balance || 0).toLocaleString('fr-FR')}${symbol}**`,     inline: true },
      { name: `🏦 Banque`,             value: `**${(user.bank || 0).toLocaleString('fr-FR')}${symbol}**`,         inline: true },
    )
    .setFooter({ text: '💼 Portefeuille · NexusBot' })
    .setTimestamp();
}

function buildButtons(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crypto_market:${userId}`).setLabel('📊 Marché').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`crypto_wallet:${userId}`).setLabel('💼 Mon portefeuille').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`crypto_buy:${userId}`).setLabel('🟢 Acheter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`crypto_sell:${userId}`).setLabel('🔴 Vendre').setStyle(ButtonStyle.Danger),
    ),
  ];
}

module.exports = {
  _build: { buildMarketEmbed, buildWalletEmbed, buildButtons, buildCryptoSelect, fmtPrice },
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('💰 Marché crypto · portefeuille · trading')
    .addSubcommand(s => s.setName('marche').setDescription('Voir le marché crypto'))
    .addSubcommand(s => s.setName('portefeuille').setDescription('Voir ton portefeuille'))
    .addSubcommand(s => s.setName('acheter').setDescription('Acheter une crypto')
      .addStringOption(o => o.setName('crypto').setDescription('Symbole (BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK, AVAX, DOT, MATIC, SHIB)').setRequired(true).setMaxLength(10))
      .addStringOption(o => o.setName('montant').setDescription('Montant en coins (ex: 500, all, 25%)').setRequired(true).setMaxLength(20)))
    .addSubcommand(s => s.setName('vendre').setDescription('Vendre une crypto')
      .addStringOption(o => o.setName('crypto').setDescription('Symbole').setRequired(true).setMaxLength(10))
      .addStringOption(o => o.setName('quantite').setDescription('Quantité (ex: 0.05, all)').setRequired(true).setMaxLength(20))),
  cooldown: 3,

  async execute(interaction) {
    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const sub  = interaction.options.getSubcommand();

    if (sub === 'marche') {
      return interaction.editReply({ embeds: [buildMarketEmbed(cfg, interaction.user.id, interaction.guildId)], components: buildButtons(interaction.user.id) });
    }
    if (sub === 'portefeuille') {
      return interaction.editReply({ embeds: [buildWalletEmbed(cfg, interaction.user.id, interaction.guildId, user)], components: buildButtons(interaction.user.id) });
    }
    if (sub === 'acheter') {
      const sym = interaction.options.getString('crypto').toUpperCase();
      const raw = interaction.options.getString('montant');
      const amt = parseAmount(raw, user.balance);
      if (amt == null || amt < 1) return interaction.editReply({ content: '❌ Montant invalide.', ephemeral: true });
      try {
        const res = db.buyCrypto(interaction.user.id, interaction.guildId, sym, amt);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('🟢 Achat effectué')
          .setDescription(`Tu as acheté **${res.qty.toFixed(6)} ${res.symbol}** au prix de **${fmtPrice(res.price)}${cfg.currency_emoji || '€'}** pour un total de **${amt.toLocaleString('fr-FR')}${cfg.currency_emoji || '€'}**.`)
          .setFooter({ text: '/crypto portefeuille pour voir ton solde' })
        ], components: buildButtons(interaction.user.id) });
      } catch (e) {
        return interaction.editReply({ content: `❌ ${e.message}`, ephemeral: true });
      }
    }
    if (sub === 'vendre') {
      const sym = interaction.options.getString('crypto').toUpperCase();
      const raw = interaction.options.getString('quantite');
      const item = db.getWalletItem(interaction.user.id, interaction.guildId, sym);
      if (!item) return interaction.editReply({ content: `❌ Tu ne possèdes pas de ${sym}.`, ephemeral: true });
      const qty = parseQty(raw, item.amount);
      if (qty == null || qty <= 0) return interaction.editReply({ content: '❌ Quantité invalide.', ephemeral: true });
      try {
        const res = db.sellCrypto(interaction.user.id, interaction.guildId, sym, qty);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('🔴 Vente effectuée')
          .setDescription(`Tu as vendu **${res.qtySold.toFixed(6)} ${sym}** à **${fmtPrice(res.price)}${cfg.currency_emoji || '€'}** = **+${res.coins.toLocaleString('fr-FR')}${cfg.currency_emoji || '€'}** dans ton solde.`)
        ], components: buildButtons(interaction.user.id) });
      } catch (e) {
        return interaction.editReply({ content: `❌ ${e.message}`, ephemeral: true });
      }
    }
  },
};

function parseAmount(raw, balance) {
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return balance;
  if (s === 'half' || s === 'moitié' || s === '50%') return Math.floor(balance / 2);
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === '%') return Math.floor(balance * Math.min(100, n) / 100);
  return Math.floor(n);
}

function parseQty(raw, available) {
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return available;
  if (s === 'half' || s === 'moitié' || s === '50%') return available / 2;
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === '%') return available * Math.min(100, n) / 100;
  return n;
}
