/**
 * NexusBot — Système de remboursement pour victimes du bug slots/casino
 * Module helper (ex-commande slash, maintenant intégrée dans /admin)
 * Fonctions de remboursement réutilisables
 */
const { EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Créer la table si elle n'existe pas
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS remboursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    amount INTEGER NOT NULL,
    raison TEXT DEFAULT 'Bug technique — gain non versé',
    sent INTEGER DEFAULT 0,
    sent_at INTEGER,
    added_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// ─── Envoi d'un remboursement unique ────────────────────────────────────────
async function sendRemboursement(client, guildId, userId, amount, raison, channelId = null) {
  try {
    db.addCoins(userId, guildId, amount);
    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    const cfg = db.getConfig(guildId);
    const coin = cfg?.currency_emoji || '€';

    // Tentative DM
    try {
      const user = await client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Remboursement de NexusBot')
        .setDescription(
          `Bonjour <@${userId}> ! 🙏\n\n` +
          `Suite à un **bug technique** qui a pu empêcher certains gains d'être crédités correctement, ` +
          `NexusBot te rembourse automatiquement.\n\n` +
          `Nous sommes sincèrement désolés pour ce désagrément.`
        )
        .addFields(
          { name: '💰 Montant remboursé', value: `**+${amount.toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: '📋 Raison', value: raison, inline: true },
          { name: '👛 Nouveau solde', value: `${newBalance.toLocaleString('fr-FR')} ${coin}`, inline: true },
        )
        .setFooter({ text: 'NexusBot — Zone Entraide' })
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    // Afficher aussi dans le canal public si channelId est fourni
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const publicEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('💸 Remboursement effectué !')
            .setDescription(`<@${userId}> a été remboursé suite à un bug technique.\n\nDésolé pour ce désagrément — ton gain t'appartient ! 🙏`)
            .addFields(
              { name: '💰 Montant remboursé', value: `**+${amount.toLocaleString('fr-FR')} ${coin}**`, inline: true },
              { name: '👛 Nouveau solde', value: `${newBalance.toLocaleString('fr-FR')} ${coin}`, inline: true },
              { name: '📋 Raison', value: raison, inline: false },
            )
            .setFooter({ text: 'NexusBot — Zone Entraide' })
            .setTimestamp();
          await channel.send({ embeds: [publicEmbed] });
        }
      } catch {}
    }

    return true;
  } catch (e) {
    console.error('[REMBOURS] Erreur:', e.message);
    return false;
  }
}

module.exports = {
  sendRemboursement,
};
