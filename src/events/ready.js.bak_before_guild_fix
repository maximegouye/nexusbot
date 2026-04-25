// ============================================================
// ready.js — Auto-enregistrement des slash commands au démarrage
// ============================================================
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

function collectCommands(dir) {
  const commands = [];
  if (!fs.existsSync(dir)) return commands;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      const subDir = path.join(dir, item.name);
      const files  = fs.readdirSync(subDir).filter(f => f.endsWith('.js'));
      for (const file of files) {
        try {
          const cmd = require(path.join(subDir, file));
          if (cmd.data) commands.push(cmd.data.toJSON());
        } catch (e) { /* ignore */ }
      }
    } else if (item.name.endsWith('.js')) {
      try {
        const cmd = require(path.join(dir, item.name));
        if (cmd.data) commands.push(cmd.data.toJSON());
      } catch (e) { /* ignore */ }
    }
  }
  return commands;
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    const commandsPath     = path.join(__dirname, '../commands');
    const economyGuildPath = path.join(__dirname, '../commands_guild/economy');
    const uniqueGuildPath  = path.join(__dirname, '../commands_guild/unique');

    // Dé-dupliquer par nom de commande
    const seen = new Set();
    const commands = [];
    for (const dir of [commandsPath, economyGuildPath, uniqueGuildPath]) {
      for (const cmd of collectCommands(dir)) {
        if (!seen.has(cmd.name)) {
          seen.add(cmd.name);
          commands.push(cmd);
        }
      }
    }

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash commands enregistrées !`);
      commands.forEach(c => console.log(`   /${c.name}`));
    } catch (error) {
      console.error('❌ Erreur registration:', error.message);
    }
  }
};

