/**
 * NexusBot — Système d'inventaire et de collection d'objets
 * UNIQUE : Collecter, équiper, échanger, créer des ensembles
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS inventaires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    item_id TEXT, item_name TEXT,
    quantity INTEGER DEFAULT 1,
    equipped INTEGER DEFAULT 0,
    obtained_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id, item_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS item_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, from_user TEXT, to_user TEXT,
    item_id TEXT, quantity INTEGER, price INTEGER DEFAULT 0,
    timestamp INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const ITEMS_CATALOGUE = {
  // Outils
  pioche_bois:    { name:'Pioche en bois',    emoji:'⛏️',  rarity:'Commun',    type:'outil',   desc:'Miner lentement.' },
  pioche_fer:     { name:'Pioche en fer',     emoji:'⛏️',  rarity:'Peu commun',type:'outil',   desc:'Miner plus vite.' },
  pioche_or:      { name:'Pioche en or',      emoji:'⛏️',  rarity:'Rare',      type:'outil',   desc:'Meilleur rendement de mine.' },
  canne_peche:    { name:'Canne à pêche',     emoji:'🎣',  rarity:'Commun',    type:'outil',   desc:'Pêcher des poissons.' },
  hache:          { name:'Hache forestière',  emoji:'🪓',  rarity:'Commun',    type:'outil',   desc:'Couper du bois.' },
  // Nourriture
  pain:           { name:'Pain',              emoji:'🍞',  rarity:'Commun',    type:'nourriture', desc:'+5 énergie.' },
  potion_vie:     { name:'Potion de vie',     emoji:'🧪',  rarity:'Peu commun',type:'consommable', desc:'+40 PV en RPG.' },
  elixir_xp:      { name:'Élixir d\'XP',     emoji:'✨',  rarity:'Rare',      type:'consommable', desc:'+100 XP en RPG.' },
  // Cosmétiques
  chapeau_mage:   { name:'Chapeau de mage',   emoji:'🎩',  rarity:'Rare',      type:'cosmétique', desc:'Cosmétique profil.' },
  cape_heroique:  { name:'Cape héroïque',     emoji:'🦸',  rarity:'Épique',    type:'cosmétique', desc:'Cosmétique rare.' },
  couronne:       { name:'Couronne dorée',    emoji:'👑',  rarity:'Légendaire',type:'cosmétique', desc:'Symbole de prestige.' },
  // Matériaux
  bois:           { name:'Bois',              emoji:'🪵',  rarity:'Commun',    type:'matériau',   desc:'Matériau de base.' },
  pierre:         { name:'Pierre',            emoji:'🪨',  rarity:'Commun',    type:'matériau',   desc:'Matériau de base.' },
  fer_lingot:     { name:'Lingot de fer',     emoji:'🔩',  rarity:'Peu commun',type:'matériau',   desc:'Matériau de forge.' },
  or_lingot:      { name:'Lingot d\'or',      emoji:'🪙',  rarity:'Rare',      type:'matériau',   desc:'Matériau précieux.' },
  gemme:          { name:'Gemme brillante',   emoji:'💎',  rarity:'Épique',    type:'matériau',   desc:'Très précieux.' },
};

const RARITY_COLORS = {
  Commun: '#95A5A6',
  'Peu commun': '#2ECC71',
  Rare: '#3498DB',
  Épique: '#9B59B6',
  Légendaire: '#F1C40F',
};

const LOOT_TABLE = [
  { id:'bois',        weight:30 },
  { id:'pierre',      weight:25 },
  { id:'pain',        weight:20 },
  { id:'pioche_bois', weight:10 },
  { id:'canne_peche', weight:8 },
  { id:'fer_lingot',  weight:5 },
  { id:'potion_vie',  weight:4 },
  { id:'elixir_xp',   weight:2 },
  { id:'chapeau_mage',weight:2 },
  { id:'or_lingot',   weight:1 },
  { id:'gemme',       weight:0.5 },
  { id:'cape_heroique',weight:0.3 },
  { id:'couronne',    weight:0.05 },
];

function rollLoot() {
  const total = LOOT_TABLE.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of LOOT_TABLE) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return 'bois';
}

function addItem(userId, guildId, itemId, qty = 1) {
  try {
    const item = ITEMS_CATALOGUE[itemId];
    db.db.prepare(`INSERT INTO inventaires (guild_id,user_id,item_id,item_name,quantity) VALUES(?,?,?,?,?)
      ON CONFLICT(guild_id,user_id,item_id) DO UPDATE SET quantity=quantity+?`)
      .run(guildId, userId, itemId, item.name, qty, qty);
  } catch {}
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventaire')
    .setDescription('🎒 Gérez votre inventaire d\'objets et collections !')
    .addSubcommand(s => s.setName('voir').setDescription('🎒 Voir votre inventaire')
      .addUserOption(o => o.setName('joueur').setDescription('Voir l\'inventaire d\'un autre joueur')))
    .addSubcommand(s => s.setName('item').setDescription('🔍 Infos sur un item')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'item').setRequired(true)
        .addChoices(...Object.entries(ITEMS_CATALOGUE).slice(0,25).map(([k,v]) => ({ name: `${v.emoji} ${v.name} (${v.rarity})`, value: k })))))
    .addSubcommand(s => s.setName('catalogue').setDescription('📚 Catalogue de tous les items'))
    .addSubcommand(s => s.setName('donner').setDescription('🎁 Donner un item à quelqu\'un')
      .addUserOption(o => o.setName('joueur').setDescription('Destinataire').setRequired(true))
      .addStringOption(o => o.setName('item').setDescription('ID de l\'item à donner').setRequired(true))
    .addSubcommand(s => s.setName('vendre').setDescription('💰 Vendre un item contre des coins')
      .addStringOption(o => o.setName('item').setDescription('ID de l\'item à vendre').setRequired(true))
    .addSubcommand(s => s.setName('lootbox').setDescription('📦 Ouvrir une lootbox (50 coins)')

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'voir') {
      const target = interaction.options.getUser('joueur') || interaction.user;
      const items = db.db.prepare('SELECT * FROM inventaires WHERE guild_id=? AND user_id=? ORDER BY quantity DESC').all(guildId, target.id);
      if (!items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `🎒 **${target.username}** a un inventaire vide. Ouvrez des lootboxes avec \`/inventaire lootbox\` !`, ephemeral: true });

      // Grouper par type
      const groups = {};
      items.forEach(i => {
        const info = ITEMS_CATALOGUE[i.item_id];
        if (!info) return;
        const type = info.type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(`${info.emoji} **${info.name}** ×${i.quantity} *(${info.rarity})*`);
      });

      const fields = Object.entries(groups).map(([type, list]) => ({
        name: `${type.charAt(0).toUpperCase()+type.slice(1)}`,
        value: list.join('\n'),
        inline: false,
      }));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle(`🎒 Inventaire de ${target.username}`)
        .addFields(...fields.slice(0,10))
        .setFooter({ text: `${items.length} types d\'objets` })] });
    }

    if (sub === 'item') {
      const id = interaction.options.getString('id');
      const item = ITEMS_CATALOGUE[id];
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Item introuvable.', ephemeral: true });
      // Combien le joueur en possède
      const owned = db.db.prepare('SELECT quantity FROM inventaires WHERE guild_id=? AND user_id=? AND item_id=?').get(guildId, userId, id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(RARITY_COLORS[item.rarity] || '#95A5A6')
        .setTitle(`${item.emoji} ${item.name}`)
        .addFields(
          { name: '⭐ Rareté', value: item.rarity, inline: true },
          { name: '🏷️ Type', value: item.type, inline: true },
          { name: '📊 Vous en avez', value: owned ? owned.quantity.toString() : '0', inline: true },
          { name: '📖 Description', value: item.desc, inline: false },
        )] });
    }

    if (sub === 'catalogue') {
      const byRarity = {};
      Object.entries(ITEMS_CATALOGUE).forEach(([k, v]) => {
        if (!byRarity[v.rarity]) byRarity[v.rarity] = [];
        byRarity[v.rarity].push(`${v.emoji} **${v.name}** (\`${k}\`) — ${v.desc}`);
      });
      const rarityOrder = ['Commun','Peu commun','Rare','Épique','Légendaire'];
      const fields = rarityOrder.filter(r => byRarity[r]).map(r => ({
        name: `${r} (${byRarity[r].length})`,
        value: byRarity[r].join('\n'),
        inline: false,
      }));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('📚 Catalogue d\'items')
        .addFields(...fields)
        .setFooter({ text: 'Obtenez des items avec /inventaire lootbox !' })], ephemeral: true });
    }

    if (sub === 'donner') {
      const target = interaction.options.getUser('joueur');
      const itemId = interaction.options.getString('item');
      const qty = parseInt(interaction.options.getString('quantite')) || 1;
      if (target.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous donner un item à vous-même.', ephemeral: true });

      const owned = db.db.prepare('SELECT quantity FROM inventaires WHERE guild_id=? AND user_id=? AND item_id=?').get(guildId, userId, itemId);
      if (!owned || owned.quantity < qty) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous n\'avez pas assez de cet item (vous en avez ${owned?.quantity || 0}).`, ephemeral: true });

      // Retirer au donneur
      if (owned.quantity - qty <= 0) {
        db.db.prepare('DELETE FROM inventaires WHERE guild_id=? AND user_id=? AND item_id=?').run(guildId, userId, itemId);
      } else {
        db.db.prepare('UPDATE inventaires SET quantity=quantity-? WHERE guild_id=? AND user_id=? AND item_id=?').run(qty, guildId, userId, itemId);
      }
      // Ajouter au receveur
      addItem(target.id, guildId, itemId, qty);

      const item = ITEMS_CATALOGUE[itemId];
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`🎁 <@${userId}> a donné **${qty}× ${item.emoji} ${item.name}** à <@${target.id}> !`)] });
    }

    if (sub === 'vendre') {
      const itemId = interaction.options.getString('item');
      const prix = parseInt(interaction.options.getString('prix'));
      const owned = db.db.prepare('SELECT quantity FROM inventaires WHERE guild_id=? AND user_id=? AND item_id=?').get(guildId, userId, itemId);
      if (!owned || owned.quantity < 1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne possédez pas cet item.', ephemeral: true });

      // Simple : vente directe au bot contre des coins
      db.db.prepare('DELETE FROM inventaires WHERE guild_id=? AND user_id=? AND item_id=?').run(guildId, userId, itemId);
      db.addCoins(userId, guildId, prix);
      const item = ITEMS_CATALOGUE[itemId] || { emoji:'📦', name: itemId };

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setDescription(`💰 Vous avez vendu **${item.emoji} ${item.name}** pour **${prix} ${coin}** !`)] });
    }

    if (sub === 'lootbox') {
      const qty = parseInt(interaction.options.getString('quantite')) || 1;
      const cost = 50 * qty;
      const u = db.getUser(userId, guildId);
      if ((u.balance || 0) < cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Il faut **${cost} ${coin}** pour ouvrir ${qty} lootbox(es).`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);

      const obtained = {};
      for (let i = 0; i < qty; i++) {
        const itemId = rollLoot();
        if (!obtained[itemId]) obtained[itemId] = 0;
        obtained[itemId]++;
        addItem(userId, guildId, itemId, 1);
      }

      const lines = Object.entries(obtained).map(([id, count]) => {
        const item = ITEMS_CATALOGUE[id];
        return `${item.emoji} **${item.name}** ×${count} *(${item.rarity})*`;
      });

      const hasRare = Object.keys(obtained).some(id => ['Rare','Épique','Légendaire'].includes(ITEMS_CATALOGUE[id]?.rarity));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor(hasRare ? '#F1C40F' : '#3498DB')
        .setTitle(`📦 ${qty} Lootbox${qty > 1 ? 'es' : ''} ouverte${qty > 1 ? 's' : ''} !`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `-${cost} ${coin}` })] });
    }
  }
};
