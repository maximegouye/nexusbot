const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Marché noir : offres aléatoires toutes les heures, très risqué mais très rentable
const ITEMS_BN = [
  // === Items COMMUNS (apparaissent souvent) ===
  { id: 'boost_xp_2x', label: '⚡ Boost XP x2 (1h)', price_range: [500, 1500], type: 'boost', rarity: 'common' },
  { id: 'vol_protection', label: '🛡️ Bouclier anti-vol (24h)', price_range: [800, 2000], type: 'protection', rarity: 'common' },
  { id: 'mystery_box', label: '📦 Boîte mystère', price_range: [300, 1000], type: 'mystery', rarity: 'common' },
  { id: 'casino_bonus', label: '🎰 Bonus casino +50% (5 parties)', price_range: [1000, 3000], type: 'boost', rarity: 'common' },
  { id: 'fishing_bait', label: '🐟 Appât légendaire (10 pêches rares)', price_range: [600, 1800], type: 'tool', rarity: 'common' },
  { id: 'mine_tnt', label: '💣 TNT de mine (+500% (1 mine))', price_range: [1500, 4000], type: 'tool', rarity: 'common' },
  { id: 'fake_money', label: '💸 Faux billets (+5000 coins, risqué)', price_range: [200, 800], type: 'risky', rarity: 'common' },
  { id: 'steal_kit', label: '🔓 Kit de vol (+50% vol réussi)', price_range: [2000, 5000], type: 'crime', rarity: 'common' },

  // === Items RARES (apparaissent moins) ===
  { id: 'lucky_charm', label: '🍀 Porte-bonheur (+15% gains casino 24h)', price_range: [5000, 12000], type: 'boost', rarity: 'rare' },
  { id: 'work_boost', label: '💼 Boost salaire x3 (5 /work)', price_range: [3000, 8000], type: 'boost', rarity: 'rare' },
  { id: 'bank_key', label: '🔑 Passe bancaire (frais bancaires 0% 7j)', price_range: [4000, 10000], type: 'utility', rarity: 'rare' },
  { id: 'jail_card', label: '🚓 Carte sortie de prison (annule 1 prison)', price_range: [6000, 15000], type: 'crime', rarity: 'rare' },

  // === Items LÉGENDAIRES (apparaissent rarement) ===
  { id: 'diamond_ticket', label: '💎 Ticket Diamant (10 spins gratuits casino)', price_range: [25000, 60000], type: 'boost', rarity: 'legendary' },
  { id: 'golden_pickaxe', label: '⛏️ Pioche d\'or (+1000% mine 24h)', price_range: [40000, 100000], type: 'tool', rarity: 'legendary' },
  { id: 'mafia_protection', label: '🕴️ Protection mafia (anti-vol 30 jours)', price_range: [50000, 150000], type: 'protection', rarity: 'legendary' },
];

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS black_market (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, item_id TEXT,
    price INTEGER, stock INTEGER DEFAULT 3,
    available_until INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS bm_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    item_id TEXT, price INTEGER, result TEXT,
    bought_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!cols.includes('bm_boost_xp_until'))   db.db.prepare("ALTER TABLE users ADD COLUMN bm_boost_xp_until INTEGER DEFAULT 0").run();
  if (!cols.includes('bm_protected_until'))  db.db.prepare("ALTER TABLE users ADD COLUMN bm_protected_until INTEGER DEFAULT 0").run();
  if (!cols.includes('bm_casino_bonus'))     db.db.prepare("ALTER TABLE users ADD COLUMN bm_casino_bonus INTEGER DEFAULT 0").run();
  if (!cols.includes('bm_fishing_bait'))     db.db.prepare("ALTER TABLE users ADD COLUMN bm_fishing_bait INTEGER DEFAULT 0").run();
  if (!cols.includes('bm_mine_tnt'))         db.db.prepare("ALTER TABLE users ADD COLUMN bm_mine_tnt INTEGER DEFAULT 0").run();
  if (!cols.includes('bm_steal_kit'))        db.db.prepare("ALTER TABLE users ADD COLUMN bm_steal_kit INTEGER DEFAULT 0").run();
} catch {}

function getOrGenerateMarket(guildId) {
  const now = Math.floor(Date.now() / 1000);
  // Nettoyer les offres expirées
  db.db.prepare('DELETE FROM black_market WHERE available_until < ? AND guild_id=?').run(now, guildId);

  let items = db.db.prepare('SELECT * FROM black_market WHERE guild_id=? AND available_until > ? AND stock > 0').all(guildId, now);

  if (items.length === 0) {
    // Générer 4-5 nouvelles offres valables 2h, avec pondération par rareté
    const until = now + 7200;
    // Pool pondéré : commons 70%, rares 25%, legendary 5%
    const commons = ITEMS_BN.filter(i => i.rarity === 'common');
    const rares = ITEMS_BN.filter(i => i.rarity === 'rare');
    const legendaries = ITEMS_BN.filter(i => i.rarity === 'legendary');
    const pool = [];
    // 3 commons garantis
    pool.push(...commons.sort(() => Math.random() - 0.5).slice(0, 3));
    // 1 rare avec 60% chance
    if (Math.random() < 0.6 && rares.length) pool.push(rares[Math.floor(Math.random() * rares.length)]);
    // 1 légendaire avec 15% chance
    if (Math.random() < 0.15 && legendaries.length) pool.push(legendaries[Math.floor(Math.random() * legendaries.length)]);

    for (const item of pool) {
      const price = Math.floor(Math.random() * (item.price_range[1] - item.price_range[0])) + item.price_range[0];
      // Stock réduit pour les rares/légendaires
      const baseStock = item.rarity === 'legendary' ? 1 : item.rarity === 'rare' ? 2 : 3;
      db.db.prepare('INSERT INTO black_market (guild_id, item_id, price, stock, available_until) VALUES (?,?,?,?,?)')
        .run(guildId, item.id, price, Math.floor(Math.random() * baseStock) + 1, until);
    }
    items = db.db.prepare('SELECT * FROM black_market WHERE guild_id=? AND available_until > ? AND stock > 0').all(guildId, now);
  }

  return items;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('marchenoir')
    .setDescription('🕵️ Marché noir — Offres secrètes et risquées, rotation toutes les 2h')
    .addSubcommand(s => s.setName('voir').setDescription('🕵️ Voir les offres actuelles'))
    .addSubcommand(s => s.setName('acheter').setDescription('💸 Acheter une offre')
      .addIntegerOption(o => o.setName('numero').setDescription('Numéro de l\'offre (voir /marchenoir voir)').setRequired(true).setMinValue(1).setMaxValue(10)))
    .addSubcommand(s => s.setName('inventaire').setDescription('🎒 Voir vos objets spéciaux')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'voir') {
      const items = getOrGenerateMarket(guildId);
      const expiresIn = items[0] ? items[0].available_until - now : 7200;

      const desc = items.map((item, i) => {
        const meta = ITEMS_BN.find(x => x.id === item.item_id);
        const riskLabel = meta?.type === 'risky' ? ' ⚠️ *risqué*' : meta?.type === 'crime' ? ' 🚨 *illégal*' : '';
        const rarityLabel = meta?.rarity === 'legendary' ? ' 💎 **LÉGENDAIRE**' : meta?.rarity === 'rare' ? ' ⭐ *rare*' : '';
        return `**${i+1}.** ${meta?.label || item.item_id}${rarityLabel}\n— **${item.price.toLocaleString()} ${coin}** (stock: ${item.stock})${riskLabel}`;
      }).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2C3E50')
          .setTitle('🕵️ Marché Noir')
          .setDescription(desc || '*Aucune offre disponible.*')
          .addFields({ name: '⏳ Renouvellement', value: `<t:${items[0]?.available_until || now + 7200}:R>`, inline: true })
          .setFooter({ text: '⚠️ Certains items sont risqués — vous pouvez tout perdre !' })
      ]});
    }

    if (sub === 'acheter') {
      const num = interaction.options.getInteger('numero') - 1;
      const items = getOrGenerateMarket(guildId);
      if (num < 0 || num >= items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Numéro d\'offre invalide.', ephemeral: true });

      const item = items[num];
      const meta = ITEMS_BN.find(x => x.id === item.item_id);
      const u = db.getUser(userId, guildId);

      if ((u.balance || 0) < item.price) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Pas assez de ${coin}. Il vous faut **${item.price.toLocaleString()}**, vous avez **${u.balance || 0}**.`, ephemeral: true });
      }

      db.removeCoins(userId, guildId, item.price);
      db.db.prepare('UPDATE black_market SET stock = stock - 1 WHERE id=?').run(item.id);

      let result = '✅';
      let resultDesc = `Vous avez acheté **${meta?.label}** !`;

      // Effets selon le type
      if (item.item_id === 'boost_xp_2x') {
        db.db.prepare('UPDATE users SET bm_boost_xp_until=? WHERE user_id=? AND guild_id=?').run(now + 3600, userId, guildId);
        resultDesc += '\n⚡ Boost XP x2 actif pendant **1 heure** !';
      } else if (item.item_id === 'vol_protection') {
        db.db.prepare('UPDATE users SET bm_protected_until=? WHERE user_id=? AND guild_id=?').run(now + 86400, userId, guildId);
        resultDesc += '\n🛡️ Protection anti-vol active **24h** !';
      } else if (item.item_id === 'mystery_box') {
        const roll = Math.random();
        let gain = 0;
        if (roll < 0.05) { gain = Math.floor(item.price * 10); resultDesc += `\n🎉 **JACKPOT !** +${gain.toLocaleString()} ${coin} !`; }
        else if (roll < 0.3) { gain = Math.floor(item.price * 3); resultDesc += `\n✨ **Super gain !** +${gain.toLocaleString()} ${coin} !`; }
        else if (roll < 0.6) { gain = Math.floor(item.price * 1.5); resultDesc += `\n💰 +${gain.toLocaleString()} ${coin}`; }
        else { gain = 0; resultDesc += '\n📦 Boîte vide... Pas de chance cette fois.'; result = '❌'; }
        if (gain > 0) db.addCoins(userId, guildId, gain);
      } else if (item.item_id === 'casino_bonus') {
        db.db.prepare('UPDATE users SET bm_casino_bonus=5 WHERE user_id=? AND guild_id=?').run(userId, guildId);
        resultDesc += '\n🎰 Bonus casino actif pour les **5 prochaines parties** !';
      } else if (item.item_id === 'fishing_bait') {
        db.db.prepare('UPDATE users SET bm_fishing_bait = bm_fishing_bait + 10 WHERE user_id=? AND guild_id=?').run(userId, guildId);
        resultDesc += '\n🎣 **10 appâts légendaires** ajoutés à votre inventaire !';
      } else if (item.item_id === 'mine_tnt') {
        db.db.prepare('UPDATE users SET bm_mine_tnt = bm_mine_tnt + 1 WHERE user_id=? AND guild_id=?').run(userId, guildId);
        resultDesc += '\n💣 **1 TNT de mine** ajouté à votre inventaire !';
      } else if (item.item_id === 'fake_money') {
        const caught = Math.random() < 0.35; // 35% de risque
        if (caught) {
          const fine = Math.floor(item.price * 3);
          db.removeCoins(userId, guildId, fine);
          result = '🚨';
          resultDesc = `🚨 Vous avez été **arrêté** avec de faux billets ! Amende de **${fine.toLocaleString()} ${coin}** !`;
        } else {
          db.addCoins(userId, guildId, 5000);
          resultDesc += `\n💸 Les faux billets ont **marché** ! +**5000** ${coin}`;
        }
      } else if (item.item_id === 'steal_kit') {
        db.db.prepare('UPDATE users SET bm_steal_kit = bm_steal_kit + 1 WHERE user_id=? AND guild_id=?').run(userId, guildId);
        resultDesc += '\n🔓 Kit de vol ajouté ! Utilisez `/voler` pour augmenter vos chances.';
      }

      db.db.prepare('INSERT INTO bm_purchases (guild_id, user_id, item_id, price, result) VALUES (?,?,?,?,?)').run(guildId, userId, item.item_id, item.price, result);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor(result === '✅' ? '#2ECC71' : result === '🚨' ? '#E74C3C' : '#F39C12')
          .setTitle(`${result} Achat — Marché Noir`)
          .setDescription(resultDesc)
          .setFooter({ text: `Solde restant : ${(db.getUser(userId, guildId).balance || 0).toLocaleString()} ${coin}` })
      ], ephemeral: true });
    }

    if (sub === 'inventaire') {
      const u = db.getUser(userId, guildId);
      const fields = [];

      if ((u.bm_boost_xp_until || 0) > now) fields.push({ name: '⚡ Boost XP x2', value: `Expire <t:${u.bm_boost_xp_until}:R>`, inline: true });
      if ((u.bm_protected_until || 0) > now) fields.push({ name: '🛡️ Protection', value: `Expire <t:${u.bm_protected_until}:R>`, inline: true });
      if ((u.bm_casino_bonus || 0) > 0) fields.push({ name: '🎰 Bonus Casino', value: `**${u.bm_casino_bonus}** partie(s)`, inline: true });
      if ((u.bm_fishing_bait || 0) > 0) fields.push({ name: '🐟 Appâts', value: `**${u.bm_fishing_bait}** restants`, inline: true });
      if ((u.bm_mine_tnt || 0) > 0) fields.push({ name: '💣 TNT Mine', value: `**${u.bm_mine_tnt}** restants`, inline: true });
      if ((u.bm_steal_kit || 0) > 0) fields.push({ name: '🔓 Kit de Vol', value: `**${u.bm_steal_kit}** restant(s)`, inline: true });

      if (!fields.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Votre inventaire spécial est vide.', ephemeral: true });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2C3E50').setTitle('🎒 Inventaire Spécial').addFields(...fields)
      ], ephemeral: true });
    }
  }
};
