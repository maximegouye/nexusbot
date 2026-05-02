// reorder_categories.js — Réorganise les catégories Discord de Zone Entraide
// Ordre cible :
// 1. INFORMATIONS → 2. ANNONCES → 3. GÉNÉRAL → 4. COMMUNAUTÉ →
// 5. JEUX FUN → 6. CASINO → 7. ÉCONOMIE → 8. ÉVÉNEMENTS →
// 9. VOCAUX → 10-16. TICKETS (7 catégories) → 17. ADMINISTRATION
require('dotenv').config();
const https = require('https');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const GUILD_ID = process.env.HOME_GUILD_ID || process.env.GUILD_ID || '1492886135159128227';

if (!TOKEN) { console.error('❌ TOKEN manquant'); process.exit(1); }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'discord.com',
      path: '/api/v10' + path,
      method,
      headers: {
        'Authorization': 'Bot ' + TOKEN,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Ordre cible des catégories (correspondance partielle, insensible à la casse)
const TARGET_ORDER = [
  'INFORMATIONS',
  'ANNONCES',
  'GÉNÉRAL',
  'COMMUNAUTÉ',
  'JEUX FUN',
  'CASINO',
  'ÉCONOMIE',
  'ÉVÉNEMENTS',
  'VOCAUX',
  // Les 7 catégories TICKETS (triées par position actuelle si plusieurs correspondent)
  'TICKETS',
  // ADMINISTRATION tout en bas
  'ADMINISTRATION',
];

function normalize(s) {
  return s.toUpperCase()
    .replace(/[ÉÊÈË]/g, 'E')
    .replace(/[ÀÂÄÃ]/g, 'A')
    .replace(/[ÙÛÜÚ]/g, 'U')
    .replace(/[ÎÏÍÌ]/g, 'I')
    .replace(/[ÔÖÓÒ]/g, 'O')
    .replace(/[ÇC]/g, 'C')
    .trim();
}

(async () => {
  console.log(`\n🔍 Récupération des canaux du serveur ${GUILD_ID}...`);
  const res = await req('GET', `/guilds/${GUILD_ID}/channels`);

  if (res.status !== 200) {
    console.error('❌ Erreur API:', res.status, JSON.stringify(res.body));
    process.exit(1);
  }

  const channels = res.body;
  // Filtrer les catégories (type=4)
  const cats = channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);

  console.log(`\n📋 Catégories actuelles (${cats.length}) :`);
  cats.forEach(c => console.log(`  [pos=${c.position}] ${c.name} (id=${c.id})`));

  // Construire l'ordre cible
  const ordered = [];
  const used = new Set();

  for (const target of TARGET_ORDER) {
    const normTarget = normalize(target);

    if (target === 'TICKETS') {
      // Trouver toutes les catégories TICKETS (non encore utilisées)
      const ticketCats = cats.filter(c =>
        !used.has(c.id) &&
        normalize(c.name).includes('TICKETS')
      ).sort((a, b) => a.position - b.position);

      for (const tc of ticketCats) {
        ordered.push(tc);
        used.add(tc.id);
      }
    } else {
      // Correspondance exacte ou partielle
      const match = cats.find(c =>
        !used.has(c.id) && (
          normalize(c.name) === normTarget ||
          normalize(c.name).includes(normTarget) ||
          normTarget.includes(normalize(c.name))
        )
      );
      if (match) {
        ordered.push(match);
        used.add(match.id);
      } else {
        console.warn(`  ⚠️  Catégorie non trouvée : "${target}"`);
      }
    }
  }

  // Ajouter les catégories non matchées à la fin
  const remaining = cats.filter(c => !used.has(c.id));
  if (remaining.length > 0) {
    console.log(`\n⚠️  Catégories non placées (ajoutées à la fin) :`);
    remaining.forEach(c => console.log(`  - ${c.name}`));
    ordered.push(...remaining);
  }

  console.log(`\n🎯 Ordre cible :`);
  ordered.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));

  // Construire le payload PATCH
  const payload = ordered.map((c, i) => ({ id: c.id, position: i * 2 }));

  console.log(`\n📡 Application du nouvel ordre...`);
  const patchRes = await req('PATCH', `/guilds/${GUILD_ID}/channels`, payload);

  if (patchRes.status === 200 || patchRes.status === 204) {
    console.log(`✅ Catégories réorganisées avec succès !`);
  } else {
    console.error(`❌ Erreur PATCH: ${patchRes.status}`, JSON.stringify(patchRes.body, null, 2));
    process.exit(1);
  }

  // Vérification
  const verif = await req('GET', `/guilds/${GUILD_ID}/channels`);
  const newCats = verif.body.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
  console.log(`\n✅ Nouvel ordre confirmé :`);
  newCats.forEach((c, i) => console.log(`  ${i + 1}. ${c.name}`));
})();
