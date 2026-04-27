const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Map pour tracker les joins récents par serveur
// recentJoins[guildId] = [timestamp1, timestamp2, ...]
const recentJoins = new Map();

// Set des guilds actuellement en mode raid
const raidMode = new Set();

// Durée de détection de raid (30 secondes)
const RAID_WINDOW = 30000;

// Nombre de joins pour déclencher le mode raid
const RAID_THRESHOLD = 5;

// Durée du mode raid (5 minutes)
const RAID_DURATION = 5 * 60 * 1000;

// ⚠️ AUTO-KICK DÉSACTIVÉ — mode alerte uniquement
// (peut être réactivé manuellement si besoin)
const AUTO_KICK_ENABLED = false;
const AUTO_VERIF_LEVEL_ENABLED = false;

/**
 * Démarre le worker de nettoyage périodique
 */
function startAntiRaid(client) {
  // Nettoie les entrées recentJoins toutes les 60 secondes
  setInterval(() => {
    const now = Date.now();
    for (const [guildId, timestamps] of recentJoins.entries()) {
      // Garde seulement les timestamps dans la fenêtre RAID_WINDOW
      const filtered = timestamps.filter(ts => now - ts < RAID_WINDOW);
      if (filtered.length === 0) {
        recentJoins.delete(guildId);
      } else {
        recentJoins.set(guildId, filtered);
      }
    }
  }, 60000);

  // Désactive le mode raid après la durée définie
  setInterval(() => {
    const now = Date.now();
    for (const guildId of raidMode) {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        raidMode.delete(guildId);
        continue;
      }

      // Récupère la verification_level originale et la restaure
      try {
        const cfg = db.getConfig(guildId);
        const originalLevel = cfg.verification_level || 'NONE';
        guild.setVerificationLevel(originalLevel).catch(() => {});
        raidMode.delete(guildId);
      } catch (err) {
        console.error(`[AntiRaid] Erreur en désactivant le mode raid pour ${guildId}:`, err);
      }
    }
  }, RAID_DURATION);
}

/**
 * Appelé à chaque guildMemberAdd pour vérifier les raids
 */
function onMemberJoin(member) {
  const { guild, user } = member;
  const guildId = guild.id;
  const now = Date.now();

  // Ajoute le timestamp du join
  if (!recentJoins.has(guildId)) {
    recentJoins.set(guildId, []);
  }
  recentJoins.get(guildId).push(now);

  // Récupère les joins récents dans la fenêtre
  const recentCount = recentJoins.get(guildId).length;

  // Vérifie si nous avons 5+ joins en 30 secondes
  if (recentCount >= RAID_THRESHOLD && !raidMode.has(guildId)) {
    // Mode raid déclenché !
    raidMode.add(guildId);
    handleRaid(member, guild);
  }

  // AUTO-KICK désactivé — on ne kick personne automatiquement
}

/**
 * Gère le mode raid : log + kick comptes récents + verif level
 */
async function handleRaid(member, guild) {
  const cfg = db.getConfig(guild.id);
  const guildId = guild.id;
  const now = Date.now();

  try {
    // Log du raid
    const logChannelId = cfg.mod_log_channel || cfg.log_channel;
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        // Récupère les comptes suspects
        const suspectAccounts = [];
        if (recentJoins.has(guildId)) {
          const joinedMembers = [];
          try {
            // Récupère les membres du guild qui ont rejoint récemment
            const members = await guild.members.fetch().catch(() => null);
            if (members) {
              for (const m of members.values()) {
                const accountAgeMs = now - m.user.createdTimestamp;
                const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
                if (accountAgeDays < 7) {
                  suspectAccounts.push({
                    username: m.user.username,
                    id: m.user.id,
                    ageDays: accountAgeDays.toFixed(1),
                  });
                }
              }
            }
          } catch {}
        }

        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🚨 Mode Raid Détecté')
          .setDescription(
            `**${recentJoins.get(guildId)?.length || RAID_THRESHOLD}** nouvelles personnes ont rejoint en moins de 30 secondes.\n` +
            `Mode raid activé !`
          )
          .addFields(
            { name: '🔐 Verification Level', value: 'Passé à VERY_HIGH (4)', inline: true },
            { name: '⏱️ Durée', value: 'Désactivé après 5 minutes', inline: true },
            { name: `👤 Comptes suspects (< 7j)`, value: suspectAccounts.length > 0
              ? suspectAccounts.slice(0, 5).map(a => `• ${a.username} (${a.ageDays}j)`).join('\n')
              : 'Aucun détecté'
            }
          )
          .setFooter({ text: guild.name })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Sauvegarde la verification_level originale si pas déjà sauvegardée
    if (!cfg.verification_level) {
      try {
        db.db.prepare(
          'UPDATE guild_config SET verification_level = ? WHERE guild_id = ?'
        ).run(guild.verificationLevel, guildId);
      } catch {}
    }

    // AUTO-KICK et AUTO-VERIF désactivés — alerte uniquement
    // (pour réactiver : passer AUTO_KICK_ENABLED et AUTO_VERIF_LEVEL_ENABLED à true)
  } catch (err) {
    console.error(`[AntiRaid] Erreur en gérant le raid:`, err);
  }
}

module.exports = {
  startAntiRaid,
  onMemberJoin,
};
