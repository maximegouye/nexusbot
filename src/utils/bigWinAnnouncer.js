// ============================================================
// bigWinAnnouncer.js — Annonce les gros gains dans le canal général
// ============================================================
//
// Pour engager le serveur : quand quelqu'un gagne gros, tout le monde le voit.
// Cela motive les autres à jouer ("ah, untel a gagné 50k, je vais essayer aussi").
//
// Seuils par défaut :
//   • Big win    : ≥ 10 000€  → embed simple
//   • Mega win   : ≥ 50 000€  → embed coloré + ping
//   • Jackpot    : tout jackpot/insane win → annonce ÉPIQUE avec mention @here
//
// Configuration via Railway env :
//   BIG_WIN_THRESHOLD     = montant minimum pour annoncer (défaut 10000)
//   BIG_WIN_PING_THRESHOLD = montant minimum pour ping @here (défaut 100000)
//   BIG_WIN_DISABLED      = "true" pour désactiver
// ============================================================

const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const DISABLED = process.env.BIG_WIN_DISABLED === 'true';
const BIG_THRESHOLD  = parseInt(process.env.BIG_WIN_THRESHOLD || '10000');
const PING_THRESHOLD = parseInt(process.env.BIG_WIN_PING_THRESHOLD || '100000');

// Cooldown anti-spam : pas plus d'un announce par user toutes les 60 sec
const lastAnnounce = new Map(); // userId → timestamp
const COOLDOWN_MS = 60_000;

// ─── Annonce un gain ──────────────────────────────────────
// game     : 'slots' | 'roulette' | 'roue-fortune' | 'plinko' | 'coffre-magique' | etc.
// type     : 'win' | 'jackpot' | 'mega'
async function announceBigWin(client, guildId, userId, amount, game, type = 'win') {
  if (DISABLED) return;
  if (amount < BIG_THRESHOLD) return;

  // Anti-spam
  const now = Date.now();
  const last = lastAnnounce.get(userId) || 0;
  if (now - last < COOLDOWN_MS) return;
  lastAnnounce.set(userId, now);

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    // Récupère le canal général configuré
    const cfg = db.getConfig ? db.getConfig(guildId) : {};
    const channelId = cfg.general_channel || cfg.welcome_channel;
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    const username = member?.user.username || 'Joueur';
    const symbol = cfg.currency_emoji || '€';

    // Choix de l'embed selon le tier
    let color, title, desc, content;
    const amtStr = amount.toLocaleString('fr-FR');
    const gameLabel = {
      'slots': '🎰 Machine à sous',
      'roulette': '🎡 Roulette',
      'roue-fortune': '🎡 Grande Roue',
      'plinko': '🎯 Plinko',
      'coffre-magique': '🗝️ Coffre Magique',
      'blackjack': '🃏 Blackjack',
      'mines': '💣 Mines',
      'crash': '🚀 Crash',
    }[game] || `🎲 ${game}`;

    if (type === 'jackpot' || amount >= 500000) {
      color = 0xFFD700;
      title = '🎰 Jackpot !';
      desc = `🌟 **${username}** vient de remporter **+${amtStr} ${symbol}** au ${gameLabel} !`;
    } else if (amount >= 50000) {
      color = 0xFF6B00;
      title = '🔥 Mega win !';
      desc = `**${username}** vient de gagner **+${amtStr} ${symbol}** au ${gameLabel} ! 💰`;
    } else {
      color = 0x2ECC71;
      title = '✨ Gros gain !';
      desc = `**${username}** a gagné **+${amtStr} ${symbol}** au ${gameLabel} ! 🎉`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc)
      .setThumbnail(member?.user.displayAvatarURL({ size: 128 }) || null)
      .setTimestamp();

    // ⚠️ Jamais de ping @here/@everyone — l'embed parle de lui-même
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
  } catch (e) {
    console.error('[bigWinAnnouncer]', e.message);
  }
}

module.exports = { announceBigWin };
