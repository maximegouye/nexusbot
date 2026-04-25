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

    // ── Validation locale avant envoi ──────────────────────────
    function validateCommands(cmds) {
      const issues = [];
      function checkNode(node, path) {
        if (node.description && node.description.length > 100)
          issues.push(`${path}.description trop longue (${node.description.length} chars): "${node.description.slice(0,60)}..."`);
        if (node.name && node.name.length > 32)
          issues.push(`${path}.name trop long (${node.name.length} chars): "${node.name}"`);
        if (node.choices) node.choices.forEach((ch, i) => {
          if (typeof ch.name === 'string' && ch.name.length > 100)
            issues.push(`${path}.choices[${i}].name trop long (${ch.name.length}): "${ch.name}"`);
          if (typeof ch.value === 'string' && ch.value.length > 100)
            issues.push(`${path}.choices[${i}].value trop long (${ch.value.length}): "${ch.value}"`);
        });
        if (node.options) node.options.forEach((opt, i) => checkNode(opt, `${path}.options[${i}]`));
      }
      cmds.forEach((cmd, i) => checkNode(cmd, `commands[${i}](${cmd.name})`));
      return issues;
    }

    const validationIssues = validateCommands(commands);
    if (validationIssues.length > 0) {
      console.error('❌ Validation avant envoi — problèmes détectés:');
      validationIssues.forEach(issue => console.error('  •', issue));
    }

    try {
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands }
      );
      console.log(`✅ ${commands.length} slash commands enregistrées sur le serveur ${guildId} !`);
    } catch (error) {
      console.error('❌ Erreur guild registration:', error.message);
      if (error.rawError) console.error('   Détail:', JSON.stringify(error.rawError?.errors || error.rawError).slice(0, 500));
      // Fallback global
      try {
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log(`✅ ${commands.length} slash commands enregistrées globalement (fallback).`);
      } catch (e2) {
        console.error('❌ Erreur global registration:', e2.message);
        if (e2.rawError) console.error('   Détail:', JSON.stringify(e2.rawError?.errors || e2.rawError).slice(0, 500));
      }
    }
  }
};
