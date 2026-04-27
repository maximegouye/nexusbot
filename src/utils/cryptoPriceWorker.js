/**
 * cryptoPriceWorker.js - CoinGecko + fallback CoinCap
 */
const https = require('https');
const PRICE_INTERVAL_MS = 5 * 60 * 1000;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';
const COINGECKO_IDS = {
  BTC:'bitcoin',ETH:'ethereum',BNB:'binancecoin',SOL:'solana',
  ADA:'cardano',XRP:'ripple',DOGE:'dogecoin',DOT:'polkadot',
  MATIC:'matic-network',AVAX:'avalanche-2',LINK:'chainlink',
  UNI:'uniswap',LTC:'litecoin',ATOM:'cosmos',FIL:'filecoin',
};

function httpsGet(url, headers={}) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname, path: opts.pathname+opts.search,
      method:'GET', headers:{'User-Agent':'NexusBot/2.0',...headers},
    }, res => {
      let data = '';
      res.on('data', c => data+=c);
      res.on('end', () => resolve({status:res.statusCode, body:data}));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function fetchFromCoinGecko(symbols) {
  const ids = symbols.map(s=>COINGECKO_IDS[s]).filter(Boolean).join(',');
  if (!ids) return null;
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids='+ids+'&vs_currencies=usd&include_24hr_change=true';
  const headers = COINGECKO_API_KEY ? {'x-cg-demo-api-key':COINGECKO_API_KEY} : {};
  const {status, body} = await httpsGet(url, headers);
  if (status===429) return null;
  if (status!==200) throw new Error('CoinGecko HTTP '+status);
  const json = JSON.parse(body);
  const result = {};
  for (const sym of symbols) {
    const id = COINGECKO_IDS[sym];
    if (id && json[id]) result[sym] = {price:json[id].usd, change:json[id].usd_24h_change||0};
  }
  return result;
}

async function fetchFromCoinCap(symbols) {
  const result = {};
  for (const sym of symbols) {
    try {
      const {status,body} = await httpsGet('https://api.coincap.io/v2/assets/'+sym.toLowerCase());
      if (status!==200) continue;
      const json = JSON.parse(body);
      if (!json.data) continue;
      result[sym] = {price:parseFloat(json.data.priceUsd)||0, change:parseFloat(json.data.changePercent24Hr)||0};
    } catch {}
  }
  return result;
}

let _priceCache = {};
let _priceTimer = null;

async function updatePrices(db) {
  const symbols = Object.keys(COINGECKO_IDS);
  try {
    let prices = await fetchFromCoinGecko(symbols);
    if (!prices) { console.warn('[CryptoPrices] Rate-limited, fallback CoinCap'); prices = await fetchFromCoinCap(symbols); }
    if (prices && Object.keys(prices).length>0) {
      _priceCache = prices;
      // Synchronous call: better-sqlite3 is not async
      if (db && typeof db.setCryptoPrices==='function') {
        try {
          db.setCryptoPrices(prices);
        } catch (e) {
          console.warn('[CryptoPrices] setCryptoPrices not implemented or failed:', e.message);
        }
      }
      console.log('[CryptoPrices] '+Object.keys(prices).length+' prix mis a jour.');
    }
  } catch(err) { console.error('[CryptoPrices] Erreur:', err.message); }
}

function getPriceCache() { return _priceCache; }
function startCryptoPriceWorker(db) {
  console.log('[CryptoPrices] Worker demarre.');
  updatePrices(db);
  _priceTimer = setInterval(()=>updatePrices(db), PRICE_INTERVAL_MS);
  if (_priceTimer?.unref) _priceTimer.unref();
}
function stopCryptoPriceWorker() {
  if (_priceTimer) { clearInterval(_priceTimer); _priceTimer=null; }
}
module.exports = { startCryptoPriceWorker, stopCryptoPriceWorker, getPriceCache };
