'use strict';
// ============================================================
// almosni.js — Crypto exclusive du serveur : Almosni (ALM)
// Commandes : /almosni balance | acheter | vendre | give | burn | stats | miner
// ============================================================

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ── Constantes ALM ────────────────────────────────────────────────────────────
const SYMBOL       = 'ALM';
const NAME         = 'Almosni';
const EMOJI        = '🔮';
const INIT_PRICE   = 100;          // Prix initial en €
const VOLATILITY   = 0.035;        // Volatilité quotidienne (3.5%)
const MINE_REWARD_MIN = 5;         // ALM min par minage
const MINE_REWARD_MAX = 25;        // ALM max par minage
const MINE_COOLDOWN = 3600;        // 1h entre chaque minage (secondes)
const TOTAL_SUPPLY  = 21_000_000;  // Offre max (comme Bitcoin)

// ── Table dédiée ALM ─────────────────────────────────────────────────────────
function ensureAlmTable() {
  try {
    db.db.exec(`
      CREATE TABLE IF NOT EXISTS alm_mine (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        last_mine  INTEGER DEFAULT 0,
        total_mined REAL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      );
      CREATE TABLE IF NOT EXISTS alm_stats (
        guild_id     TEXT PRIMARY KEY,
        total_burned REAL DEFAULT 0,
        total_mined  REAL DEFAULT 0,
        total_traded REAL DEFAULT 0
      );
    `);
  } catch {}
}

// ── Initialiser / récupérer le prix ALM ──────────────────────────────────────
function getAlmPrice() {
  ensureAlmTable();
  let row = db.db.prepare('SELECT * FROM crypto_market WHERE symbol = ?').get(SYMBOL);
  if (!row) {
    db.db.prepare(`
      INSERT OR IGNORE INTO crypto_market (symbol, name, emoji, price, prev_price, volatility, cg_id, change_24h)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 0)
    `).run(SYMBOL, NAME, EMOJI, INIT_PRICE, INIT_PRICE, VOLATILITY);
    row = db.db.prepare('SELECT * FROM crypto_market WHERE symbol = ?').get(SYMBOL);
  }
  return row;
}

// ── Fluctuation du prix ALM (appelée à l'achat/vente/burn) ───────────────────
function fluctuateAlm(direction = 0) {
  const row    = getAlmPrice();
  const change = (Math.random() * VOLATILITY * 2 - VOLATILITY) + direction * VOLATILITY * 0.5;
  const newPrice = Math.max(1, row.price * (1 + change));
  const change24 = ((newPrice - row.prev_price) / row.prev_price) * 100;
  db.db.prepare(`
    UPDATE crypto_market SET prev_price = price, price = ?, change_24h = ?, updated_at = strftime('%s','now')
    WHERE symbol = ?
  `).run(newPrice, change24, SYMBOL);
  return newPrice;
}

// ── Solde ALM d'un utilisateur ───────────────────────────────────────────────
function getAlmBalance(userId, guildId) {
  const row = db.db.prepare(
    'SELECT amount, avg_buy FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?'
  ).get(userId, guildId, SYMBOL);
  return row || { amount: 0, avg_buy: 0 };
}

// ── Stats globales ALM du serveur ────────────────────────────────────────────
function getAlmServerStats(guildId) {
  ensureAlmTable();
  let row = db.db.prepare('SELECT * FROM alm_stats WHERE guild_id = ?').get(guildId);
  if (!row) {
    db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
    row = { guild_id: guildId, total_burned: 0, total_mined: 0, total_traded: 0 };
  }
  return row;
}

// ── Formatter un nombre ───────────────────────────────────────────────────────
function fmt(n, dec = 4) { return parseFloat(n.toFixed(dec)).toLocaleString('fr-FR'); }
function fmtP(n)         { return Math.round(n).toLocaleString('fr-FR'); }

// ── Embed principal ALM ───────────────────────────────────────────────────────
function buildAlmEmbed(guildId, userId, cfg) {
  const alm    = getAlmPrice();
  const sym    = cfg.currency_emoji || '€';
  const wallet = getAlmBalance(userId, guildId);
  const stats  = getAlmServerStats(guildId);

  const delta   = alm.prev_price > 0 ? ((alm.price - alm.prev_price) / alm.prev_price) * 100 : 0;
  const arrow   = delta > 1 ? '🟢📈' : delta < -1 ? '🔴📉' : '⚪ stable';
  const pnlAmt  = wallet.amount > 0 ? (alm.price - wallet.avg_buy) * wallet.amount : 0;
  const pnlPct  = wallet.avg_buy > 0 ? ((alm.price - wallet.avg_buy) / wallet.avg_buy) * 100 : 0;

  const circulating = db.db.prepare(
    'SELECT SUM(amount) as total FROM crypto_wallet WHERE crypto = ?'
  ).get(SYMBOL)?.total || 0;

  return new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle(`${EMOJI} Almosni (ALM) — Crypto Officielle du Serveur`)
    .setDescription(
      `> *La crypto native de ce serveur — minée, tradée et brûlée par la communauté.*`
    )
    .addFields(
      {
        name: '📊 Prix actuel',
        value: `**${fmt(alm.price, 2)}${sym}** ${arrow}\n` +
               `Variation : **${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%**`,
        inline: true,
      },
      {
        name: '💼 Mon portefeuille',
        value: wallet.amount > 0
          ? `**${fmt(wallet.amount)} ALM**\n≈ ${fmtP(wallet.amount * alm.price)}${sym}\nPnL : ${pnlAmt >= 0 ? '+' : ''}${fmtP(pnlAmt)}${sym} (${pnlPct.toFixed(2)}%)`
          : '*Aucun ALM détenu.*',
        inline: true,
      },
      {
        name: '🌐 Données réseau',
        value: `En circulation : **${fmt(circulating, 0)} / ${(TOTAL_SUPPLY).toLocaleString('fr-FR')} ALM**\n` +
               `Total brûlé : **${fmt(stats.total_burned, 2)} ALM** 🔥\n` +
               `Total miné : **${fmt(stats.total_mined, 2)} ALM** ⛏️`,
        inline: false,
      },
    )
    .setFooter({ text: '🔮 ALM — Almosni · /almosni miner · /almosni acheter · /almosni vendre' })
    .setTimestamp();
}

function buildButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`alm_info:${userId}`).setLabel('📊 Infos').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`alm_mine:${userId}`).setLabel('⛏️ Miner').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`alm_stats:${userId}`).setLabel('🏆 Stats serveur').setStyle(ButtonStyle.Secondary),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('almosni')
    .setDescription(`${EMOJI} Crypto Almosni (ALM) — la crypto officielle du serveur`)
    .addSubcommand(s => s.setName('balance').setDescription('Voir ton solde ALM et le prix actuel'))
    .addSubcommand(s => s
      .setName('acheter')
      .setDescription('Acheter des ALM avec tes euros')
      .addStringOption(o => o.setName('montant').setDescription('Montant en € (ex: 500, all, 25%)').setRequired(true).setMaxLength(20)))
    .addSubcommand(s => s
      .setName('vendre')
      .setDescription('Vendre tes ALM contre des euros')
      .addStringOption(o => o.setName('quantite').setDescription('Quantité ALM (ex: 10, all, 50%)').setRequired(true).setMaxLength(20)))
    .addSubcommand(s => s
      .setName('give')
      .setDescription('Donner des ALM à un autre membre')
      .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
      .addNumberOption(o => o.setName('quantite').setDescription('Quantité ALM à donner').setRequired(true).setMinValue(0.0001)))
    .addSubcommand(s => s
      .setName('burn')
      .setDescription('Brûler définitivement des ALM (réduit l\'offre en circulation)')
      .addNumberOption(o => o.setName('quantite').setDescription('Quantité ALM à brûler').setRequired(true).setMinValue(0.0001)))
    .addSubcommand(s => s.setName('miner').setDescription('Miner des ALM (1x/heure)'))
    .addSubcommand(s => s.setName('stats').setDescription('Statistiques ALM du serveur'))
    .addSubcommand(s => s
      .setName('admin-give')
      .setDescription('[ADMIN] Donner des ALM à n\'importe quel membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addNumberOption(o => o.setName('quantite').setDescription('Quantité ALM').setRequired(true).setMinValue(0.0001))
      .setDefaultMemberPermissions(8)), // Administrator
  cooldown: 3,

  async execute(interaction) {
    await interaction.deferReply();

    const sub     = interaction.options.getSubcommand();
    const cfg     = db.getConfig(interaction.guildId);
    const sym     = cfg.currency_emoji || '€';
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    ensureAlmTable();
    const alm = getAlmPrice();

    // ── BALANCE ───────────────────────────────────────────
    if (sub === 'balance') {
      const embed = buildAlmEmbed(guildId, userId, cfg);
      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    // ── ACHETER ───────────────────────────────────────────
    if (sub === 'acheter') {
      const user     = db.getUser(userId, guildId);
      const rawInput = interaction.options.getString('montant');
      let euros      = parseAmount(rawInput, user.balance);
      if (!euros || euros < 1) return interaction.editReply({ content: '❌ Montant invalide ou insuffisant.', ephemeral: true });
      if (user.balance < euros) return interaction.editReply({ content: `❌ Solde insuffisant — tu as ${fmtP(user.balance)}${sym}.`, ephemeral: true });

      const qty = euros / alm.price;

      // Débiter l'acheteur
      db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(euros, userId, guildId);

      // Mettre à jour le wallet ALM
      const existing = getAlmBalance(userId, guildId);
      const newTotal  = existing.amount + qty;
      const newAvgBuy = newTotal > 0 ? (existing.amount * existing.avg_buy + qty * alm.price) / newTotal : alm.price;
      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?,
          avg_buy = ?,
          updated_at = strftime('%s','now')
      `).run(userId, guildId, SYMBOL, qty, newAvgBuy, qty, newAvgBuy);

      // Stats serveur
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_traded = total_traded + ? WHERE guild_id = ?').run(qty, guildId);

      // Fluctuation légère à la hausse (achat = pression haussière)
      const newPrice = fluctuateAlm(0.4);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`🟢 Achat ALM réussi`)
        .setDescription(
          `Tu as acheté **${fmt(qty)} ALM** pour **${fmtP(euros)}${sym}**\n` +
          `Prix d'achat : **${fmt(alm.price, 2)}${sym}/ALM**\n` +
          `Nouveau prix : **${fmt(newPrice, 2)}${sym}** *(légère hausse)*`
        )
        .addFields(
          { name: '💼 ALM total', value: `**${fmt(newTotal)} ALM**`, inline: true },
          { name: `${sym} Solde restant`, value: `**${fmtP(user.balance - euros)}${sym}**`, inline: true },
        )
        .setFooter({ text: '🔮 ALM — Almosni' }).setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    // ── VENDRE ────────────────────────────────────────────
    if (sub === 'vendre') {
      const wallet  = getAlmBalance(userId, guildId);
      if (wallet.amount <= 0) return interaction.editReply({ content: '❌ Tu ne possèdes aucun ALM.', ephemeral: true });

      const rawInput = interaction.options.getString('quantite');
      const qty = parseQty(rawInput, wallet.amount);
      if (!qty || qty <= 0) return interaction.editReply({ content: '❌ Quantité invalide.', ephemeral: true });
      if (qty > wallet.amount) return interaction.editReply({ content: `❌ Tu n'as que ${fmt(wallet.amount)} ALM.`, ephemeral: true });

      const euros   = qty * alm.price;
      const pnl     = (alm.price - wallet.avg_buy) * qty;

      // Retirer du wallet
      const newAmount = wallet.amount - qty;
      if (newAmount < 0.000001) {
        db.db.prepare('DELETE FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').run(userId, guildId, SYMBOL);
      } else {
        db.db.prepare('UPDATE crypto_wallet SET amount = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ? AND guild_id = ? AND crypto = ?')
          .run(newAmount, userId, guildId, SYMBOL);
      }

      // Créditer en €
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(Math.floor(euros), userId, guildId);

      // Stats
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_traded = total_traded + ? WHERE guild_id = ?').run(qty, guildId);

      // Fluctuation légère à la baisse (vente = pression baissière)
      const newPrice = fluctuateAlm(-0.3);

      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`🔴 Vente ALM réussie`)
        .setDescription(
          `Tu as vendu **${fmt(qty)} ALM** pour **${fmtP(Math.floor(euros))}${sym}**\n` +
          `PnL : **${pnl >= 0 ? '+' : ''}${fmtP(pnl)}${sym}** (${((alm.price - wallet.avg_buy) / wallet.avg_buy * 100).toFixed(2)}%)`
        )
        .addFields(
          { name: '💼 ALM restant', value: `**${fmt(newAmount)} ALM**`, inline: true },
          { name: `${sym} Reçu`, value: `**+${fmtP(Math.floor(euros))}${sym}**`, inline: true },
        )
        .setFooter({ text: '🔮 ALM — Almosni' }).setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    // ── GIVE ──────────────────────────────────────────────
    if (sub === 'give') {
      const target = interaction.options.getUser('membre');
      const qty    = interaction.options.getNumber('quantite');
      if (target.id === userId) return interaction.editReply({ content: '❌ Tu ne peux pas te donner à toi-même.', ephemeral: true });
      if (target.bot) return interaction.editReply({ content: '❌ Impossible de transférer à un bot.', ephemeral: true });

      const wallet = getAlmBalance(userId, guildId);
      if (wallet.amount < qty) return interaction.editReply({ content: `❌ Solde ALM insuffisant. Tu as **${fmt(wallet.amount)} ALM**.`, ephemeral: true });

      // Débiter l'envoyeur
      const newSenderAmt = wallet.amount - qty;
      if (newSenderAmt < 0.000001) {
        db.db.prepare('DELETE FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').run(userId, guildId, SYMBOL);
      } else {
        db.db.prepare('UPDATE crypto_wallet SET amount = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ? AND guild_id = ? AND crypto = ?')
          .run(newSenderAmt, userId, guildId, SYMBOL);
      }

      // Créditer le destinataire
      const targetWallet = getAlmBalance(target.id, guildId);
      const newTargetTotal = targetWallet.amount + qty;
      const newTargetAvg   = newTargetTotal > 0
        ? (targetWallet.amount * targetWallet.avg_buy + qty * alm.price) / newTargetTotal
        : alm.price;
      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?, avg_buy = ?, updated_at = strftime('%s','now')
      `).run(target.id, guildId, SYMBOL, qty, newTargetAvg, qty, newTargetAvg);

      const valeur = qty * alm.price;
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${EMOJI} Transfert ALM réussi`)
        .setDescription(
          `Tu as envoyé **${fmt(qty)} ALM** à ${target} !\n` +
          `Valeur : ≈ **${fmtP(valeur)}${sym}** au prix actuel.`
        )
        .addFields(
          { name: '📤 Envoyé', value: `**-${fmt(qty)} ALM**`, inline: true },
          { name: '💼 Restant', value: `**${fmt(newSenderAmt)} ALM**`, inline: true },
        )
        .setFooter({ text: '🔮 ALM — Almosni' }).setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── BURN ──────────────────────────────────────────────
    if (sub === 'burn') {
      const qty    = interaction.options.getNumber('quantite');
      const wallet = getAlmBalance(userId, guildId);
      if (wallet.amount < qty) return interaction.editReply({ content: `❌ Tu n'as que **${fmt(wallet.amount)} ALM**.`, ephemeral: true });

      const newAmt = wallet.amount - qty;
      if (newAmt < 0.000001) {
        db.db.prepare('DELETE FROM crypto_wallet WHERE user_id = ? AND guild_id = ? AND crypto = ?').run(userId, guildId, SYMBOL);
      } else {
        db.db.prepare('UPDATE crypto_wallet SET amount = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ? AND guild_id = ? AND crypto = ?')
          .run(newAmt, userId, guildId, SYMBOL);
      }

      // Stats burn
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_burned = total_burned + ? WHERE guild_id = ?').run(qty, guildId);

      // Le burn crée une pression haussière (offre réduite)
      const newPrice = fluctuateAlm(0.8);

      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('🔥 ALM Brûlés !')
        .setDescription(
          `**${fmt(qty)} ALM** ont été détruits définitivement.\n` +
          `L'offre en circulation diminue — le prix monte ! 📈\n` +
          `Nouveau prix : **${fmt(newPrice, 2)}${sym}**`
        )
        .addFields(
          { name: '🔥 Brûlés', value: `**${fmt(qty)} ALM**`, inline: true },
          { name: '💼 Restant', value: `**${fmt(newAmt)} ALM**`, inline: true },
        )
        .setFooter({ text: '🔮 Burn = moins d\'offre = valeur plus haute' }).setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ── MINER ─────────────────────────────────────────────
    if (sub === 'miner') {
      ensureAlmTable();
      const now     = Math.floor(Date.now() / 1000);
      let mineRow   = db.db.prepare('SELECT * FROM alm_mine WHERE user_id = ? AND guild_id = ?').get(userId, guildId);

      if (!mineRow) {
        db.db.prepare('INSERT OR IGNORE INTO alm_mine (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
        mineRow = { last_mine: 0, total_mined: 0 };
      }

      const elapsed   = now - (mineRow.last_mine || 0);
      const remaining = MINE_COOLDOWN - elapsed;

      if (remaining > 0) {
        const mins  = Math.floor(remaining / 60);
        const secs  = remaining % 60;
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('⛏️ Cooldown de minage')
            .setDescription(`Tu as déjà miné récemment !\n\nProchain minage dans : **${mins}m ${secs}s**`)
            .setFooter({ text: '⛏️ Reviens dans 1 heure !' })
          ],
        });
      }

      // Récompense de minage (aléatoire entre min et max)
      const reward = MINE_REWARD_MIN + Math.random() * (MINE_REWARD_MAX - MINE_REWARD_MIN);
      const rounded = parseFloat(reward.toFixed(4));

      // Ajouter au wallet
      const existing = getAlmBalance(userId, guildId);
      const newTotal  = existing.amount + rounded;
      const newAvgBuy = newTotal > 0 ? (existing.amount * existing.avg_buy + rounded * alm.price) / newTotal : alm.price;
      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?, avg_buy = ?, updated_at = strftime('%s','now')
      `).run(userId, guildId, SYMBOL, rounded, newAvgBuy, rounded, newAvgBuy);

      // Update stats minage
      db.db.prepare('UPDATE alm_mine SET last_mine = ?, total_mined = total_mined + ? WHERE user_id = ? AND guild_id = ?')
        .run(now, rounded, userId, guildId);
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_mined = total_mined + ? WHERE guild_id = ?').run(rounded, guildId);

      const valeur = rounded * alm.price;
      const anim   = ['⛏️', '🪨', '💎', '✨', '🔮'][Math.floor(Math.random() * 5)];

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`${anim} Minage réussi !`)
        .setDescription(
          `Tu as miné **${fmt(rounded)} ALM** !\n` +
          `Valeur : ≈ **${fmtP(valeur)}${sym}** au prix actuel.`
        )
        .addFields(
          { name: '⛏️ Miné',       value: `**+${fmt(rounded)} ALM**`, inline: true },
          { name: '💼 Total ALM',  value: `**${fmt(newTotal)} ALM**`, inline: true },
          { name: '🏆 Total miné (à vie)', value: `**${fmt((mineRow.total_mined || 0) + rounded)} ALM**`, inline: false },
        )
        .setFooter({ text: '⛏️ Prochain minage dans 1 heure' }).setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    // ── STATS ─────────────────────────────────────────────
    if (sub === 'stats') {
      const stats   = getAlmServerStats(guildId);
      const almData = getAlmPrice();

      const circulating = db.db.prepare(
        'SELECT SUM(amount) as total FROM crypto_wallet WHERE crypto = ?'
      ).get(SYMBOL)?.total || 0;

      const holders = db.db.prepare(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM crypto_wallet WHERE crypto = ? AND amount > 0'
      ).get(SYMBOL)?.cnt || 0;

      // Top 5 holders
      const top5 = db.db.prepare(
        'SELECT user_id, amount FROM crypto_wallet WHERE guild_id = ? AND crypto = ? AND amount > 0 ORDER BY amount DESC LIMIT 5'
      ).all(guildId, SYMBOL);

      const topLines = top5.map((r, i) => {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        return `${medals[i]} <@${r.user_id}> — **${fmt(r.amount)} ALM** (≈${fmtP(r.amount * almData.price)}${sym})`;
      }).join('\n') || '*Aucun holder pour l\'instant.*';

      const delta   = almData.prev_price > 0 ? ((almData.price - almData.prev_price) / almData.prev_price) * 100 : 0;
      const mktCap  = circulating * almData.price;

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${EMOJI} Almosni (ALM) — Statistiques du serveur`)
        .addFields(
          {
            name: '📊 Marché',
            value: `Prix : **${fmt(almData.price, 2)}${sym}** (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)\n` +
                   `Market cap : **${fmtP(mktCap)}${sym}**\n` +
                   `En circulation : **${fmt(circulating, 2)} ALM**\n` +
                   `Offre max : **${TOTAL_SUPPLY.toLocaleString('fr-FR')} ALM**`,
            inline: false,
          },
          {
            name: '🌐 Écosystème',
            value: `Holders : **${holders}** membres\n` +
                   `Total miné : **${fmt(stats.total_mined, 2)} ALM** ⛏️\n` +
                   `Total brûlé : **${fmt(stats.total_burned, 2)} ALM** 🔥\n` +
                   `Total échangé : **${fmt(stats.total_traded, 2)} ALM** 🔄`,
            inline: false,
          },
          { name: '🏆 Top 5 Holders', value: topLines, inline: false },
        )
        .setFooter({ text: '🔮 ALM — /almosni pour trader' }).setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    // ── ADMIN-GIVE ────────────────────────────────────────
    if (sub === 'admin-give') {
      const target = interaction.options.getUser('membre');
      const qty    = interaction.options.getNumber('quantite');

      const targetWallet = getAlmBalance(target.id, guildId);
      const newTotal     = targetWallet.amount + qty;
      const newAvgBuy    = newTotal > 0
        ? (targetWallet.amount * targetWallet.avg_buy + qty * alm.price) / newTotal
        : alm.price;

      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?, avg_buy = ?, updated_at = strftime('%s','now')
      `).run(target.id, guildId, SYMBOL, qty, newAvgBuy, qty, newAvgBuy);

      // Stats
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_mined = total_mined + ? WHERE guild_id = ?').run(qty, guildId);

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${EMOJI} [ADMIN] ALM distribués`)
        .setDescription(`**${fmt(qty)} ALM** ont été donnés à ${target}.\nNouveau solde : **${fmt(newTotal)} ALM**`)
        .setFooter({ text: '🔮 ALM — Administration' }).setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },

  // ── Gestion des boutons ────────────────────────────────
  async handleComponent(interaction) {
    const [action, targetId] = interaction.customId.split(':');
    if (interaction.user.id !== targetId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }

    const cfg     = db.getConfig(interaction.guildId);
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    ensureAlmTable();
    const alm = getAlmPrice();

    if (action === 'alm_info') {
      await interaction.deferUpdate();
      const embed = buildAlmEmbed(guildId, userId, cfg);
      return interaction.editReply({ embeds: [embed], components: [buildButtons(userId)] });
    }

    if (action === 'alm_mine') {
      await interaction.deferUpdate();
      const now     = Math.floor(Date.now() / 1000);
      let mineRow   = db.db.prepare('SELECT * FROM alm_mine WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
      if (!mineRow) {
        db.db.prepare('INSERT OR IGNORE INTO alm_mine (user_id, guild_id) VALUES (?, ?)').run(userId, guildId);
        mineRow = { last_mine: 0, total_mined: 0 };
      }

      const elapsed   = now - (mineRow.last_mine || 0);
      const remaining = MINE_COOLDOWN - elapsed;
      const sym       = cfg.currency_emoji || '€';

      if (remaining > 0) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C')
            .setTitle('⛏️ Cooldown de minage')
            .setDescription(`Prochain minage dans : **${mins}m ${secs}s**`)],
          components: [buildButtons(userId)],
        });
      }

      const reward  = MINE_REWARD_MIN + Math.random() * (MINE_REWARD_MAX - MINE_REWARD_MIN);
      const rounded = parseFloat(reward.toFixed(4));
      const existing = getAlmBalance(userId, guildId);
      const newTotal  = existing.amount + rounded;
      const newAvgBuy = newTotal > 0 ? (existing.amount * existing.avg_buy + rounded * alm.price) / newTotal : alm.price;

      db.db.prepare(`
        INSERT INTO crypto_wallet (user_id, guild_id, crypto, amount, avg_buy, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s','now'))
        ON CONFLICT(user_id, guild_id, crypto) DO UPDATE SET
          amount = amount + ?, avg_buy = ?, updated_at = strftime('%s','now')
      `).run(userId, guildId, SYMBOL, rounded, newAvgBuy, rounded, newAvgBuy);

      db.db.prepare('UPDATE alm_mine SET last_mine = ?, total_mined = total_mined + ? WHERE user_id = ? AND guild_id = ?')
        .run(now, rounded, userId, guildId);
      db.db.prepare('INSERT OR IGNORE INTO alm_stats (guild_id) VALUES (?)').run(guildId);
      db.db.prepare('UPDATE alm_stats SET total_mined = total_mined + ? WHERE guild_id = ?').run(rounded, guildId);

      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#F1C40F')
          .setTitle('⛏️ Minage réussi !')
          .setDescription(`Tu as miné **${fmt(rounded)} ALM** (≈${fmtP(rounded * alm.price)}${sym}) !\nNouveau total : **${fmt(newTotal)} ALM**`)
          .setFooter({ text: '⛏️ Prochain minage dans 1 heure' })
          .setTimestamp()],
        components: [buildButtons(userId)],
      });
    }

    if (action === 'alm_stats') {
      await interaction.deferUpdate();
      const stats = getAlmServerStats(guildId);
      const sym   = cfg.currency_emoji || '€';

      const circulating = db.db.prepare(
        'SELECT SUM(amount) as total FROM crypto_wallet WHERE crypto = ?'
      ).get(SYMBOL)?.total || 0;
      const holders = db.db.prepare(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM crypto_wallet WHERE crypto = ? AND amount > 0'
      ).get(SYMBOL)?.cnt || 0;
      const delta = alm.prev_price > 0 ? ((alm.price - alm.prev_price) / alm.prev_price) * 100 : 0;

      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#9B59B6')
          .setTitle(`${EMOJI} Almosni — Stats rapides`)
          .addFields(
            { name: '💰 Prix', value: `**${fmt(alm.price, 2)}${sym}** (${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%)`, inline: true },
            { name: '👥 Holders', value: `**${holders}** membres`, inline: true },
            { name: '🌐 Circulation', value: `**${fmt(circulating, 2)} ALM**`, inline: true },
            { name: '🔥 Brûlés', value: `**${fmt(stats.total_burned, 2)} ALM**`, inline: true },
            { name: '⛏️ Minés', value: `**${fmt(stats.total_mined, 2)} ALM**`, inline: true },
          )
          .setTimestamp()],
        components: [buildButtons(userId)],
      });
    }
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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
