// ============================================================
// ready.js — Enregistrement slash commands (guild-specific, instantané)
// ============================================================
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

// Guild ID hardcodé en fallback si HOME_GUILD_ID absent des env vars
const FALLBACK_GUILD_ID = '1492886135159128227';

function collectAllCommands(baseDir) {
  const commands = [];
  const seen     = new Set();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (e) { return; }

    for (const item of entries) {
      const full = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.includes('disabled') && item.name !== 'node_modules') {
        walk(full);
      } else if (item.name.endsWith('.js') && !item.name.includes('.bak')) {
        try {
          const cmd = require(full);
          if (cmd && cmd.data && typeof cmd.data.toJSON === 'function' && !seen.has(cmd.data.name)) {
            seen.add(cmd.data.name);
            commands.push(cmd.data.toJSON());
          }
        } catch (e) { /* ignore */ }
      }
    }
  }

  // Charge uniquement les dossiers de commandes (pas events, database, utils...)
  const cmdDirs = ['commands', 'commands_guild'];
  for (const d of cmdDirs) {
    walk(path.join(baseDir, d));
  }
  return commands;
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    const src      = path.join(__dirname, '..');
    const commands = collectAllCommands(src);
    console.log(`📦 ${commands.length} commandes trouvées: ${commands.map(c => c.name).join(', ')}`);

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini — skip enregistrement');
      return;
    }

    const rest    = new REST({ version: '10' }).setToken(token);
    const appId   = client.user.id;
    const guildId = process.env.HOME_GUILD_ID || FALLBACK_GUILD_ID;

    try {
      // Guild registration (instantané)
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
      console.log(`✅ ${commands.length} slash commands enregistrées (guild ${guildId}) !`);
      commands.forEach(c => console.log(`   /${c.name}`));
    } catch (error) {
      console.error('❌ Erreur registration guild:', error.message);
      // Fallback global si guild échoue
      try {
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ ${commands.length} slash commands enregistrées (global fallback) !`);
      } catch (e2) {
        console.error('❌ Erreur registration global:', e2.message);
      }
    }
  }
};
