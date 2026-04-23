// dotenv inutile : les vars sont deja chargees par bash via source .env
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

const BOT_DIR    = __dirname;
const TOKEN      = process.env.TOKEN;
const CLIENT_ID  = process.env.CLIENT_ID;
const HOME_GUILD = process.env.HOME_GUILD_ID;

if (!TOKEN || !CLIENT_ID) { console.error('TOKEN/CLIENT_ID manquant'); process.exit(1); }

const allCommands   = [];
const guildCommands = [];
const menus         = [];
let   errors        = 0;

function loadDir(dir, arr) {
  if (!fs.existsSync(dir)) { console.log('Dossier absent:', dir); return; }
  const folders = fs.readdirSync(dir).filter(f =>
    !f.endsWith('.disabled') && fs.statSync(path.join(dir,f)).isDirectory()
  );
  for (const folder of folders) {
    const files = fs.readdirSync(path.join(dir,folder)).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        delete require.cache[require.resolve(path.join(dir,folder,file))];
        const cmd = require(path.join(dir,folder,file));
        if (cmd?.data?.toJSON) arr.push(cmd.data.toJSON());
      } catch(e) {
        errors++;
      }
    }
  }
}

function loadMenus(dir) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))) {
    try {
      const cmd = require(path.join(dir,file));
      if (cmd?.data?.toJSON) menus.push(cmd.data.toJSON());
    } catch(e) { errors++; }
  }
}

loadDir(path.join(BOT_DIR,'src/commands'),        allCommands);
loadDir(path.join(BOT_DIR,'src/commands_guild'),  guildCommands);
loadMenus(path.join(BOT_DIR,'src/context_menus'));

console.log(`Chargé : ${allCommands.length} global, ${guildCommands.length} guild, ${menus.length} menus (${errors} erreurs ignorées)`);

if (allCommands.length + guildCommands.length === 0) {
  console.error('AUCUNE COMMANDE CHARGÉE — abandon pour ne pas effacer Discord');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  // Commandes globales
  const global = [...allCommands, ...menus];
  console.log(`Enregistrement ${global.length} commandes globales...`);
  try {
    const r = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: global });
    console.log(`✓ ${r.length} commandes globales OK`);
  } catch(e) { console.error('Erreur global:', e.message); }

  // Commandes guild
  if (HOME_GUILD && guildCommands.length) {
    console.log(`Enregistrement ${guildCommands.length} commandes guild...`);
    try {
      const r = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, HOME_GUILD), { body: guildCommands });
      console.log(`✓ ${r.length} commandes guild OK`);
    } catch(e) { console.error('Erreur guild:', e.message); }
  }

  console.log('');
  console.log('=== TOUTES LES COMMANDES RESTAURÉES ! ===');
})();
