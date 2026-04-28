const fs = require('fs');
const path = require('path');

const files = [
  'src/commands_guild/social/clans.js',
  'src/commands_guild/social/roleplay.js',
  'src/commands_guild/social/mariage.js',
  'src/commands_guild/social/checkin.js',
  'src/commands_guild/social/reputation.js',
  'src/commands_guild/social/mood_tracker.js',
  'src/commands_guild/social/statut_perso.js',
  'src/commands_guild/social/badges.js',
];

console.log('Vérification syntaxique des fichiers...\n');

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    require(filePath);
    console.log(`✓ ${file}`);
  } catch (e) {
    console.log(`✗ ${file}`);
    console.log(`  Erreur: ${e.message}\n`);
  }
});
