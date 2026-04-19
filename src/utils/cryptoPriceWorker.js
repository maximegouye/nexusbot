/**
 * NexusBot — Worker qui met à jour les VRAIS prix crypto toutes les 5 minutes.
 *
 * Utilise l'API publique CoinGecko (gratuite, pas de clé).
 * Met à jour : price, prev_price, change_24h, updated_at.
 *
 * Appelé depuis src/index.js au démarrage avec `startCryptoPriceWorker()`.
 */

const db = require('../database/db');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function refreshPrices() {
  try {
    const res = await db.fetchRealCryptoPrices();
    if (res?.ok) {
      console.log(`[CryptoPriceWorker] ${res.updated} cryptos mises à jour via CoinGecko.`);
    } else {
      console.warn('[CryptoPriceWorker] Échec fetch CoinGecko :', res?.reason || 'inconnu');
    }
  } catch (e) {
    console.error('[CryptoPriceWorker] Erreur :', e.message);
  }
}

function startCryptoPriceWorker() {
  // Premier fetch immédiat au démarrage (après 10 s pour laisser le bot boot)
  setTimeout(() => refreshPrices(), 10_000);
  // Puis toutes les 5 minutes
  setInterval(() => refreshPrices(), INTERVAL_MS);
  console.log('[CryptoPriceWorker] démarré (rafraîchissement toutes les 5 min via CoinGecko).');
}

module.exports = { startCryptoPriceWorker, refreshPrices };
