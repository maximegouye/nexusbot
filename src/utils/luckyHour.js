// ============================================================
// luckyHour.js — Heure de chance quotidienne (gains ×2 pour tous)
// ============================================================
//
// Chaque jour, une heure aléatoire (entre 10h et 23h) devient "Lucky Hour" :
//   • Tous les gains sont multipliés par 2
//   • Le bot annonce le début et la fin dans le canal général
//   • Crée du FOMO (peur de rater) et engage les joueurs
//
// Configuration via Railway env :
//   LUCKY_HOUR_DISABLED = "true" pour désactiver
//   LUCKY_HOUR_MULT = multiplicateur (défaut 2)
// ============================================================

const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const DISABLED = process.env.LUCKY_HOUR_DISABLED === 'true';
const MULT     = parseFloat(process.env.LUCKY_HOUR_MULT || '2');

// État de la lucky hour active
let activeUntil = 0;        // timestamp ms
let plannedToday = -1;      // hour (0-23) où la lucky hour démarre aujourd'hui
let plannedDate = -1;       // jour du mois pour reset
let announcedToday = false; // a-t-on déjà annoncé le démarrage aujourd'hui

// ─── Multiplicateur actuel (1 ou MULT) ────────────────────
function currentMultiplier() {
  if (DISABLED) return 1;
  if (Date.now() < activeUntil) return MULT;
  return 1;
}

function isActive() { return currentMultiplier() > 1; }

// ─── Worker : décide chaque heure si on commence/finit ────
async function tick(client) {
  if (DISABLED) return;
  const now = new Date();
  const today = now.getDate();
  const hour = now.getHours();

  // Reset planning chaque jour à minuit
  if (today !== plannedDate) {
    plannedDate = today;
    // Lucky hour entre 10h et 22h (heure pleine)
    plannedToday = 10 + Math.floor(Math.random() * 13);
    announcedToday = false;
    console.log(`[luckyHour] Lucky Hour planifiée aujourd'hui à ${plannedToday}h00`);
  }

  // Démarrer la lucky hour à l'heure prévue
  if (hour === plannedToday && !announcedToday) {
    announcedToday = true;
    activeUntil = Date.now() + 60 * 60 * 1000; // 1h
    console.log(`[luckyHour] DÉMARRÉE — fin à ${new Date(activeUntil).toISOString()}`);
    await announceStart(client);
  }

  // Annoncer la fin si on vient de la dépasser
  if (activeUntil > 0 && Date.now() > activeUntil && Date.now() < activeUntil + 90_000) {
    const wasActive = activeUntil;
    activeUntil = 0;
    console.log('[luckyHour] TERMINÉE');
    await announceEnd(client);
  }
}

async function announceStart(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = db.getConfig ? db.getConfig(guild.id) : {};
      const channelId = cfg.general_channel || cfg.welcome_channel;
      if (!channelId) continue;
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) continue;

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🍀 LUCKY HOUR — DÉMARRÉE ! 🍀')
        .setDescription([
          `## ⏰ La chance est avec vous pour **1 HEURE** !`,
          ``,
          `🎰 **Tous les gains sont multipliés par ×${MULT}** dans tous les jeux !`,
          ``,
          `Slots, Roulette, Roue, Plinko, Coffre Magique — c'est le moment de jouer GROS !`,
          ``,
          `⏳ Fin dans 60 minutes — ne loupez pas l'occasion !`,
        ].join('\n'))
        .setFooter({ text: 'NexusBot · Lucky Hour quotidienne' })
        .setTimestamp();

      await channel.send({ content: '@here 🍀 **LUCKY HOUR !** Tous les gains ×' + MULT + ' pendant 1h !', embeds: [embed], allowedMentions: { parse: ['everyone'] } }).catch(() => {});
    } catch (e) { console.error('[luckyHour] announceStart:', e.message); }
  }
}

async function announceEnd(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = db.getConfig ? db.getConfig(guild.id) : {};
      const channelId = cfg.general_channel || cfg.welcome_channel;
      if (!channelId) continue;
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) continue;

      const embed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setTitle('⏰ Lucky Hour terminée')
        .setDescription([
          `La Lucky Hour vient de prendre fin. Les gains reprennent leur valeur normale.`,
          ``,
          `🎯 **Rendez-vous demain** pour une nouvelle Lucky Hour à un horaire différent !`,
        ].join('\n'))
        .setFooter({ text: 'NexusBot · à demain pour la prochaine !' });

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch {}
  }
}

module.exports = { tick, currentMultiplier, isActive };
