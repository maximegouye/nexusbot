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
  },


  async handleComponent(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
    const db   = require('../../database/db');
    const cid  = interaction.customId;
    const { _build } = module.exports;

    // Boutons de navigation (marché / portefeuille / acheter / vendre)
    if (interaction.isButton() && (
      cid.startsWith('crypto_market:') || cid.startsWith('crypto_wallet:') ||
      cid.startsWith('crypto_buy:')    || cid.startsWith('crypto_sell:')
    )) {
      const cfg    = db.getConfig(interaction.guildId);
      const user   = db.getUser(interaction.user.id, interaction.guildId);
      const symbol = cfg.currency_emoji || '€';
      const action = cid.split(':')[0].replace('crypto_', '');
      const uid    = cid.split(':')[1];

      if (action === 'market') {
        return interaction.update({ embeds: [_build.buildMarketEmbed(cfg, uid, interaction.guildId)], components: _build.buildButtons(uid) });
      }
      if (action === 'wallet') {
        return interaction.update({ embeds: [_build.buildWalletEmbed(cfg, uid, interaction.guildId, user)], components: _build.buildButtons(uid) });
      }
      if (action === 'buy' || action === 'sell') {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(action === 'buy' ? '#2ECC71' : '#E74C3C')
            .setTitle(action === 'buy' ? '🟢 Acheter une crypto' : '🔴 Vendre une crypto')
            .setDescription(action === 'buy'
              ? `Sélectionne la crypto à acheter.\n**Ton solde :** ${user.balance.toLocaleString('fr-FR')}${symbol}`
              : `Sélectionne la crypto à vendre dans le menu ci-dessous.`)
            .setFooter({ text: 'Prix CoinGecko · mis à jour toutes les 5 min' })
          ],
          components: [_build.buildCryptoSelect(uid, action)],
          ephemeral: true,
        });
      }
      return false;
    }

    // Select menu : choix de la crypto → ouvre modal montant
    if (interaction.isStringSelectMenu() && cid.startsWith('crypto_pick:')) {
      const parts = cid.split(':');
      const mode  = parts[1];
      const uid   = parts[2];
      if (interaction.user.id !== uid) {
        return interaction.reply({ content: "❌ Ce menu ne t'appartient pas.", ephemeral: true });
      }
      const sym   = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`crypto_modal:${mode}:${sym}:${uid}`)
        .setTitle(mode === 'buy' ? `🟢 Acheter ${sym}` : `🔴 Vendre ${sym}`);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('amount')
          .setLabel(mode === 'buy' ? 'Montant en coins (ou all, 50%)' : 'Quantité (ou all, 50%)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder(mode === 'buy' ? 'Ex : 1000, all, 25%' : 'Ex : 0.5, all, 50%')
          .setMaxLength(30)
      ));
      return interaction.showModal(modal);
    }

    // Modal submit : acheter / vendre
    if (interaction.isModalSubmit() && cid.startsWith('crypto_modal:')) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const db2  = require('../../database/db');
      const cfg  = db2.getConfig(interaction.guildId);
      const sym  = cfg.currency_emoji || '€';
      const parts = cid.split(':');
      const mode  = parts[1];
      const coin  = parts[2];
      const uid   = parts[3];
      const raw   = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
      const user  = db2.getUser(uid, interaction.guildId);

      const parseBet = (raw, base) => {
        const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
        if (['all','tout','max'].includes(s)) return Number(base);
        if (['half','moitié','moitie','50%'].includes(s)) return Number(base) / 2;
        const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
        if (!m) return NaN;
        const n = parseFloat(m[1]);
        return m[2] === '%' ? (n / 100) * Number(base) : n;
      };

      try {
        if (mode === 'buy') {
          const coins = parseBet(raw, user.balance);
          if (!Number.isFinite(coins) || coins < 1)
            return interaction.editReply({ content: '❌ Montant invalide (min 1).' });
          if (coins > user.balance)
            return interaction.editReply({ content: `❌ Solde insuffisant (${user.balance.toLocaleString('fr-FR')}${sym}).` });
          const res = db2.buyCrypto(uid, interaction.guildId, coin, Math.floor(coins));
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
            .setTitle('✅ Achat effectué')
            .setDescription(`Tu as acheté **${res.qty.toFixed(6)} ${res.symbol}** au prix de **${_build.fmtPrice(res.price)}${sym}** pour **${Math.floor(coins).toLocaleString('fr-FR')}${sym}**.`)
            .setFooter({ text: '/crypto portefeuille pour voir tes positions' })
          ] });
        } else {
          const item = db2.getWalletItem(uid, interaction.guildId, coin);
          if (!item || item.amount <= 0)
            return interaction.editReply({ content: `❌ Tu ne possèdes pas de ${coin}.` });
          const qty = parseBet(raw, item.amount);
          if (!Number.isFinite(qty) || qty <= 0)
            return interaction.editReply({ content: '❌ Quantité invalide.' });
          if (qty > item.amount + 0.00001)
            return interaction.editReply({ content: `❌ Tu n'as que ${item.amount.toFixed(6)} ${coin}.` });
          const res = db2.sellCrypto(uid, interaction.guildId, coin, qty);
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#E67E22')
            .setTitle('✅ Vente effectuée')
            .setDescription(`Tu as vendu **${res.qtySold.toFixed(6)} ${coin}** = **+${res.coins.toLocaleString('fr-FR')}${sym}** dans ton solde.`)
          ] });
        }
      } catch (e) {
        return interaction.editReply({ content: `❌ Erreur : ${e.message}` });
      }
    }

    return false;
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
