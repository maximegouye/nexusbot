// ============================================================
// /immobilier — Système de propriétés & véhicules collectibles
// ============================================================
// Achat de biens immobiliers et véhicules. Chaque propriété
// rapporte un loyer passif. Chaque véhicule = prestige + bonus.
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ─── Init table ──────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS properties (
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    prop_id   TEXT NOT NULL,
    purchased_at INTEGER NOT NULL,
    last_collected INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id, prop_id)
  )`).run();
} catch {}

// ─── Catalogue propriétés (loyer = revenu passif horaire) ──
const PROPERTIES = [
  // Logements (génèrent loyer)
  { id: 'studio',     emoji: '🏠', name: 'Studio',          type: 'house',  cost: 50000,    income: 500,   desc: 'Petit appart cosy. +500€/h.' },
  { id: 'apt',        emoji: '🏢', name: 'Appartement',     type: 'house',  cost: 250000,   income: 2500,  desc: 'Grand appart en ville. +2500€/h.' },
  { id: 'house',      emoji: '🏡', name: 'Maison',          type: 'house',  cost: 750000,   income: 8000,  desc: 'Maison familiale. +8000€/h.' },
  { id: 'villa',      emoji: '🏘️', name: 'Villa',           type: 'house',  cost: 2500000,  income: 30000, desc: 'Villa avec piscine. +30 000€/h.' },
  { id: 'mansion',    emoji: '🏛️', name: 'Manoir',          type: 'house',  cost: 10000000, income: 130000,desc: 'Manoir luxueux. +130 000€/h.' },
  { id: 'castle',     emoji: '🏰', name: 'Château',         type: 'house',  cost: 50000000, income: 700000,desc: 'Château historique. +700 000€/h.' },

  // Véhicules (prestige + petit bonus)
  { id: 'bike',       emoji: '🚲', name: 'Vélo',            type: 'vehicle',cost: 5000,     income: 50,    desc: 'Premier transport. +50€/h.' },
  { id: 'scooter',    emoji: '🛵', name: 'Scooter',         type: 'vehicle',cost: 25000,    income: 200,   desc: 'Pratique en ville.' },
  { id: 'car',        emoji: '🚗', name: 'Voiture',         type: 'vehicle',cost: 100000,   income: 800,   desc: 'Tu roules en ville.' },
  { id: 'sportcar',   emoji: '🏎️', name: 'Voiture de sport',type: 'vehicle',cost: 500000,   income: 4000,  desc: 'Tu fais tourner les têtes.' },
  { id: 'limo',       emoji: '🚘', name: 'Limousine',       type: 'vehicle',cost: 1500000,  income: 12000, desc: 'Le luxe sur 4 roues.' },
  { id: 'boat',       emoji: '🛥️', name: 'Yacht',           type: 'vehicle',cost: 5000000,  income: 50000, desc: 'Vacances en mer.' },
  { id: 'jet',        emoji: '✈️', name: 'Jet privé',       type: 'vehicle',cost: 25000000, income: 300000,desc: 'Tu voles haut.' },
  { id: 'rocket',     emoji: '🚀', name: 'Fusée',           type: 'vehicle',cost: 100000000,income: 1500000,desc: 'Vers Mars et au-delà.' },
];
const PROP_MAP = Object.fromEntries(PROPERTIES.map(p => [p.id, p]));

function getCoin(guildId) {
  try { return db.getConfig(guildId)?.currency_emoji || '€'; } catch { return '€'; }
}

function getUserProperties(userId, guildId) {
  return db.db.prepare('SELECT * FROM properties WHERE user_id=? AND guild_id=?').all(userId, guildId);
}

function calcIncome(prop) {
  const def = PROP_MAP[prop.prop_id];
  if (!def) return 0;
  const now = Math.floor(Date.now() / 1000);
  const sec = Math.max(0, now - (prop.last_collected || prop.purchased_at));
  // Cap 24h pour éviter abus longue absence
  const hours = Math.min(24, sec / 3600);
  return Math.floor(def.income * hours);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('immobilier')
    .setDescription('🏠 Achète des propriétés et véhicules — revenus passifs')
    .addSubcommand(s => s.setName('catalogue').setDescription('📋 Voir le catalogue'))
    .addSubcommand(s => s.setName('mes-biens').setDescription('🏠 Voir tes propriétés'))
    .addSubcommand(s => s.setName('acheter').setDescription('💰 Acheter une propriété')
      .addStringOption(o => o.setName('bien').setDescription('Le bien').setRequired(true)
        .addChoices(...PROPERTIES.slice(0, 25).map(p => ({ name: `${p.emoji} ${p.name} (${p.cost.toLocaleString('fr-FR')}€)`, value: p.id })))))
    .addSubcommand(s => s.setName('collecter').setDescription('💵 Collecter loyers et revenus passifs'))
    .addSubcommand(s => s.setName('vendre').setDescription('🏷️ Revendre une propriété (à 70% du prix)')
      .addStringOption(o => o.setName('bien').setDescription('Le bien').setRequired(true)
        .addChoices(...PROPERTIES.slice(0, 25).map(p => ({ name: `${p.emoji} ${p.name}`, value: p.id })))))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 10 magnats')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const coin = getCoin(guildId);

    if (sub === 'catalogue') {
      const lines = ['**🏘️ Logements** (loyer passif)'];
      for (const p of PROPERTIES.filter(x => x.type === 'house')) {
        lines.push(`${p.emoji} **${p.name}** — ${p.cost.toLocaleString('fr-FR')} ${coin} (${p.income.toLocaleString('fr-FR')} ${coin}/h)`);
      }
      lines.push('\n**🚗 Véhicules**');
      for (const p of PROPERTIES.filter(x => x.type === 'vehicle')) {
        lines.push(`${p.emoji} **${p.name}** — ${p.cost.toLocaleString('fr-FR')} ${coin}`);
      }
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('🏠 Catalogue Immobilier & Véhicules')
          .setDescription(lines.join('\n')).setFooter({ text: 'Achète avec /immobilier acheter' })
      ] });
    }

    if (sub === 'mes-biens') {
      const props = getUserProperties(userId, guildId);
      if (!props.length) return interaction.editReply({ content: '🏠 Tu n\'as encore aucun bien. Utilise `/immobilier catalogue` !' });
      const lines = props.map(p => {
        const def = PROP_MAP[p.prop_id];
        if (!def) return null;
        const inc = calcIncome(p);
        return `${def.emoji} **${def.name}** — À collecter : **${inc.toLocaleString('fr-FR')} ${coin}**`;
      }).filter(Boolean).join('\n');
      const totalValue = props.reduce((s, p) => s + (PROP_MAP[p.prop_id]?.cost || 0), 0);
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle(`🏠 Tes biens (${props.length})`)
          .setDescription(lines)
          .setFooter({ text: `Patrimoine total : ${totalValue.toLocaleString('fr-FR')} ${coin}` })
      ] });
    }

    if (sub === 'acheter') {
      const propId = interaction.options.getString('bien');
      const def = PROP_MAP[propId];
      if (!def) return interaction.editReply({ content: '❌ Bien inconnu.' });
      const existing = db.db.prepare('SELECT 1 FROM properties WHERE user_id=? AND guild_id=? AND prop_id=?').get(userId, guildId, propId);
      if (existing) return interaction.editReply({ content: `❌ Tu possèdes déjà ${def.emoji} ${def.name}.` });
      const u = db.getUser(userId, guildId);
      if ((u?.balance || 0) < def.cost) return interaction.editReply({ content: `❌ Il te faut **${def.cost.toLocaleString('fr-FR')} ${coin}**.` });
      db.removeCoins(userId, guildId, def.cost);
      const now = Math.floor(Date.now() / 1000);
      db.db.prepare('INSERT INTO properties (user_id, guild_id, prop_id, purchased_at, last_collected) VALUES (?, ?, ?, ?, ?)')
        .run(userId, guildId, propId, now, now);
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle(`🎉 Achat réussi !`)
          .setDescription(`Tu as acheté ${def.emoji} **${def.name}** pour **${def.cost.toLocaleString('fr-FR')} ${coin}**.\n${def.desc}`)
      ] });
    }

    if (sub === 'collecter') {
      const props = getUserProperties(userId, guildId);
      if (!props.length) return interaction.editReply({ content: '❌ Tu n\'as pas de bien à collecter.' });
      let total = 0;
      const now = Math.floor(Date.now() / 1000);
      for (const p of props) {
        const inc = calcIncome(p);
        if (inc > 0) {
          total += inc;
          db.db.prepare('UPDATE properties SET last_collected=? WHERE user_id=? AND guild_id=? AND prop_id=?')
            .run(now, userId, guildId, p.prop_id);
        }
      }
      if (total === 0) return interaction.editReply({ content: '⏳ Reviens plus tard, tes biens n\'ont pas encore généré de revenus.' });
      db.addCoins(userId, guildId, total, { type: 'property_income', note: 'Loyers passifs' });
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('💰 Loyers collectés !')
          .setDescription(`Tes biens t'ont rapporté **${total.toLocaleString('fr-FR')} ${coin}** !`)
      ] });
    }

    if (sub === 'vendre') {
      const propId = interaction.options.getString('bien');
      const def = PROP_MAP[propId];
      const existing = db.db.prepare('SELECT 1 FROM properties WHERE user_id=? AND guild_id=? AND prop_id=?').get(userId, guildId, propId);
      if (!existing) return interaction.editReply({ content: '❌ Tu ne possèdes pas ce bien.' });
      const refund = Math.floor(def.cost * 0.7);
      db.addCoins(userId, guildId, refund);
      db.db.prepare('DELETE FROM properties WHERE user_id=? AND guild_id=? AND prop_id=?').run(userId, guildId, propId);
      return interaction.editReply({ content: `✅ Tu as vendu ${def.emoji} ${def.name} pour **${refund.toLocaleString('fr-FR')} ${coin}** (70% du prix).` });
    }

    if (sub === 'top') {
      const rows = db.db.prepare(
        'SELECT user_id, COUNT(*) as c FROM properties WHERE guild_id=? GROUP BY user_id ORDER BY c DESC LIMIT 10'
      ).all(guildId);
      if (!rows.length) return interaction.editReply({ content: '🏆 Personne n\'a encore acheté de bien.' });
      const lines = rows.map((r, i) => `${['🥇','🥈','🥉'][i] || `**${i+1}.**`} <@${r.user_id}> — **${r.c}** bien(s)`).join('\n');
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Magnats').setDescription(lines)
      ] });
    }
  },
};
