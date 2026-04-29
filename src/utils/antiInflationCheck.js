// ============================================================
// antiInflationCheck.js — Détection et correction des soldes anormaux au boot
// ============================================================
//
// Suite à une mauvaise configuration des récompenses, certains joueurs ont
// pu accumuler des soldes irréalistes (10+ milliards). Ce module :
//
// 1. Au boot, scan la DB pour détecter les soldes > SEUIL (1 000 000 000)
// 2. Ramène ces soldes à un montant raisonnable (100 000)
// 3. Envoie un message public dans le canal général expliquant la correction
//
// Configuration via Railway env :
//   ANTI_INFLATION_DISABLED = "true" pour désactiver (par défaut activé une fois)
//   ANTI_INFLATION_THRESHOLD = seuil (défaut 1_000_000_000)
//   ANTI_INFLATION_RESET_TO = nouveau solde (défaut 100_000)
//
// Le check ne tourne qu'une seule fois par déploiement (flag en mémoire).
// ============================================================

const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

let alreadyRan = false;
const DISABLED  = process.env.ANTI_INFLATION_DISABLED === 'true';
const THRESHOLD = parseInt(process.env.ANTI_INFLATION_THRESHOLD || '1000000000');
const RESET_TO  = parseInt(process.env.ANTI_INFLATION_RESET_TO  || '100000');

async function runOnce(client) {
  if (alreadyRan) return;
  alreadyRan = true;
  if (DISABLED) {
    console.log('[antiInflation] disabled via env');
    return;
  }

  console.log(`[antiInflation] scan en cours (seuil=${THRESHOLD.toLocaleString('fr-FR')}€)...`);

  try {
    // Trouve tous les users avec balance ou bank > seuil
    const richies = db.db.prepare(
      'SELECT user_id, guild_id, balance, bank FROM users WHERE balance > ? OR bank > ?'
    ).all(THRESHOLD, THRESHOLD);

    if (!richies.length) {
      console.log('[antiInflation] aucun solde anormal détecté');
      return;
    }

    console.log(`[antiInflation] ${richies.length} solde(s) anormal(aux) détecté(s)`);

    for (const u of richies) {
      const oldBalance = u.balance || 0;
      const oldBank    = u.bank || 0;
      const oldTotal   = oldBalance + oldBank;

      // Reset
      db.db.prepare('UPDATE users SET balance = ?, bank = 0 WHERE user_id = ? AND guild_id = ?')
        .run(RESET_TO, u.user_id, u.guild_id);

      console.log(`[antiInflation] User ${u.user_id} guild ${u.guild_id} : ${oldTotal.toLocaleString('fr-FR')}€ → ${RESET_TO.toLocaleString('fr-FR')}€`);

      // Annonce dans le canal général
      try {
        const guild = client.guilds.cache.get(u.guild_id);
        if (!guild) continue;
        const cfg = db.getConfig ? db.getConfig(u.guild_id) : {};
        const channelId = cfg.general_channel || cfg.welcome_channel;
        if (!channelId) continue;
        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) continue;

        const member = await guild.members.fetch(u.user_id).catch(() => null);
        const username = member?.user.username || `<@${u.user_id}>`;
        const symbol = cfg.currency_emoji || '€';

        const embed = new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle('⚠️ Correction économie — annonce officielle')
          .setDescription([
            `Suite à une **mauvaise configuration** des récompenses du bot ces dernières heures, certains gains étaient anormalement élevés.`,
            ``,
            `Nous corrigeons l'économie pour que le serveur reste équilibré et fun pour tout le monde.`,
            ``,
            `**${username}**, ton solde est ramené à **${RESET_TO.toLocaleString('fr-FR')} ${symbol}** (au lieu de ${oldTotal.toLocaleString('fr-FR')} ${symbol}).`,
            ``,
            `Désolé pour la gêne — c'est un bug d'équilibrage de notre côté, pas le tien. Continue à profiter du casino, les gains sont maintenant à des niveaux raisonnables ! 🎰`,
          ].join('\n'))
          .setFooter({ text: 'NexusBot · Régulation automatique anti-inflation' })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
      } catch (e) {
        console.error('[antiInflation] notification error:', e.message);
      }
    }
  } catch (e) {
    console.error('[antiInflation] erreur scan DB:', e.message);
  }
}

module.exports = { runOnce };
