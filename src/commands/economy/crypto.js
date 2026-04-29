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

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


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
      emoji: c.emoji || '€',
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
      .addStringOption(o => o.setName('quantite').setDescription('Quantité (ex: 0.05, all)').setRequired(true).setMaxLength(20)))
    .addSubcommand(s => s.setName('donner').setDescription('Envoyer de la crypto à un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
      .addStringOption(o => o.setName('crypto').setDescription('Symbole (BTC, ETH, SOL…)').setRequired(true).setMaxLength(10))
      .addStringOption(o => o.setName('quantite').setDescription('Quantité à envoyer (ex: 0.05, all, 50%)').setRequired(true).setMaxLength(20))),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* déjà ack */ }
    }

    const cfg  = db.getConfig(interaction.guildId);
    const user = db.getUser(interaction.user.id, interaction.guildId);
    const sub  = interaction.options.getSubcommand();

    if (sub === 'marche') {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildMarketEmbed(cfg, interaction.user.id, interaction.guildId)], components: buildButtons(interaction.user.id) });
    }
    if (sub === 'portefeuille') {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildWalletEmbed(cfg, interaction.user.id, interaction.guildId, user)], components: buildButtons(interaction.user.id) });
    }
    if (sub === 'acheter') {
      const sym = interaction.options.getString('crypto').toUpperCase();
      const raw = interaction.options.getString('montant');
      const amt = parseAmount(raw, user.balance);
      if (amt == null || amt < 1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Montant invalide.', ephemeral: true });
      try {
        const res = db.buyCrypto(interaction.user.id, interaction.guildId, sym, amt);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('🟢 Achat effectué')
          .setDescription(`Tu as acheté **${res.qty.toFixed(6)} ${res.symbol}** au prix de **${fmtPrice(res.price)}${cfg.currency_emoji || '€'}** pour un total de **${amt.toLocaleString('fr-FR')}${cfg.currency_emoji || '€'}**.`)
          .setFooter({ text: '/crypto portefeuille pour voir ton solde' })
        ], components: buildButtons(interaction.user.id) });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${e.message}`, ephemeral: true });
      }
    }
    if (sub === 'vendre') {
      const sym = interaction.options.getString('crypto').toUpperCase();
      const raw = interaction.options.getString('quantite');
      const item = db.getWalletItem(interaction.user.id, interaction.guildId, sym);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu ne possèdes pas de ${sym}.`, ephemeral: true });
      const qty = parseQty(raw, item.amount);
      if (qty == null || qty <= 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Quantité invalide.', ephemeral: true });
      try {
        const res = db.sellCrypto(interaction.user.id, interaction.guildId, sym, qty);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
          .setTitle('🔴 Vente effectuée')
          .setDescription(`Tu as vendu **${res.qtySold.toFixed(6)} ${sym}** à **${fmtPrice(res.price)}${cfg.currency_emoji || '€'}** = **+${res.coins.toLocaleString('fr-FR')}${cfg.currency_emoji || '€'}** dans ton solde.`)
        ], components: buildButtons(interaction.user.id) });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${e.message}`, ephemeral: true });
      }
    }
    if (sub === 'donner') {
      const target = interaction.options.getUser('membre');
      const sym    = interaction.options.getString('crypto').toUpperCase();
      const raw    = interaction.options.getString('quantite');

      if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas t\'envoyer de la crypto à toi-même.', ephemeral: true });
      if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible d\'envoyer de la crypto à un bot.', ephemeral: true });

      // Vérifier que la crypto existe dans le marché
      const marketItem = db.getCryptoPrice(sym);
      if (!marketItem) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Crypto **${sym}** inconnue. Utilise un symbole valide : BTC, ETH, SOL, BNB, XRP, DOGE, ADA, LINK, AVAX, DOT, MATIC, SHIB.`, ephemeral: true });

      // Vérifier le solde de l'expéditeur
      const senderItem = db.getWalletItem(interaction.user.id, interaction.guildId, sym);
      if (!senderItem || senderItem.amount <= 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu ne possèdes pas de **${sym}**.`, ephemeral: true });

      const qty = parseQty(raw, senderItem.amount);
      if (qty == null || qty <= 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Quantité invalide.', ephemeral: true });
      if (qty > senderItem.amount) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${senderItem.amount.toFixed(6)} ${sym}**.`, ephemeral: true });

      const sym2    = cfg.currency_emoji || '€';
      const valeur  = qty * marketItem.price;
      const newSenderAmt = senderItem.amount - qty;

      // Retirer de l'expéditeur
      if (newSenderAmt < 0.000000001) {
        db.db.prepare('DELETE FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').run(interaction.user.id, interaction.guildId, sym);
      } else {
        db.db.prepare('UPDATE crypto_wallet SET amount = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ? AND guild_id = ? AND crypto = ?')
          .run(newSenderAmt, interaction.user.id, interaction.guildId, sym);
      }

      // Ajouter au destinataire (avg_buy = prix actuel du marché pour refléter la valeur reçue)
      const targetItem = db.getWalletItem(target.id, interaction.guildId, sym);
      const targetAmt  = targetItem ? targetItem.amount : 0;
      const targetAvg  = targetItem ? targetItem.avg_buy : marketItem.price;
      const newTargetAmt = targetAmt + qty;
      const newTargetAvg = newTargetAmt > 0 ? (targetAmt * targetAvg + qty * marketItem.price) / newTargetAmt : marketItem.price;

      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?, avg_buy = ?, updated_at = strftime('%s','now')
      `).run(target.id, interaction.guildId, sym, qty, newTargetAvg, qty, newTargetAvg);

      const emoji = marketItem.emoji || '€';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle(`${emoji} Transfert crypto réussi`)
          .setDescription(
            `Tu as envoyé **${qty.toFixed(6)} ${sym}** à ${target} !\n` +
            `Valeur : ≈ **${Math.floor(valeur).toLocaleString('fr-FR')}${sym2}** au prix actuel (**${fmtPrice(marketItem.price)}${sym2}/${sym}**)`
          )
          .addFields(
            { name: '📤 Envoyé',    value: `**-${qty.toFixed(6)} ${sym}**`, inline: true },
            { name: '💼 Restant',   value: `**${newSenderAmt.toFixed(6)} ${sym}**`, inline: true },
          )
          .setFooter({ text: '/crypto portefeuille pour voir ton solde' })
          .setTimestamp()
        ],
        components: buildButtons(interaction.user.id),
      });
    }
  },

  name: 'crypto2',
  aliases: ['cryptomarche'],
  async run(message, args) {
    const sub = args[0] || 'marche';
    const fake = mkFake(message, {
      getSubcommand: () => sub,
      getString: (k) => args[1] || null,
    });
    await this.execute(fake);
  },
};
;

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
