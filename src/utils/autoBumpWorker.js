/**
 * autoBumpWorker.js - Bump Disboard toutes les 2h
 */
const BUMP_CHANNEL_ID   = process.env.BUMP_CHANNEL_ID   || null;
const BUMP_CHANNEL_NAME = process.env.BUMP_CHANNEL_NAME || 'bump-disboard';
const BUMP_INTERVAL_MS  = 2 * 60 * 60 * 1000;
let _bumpTimer = null;

function getBumpChannel(client) {
  if (BUMP_CHANNEL_ID) return client.channels.cache.get(BUMP_CHANNEL_ID) || null;
  for (const guild of client.guilds.cache.values()) {
    const ch = guild.channels.cache.find(c => c.name === BUMP_CHANNEL_NAME && c.isTextBased());
    if (ch) return ch;
  }
  return null;
}

async function doBump(client) {
  try {
    const channel = getBumpChannel(client);
    if (!channel) { console.warn('[AutoBump] Canal introuvable.'); return; }
    await channel.send('!d bump');
    console.log('[AutoBump] Bump envoye a ' + new Date().toISOString());
  } catch (err) { console.error('[AutoBump] Erreur:', err.message); }
}

function startAutoBumpWorker(client) {
  console.log('[AutoBump] Worker demarre (30s puis toutes les 2h).');
  setTimeout(() => doBump(client), 30000);
  _bumpTimer = setInterval(() => doBump(client), BUMP_INTERVAL_MS);
}

function stopAutoBumpWorker() {
  if (_bumpTimer) { clearInterval(_bumpTimer); _bumpTimer = null; }
}

module.exports = { startAutoBumpWorker, stopAutoBumpWorker, doBump };
