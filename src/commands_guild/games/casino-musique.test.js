// Simple syntax validation script
// Vérifier que le module peut être chargé sans erreur

const path = require('path');

try {
  // Essayer de charger le module
  const module = require('./casino-musique');

  // Vérifier que les exports requis existent
  if (!module.data) throw new Error('Missing: module.data (SlashCommandBuilder)');
  if (!module.execute) throw new Error('Missing: module.execute (function)');
  if (!module.tryPlayCasinoMusic) throw new Error('Missing: module.tryPlayCasinoMusic (function)');
  if (!module.activeConnections) throw new Error('Missing: module.activeConnections (Map)');

  // Vérifier les types
  if (typeof module.data !== 'object') throw new Error('Invalid: module.data should be SlashCommandBuilder');
  if (typeof module.execute !== 'function') throw new Error('Invalid: module.execute should be function');
  if (typeof module.tryPlayCasinoMusic !== 'function') throw new Error('Invalid: module.tryPlayCasinoMusic should be function');
  if (!(module.activeConnections instanceof Map)) throw new Error('Invalid: module.activeConnections should be Map');

  console.log('✓ casino-musique.js validation PASSED');
  console.log('  - module.data: SlashCommandBuilder');
  console.log('  - module.execute: function');
  console.log('  - module.tryPlayCasinoMusic: function');
  console.log('  - module.activeConnections: Map');

  process.exit(0);
} catch (err) {
  console.error('✗ casino-musique.js validation FAILED');
  console.error('  Error:', err.message);
  process.exit(1);
}
