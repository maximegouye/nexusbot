// deploy-commands.js — Enregistre TOUTES les slash commands sur Discord
// Lancé par "npm start" AVANT src/index.js
// - src/commands/       → Global (tous serveurs, propagation ~1h)
// - src/commands_guild/ → Guild  (serveur HOME uniquement, instantané)
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const token    = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
// CLIENT_ID peut être absent du .env sur Railway (dockerignore) — on l'extrait du TOKEN
let clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;
if (!clientId && token) {
  try { clientId = Buffer.from(token.split('.')[0], 'base64').toString(); } catch (_) {}
}
const guildId  = process.env.HOME_GUILD_ID || process.env.GUILD_ID || '1492886135159128227';

if (!token)    { console.error('❌ TOKEN manquant dans .env'); process.exit(1); }
if (!clientId) { console.error('❌ CLIENT_ID manquant dans .env'); process.exit(1); }
console.log(`ℹ️  CLIENT_ID: ${clientId} | GUILD: ${guildId}`);

// Ordre de priorité pour le chargement des guild commands (les premières catégories
// sont garanties d'être dans les 100 — les dernières sont coupées si dépassement)
const GUILD_PRIORITY = ['admin', 'utility', 'games', 'economy', 'social', 'unique', 'fun'];

function loadCmds(dir, skipDirs = []) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.includes('.disabled') && !entry.name.includes('disabled') && !skipDirs.includes(entry.name)) {
        result.push(...loadCmds(full, skipDirs));
      }
    } else if (entry.name.endsWith('.js') && !entry.name.includes('.disabled') && !entry.name.endsWith('.test.js')) {
      try {
        delete require.cache[require.resolve(full)];
        const cmd = require(full);
        if (cmd.data && cmd.data.toJSON && cmd.execute && !cmd._prefixOnly) {
          result.push({ name: cmd.data.name, json: cmd.data.toJSON() });
        }
      } catch(e) {
        console.error(`  ⚠️  ${entry.name}: ${e.message.split('\n')[0]}`);
      }
    }
  }
  return result;
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  console.log('📦 Chargement des commandes...');

  // ── Global commands (src/commands/) ──────────────────────
  const globalCmds = loadCmds(path.join(__dirname, 'src', 'commands'));
  console.log(`\n🌐 Global: ${globalCmds.length} commandes`);
  if (globalCmds.length > 100) {
    console.error(`❌ ERREUR: ${globalCmds.length} global commands > limite 100 !`);
    process.exit(1);
  }

  // ── Guild commands (src/commands_guild/) ─────────────────
  // Chargement par ordre de priorité: admin > utility > games > economy > social > unique > fun
  // → garantit que les commandes critiques passent en premier dans la limite de 100
  const guildBasePath = path.join(__dirname, 'src', 'commands_guild');
  const rawGuildCmds = [];
  const seenNames = new Set();

  for (const dir of GUILD_PRIORITY) {
    const dirPath = path.join(guildBasePath, dir);
    const dirCmds = loadCmds(dirPath);
    for (const cmd of dirCmds) {
      if (!seenNames.has(cmd.name)) {
        seenNames.add(cmd.name);
        rawGuildCmds.push(cmd);
      } else {
        console.log(`  ℹ️  Doublon ignoré: ${cmd.name} (déjà chargé depuis priorité plus haute)`);
      }
    }
  }

  console.log(`🏠 Guild total chargé: ${rawGuildCmds.length} commandes`);

  // Limiter à 100 (Discord limit)
  const guildCmds = rawGuildCmds.slice(0, 100);
  if (rawGuildCmds.length > 100) {
    const omitted = rawGuildCmds.slice(100).map(c => c.name);
    console.log(`⚠️  Limite 100 atteinte — ${omitted.length} commandes omises du guild (disponibles en global): ${omitted.join(', ')}`);
  }
  console.log(`🏠 Guild:  ${guildCmds.length} commandes`);

  // Vérifier doublons dans global
  const globalNames = globalCmds.map(c => c.name);
  const globalDupes = globalNames.filter((n,i) => globalNames.indexOf(n) !== i);
  if (globalDupes.length) { console.error(`❌ Doublons global: ${globalDupes}`); process.exit(1); }

  // ── Enregistrement GUILD ──────────────────────────────────
  try {
    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: guildCmds.map(c => c.json) }
    );
    console.log(`✅ ${data.length} guild commands enregistrées → serveur ${guildId}`);
  } catch(err) {
    console.error('❌ Guild registration FAILED:', err.message);
    if (err.rawError) console.error(JSON.stringify(err.rawError, null, 2));
    process.exit(1);
  }

  // ── Enregistrement GLOBAL ─────────────────────────────────
  try {
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: globalCmds.map(c => c.json) }
    );
    console.log(`✅ ${data.length} global commands enregistrées (propagation ~1h)`);
  } catch(err) {
    console.error('❌ Global registration FAILED:', err.message);
    if (err.rawError) console.error(JSON.stringify(err.rawError, null, 2));
    process.exit(1);
  }

  console.log('\n✅ Registration complète — démarrage du bot...');
  // Force l exit pour eviter que le REST keep-alive de discord.js bloque le process
  process.exit(0);
})();
