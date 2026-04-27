/**
 * NexusBot — Worker pour le classement hebdomadaire
 *
 * Poste automatiquement un classement chaque dimanche à 20h00 (heure locale).
 * Utilise setInterval pour vérifier l'heure chaque minute.
 *
 * Affiche:
 * - Top 5 Économie (balance + bank)
 * - Top 5 XP
 * - Top 5 Casino (biggest_win)
 *
 * Appelé depuis src/index.js au démarrage avec `startWeeklyLeaderboard(client)`.
 */

const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

let lastPostedWeek = -1; // Garde trace du dernier post (numéro de semaine)

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function checkAndPostLeaderboard(client) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi, etc.
  const hour = now.getHours();
  const minutes = now.getMinutes();

  // Vérifier: dimanche (0) à 20h00
  if (dayOfWeek !== 0 || hour !== 20 || minutes !== 0) {
    return;
  }

  // Éviter de poster plusieurs fois la même semaine
  const weekNum = getWeekNumber(now);
  if (lastPostedWeek === weekNum) {
    return;
  }

  lastPostedWeek = weekNum;

  // Récupérer tous les guilds avec un canal de classement configuré
  let guilds = [];
  try {
    guilds = db.db.prepare(`
      SELECT guild_id, leaderboard_channel FROM guild_config
      WHERE leaderboard_channel IS NOT NULL AND leaderboard_channel != ''
    `).all();

    // Fallback: utiliser welcome_channel si leaderboard_channel n'existe pas
    if (guilds.length === 0) {
      guilds = db.db.prepare(`
        SELECT guild_id, welcome_channel as leaderboard_channel FROM guild_config
        WHERE welcome_channel IS NOT NULL AND welcome_channel != ''
      `).all();
    }
  } catch (err) {
    console.error('[WeeklyLeaderboard] Erreur lecture config:', err.message);
    return;
  }

  for (const cfg of guilds) {
    try {
      const guild = client.guilds.cache.get(cfg.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.leaderboard_channel);
      if (!channel || !channel.isTextBased()) continue;

      // Récupérer Top 5 Économie
      const topEco = db.db.prepare(`
        SELECT user_id, (balance + bank) as total
        FROM users
        WHERE guild_id = ?
        ORDER BY total DESC
        LIMIT 5
      `).all(cfg.guild_id);

      // Récupérer Top 5 XP
      const topXp = db.db.prepare(`
        SELECT user_id, xp, level
        FROM users
        WHERE guild_id = ?
        ORDER BY xp DESC
        LIMIT 5
      `).all(cfg.guild_id);

      // Récupérer Top 5 Casino
      const topCasino = db.db.prepare(`
        SELECT user_id, total_bet, biggest_win
        FROM game_stats
        WHERE guild_id = ?
        ORDER BY biggest_win DESC
        LIMIT 5
      `).all(cfg.guild_id);

      // Construire les champs
      let ecoField = topEco.length > 0
        ? topEco.map((u, i) => `#${i + 1} <@${u.user_id}> — ${u.total}€`).join('\n')
        : 'Aucune donnée';

      let xpField = topXp.length > 0
        ? topXp.map((u, i) => `#${i + 1} <@${u.user_id}> — Lvl ${u.level} (${u.xp} XP)`).join('\n')
        : 'Aucune donnée';

      let casinoField = topCasino.length > 0
        ? topCasino.map((u, i) => `#${i + 1} <@${u.user_id}> — ${u.biggest_win}€`).join('\n')
        : 'Aucune donnée';

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f) // Or
        .setTitle(`🏆 Classement de la Semaine — ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 512 }) || null)
        .addFields(
          { name: '🏆 Top 5 Économie', value: ecoField || 'Aucune donnée', inline: false },
          { name: '⭐ Top 5 XP', value: xpField || 'Aucune donnée', inline: false },
          { name: '🎲 Top 5 Casino', value: casinoField || 'Aucune donnée', inline: false }
        )
        .setFooter({ text: 'NexusBot — Classement hebdomadaire' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(err => {
        console.error(`[WeeklyLeaderboard] Erreur envoi pour ${cfg.guild_id}:`, err.message);
      });

    } catch (err) {
      console.error(`[WeeklyLeaderboard] Erreur traitement guild ${cfg.guild_id}:`, err.message);
    }
  }
}

function startWeeklyLeaderboard(client) {
  // Vérifier toutes les 60 secondes
  setInterval(() => {
    checkAndPostLeaderboard(client).catch(err => {
      console.error('[WeeklyLeaderboard] Erreur principale:', err.message);
    });
  }, 60_000);

  console.log('[WeeklyLeaderboard] démarré (vérification toutes les 60 s pour dimanche 20h00).');
}

module.exports = { startWeeklyLeaderboard };
