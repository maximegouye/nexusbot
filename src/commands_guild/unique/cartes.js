/**
 * NexusBot — Système de cartes à collectionner
 * UNIQUE : pack opening, trading, collection, duels, marché
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const CARTES = [
  // Légendes
  { id:'nexus_prime',   name:'⚡ Nexus Prime',      rarity:'mythique',   atk:100,def:80, emoji:'⚡', description:'Le gardien ultime de NexusBot.' },
  { id:'shadow_king',   name:'🌑 Shadow King',       rarity:'mythique',   atk:90, def:90, emoji:'🌑', description:'Roi des ombres, maître de l\'obscurité.' },
  // Légendaires
  { id:'dragon_fire',   name:'🔥 Dragon de Feu',     rarity:'légendaire', atk:80, def:60, emoji:'🔥', description:'Souffle d\'une chaleur infernale.' },
  { id:'angel_light',   name:'👼 Ange de Lumière',   rarity:'légendaire', atk:65, def:85, emoji:'👼', description:'Protecteur sacré des innocents.' },
  { id:'cyber_wolf',    name:'🐺 Loup Cybernétique', rarity:'légendaire', atk:85, def:55, emoji:'🐺', description:'Mi-loup, mi-machine, 100% danger.' },
  // Épiques
  { id:'thunder_hawk',  name:'⚡ Faucon du Tonnerre', rarity:'épique',    atk:65, def:50, emoji:'🦅', description:'Frappe plus vite que l\'éclair.' },
  { id:'ice_queen',     name:'❄️ Reine des Glaces',  rarity:'épique',    atk:55, def:75, emoji:'❄️', description:'Gèle ses ennemis d\'un regard.' },
  { id:'earth_giant',   name:'⛰️ Géant de Terre',   rarity:'épique',    atk:50, def:85, emoji:'⛰️', description:'Aussi solide que la roche.' },
  { id:'storm_mage',    name:'🌩️ Mage des Tempêtes', rarity:'épique',   atk:70, def:45, emoji:'🌩️', description:'Maîtrise les forces de la nature.' },
  // Rares
  { id:'fire_fox',      name:'🦊 Renard Enflammé',   rarity:'rare',      atk:50, def:35, emoji:'🦊', description:'Rusé et rapide comme le vent.' },
  { id:'steel_knight',  name:'⚔️ Chevalier d\'Acier', rarity:'rare',     atk:40, def:55, emoji:'⚔️', description:'Armure impénétrable.' },
  { id:'water_sprite',  name:'💧 Fée de l\'Eau',     rarity:'rare',      atk:45, def:40, emoji:'💧', description:'Soigne ses alliés au combat.' },
  { id:'vine_druid',    name:'🌿 Druide des Lianes',  rarity:'rare',     atk:35, def:50, emoji:'🌿', description:'Contrôle la forêt à sa guise.' },
  // Communs
  { id:'goblin',        name:'👺 Gobelin',            rarity:'commun',    atk:20, def:15, emoji:'👺', description:'Petit mais nombreux.' },
  { id:'skeleton',      name:'💀 Squelette',          rarity:'commun',    atk:25, def:10, emoji:'💀', description:'Revient toujours.' },
  { id:'slime',         name:'🟢 Slime',              rarity:'commun',    atk:10, def:30, emoji:'🟢', description:'Difficile à tuer.' },
  { id:'bat',           name:'🦇 Chauve-souris',      rarity:'commun',    atk:15, def:20, emoji:'🦇', description:'Attaque dans l\'obscurité.' },
  { id:'mushroom',      name:'🍄 Champignon Vénéneux', rarity:'commun',   atk:18, def:18, emoji:'🍄', description:'Sa piqûre empoisonne lentement.' },
];

const RARITY_RATES = { mythique:0.01, légendaire:0.04, épique:0.15, rare:0.30, commun:0.50 };
const RARITY_COLORS = { mythique:'#FF6B35', légendaire:'#FFD700', épique:'#9B59B6', rare:'#3498DB', commun:'#95A5A6' };
const PACK_PRICE = { normal:200, premium:500, mythique:2000 };
const PACK_SIZE = { normal:3, premium:5, mythique:7 };

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS user_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, card_id TEXT,
    quantity INTEGER DEFAULT 1,
    obtained_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id, card_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS card_market (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, seller_id TEXT,
    card_id TEXT, price INTEGER,
    listed_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

function drawCard(packType) {
  const rateBoosts = { premium: { mythique:0.02, légendaire:0.08 }, mythique: { mythique:0.05, légendaire:0.15 } };
  const rolls = [];
  const size = PACK_SIZE[packType] || 3;
  for (let i = 0; i < size; i++) {
    const roll = Math.random();
    let cumul = 0;
    let chosen = null;
    const rates = { ...RARITY_RATES };
    if (rateBoosts[packType]) Object.assign(rates, rateBoosts[packType]);
    for (const [rarity, rate] of Object.entries(rates)) {
      cumul += rate;
      if (roll < cumul) { chosen = rarity; break; }
    }
    const available = CARTES.filter(c => c.rarity === (chosen || 'commun'));
    rolls.push(available[Math.floor(Math.random() * available.length)] || CARTES[CARTES.length-1]);
  }
  return rolls;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cartes')
    .setDescription('🃏 Cartes à collectionner — Ouvrez des packs, tradez, duellez !')
    .addSubcommand(s => s.setName('ouvrir').setDescription('📦 Ouvrir un pack de cartes')
      .addStringOption(o => o.setName('pack').setDescription('Type de pack').setRequired(true)
        .addChoices(
          { name: `📦 Normal (${PACK_PRICE.normal}€ — ${PACK_SIZE.normal} cartes)`, value: 'normal' },
          { name: `💎 Premium (${PACK_PRICE.premium}€ — ${PACK_SIZE.premium} cartes, meilleures chances)`, value: 'premium' },
          { name: `✨ Mythique (${PACK_PRICE.mythique}€ — ${PACK_SIZE.mythique} cartes, chances maximales)`, value: 'mythique' },
        )))
    .addSubcommand(s => s.setName('collection').setDescription('📚 Voir votre collection')
      .addUserOption(o => o.setName('membre').setDescription('Voir la collection d\'un autre')))
    .addSubcommand(s => s.setName('vendre').setDescription('💰 Mettre une carte en vente sur le marché')
      .addStringOption(o => o.setName('carte_id').setDescription('ID de la carte (ex: dragon_fire)').setRequired(true))
      .addIntegerOption(o => o.setName('prix').setDescription('Prix de vente').setRequired(true).setMinValue(1)))
    .addSubcommand(s => s.setName('marche').setDescription('🏪 Voir les cartes en vente'))
    .addSubcommand(s => s.setName('acheter').setDescription('🛒 Acheter une carte sur le marché')
      .addStringOption(o => o.setName('id_annonce').setDescription('ID de l\'annonce').setRequired(true)))
    .addSubcommand(s => s.setName('duel').setDescription('⚔️ Défier quelqu\'un avec votre meilleure carte')
      .addUserOption(o => o.setName('adversaire').setDescription('Adversaire').setRequired(true))
      .addStringOption(o => o.setName('votre_carte').setDescription('ID de votre carte').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';

    if (sub === 'ouvrir') {
      const packType = interaction.options.getString('pack');
      const cost = PACK_PRICE[packType];
      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < cost) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Ce pack coûte **${cost} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -cost);
      const cards = drawCard(packType);

      for (const card of cards) {
        try {
          db.db.prepare('INSERT INTO user_cards (guild_id,user_id,card_id) VALUES(?,?,?) ON CONFLICT(guild_id,user_id,card_id) DO UPDATE SET quantity=quantity+1').run(guildId, userId, card.id);
        } catch {
          db.db.prepare('INSERT OR REPLACE INTO user_cards (guild_id,user_id,card_id,quantity) VALUES(?,?,?,COALESCE((SELECT quantity FROM user_cards WHERE guild_id=? AND user_id=? AND card_id=?),0)+1)').run(guildId, userId, card.id, guildId, userId, card.id);
        }
      }

      const best = cards.reduce((a, b) => (RARITY_RATES[a.rarity] < RARITY_RATES[b.rarity]) ? a : b);
      const desc = cards.map(c => `${c.emoji} **${c.name}** — ${c.rarity} ⚔️${c.atk}/🛡️${c.def}`).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(RARITY_COLORS[best.rarity])
        .setTitle(`📦 Pack ${packType} ouvert !`)
        .setDescription(desc)
        .setFooter({ text: `${cards.length} cartes obtenues • -${cost} ${coin}` })
      ]});
    }

    if (sub === 'collection') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const cards = db.db.prepare('SELECT card_id, quantity FROM user_cards WHERE guild_id=? AND user_id=? ORDER BY quantity DESC').all(guildId, target.id);
      if (!cards.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${target.username}** n'a aucune carte. Ouvrez des packs avec \`/cartes ouvrir\` !`, ephemeral: true });

      const grouped = {};
      for (const row of cards) {
        const cardData = CARTES.find(c => c.id === row.card_id);
        if (!cardData) continue;
        if (!grouped[cardData.rarity]) grouped[cardData.rarity] = [];
        grouped[cardData.rarity].push(`${cardData.emoji} ${cardData.name} ×${row.quantity}`);
      }

      const embed = new EmbedBuilder().setColor('#9B59B6').setTitle(`🃏 Collection de ${target.username}`).setFooter({ text: `${cards.length} types de cartes` });
      for (const [rarity, list] of Object.entries(grouped)) {
        embed.addFields({ name: `${rarity.charAt(0).toUpperCase()+rarity.slice(1)}`, value: list.join('\n').slice(0,1024) });
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'vendre') {
      const cardId = interaction.options.getString('carte_id');
      const prix = interaction.options.getInteger('prix');
      const owned = db.db.prepare('SELECT * FROM user_cards WHERE guild_id=? AND user_id=? AND card_id=?').get(guildId, userId, cardId);
      if (!owned || owned.quantity < 1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous ne possédez pas la carte \`${cardId}\`.`, ephemeral: true });

      db.db.prepare('INSERT INTO card_market (guild_id,seller_id,card_id,price) VALUES(?,?,?,?)').run(guildId, userId, cardId, prix);
      db.db.prepare('UPDATE user_cards SET quantity=quantity-1 WHERE guild_id=? AND user_id=? AND card_id=?').run(guildId, userId, cardId);
      const cardData = CARTES.find(c => c.id === cardId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ **${cardData?.name || cardId}** mise en vente pour **${prix} ${coin}** !` });
    }

    if (sub === 'marche') {
      const listings = db.db.prepare('SELECT cm.*, cm.id as lid FROM card_market cm WHERE cm.guild_id=? ORDER BY cm.listed_at DESC LIMIT 15').all(guildId);
      if (!listings.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune carte en vente en ce moment.', ephemeral: true });
      const desc = listings.map(l => {
        const card = CARTES.find(c => c.id === l.card_id);
        return `**#${l.lid}** ${card?.emoji||'🃏'} **${card?.name||l.card_id}** (${card?.rarity||'?'}) — **${l.price} ${coin}** par <@${l.seller_id}>`;
      }).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🏪 Marché des Cartes').setDescription(desc)] });
    }

    if (sub === 'acheter') {
      const lid = parseInt(interaction.options.getString('id_annonce'));
      const listing = db.db.prepare('SELECT * FROM card_market WHERE id=? AND guild_id=?').get(lid, guildId);
      if (!listing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Annonce introuvable.', ephemeral: true });
      if (listing.seller_id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas acheter votre propre carte.', ephemeral: true });

      const u = db.getUser(userId, guildId);
      if ((u.balance||0) < listing.price) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous avez besoin de **${listing.price} ${coin}**.`, ephemeral: true });

      db.addCoins(userId, guildId, -listing.price);
      db.addCoins(listing.seller_id, guildId, listing.price);
      try {
        db.db.prepare('INSERT INTO user_cards (guild_id,user_id,card_id) VALUES(?,?,?) ON CONFLICT(guild_id,user_id,card_id) DO UPDATE SET quantity=quantity+1').run(guildId, userId, listing.card_id);
      } catch {
        db.db.prepare('INSERT OR REPLACE INTO user_cards (guild_id,user_id,card_id,quantity) VALUES(?,?,?,1)').run(guildId, userId, listing.card_id);
      }
      db.db.prepare('DELETE FROM card_market WHERE id=?').run(lid);

      const card = CARTES.find(c => c.id === listing.card_id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Achat réussi !').setDescription(`Vous avez acheté **${card?.name||listing.card_id}** pour **${listing.price} ${coin}** !`)] });
    }

    if (sub === 'duel') {
      const opponent = interaction.options.getUser('adversaire');
      const myCardId = interaction.options.getString('votre_carte');
      if (opponent.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous défier vous-même.', ephemeral: true });

      const myCard = CARTES.find(c => c.id === myCardId);
      if (!myCard) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Carte \`${myCardId}\` introuvable.`, ephemeral: true });

      const owned = db.db.prepare('SELECT * FROM user_cards WHERE guild_id=? AND user_id=? AND card_id=?').get(guildId, userId, myCardId);
      if (!owned) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne possédez pas cette carte.', ephemeral: true });

      // L'adversaire utilise sa meilleure carte
      const theirCards = db.db.prepare('SELECT card_id FROM user_cards WHERE guild_id=? AND user_id=?').all(guildId, opponent.id);
      if (!theirCards.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ <@${opponent.id}> n'a aucune carte.`, ephemeral: true });

      const theirBest = theirCards.map(r => CARTES.find(c => c.id === r.card_id)).filter(Boolean).sort((a,b) => (b.atk+b.def) - (a.atk+a.def))[0];
      if (!theirBest) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de trouver la carte adverse.', ephemeral: true });

      const myScore = myCard.atk + myCard.def + Math.floor(Math.random()*30);
      const theirScore = theirBest.atk + theirBest.def + Math.floor(Math.random()*30);
      const iWin = myScore >= theirScore;
      const cfg = db.getConfig(guildId);
      const reward = 250;
      if (iWin) db.addCoins(userId, guildId, reward);
      else db.addCoins(opponent.id, guildId, reward);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor(iWin ? '#2ECC71' : '#E74C3C')
        .setTitle(`⚔️ Duel de Cartes`)
        .addFields(
          { name: `${myCard.emoji} ${myCard.name} (<@${userId}>)`, value: `Score: **${myScore}**`, inline: true },
          { name: `${theirBest.emoji} ${theirBest.name} (<@${opponent.id}>)`, value: `Score: **${theirScore}**`, inline: true },
          { name: '🏆 Résultat', value: iWin ? `<@${userId}> gagne +${reward} ${coin} !` : `<@${opponent.id}> gagne +${reward} ${coin} !`, inline: false },
        )
      ]});
    }
  }
};
