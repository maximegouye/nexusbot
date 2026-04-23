/**
 * NexusBot — Investissement Immobilier
 * /immo — Achetez, vendez et rentabilisez des propriétés virtuelles !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS immo_portfolio (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL,
    property_id INTEGER NOT NULL,
    bought_at   INTEGER NOT NULL,
    buy_price   INTEGER NOT NULL,
    rentals     INTEGER DEFAULT 0,
    last_collect INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, guild_id, property_id)
  )`).run();
} catch {}

const PROPERTIES = [
  { id: 1,  name: '🏠 Studio Paris',       price: 5000,   rent: 100, rentCooldown: 3600,   riskPct: 0.05, maxRent: 50  },
  { id: 2,  name: '🏢 Appartement Lyon',   price: 12000,  rent: 280, rentCooldown: 3600,   riskPct: 0.06, maxRent: 80  },
  { id: 3,  name: '🏰 Villa Côte d\'Azur', price: 35000,  rent: 900, rentCooldown: 7200,   riskPct: 0.08, maxRent: 40  },
  { id: 4,  name: '🏗️ Immeuble locatif',  price: 80000,  rent: 2200,rentCooldown: 14400,  riskPct: 0.10, maxRent: 30  },
  { id: 5,  name: '🏨 Hôtel Boutique',     price: 150000, rent: 5000,rentCooldown: 28800,  riskPct: 0.12, maxRent: 20  },
  { id: 6,  name: '🌆 Tour de Bureaux',    price: 500000, rent: 18000,rentCooldown:86400,  riskPct: 0.15, maxRent: 10  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('immo')
    .setDescription('🏠 Marché Immobilier Virtuel')
    .addSubcommand(s => s.setName('marche').setDescription('🏪 Voir les propriétés disponibles'))
    .addSubcommand(s => s.setName('acheter')
      .setDescription('💰 Acheter une propriété')
    .addSubcommand(s => s.setName('portfolio').setDescription('📋 Voir ton portfolio immobilier'))
    .addSubcommand(s => s.setName('loyer').setDescription('💸 Collecter les loyers de tes propriétés'))
    .addSubcommand(s => s.setName('vendre')
      .setDescription('📉 Vendre une propriété')

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const now     = Math.floor(Date.now() / 1000);

    if (sub === 'marche') {
      const embed = new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('🏠 Marché Immobilier NexusBot')
        .setDescription('Investissez dans des propriétés virtuelles et collectez des loyers !')
        .addFields(PROPERTIES.map(p => ({
          name: `${p.name} (#${p.id})`,
          value: `💰 Prix : **${p.price.toLocaleString()}** 🪙\n🏡 Loyer : **${p.rent}** 🪙 / ${p.rentCooldown >= 3600 ? Math.round(p.rentCooldown/3600)+'h' : p.rentCooldown+'min'}\n📊 Rendement : ${((p.rent / p.price) * (86400/p.rentCooldown) * 100).toFixed(1)}%/jour`,
          inline: true,
        })));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'acheter') {
      const propId = parseInt(interaction.options.getString('id'));
      const prop   = PROPERTIES.find(p => p.id === propId);
      if (!prop) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Propriété introuvable.' });

      const already = db.db.prepare('SELECT * FROM immo_portfolio WHERE user_id=? AND guild_id=? AND property_id=?').get(userId, guildId, propId);
      if (already) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu possèdes déjà cette propriété !' });

      const user = db.getUser(userId, guildId);
      if (user.coins < prop.price) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${user.coins.toLocaleString()}** 🪙. Il te faut **${prop.price.toLocaleString()}** 🪙.` });

      db.removeCoins(userId, guildId, prop.price);
      db.db.prepare('INSERT INTO immo_portfolio (user_id, guild_id, property_id, bought_at, buy_price) VALUES (?,?,?,?,?)').run(userId, guildId, propId, now, prop.price);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`🏠 Propriété Achetée !`)
        .setDescription(`Tu possèdes maintenant **${prop.name}** !\n\n💰 Achat : **${prop.price.toLocaleString()}** 🪙\n🏡 Loyer : **${prop.rent}** 🪙 toutes les ${Math.round(prop.rentCooldown/3600)}h\n\nCollecte avec \`/immo loyer\``)
      ]});
    }

    if (sub === 'portfolio') {
      const props = db.db.prepare('SELECT * FROM immo_portfolio WHERE user_id=? AND guild_id=?').all(userId, guildId);
      if (!props.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Tu ne possèdes aucune propriété. Commence avec `/immo marche` !')] });

      let totalValue = 0, totalDailyRent = 0;
      const embed = new EmbedBuilder().setColor('#27ae60').setTitle(`🏠 Portfolio Immobilier — ${interaction.user.username}`);

      for (const item of props) {
        const prop = PROPERTIES.find(p => p.id === item.property_id);
        if (!prop) continue;
        const cooldownLeft = Math.max(0, (item.last_collect + prop.rentCooldown) - now);
        const canCollect   = cooldownLeft === 0;
        const dailyRent    = Math.round(prop.rent * 86400 / prop.rentCooldown);
        totalValue   += prop.price;
        totalDailyRent += dailyRent;

        embed.addFields({
          name: `${prop.name}`,
          value: `🏡 Loyer : **${prop.rent}** 🪙\n${canCollect ? '✅ **Loyer disponible !**' : `⏳ Prochain loyer : <t:${item.last_collect + prop.rentCooldown}:R>`}\n📊 ${item.rentals} locations au total`,
          inline: true,
        });
      }

      embed.setFooter({ text: `Valeur totale : ${totalValue.toLocaleString()} 🪙 | Revenu quotidien ~${totalDailyRent.toLocaleString()} 🪙` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'loyer') {
      const props = db.db.prepare('SELECT * FROM immo_portfolio WHERE user_id=? AND guild_id=?').all(userId, guildId);
      if (!props.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne possèdes aucune propriété.' });

      let totalCollected = 0;
      const collected = [];

      for (const item of props) {
        const prop = PROPERTIES.find(p => p.id === item.property_id);
        if (!prop) continue;
        const cooldownLeft = (item.last_collect + prop.rentCooldown) - now;
        if (cooldownLeft > 0) continue;

        // Risque de pas de loyer (locataire problématique)
        if (Math.random() < prop.riskPct) {
          collected.push(`❌ **${prop.name}** — Locataire problématique, pas de loyer ce coup-ci !`);
          db.db.prepare('UPDATE immo_portfolio SET last_collect=? WHERE user_id=? AND guild_id=? AND property_id=?').run(now, userId, guildId, item.property_id);
          continue;
        }

        db.addCoins(userId, guildId, prop.rent);
        db.db.prepare('UPDATE immo_portfolio SET last_collect=?, rentals=rentals+1 WHERE user_id=? AND guild_id=? AND property_id=?').run(now, userId, guildId, item.property_id);
        totalCollected += prop.rent;
        collected.push(`✅ **${prop.name}** — +**${prop.rent}** 🪙`);
      }

      if (collected.length === 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('⏳ Aucun loyer disponible pour le moment. Reviens plus tard !')] });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#27ae60')
        .setTitle('🏡 Loyers Collectés !')
        .setDescription(collected.join('\n'))
        .addFields({ name: '💰 Total collecté', value: `**${totalCollected.toLocaleString()}** 🪙`, inline: true })
      ]});
    }

    if (sub === 'vendre') {
      const propId = parseInt(interaction.options.getString('id'));
      const prop   = PROPERTIES.find(p => p.id === propId);
      if (!prop) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Propriété introuvable.' });

      const item = db.db.prepare('SELECT * FROM immo_portfolio WHERE user_id=? AND guild_id=? AND property_id=?').get(userId, guildId, propId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne possèdes pas cette propriété !' });

      // Prix de revente = 70-90% du prix d'achat
      const sellPct   = 0.70 + Math.random() * 0.20;
      const sellPrice = Math.round(prop.price * sellPct);
      const profit    = sellPrice - item.buy_price;

      db.addCoins(userId, guildId, sellPrice);
      db.db.prepare('DELETE FROM immo_portfolio WHERE user_id=? AND guild_id=? AND property_id=?').run(userId, guildId, propId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(profit >= 0 ? '#2ecc71' : '#e74c3c')
        .setTitle(`📉 Propriété Vendue — ${prop.name}`)
        .addFields(
          { name: '💰 Prix d\'achat', value: `${item.buy_price.toLocaleString()} 🪙`,    inline: true },
          { name: '💵 Prix de vente', value: `${sellPrice.toLocaleString()} 🪙`,          inline: true },
          { name: profit >= 0 ? '📈 Plus-value' : '📉 Moins-value', value: `${profit >= 0 ? '+' : ''}${profit.toLocaleString()} 🪙`, inline: true },
          { name: '🏡 Loyers encaissés', value: `${item.rentals}`,                        inline: true },
        )
      ]});
    }
  }
};
