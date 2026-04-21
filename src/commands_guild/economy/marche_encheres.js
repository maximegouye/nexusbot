/**
 * NexusBot — Marché aux Enchères Amélioré
 * /encheres2 — Version avancée avec enchères en temps réel et historique
 */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS encheres_v2 (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    seller_id    TEXT NOT NULL,
    item_name    TEXT NOT NULL,
    description  TEXT,
    start_price  INTEGER NOT NULL,
    current_bid  INTEGER NOT NULL,
    bidder_id    TEXT,
    buyout_price INTEGER,
    ends_at      INTEGER NOT NULL,
    channel_id   TEXT,
    msg_id       TEXT,
    status       TEXT DEFAULT 'active',
    created_at   INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS encheres_v2_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    enchere_id INTEGER NOT NULL,
    bidder_id  TEXT NOT NULL,
    amount     INTEGER NOT NULL,
    bid_at     INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vente')
    .setDescription('🔨 Marché aux enchères temps réel v2')
    .addSubcommand(s => s.setName('vendre')
      .setDescription('📦 Mettre un objet aux enchères')
      .addStringOption(o => o.setName('objet').setDescription('Nom de l\'objet').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('description').setDescription('Description de l\'objet').setMaxLength(300))
    .addSubcommand(s => s.setName('miser')
      .setDescription('💰 Faire une enchère')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true))
    .addSubcommand(s => s.setName('voir')
      .setDescription('👁️ Voir une enchère')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les enchères actives'))
    .addSubcommand(s => s.setName('mes_encheres').setDescription('👤 Voir mes enchères (ventes et enchères)')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const now     = Math.floor(Date.now() / 1000);

    if (sub === 'vendre') {
      const item     = interaction.options.getString('objet');
      const start    = interaction.options.getInteger('prix_depart');
      const duree    = interaction.options.getInteger('duree');
      const desc     = interaction.options.getString('description');
      const buyout   = interaction.options.getInteger('achat_immediat');
      const endsAt   = now + duree * 60;

      if (buyout && buyout <= start) return interaction.editReply({ content: '❌ Le prix d\'achat immédiat doit être supérieur au prix de départ.' });

      const result = db.db.prepare('INSERT INTO encheres_v2 (guild_id, seller_id, item_name, description, start_price, current_bid, buyout_price, ends_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(guildId, userId, item, desc || null, start, start, buyout || null, endsAt);
      const id = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🔨 Enchère #${id} — ${item}`)
        .setDescription(desc || 'Pas de description')
        .addFields(
          { name: '💰 Prix de départ',    value: `${start} 🪙`,                                     inline: true },
          { name: '⏱️ Fin',              value: `<t:${endsAt}:R>`,                                  inline: true },
          { name: '👤 Vendeur',           value: `<@${userId}>`,                                     inline: true },
          { name: '⚡ Achat immédiat',    value: buyout ? `${buyout} 🪙` : 'Non disponible',        inline: true },
        )
        .setFooter({ text: `Misez avec /enchere miser ${id}` });

      // Poster dans le salon de log si configuré
      const cfg = db.getConfig(guildId);
      if (cfg.log_channel) {
        const ch = interaction.guild.channels.cache.get(cfg.log_channel);
        if (ch) {
          const msg = await ch.send({ embeds: [embed] }).catch(() => null);
          if (msg) db.db.prepare('UPDATE encheres_v2 SET channel_id=?, msg_id=? WHERE id=?').run(ch.id, msg.id, id);
        }
      }

      // Auto-terminer après la durée
      setTimeout(async () => {
        const enc = db.db.prepare("SELECT * FROM encheres_v2 WHERE id=? AND status='active'").get(id);
        if (!enc) return;
        db.db.prepare("UPDATE encheres_v2 SET status='ended' WHERE id=?").run(id);

        if (enc.bidder_id) {
          db.addCoins(enc.seller_id, guildId, enc.current_bid);
          const buyer = await interaction.client.users.fetch(enc.bidder_id).catch(() => null);
          if (buyer) buyer.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('🎉 Enchère Remportée !').setDescription(`Vous avez remporté **${enc.item_name}** pour **${enc.current_bid} coins** sur ${interaction.guild.name} !`)] }).catch(() => {});
          const seller = await interaction.client.users.fetch(enc.seller_id).catch(() => null);
          if (seller) seller.send({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`💰 Votre enchère **${enc.item_name}** a été vendue pour **${enc.current_bid} coins** !`)] }).catch(() => {});
        } else {
          const seller = await interaction.client.users.fetch(enc.seller_id).catch(() => null);
          if (seller) seller.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`😢 Votre enchère **${enc.item_name}** s'est terminée sans enchère.`)] }).catch(() => {});
        }
      }, duree * 60 * 1000);

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Enchère **#${id}** créée ! Elle se termine <t:${endsAt}:R>.`)] });
    }

    if (sub === 'miser') {
      const id     = interaction.options.getInteger('id');
      const amount = interaction.options.getInteger('montant');
      const enc    = db.db.prepare("SELECT * FROM encheres_v2 WHERE id=? AND guild_id=? AND status='active'").get(id, guildId);

      if (!enc) return interaction.editReply({ content: `❌ Enchère #${id} introuvable ou terminée.` });
      if (enc.seller_id === userId) return interaction.editReply({ content: '❌ Tu ne peux pas enchérir sur ta propre vente !' });
      if (now > enc.ends_at) return interaction.editReply({ content: '❌ Cette enchère est terminée !' });

      const minBid = enc.current_bid + Math.max(1, Math.round(enc.current_bid * 0.05));
      if (amount < minBid && !(enc.buyout_price && amount >= enc.buyout_price)) {
        return interaction.editReply({ content: `❌ L'enchère minimum est **${minBid}** coins (5% au-dessus de la mise actuelle).` });
      }

      const user = db.getUser(userId, guildId);
      if (user.coins < amount) return interaction.editReply({ content: `❌ Tu n'as que **${user.coins}** coins.` });

      // Rembourser le précédent enchérisseur
      if (enc.bidder_id && enc.bidder_id !== userId) {
        db.addCoins(enc.bidder_id, guildId, enc.current_bid);
        const prev = await interaction.client.users.fetch(enc.bidder_id).catch(() => null);
        if (prev) prev.send({ embeds: [new EmbedBuilder().setColor('#e67e22').setDescription(`⚠️ Tu as été surenchéri sur **${enc.item_name}** (Enchère #${id}). Ta mise de **${enc.current_bid} coins** a été remboursée.`)] }).catch(() => {});
      } else if (enc.bidder_id === userId) {
        db.addCoins(userId, guildId, enc.current_bid); // Rembourser soi-même d'abord
      }

      db.removeCoins(userId, guildId, amount);
      db.db.prepare('UPDATE encheres_v2 SET current_bid=?, bidder_id=? WHERE id=?').run(amount, userId, id);
      db.db.prepare('INSERT INTO encheres_v2_history (enchere_id, bidder_id, amount) VALUES (?,?,?)').run(id, userId, amount);

      // Achat immédiat ?
      if (enc.buyout_price && amount >= enc.buyout_price) {
        db.db.prepare("UPDATE encheres_v2 SET status='ended' WHERE id=?").run(id);
        db.addCoins(enc.seller_id, guildId, amount);
        return interaction.editReply({ embeds: [new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('⚡ Achat Immédiat !')
          .setDescription(`Tu as acheté **${enc.item_name}** au prix immédiat de **${amount} coins** !`)
        ]});
      }

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Enchère placée sur #${id}`)
        .addFields(
          { name: `🔨 ${enc.item_name}`, value: `Meilleure enchère : **${amount} coins**`, inline: true },
          { name: '⏱️ Fin',              value: `<t:${enc.ends_at}:R>`,                   inline: true },
        )
      ]});
    }

    if (sub === 'voir') {
      const id  = interaction.options.getInteger('id');
      const enc = db.db.prepare('SELECT * FROM encheres_v2 WHERE id=? AND guild_id=?').get(id, guildId);
      if (!enc) return interaction.editReply({ content: `❌ Enchère #${id} introuvable.` });

      const history = db.db.prepare('SELECT * FROM encheres_v2_history WHERE enchere_id=? ORDER BY amount DESC LIMIT 5').all(id);

      const embed = new EmbedBuilder()
        .setColor(enc.status === 'active' ? '#f39c12' : '#95a5a6')
        .setTitle(`🔨 Enchère #${id} — ${enc.item_name}`)
        .setDescription(enc.description || 'Aucune description')
        .addFields(
          { name: '💰 Mise actuelle',    value: `**${enc.current_bid} 🪙**`,                    inline: true },
          { name: '👑 Meilleur enchérisseur', value: enc.bidder_id ? `<@${enc.bidder_id}>` : 'Aucun', inline: true },
          { name: '⏱️ Statut',          value: enc.status === 'active' ? `Fin <t:${enc.ends_at}:R>` : '⏹️ Terminé', inline: true },
          { name: '👤 Vendeur',          value: `<@${enc.seller_id}>`,                          inline: true },
          { name: '⚡ Achat immédiat',   value: enc.buyout_price ? `${enc.buyout_price} 🪙` : 'Non', inline: true },
        );

      if (history.length) {
        embed.addFields({ name: '📜 Historique', value: history.map(h => `<@${h.bidder_id}> — **${h.amount} 🪙** <t:${h.bid_at}:R>`).join('\n'), inline: false });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'liste') {
      const list = db.db.prepare("SELECT * FROM encheres_v2 WHERE guild_id=? AND status='active' AND ends_at>=? ORDER BY ends_at ASC LIMIT 10").all(guildId, now);
      if (!list.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune enchère active !')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🔨 Enchères Actives')
        .setDescription(list.map(e => `**#${e.id}** — **${e.item_name}** — Mise actuelle : **${e.current_bid} 🪙** — Fin <t:${e.ends_at}:R>`).join('\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'mes_encheres') {
      const mySales = db.db.prepare("SELECT * FROM encheres_v2 WHERE guild_id=? AND seller_id=? ORDER BY created_at DESC LIMIT 5").all(guildId, userId);
      const myBids  = db.db.prepare("SELECT * FROM encheres_v2 WHERE guild_id=? AND bidder_id=? AND status='active' ORDER BY ends_at ASC LIMIT 5").all(guildId, userId);

      const embed = new EmbedBuilder().setColor('#9b59b6').setTitle('👤 Mes Enchères');
      if (mySales.length) {
        embed.addFields({ name: '📦 Mes Ventes', value: mySales.map(e => `**#${e.id}** ${e.item_name} — ${e.current_bid} 🪙 — ${e.status === 'active' ? `Fin <t:${e.ends_at}:R>` : e.status}`).join('\n'), inline: false });
      }
      if (myBids.length) {
        embed.addFields({ name: '💰 Mes Enchères', value: myBids.map(e => `**#${e.id}** ${e.item_name} — Ma mise : ${e.current_bid} 🪙 — Fin <t:${e.ends_at}:R>`).join('\n'), inline: false });
      }
      if (!mySales.length && !myBids.length) embed.setDescription('Aucune enchère pour le moment.');
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
