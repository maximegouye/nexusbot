// ============================================================
// ready.js — Enregistre les slash commands via client.commands
//            (Collection déjà chargée par index.js — fiable)
// ============================================================
const { REST, Routes } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag} (${client.user.id})`);

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini — skip enregistrement commandes');
      return;
    }

    // Récupère les commandes déjà chargées par index.js (client.commands Collection)
    const commands = client.commands
      ? [...client.commands.values()]
          .filter(cmd => cmd.data && typeof cmd.data.toJSON === 'function')
          .map(cmd => cmd.data.toJSON())
      : [];

    if (commands.length === 0) {
      console.warn('⚠️  client.commands vide — aucune commande à enregistrer');
      return;
    }

    console.log(`📦 ${commands.length} commandes trouvées: ${commands.map(c => c.name).join(', ')}`);

    const rest    = new REST({ version: '10' }).setToken(token);
    const appId   = client.user.id;
    const guildId = process.env.HOME_GUILD_ID || '1492886135159128227';

    try {
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash commands enregistrées sur le serveur ${guildId} !`);
      commands.forEach(c => {
        const subs = (c.options || []).filter(o => o.type === 1).map(o => o.name);
        console.log(`   /${c.name}${subs.length ? ' [' + subs.join(', ') + ']' : ''}`);
      });
    } catch (error) {
      console.error('❌ Erreur guild registration:', error.message);
      // Fallback global
      try {
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ ${commands.length} slash commands enregistrées globalement (fallback).`);
      } catch (e2) {
        console.error('❌ Erreur global registration:', e2.message);
      }
    }
  }
};
