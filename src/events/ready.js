// ============================================================
// ready.js — Enregistre les slash commands en deux lots :
//   • src/commands/       → global (tous serveurs, ≤ 130)
//   • src/commands_guild/ → guild  (HOME_GUILD_ID, ≤ 130)
// ============================================================
const { REST, Routes } = require('discord.js');
const { checkBumpReminders } = require('../utils/bumpReminderCheck');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`✅ Bot connecté: ${client.user.tag} (${client.user.id})`);

    // ── Notification de démarrage dans #gestion-tickets ────────────
    const LOG_CHANNEL_ID = '1494390992290054154'; // #gestion-tickets
    setTimeout(async () => {
      try {
        const logCh = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (logCh) await logCh.send(`🟢 **NexusBot redémarré** — v\`bf80220\` — commandes recrutement v2 enregistrées`).catch(() => {});
      } catch (_) {}
    }, 5000);

    // ── Bump Reminder — vérification toutes les 60 secondes ─
    checkBumpReminders(client).catch(() => {});
    setInterval(() => checkBumpReminders(client).catch(() => {}), 60_000);
    console.log('✅ Bump Reminder : checker démarré (60s interval, persistant DB)');

    const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
    if (!token) {
      console.error('❌ TOKEN non défini — skip enregistrement commandes');
      return;
    }

    const rest   = new REST({ version: '10' }).setToken(token);
    const appId  = client.user.id;
    const guildId = process.env.HOME_GUILD_ID || '1492886135159128227';

    // ── Validation locale ──────────────────────────────────
    function validateCommands(cmds, label) {
      const issues = [];
      function checkNode(node, path) {
        if (node.description && node.description.length > 100)
          issues.push(`${path}.description trop longue (${node.description.length} chars): "${node.description.slice(0, 60)}..."`);
        if (node.name && node.name.length > 32)
          issues.push(`${path}.name trop long (${node.name.length} chars): "${node.name}"`);
        if (node.choices) node.choices.forEach((ch, i) => {
          if (typeof ch.name  === 'string' && ch.name.length  > 100)
            issues.push(`${path}.choices[${i}].name trop long (${ch.name.length}): "${ch.name}"`);
          if (typeof ch.value === 'string' && ch.value.length > 100)
            issues.push(`${path}.choices[${i}].value trop long (${ch.value.length}): "${ch.value}"`);
        });
        if (node.options) node.options.forEach((opt, i) => checkNode(opt, `${path}.options[${i}]`));
      }
      cmds.forEach((cmd, i) => checkNode(cmd, `${label}[${i}](${cmd.name})`));
      return issues;
    }

    // ── Construction des tableaux JSON ─────────────────────
    const globalCmds = (client.globalCommandsList || [])
      .filter(d => d && typeof d.toJSON === 'function')
      .map(d => d.toJSON());

    const guildCmds = (client.guildCommandsList || [])
      .filter(d => d && typeof d.toJSON === 'function')
      .map(d => d.toJSON());

    console.log(`📦 Global: ${globalCmds.length} commandes | Guild: ${guildCmds.length} commandes`);

    // Validation
    const issues = [
      ...validateCommands(globalCmds, 'global'),
      ...validateCommands(guildCmds, 'guild'),
    ];
    if (issues.length > 0) {
      console.error('❌ Validation avant envoi — problèmes détectés:');
      issues.forEach(issue => console.error('  •', issue));
    } else {
      console.log('✅ Validation OK — aucun problème détecté');
    }

    // ── Enregistrement GUILD commands ──────────────────────
    try {
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: guildCmds }
      );
      console.log(`✅ ${guildCmds.length} guild commands enregistrées sur ${guildId}`);
    } catch (error) {
      console.error('❌ Erreur guild registration:', error.message);
      if (error.rawError) {
        console.error('   rawError.errors:', JSON.stringify(error.rawError.errors, null, 2));
        if (!error.rawError.errors) {
          console.error('   rawError complet:', JSON.stringify(error.rawError, null, 2));
        }
      }
    }

    // ── Enregistrement GLOBAL commands ─────────────────────
    try {
      await rest.put(
        Routes.applicationCommands(appId),
        { body: globalCmds }
      );
      console.log(`✅ ${globalCmds.length} global commands enregistrées`);
    } catch (error) {
      console.error('❌ Erreur global registration:', error.message);
      if (error.rawError) {
        console.error('   rawError.errors:', JSON.stringify(error.rawError.errors, null, 2));
        if (!error.rawError.errors) {
          console.error('   rawError complet:', JSON.stringify(error.rawError, null, 2));
        }
      }
    }
  }
};
