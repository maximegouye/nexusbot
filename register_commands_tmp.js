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

// ══════════════════════════════════════════════════════════════════
//  LIMITE 100 GUILD COMMANDS — Déduplication + Priorité + Cap
// ══════════════════════════════════════════════════════════════════

// Priorité par nom de commande (plus bas = plus prioritaire)
// Tout le reste obtient 5 et est accessible via &prefix seulement si >100
const GUILD_PRIORITY = {
  // Priorité 1 — Admin / sécurité serveur
  'admin': 1, 'econ-admin': 1, 'econ_admin': 1, 'setup-serveur': 1,
  'setup-verification': 1, 'staff-channel': 1, 'staff_channel': 1,
  'securite': 1, 'diagnostic': 1, 'reorder-categories': 1,
  'remboursement': 1,

  // Priorité 2 — Utilitaires essentiels guild
  'config': 2, 'panel': 2, 'logs': 2, 'automod': 2, 'sanctions': 2,
  'antiraid': 2, 'cfg-set': 2, 'embed': 2, 'tempvoice': 2,
  'modnote': 2, 'reactionroles': 2, 'candidature': 2, 'customcmd': 2,
  'nexus': 2, 'serveur': 2, 'activity-roles': 2, 'stats': 2,
  'qrcode': 2, 'applications': 2,

  // Priorité 3 — Jeux casino & games (cœur du bot)
  'casino': 3, 'blackjack': 3, 'roulette': 3, 'slots': 3, 'crash': 3,
  'mines': 3, 'baccarat': 3, 'des': 3, 'craps': 3, 'sicbo': 3,
  'war': 3, 'dragon-tiger': 3, 'keno': 3, 'plinko': 3, 'videopoker': 3,
  'slots-pro': 3, 'grattage': 3, 'mega-slots': 3, 'roue-fortune': 3,
  'aviator': 3, 'megaways': 3, 'gonzo': 3, 'gates-olympus': 3,
  'sweet-bonanza': 3, 'book-of-ra': 3, 'starburst': 3, 'hilo': 3,
  'coffre-magique': 3, 'wheel-mega': 3, 'mine': 3, 'musicquiz': 3,
  'casino-stats': 3,

  // Priorité 4 — Économie principale
  'classement': 4, 'shop': 4, 'boutique': 4, 'banque': 4, 'deposit': 4,
  'withdraw': 4, 'payer': 4, 'transfert': 4, 'bourse': 4, 'coffre': 4,
  'prestige': 4, 'loto': 4, 'lotto': 4, 'recompenses': 4, 'evenement': 4,
  'prison': 4, 'gamble': 4, 'chasser': 4, 'achievements': 4, 'vol': 4,
  'duel': 4, 'poker': 4, 'immobilier': 4, 'prison': 4,

  // Priorité 4 — Social & unique essentiels
  'clans': 4, 'badges': 4, 'statut-perso': 4, 'roleplay': 4,
  'anniversaire': 4, 'checkin': 4, 'mood-tracker': 4, 'mentor': 4,
  'reputation': 4, 'giveaway': 4, 'suggestion': 4, 'sondage': 4,
  'elections': 4, 'rpg': 4, 'famille': 4, 'pets': 4, 'inventaire': 4,
  'streaks': 4, 'cartes': 4, 'couleur': 4, 'events-manager': 4,
  'missions': 4, 'wiki': 4, 'starboard': 4,
};

// 1. Dédupliquer par nom (garder le premier chargé)
const seenNames = new Set();
const deduped = [];
for (const cmd of guildCommands) {
  if (!seenNames.has(cmd.name)) {
    seenNames.add(cmd.name);
    deduped.push(cmd);
  } else {
    console.log(`  ⚠️  Doublon ignoré : /${cmd.name}`);
  }
}

// 2. Trier par priorité (les plus importants d'abord)
deduped.sort((a, b) => {
  const pa = GUILD_PRIORITY[a.name] ?? 5;
  const pb = GUILD_PRIORITY[b.name] ?? 5;
  if (pa !== pb) return pa - pb;
  return a.name.localeCompare(b.name);
});

// 3. Limiter à 100 (le reste reste accessible via &prefix)
const MAX_GUILD = 100;
let prefixOnly = [];
if (deduped.length > MAX_GUILD) {
  prefixOnly = deduped.splice(MAX_GUILD);
  console.log(`\n⚡ ${deduped.length + prefixOnly.length} guild cmds → ${MAX_GUILD} slash enregistrées`);
  console.log(`   Accessibles via &prefix uniquement (${prefixOnly.length}): ${prefixOnly.map(c => '/' + c.name).join(', ')}`);
} else {
  console.log(`\n✓ ${deduped.length} guild commands (dans la limite de ${MAX_GUILD})`);
}

// Remplacer la liste originale
guildCommands.length = 0;
guildCommands.push(...deduped);
// ══════════════════════════════════════════════════════════════════

console.log(`\nChargé : ${allCommands.length} global, ${guildCommands.length} guild, ${menus.length} menus (${errors} erreurs ignorées)`);

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
  if (prefixOnly.length > 0) {
    console.log(`💡 ${prefixOnly.length} commandes accessibles via &nom (pas de slash) :`);
    console.log(`   ${prefixOnly.map(c => '&' + c.name).join(', ')}`);
  }
})();
