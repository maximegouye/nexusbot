const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Création table portfolio si inexistante
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS portfolio (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    userId    TEXT NOT NULL,
    guildId   TEXT NOT NULL,
    symbole   TEXT NOT NULL,
    quantite  INTEGER DEFAULT 0,
    prixAchat INTEGER DEFAULT 0,
    UNIQUE(userId, guildId, symbole)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bourse')
    .setDescription('📈 Bourse virtuelle — Achetez et vendez des actions !')
    .addSubcommand(s => s
      .setName('marche')
      .setDescription('📊 Voir le marché boursier actuel'))
    .addSubcommand(s => s
      .setName('acheter')
      .setDescription('💰 Acheter des actions')
      .addStringOption(o => o
        .setName('action')
        .setDescription("Symbole de l'action (ex: NXS)")
        .setRequired(true))
      .addStringOption(o => o
        .setName('quantite')
        .setDescription("Nombre d'actions à acheter")
        .setRequired(true)))
    .addSubcommand(s => s
      .setName('vendre')
      .setDescription('💸 Vendre des actions')
      .addStringOption(o => o
        .setName('action')
        .setDescription("Symbole de l'action (ex: NXS)")
        .setRequired(true))
      .addStringOption(o => o
        .setName('quantite')
        .setDescription("Nombre d'actions à vendre")
        .setRequired(true)))
    .addSubcommand(s => s
      .setName('portefeuille')
      .setDescription("💼 Voir votre portefeuille d'actions")
      .addUserOption(o => o
        .setName('membre')
        .setDescription("Voir le portefeuille d'un membre")))
    .addSubcommand(s => s
      .setName('classement')
      .setDescription('🏆 Top des investisseurs')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const cfg = db.getConfig(guildId) || {};
    const coin = cfg.currency_emoji || '€';

    const marche = {
      NXS: { nom: 'NexusCoin', prix: 150, variation: +2.5 },
      BTC: { nom: 'BitCoin', prix: 45000, variation: -1.2 },
      ETH: { nom: 'Ethereum', prix: 3200, variation: +0.8 },
      DOGE: { nom: 'Dogecoin', prix: 12, variation: +5.0 },
      SOL: { nom: 'Solana', prix: 180, variation: -3.1 },
    };

    if (sub === 'marche') {
      const embed = new EmbedBuilder()
        .setTitle('📈 Marché Boursier NexusBot')
        .setColor(0x00b4d8)
        .setDescription('Cours en temps réel (fictif)')
        .setTimestamp();
      for (const [sym, info] of Object.entries(marche)) {
        const arrow = info.variation >= 0 ? '📈' : '📉';
        const sign = info.variation >= 0 ? '+' : '';
        embed.addFields({ name: `${arrow} ${sym} — ${info.nom}`, value: `Prix: **${info.prix.toLocaleString()} ${coin}** | Variation: **${sign}${info.variation}%**`, inline: false });
      }
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'acheter') {
      const sym = interaction.options.getString('action').toUpperCase();
      const qty = parseInt(interaction.options.getString('quantite'));
      if (!marche[sym]) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Action **${sym}** introuvable.`, ephemeral: true });
      if (isNaN(qty) || qty <= 0) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Quantité invalide.', ephemeral: true });
      const total = marche[sym].prix * qty;
      const ecoRow = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
      const balance = ecoRow?.balance || 0;
      if (balance < total) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Fonds insuffisants. Besoin: **${total.toLocaleString()} ${coin}**, Solde: **${balance.toLocaleString()} ${coin}**.`, ephemeral: true });
      db.removeCoins(userId, guildId, total);
      const existing = db.db.prepare('SELECT quantite FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?').get(userId, guildId, sym);
      if (existing) {
        db.db.prepare('UPDATE portfolio SET quantite = quantite + ? WHERE userId = ? AND guildId = ? AND symbole = ?').run(qty, userId, guildId, sym);
      } else {
        db.db.prepare('INSERT INTO portfolio (userId, guildId, symbole, quantite, prixAchat) VALUES (?, ?, ?, ?, ?)').run(userId, guildId, sym, qty, marche[sym].prix);
      }
      const embed = new EmbedBuilder().setTitle('✅ Achat confirmé').setColor(0x00c853)
        .addFields({ name: 'Action', value: `**${sym}**`, inline: true }, { name: 'Quantité', value: `${qty}`, inline: true }, { name: 'Total', value: `${total.toLocaleString()} ${coin}`, inline: true }).setTimestamp();
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'vendre') {
      const sym = interaction.options.getString('action').toUpperCase();
      const qty = parseInt(interaction.options.getString('quantite'));
      if (!marche[sym]) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Action **${sym}** introuvable.`, ephemeral: true });
      if (isNaN(qty) || qty <= 0) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Quantité invalide.', ephemeral: true });
      const existing = db.db.prepare('SELECT quantite FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?').get(userId, guildId, sym);
      if (!existing || existing.quantite < qty) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pas assez d'actions **${sym}**.`, ephemeral: true });
      const total = marche[sym].prix * qty;
      db.addCoins(userId, guildId, total);
      if (existing.quantite === qty) {
        db.db.prepare('DELETE FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?').run(userId, guildId, sym);
      } else {
        db.db.prepare('UPDATE portfolio SET quantite = quantite - ? WHERE userId = ? AND guildId = ? AND symbole = ?').run(qty, userId, guildId, sym);
      }
      const embed = new EmbedBuilder().setTitle('✅ Vente confirmée').setColor(0xff6d00)
        .addFields({ name: 'Action', value: `**${sym}**`, inline: true }, { name: 'Quantité', value: `${qty}`, inline: true }, { name: 'Reçu', value: `${total.toLocaleString()} ${coin}`, inline: true }).setTimestamp();
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'portefeuille') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const rows = db.db.prepare('SELECT * FROM portfolio WHERE userId = ? AND guildId = ?').all(target.id, guildId);
      if (!rows || rows.length === 0) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `📭 **${target.username}** n'a aucune action.`, ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`💼 Portefeuille de ${target.username}`).setColor(0x6200ea).setTimestamp();
      let total = 0;
      for (const r of rows) {
        const info = marche[r.symbole];
        if (!info) continue;
        const val = info.prix * r.quantite;
        total += val;
        embed.addFields({ name: `${r.symbole} — ${info.nom}`, value: `x${r.quantite} → **${val.toLocaleString()} ${coin}**`, inline: false });
      }
      embed.setFooter({ text: `Valeur totale: ${total.toLocaleString()} ${coin}` });
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'classement') {
      const rows = db.db.prepare('SELECT userId, SUM(quantite * 150) as valeur FROM portfolio WHERE guildId = ? GROUP BY userId ORDER BY valeur DESC LIMIT 10').all(guildId);
      if (!rows || rows.length === 0) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📭 Aucun investisseur pour le moment.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('🏆 Top Investisseurs').setColor(0xffd700).setTimestamp();
      let desc = '';
      for (let i = 0; i < rows.length; i++) {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        desc += `${medal} <@${rows[i].userId}> — **${rows[i].valeur.toLocaleString()} ${coin}**\n`;
      }
      embed.setDescription(desc);
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }
  },
};
