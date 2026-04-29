// ============================================================
// /pet — Système de compagnons (pets) avec bonus passifs
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Init table ──────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS pets (
    user_id      TEXT NOT NULL,
    guild_id     TEXT NOT NULL,
    pet_id       TEXT NOT NULL,
    name         TEXT,
    level        INTEGER DEFAULT 1,
    xp           INTEGER DEFAULT 0,
    happiness    INTEGER DEFAULT 100,
    hunger       INTEGER DEFAULT 100,
    last_fed     INTEGER DEFAULT 0,
    last_played  INTEGER DEFAULT 0,
    last_collected INTEGER DEFAULT 0,
    adopted_at   INTEGER NOT NULL,
    PRIMARY KEY(user_id, guild_id, pet_id)
  )`).run();
} catch {}

// ─── Catalogue des pets ──────────────────────────────────
const PETS = [
  { id: 'cat',      emoji: '🐱', name: 'Chat',          rarity: 'common',    cost: 5000,    income: 100,  desc: 'Calme et indépendant. Bonus +100€/h.' },
  { id: 'dog',      emoji: '🐶', name: 'Chien',         rarity: 'common',    cost: 5000,    income: 100,  desc: 'Loyal et joyeux. Bonus +100€/h.' },
  { id: 'rabbit',   emoji: '🐰', name: 'Lapin',         rarity: 'common',    cost: 7500,    income: 150,  desc: 'Mignon et rapide. Bonus +150€/h.' },
  { id: 'fox',      emoji: '🦊', name: 'Renard',        rarity: 'uncommon',  cost: 25000,   income: 400,  desc: 'Rusé et agile. Bonus +400€/h.' },
  { id: 'panda',    emoji: '🐼', name: 'Panda',         rarity: 'uncommon',  cost: 35000,   income: 500,  desc: 'Doux et apaisant. Bonus +500€/h.' },
  { id: 'tiger',    emoji: '🐯', name: 'Tigre',         rarity: 'rare',      cost: 100000,  income: 1500, desc: 'Puissant et fier. Bonus +1500€/h.' },
  { id: 'lion',     emoji: '🦁', name: 'Lion',          rarity: 'rare',      cost: 150000,  income: 2000, desc: 'Roi des animaux. Bonus +2000€/h.' },
  { id: 'unicorn',  emoji: '🦄', name: 'Licorne',       rarity: 'epic',      cost: 500000,  income: 7500, desc: 'Magique et rare. Bonus +7500€/h.' },
  { id: 'dragon',   emoji: '🐉', name: 'Dragon',        rarity: 'legendary', cost: 2000000, income: 30000,desc: 'Légendaire. Bonus +30 000€/h.' },
  { id: 'phoenix',  emoji: '🔥', name: 'Phénix',        rarity: 'legendary', cost: 3000000, income: 45000,desc: 'Immortel. Bonus +45 000€/h.' },
];
const PET_MAP = Object.fromEntries(PETS.map(p => [p.id, p]));

const RARITY_COLOR = {
  common: '#95A5A6', uncommon: '#2ECC71', rare: '#3498DB', epic: '#9B59B6', legendary: '#F1C40F'
};
const RARITY_LABEL = {
  common: 'Commun', uncommon: 'Peu commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire'
};

// ─── Helpers ─────────────────────────────────────────────
function getCurrencyEmoji(guildId) {
  try { return db.getConfig(guildId)?.currency_emoji || '€'; } catch { return '€'; }
}

function getUserPets(userId, guildId) {
  return db.db.prepare('SELECT * FROM pets WHERE user_id=? AND guild_id=?').all(userId, guildId);
}

function getPet(userId, guildId, petId) {
  return db.db.prepare('SELECT * FROM pets WHERE user_id=? AND guild_id=? AND pet_id=?').get(userId, guildId, petId);
}

function adoptPet(userId, guildId, petId, customName = null) {
  const def = PET_MAP[petId];
  if (!def) return { ok: false, reason: 'Pet inconnu.' };
  const existing = getPet(userId, guildId, petId);
  if (existing) return { ok: false, reason: `Tu as déjà un ${def.name}.` };
  const u = db.getUser(userId, guildId);
  if ((u?.balance || 0) < def.cost) return { ok: false, reason: `Il te faut **${def.cost.toLocaleString('fr-FR')}** pour adopter ${def.emoji} ${def.name}.` };

  db.removeCoins(userId, guildId, def.cost);
  const now = Math.floor(Date.now() / 1000);
  db.db.prepare(`INSERT INTO pets (user_id, guild_id, pet_id, name, level, xp, happiness, hunger, last_fed, last_played, last_collected, adopted_at)
    VALUES (?, ?, ?, ?, 1, 0, 100, 100, ?, ?, ?, ?)`)
    .run(userId, guildId, petId, customName || def.name, now, now, now, now);
  return { ok: true, pet: def };
}

function calcCollectibleIncome(pet) {
  const def = PET_MAP[pet.pet_id];
  if (!def) return 0;
  const now = Math.floor(Date.now() / 1000);
  const sec = Math.max(0, now - (pet.last_collected || pet.adopted_at));
  const hours = Math.min(24, sec / 3600); // cap à 24h pour éviter abus longue absence
  // Bonus en fonction de level + happiness
  const happMult = 0.5 + (pet.happiness / 200); // 0.5x si triste, 1x si heureux
  const lvlMult  = 1 + ((pet.level - 1) * 0.1);  // +10% par level
  return Math.floor(def.income * hours * happMult * lvlMult);
}

// ─── Commande ────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('🐾 Adopte un compagnon qui te rapporte des coins passivement')
    .addSubcommand(s => s.setName('catalogue').setDescription('📋 Voir tous les pets adoptables'))
    .addSubcommand(s => s.setName('mes-pets').setDescription('🐾 Voir tes pets'))
    .addSubcommand(s => s.setName('adopter').setDescription('💝 Adopter un pet')
      .addStringOption(o => o.setName('pet').setDescription('Le pet à adopter').setRequired(true)
        .addChoices(...PETS.map(p => ({ name: `${p.emoji} ${p.name} (${p.cost.toLocaleString('fr-FR')}€)`, value: p.id })))))
    .addSubcommand(s => s.setName('collecter').setDescription('💰 Collecter les revenus passifs de tes pets'))
    .addSubcommand(s => s.setName('nourrir').setDescription('🍖 Nourrir un pet (restaure faim, +XP)')
      .addStringOption(o => o.setName('pet').setDescription('Lequel').setRequired(true)
        .addChoices(...PETS.map(p => ({ name: `${p.emoji} ${p.name}`, value: p.id })))))
    .addSubcommand(s => s.setName('jouer').setDescription('🎾 Jouer avec un pet (restaure bonheur, +XP)')
      .addStringOption(o => o.setName('pet').setDescription('Lequel').setRequired(true)
        .addChoices(...PETS.map(p => ({ name: `${p.emoji} ${p.name}`, value: p.id })))))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top 10 des dresseurs')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const coin = getCurrencyEmoji(guildId);

    // ── Catalogue ──
    if (sub === 'catalogue') {
      const desc = PETS.map(p => `${p.emoji} **${p.name}** (${RARITY_LABEL[p.rarity]}) — ${p.cost.toLocaleString('fr-FR')} ${coin}\n*${p.desc}*`).join('\n\n');
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🐾 Catalogue des Pets')
        .setDescription(desc)
        .setFooter({ text: 'Achète avec /pet adopter • Collecte les revenus avec /pet collecter' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── Mes pets ──
    if (sub === 'mes-pets') {
      const pets = getUserPets(userId, guildId);
      if (!pets.length) {
        return interaction.editReply({ content: '🐾 Tu n\'as pas encore de pet ! Utilise `/pet catalogue` puis `/pet adopter`.' });
      }
      const lines = pets.map(p => {
        const def = PET_MAP[p.pet_id];
        if (!def) return null;
        const inc = calcCollectibleIncome(p);
        return `${def.emoji} **${p.name}** (${RARITY_LABEL[def.rarity]}) — Niv. ${p.level}\n` +
               `💰 À collecter : **${inc.toLocaleString('fr-FR')} ${coin}** | ❤️ Bonheur : ${p.happiness}/100 | 🍖 Faim : ${p.hunger}/100`;
      }).filter(Boolean).join('\n\n');

      const embed = new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`🐾 Tes pets (${pets.length})`)
        .setDescription(lines || '*Aucun pet*')
        .setFooter({ text: 'Nourris-les et joue avec eux pour booster leurs revenus !' });
      return interaction.editReply({ embeds: [embed] });
    }

    // ── Adopter ──
    if (sub === 'adopter') {
      const petId = interaction.options.getString('pet');
      const result = adoptPet(userId, guildId, petId);
      if (!result.ok) return interaction.editReply({ content: `❌ ${result.reason}` });
      const def = result.pet;
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor(RARITY_COLOR[def.rarity])
          .setTitle(`🎉 Tu as adopté ${def.emoji} ${def.name} !`)
          .setDescription(`${def.desc}\n\n💰 Tu peux collecter ses revenus avec \`/pet collecter\`\n🍖 Nourris-le avec \`/pet nourrir\`\n🎾 Joue avec lui via \`/pet jouer\``)
          .setFooter({ text: `Coût : ${def.cost.toLocaleString('fr-FR')} ${coin}` })
      ] });
    }

    // ── Collecter revenus passifs ──
    if (sub === 'collecter') {
      const pets = getUserPets(userId, guildId);
      if (!pets.length) return interaction.editReply({ content: '❌ Tu n\'as pas de pet à faire travailler.' });
      let total = 0;
      const now = Math.floor(Date.now() / 1000);
      for (const p of pets) {
        const inc = calcCollectibleIncome(p);
        if (inc > 0) {
          total += inc;
          db.db.prepare('UPDATE pets SET last_collected=? WHERE user_id=? AND guild_id=? AND pet_id=?')
            .run(now, userId, guildId, p.pet_id);
        }
      }
      if (total === 0) return interaction.editReply({ content: '⏳ Tes pets n\'ont rien produit pour l\'instant. Reviens dans une heure !' });
      db.addCoins(userId, guildId, total, { type: 'pet_income', note: 'Revenus passifs des pets' });
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71')
          .setTitle('💰 Revenus collectés !')
          .setDescription(`Tes pets ont travaillé dur. Tu reçois **${total.toLocaleString('fr-FR')} ${coin}** !`)
          .setFooter({ text: 'Reviens dans 1h pour collecter encore plus.' })
      ] });
    }

    // ── Nourrir ──
    if (sub === 'nourrir') {
      const petId = interaction.options.getString('pet');
      const pet = getPet(userId, guildId, petId);
      if (!pet) return interaction.editReply({ content: '❌ Tu n\'as pas ce pet.' });
      const cost = 200;
      const u = db.getUser(userId, guildId);
      if ((u?.balance || 0) < cost) return interaction.editReply({ content: `❌ Il te faut ${cost} ${coin} pour nourrir.` });
      db.removeCoins(userId, guildId, cost);
      const newHunger = Math.min(100, pet.hunger + 30);
      const newXp = pet.xp + 10;
      const newLevel = newXp >= pet.level * 100 ? pet.level + 1 : pet.level;
      const newXpAfter = newLevel > pet.level ? 0 : newXp;
      db.db.prepare('UPDATE pets SET hunger=?, xp=?, level=?, last_fed=? WHERE user_id=? AND guild_id=? AND pet_id=?')
        .run(newHunger, newXpAfter, newLevel, Math.floor(Date.now() / 1000), userId, guildId, petId);
      const def = PET_MAP[petId];
      const lvlUp = newLevel > pet.level ? `\n🎉 **${def.name} est passé au niveau ${newLevel} !**` : '';
      return interaction.editReply({ content: `🍖 Tu as nourri ${def.emoji} ${pet.name}. Faim ${pet.hunger} → ${newHunger}.${lvlUp}` });
    }

    // ── Jouer ──
    if (sub === 'jouer') {
      const petId = interaction.options.getString('pet');
      const pet = getPet(userId, guildId, petId);
      if (!pet) return interaction.editReply({ content: '❌ Tu n\'as pas ce pet.' });
      const newHapp = Math.min(100, pet.happiness + 25);
      const newXp = pet.xp + 15;
      const newLevel = newXp >= pet.level * 100 ? pet.level + 1 : pet.level;
      const newXpAfter = newLevel > pet.level ? 0 : newXp;
      db.db.prepare('UPDATE pets SET happiness=?, xp=?, level=?, last_played=? WHERE user_id=? AND guild_id=? AND pet_id=?')
        .run(newHapp, newXpAfter, newLevel, Math.floor(Date.now() / 1000), userId, guildId, petId);
      const def = PET_MAP[petId];
      const lvlUp = newLevel > pet.level ? `\n🎉 **${def.name} est passé au niveau ${newLevel} !**` : '';
      return interaction.editReply({ content: `🎾 Tu as joué avec ${def.emoji} ${pet.name}. Bonheur ${pet.happiness} → ${newHapp}.${lvlUp}` });
    }

    // ── Top dresseurs ──
    if (sub === 'top') {
      const rows = db.db.prepare('SELECT user_id, COUNT(*) as c FROM pets WHERE guild_id=? GROUP BY user_id ORDER BY c DESC LIMIT 10').all(guildId);
      if (!rows.length) return interaction.editReply({ content: '🏆 Personne n\'a encore adopté de pet.' });
      const lines = rows.map((r, i) => {
        const medal = ['🥇','🥈','🥉'][i] || `**${i+1}.**`;
        return `${medal} <@${r.user_id}> — **${r.c}** pet(s)`;
      }).join('\n');
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🏆 Top Dresseurs').setDescription(lines)
      ] });
    }
  },
};
