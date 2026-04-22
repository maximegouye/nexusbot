const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../../database/db');

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
        embed.addFields({ name: `${arrow} ${sym} — ${info.nom}`, value: `Prix: **${info.prix.toLocaleString()} 🪙** | Variation: **${sign}${info.variation}%**`, inline: false });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'acheter') {
      const sym = interaction.options.getString('action').toUpperCase();
      const qty = parseInt(interaction.options.getString('quantite'));
      if (!marche[sym]) return interaction.editReply({ content: `❌ Action **${sym}** introuvable.`, ephemeral: true });
      if (isNaN(qty) || qty <= 0) return interaction.editReply({ content: '❌ Quantité invalide.', ephemeral: true });
      const total = marche[sym].prix * qty;
      const row = await db.get('SELECT coins FROM economy WHERE userId = ? AND guildId = ?', [userId, guildId]);
      if (!row || row.coins < total) return interaction.editReply({ content: `❌ Fonds insuffisants. Besoin: **${total.toLocaleString()} 🪙**, Solde: **${(row?.coins || 0).toLocaleString()} 🪙**.`, ephemeral: true });
      await db.run('UPDATE economy SET coins = coins - ? WHERE userId = ? AND guildId = ?', [total, userId, guildId]);
      const existing = await db.get('SELECT quantite FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?', [userId, guildId, sym]);
      if (existing) {
        await db.run('UPDATE portfolio SET quantite = quantite + ? WHERE userId = ? AND guildId = ? AND symbole = ?', [qty, userId, guildId, sym]);
      } else {
        await db.run('INSERT INTO portfolio (userId, guildId, symbole, quantite, prixAchat) VALUES (?, ?, ?, ?, ?)', [userId, guildId, sym, qty, marche[sym].prix]);
      }
      const embed = new EmbedBuilder().setTitle('✅ Achat confirmé').setColor(0x00c853)
        .addFields({ name: 'Action', value: `**${sym}**`, inline: true }, { name: 'Quantité', value: `${qty}`, inline: true }, { name: 'Total', value: `${total.toLocaleString()} 🪙`, inline: true }).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'vendre') {
      const sym = interaction.options.getString('action').toUpperCase();
      const qty = parseInt(interaction.options.getString('quantite'));
      if (!marche[sym]) return interaction.editReply({ content: `❌ Action **${sym}** introuvable.`, ephemeral: true });
      if (isNaN(qty) || qty <= 0) return interaction.editReply({ content: '❌ Quantité invalide.', ephemeral: true });
      const existing = await db.get('SELECT quantite FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?', [userId, guildId, sym]);
      if (!existing || existing.quantite < qty) return interaction.editReply({ content: `❌ Pas assez d'actions **${sym}**.`, ephemeral: true });
      const total = marche[sym].prix * qty;
      await db.run('UPDATE economy SET coins = coins + ? WHERE userId = ? AND guildId = ?', [total, userId, guildId]);
      if (existing.quantite === qty) {
        await db.run('DELETE FROM portfolio WHERE userId = ? AND guildId = ? AND symbole = ?', [userId, guildId, sym]);
      } else {
        await db.run('UPDATE portfolio SET quantite = quantite - ? WHERE userId = ? AND guildId = ? AND symbole = ?', [qty, userId, guildId, sym]);
      }
      const embed = new EmbedBuilder().setTitle('✅ Vente confirmée').setColor(0xff6d00)
        .addFields({ name: 'Action', value: `**${sym}**`, inline: true }, { name: 'Quantité', value: `${qty}`, inline: true }, { name: 'Reçu', value: `${total.toLocaleString()} 🪙`, inline: true }).setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'portefeuille') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const rows = await db.all('SELECT * FROM portfolio WHERE userId = ? AND guildId = ?', [target.id, guildId]);
      if (!rows || rows.length === 0) return interaction.editReply({ content: `📭 **${target.username}** n'a aucune action.`, ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`💼 Portefeuille de ${target.username}`).setColor(0x6200ea).setTimestamp();
      let total = 0;
      for (const r of rows) {
        const info = marche[r.symbole];
        if (!info) continue;
        const val = info.prix * r.quantite;
        total += val;
        embed.addFields({ name: `${r.symbole} — ${info.nom}`, value: `x${r.quantite} → **${val.toLocaleString()} 🪙**`, inline: false });
      }
      embed.setFooter({ text: `Valeur totale: ${total.toLocaleString()} 🪙` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'classement') {
      const rows = await db.all('SELECT userId, SUM(quantite * 150) as valeur FROM portfolio WHERE guildId = ? GROUP BY userId ORDER BY valeur DESC LIMIT 10', [guildId]);
      if (!rows || rows.length === 0) return interaction.editReply({ content: '📭 Aucun investisseur pour le moment.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('🏆 Top Investisseurs').setColor(0xffd700).setTimestamp();
      let desc = '';
      for (let i = 0; i < rows.length; i++) {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        desc += `${medal} <@${rows[i].userId}> — **${rows[i].valeur.toLocaleString()} 🪙**\n`;
      }
      embed.setDescription(desc);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
