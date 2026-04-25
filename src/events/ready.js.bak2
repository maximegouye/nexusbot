// ============================================================
// ready.js — Enregistrement slash commands au démarrage
//            Guild-specific (instantané) + global fallback
// ============================================================
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

function collectAllCommands(baseDir) {
  const commands = [];
  const seen     = new Set();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.includes('disabled')) {
        walk(full);
      } else if (item.name.endsWith('.js') && !item.name.includes('.bak')) {
        try {
          // Clear cache so fresh require picks up latest code
          delete require.cache[require.resolve(full)];
          const cmd = require(full);
          if (cmd.data && cmd.data.toJSON && !seen.has(cmd.data.name)) {
            seen.add(cmd.data.name);
            commands.push(cmd.data.toJSON());
          }
        } catch (e) { /* ignore load errors */ }
      }
    }
  }

  walk(baseDir);
  return commands;
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    const src      = path.join(__dirname, '..');
    const commands = collectAllCommands(src);

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini — skip enregistrement commandes');
      return;
    }

    const rest    = new REST({ version: '10' }).setToken(token);
    const appId   = client.user.id;
    const guildId = process.env.HOME_GUILD_ID;

    try {
      if (guildId) {
        // Guild registration: instantané
        await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
        console.log(`✅ ${commands.length} slash commands enregistrées (guild ${guildId}) !`);
      } else {
        // Global fallback (jusqu'à 1h pour propager)
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ ${commands.length} slash commands enregistrées (global) !`);
      }
      commands.forEach(c => console.log(`   /${c.name}`));
    } catch (error) {
      console.error('❌ Erreur registration:', error.message);
    }
  }
};
