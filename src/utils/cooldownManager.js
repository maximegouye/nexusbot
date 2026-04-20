// cooldownManager.js — src/utils/cooldownManager.js
const cooldowns = new Map();
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
function resetCooldown(userId, command) { cooldowns.delete(`${userId}:${command}`); }
function cooldownMessage(remaining) {
  if (remaining >= 3600) { const h = Math.floor(remaining/3600); const m = Math.floor((remaining%3600)/60); return `⏳ Cooldown — encore **${h}h ${m}m**.`; }
  if (remaining >= 60) { const m = Math.floor(remaining/60); const s = remaining%60; return `⏳ Cooldown — encore **${m}m ${s}s**.`; }
  return `⏳ Cooldown — encore **${remaining}s**.`;
}
function cleanExpired() { const now = Date.now(); for (const [k,v] of cooldowns) if (now > v) cooldowns.delete(k); }
setInterval(cleanExpired, 10*60*1000);
module.exports = { checkCooldown, resetCooldown, cooldownMessage };
