// ============================================================
// /diagnostic — Vérification santé du bot
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('diagnostic')
    .setDescription('🔍 Vérifie l\'état complet du bot (admin)'),

  async execute(interaction) {
    if (!interaction.member?.permissions?.has('ManageGuild')) {
      return interaction.editReply({ content: '❌ Réservé aux admins.', ephemeral: true });
    }

    const checks = [];

    // 1. DB accessible
    try {
      const cnt = db.db.prepare('SELECT COUNT(*) as c FROM users').get();
      checks.push({ ok: true, name: 'Base de données', detail: `${cnt?.c || 0} users enregistrés` });
    } catch (e) {
      checks.push({ ok: false, name: 'Base de données', detail: e.message });
    }

    // 2. Commands chargées
    try {
      const cmdCount = interaction.client.commands?.size || 0;
      checks.push({ ok: cmdCount > 50, name: 'Commandes chargées', detail: `${cmdCount} commandes` });
    } catch (e) {
      checks.push({ ok: false, name: 'Commandes chargées', detail: e.message });
    }

    // 3. Permissions du bot
    try {
      const me = interaction.guild.members.me;
      const perms = me.permissions;
      const can = {
        manageMessages: perms.has('ManageMessages'),
        manageRoles: perms.has('ManageRoles'),
        sendMessages: perms.has('SendMessages'),
        embedLinks: perms.has('EmbedLinks'),
        manageChannels: perms.has('ManageChannels'),
      };
      const missing = Object.entries(can).filter(([_, v]) => !v).map(([k]) => k);
      checks.push({
        ok: missing.length === 0,
        name: 'Permissions bot',
        detail: missing.length === 0 ? 'Toutes OK' : `Manque : ${missing.join(', ')}`,
      });
    } catch (e) {
      checks.push({ ok: false, name: 'Permissions bot', detail: e.message });
    }

    // 4. Tables critiques
    const tables = ['users', 'guild_config', 'shop', 'inventory', 'transactions', 'pets', 'achievements', 'mystery_box', 'daily_spin', 'properties'];
    for (const t of tables) {
      try {
        const r = db.db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
        checks.push({ ok: true, name: `Table \`${t}\``, detail: `${r?.c || 0} entrées` });
      } catch (e) {
        checks.push({ ok: false, name: `Table \`${t}\``, detail: 'Manquante !' });
      }
    }

    // 5. Latence
    const lat = interaction.client.ws.ping;
    checks.push({ ok: lat < 500, name: 'Latence WebSocket', detail: `${lat}ms` });

    // 6. Mémoire
    const mem = process.memoryUsage();
    const memMB = Math.round(mem.heapUsed / 1024 / 1024);
    checks.push({ ok: memMB < 500, name: 'Mémoire utilisée', detail: `${memMB} MB` });

    // 7. Uptime
    const up = process.uptime();
    const uph = Math.floor(up / 3600);
    const upm = Math.floor((up % 3600) / 60);
    checks.push({ ok: true, name: 'Uptime', detail: `${uph}h${String(upm).padStart(2,'0')}m` });

    // Build embed
    const okCount = checks.filter(c => c.ok).length;
    const koCount = checks.length - okCount;
    const embed = new EmbedBuilder()
      .setColor(koCount === 0 ? '#2ECC71' : koCount < 3 ? '#F1C40F' : '#E74C3C')
      .setTitle(`🔍 Diagnostic NexusBot — ${okCount}/${checks.length} OK`)
      .setDescription(checks.map(c => `${c.ok ? '✅' : '❌'} **${c.name}** — ${c.detail}`).join('\n'))
      .setFooter({ text: koCount === 0 ? 'Tout va bien !' : `${koCount} problème(s) détecté(s)` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
