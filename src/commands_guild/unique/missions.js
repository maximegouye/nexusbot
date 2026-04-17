/**
 * NexusBot — Système de Missions Quotidiennes
 * /missions — 3 missions aléatoires chaque jour, bonus si toutes complétées
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ─────────────────────────────────────────────────────────────────
// TABLE & MIGRATIONS
// ─────────────────────────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS daily_missions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL,
    mission_day TEXT NOT NULL,
    missions    TEXT NOT NULL DEFAULT '[]',
    completed   INTEGER NOT NULL DEFAULT 0,
    bonus_given INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─────────────────────────────────────────────────────────────────
// POOL DE MISSIONS
// ─────────────────────────────────────────────────────────────────
const MISSION_POOL = [
  { id: 'earn_coins',  label: '💰 Gagnant',       desc: 'Gagne 500 coins (travail, pêche, etc.)',      type: 'earn_coins',  target: 500,   reward: 150 },
  { id: 'earn_coins2', label: '💸 Investisseur',   desc: 'Gagne 1 000 coins en tout',                   type: 'earn_coins',  target: 1000,  reward: 300 },
  { id: 'messages',   label: '💬 Bavard',           desc: 'Envoie 10 messages dans le serveur',          type: 'messages',    target: 10,    reward: 100 },
  { id: 'messages2',  label: '🗣️ Verbeux',         desc: 'Envoie 25 messages dans le serveur',          type: 'messages',    target: 25,    reward: 200 },
  { id: 'use_cmd',    label: '⚡ Joueur',           desc: 'Utilise 5 commandes différentes',              type: 'use_cmd',     target: 5,     reward: 120 },
  { id: 'use_cmd2',   label: '🎮 Pro',              desc: 'Utilise 10 commandes différentes',             type: 'use_cmd',     target: 10,    reward: 250 },
  { id: 'daily',      label: '📅 Assidu',           desc: 'Récupère ta récompense /daily',                type: 'daily',       target: 1,     reward: 80  },
  { id: 'work',       label: '🛠️ Travailleur',     desc: 'Utilise /work 2 fois',                         type: 'work',        target: 2,     reward: 100 },
  { id: 'fish',       label: '🎣 Pêcheur',          desc: 'Pêche 3 fois avec /peche',                    type: 'fish',        target: 3,     reward: 130 },
  { id: 'voice',      label: '🎙️ Vocal',           desc: 'Reste 30 min en vocal',                       type: 'voice_min',   target: 30,    reward: 200 },
  { id: 'voice2',     label: '🎤 Streamer',         desc: 'Reste 1h en vocal',                           type: 'voice_min',   target: 60,    reward: 350 },
  { id: 'quiz',       label: '🧠 Érudit',           desc: 'Réponds à 1 question de quiz',                type: 'quiz',        target: 1,     reward: 150 },
  { id: 'duel',       label: '⚔️ Combattant',      desc: 'Joue un duel',                                 type: 'duel',        target: 1,     reward: 200 },
  { id: 'reputation', label: '⭐ Réputation',       desc: 'Reçois 1 point de réputation',                type: 'rep',         target: 1,     reward: 100 },
  { id: 'blackjack',  label: '🃏 Croupier',         desc: 'Joue 2 parties de blackjack',                 type: 'blackjack',   target: 2,     reward: 180 },
];

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

/** Clé du jour courant (ex: "2024-12-25") */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Sélectionner 3 missions aléatoires non dupliquées */
function pickMissions(seed) {
  const pool = [...MISSION_POOL];
  const result = [];
  const rng = mulberry32(seed);
  while (result.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    result.push({ ...pool[idx], progress: 0, done: false });
    pool.splice(idx, 1);
  }
  return result;
}

/** Petit PRNG déterministe pour que les missions du même jour soient cohérentes */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Charger ou créer les missions du jour pour un utilisateur */
function getDayMissions(userId, guildId) {
  const day = todayKey();
  let row = db.db.prepare('SELECT * FROM daily_missions WHERE user_id=? AND guild_id=? AND mission_day=?').get(userId, guildId, day);
  if (!row) {
    // Seed basé sur userId + date pour que chaque joueur ait ses propres missions
    const seed = parseInt(userId.slice(-6), 16) ^ parseInt(day.replace(/-/g, ''), 10);
    const missions = pickMissions(seed);
    db.db.prepare('INSERT INTO daily_missions (user_id, guild_id, mission_day, missions) VALUES (?,?,?,?)').run(userId, guildId, day, JSON.stringify(missions));
    row = db.db.prepare('SELECT * FROM daily_missions WHERE user_id=? AND guild_id=? AND mission_day=?').get(userId, guildId, day);
  }
  row.missionsData = JSON.parse(row.missions);
  return row;
}

/** Incrémenter le progrès d'une mission par type */
function progressMission(userId, guildId, type, amount = 1) {
  const row = getDayMissions(userId, guildId);
  const missions = row.missionsData;
  let changed = false;

  for (const m of missions) {
    if (m.type === type && !m.done) {
      m.progress = Math.min(m.target, (m.progress || 0) + amount);
      if (m.progress >= m.target) {
        m.done = true;
        // Donner la récompense immédiatement
        db.addCoins(userId, guildId, m.reward);
      }
      changed = true;
    }
  }

  if (changed) {
    const allDone = missions.every(m => m.done);
    db.db.prepare('UPDATE daily_missions SET missions=?, completed=? WHERE user_id=? AND guild_id=? AND mission_day=?')
      .run(JSON.stringify(missions), allDone ? 1 : 0, userId, guildId, todayKey());

    // Bonus complétionniste si toutes faites et pas encore donné
    if (allDone && !row.bonus_given) {
      const bonus = 500;
      db.addCoins(userId, guildId, bonus);
      db.db.prepare('UPDATE daily_missions SET bonus_given=1 WHERE user_id=? AND guild_id=? AND mission_day=?').run(userId, guildId, todayKey());
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS (pour que les autres commandes puissent tracker)
// ─────────────────────────────────────────────────────────────────
module.exports.progressMission = progressMission;
module.exports.getDayMissions  = getDayMissions;

// ─────────────────────────────────────────────────────────────────
// COMMANDE
// ─────────────────────────────────────────────────────────────────
module.exports.data = new SlashCommandBuilder()
  .setName('missions')
  .setDescription('📋 Tes missions quotidiennes')
  .addSubcommand(s => s.setName('voir').setDescription('📋 Voir tes missions du jour'))
  .addSubcommand(s => s.setName('stats').setDescription('📊 Tes stats de missions (global)'));

module.exports.cooldown = 3;

module.exports.execute = async function execute(interaction) {
  await interaction.deferReply({ ephemeral: false });
  const sub    = interaction.options.getSubcommand();
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;
  const cfg     = db.getConfig(guildId);
  const coin    = cfg.currency_emoji || '🪙';

  if (sub === 'voir') {
    const row      = getDayMissions(userId, guildId);
    const missions = row.missionsData;
    const done     = missions.filter(m => m.done).length;
    const totalReward = missions.reduce((a, m) => a + m.reward, 0);

    const embed = new EmbedBuilder()
      .setColor(done === 3 ? '#2ecc71' : cfg.color || '#7B2FBE')
      .setTitle('📋 Missions Quotidiennes')
      .setDescription(
        done === 3
          ? `✅ **Toutes les missions complétées !** Tu as reçu un bonus de **500 ${coin}** !`
          : `Complete tes 3 missions du jour pour un bonus de **500 ${coin}** !\nRécompense totale possible : **${totalReward + 500} ${coin}**`
      )
      .setFooter({ text: `Réinitialisé à minuit • ${new Date().toLocaleDateString('fr-FR')}` });

    for (const m of missions) {
      const progress = m.progress || 0;
      const bar = buildBar(progress, m.target);
      const status = m.done ? '✅' : '🔸';
      embed.addFields({
        name: `${status} ${m.label} — ${m.done ? 'TERMINÉ' : `${progress}/${m.target}`}`,
        value: `*${m.desc}*\n${bar}\n🎁 Récompense : **${m.reward} ${coin}**`,
        inline: false,
      });
    }

    embed.addFields({
      name: '📊 Progression',
      value: `${done}/3 missions complétées ${done === 3 ? '🏆' : ''}`,
      inline: true,
    });

    return interaction.editReply({ embeds: [embed] });
  }

  if (sub === 'stats') {
    const totalDays  = db.db.prepare("SELECT COUNT(*) as c FROM daily_missions WHERE user_id=? AND guild_id=?").get(userId, guildId).c;
    const fullDays   = db.db.prepare("SELECT COUNT(*) as c FROM daily_missions WHERE user_id=? AND guild_id=? AND completed=1").get(userId, guildId).c;
    const bonusTotal = fullDays * 500;

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle('📊 Statistiques de Missions')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: '📅 Jours de missions',     value: `**${totalDays}**`,                     inline: true },
        { name: '🏆 Jours complets',        value: `**${fullDays}**`,                      inline: true },
        { name: `💰 Bonus bonus gagnés`,    value: `**${bonusTotal.toLocaleString('fr')} ${coin}**`, inline: true },
        { name: '📈 Taux de complétion',    value: totalDays > 0 ? `**${Math.round(fullDays / totalDays * 100)}%**` : 'N/A', inline: true },
      );

    return interaction.editReply({ embeds: [embed] });
  }
};

/** Barre de progression textuelle */
function buildBar(current, max, length = 10) {
  const filled = Math.round((current / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled) + ` ${current}/${max}`;
}
