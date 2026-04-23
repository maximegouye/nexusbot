// deploy-commands.js — Enregistre TOUTES les slash commands sur Discord
// Usage: node deploy-commands.js [--guild GUILD_ID]
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const token    = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;

if (!token)    { console.error('❌ TOKEN manquant dans .env'); process.exit(1); }
if (!clientId) { console.error('❌ CLIENT_ID manquant dans .env'); process.exit(1); }

const commands = [];

function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes('disabled')) {
      loadCommands(full);
    } else if (entry.name.endsWith('.js')) {
      try {
        const cmd = require(full);
        if (cmd.data && cmd.data.toJSON) {
          commands.push(cmd.data.toJSON());
          console.log(`  ✅ ${cmd.data.name}`);
        }
      } catch(e) {
        console.error(`  ❌ ${entry.name}: ${e.message}`);
      }
    }
  }
}

console.log('📦 Chargement des commandes...');
loadCommands(path.join(__dirname, 'src', 'commands'));

console.log(`\n📤 Envoi de ${commands.length} commande(s) à Discord...`);

const rest = new REST().setToken(token);

const guildId = process.argv.includes('--guild')
  ? process.argv[process.argv.indexOf('--guild') + 1]
  : (process.env.GUILD_ID || null);

(async () => {
  try {
    let data;
    if (guildId) {
      data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ ${data.length} commandes enregistrées sur le serveur ${guildId}`);
    } else {
      data = await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`✅ ${data.length} commandes globales enregistrées (propagation : jusqu'à 1h)`);
    }
  } catch(err) {
    console.error('❌ Erreur REST Discord:', err.message);
    if (err.rawError) console.error(JSON.stringify(err.rawError, null, 2));
    process.exit(1);
  }
})();
