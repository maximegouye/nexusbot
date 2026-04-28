/**
 * &crypto [action] [args...] — Trading crypto.
 *   &crypto                     → marché
 *   &crypto portefeuille        → mon portefeuille
 *   &crypto acheter BTC 500     → acheter 500 € de BTC
 *   &crypto vendre BTC 0.01     → vendre 0.01 BTC (ou all)
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function fmtPrice(p) {
  if (p >= 1000) return p.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(2);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(8);
}

function buildButtons(userId) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`crypto_market:${userId}`).setLabel('📊 Marché').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`crypto_wallet:${userId}`).setLabel('💼 Mon portefeuille').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`crypto_buy:${userId}`).setLabel('🟢 Acheter').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`crypto_sell:${userId}`).setLabel('🔴 Vendre').setStyle(ButtonStyle.Danger),
  )];
}

function parseAmount(raw, balance) {
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout') return balance;
  if (s === 'half' || s === '50%' || s === 'moitié' || s === 'moitie') return Math.floor(balance / 2);
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === '%') return Math.floor(balance * Math.min(100, n) / 100);
  return Math.floor(n);
}
function parseQty(raw, available) {
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout') return available;
  if (s === 'half' || s === '50%') return available / 2;
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2] === '%') return available * Math.min(100, n) / 100;
  return n;
}

module.exports = {
  name: 'crypto',
  aliases: ['bourse', 'trading'],
  description: 'Trading crypto — marché, portefeuille, acheter, vendre',
  category: 'Économie',
  cooldown: 3,

  async run(message, args, client, db) {
    const cfg  = db.getConfig(message.guild.id);
    const user = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const sub = (args[0] || 'marche').toLowerCase();

    if (sub === 'acheter' || sub === 'buy') {
      const sym = (args[1] || '').toUpperCase();
      const raw = args[2];
      if (!sym || !raw) return message.reply('💡 Usage : `&crypto acheter <SYMBOLE> <montant>`. Ex : `&crypto acheter BTC 1000`.');
      const amt = parseAmount(raw, user.balance);
      if (amt == null || amt < 1) return message.reply('❌ Montant invalide.');
      try {
        const res = db.buyCrypto(message.author.id, message.guild.id, sym, amt);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('🟢 Achat effectué')
          .setDescription(`Tu as acheté **${res.qty.toFixed(6)} ${res.symbol}** à **${fmtPrice(res.price)}${symbol}** pour **${amt.toLocaleString('fr-FR')}${symbol}**.`)
        ], components: buildButtons(message.author.id), allowedMentions: { repliedUser: false } });
      } catch (e) { return message.reply(`❌ ${e.message}`); }
    }

    if (sub === 'vendre' || sub === 'sell') {
      const sym = (args[1] || '').toUpperCase();
      const raw = args[2];
      if (!sym || !raw) return message.reply('💡 Usage : `&crypto vendre <SYMBOLE> <quantité>`. Ex : `&crypto vendre BTC 0.01`, `&crypto vendre BTC all`.');
      const item = db.getWalletItem(message.author.id, message.guild.id, sym);
      if (!item) return message.reply(`❌ Tu ne possèdes pas de ${sym}.`);
      const qty = parseQty(raw, item.amount);
      if (qty == null || qty <= 0) return message.reply('❌ Quantité invalide.');
      try {
        const res = db.sellCrypto(message.author.id, message.guild.id, sym, qty);
        return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('🔴 Vente effectuée')
          .setDescription(`Tu as vendu **${res.qtySold.toFixed(6)} ${sym}** à **${fmtPrice(res.price)}${symbol}** = **+${res.coins.toLocaleString('fr-FR')}${symbol}** dans ton solde.`)
        ], components: buildButtons(message.author.id), allowedMentions: { repliedUser: false } });
      } catch (e) { return message.reply(`❌ ${e.message}`); }
    }

    // Par défaut : marché ou portefeuille
    const isWallet = sub === 'portefeuille' || sub === 'wallet' || sub === 'porte' || sub === 'p';
    if (isWallet) {
      const wallet = db.getWallet(message.author.id, message.guild.id);
      const market = new Map(db.getCryptoMarket().map(c => [c.symbol, c]));
      let totalValue = 0;
      const lines = wallet.map(w => {
        const m = market.get(w.crypto);
        if (!m) return null;
        const value = w.amount * m.price;
        totalValue += value;
        const profit = (m.price - w.avg_buy) * w.amount;
        const arrow = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
        return `${m.emoji} **${w.crypto}** — ${w.amount.toFixed(6)} × ${fmtPrice(m.price)}${symbol}\n${arrow} Valeur : **${Math.floor(value).toLocaleString('fr-FR')}${symbol}**`;
      }).filter(Boolean).join('\n\n');
      return message.reply({
        embeds: [new EmbedBuilder().setColor(cfg.color || '#2ECC71').setTitle('💼 Portefeuille crypto')
          .setDescription(lines || '*Aucune crypto.*\n\nUtilise `&crypto acheter <SYM> <montant>` pour commencer.')
          .addFields(
            { name: '💰 Valeur totale', value: `**${Math.floor(totalValue).toLocaleString('fr-FR')}${symbol}**`, inline: true },
            { name: `${symbol} Solde`,   value: `**${user.balance.toLocaleString('fr-FR')}${symbol}**`,          inline: true },
          )
        ],
        components: buildButtons(message.author.id),
        allowedMentions: { repliedUser: false },
      });
    }

    // Marché
    const market = db.getCryptoMarket();
    const lines = market.map(c => {
      const delta = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
      const arrow = delta > 0.5 ? '🟢📈' : delta < -0.5 ? '🔴📉' : '⚪';
      return `${c.emoji} **${c.symbol}** · ${c.name}\n${arrow} **${fmtPrice(c.price)} ${symbol}** (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`;
    }).join('\n\n');
    return message.reply({
      embeds: [new EmbedBuilder().setColor(cfg.color || '#F39C12').setTitle('💰 Marché Crypto · NexusExchange')
        .setDescription(lines || '*Marché vide.*')
        .setFooter({ text: 'Prix fluctuants · mis à jour toutes les 5 min · &crypto acheter / vendre' })
      ],
      components: buildButtons(message.author.id),
      allowedMentions: { repliedUser: false },
    });
  },
};
