// ============================================================
// cooldownManager.js — Gestionnaire centralisé de cooldowns
// Emplacement : src/utils/cooldownManager.js
// ============================================================

const cooldowns = new Map(); // Map<'userId:command', timestamp>

/**
 * Vérifie si un utilisateur est en cooldown pour une commande.
 * @param {string} userId
 * @param {string} command  — nom de la commande (ex: 'salaire', 'gamble')
 * @param {number} seconds  — durée du cooldown en secondes
 * @returns {{ onCooldown: boolean, remaining: number }}
 */
function checkCooldown(userId, command, seconds) {
  const key = `${userId}:${command}`;
  const now = Date.now();
  const expires = cooldowns.get(key) || 0;

  if (now < expires) {
    const remaining = Math.ceil((expires - now) / 1000);
    return { onCooldown: true, remaining };
  }

  cooldowns.set(key, now + seconds * 1000);
  return { onCooldown: false, remaining: 0 };
}

/**
 * Réinitialise manuellement le cooldown d'un utilisateur pour une commande.
 */
function resetCooldown(userId, command) {
  cooldowns.delete(`${userId}:${command}`);
}

/**
 * Retourne un message d'erreur formaté pour cooldown.
 * @param {number} remaining — secondes restantes
 */
function cooldownMessage(remaining) {
  if (remaining >= 3600) {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return `⏳ Cooldown actif — encore **${h}h ${m}m**.`;
  }
  if (remaining >= 60) {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `⏳ Cooldown actif — encore **${m}m ${s}s**.`;
  }
  return `⏳ Cooldown actif — encore **${remaining}s**.`;
}

/**
 * Nettoie les entrées expirées (à appeler périodiquement).
 */
function cleanExpired() {
  const now = Date.now();
  for (const [key, expires] of cooldowns) {
    if (now > expires) cooldowns.delete(key);
  }
}

// Nettoyage automatique toutes les 10 minutes
setInterval(cleanExpired, 10 * 60 * 1000);

module.exports = { checkCooldown, resetCooldown, cooldownMessage };

