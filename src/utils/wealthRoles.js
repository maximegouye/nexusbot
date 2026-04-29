// ============================================================
// wealthRoles.js — Auto-attribution de rôles selon la richesse
// ============================================================
//
// Configuration via Railway env :
//   WEALTH_ROLES_ENABLED = "true" pour activer (sinon dormant)
//   WEALTH_ROLE_BRONZE   = ID du rôle Bronze (5 000+)
//   WEALTH_ROLE_SILVER   = ID du rôle Silver (50 000+)
//   WEALTH_ROLE_GOLD     = ID du rôle Gold (500 000+)
//   WEALTH_ROLE_PLATINUM = ID du rôle Platinum (5 000 000+)
//   WEALTH_ROLE_DIAMOND  = ID du rôle Diamond (50 000 000+)
//
// Le worker tourne toutes les 5 min et met à jour les rôles automatiquement.
// Si les rôles n'existent pas, le worker propose de les créer au premier passage.
// ============================================================

const db = require('../database/db');

const TIERS = [
  { name: 'Diamond',  envKey: 'WEALTH_ROLE_DIAMOND',  threshold: 50_000_000, color: 0x5DADE2, hoist: true },
  { name: 'Platinum', envKey: 'WEALTH_ROLE_PLATINUM', threshold:  5_000_000, color: 0xBDC3C7, hoist: true },
  { name: 'Gold',     envKey: 'WEALTH_ROLE_GOLD',     threshold:    500_000, color: 0xF1C40F, hoist: true },
  { name: 'Silver',   envKey: 'WEALTH_ROLE_SILVER',   threshold:     50_000, color: 0x95A5A6, hoist: false },
  { name: 'Bronze',   envKey: 'WEALTH_ROLE_BRONZE',   threshold:      5_000, color: 0xCD7F32, hoist: false },
];

function isEnabled() {
  return process.env.WEALTH_ROLES_ENABLED === 'true';
}

// ─── Auto-création des rôles au boot si absents ────────────
async function ensureRolesExist(guild) {
  const created = {};
  for (const tier of TIERS) {
    let id = process.env[tier.envKey];
    if (id) {
      const existing = guild.roles.cache.get(id);
      if (existing) continue;
    }
    // Rôle absent → on le crée (utilise "colors" obj — non déprécié en v14.16+)
    try {
      const role = await guild.roles.create({
        name: `💎 ${tier.name}`,
        // discord.js v14 accepte les 2 formats. Utilise "colors" pour éviter le warning.
        colors: { primaryColor: tier.color },
        hoist: tier.hoist,
        mentionable: false,
        reason: 'Auto-création rôle richesse NexusBot',
      });
      created[tier.envKey] = role.id;
      console.log(`[wealthRoles] Créé rôle ${tier.name} (id=${role.id}) dans ${guild.name}`);
    } catch (e) {
      console.log(`[wealthRoles] Erreur création rôle ${tier.name}:`, e.message);
    }
  }
  return created;
}

// ─── Détermine le tier d'un user selon sa balance ─────────
function getTierFor(balance) {
  for (const tier of TIERS) {
    if (balance >= tier.threshold) return tier;
  }
  return null;
}

// ─── Mise à jour des rôles d'un user ──────────────────────
async function updateUserRoles(guild, userId, balance) {
  if (!isEnabled()) return;
  const member = guild.members.cache.get(userId);
  if (!member) return;
  const tier = getTierFor(balance);

  // Retire tous les rôles richesse
  const allRoleIds = TIERS.map(t => process.env[t.envKey]).filter(Boolean);
  for (const id of allRoleIds) {
    if (member.roles.cache.has(id)) {
      // Garde uniquement celui du tier actuel
      if (tier && id === process.env[tier.envKey]) continue;
      await member.roles.remove(id).catch(() => {});
    }
  }

  // Ajoute le rôle du tier actuel
  if (tier) {
    const targetId = process.env[tier.envKey];
    if (targetId && !member.roles.cache.has(targetId)) {
      await member.roles.add(targetId).catch(() => {});
    }
  }
}

// ─── Worker : scan tous les users d'un guild ──────────────
async function runScan(client) {
  if (!isEnabled()) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      const users = db.db.prepare(
        'SELECT user_id, balance FROM users WHERE guild_id = ? AND balance > 0'
      ).all(guild.id);
      for (const u of users) {
        await updateUserRoles(guild, u.user_id, u.balance);
      }
    } catch (e) {
      console.log(`[wealthRoles] Scan error for ${guild.name}:`, e.message);
    }
  }
}

module.exports = {
  isEnabled,
  ensureRolesExist,
  getTierFor,
  updateUserRoles,
  runScan,
  TIERS,
};
