// ============================================================
// ready.js — Auto-enregistrement des slash commands au démarrage
// ============================================================
const { REST, Routes } = require('discord.js');
const fs   = require('fs');
const path = require('path');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag}`);

    // Auto-enregistrement des slash commands
    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');

    try {
      const items = fs.readdirSync(commandsPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const subDir = path.join(commandsPath, item.name);
          const files  = fs.readdirSync(subDir).filter(f => f.endsWith('.js'));
          for (const file of files) {
            try {
              const cmd = require(path.join(subDir, file));
              if (cmd.data) commands.push(cmd.data.toJSON());
            } catch (e) { /* ignore */ }
          }
        } else if (item.name.endsWith('.js')) {
          try {
            const cmd = require(path.join(commandsPath, item.name));
            if (cmd.data) commands.push(cmd.data.toJSON());
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      console.error('❌ Erreur lecture commandes:', e.message);
      return;
    }

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini dans les variables d\'environnement');
      return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash commands enregistrées globalement!`);
      commands.forEach(c => console.log(`   /${c.name}`));
    } catch (error) {
      console.error('❌ Erreur registration:', error.message);
    }
  }
};
