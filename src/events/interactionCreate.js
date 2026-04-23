const {
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      await _handleInteraction(interaction, client);
    } catch (err) {
      console.error('[INTERACTION] Erreur non gérée:', err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '❌ Une erreur est survenue. Réessaie ou contacte un admin.', ephemeral: true });
        } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
          await interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie ou contacte un admin.' });
        }
      } catch {}
    }
  }
};

async function _handleInteraction(interaction, client) {

    // ── PANNEAU DE CONFIGURATION (cfg: / cfg_chan: / cfg_role: / cfg_modal:) ──
    const _cfgId = interaction.customId || '';
    if (_cfgId.startsWith('cfg:') || _cfgId.startsWith('cfg_chan:') || _cfgId.startsWith('cfg_role:') || _cfgId.startsWith('cfg_modal:')) {
      const { handleConfigInteraction } = require('../utils/configPanel');
      const _db = require('../database/db');
      const _handled = await handleConfigInteraction(interaction, _db, client);
      if (_handled !== false) return;
    }

  // ── Route automatique des composants vers handleComponent ──
  if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
    const cid = interaction.customId || '';
    const COMPONENT_ROUTES = {
      'part_':        'partenariat',
      'travail_job_': 'travail',
      'peche_buy_':   'peche',
      'giveaway_':    'giveaway',
    };
    for (const [prefix, cmdName] of Object.entries(COMPONENT_ROUTES)) {
      if (cid.startsWith(prefix)) {
        const cmd = client.commands?.get(cmdName) || [...(client.commands?.values() || [])].find(c => c.data?.name === cmdName);
        if (cmd && typeof cmd.handleComponent === 'function') {
          return cmd.handleComponent(interaction).catch(e => console.error('[handleComponent]', cmdName, e));
        }
      }
    }
  }
    // ── BANQUE : boutons dep/ret/refresh + modals ───────────────────
    if (interaction.isButton() && _cfgId.startsWith('banque_')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const ef = require('../utils/embedFactory');
        const parts = _cfgId.split(':');
        const action = parts[0].replace('banque_', '');
        const uid = parts[1];
        if (interaction.user.id !== uid) {
          return interaction.reply({ content: '❌ Cette banque n\'est pas la tienne.', ephemeral: true });
        }

        if (action === 'refresh') {
          const { _build } = require('../commands/economy/banque');
          return interaction.update({ embeds: [_build.buildEmbed(user, cfg)], components: _build.buildButtons(uid) });
        }

        if (action === 'depall') {
          if (user.balance <= 0) return interaction.reply({ content: '❌ Tu n\'as rien à déposer.', ephemeral: true });
          db2.db.prepare('UPDATE users SET bank = bank + balance, balance = 0 WHERE user_id = ? AND guild_id = ?').run(uid, interaction.guildId);
          const user2 = db2.getUser(uid, interaction.guildId);
          const { _build } = require('../commands/economy/banque');
          return interaction.update({ embeds: [_build.buildEmbed(user2, cfg)], components: _build.buildButtons(uid) });
        }

        if (action === 'retall') {
          if (user.bank <= 0) return interaction.reply({ content: '❌ Ta banque est vide.', ephemeral: true });
          db2.db.prepare('UPDATE users SET balance = balance + bank, bank = 0 WHERE user_id = ? AND guild_id = ?').run(uid, interaction.guildId);
          const user2 = db2.getUser(uid, interaction.guildId);
          const { _build } = require('../commands/economy/banque');
          return interaction.update({ embeds: [_build.buildEmbed(user2, cfg)], components: _build.buildButtons(uid) });
        }

        if (action === 'dep' || action === 'ret') {
          const modal = new ModalBuilder()
            .setCustomId(`banque_${action}_modal:${uid}`)
            .setTitle(action === 'dep' ? '🟢 Déposer' : '🔴 Retirer');
          const input = new TextInputBuilder()
            .setCustomId('montant')
            .setLabel(`Montant (ex: 500, 10000, all, 50%)`)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(20)
            .setRequired(true);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
          return interaction.showModal(modal);
        }

        if (action === 'crypto') {
          const wallet = db2.getWallet(uid, interaction.guildId);
          const market = new Map((db2.getCryptoMarket() || []).map(c => [c.symbol, c]));
          let total = 0;
          const lines = wallet.map(w => {
            const m = market.get(w.crypto); if (!m) return null;
            const v = w.amount * m.price;
            total += v;
            return `${m.emoji} **${w.crypto}** — ${w.amount.toFixed(6)} = ${Math.floor(v).toLocaleString('fr-FR')}${symbol}`;
          }).filter(Boolean).join('\n') || '*Aucune crypto.*';
          return interaction.reply({
            embeds: [ef.money(`💹 Crypto`, lines + `\n\n**Valeur totale : ${Math.floor(total).toLocaleString('fr-FR')}${symbol}**`)],
            ephemeral: true,
          });
        }

        if (action === 'history') {
          // Ouvre l'historique inline en ephemeral
          const { _build } = require('../commands/economy/historique');
          const total = db2.countTransactions(uid, interaction.guildId);
          const rows  = db2.getTransactions(uid, interaction.guildId, _build.PAGE_SIZE, 0);
          const pages = Math.max(1, Math.ceil(total / _build.PAGE_SIZE));
          return interaction.reply({
            embeds: [_build.buildEmbed({ user: interaction.user, guild: interaction.guild, page: 1, total, rows, symbol, color: cfg.color || '#7C3AED' })],
            components: [_build.buildButtons(uid, 1, pages)],
            ephemeral: true,
          });
        }
        return;
      } catch (e) { console.error('[BANQUE handler]', e); }
    }

    // === GIVEAWAY : bouton participer ===
    if (interaction.isButton() && _cfgId.startsWith('giveaway_join_')) {
      try {
        const { handleGiveawayButton } = require('../commands_guild/unique/giveaway');
        await handleGiveawayButton(interaction);
        return;
      } catch (err) {
        console.error('[GIVEAWAY BUTTON]', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '\u274C Erreur lors du traitement.', ephemeral: true });
        }
      }
    }

    // ── BANQUE MODAL : dépôt/retrait avec montant ───────────────────
    if (interaction.isModalSubmit() && (_cfgId.startsWith('banque_dep_modal:') || _cfgId.startsWith('banque_ret_modal:'))) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const ef = require('../utils/embedFactory');
        const isDep = _cfgId.startsWith('banque_dep_modal:');
        const uid = _cfgId.split(':')[1];
        if (interaction.user.id !== uid) return interaction.reply({ content: '❌ Pas ta banque.', ephemeral: true });

        const raw = interaction.fields.getTextInputValue('montant').trim().toLowerCase();
        const user = db2.getUser(uid, interaction.guildId);
        const source = isDep ? user.balance : user.bank;

        let amount;
        const s = raw.replace(/[\s_,]/g, '');
        if (s === 'all' || s === 'tout' || s === 'max') amount = source;
        else if (s === 'half' || s === '50%' || s === 'moitié' || s === 'moitie') amount = Math.floor(source / 2);
        else {
          const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
          if (!m) return interaction.reply({ embeds: [ef.error('Montant invalide', 'Ex : 500 · 10000 · all · 50% · moitié')], ephemeral: true });
          amount = m[2] === '%' ? Math.floor(source * Math.min(100, parseFloat(m[1])) / 100) : Math.floor(parseFloat(m[1]));
        }
        if (amount < 1 || amount > source) return interaction.reply({ embeds: [ef.error('Montant hors limites', `Disponible : **${source.toLocaleString('fr-FR')}${symbol}**`)], ephemeral: true });

        if (isDep) {
          db2.db.prepare('UPDATE users SET balance = balance - ?, bank = bank + ? WHERE user_id = ? AND guild_id = ?').run(amount, amount, uid, interaction.guildId);
        } else {
          db2.db.prepare('UPDATE users SET balance = balance + ?, bank = bank - ? WHERE user_id = ? AND guild_id = ?').run(amount, amount, uid, interaction.guildId);
        }

        const user2 = db2.getUser(uid, interaction.guildId);
        const { _build } = require('../commands/economy/banque');
        return interaction.reply({ embeds: [_build.buildEmbed(user2, cfg)], components: _build.buildButtons(uid) });
      } catch (e) { console.error('[BANQUE modal]', e); }
    }

    // ── CASINO MENU : boutons jeu + stats + top ────────────────────
    if (interaction.isButton() && _cfgId.startsWith('casino_')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const parts = _cfgId.split(':');
        const action = parts[0].replace('casino_', '');
        const uid = parts[1];

        const { EmbedBuilder } = require('discord.js');

        if (action === 'stats') {
          const stats = db2.getGameStats(interaction.user.id, interaction.guildId);
          if (!stats.length) {
            return interaction.reply({ content: '📊 Aucune partie jouée pour l\'instant. Lance un jeu !', ephemeral: true });
          }
          const lines = stats.sort((a, b) => b.played - a.played).map(g => {
            const wr = g.played > 0 ? Math.round(g.won / g.played * 100) : 0;
            const net = (g.total_won - g.total_bet);
            return `**${g.game}** — ${g.played} parties · ${g.won}✅/${g.lost}❌ (${wr}%) · net ${net >= 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}`;
          }).join('\n');
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(cfg.color || '#E67E22').setTitle(`📊 Stats détaillées — ${interaction.user.username}`).setDescription(lines)],
            ephemeral: true,
          });
        }

        if (action === 'top') {
          // Top par biggest_win
          const top = db2.db.prepare(`
            SELECT user_id, SUM(biggest_win) as big, SUM(total_won) as won, SUM(played) as played
            FROM game_stats WHERE guild_id = ? GROUP BY user_id ORDER BY big DESC LIMIT 10
          `).all(interaction.guildId);
          const lines = top.map((r, i) => `${['🥇','🥈','🥉'][i] || `**${i+1}.**`} <@${r.user_id}> · plus gros gain : **${(r.big || 0).toLocaleString('fr-FR')}${symbol}** · ${r.played} parties`).join('\n');
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(cfg.color || '#F1C40F').setTitle('🏆 Top gagnants du casino').setDescription(lines || '*Aucun joueur.*')],
            ephemeral: true,
          });
        }

        // Shortcuts → afficher aide pour la commande
        const shortcuts = {
          bj:     'Tape `&bj <mise>` ou `/blackjack` (ex: `&bj all`, `&bj 5000`)',
          poker:  'Tape `&poker <mise>` (ex: `&poker 1000`, `&poker 50%`)',
          roul:   'Tape `&roulette <mise> <pari>` (ex: `&roulette 500 rouge`)',
          roue:   'Tape `&roue <mise>` (ex: `&roue all`)',
          slots:  'Tape `&slots <mise>` (ex: `&slots 100`)',
          mines:  'Tape `&mines <mise> [nb_mines]` (ex: `&mines 1000 3`)',
          crash:  'Tape `&crash <mise> <cashout>` (ex: `&crash 500 3.0`)',
          des:    'Tape `&des <mise> <pari>` (ex: `&des 100 sept`)',
          crypto: 'Tape `&crypto` pour le marché, `&crypto portefeuille` pour ton wallet, `&crypto acheter BTC 1000`',
        };
        if (shortcuts[action]) {
          return interaction.reply({ content: `💡 **${action.toUpperCase()}** — ${shortcuts[action]}`, ephemeral: true });
        }
        return;
      } catch (e) { console.error('[CASINO handler]', e); }
    }

    // ── CRYPTO : boutons marché/wallet/buy/sell ────────────────────
    if (interaction.isButton() && (_cfgId.startsWith('crypto_market:') || _cfgId.startsWith('crypto_wallet:') || _cfgId.startsWith('crypto_buy:') || _cfgId.startsWith('crypto_sell:'))) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const action = _cfgId.split(':')[0].replace('crypto_', '');
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

        const fmtPrice = p => p >= 1000 ? p.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p >= 0.01 ? p.toFixed(4) : p.toFixed(8);
        const uid = interaction.user.id;
        const buttons = [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`crypto_market:${uid}`).setLabel('📊 Marché').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`crypto_wallet:${uid}`).setLabel('💼 Portefeuille').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`crypto_buy:${uid}`).setLabel('🟢 Acheter').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`crypto_sell:${uid}`).setLabel('🔴 Vendre').setStyle(ButtonStyle.Danger),
        )];

        if (action === 'market') {
          const market = db2.getCryptoMarket();
          const lines = market.map(c => {
            const delta = c.prev_price > 0 ? ((c.price - c.prev_price) / c.prev_price) * 100 : 0;
            const arrow = delta > 0.5 ? '🟢📈' : delta < -0.5 ? '🔴📉' : '⚪';
            return `${c.emoji} **${c.symbol}** · ${c.name}\n${arrow} **${fmtPrice(c.price)} ${symbol}** (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`;
          }).join('\n\n');
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(cfg.color || '#F39C12').setTitle('💰 Marché Crypto · NexusExchange').setDescription(lines)
              .setFooter({ text: 'Prix fluctuants toutes les 5 min' }).setTimestamp()],
            components: buttons,
          });
        }

        if (action === 'wallet') {
          const wallet = db2.getWallet(interaction.user.id, interaction.guildId);
          const market = new Map((db2.getCryptoMarket() || []).map(c => [c.symbol, c]));
          let totalValue = 0;
          const lines = wallet.map(w => {
            const m = market.get(w.crypto); if (!m) return null;
            const value = w.amount * m.price;
            totalValue += value;
            const profit = (m.price - w.avg_buy) * w.amount;
            const arrow = profit > 0 ? '🟢' : profit < 0 ? '🔴' : '⚪';
            return `${m.emoji} **${w.crypto}** — ${w.amount.toFixed(6)} × ${fmtPrice(m.price)}${symbol}\n${arrow} Valeur : **${Math.floor(value).toLocaleString('fr-FR')}${symbol}**`;
          }).filter(Boolean).join('\n\n');
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(cfg.color || '#2ECC71').setTitle('💼 Portefeuille crypto')
              .setDescription(lines || '*Aucune crypto. Utilise 🟢 Acheter pour commencer.*')
              .addFields(
                { name: '💰 Valeur totale', value: `**${Math.floor(totalValue).toLocaleString('fr-FR')}${symbol}**`, inline: true },
                { name: `${symbol} Solde`,   value: `**${user.balance.toLocaleString('fr-FR')}${symbol}**`,          inline: true },
              ).setTimestamp()],
            components: buttons,
          });
        }

        if (action === 'buy' || action === 'sell') {
          // Ouvre un menu déroulant avec les 12 cryptos + leur prix actuel
          const { _build } = require('../commands/economy/crypto');
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(action === 'buy' ? '#2ECC71' : '#E74C3C')
              .setTitle(action === 'buy' ? '🟢 Acheter une crypto' : '🔴 Vendre une crypto')
              .setDescription(action === 'buy'
                ? `Sélectionne la crypto à acheter dans le menu ci-dessous.\n\n**Ton solde :** ${user.balance.toLocaleString('fr-FR')}${symbol}`
                : `Sélectionne la crypto à vendre dans le menu ci-dessous.`
              )
              .setFooter({ text: 'Les prix viennent de CoinGecko · mis à jour toutes les 5 min' })
            ],
            components: [_build.buildCryptoSelect(uid, action)],
            ephemeral: true,
          });
        }
        return;
      } catch (e) { console.error('[CRYPTO handler]', e); }
    }

    // ── CRYPTO : sélection dans le menu déroulant → ouvre modal montant ─
    if (interaction.isStringSelectMenu && interaction.isStringSelectMenu() && _cfgId.startsWith('crypto_pick:')) {
      try {
        const parts = _cfgId.split(':');
        const mode = parts[1]; // 'buy' ou 'sell'
        const uid = parts[2];
        if (interaction.user.id !== uid) {
          return interaction.reply({ content: '❌ Ce menu n\'est pas le tien.', ephemeral: true });
        }
        const sym = interaction.values[0];
        const modal = new ModalBuilder()
          .setCustomId(`crypto_modal:${mode}:${sym}:${uid}`)
          .setTitle(mode === 'buy' ? `🟢 Acheter ${sym}` : `🔴 Vendre ${sym}`);
        const input = new TextInputBuilder()
          .setCustomId('amount')
          .setLabel(mode === 'buy' ? 'Montant en coins (ou all, 50 %, moitié)' : 'Quantité à vendre (ou all, 50 %, moitié)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(30)
          .setPlaceholder(mode === 'buy' ? 'Ex : 1000, all, 25%' : 'Ex : 0.5, all, 50%');
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      } catch (e) { console.error('[CRYPTO pick]', e); }
    }

    // ── CRYPTO : modal submit → exécute achat/vente ─────────────────
    if (interaction.isModalSubmit && interaction.isModalSubmit() && _cfgId.startsWith('crypto_modal:')) {
      try {
        if (!interaction.deferred && !interaction.replied) { await interaction.deferReply({ ephemeral: true }).catch(() => {}); }
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const parts = _cfgId.split(':');
        const mode = parts[1];
        const sym = parts[2];
        const uid = parts[3];
        const raw = interaction.fields.getTextInputValue('amount').trim().toLowerCase();
        const user = db2.getUser(uid, interaction.guildId);
        const market = db2.getCryptoPrice(sym);
        if (!market) return interaction.editReply({ content: `❌ Crypto ${sym} introuvable.`, ephemeral: true });

        // Parse raw amount avec support all/tout/50%/moitié
        const parseBet = (raw, base) => {
          const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
          if (s === 'all' || s === 'tout' || s === 'max') return Number(base || 0);
          if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Number(base || 0) / 2;
          const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
          if (!m) return NaN;
          const n = parseFloat(m[1]);
          if (m[2] === '%') return (n / 100) * Number(base || 0);
          return n;
        };

        if (mode === 'buy') {
          const coins = parseBet(raw, user.balance);
          if (!Number.isFinite(coins) || coins < 1) return interaction.editReply({ content: '❌ Montant invalide (min 1).', ephemeral: true });
          if (coins > user.balance) return interaction.editReply({ content: `❌ Solde insuffisant (${user.balance.toLocaleString('fr-FR')}${symbol}).`, ephemeral: true });
          const res = db2.buyCrypto(uid, interaction.guildId, sym, Math.floor(coins));
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#2ECC71')
              .setTitle('✅ Achat effectué')
              .setDescription(`Tu as acheté **${res.qty.toFixed(6)} ${res.symbol}** au prix de **${res.price.toFixed(4)}${symbol}** pour **${Math.floor(coins).toLocaleString('fr-FR')}${symbol}**.`)
              .setFooter({ text: 'Vois /crypto portefeuille pour tes positions' })
            ],
            ephemeral: true,
          });
        } else {
          // sell
          const item = db2.getWalletItem(uid, interaction.guildId, sym);
          if (!item || item.amount <= 0) return interaction.editReply({ content: `❌ Tu ne possèdes pas de ${sym}.`, ephemeral: true });
          const qty = parseBet(raw, item.amount);
          if (!Number.isFinite(qty) || qty <= 0) return interaction.editReply({ content: '❌ Quantité invalide.', ephemeral: true });
          if (qty > item.amount + 0.00001) return interaction.editReply({ content: `❌ Tu n'as que ${item.amount.toFixed(6)} ${sym}.`, ephemeral: true });
          const res = db2.sellCrypto(uid, interaction.guildId, sym, qty);
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#E67E22')
              .setTitle('✅ Vente effectuée')
              .setDescription(`Tu as vendu **${res.qtySold.toFixed(6)} ${sym}** à **${res.price.toFixed(4)}${symbol}** = **+${res.coins.toLocaleString('fr-FR')}${symbol}** dans ton solde.`)
              .setFooter({ text: 'Vois /banque pour ton solde total' })
            ],
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error('[CRYPTO modal]', e);
        return interaction.editReply({ content: `❌ Erreur : ${e.message}`, ephemeral: true }).catch(() => {});
      }
    }

    // ── POKER : boutons hold / draw (persistés en BDD) ──────────────
    if (interaction.isButton() && (_cfgId.startsWith('poker_hold:') || _cfgId === 'poker_draw')) {
      try {
        const db2 = require('../database/db');
        const pk  = require('../utils/pokerEngine');
        const sess = db2.getGameSession(interaction.message.id);
        if (!sess || sess.game !== 'poker') {
          return interaction.reply({ content: '⏱️ Cette partie de Poker a expiré. Lance `&poker <mise>` pour en refaire une.', ephemeral: true });
        }
        if (interaction.user.id !== sess.user_id) {
          return interaction.reply({ content: '❌ Cette partie n\'est pas la tienne.', ephemeral: true });
        }

        const state = pk.deserialize(sess.state.state);
        const embedOpts = sess.state.embedOpts || { userName: interaction.user.username, symbol: '€', color: '#9B59B6' };

        if (state.phase !== 'hold') {
          return interaction.reply({ content: '❌ Cette partie est déjà terminée.', ephemeral: true });
        }

        if (_cfgId === 'poker_draw') {
          pk.resolve(state);
          const bet = state.bet;
          const gain = BigInt(Math.floor(Number(bet) * (state.result?.mult || 0)));
          if (gain > 0n) db2.addCoins(interaction.user.id, interaction.guildId, Number(gain));
          db2.deleteGameSession(interaction.message.id);
          await interaction.update({ embeds: [pk.buildEmbed(state, embedOpts)], components: [] }).catch(() => {});
        } else {
          const idx = parseInt(_cfgId.split(':')[1], 10);
          pk.toggleHold(state, idx);
          db2.saveGameSession(interaction.message.id, interaction.user.id, interaction.guildId, interaction.channelId, 'poker', { state: pk.serialize(state), embedOpts }, 1800);
          await interaction.update({ embeds: [pk.buildEmbed(state, embedOpts)], components: pk.buildButtons(state) }).catch(() => {});
        }
        return;
      } catch (e) {
        console.error('[POKER handler]', e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur : ${e.message?.slice(0, 200)}`, ephemeral: true }).catch(() => {});
        }
        return;
      }
    }

    // ── AIDE : menu catégories + boutons (sans collector, survit aux redémarrages) ──
    if (_cfgId.startsWith('help_cat:') || _cfgId.startsWith('help_home:') || _cfgId.startsWith('help_config:')) {
      try {
        const { _build } = require('../commands/utility/help');
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const color = cfg.color || '#7B2FBE';
        const uid = _cfgId.split(':')[1];
        if (interaction.user.id !== uid) {
          return interaction.reply({ content: '❌ Ce menu d\'aide ne t\'appartient pas. Lance la tienne avec `/aide`.', ephemeral: true });
        }

        if (_cfgId.startsWith('help_cat:')) {
          const val = interaction.values?.[0] || 'accueil';
          const embed = val === 'accueil'
            ? _build.buildHomeEmbed(interaction, color)
            : _build.buildCategoryEmbed(val, color);
          return interaction.update({ embeds: [embed], components: _build.buildComponents(uid, val) });
        }

        if (_cfgId.startsWith('help_home:')) {
          return interaction.update({
            embeds: [_build.buildHomeEmbed(interaction, color)],
            components: _build.buildComponents(uid, 'accueil'),
          });
        }

        if (_cfgId.startsWith('help_config:')) {
          const { buildMainMenu } = require('../utils/configPanel');
          const panel = buildMainMenu(cfg, interaction.guild, uid);
          return interaction.reply({ ...panel, ephemeral: true });
        }
        return;
      } catch (e) {
        console.error('[AIDE handler]', e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur : ${e.message?.slice(0, 200)}`, ephemeral: true }).catch(() => {});
        }
        return;
      }
    }

    // ── MINES : boutons persistés (BDD) ───────────────────────────────
    if (interaction.isButton() && (_cfgId.startsWith('mines_pick:') || _cfgId === 'mines_cash')) {
      try {
        const db2 = require('../database/db');
        const mi  = require('../utils/minesEngine');
        const sess = db2.getGameSession(interaction.message.id);
        if (!sess || sess.game !== 'mines') {
          return interaction.reply({ content: '⏱️ Cette partie de Mines a expiré. Lance `&mines <mise> <nb_mines>` pour en refaire une.', ephemeral: true });
        }
        if (interaction.user.id !== sess.user_id) {
          return interaction.reply({ content: '❌ Cette partie n\'est pas la tienne.', ephemeral: true });
        }

        const game = sess.state.state;
        const embedOpts = sess.state.embedOpts || { userName: interaction.user.username };

        if (game.over) return interaction.reply({ content: '❌ Cette partie est terminée.', ephemeral: true });

        if (_cfgId === 'mines_cash') {
          mi.cashOut(game);
        } else {
          const idx = parseInt(_cfgId.split(':')[1], 10);
          mi.revealSafe(game, idx);
        }

        if (game.over) {
          if (game.cashed && BigInt(game.payout) > 0n) {
            db2.addCoins(interaction.user.id, interaction.guildId, Number(BigInt(game.payout)));
          }
          db2.deleteGameSession(interaction.message.id);
          await interaction.update({ embeds: [mi.buildEmbed(game, embedOpts)], components: [] }).catch(() => {});
        } else {
          db2.saveGameSession(interaction.message.id, interaction.user.id, interaction.guildId, interaction.channelId, 'mines', { state: game, embedOpts }, 1800);
          await interaction.update({ embeds: [mi.buildEmbed(game, embedOpts)], components: mi.buildButtons(game) }).catch(() => {});
        }
        return;
      } catch (e) {
        console.error('[MINES handler]', e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur : ${e.message?.slice(0, 200)}`, ephemeral: true }).catch(() => {});
        }
        return;
      }
    }

    // ── CRASH : rejouer / ×2 ──────────────────────────────────────────
    if (interaction.isButton() && (_cfgId.startsWith('crash_replay:') || _cfgId.startsWith('crash_double:'))) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';

        const encoded = _cfgId.split(':').slice(1).join(':');
        const parts = decodeURIComponent(encoded).split(':');
        let mise = parseInt(parts[0], 10) || 0;
        const cashout = parseFloat(parts[1]);
        if (_cfgId.startsWith('crash_double:')) mise *= 2;

        if (mise < 1 || mise > user.balance) {
          return interaction.editReply({ content: `❌ Solde insuffisant.`, ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});
        db2.removeCoins(interaction.user.id, interaction.guildId, mise);

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#E67E22')
            .setTitle('📈 Le multiplicateur grimpe…')
            .setDescription(`🚀 ×1.00 — 1.50 — 2.00 …\n\nMise **${mise.toLocaleString('fr-FR')}${symbol}** · cashout ×${cashout}`)],
          components: [],
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 2000));

        let crashPoint;
        if (Math.random() < 0.03) crashPoint = 1.00;
        else { const r = Math.random(); crashPoint = Math.max(1.00, (100 - 3) / ((1 - r) * 100)); }

        const won = crashPoint >= cashout;
        const gain = won ? Math.floor(mise * cashout) : 0;
        if (gain > 0) db2.addCoins(interaction.user.id, interaction.guildId, gain);
        const balanceAfter = Math.max(0, user.balance - mise + gain);

        const barLen = Math.min(20, Math.floor(crashPoint * 2));
        const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`crash_replay:${encodeURIComponent(mise + ':' + cashout)}`).setLabel('📈 Rejouer').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`crash_double:${encodeURIComponent(mise + ':' + cashout)}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
        );

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(won ? '#2ECC71' : '#E74C3C')
            .setTitle(won ? `📈 CASHED OUT ×${cashout.toFixed(2)} !` : `💥 CRASH à ×${crashPoint.toFixed(2)}`)
            .setDescription(won
              ? `🎉 Ton cashout ×${cashout} a été atteint. Multi final : **×${crashPoint.toFixed(2)}**.\n\n\`${bar}\``
              : `💥 Le multi a crashé à **×${crashPoint.toFixed(2)}** avant ton cashout (×${cashout}).\n\n\`${bar}\``)
            .addFields(
              { name: '💰 Mise',    value: `${mise.toLocaleString('fr-FR')}${symbol}`, inline: true },
              { name: '🎯 Cashout', value: `×${cashout.toFixed(2)}`,                    inline: true },
              { name: '💥 Crash',   value: `×${crashPoint.toFixed(2)}`,                 inline: true },
              won ? { name: '💵 Gain net', value: `**+${(gain - mise).toLocaleString('fr-FR')}${symbol}**`, inline: true }
                  : { name: '💸 Perte',    value: `**-${mise.toLocaleString('fr-FR')}${symbol}**`,          inline: true },
              { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`,    inline: true },
            ).setTimestamp()],
          components: [row],
        }).catch(() => {});
        return;
      } catch (e) { console.error('[CRASH handler]', e); }
    }

    // ── BLACKJACK : boutons persistés (BDD, survit aux redémarrages) ─
    if (interaction.isButton() && _cfgId.startsWith('bj_')) {
      try {
        const db2 = require('../database/db');
        const bjm = require('../utils/blackjackEngine');
        const sess = db2.getGameSession(interaction.message.id);
        if (!sess || sess.game !== 'blackjack') {
          return interaction.editReply({ content: '⏱️ Cette partie a expiré ou a été réinitialisée. Lance `&bj <mise>` pour en démarrer une nouvelle.', ephemeral: true });
        }
        if (interaction.user.id !== sess.user_id) {
          return interaction.editReply({ content: '❌ Cette partie n\'est pas la tienne.', ephemeral: true });
        }

        const game       = bjm.deserialize(sess.state.state);
        const embedOpts  = sess.state.embedOpts || { symbol: '€', color: '#FFD700', userName: interaction.user.username };

        if (game.over) {
          return interaction.editReply({ content: '❌ Cette partie est déjà terminée.', ephemeral: true });
        }

        switch (_cfgId) {
          case 'bj_hit':       bjm.playerHit(game); break;
          case 'bj_stand':     bjm.playerStand(game); break;
          case 'bj_double': {
            const cur = db2.getUser(interaction.user.id, interaction.guildId);
            if (BigInt(cur.balance) < game.bet) {
              return interaction.editReply({ content: '❌ Solde insuffisant pour doubler.', ephemeral: true });
            }
            db2.removeCoins(interaction.user.id, interaction.guildId, Number(game.bet));
            bjm.playerDouble(game);
            break;
          }
          case 'bj_surrender': bjm.playerSurrender(game); break;
          case 'bj_insurance': {
            const cur = db2.getUser(interaction.user.id, interaction.guildId);
            const insAmount = game.bet / 2n;
            if (BigInt(cur.balance) < insAmount) {
              return interaction.editReply({ content: '❌ Solde insuffisant pour l\'assurance.', ephemeral: true });
            }
            db2.removeCoins(interaction.user.id, interaction.guildId, Number(insAmount));
            bjm.playerInsure(game);
            break;
          }
          default:
            return interaction.editReply({ content: '❌ Action inconnue.', ephemeral: true });
        }

        if (game.over) {
          if (game.payout > 0n) db2.addCoins(interaction.user.id, interaction.guildId, Number(game.payout));
          db2.deleteGameSession(interaction.message.id);
          await interaction.update({ embeds: [bjm.buildEmbed(game, embedOpts)], components: [] }).catch(() => {});
        } else {
          db2.saveGameSession(
            interaction.message.id,
            interaction.user.id,
            interaction.guildId,
            interaction.channelId,
            'blackjack',
            { state: bjm.serialize(game), embedOpts },
            1800
          );
          await interaction.update({ embeds: [bjm.buildEmbed(game, embedOpts)], components: [bjm.buildButtons(game)] }).catch(() => {});
        }
        return;
      } catch (e) {
        console.error('[BLACKJACK global handler]', e);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.editReply({ content: `❌ Erreur interne : ${e.message?.slice(0, 200)}`, ephemeral: true }).catch(() => {});
        }
        return;
      }
    }

    // ── DÉS : boutons Rejouer / ×2 ────────────────────────────────
    if (_cfgId.startsWith('des_replay:') || _cfgId.startsWith('des_double:')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';

        const encoded = _cfgId.split(':').slice(1).join(':');
        const parts   = decodeURIComponent(encoded).split(':');
        const pari    = parts[0];
        const num     = parts[1] ? parseInt(parts[1], 10) : null;
        let mise      = parseInt(parts[2], 10) || 0;
        if (_cfgId.startsWith('des_double:')) mise *= 2;

        if (mise < 1 || mise > user.balance) {
          return interaction.editReply({ content: `❌ Solde insuffisant pour ${mise.toLocaleString('fr-FR')}${symbol}.`, ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});
        db2.removeCoins(interaction.user.id, interaction.guildId, mise);

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#F39C12').setTitle('🎲 Les dés roulent…').setDescription('⚃ ⚁  ?  ⚅ ⚂')],
          components: [],
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 1400));

        const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        const NUM_MULT = { 2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5, 8: 6, 9: 8, 10: 11, 11: 17, 12: 35 };
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        const total = d1 + d2;
        let won = false, mult = 0, label = '';
        switch (pari) {
          case 'pair':   won = total % 2 === 0; mult = 2; label = '🔢 Pair';   break;
          case 'impair': won = total % 2 === 1; mult = 2; label = '🔢 Impair'; break;
          case 'bas':    won = total <= 6;      mult = 2; label = '⬇️ Bas';    break;
          case 'haut':   won = total >= 8;      mult = 2; label = '⬆️ Haut';   break;
          case 'sept':   won = total === 7;     mult = 5; label = '🎯 Sept';   break;
          case 'numero': won = total === num;   mult = NUM_MULT[num] || 5; label = `🎰 Numéro ${num}`; break;
        }
        const gain = won ? mise * mult : 0;
        if (gain > 0) db2.addCoins(interaction.user.id, interaction.guildId, gain);
        const balanceAfter = Math.max(0, user.balance - mise + gain);

        const encFor = encodeURIComponent(`${pari}:${num ?? ''}:${mise}`);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`des_replay:${encFor}`).setLabel('🎲 Rejouer').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`des_double:${encFor}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
        );
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(won ? '#2ECC71' : '#E74C3C')
            .setTitle(won ? `🎲 GAGNÉ — ${total}` : `🎲 Perdu — ${total}`)
            .setDescription(`${DICE[d1]} ${DICE[d2]}  →  **${total}**`)
            .addFields(
              { name: '🎯 Pari', value: label, inline: true },
              { name: '💰 Mise', value: `${mise.toLocaleString('fr-FR')}${symbol}`, inline: true },
              { name: '✖️ Mult.', value: `×${mult}`, inline: true },
              won ? { name: '💵 Gain net', value: `**+${(gain - mise).toLocaleString('fr-FR')}${symbol}**`, inline: true }
                  : { name: '💸 Perte',    value: `**-${mise.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            ).setTimestamp()],
          components: [row],
        }).catch(() => {});
        return;
      } catch (e) { console.error('[DÉS] Erreur handler:', e); }
    }

    // ── ROUE DE LA FORTUNE : Rejouer / ×2 ─────────────────────────
    if (_cfgId.startsWith('roue_replay:') || _cfgId.startsWith('roue_double:')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const encoded = _cfgId.split(':').slice(1).join(':');
        let mise = parseInt(decodeURIComponent(encoded), 10) || 0;
        if (_cfgId.startsWith('roue_double:')) mise *= 2;
        if (mise < 1 || mise > user.balance) return interaction.editReply({ content: `❌ Solde insuffisant.`, ephemeral: true });

        await interaction.deferUpdate().catch(() => {});
        db2.removeCoins(interaction.user.id, interaction.guildId, mise);

        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        await interaction.editReply({ embeds: [new EmbedBuilder().setColor(cfg.color || '#9B59B6').setTitle('🎡 La roue tourne…')], components: [] }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));

        const CASES = [
          { emoji: '💀', mult: 0,   weight: 30, label: '💀 Banqueroute' },
          { emoji: '🪙', mult: 0.5, weight: 22, label: '🪙 Moitié remboursée' },
          { emoji: '⚖️', mult: 1,   weight: 18, label: '⚖️ Mise récupérée' },
          { emoji: '💰', mult: 1.5, weight: 12, label: '💰 Petit gain ×1.5' },
          { emoji: '💎', mult: 2,   weight:  8, label: '💎 Gain ×2' },
          { emoji: '🏆', mult: 3,   weight:  5, label: '🏆 Bon gain ×3' },
          { emoji: '⭐', mult: 5,   weight:  3, label: '⭐ GROS gain ×5' },
          { emoji: '💫', mult: 10,  weight:  2, label: '💫 JACKPOT ×10' },
        ];
        const POOL = CASES.flatMap(c => Array(c.weight).fill(c));
        const pick = POOL[Math.floor(Math.random() * POOL.length)];
        const gain = Math.floor(mise * pick.mult);
        if (gain > 0) db2.addCoins(interaction.user.id, interaction.guildId, gain);
        const net = gain - mise;
        const balanceAfter = Math.max(0, user.balance - mise + gain);
        const resColor = pick.mult === 0 ? '#E74C3C' : pick.mult < 1 ? '#F39C12' : pick.mult >= 5 ? '#9B59B6' : '#2ECC71';

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`roue_replay:${encodeURIComponent(String(mise))}`).setLabel('🎡 Rejouer').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`roue_double:${encodeURIComponent(String(mise))}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
        );
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(resColor).setTitle(`🎡 La roue s'arrête sur… ${pick.emoji}`).setDescription(pick.label)
            .addFields(
              { name: '💰 Mise', value: `${mise.toLocaleString('fr-FR')}${symbol}`, inline: true },
              { name: '✖️ Mult.', value: `×${pick.mult}`, inline: true },
              { name: '🏆 Gain', value: `${gain.toLocaleString('fr-FR')}${symbol}`, inline: true },
              { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `**${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
            ).setTimestamp()],
          components: [row],
        }).catch(() => {});
        return;
      } catch (e) { console.error('[ROUE] Erreur handler:', e); }
    }

    // ── SLOTS : boutons Rejouer / ×2 / moitié ────────────────────────
    if (_cfgId.startsWith('slots_replay:') || _cfgId.startsWith('slots_double:') || _cfgId.startsWith('slots_half:')) {
      try {
        const sl = require('../utils/slotsEngine');
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const color  = cfg.color || '#9B59B6';

        const encoded = _cfgId.split(':').slice(1).join(':');
        let mise = parseInt(decodeURIComponent(encoded), 10) || 0;
        if (_cfgId.startsWith('slots_double:')) mise *= 2;
        if (_cfgId.startsWith('slots_half:'))   mise = Math.max(1, Math.floor(mise / 2));

        if (mise < 1 || mise > user.balance) {
          return interaction.editReply({
            content: `❌ Solde insuffisant pour miser **${mise.toLocaleString('fr-FR')}${symbol}** (tu as ${user.balance.toLocaleString('fr-FR')}${symbol}).`,
            ephemeral: true,
          });
        }

        await interaction.deferUpdate().catch(() => {});
        db2.removeCoins(interaction.user.id, interaction.guildId, mise);
        await interaction.editReply({
          embeds: [sl.buildSpinEmbed({ userName: interaction.user.username, mise, symbol, color })],
          components: [],
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        const { reels, gain, label } = sl.runRound(mise);
        if (gain > 0) db2.addCoins(interaction.user.id, interaction.guildId, gain);
        const balanceAfter = Math.max(0, user.balance - mise + gain);

        await interaction.editReply({
          embeds: [sl.buildResultEmbed({ userName: interaction.user.username, mise, gain, label, reels, balanceAfter, symbol, color })],
          components: [sl.buildReplayButtons(mise)],
        }).catch(() => {});
        return;
      } catch (e) { console.error('[SLOTS] Erreur handler:', e); }
    }

    // ════════════════════════════════════════════════════════════════
    // ── MACHINE CASINO VEGAS ROYALE (cslot_*) ──────────────────────
    // ════════════════════════════════════════════════════════════════
    if (_cfgId.startsWith('cslot_')) {
      try {
        const cm = require('../utils/casinoMachine');
        const db2 = require('../database/db');
        const { ModalBuilder: MB, TextInputBuilder: TI, TextInputStyle: TS } = require('discord.js');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const color  = cfg.color || '#FFD700';
        const userId = interaction.user.id;

        const parts = _cfgId.split(':');
        const action = parts[0].replace('cslot_', '');
        const ownerId = parts[1];

        // Only owner can interact
        if (ownerId && ownerId !== userId) {
          return interaction.editReply({ content: '❌ Ce n\'est pas ta machine ! Lance `/slots` pour la tienne.', ephemeral: true });
        }

        const sessionKey = `cslot:${userId}`;
        let state = db2.kvGet(interaction.guildId, sessionKey);
        if (!state) {
          return interaction.editReply({ content: '❌ Session expirée. Relance `/slots`.', ephemeral: true });
        }
        const user0 = db2.getUser(userId, interaction.guildId);

        // ── Modal mise personnalisée ──────────────────────────
        if (action === 'bet' && parts[2] === 'custom') {
          const modal = new MB()
            .setCustomId(`cslot_modal:${userId}`)
            .setTitle('✍️ Mise personnalisée')
            .addComponents(new ActionRowBuilder().addComponents(
              new TI()
                .setCustomId('mise_value')
                .setLabel('Mise (nombre, all, 50%, moitié)')
                .setStyle(TS.Short)
                .setPlaceholder(`Solde: ${user0.balance.toLocaleString('fr-FR')}`)
                .setRequired(true)
                .setMaxLength(30)
            ));
          return interaction.showModal(modal);
        }

        // ── Ajustement de mise ────────────────────────────────
        if (action === 'bet') {
          const op = parts[2];
          let newMise = state.mise;
          if (op === 'max')  newMise = user0.balance;
          else if (op === 'half') newMise = Math.max(1, Math.floor(user0.balance / 2));
          else if (op.startsWith('+')) newMise += parseInt(op.slice(1), 10) || 0;
          else if (op.startsWith('-')) newMise -= parseInt(op.slice(1), 10) || 0;
          newMise = Math.max(1, Math.min(newMise, user0.balance));
          state.mise = newMise;
          db2.kvSet(interaction.guildId, sessionKey, state);
          return interaction.update({
            embeds: [cm.buildMenuEmbed({
              userName: interaction.user.username,
              mise: state.mise, balance: user0.balance, symbol, color,
              freeSpins: state.freeSpins, session: state.session,
            })],
            components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
          });
        }

        // ── Reset mise ────────────────────────────────────────
        if (action === 'reset') {
          state.mise = 100;
          db2.kvSet(interaction.guildId, sessionKey, state);
          return interaction.update({
            embeds: [cm.buildMenuEmbed({
              userName: interaction.user.username,
              mise: state.mise, balance: user0.balance, symbol, color,
              freeSpins: state.freeSpins, session: state.session,
            })],
            components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
          });
        }

        // ── Paytable ──────────────────────────────────────────
        if (action === 'paytable') {
          return interaction.editReply({ embeds: [cm.buildPaytableEmbed(symbol, color)], ephemeral: true });
        }

        // ── Quitter ──────────────────────────────────────────
        if (action === 'quit') {
          db2.kvDelete(interaction.guildId, sessionKey);
          const net = state.session.totalWon - state.session.totalBet;
          return interaction.update({
            embeds: [new EmbedBuilder().setColor('#95A5A6')
              .setTitle('🎰 Fin de session — Vegas Royale')
              .setDescription(`Merci d'avoir joué, **${interaction.user.username}** !\n\n**Récapitulatif de ta session :**\n🌀 Tours joués : **${state.session.spins}**\n💸 Total misé : **${state.session.totalBet.toLocaleString('fr-FR')}${symbol}**\n🏆 Total gagné : **${state.session.totalWon.toLocaleString('fr-FR')}${symbol}**\n${net >= 0 ? '📈' : '📉'} Bénéfice net : **${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`)
              .setFooter({ text: 'À bientôt ! Relance /slots ou &slots quand tu veux.' })
            ],
            components: [],
          });
        }

        // ── SPIN (tirer le levier) ────────────────────────────
        if (action === 'spin' || action === 'auto') {
          const autoCount = action === 'auto' ? (parseInt(parts[2], 10) || 1) : 1;
          await interaction.deferUpdate();
          for (let spin = 0; spin < autoCount; spin++) {
            const freshUser = db2.getUser(userId, interaction.guildId);
            const isFree = state.freeSpins > 0;
            if (!isFree && freshUser.balance < state.mise) {
              await interaction.editReply({
                embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Solde insuffisant').setDescription(`Il te faut **${state.mise.toLocaleString('fr-FR')}${symbol}** mais tu as **${freshUser.balance.toLocaleString('fr-FR')}${symbol}**.`)],
                components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
              });
              break;
            }
            if (!isFree) {
              db2.removeCoins(userId, interaction.guildId, state.mise);
              state.session.totalBet += state.mise;
            } else {
              state.freeSpins--;
            }
            state.session.spins++;

            // Animation spin : 3 rouleaux qui se fixent un à un
            const locked = [false, false, false, false, false];
            await interaction.editReply({
              embeds: [cm.buildSpinningEmbed({ userName: interaction.user.username, mise: state.mise, symbol, color, locked })],
              components: [],
            }).catch(() => {});
            for (let i = 0; i < 5; i++) {
              await new Promise(r => setTimeout(r, 280));
              locked[i] = true;
              await interaction.editReply({
                embeds: [cm.buildSpinningEmbed({ userName: interaction.user.username, mise: state.mise, symbol, color, locked })],
              }).catch(() => {});
            }

            // Calcul
            const grid = cm.spinGrid();
            const result = cm.evaluate(grid, state.mise);
            state.lastGrid = grid.map(col => col.map(s => s.id));
            state.lastResult = result;
            state.lastGain = result.totalWin;
            state.canRespin = true;
            state.held = [false, false, false, false, false];
            if (result.totalWin > 0) {
              db2.addCoins(userId, interaction.guildId, result.totalWin);
              state.session.totalWon += result.totalWin;
              if (result.totalWin > state.session.biggest) state.session.biggest = result.totalWin;
            }
            if (result.payouts.find(p => p.line === -1)) {
              state.freeSpins += 10;
            }
            db2.kvSet(interaction.guildId, sessionKey, state);

            const after = db2.getUser(userId, interaction.guildId);
            await interaction.editReply({
              embeds: [cm.buildResultEmbed({
                userName: interaction.user.username,
                mise: state.mise, result, grid, balance: after.balance, symbol, color, freeSpin: isFree,
              })],
              components: autoCount === 1 ? cm.buildAfterSpinButtons(userId, state.held, after.balance >= Math.floor(state.mise / 2)) : [],
            }).catch(() => {});

            if (autoCount > 1) await new Promise(r => setTimeout(r, 1500));
          }
          // Après auto-spin : retour au menu
          if (autoCount > 1) {
            const after = db2.getUser(userId, interaction.guildId);
            await interaction.editReply({
              embeds: [cm.buildMenuEmbed({
                userName: interaction.user.username,
                mise: state.mise, balance: after.balance, symbol, color,
                freeSpins: state.freeSpins, session: state.session,
              })],
              components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
            }).catch(() => {});
          }
          return;
        }

        // ── HOLD sur un rouleau ──────────────────────────────
        if (action === 'hold') {
          const idx = parseInt(parts[2], 10);
          state.held[idx] = !state.held[idx];
          db2.kvSet(interaction.guildId, sessionKey, state);
          return interaction.update({
            components: cm.buildAfterSpinButtons(userId, state.held, user0.balance >= Math.floor(state.mise / 2)),
          });
        }

        // ── RESPIN ciblé (coûte 50% de la mise) ──────────────
        if (action === 'respin') {
          const respinCost = Math.floor(state.mise / 2);
          if (user0.balance < respinCost) {
            return interaction.editReply({ content: `❌ Il te faut **${respinCost.toLocaleString('fr-FR')}${symbol}** pour respin.`, ephemeral: true });
          }
          await interaction.deferUpdate();
          db2.removeCoins(userId, interaction.guildId, respinCost);
          state.session.totalBet += respinCost;
          // Re-spin
          const oldGrid = state.lastGrid.map(col => col.map(id => cm.byId[id]));
          const grid = cm.respinGrid(oldGrid, state.held);
          // Animation flash
          await new Promise(r => setTimeout(r, 600));
          const result = cm.evaluate(grid, state.mise);
          state.lastGrid = grid.map(col => col.map(s => s.id));
          state.lastResult = result;
          state.canRespin = false;
          if (result.totalWin > 0) {
            db2.addCoins(userId, interaction.guildId, result.totalWin);
            state.session.totalWon += result.totalWin;
            if (result.totalWin > state.session.biggest) state.session.biggest = result.totalWin;
          }
          db2.kvSet(interaction.guildId, sessionKey, state);
          const after = db2.getUser(userId, interaction.guildId);
          return interaction.editReply({
            embeds: [cm.buildResultEmbed({
              userName: interaction.user.username,
              mise: state.mise, result, grid, balance: after.balance, symbol, color,
            })],
            components: cm.buildAfterSpinButtons(userId, state.held, false),
          });
        }

        // ── Continuer → retour au menu ────────────────────────
        if (action === 'continue') {
          const after = db2.getUser(userId, interaction.guildId);
          state.canRespin = false;
          state.held = [false, false, false, false, false];
          db2.kvSet(interaction.guildId, sessionKey, state);
          return interaction.update({
            embeds: [cm.buildMenuEmbed({
              userName: interaction.user.username,
              mise: state.mise, balance: after.balance, symbol, color,
              freeSpins: state.freeSpins, session: state.session,
            })],
            components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
          });
        }

        // ── Double ou rien (fonction gamble) ────────────────────────
        if (action === 'gamble') {
          if (!state.lastGain || state.lastGain <= 0) {
            return interaction.editReply({ content: '❌ Rien à doubler : aucun gain lors du dernier tour.', ephemeral: true });
          }
          return interaction.update({
            embeds: [new EmbedBuilder().setColor('#9B59B6')
              .setTitle('🎴 Double ou rien')
              .setDescription(`Ton gain actuel : **${state.lastGain.toLocaleString('fr-FR')}${symbol}**\n\nTire une carte :\n🟥 **Rouge** → tu gagnes ${(state.lastGain * 2).toLocaleString('fr-FR')}${symbol}\n⬛ **Noir** → tu gagnes ${(state.lastGain * 2).toLocaleString('fr-FR')}${symbol}\n\nMauvais choix = tu perds ton gain (50 / 50).`)
              .setFooter({ text: 'Astuce : tu peux aussi encaisser ton gain tel quel.' })
            ],
            components: cm.buildGambleButtons(userId),
          });
        }

        if (action === 'gamble_pick') {
          const pick = parts[2];
          const actual = Math.random() < 0.5 ? 'red' : 'black';
          const won = pick === actual;
          const gain = state.lastGain;
          if (won) {
            db2.addCoins(userId, interaction.guildId, gain); // Double (on a déjà le gain initial)
            state.session.totalWon += gain;
            state.lastGain = gain * 2;
          } else {
            db2.removeCoins(userId, interaction.guildId, gain);
            state.session.totalWon -= gain;
            state.lastGain = 0;
          }
          db2.kvSet(interaction.guildId, sessionKey, state);
          const after = db2.getUser(userId, interaction.guildId);
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(won ? '#2ECC71' : '#E74C3C')
              .setTitle(won ? `🎴 ${actual === 'red' ? '🟥 Rouge' : '⬛ Noir'} — gagné !` : `🎴 ${actual === 'red' ? '🟥 Rouge' : '⬛ Noir'} — perdu…`)
              .setDescription(won
                ? `🎉 Tu doubles ton gain : **+${gain.toLocaleString('fr-FR')}${symbol}** !\n\nRe-double ou encaisse ton gain total ?`
                : `Tu perds **${gain.toLocaleString('fr-FR')}${symbol}**. Pas de chance !`)
              .addFields({ name: '👛 Solde', value: `${after.balance.toLocaleString('fr-FR')}${symbol}`, inline: true })
            ],
            components: won ? cm.buildGambleButtons(userId) : cm.buildMenuButtons(userId, state.mise, state.freeSpins),
          });
        }

        if (action === 'gamble_cancel') {
          const after = db2.getUser(userId, interaction.guildId);
          return interaction.update({
            embeds: [cm.buildMenuEmbed({
              userName: interaction.user.username,
              mise: state.mise, balance: after.balance, symbol, color,
              freeSpins: state.freeSpins, session: state.session,
            })],
            components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
          });
        }

      } catch (e) {
        console.error('[CSLOT] Erreur handler:', e);
        if (!interaction.replied && !interaction.deferred) {
          return interaction.editReply({ content: `❌ Erreur : ${e.message}`, ephemeral: true }).catch(() => {});
        }
      }
    }

    // ── Modal mise perso casino slots ───────────────────────────
    if (interaction.isModalSubmit && interaction.isModalSubmit() && _cfgId.startsWith('cslot_modal:')) {
      try {
        const cm = require('../utils/casinoMachine');
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const color  = cfg.color || '#FFD700';
        const userId = interaction.user.id;
        const sessionKey = `cslot:${userId}`;
        const state = db2.kvGet(interaction.guildId, sessionKey);
        if (!state) return interaction.editReply({ content: '❌ Session expirée.', ephemeral: true });
        const user0 = db2.getUser(userId, interaction.guildId);
        const raw = interaction.fields.getTextInputValue('mise_value');
        const s = String(raw ?? '').replace(/[\s_,]/g, '').toLowerCase();
        let newMise;
        if (s === 'all' || s === 'tout' || s === 'max') newMise = user0.balance;
        else if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') newMise = Math.floor(user0.balance / 2);
        else {
          const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
          if (!m) return interaction.editReply({ content: '❌ Mise invalide.', ephemeral: true });
          const n = parseFloat(m[1]);
          newMise = m[2] === '%' ? Math.floor(user0.balance * n / 100) : Math.floor(n);
        }
        newMise = Math.max(1, Math.min(newMise, user0.balance));
        state.mise = newMise;
        db2.kvSet(interaction.guildId, sessionKey, state);
        return interaction.reply({
          embeds: [cm.buildMenuEmbed({
            userName: interaction.user.username,
            mise: state.mise, balance: user0.balance, symbol, color,
            freeSpins: state.freeSpins, session: state.session,
          })],
          components: cm.buildMenuButtons(userId, state.mise, state.freeSpins),
        });
      } catch (e) { console.error('[CSLOT MODAL]:', e); }
    }

    // ── PROFIL : boutons interactifs (stats / crypto / historique / badges / refresh)
    if (_cfgId.startsWith('profil_')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const color  = cfg.color || '#FFD700';
        const parts = _cfgId.split(':');
        const action = parts[0].replace('profil_', '');
        const ownerId = parts[1];
        const targetId = parts[2];

        // Seul le propriétaire du profil peut interagir
        if (interaction.user.id !== ownerId) {
          return interaction.editReply({ content: '❌ Ce profil n\'est pas le tien. Tape `/profil` pour voir le tien.', ephemeral: true });
        }

        const target = await interaction.client.users.fetch(targetId).catch(() => interaction.user);

        if (action === 'refresh') {
          const { _build } = require('../commands/social/profil');
          const member = interaction.guild.members.cache.get(targetId) || await interaction.guild.members.fetch(targetId).catch(() => null);
          const user = db2.getUser(targetId, interaction.guildId);
          return interaction.reply({
            embeds: [_build.buildMainEmbed(target, member, user, cfg, interaction.guild)],
            components: _build.buildButtons(ownerId, targetId),
          });
        }

        if (action === 'history') {
          const { _build } = require('../commands/economy/historique');
          const total = db2.countTransactions(targetId, interaction.guildId);
          const rows  = db2.getTransactions(targetId, interaction.guildId, _build.PAGE_SIZE, 0);
          const pages = Math.max(1, Math.ceil(total / _build.PAGE_SIZE));
          return interaction.editReply({
            embeds: [_build.buildEmbed({ user: target, guild: interaction.guild, page: 1, total, rows, symbol, color: cfg.color || '#7C3AED' })],
            components: [_build.buildButtons(targetId, 1, pages)],
            ephemeral: true,
          });
        }

        if (action === 'stats') {
          const stats = db2.getGameStats(targetId, interaction.guildId);
          const totalPlayed = stats.reduce((s, g) => s + g.played, 0);
          const totalWon    = stats.reduce((s, g) => s + g.won, 0);
          const totalLost   = stats.reduce((s, g) => s + g.lost, 0);
          const totalBet    = stats.reduce((s, g) => s + (g.total_bet || 0), 0);
          const totalWin    = stats.reduce((s, g) => s + (g.total_won || 0), 0);
          const biggestWin  = Math.max(0, ...stats.map(g => g.biggest_win || 0));
          const winrate     = totalPlayed > 0 ? (totalWon / totalPlayed * 100).toFixed(1) : '0.0';
          const lines = stats.length
            ? stats.map(g => `🎮 **${g.game}** · ${g.played} parties · ${g.won} gagnées · ${g.lost} perdues · biggest win : ${(g.biggest_win||0).toLocaleString('fr-FR')}${symbol}`).join('\n')
            : '*Aucune partie jouée pour le moment.*';
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor(color)
              .setTitle(`📊 Statistiques de jeu — ${target.username}`)
              .setDescription(lines)
              .addFields(
                { name: '🎲 Total parties',  value: `${totalPlayed.toLocaleString('fr-FR')}`, inline: true },
                { name: '🏆 Winrate',        value: `${winrate} %`,                          inline: true },
                { name: '💸 Total misé',     value: `${totalBet.toLocaleString('fr-FR')}${symbol}`, inline: true },
                { name: '💰 Total gagné',    value: `${totalWin.toLocaleString('fr-FR')}${symbol}`, inline: true },
                { name: '📈 Bénéfice net',   value: `${(totalWin - totalBet).toLocaleString('fr-FR')}${symbol}`, inline: true },
                { name: '🎯 Meilleur coup',  value: `${biggestWin.toLocaleString('fr-FR')}${symbol}`, inline: true },
              )
              .setThumbnail(target.displayAvatarURL({ size: 128 }))
            ],
            ephemeral: true,
          });
        }

        if (action === 'crypto') {
          const wallet = db2.getWallet(targetId, interaction.guildId);
          const market = new Map((db2.getCryptoMarket() || []).map(c => [c.symbol, c]));
          let total = 0;
          const lines = wallet.map(w => {
            const m = market.get(w.crypto); if (!m) return null;
            const v = w.amount * m.price;
            total += v;
            const profit = (m.price - w.avg_buy) * w.amount;
            const profitPct = w.avg_buy > 0 ? ((m.price - w.avg_buy) / w.avg_buy) * 100 : 0;
            const arrow = profit >= 0 ? '🟢' : '🔴';
            return `${m.emoji} **${w.crypto}** — ${w.amount.toFixed(6)} × ${m.price.toFixed(4)}${symbol}\n${arrow} Valeur : **${Math.floor(v).toLocaleString('fr-FR')}${symbol}** · PnL : ${profit >= 0 ? '+' : ''}${Math.floor(profit).toLocaleString('fr-FR')}${symbol} (${profitPct.toFixed(2)} %)`;
          }).filter(Boolean).join('\n\n') || '*Aucune crypto détenue.*';
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#2ECC71')
              .setTitle(`💹 Portefeuille crypto — ${target.username}`)
              .setDescription(lines)
              .addFields({ name: '💰 Valeur totale', value: `**${Math.floor(total).toLocaleString('fr-FR')}${symbol}**`, inline: true })
              .setThumbnail(target.displayAvatarURL({ size: 128 }))
            ],
            ephemeral: true,
          });
        }

        if (action === 'badges') {
          return interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#F1C40F')
              .setTitle(`🏅 Badges — ${target.username}`)
              .setDescription('*Système de badges en cours de construction.*\n\nReviens bientôt pour voir les badges débloqués !')
              .setThumbnail(target.displayAvatarURL({ size: 128 }))
            ],
            ephemeral: true,
          });
        }
      } catch (e) { console.error('[PROFIL] Erreur handler:', e); }
    }

    // ── HISTORIQUE : navigation pages ────────────────────────────────
    if (_cfgId.startsWith('hist_')) {
      try {
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const symbol = cfg.currency_emoji || '€';
        const color  = cfg.color || '#7C3AED';
        const { _build } = require('../commands/economy/historique');
        const parts = _cfgId.split(':');
        const action = parts[0].replace('hist_', '');
        const targetId = parts[1];
        const currentPage = parseInt(parts[2] || '1', 10);

        const target = await interaction.client.users.fetch(targetId).catch(() => interaction.user);
        const total = db2.countTransactions(targetId, interaction.guildId);
        const pages = Math.max(1, Math.ceil(total / _build.PAGE_SIZE));

        let newPage = currentPage;
        if (action === 'first')   newPage = 1;
        if (action === 'prev')    newPage = Math.max(1, currentPage - 1);
        if (action === 'next')    newPage = Math.min(pages, currentPage + 1);
        if (action === 'last')    newPage = pages;
        if (action === 'refresh') newPage = currentPage;

        const offset = (newPage - 1) * _build.PAGE_SIZE;
        const rows = db2.getTransactions(targetId, interaction.guildId, _build.PAGE_SIZE, offset);

        return interaction.reply({
          embeds: [_build.buildEmbed({ user: target, guild: interaction.guild, page: newPage, total, rows, symbol, color })],
          components: [_build.buildButtons(targetId, newPage, pages)],
        });
      } catch (e) { console.error('[HIST] Erreur handler:', e); }
    }

    // ── ROULETTE : bouton REJOUER et menu de choix de pari ───────────
    if (_cfgId.startsWith('roulette_replay:') || _cfgId.startsWith('roulette_double:') || _cfgId.startsWith('roulette_pick:')) {
      try {
        const r  = require('../utils/rouletteEngine');
        const db2 = require('../database/db');
        const cfg = db2.getConfig(interaction.guildId);
        const user = db2.getUser(interaction.user.id, interaction.guildId);
        const symbol = cfg.currency_emoji || '€';

        let bet, mise;
        if (_cfgId.startsWith('roulette_pick:')) {
          // "roulette_pick:<mise_encoded>" — values[0] = type de pari choisi
          if (!interaction.isStringSelectMenu()) return;
          const miseEncoded = _cfgId.split(':')[1];
          mise = parseInt(decodeURIComponent(miseEncoded), 10) || 0;
          bet  = { type: interaction.values[0], param: null };
        } else {
          // replay ou double : customId = "roulette_replay:<type>:<param>:<mise>"
          const encoded = _cfgId.split(':').slice(1).join(':');
          const parts   = decodeURIComponent(encoded).split(':');
          bet  = { type: parts[0], param: parts[1] || null };
          mise = parseInt(parts[2], 10) || 0;
          if (_cfgId.startsWith('roulette_double:')) mise *= 2;
        }

        if (mise < 1 || mise > user.balance) {
          return interaction.editReply({
            content: `❌ Solde insuffisant pour miser **${mise.toLocaleString('fr-FR')}${symbol}** (tu as ${user.balance.toLocaleString('fr-FR')}${symbol}).`,
            ephemeral: true,
          });
        }

        await interaction.deferUpdate().catch(() => {});
        db2.removeCoins(interaction.user.id, interaction.guildId, mise);

        await interaction.editReply({
          embeds: [r.buildSpinningEmbed({ userName: interaction.user.username, bet, mise, symbol, color: cfg.color })],
          components: [],
        }).catch(() => {});

        await new Promise(res => setTimeout(res, 2000));

        const result = r.spin();
        const { won, mult } = r.checkWin(bet, result);
        const delta = won ? mise * (mult - 1) : 0;
        if (won) db2.addCoins(interaction.user.id, interaction.guildId, mise * mult);
        const balanceAfter = won ? user.balance - mise + mise * mult : user.balance - mise;

        await interaction.editReply({
          embeds: [r.buildResultEmbed({
            userName: interaction.user.username,
            bet, mise, symbol, color: cfg.color,
            result, won, mult, delta,
            balanceAfter: Math.max(0, balanceAfter),
          })],
          components: [r.buildReplayButtons(bet, mise)],
        }).catch(() => {});
        return;
      } catch (e) {
        console.error('[ROULETTE] Erreur handler:', e);
      }
    }

    // ── PANNEAU AVANCÉ (adv: / adv_modal: / adv_chan: / adv_role: / adv_sel:) ──
    if (_cfgId.startsWith('adv:') || _cfgId.startsWith('adv_modal:') || _cfgId.startsWith('adv_chan:') || _cfgId.startsWith('adv_role:') || _cfgId.startsWith('adv_sel:')) {
      try {
        const { handleAdvancedInteraction } = require('../utils/configPanelAdvanced');
        const _db2 = require('../database/db');
        const _handled2 = await handleAdvancedInteraction(interaction, _db2, client);
        if (_handled2 === true) return; // FIX: slash commands debloqués
      } catch (e) {
        console.error('[ADV-PANEL] Erreur:', e);
      }
    }

    // ── SLASH COMMANDS ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;      // ── Vérification blacklist NexusBot ───────────────────
      if (interaction.commandName !== 'nexus') {
        try {
          const dbCheck = require('../database/db');
          const bl = dbCheck.db.prepare(
            'SELECT 1 FROM nexus_blacklist WHERE guild_id=? AND user_id=?'
          ).get(interaction.guildId, interaction.user.id);
          if (bl) {
            return interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🚫 Accès refusé')
                .setDescription('Vous n\'êtes pas autorisé à utiliser les commandes de ce bot sur ce serveur.\nContactez un administrateur si vous pensez qu\'il s\'agit d\'une erreur.')
                .setFooter({ text: interaction.guild?.name || '' })
              ], ephemeral: true
            });
          }
        } catch {}
      }

      // ── Toggle + cooldown override (panneau config) ─────
      let _cooldownOverride = null;
      try {
        const _db3 = require('../database/db');
        // /config doit toujours rester accessible (sinon on peut s'auto-verrouiller)
        if (interaction.commandName !== 'config' && interaction.commandName !== 'nexus') {
          if (!_db3.isCommandEnabled(interaction.guildId, command.data.name)) {
            return interaction.editReply({
              embeds: [new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('🚫 Commande désactivée')
                .setDescription(`La commande \`/${command.data.name}\` est désactivée sur ce serveur.\nUn administrateur peut la réactiver via \`/config\` → 🛠️ Cooldowns & toggles.`)
              ], ephemeral: true
            });
          }
        }
        _cooldownOverride = _db3.getCooldownOverride(interaction.guildId, command.data.name);
      } catch {}

      // Cooldown
      if (!client.cooldowns.has(command.data.name)) {
        client.cooldowns.set(command.data.name, new Map());
      }
      const now = Date.now();
      const ts  = client.cooldowns.get(command.data.name);
      const cd  = ((_cooldownOverride != null ? _cooldownOverride : (command.cooldown ?? 3))) * 1000;

      if (ts.has(interaction.user.id)) {
        const exp = ts.get(interaction.user.id) + cd;
        if (now < exp) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setDescription(`⏱️ Attends encore **${((exp - now) / 1000).toFixed(1)}s** avant de refaire \`/${command.data.name}\`.`)
            ], ephemeral: true
          });
        }
      }
      ts.set(interaction.user.id, now);
      setTimeout(() => ts.delete(interaction.user.id), cd);

      try {      await command.execute(interaction, client);
      } catch (error) {
        console.error(`[CMD] Erreur /${interaction.commandName}:`, error);
        const errEmbed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Erreur inattendue')
          .setDescription('Une erreur est survenue. Réessaie plus tard ou contacte un admin.')
          .setFooter({ text: error.message?.slice(0, 100) });

        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        } else {
          await interaction.editReply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── BOUTONS ──────────────────────────────────────────
    if (interaction.isButton()) {
      const db = require('../database/db');
      const customId = interaction.customId;

      // ══════════════════════════════════════════════════════
      // TICKET SYSTEM v2 — BOUTONS
      // ══════════════════════════════════════════════════════

      // ── Ouvrir un ticket : vérifier blacklist + afficher sélecteur de catégorie ──
      if (customId === 'ticket_open') {
        // Vérifier la blacklist
        const blacklisted = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id=? AND user_id=?')
          .get(interaction.guildId, interaction.user.id);
        if (blacklisted) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Accès refusé — Tickets désactivés')
              .setDescription(
                `Tu as été **banni du système de tickets** de ce serveur.\n\n` +
                `**Raison :** ${blacklisted.reason || 'Aucune raison précisée'}\n` +
                `**Banni par :** <@${blacklisted.banned_by}>\n\n` +
                `> Si tu penses que c'est une erreur, contacte un admin directement.`
              )
              .setFooter({ text: `${interaction.guild.name} • Support` })
            ],
            ephemeral: true
          });
        }

        const existing = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing)
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor('#E67E22')
              .setTitle('⚠️ Ticket déjà ouvert')
              .setDescription(`Tu as déjà un ticket en cours : <#${existing.channel_id}>\n\nFerme-le avant d'en ouvrir un nouveau.`)
            ],
            ephemeral: true
          });

        const { CATEGORIES } = require('../commands/unique/ticket');
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('ticket_select_cat')
          .setPlaceholder('📂 Sélectionne une catégorie...')
          .addOptions(CATEGORIES.map(c => ({ label: c.label, description: c.description, value: c.value, emoji: c.emoji })));

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('🎫 Ouvrir un ticket — Étape 1/2')
            .setDescription(
              '**Quelle est la nature de ta demande ?**\n\n' +
              CATEGORIES.map(c => `${c.emoji} **${c.label.replace(/^.*? /,'')}** — *${c.description}*`).join('\n') +
              '\n\n> 📌 Sélectionne une catégorie dans le menu ci-dessous.'
            )
            .setFooter({ text: 'Étape suivante : choisir le niveau d\'urgence' })
          ],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true,
        });
      }

      // ── Fermer (bouton dans le ticket) ──
      if (customId.startsWith('ticket_close_')) {
        const ticketId = parseInt(customId.replace('ticket_close_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfg = db.getConfig(interaction.guildId);
        const canClose = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role))
          || interaction.user.id === ticket.user_id;
        if (!canClose) return interaction.editReply({ content: '❌ Tu n\'as pas la permission.', ephemeral: true });

        const cat2 = require('../commands/unique/ticket').getCatInfo(ticket.category);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ticket_confirm_close_${ticket.id}`).setLabel('Confirmer la fermeture').setEmoji('🔒').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`ticket_cancel_close_${ticket.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
        );
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setAuthor({ name: `Fermeture demandée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTitle('🔒 Fermer ce ticket ?')
            .setDescription(
              '> 📄 Un **transcript complet** sera généré et sauvegardé\n' +
              '> 📨 Le créateur recevra le transcript par **DM**\n' +
              '> ⭐ Une **évaluation** du support sera demandée\n\n' +
              '**Cette action est irréversible.**'
            )
            .addFields(
              { name: `${cat2.emoji} Catégorie`, value: cat2.label, inline: true },
              { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
            )
            .setFooter({ text: 'Utilise le bouton Annuler si c\'est une erreur.' })
          ], components: [row]
        });
      }

      // ── Confirmer la fermeture + transcript ──
      if (customId.startsWith('ticket_confirm_close_')) {
        const ticketId = parseInt(customId.replace('ticket_confirm_close_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });

        await interaction.deferReply();

        const cfg = db.getConfig(interaction.guildId);
        const { generateTranscript, getCatInfo } = require('../commands/unique/ticket');
        const cat = getCatInfo(ticket.category);

        // Générer transcript
        const transcriptBuffer = await generateTranscript(interaction.channel, ticket);
        const attachment = new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` });

        // Marquer fermé en DB
        db.db.prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")
          .run(Math.floor(Date.now() / 1000), ticketId);

        // Envoyer dans le salon logs
        if (cfg.ticket_log_channel) {
          const logCh = interaction.guild.channels.cache.get(cfg.ticket_log_channel);
          if (logCh) {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor(cat.color || '#7B2FBE')
                .setTitle(`📋 Ticket fermé — ${interaction.channel.name}`)
                .addFields(
                  { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                  { name: '🔒 Fermé par', value: `<@${interaction.user.id}>`, inline: true },
                  { name: '📝 Raison', value: ticket.close_reason || 'Aucune', inline: false },
                  { name: '✋ Pris en charge', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Non réclamé', inline: true },
                )
                .setTimestamp()
              ],
              files: [attachment],
            }).catch(() => {});
          }
        }

        // Notifier l'utilisateur en DM avec le transcript
        const creator = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
        if (creator) {
          creator.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF6B6B')
              .setTitle('🔒 Ton ticket a été fermé')
              .setDescription(`Ton ticket **${interaction.channel.name}** sur **${interaction.guild.name}** a été fermé.\nMerci d'avoir contacté le support ! Le transcript est joint.`)
              .setFooter({ text: `Fermé par ${interaction.user.tag}` })
            ],
            files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${interaction.channel.name}.txt` })],
          }).catch(() => {});
        }

        // ── Afficher le select menu de notation DANS le salon ──
        const ratingSelect = new StringSelectMenuBuilder()
          .setCustomId(`ticket_rate_select_${ticketId}`)
          .setPlaceholder('⭐ Évalue notre support...')
          .addOptions([
            { label: '😡 1 étoile — Très insatisfait',  description: 'Le support n\'a pas répondu à mes attentes',   value: '1' },
            { label: '😕 2 étoiles — Insatisfait',      description: 'Plusieurs points à améliorer',                  value: '2' },
            { label: '😐 3 étoiles — Neutre',            description: 'Correct, mais peut mieux faire',               value: '3' },
            { label: '🙂 4 étoiles — Satisfait',         description: 'Bonne expérience, merci !',                    value: '4' },
            { label: '😄 5 étoiles — Excellent !',       description: 'Support parfait, je suis très satisfait !',    value: '5' },
          ]);

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#FFD700')
            .setAuthor({ name: `Support ${interaction.guild.name}`, iconURL: interaction.guild.iconURL() })
            .setTitle('⭐ Comment s\'est passée ton expérience ?')
            .setDescription(
              `<@${ticket.user_id}> — Ton avis nous aide à améliorer notre support !\n\n` +
              `> Sélectionne une note dans le menu ci-dessous\n` +
              `> Ce salon disparaît dans **60 secondes**`
            )
            .addFields(
              { name: '🎟️ Ticket', value: `\`#${ticketId}\``, inline: true },
              { name: '🔒 Fermé par', value: `<@${interaction.user.id}>`, inline: true },
              { name: '📋 Transcript', value: '`✅ Sauvegardé`', inline: true },
            )
            .setFooter({ text: 'Ton retour nous aide à mieux vous servir ⭐' })
            .setTimestamp()
          ],
          components: [new ActionRowBuilder().addComponents(ratingSelect)],
        });

        // Suppression auto après 60 secondes si pas de notation
        const channelRef = interaction.channel;
        setTimeout(() => channelRef.delete().catch(() => {}), 60000);
        return;
      }

      // ── Annuler la fermeture ──
      if (customId.startsWith('ticket_cancel_close_')) {
        return interaction.update({
          embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription('✅ Fermeture annulée.')],
          components: []
        });
      }

      // (ticket_rate_ par bouton supprimé — remplacé par select menu ticket_rate_select_)

      // ── Claim via bouton (dans le message d'accueil du ticket) ──
      if (customId.startsWith('ticket_claim_')) {
        const ticketId = parseInt(customId.replace('ticket_claim_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfg = db.getConfig(interaction.guildId);
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));
        if (!isStaff) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });
        if (ticket.claimed_by)
          return interaction.editReply({ content: `⚠️ Déjà pris en charge par <@${ticket.claimed_by}>.`, ephemeral: true });

        db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(interaction.user.id, ticketId);
        await interaction.channel.setTopic(`Pris en charge par ${interaction.user.tag}`).catch(() => {});

        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#2ECC71')
            .setDescription(`✋ **${interaction.member.displayName}** a pris en charge ce ticket.`)
          ]
        });
      }

      // ── Garder le ticket ouvert (bouton inactivité) ──
      if (customId.startsWith('ticket_keepopen_')) {
        const ticketId = parseInt(customId.replace('ticket_keepopen_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });

        if (interaction.user.id !== ticket.user_id) {
          return interaction.editReply({ content: '❌ Seul le créateur du ticket peut confirmer sa présence.', ephemeral: true });
        }

        // Réinitialiser l'avertissement
        db.db.prepare('UPDATE tickets SET warn_sent=0 WHERE id=?').run(ticketId);

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Ticket maintenu ouvert')
            .setDescription(`**<@${interaction.user.id}>** est encore là !\n\nLe ticket reste ouvert et le compteur d'inactivité a été réinitialisé.`)
            .setFooter({ text: 'Nouveau délai de fermeture auto : 48h d\'inactivité' })
          ],
          components: [],
        });

        return interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setDescription(`✅ <@${ticket.user_id}> a confirmé être encore là. Le staff reviendra vers toi dès que possible !`)
          ]
        });
      }

      // ── Réponses rapides (bouton staff) ──
      if (customId.startsWith('ticket_quickreply_')) {
        const ticketId = parseInt(customId.replace('ticket_quickreply_', ''));
        const ticket   = db.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.editReply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const cfgQR = db.getConfig(interaction.guildId);
        const isStaffQR = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
          || (cfgQR.ticket_staff_role && interaction.member.roles.cache.has(cfgQR.ticket_staff_role));
        if (!isStaffQR) return interaction.editReply({ content: '❌ Réservé au staff.', ephemeral: true });

        const DEFAULT_QR = [
          { label: '👋 Message d\'accueil',   value: 'qr_welcome',    description: 'Accueillir le membre et se présenter' },
          { label: '⏳ Merci de patienter',   value: 'qr_wait',       description: 'Demander de la patience' },
          { label: '📷 Captures demandées',   value: 'qr_screenshot', description: 'Demander des preuves visuelles' },
          { label: '🔄 Plus d\'informations', value: 'qr_info',       description: 'Demander des détails supplémentaires' },
          { label: '✅ Problème résolu',       value: 'qr_resolved',   description: 'Confirmer la résolution' },
          { label: '🔒 Fermeture imminente',  value: 'qr_closing',    description: 'Prévenir de la fermeture' },
        ];

        const customReplies = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE guild_id=? ORDER BY title LIMIT 15')
          .all(interaction.guildId);
        const customOpts = customReplies.map(r => ({
          label: `✏️ ${r.title}`.slice(0, 100),
          value: `qr_custom_${r.id}`,
          description: r.content.slice(0, 100),
        }));

        const allOpts = [...DEFAULT_QR, ...customOpts].slice(0, 25);
        const qrSelect = new StringSelectMenuBuilder()
          .setCustomId(`ticket_qr_select_${ticketId}`)
          .setPlaceholder('💬 Choisir une réponse rapide...')
          .addOptions(allOpts);

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('💬 Réponses rapides')
            .setDescription(`Sélectionne une réponse à envoyer dans ce ticket.\n\n> ✏️ Ajoute tes propres réponses avec \`/ticket addreply\``)
          ],
          components: [new ActionRowBuilder().addComponents(qrSelect)],
          ephemeral: true,
        });
      }

      // ── Giveaway — participer ──
      if (customId === 'giveaway_enter') {
        const gw = db.db.prepare('SELECT * FROM giveaways WHERE channel_id = ? AND message_id = ? AND status = "active"')
          .get(interaction.channelId, interaction.message.id);

        if (!gw) return interaction.editReply({ content: '❌ Ce giveaway est terminé.', ephemeral: true });

        const user    = db.getUser(interaction.user.id, interaction.guildId);
        const entries = JSON.parse(gw.entries || '[]');

        // Conditions
        if (gw.min_level > 0 && user.level < gw.min_level) {
          return interaction.editReply({ content: `❌ Niveau minimum : **${gw.min_level}** (tu as niveau **${user.level}**).`, ephemeral: true });
        }
        if (gw.min_balance > 0 && user.balance < gw.min_balance) {
          return interaction.editReply({ content: `❌ Solde minimum : **${gw.min_balance.toLocaleString('fr-FR')}** coins.`, ephemeral: true });
        }

        // Déjà inscrit ?
        if (entries.includes(interaction.user.id)) {
          return interaction.editReply({ content: '⚠️ Tu participes déjà !', ephemeral: true });
        }

        // Bonus entrées si rôle bonus
        let bonus = 1;
        if (gw.bonus_role_id && interaction.member.roles.cache.has(gw.bonus_role_id)) bonus = 3;
        for (let i = 0; i < bonus; i++) entries.push(interaction.user.id);

        db.db.prepare('UPDATE giveaways SET entries = ? WHERE id = ?').run(JSON.stringify(entries), gw.id);

        const unique = new Set(entries).size;
        // Mettre à jour le message giveaway
        try {
          const embed = interaction.message.embeds[0]?.toJSON();
          if (embed) {
            embed.description = embed.description?.replace(/🎟️ \*\*Participants :\*\* \d+/, `🎟️ **Participants :** ${unique}`);
            await interaction.message.edit({ embeds: [embed] });
          }
        } catch {}

        return interaction.editReply({
          content: `🎉 Tu es inscrit ! Tu as **${bonus}** ticket${bonus > 1 ? 's' : ''} ! (${unique} participants au total)`,
          ephemeral: true
        });
      }

      // ── Role Menu — toggle rôle ──
      if (customId.startsWith('rolemenu_toggle_')) {
        const roleId = customId.replace('rolemenu_toggle_', '');
        const menu = db.db.prepare('SELECT * FROM role_menus WHERE guild_id=? AND message_id=?')
          .get(interaction.guildId, interaction.message.id);
        if (!menu) return interaction.editReply({ content: '❌ Menu introuvable.', ephemeral: true });

        const roles = JSON.parse(menu.roles || '[]');
        if (!roles.includes(roleId)) return interaction.editReply({ content: '❌ Rôle non autorisé pour ce menu.', ephemeral: true });

        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ Rôle inexistant.', ephemeral: true });

        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(role).catch(() => {});
          return interaction.editReply({ content: `✅ Rôle **${role.name}** retiré.`, ephemeral: true });
        } else {
          if (menu.max_choices > 0) {
            const currentCount = roles.filter(r => member.roles.cache.has(r)).length;
            if (currentCount >= menu.max_choices) {
              return interaction.editReply({ content: `❌ Tu as déjà **${menu.max_choices}** rôle(s) max sélectionné(s).`, ephemeral: true });
            }
          }
          if (menu.required_role && !member.roles.cache.has(menu.required_role)) {
            return interaction.editReply({ content: `❌ Tu dois avoir le rôle <@&${menu.required_role}> pour accéder à ce menu.`, ephemeral: true });
          }
          await member.roles.add(role).catch(() => {});
          return interaction.editReply({ content: `✅ Rôle **${role.name}** obtenu !`, ephemeral: true });
        }
      }

      // ── Coinflip — accepter/refuser ──
      if (customId.startsWith('coinflip_accept_') || customId.startsWith('coinflip_decline_')) {
        // Handled by collector inside coinflip.js — ignore here
        return;
      }

      // ── TicTacToe / Connect4 buttons ── (handled by collectors in command files)
      if (customId.startsWith('ttt_') || customId.startsWith('c4_')) return;

      // ── Poll — voter ──
      if (customId.startsWith('poll_vote_')) {
        const parts    = customId.replace('poll_vote_', '').split('_');
        const pollId   = parseInt(parts[0]);
        const optIdx   = parseInt(parts[1]);
        const poll     = db.db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);

        if (!poll || poll.ended) return interaction.editReply({ content: '❌ Ce sondage est terminé.', ephemeral: true });

        const votes = JSON.parse(poll.votes || '{}');

        // Un vote par personne
        for (const voters of Object.values(votes)) {
          if (Array.isArray(voters) && voters.includes(interaction.user.id)) {
            return interaction.editReply({ content: '⚠️ Tu as déjà voté !', ephemeral: true });
          }
        }

        if (!votes[optIdx]) votes[optIdx] = [];
        votes[optIdx].push(interaction.user.id);
        db.db.prepare('UPDATE polls SET votes = ? WHERE id = ?').run(JSON.stringify(votes), pollId);

        const choices = JSON.parse(poll.choices || '[]');
        const total   = Object.values(votes).reduce((a, v) => a + v.length, 0);
        const emojis  = ['🇦', '🇧', '🇨', '🇩'];

        const embed = new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle(`📊 ${poll.question}`)
          .setFooter({ text: `${total} vote${total !== 1 ? 's' : ''}` });

        for (let i = 0; i < choices.length; i++) {
          const cnt = (votes[i] || []).length;
          const pct = total > 0 ? Math.round(cnt / total * 100) : 0;
          const barL = 20;
          const fill = Math.round(pct / 100 * barL);
          const bar  = '█'.repeat(fill) + '░'.repeat(barL - fill);
          embed.addFields({ name: `${emojis[i]} ${choices[i]}`, value: `${bar} **${pct}%** (${cnt})`, inline: false });
        }

        await interaction.update({ embeds: [embed] });
        return;
      }

      // ── Candidatures — Accept/Reject (boutons app_accept_ / app_reject_) ──────
      if (customId.startsWith('app_accept_') || customId.startsWith('app_reject_')) {
        if (!interaction.member.permissions.has(0x4000n)) {
          return interaction.editReply({ content: '❌ Staff uniquement.', ephemeral: true });
        }
        const parts = customId.split('_');
        const action = parts[1]; // 'accept' ou 'reject'
        const subId = parseInt(parts[2]);
        const roleId = parts[3] || null;

        const sub2 = db.db.prepare('SELECT * FROM app_submissions WHERE id=?').get(subId);
        if (!sub2) return interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true });
        if (sub2.status !== 'pending') return interaction.editReply({ content: '❌ Cette candidature a déjà été traitée.', ephemeral: true });

        db.db.prepare('UPDATE app_submissions SET status=?, reviewer_id=? WHERE id=?')
          .run(action === 'accept' ? 'accepted' : 'rejected', interaction.user.id, subId);

        // Notifier l'auteur en DM
        try {
          const targetUser = await interaction.client.users.fetch(sub2.user_id);
          const dmEmbed = new EmbedBuilder()
            .setColor(action === 'accept' ? '#2ECC71' : '#E74C3C')
            .setTitle(action === 'accept' ? '✅ Candidature acceptée !' : '❌ Candidature refusée')
            .setDescription(action === 'accept'
              ? `Félicitations ! Votre candidature **${sub2.form_name}** sur **${interaction.guild.name}** a été **acceptée** !`
              : `Votre candidature **${sub2.form_name}** sur **${interaction.guild.name}** a été refusée. N'hésitez pas à réessayer plus tard.`)
            .setFooter({ text: `Traité par ${interaction.user.username}` });
          await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});

          // Donner le rôle si accepté
          if (action === 'accept' && roleId) {
            const member2 = await interaction.guild.members.fetch(sub2.user_id).catch(() => null);
            if (member2) await member2.roles.add(roleId).catch(() => {});
          }
        } catch {}

        // Mettre à jour le message staff
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(action === 'accept' ? '#2ECC71' : '#E74C3C')
          .setFooter({ text: `${action === 'accept' ? '✅ Accepté' : '❌ Refusé'} par ${interaction.user.username}` });

        await interaction.update({ embeds: [updatedEmbed], components: [] });
        return;
      }

      // ── Candidatures — bouton postuler (apply_nom) ────────────────────────────
      if (customId.startsWith('apply_')) {
        const nom = customId.replace('apply_', '');
        const { execute } = require('../commands_guild/utility/applications');
        const fakeInteraction = Object.assign(Object.create(Object.getPrototypeOf(interaction)), interaction);
        fakeInteraction.options = {
          getSubcommand: () => 'postuler',
          getString: (key) => key === 'formulaire' ? nom : null,
        };
        try { await execute(fakeInteraction); } catch {}
        return;
      }

      // ── Prestige (confirmation) ──────────────────────────────────────────────
      if (customId.startsWith('prestige_confirm_') || customId.startsWith('prestige_cancel_')) {
        const targetUserId = customId.split('_').pop();
        if (interaction.user.id !== targetUserId) return interaction.editReply({ content: '❌ Ce n\'est pas votre confirmation.', ephemeral: true });
        if (customId.startsWith('prestige_cancel_')) return interaction.update({ content: '❌ Prestige annulé.', embeds: [], components: [] });

        const PRESTIGE_LEVELS = [
          { level: 1, required_xp_level: 50, color: '#CD7F32', emoji: '🥉', bonus: '+15% XP permanent', multiplier: 1.15 },
          { level: 2, required_xp_level: 50, color: '#C0C0C0', emoji: '🥈', bonus: '+30% XP permanent', multiplier: 1.30 },
          { level: 3, required_xp_level: 50, color: '#FFD700', emoji: '🥇', bonus: '+50% XP permanent', multiplier: 1.50 },
          { level: 4, required_xp_level: 75, color: '#9B59B6', emoji: '💜', bonus: '+75% XP + 10% coins', multiplier: 1.75 },
          { level: 5, required_xp_level: 75, color: '#3498DB', emoji: '💎', bonus: '+100% XP + 20% coins', multiplier: 2.00 },
          { level: 6, required_xp_level: 100, color: '#E74C3C', emoji: '🔴', bonus: '+150% XP + 30% coins', multiplier: 2.50 },
          { level: 7, required_xp_level: 100, color: '#FF6B6B', emoji: '🌟', bonus: '+200% XP + 50% coins', multiplier: 3.00 },
          { level: 8, required_xp_level: 150, color: '#FFD700', emoji: '👑', bonus: 'LÉGENDAIRE — +300% XP + 100% coins', multiplier: 4.00 },
        ];
        const u = db.getUser(targetUserId, interaction.guildId);
        const currentPrestige = u.prestige || 0;
        const nextP = PRESTIGE_LEVELS[currentPrestige];
        if (!nextP) return interaction.update({ content: '✅ Prestige maximum déjà atteint !', embeds: [], components: [] });

        const coinReward = 5000 * (currentPrestige + 1);
        db.db.prepare('UPDATE users SET prestige=?, level=1, xp=0, prestige_coins_total=prestige_coins_total+? WHERE user_id=? AND guild_id=?')
          .run(currentPrestige + 1, coinReward, targetUserId, interaction.guildId);
        db.addCoins(targetUserId, interaction.guildId, coinReward);

        const cfg2 = db.getConfig(interaction.guildId);
        return interaction.update({ embeds: [new EmbedBuilder()
          .setColor(nextP.color)
          .setTitle(`${nextP.emoji} Prestige ${currentPrestige + 1} atteint !`)
          .setDescription(`Félicitations ! Vous êtes maintenant **${nextP.emoji} Prestige ${currentPrestige + 1}** !\n\n✅ Bonus actif : **${nextP.bonus}**\n💰 +${coinReward.toLocaleString()} ${cfg2.currency_emoji || '🪙'}`)
        ], components: [] });
      }

      // ── Morpion (boutons morpion_*) ────────────────────────────────────────────
      if (customId.startsWith('morpion_')) {
        try {
          const { handleButton } = require('../commands_guild/games/morpion');
          await handleButton(interaction);
        } catch (e) { console.error('[MORPION]', e.message); }
        return;
      }

      // ── Tournoi (bouton inscription tournoi_join_id) ───────────────────────────
      if (customId.startsWith('tournoi_join_')) {
        const tournoiId = parseInt(customId.replace('tournoi_join_', ''));
        const db2 = require('../database/db');
        const guildId2 = interaction.guildId;
        const userId2 = interaction.user.id;
        const tournoi2 = db2.db.prepare('SELECT * FROM tournois WHERE id=? AND guild_id=?').get(tournoiId, guildId2);
        if (!tournoi2 || tournoi2.status !== 'inscription') {
          return interaction.editReply({ content: '❌ Les inscriptions sont fermées.', ephemeral: true });
        }
        const count2 = db2.db.prepare('SELECT COUNT(*) as c FROM tournoi_players WHERE tournoi_id=?').get(tournoiId);
        if (count2.c >= tournoi2.max_players) {
          return interaction.editReply({ content: '❌ Le tournoi est complet.', ephemeral: true });
        }
        try {
          db2.db.prepare('INSERT INTO tournoi_players (tournoi_id, guild_id, user_id) VALUES (?,?,?)').run(tournoiId, guildId2, userId2);
          return interaction.editReply({ content: `✅ Inscrit au tournoi **${tournoi2.name}** ! (${count2.c + 1}/${tournoi2.max_players})`, ephemeral: true });
        } catch {
          return interaction.editReply({ content: '❌ Vous êtes déjà inscrit.', ephemeral: true });
        }
      }

      // ── Pendu (boutons pendu_lettre) ──────────────────────────────────────────
      if (customId.startsWith('pendu_')) {
        try {
          const { handleButton } = require('../commands_guild/games/pendu');
          await handleButton(interaction);
        } catch (e) { console.error('[PENDU]', e.message); }
        return;
      }

      // ── Pets — abandon confirmation ───────────────────────────────────────────
      if (customId.startsWith('pet_abandon_confirm_') || customId.startsWith('pet_abandon_cancel_')) {
        const targetUserId = customId.split('_').pop();
        if (interaction.user.id !== targetUserId) return interaction.editReply({ content: '❌ Ce n\'est pas votre action.', ephemeral: true });
        if (customId.startsWith('pet_abandon_cancel_')) {
          return interaction.update({ content: '✅ Abandon annulé, votre animal est en sécurité !', embeds: [], components: [] });
        }
        // Confirm abandon
        db.db.prepare('DELETE FROM pets WHERE guild_id=? AND owner_id=?').run(interaction.guildId, targetUserId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('💔 Animal abandonné').setDescription('Votre animal a été libéré. Vous pouvez en adopter un nouveau avec `/pet adopter`.')], components: [] });
      }

// ── Reaction Roles (boutons rr_) ─────────────────────────────────────────
      if (customId.startsWith('rr_')) {
        const roleId = customId.replace('rr_', '');
        const rr = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id=? AND role_id=? AND message_id=?').get(interaction.guildId, roleId, interaction.message.id);
        if (!rr) return interaction.editReply({ content: '❌ Configuration introuvable.', ephemeral: true });

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) return interaction.editReply({ content: '❌ Rôle inexistant.', ephemeral: true });

        const hasRole = interaction.member.roles.cache.has(roleId);
        if (hasRole) {
          await interaction.member.roles.remove(roleId);
          return interaction.editReply({ content: `✅ Rôle **${role.name}** retiré !`, ephemeral: true });
        } else {
          await interaction.member.roles.add(roleId);
          return interaction.editReply({ content: `✅ Rôle **${role.name}** attribué !`, ephemeral: true });
        }
      }
    }

    // ── AUTOCOMPLETE ─────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        await command.autocomplete(interaction).catch(() => {});
      }
      return;
    }

    // ── STRING SELECT MENUS ──────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const db = require('../database/db');

      // ── Sélection de catégorie ticket → afficher menu priorité ──
      if (interaction.customId === 'ticket_select_cat') {
        const category = interaction.values[0];
        const { getCatInfo, PRIORITIES } = require('../commands/unique/ticket');
        const { detectAutoPriority, detectSpam, calcTrustScore, getTrustLabel } = require('../utils/ticketIntelligence');
        const cat = getCatInfo(category);

        // Vérification spam
        const spamCheck = detectSpam(db.db, interaction.guildId, interaction.user.id);
        if (spamCheck.spam) {
          return interaction.update({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Action refusée — Limite atteinte')
              .setDescription(
                `Tu ne peux pas ouvrir de nouveau ticket pour le moment.\n\n` +
                `**Raison :** ${spamCheck.reason}\n\n` +
                `> ⚠️ Si tu penses que c'est une erreur, contacte un administrateur.`
              )
            ],
            components: [],
          });
        }

        const existing = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing)
          return interaction.update({ content: `❌ Tu as déjà un ticket ouvert : <#${existing.channel_id}>`, embeds: [], components: [] });

        // Calcul trust score pour affichage
        const trustScore = calcTrustScore(db.db, interaction.guildId, interaction.user.id);
        const trustInfo  = getTrustLabel(trustScore);

        // Suggestion automatique de priorité
        const PRIORITIES_ALL = PRIORITIES.map(p => {
          const suggested = category === 'bug' && p.value === 'elevee'
                         || category === 'signalement' && p.value === 'elevee';
          return {
            label: p.label + (suggested ? ' ✨ Suggéré' : ''),
            description: p.description,
            value: p.value,
          };
        });

        const priorityMenu = new StringSelectMenuBuilder()
          .setCustomId(`ticket_pri_${category}`)
          .setPlaceholder('⚡ Sélectionne le niveau d\'urgence...')
          .addOptions(PRIORITIES_ALL);

        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(cat.color || '#7B2FBE')
            .setTitle(`${cat.emoji} ${cat.label.replace(/^.*? /,'')} — Étape 2/2`)
            .setDescription(
              '**Quel est le niveau d\'urgence de ta demande ?**\n\n' +
              '🟢 **Faible** — Pas urgent, quand vous avez le temps\n' +
              '🟡 **Normale** — Demande standard\n' +
              '🟠 **Élevée** — Assez urgent, j\'ai besoin d\'aide\n' +
              '🔴 **Urgente** — Besoin d\'aide immédiatement !\n\n' +
              `> ${trustInfo.emoji} Ton score de confiance : **${trustScore}/100** (${trustInfo.label})\n` +
              `> ⚠️ N'abuse pas de la priorité urgente — cela aide le staff à traiter les vrais cas critiques.`
            )
            .setFooter({ text: `Catégorie : ${cat.label} • Étape 2/2` })
          ],
          components: [new ActionRowBuilder().addComponents(priorityMenu)],
        });
      }

      // ── Sélection de priorité → créer le ticket ──
      if (interaction.customId.startsWith('ticket_pri_')) {
        const category = interaction.customId.replace('ticket_pri_', '');
        const priority = interaction.values[0];

        // Vérification rapide : ticket déjà ouvert ?
        const existing2 = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
          .get(interaction.guildId, interaction.user.id);
        if (existing2)
          return interaction.update({ content: `⚠️ Tu as déjà un ticket ouvert : <#${existing2.channel_id}>`, embeds: [], components: [] });

        // Vérification permissions du bot AVANT deferUpdate
        const botSelf = interaction.guild.members.me;
        if (!botSelf?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return interaction.update({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('❌ Permission manquante')
              .setDescription('Le bot n\'a pas la permission **Gérer les salons** sur ce serveur.\n\nUn administrateur doit accorder cette permission à NexusBot.')
            ],
            components: [],
          });
        }

        // Tout semble OK → différer
        await interaction.deferUpdate().catch(() => {});

        const cfg   = db.getConfig(interaction.guildId);
        const guild = interaction.guild;
        const { getCatInfo, getPriInfo } = require('../commands/unique/ticket');
        const {
          calcTrustScore, getTrustLabel,
          detectSpam, isSensitiveContent,
          getAutoAssignStaff, estimateResponseTime,
        } = require('../utils/ticketIntelligence');
        const cat = getCatInfo(category);
        const pri = getPriInfo(priority);

        // ── Double-vérification spam ──────────────────────────────────────────
        const spamCheck2 = detectSpam(db.db, interaction.guildId, interaction.user.id);
        if (spamCheck2.spam) {
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚫 Action refusée — Limite atteinte')
              .setDescription(
                `Tu ne peux pas ouvrir de nouveau ticket pour le moment.\n\n` +
                `**Raison :** ${spamCheck2.reason}\n\n` +
                `> ⚠️ Si tu penses que c'est une erreur, contacte un administrateur.`
              )
            ],
            ephemeral: true,
          }).catch(() => {});
        }

        try {
          const ticketNumber = (db.db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id=?').get(interaction.guildId)?.c ?? 0) + 1;
          // Nom de canal sécurisé : lettres/chiffres/tirets uniquement, max 100 chars
          const safeUser = interaction.user.username.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12) || 'user';
          const channelName = `${category}-${safeUser}-${ticketNumber}`.slice(0, 100);

          // ── Mode privé pour contenus sensibles (signalement) ─────────────────
          const isPrivate = isSensitiveContent(category, '');

          // Permissions : @everyone bloqué, user + staff + bot autorisés
          const permissionOverwrites = [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
              ],
            },
            // Bot lui-même — doit toujours pouvoir voir et envoyer
            {
              id: botSelf.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ];

          // En mode privé, le rôle staff n'est PAS ajouté automatiquement
          // Seul un admin peut y accéder (via permission ManageChannels)
          if (cfg.ticket_staff_role && !isPrivate) {
            permissionOverwrites.push({
              id: cfg.ticket_staff_role,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            });
          }

          // Catégorie parente — DB en priorité, sinon auto-détecter
          let parent = cfg.ticket_category ? guild.channels.cache.get(cfg.ticket_category) : null;
          if (!parent) {
            parent = guild.channels.cache.find(c =>
              c.type === ChannelType.GuildCategory && /ticket|support|aide|help/i.test(c.name)
            ) || null;
          }

          // Créer le salon
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: parent?.id ?? undefined,
            permissionOverwrites,
            topic: `${cat.emoji} ${cat.label} | ${pri.emoji} ${pri.label} | Ouvert par : ${interaction.user.tag}${isPrivate ? ' | 🔒 PRIVÉ' : ''}`,
          });

          // ── Intelligence : trust score + auto-assign + ETA ────────────────────
          const trustScore  = calcTrustScore(db.db, interaction.guildId, interaction.user.id);
          const trustInfo   = getTrustLabel(trustScore);
          const etaMins     = estimateResponseTime(db.db, interaction.guildId);
          const etaText     = etaMins < 60
            ? `~${etaMins} minute${etaMins > 1 ? 's' : ''}`
            : `~${Math.round(etaMins / 60)}h`;

          // Auto-assign au staff le moins chargé
          let autoAssignedMember = null;
          try {
            autoAssignedMember = await getAutoAssignStaff(guild, cfg, db.db);
          } catch {}

          // Insérer en DB avec trust_score, is_private, auto_assigned, claimed_by
          const nowTs = Math.floor(Date.now() / 1000);
          const result = db.db.prepare(
            `INSERT INTO tickets
              (guild_id, channel_id, user_id, status, category, priority, created_at,
               trust_score, is_private, auto_assigned, claimed_by)
             VALUES (?,?,?,'open',?,?,?, ?,?,?,?)`
          ).run(
            interaction.guildId, ticketChannel.id, interaction.user.id,
            category, priority, nowTs,
            trustScore,
            isPrivate ? 1 : 0,
            autoAssignedMember ? 1 : 0,
            autoAssignedMember?.id ?? null,
          );
          const ticketId = result.lastInsertRowid;

          // ── Texte d'accueil personnalisé par catégorie ────────────────────────
          const catMsgKey = `ticket_msg_${category}`;
          const welcomeText = cfg[catMsgKey]
            || cfg.ticket_welcome_msg
            || (isPrivate
              ? '🔒 Ce ticket est **confidentiel**. Seul le staff autorisé pourra y accéder. Décris ton signalement en détail.'
              : 'Décris ton problème en détail et un membre du staff te répondra dès que possible.');

          const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_claim_${ticketId}`).setLabel('Prendre en charge').setEmoji('✋').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${ticketId}`).setLabel('Fermer le ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ticket_quickreply_${ticketId}`).setLabel('Réponses rapides').setEmoji('💬').setStyle(ButtonStyle.Secondary),
          );

          const embedColor = {
            urgente: '#E74C3C', elevee: '#E67E22', normale: cat.color || '#7B2FBE', faible: '#2ECC71'
          }[priority] || (cat.color || '#7B2FBE');

          const urgentBanner = priority === 'urgente'
            ? '\n\n> 🚨 **PRIORITÉ URGENTE** — Le staff va traiter cette demande immédiatement.'
            : priority === 'elevee' ? '\n\n> 🟠 **Priorité élevée** — Traitement accéléré.' : '';

          const privateBanner = isPrivate
            ? '\n\n> 🔒 **Ticket confidentiel** — Seul le staff habilité peut accéder à ce salon.'
            : '';

          const assignedLine = autoAssignedMember
            ? `✋ Assigné automatiquement à <@${autoAssignedMember.id}>`
            : '✋ En attente d\'un membre du staff';

          // Notifier le staff assigné seulement si pas mode privé (ou si admin)
          const notifyContent = isPrivate
            ? `<@${interaction.user.id}>`
            : `<@${interaction.user.id}>${autoAssignedMember ? ` <@${autoAssignedMember.id}>` : (cfg.ticket_staff_role ? ` <@&${cfg.ticket_staff_role}>` : '')}`;

          // Envoyer le message d'accueil dans le ticket
          await ticketChannel.send({
            content: notifyContent,
            embeds: [new EmbedBuilder()
              .setColor(embedColor)
              .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
              .setTitle(`${cat.emoji} Ticket #${ticketNumber} — ${cat.label.replace(/^[^\s]+ /, '')}`)
              .setDescription(
                `Bienvenue <@${interaction.user.id}> ! 👋\n\n**${welcomeText}**${urgentBanner}${privateBanner}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📝 Décris ton problème en détail\n` +
                `📸 Joins des captures si nécessaire\n` +
                `⏱️ Temps de réponse estimé : **${etaText}**`
              )
              .addFields(
                { name: `${cat.emoji} Catégorie`,  value: `\`${cat.label}\``,        inline: true },
                { name: `${pri.emoji} Priorité`,   value: `\`${pri.label}\``,        inline: true },
                { name: '🎟️ N°',                  value: `\`#${ticketNumber}\``,     inline: true },
                { name: '📅 Ouvert',               value: `<t:${nowTs}:R>`,          inline: true },
                { name: '👤 Membre',               value: `<@${interaction.user.id}>`, inline: true },
                { name: '📊 Statut',               value: isPrivate ? '`🔒 Privé`' : '`🟢 Ouvert`', inline: true },
                { name: '🤖 Assigné',              value: assignedLine,              inline: false },
              )
              .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
              .setFooter({ text: `${interaction.guild.name} • Support`, iconURL: interaction.guild.iconURL() })
              .setTimestamp()
            ],
            components: [controlRow],
          });

          // ── DM au staff auto-assigné ──────────────────────────────────────────
          if (autoAssignedMember) {
            autoAssignedMember.send({
              embeds: [new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📋 Nouveau ticket assigné — #${ticketNumber}`)
                .setDescription(
                  `Tu as été **automatiquement assigné** à un nouveau ticket.\n\n` +
                  `> Rends-toi dans ${ticketChannel} pour traiter la demande.`
                )
                .addFields(
                  { name: '👤 Utilisateur',    value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: false },
                  { name: `${cat.emoji} Catégorie`, value: cat.label,  inline: true },
                  { name: `${pri.emoji} Priorité`,  value: pri.label,  inline: true },
                  { name: '🎟️ Ticket',          value: `\`#${ticketNumber}\``, inline: true },
                  { name: `${trustInfo.emoji} Confiance`, value: `${trustScore}/100 (${trustInfo.label})`, inline: true },
                )
                .setFooter({ text: `${interaction.guild.name} • Auto-assigné par NexusBot` })
                .setTimestamp()
              ],
            }).catch(() => {});
          }

          // ── Profil utilisateur automatique (visible staff dans le ticket) ──
          try {
            const prevTickets   = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND id!=? ORDER BY created_at DESC LIMIT 5")
              .all(interaction.guildId, interaction.user.id, ticketId);
            const warnings      = db.db.prepare("SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?")
              .get(interaction.guildId, interaction.user.id)?.c || 0;
            const notes         = db.db.prepare("SELECT COUNT(*) as c FROM mod_notes WHERE guild_id=? AND user_id=?")
              .get(interaction.guildId, interaction.user.id)?.c || 0;
            const acctAgeDays   = Math.floor((Date.now() - interaction.user.createdTimestamp) / 86400000);
            const joinAgeDays   = interaction.member?.joinedTimestamp
              ? Math.floor((Date.now() - interaction.member.joinedTimestamp) / 86400000)
              : null;

            const prevLines = prevTickets.length
              ? prevTickets.map(t => {
                  const tc = getCatInfo(t.category);
                  const tp = getPriInfo(t.priority || 'normale');
                  const st = t.status === 'open' ? '🟢' : '🔴';
                  return `${st} ${tc.emoji} \`#${t.id}\` ${tp.emoji} <t:${t.created_at}:d>`;
                }).join('\n')
              : '`Aucun ticket précédent`';

            // Niveau de risque
            let riskStr = warnings >= 5 ? '🔴 Risque élevé (5+ warns)'
              : warnings >= 3 ? '🟠 Modéré (3+ warns)'
              : warnings >= 1 ? '🟡 À surveiller (1-2 warns)'
              : '🟢 Aucun avertissement';
            if (acctAgeDays < 7) riskStr += '\n⚠️ Compte récent (< 7 jours)';

            const profileColor = warnings >= 3 ? '#E74C3C' : warnings >= 1 ? '#E67E22' : '#2C2F33';

            await ticketChannel.send({
              embeds: [new EmbedBuilder()
                .setColor(profileColor)
                .setAuthor({ name: '👤 Profil Utilisateur — Vue Staff', iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`> ⚠️ Ces informations sont **visibles uniquement par le staff**.`)
                .addFields(
                  { name: '👤 Utilisateur',    value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
                  { name: '📅 Compte créé',    value: `<t:${Math.floor(interaction.user.createdTimestamp/1000)}:R> (${acctAgeDays}j)`, inline: true },
                  { name: '📆 Sur le serveur', value: joinAgeDays !== null ? `<t:${Math.floor(interaction.member.joinedTimestamp/1000)}:R> (${joinAgeDays}j)` : 'Inconnu', inline: true },
                  { name: '⚠️ Warns',          value: `**${warnings}**`, inline: true },
                  { name: '📝 Notes mod',      value: `**${notes}**`,    inline: true },
                  { name: `${trustInfo.emoji} Score confiance`, value: `**${trustScore}/100** — ${trustInfo.label}`, inline: true },
                  { name: '🛡️ Profil',         value: riskStr,          inline: false },
                  { name: `🎫 Tickets précédents (${prevTickets.length})`, value: prevLines, inline: false },
                )
                .setFooter({ text: '📋 Vue interne automatique — /ticket profile pour le détail complet' })
              ]
            }).catch(() => {});
          } catch {}

          // Logguer l'ouverture si un salon logs est configuré
          if (cfg.ticket_log_channel) {
            const logCh = guild.channels.cache.get(cfg.ticket_log_channel);
            if (logCh) {
              logCh.send({ embeds: [new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`📂 Nouveau ticket #${ticketNumber}${isPrivate ? ' 🔒' : ''}`)
                .addFields(
                  { name: '👤 Membre', value: `<@${interaction.user.id}>`, inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                  { name: `${pri.emoji} Priorité`, value: pri.label, inline: true },
                  { name: '🔗 Salon', value: `${ticketChannel}`, inline: true },
                  { name: `${trustInfo.emoji} Confiance`, value: `${trustScore}/100`, inline: true },
                  { name: '✋ Assigné', value: autoAssignedMember ? `<@${autoAssignedMember.id}>` : 'Non assigné', inline: true },
                )
                .setTimestamp()
              ] }).catch(() => {});
            }
          }

          // Effacer l'interaction de sélection (le menu priorité disparaît)
          await interaction.editReply({ content: '', embeds: [], components: [] }).catch(() => {});

          // Confirmer en éphémère
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle('✅ Ticket ouvert !')
              .setDescription(`Ton ticket est prêt : ${ticketChannel}\n\nLe staff sera notifié et te répondra rapidement.\n\n> ⏱️ Temps de réponse estimé : **${etaText}**`)
              .addFields({ name: '🎟️ Référence', value: `\`Ticket #${ticketNumber}\``, inline: true })
              .setFooter({ text: `${cat.label} • ${pri.label}` })
            ],
            ephemeral: true,
          });

        } catch (err) {
          console.error('[TICKET] Erreur création ticket:', err);
          return interaction.followUp({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('❌ Création du ticket impossible')
              .setDescription(
                'Une erreur est survenue. Causes fréquentes :\n\n' +
                '• Le bot manque de la permission **Gérer les salons**\n' +
                '• La **catégorie Discord** pour les tickets n\'existe pas\n' +
                '• Le serveur a atteint la **limite de 500 salons**\n\n' +
                '> Lance `/ticket setup` pour reconfigurer, puis réessaie.\n\n' +
                `\`\`\`${err.message?.slice(0, 200) || 'Erreur inconnue'}\`\`\``
              )
            ],
            ephemeral: true,
          }).catch(() => {});
        }
      }

      // Le menu /help est géré dans le collecteur interne à help.js
    }

    // ── STRING SELECT MENUS (suite) — Réponses rapides ticket + Notation ──
    if (interaction.isStringSelectMenu()) {
      const db2 = require('../database/db');

      // ── Quick Reply envoi ──
      if (interaction.customId.startsWith('ticket_qr_select_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_qr_select_', ''));
        const ticket   = db2.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        const channel = interaction.guild.channels.cache.get(ticket.channel_id);
        if (!channel) return interaction.reply({ content: '❌ Salon introuvable.', ephemeral: true });

        const value = interaction.values[0];

        // Map des réponses rapides par défaut
        const QR_MESSAGES = {
          qr_welcome:    `👋 Bonjour <@${ticket.user_id}> ! Je suis **${interaction.member.displayName}** et je vais m'occuper de ta demande. Décris-moi ton problème en détail, je t'aide dès que possible !`,
          qr_wait:       `⏳ Merci pour ta patience <@${ticket.user_id}> ! Nous examinons ta demande et te revenons dès que possible.`,
          qr_screenshot: `📷 Pourrais-tu nous fournir des **captures d'écran** ou tout autre élément visuel pour mieux comprendre ton problème ? Merci !`,
          qr_info:       `🔄 Pourriez-vous nous fournir plus de détails ?\n\n• Version concernée / contexte\n• Étapes pour reproduire le problème\n• Ce que vous avez déjà essayé\n• Messages d'erreur éventuels`,
          qr_resolved:   `✅ Il semble que le problème soit résolu ! Si tu as d'autres questions, n'hésite pas à demander. Sinon, nous allons fermer ce ticket prochainement. Merci d'avoir contacté le support !`,
          qr_closing:    `🔒 <@${ticket.user_id}> — Ce ticket va être **fermé prochainement** faute d'activité. Si tu as encore besoin d'aide, envoie un message maintenant !`,
        };

        let msgContent;

        if (value.startsWith('qr_custom_')) {
          // Réponse personnalisée du serveur
          const customId = parseInt(value.replace('qr_custom_', ''));
          const customReply = db2.db.prepare('SELECT * FROM ticket_quick_replies WHERE id=? AND guild_id=?')
            .get(customId, interaction.guildId);
          if (!customReply) return interaction.reply({ content: '❌ Réponse introuvable.', ephemeral: true });
          // Remplacer {user} par la mention
          msgContent = customReply.content.replace(/\{user\}/g, `<@${ticket.user_id}>`);
        } else {
          msgContent = QR_MESSAGES[value];
        }

        if (!msgContent) return interaction.reply({ content: '❌ Réponse inconnue.', ephemeral: true });

        await channel.send({ content: msgContent }).catch(() => {});

        return interaction.update({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setDescription(`✅ Réponse rapide envoyée dans <#${ticket.channel_id}>.`)
          ],
          components: [],
        });
      }

      if (interaction.customId.startsWith('ticket_rate_select_')) {
        const ticketId = parseInt(interaction.customId.replace('ticket_rate_select_', ''));
        const rating   = parseInt(interaction.values[0]);
        const ticket   = db2.db.prepare('SELECT * FROM tickets WHERE id=?').get(ticketId);
        if (!ticket) return interaction.reply({ content: '❌ Ticket introuvable.', ephemeral: true });

        if (interaction.user.id !== ticket.user_id) {
          return interaction.reply({ content: '❌ Seul le créateur du ticket peut évaluer le support.', ephemeral: true });
        }

        db2.db.prepare('UPDATE tickets SET rating=? WHERE id=?').run(rating, ticketId);

        const ratingColors  = { 1: '#E74C3C', 2: '#E67E22', 3: '#F1C40F', 4: '#9ACD32', 5: '#2ECC71' };
        const ratingLabels  = { 1: '😡 Très insatisfait', 2: '😕 Insatisfait', 3: '😐 Neutre', 4: '🙂 Satisfait', 5: '😄 Excellent !' };
        const ratingMessages = {
          1: 'Nous sommes vraiment désolés de ne pas avoir répondu à tes attentes. Nous allons faire mieux.',
          2: 'Merci pour ton retour. Nous allons travailler à améliorer notre support.',
          3: 'Merci ! Nous visons l\'excellence et continuerons à nous améliorer.',
          4: 'Super ! Merci pour ce retour positif, ça nous encourage !',
          5: 'Incroyable, merci beaucoup ! Ça motive toute l\'équipe ! 🎉',
        };
        const stars = '⭐'.repeat(rating);

        // Log dans le salon des logs
        try {
          const cfgData = db2.getConfig(ticket.guild_id);
          if (cfgData?.ticket_log_channel) {
            const logCh = interaction.guild.channels.cache.get(cfgData.ticket_log_channel);
            if (logCh) {
              await logCh.send({
                embeds: [new EmbedBuilder()
                  .setColor(ratingColors[rating])
                  .setAuthor({ name: `Évaluation — ${ratingLabels[rating]}`, iconURL: interaction.user.displayAvatarURL() })
                  .setTitle(`${stars} ${rating}/5 — Ticket #${ticketId}`)
                  .addFields(
                    { name: '👤 Client',   value: `<@${ticket.user_id}>`, inline: true },
                    { name: '⭐ Note',     value: `**${rating}/5**`,      inline: true },
                    { name: '🎫 Ticket',  value: `\`#${ticketId}\``,     inline: true },
                  )
                  .setFooter({ text: ratingMessages[rating] })
                  .setTimestamp()
                ]
              }).catch(() => {});
            }
          }
        } catch {}

        await interaction.update({
          embeds: [new EmbedBuilder()
            .setColor(ratingColors[rating])
            .setTitle(`${stars} ${rating}/5 — Merci pour ton évaluation !`)
            .setDescription(
              `**${ratingLabels[rating]}**\n\n` +
              `> ${ratingMessages[rating]}\n\n` +
              `Ce salon va être supprimé dans **3 secondes**...`
            )
            .setFooter({ text: `${interaction.guild.name} • Merci d'avoir utilisé notre support !` })
          ],
          components: [],
        }).catch(() => {});

        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
        return;
      }
    }

    // ── MENUS CONTEXTUELS (clic droit) ───────────────────
    if (interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`[MENU] Erreur "${interaction.commandName}":`, error);
        const reply = { content: '❌ Une erreur est survenue.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply(reply).catch(() => {});
        } else {
          await interaction.editReply(reply).catch(() => {});
        }
      }
      return;
    }

    // ── MODALS ────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      if (!interaction.deferred && !interaction.replied) { await interaction.deferReply({ ephemeral: false }).catch(() => {}); }
      const db = require('../database/db');
      const customId = interaction.customId;

      // Signalement de message
      if (customId.startsWith('report_msg_')) {
        const msgId = customId.replace('report_msg_', '');
        const raison = interaction.fields.getTextInputValue('raison');
        const cfg = db.getConfig(interaction.guildId);
        const logCh = cfg.log_channel ? interaction.guild.channels.cache.get(cfg.log_channel) : null;
        const ticketCh = cfg.ticket_log_channel ? interaction.guild.channels.cache.get(cfg.ticket_log_channel) : null;
        const targetCh = logCh || ticketCh;

        const { EmbedBuilder } = require('discord.js');
        const reportEmbed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('🚨 Signalement de message')
          .addFields(
            { name: '👤 Signalé par', value: `<@${interaction.user.id}>`, inline: true },
            { name: '📋 Raison', value: raison, inline: true },
            { name: '🆔 ID Message', value: msgId, inline: true },
            { name: '💬 Salon', value: `<#${interaction.channelId}>`, inline: true },
          )
          .setTimestamp();

        if (targetCh) await targetCh.send({ embeds: [reportEmbed] }).catch(() => {});
        return interaction.editReply({ content: '✅ Ton signalement a été transmis aux modérateurs. Merci !', ephemeral: true });
      }

      // Don de coins via context menu
      if (customId.startsWith('give_coins_ctx_')) {
        const targetId = customId.replace('give_coins_ctx_', '');
        const montant = parseInt(interaction.fields.getTextInputValue('montant'));
        if (isNaN(montant) || montant <= 0) return interaction.editReply({ content: '❌ Montant invalide.', ephemeral: true });

        const u = db.getUser(interaction.user.id, interaction.guildId);
        if (u.balance < montant) {
          const cfg = db.getConfig(interaction.guildId);
          return interaction.editReply({ content: `❌ Tu n'as pas assez de ${cfg.currency_emoji || '🪙'}.`, ephemeral: true });
        }

        db.addCoins(interaction.user.id, interaction.guildId, -montant);
        db.addCoins(targetId, interaction.guildId, montant);
        const cfg = db.getConfig(interaction.guildId);
        return interaction.editReply({
          content: `✅ Tu as donné **${montant} ${cfg.currency_emoji || '🪙'}** à <@${targetId}> !`,
          ephemeral: true
        });
      }
    }

    // ── FALLBACK — Interaction non gérée ─────────────────
    // Empêche "L'application ne répond plus" pour tout bouton/menu inconnu
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.editReply({ content: '❌ Cette interaction n\'est plus disponible.', ephemeral: true }).catch(() => {});
    }
}
