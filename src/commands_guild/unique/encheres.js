/**
 * NexusBot — Système d'enchères (auctions)
 * UNIQUE : Créer des enchères, enchérir en temps réel, notifications automatiques
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS encheres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, seller_id TEXT,
    item_name TEXT, description TEXT DEFAULT '',
    starting_price INTEGER DEFAULT 100,
    current_price INTEGER DEFAULT 100,
    highest_bidder TEXT DEFAULT NULL,
    min_increment INTEGER DEFAULT 10,
    end_time INTEGER,
    status TEXT DEFAULT 'active',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS enchere_bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enchere_id INTEGER, guild_id TEXT,
    bidder_id TEXT, amount INTEGER,
    timestamp INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enchere')
    .setDescription('🏷️ Système d\'enchères — vendez et achetez aux enchères !')
    .addSubcommand(s => s.setName('creer').setDescription('🏷️ Créer une enchère')
      .addStringOption(o => o.setName('article').setDescription('Nom de l\'article').setRequired(true).setMaxLength(80))
      .addIntegerOption(o => o.setName('prix_depart').setDescription('Prix de départ').setRequired(true).setMinValue(10))
      .addIntegerOption(o => o.setName('duree_heures').setDescription('Durée en heures (1-72)').setRequired(true).setMinValue(1).setMaxValue(72))
      .addStringOption(o => o.setName('description').setDescription('Description de l\'article').setMaxLength(200))
      .addIntegerOption(o => o.setName('increment_min').setDescription('Surenchère minimale (défaut: 10)').setMinValue(1)))
    .addSubcommand(s => s.setName('encherir').setDescription('💰 Faire une enchère')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true))
      .addIntegerOption(o => o.setName('montant').setDescription('Votre mise').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir une enchère')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des enchères actives'))
    .addSubcommand(s => s.setName('historique').setDescription('📜 Historique de vos enchères'))
    .addSubcommand(s => s.setName('annuler').setDescription('❌ Annuler votre enchère (avant première mise)')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true)))
    .addSubcommand(s => s.setName('cloturer').setDescription('🔒 Clôturer une enchère terminée')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'enchère').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const u = db.getUser(userId, guildId);
      const article = interaction.options.getString('article');
      const prixDepart = interaction.options.getInteger('prix_depart');
      const duree = interaction.options.getInteger('duree_heures');
      const desc = interaction.options.getString('description') || '';
      const increment = interaction.options.getInteger('increment_min') || 10;
      const endTime = now + duree * 3600;

      // Coût de mise en vente : 50 coins
      if ((u.balance || 0) < 50) return interaction.reply({ content: `❌ Il faut **50 ${coin}** pour mettre un article en vente.`, ephemeral: true });
      db.addCoins(userId, guildId, -50);

      const result = db.db.prepare('INSERT INTO encheres (guild_id,seller_id,item_name,description,starting_price,current_price,min_increment,end_time) VALUES(?,?,?,?,?,?,?,?)')
        .run(guildId, userId, article, desc, prixDepart, prixDepart, increment, endTime);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`🏷️ Enchère créée — ${article}`)
        .setDescription(desc || '*Aucune description*')
        .addFields(
          { name: '💰 Prix de départ', value: `**${prixDepart} ${coin}**`, inline: true },
          { name: '📈 Incrément min.', value: `${increment} ${coin}`, inline: true },
          { name: '⏰ Fin', value: `<t:${endTime}:R>`, inline: true },
          { name: '🆔 ID', value: `**#${result.lastInsertRowid}**`, inline: true },
        )
        .setFooter({ text: `Enchérissez avec /enchere encherir id:${result.lastInsertRowid} | -50 ${coin} de frais` })] });
    }

    if (sub === 'encherir') {
      const id = interaction.options.getInteger('id');
      const montant = interaction.options.getInteger('montant');
      const enc = db.db.prepare('SELECT * FROM encheres WHERE id=? AND guild_id=?').get(id, guildId);
      if (!enc) return interaction.reply({ content: `❌ Enchère #${id} introuvable.`, ephemeral: true });
      if (enc.status !== 'active') return interaction.reply({ content: '❌ Cette enchère est terminée.', ephemeral: true });
      if (now > enc.end_time) return interaction.reply({ content: '❌ Cette enchère est expirée.', ephemeral: true });
      if (enc.seller_id === userId) return interaction.reply({ content: '❌ Vous ne pouvez pas enchérir sur votre propre article.', ephemeral: true });
      if (enc.highest_bidder === userId) return interaction.reply({ content: '❌ Vous êtes déjà le plus offrant.', ephemeral: true });

      const minBid = enc.current_price + enc.min_increment;
      if (montant < minBid) return interaction.reply({ content: `❌ La mise minimale est **${minBid} ${coin}** (actuel: ${enc.current_price} + incrément: ${enc.min_increment}).`, ephemeral: true });

      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < montant) return interaction.reply({ content: `❌ Vous n\'avez que **${u.balance || 0} ${coin}**.`, ephemeral: true });

      // Rembourser le précédent enchérisseur
      if (enc.highest_bidder) {
        db.addCoins(enc.highest_bidder, guildId, enc.current_price);
      }

      // Débiter le nouvel enchérisseur
      db.addCoins(userId, guildId, -montant);
      db.db.prepare('UPDATE encheres SET current_price=?, highest_bidder=? WHERE id=?').run(montant, userId, id);
      db.db.prepare('INSERT INTO enchere_bids (enchere_id,guild_id,bidder_id,amount) VALUES(?,?,?,?)').run(id, guildId, userId, montant);

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`💰 Enchère #${id} — Nouvelle mise !`)
        .setDescription(`<@${userId}> a mis **${montant} ${coin}** sur **${enc.item_name}** !`)
        .addFields(
          { name: '💰 Mise actuelle', value: `**${montant} ${coin}**`, inline: true },
          { name: '⏰ Fin', value: `<t:${enc.end_time}:R>`, inline: true },
        )] });
    }

    if (sub === 'voir') {
      const id = interaction.options.getInteger('id');
      const enc = db.db.prepare('SELECT * FROM encheres WHERE id=? AND guild_id=?').get(id, guildId);
      if (!enc) return interaction.reply({ content: `❌ Enchère #${id} introuvable.`, ephemeral: true });
      const bids = db.db.prepare('SELECT COUNT(*) as c FROM enchere_bids WHERE enchere_id=?').get(id);
      const isExpired = now > enc.end_time;
      const statusEmoji = enc.status === 'active' && !isExpired ? '🟢' : '🔒';

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`${statusEmoji} Enchère #${id} — ${enc.item_name}`)
        .setDescription(enc.description || '*Aucune description*')
        .addFields(
          { name: '💰 Prix actuel', value: `**${enc.current_price} ${coin}**`, inline: true },
          { name: '🏆 Plus offrant', value: enc.highest_bidder ? `<@${enc.highest_bidder}>` : '*Aucun*', inline: true },
          { name: '📊 Mises', value: `${bids.c}`, inline: true },
          { name: '⏰ Fin', value: `<t:${enc.end_time}:${isExpired ? 'f' : 'R'}>`, inline: true },
          { name: '🏪 Vendeur', value: `<@${enc.seller_id}>`, inline: true },
          { name: '📈 Incrément min.', value: `${enc.min_increment} ${coin}`, inline: true },
        )] });
    }

    if (sub === 'liste') {
      const encs = db.db.prepare('SELECT * FROM encheres WHERE guild_id=? AND status=? AND end_time>? ORDER BY end_time ASC LIMIT 10').all(guildId, 'active', now);
      if (!encs.length) return interaction.reply({ content: '📋 Aucune enchère active. Créez-en une avec `/enchere creer` !', ephemeral: true });
      const desc = encs.map(e => `**[#${e.id}] ${e.item_name}** — ${e.current_price} ${coin} | Fin : <t:${e.end_time}:R>`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏷️ Enchères actives')
        .setDescription(desc)
        .setFooter({ text: '/enchere voir id:<n> pour les détails' })] });
    }

    if (sub === 'historique') {
      const mySales = db.db.prepare('SELECT * FROM encheres WHERE guild_id=? AND seller_id=? ORDER BY id DESC LIMIT 5').all(guildId, userId);
      const myBids = db.db.prepare('SELECT * FROM encheres WHERE guild_id=? AND highest_bidder=? ORDER BY id DESC LIMIT 5').all(guildId, userId);
      const salesDesc = mySales.length ? mySales.map(e => `📦 **[#${e.id}] ${e.item_name}** — ${e.current_price} ${coin} | ${e.status}`).join('\n') : '*Aucune vente*';
      const bidsDesc = myBids.length ? myBids.map(e => `💰 **[#${e.id}] ${e.item_name}** — ${e.current_price} ${coin} | ${e.status}`).join('\n') : '*Aucune enchère*';
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('📜 Votre historique d\'enchères')
        .addFields(
          { name: '🏪 Vos ventes', value: salesDesc, inline: false },
          { name: '💰 Vos enchères gagnantes', value: bidsDesc, inline: false },
        )], ephemeral: true });
    }

    if (sub === 'annuler') {
      const id = interaction.options.getInteger('id');
      const enc = db.db.prepare('SELECT * FROM encheres WHERE id=? AND guild_id=? AND seller_id=?').get(id, guildId, userId);
      if (!enc) return interaction.reply({ content: `❌ Enchère #${id} introuvable ou vous n\'êtes pas le vendeur.`, ephemeral: true });
      if (enc.highest_bidder) return interaction.reply({ content: '❌ Impossible d\'annuler : quelqu\'un a déjà enchéri. Attendez la fin.', ephemeral: true });
      db.db.prepare('UPDATE encheres SET status=? WHERE id=?').run('annulee', id);
      db.addCoins(userId, guildId, 25); // Remboursement partiel
      return interaction.reply({ content: `✅ Enchère #${id} annulée. Remboursement partiel : +25 ${coin}`, ephemeral: true });
    }

    if (sub === 'cloturer') {
      const id = interaction.options.getInteger('id');
      const enc = db.db.prepare('SELECT * FROM encheres WHERE id=? AND guild_id=?').get(id, guildId);
      if (!enc) return interaction.reply({ content: `❌ Enchère #${id} introuvable.`, ephemeral: true });
      if (enc.status !== 'active') return interaction.reply({ content: '❌ Cette enchère est déjà clôturée.', ephemeral: true });
      if (enc.seller_id !== userId && !interaction.member.permissions.has(0x8n)) {
        return interaction.reply({ content: '❌ Seul le vendeur ou un admin peut clôturer.', ephemeral: true });
      }
      if (now < enc.end_time) return interaction.reply({ content: `❌ L\'enchère n\'est pas encore terminée. Fin : <t:${enc.end_time}:R>`, ephemeral: true });

      db.db.prepare('UPDATE encheres SET status=? WHERE id=?').run('terminee', id);
      // Donner les coins au vendeur
      if (enc.highest_bidder) {
        db.addCoins(enc.seller_id, guildId, enc.current_price);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle(`🏆 Enchère #${id} terminée — ${enc.item_name}`)
          .setDescription(`**Gagnant :** <@${enc.highest_bidder}>\n**Prix final :** ${enc.current_price} ${coin}\n\nLe vendeur a reçu **${enc.current_price} ${coin}** !`)] });
      } else {
        // Remboursement complet si aucune mise
        db.addCoins(enc.seller_id, guildId, 50);
        return interaction.reply({ content: `❌ Enchère #${id} terminée sans enchérisseur. Frais remboursés (+50 ${coin}).`, ephemeral: true });
      }
    }
  }
};
