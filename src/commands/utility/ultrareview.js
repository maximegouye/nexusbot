const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ultrareview')
    .setDescription('🔍 Revue complète — stats bot, économie, casino, tickets, partenariats')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Réservé aux admins / proprio du serveur
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: '❌ Commande réservée aux administrateurs.', ephemeral: true });
    }

    await interaction.deferReply();

    const gid = interaction.guild.id;
    const client = interaction.client;

    // ─── Bot stats ──────────────────────────────────────────
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const uptimeStr = `${h}h ${m}m ${s}s`;
    const ping = Math.round(client.ws.ping);
    const totalMembers = interaction.guild.memberCount;

    // ─── Économie ────────────────────────────────────────────
    let econStats = { total: 0, users: 0, top: null };
    try {
      const row = db.prepare(`SELECT SUM(balance + bank) as total, COUNT(*) as users FROM users WHERE guild_id = ?`).get(gid);
      if (row && (row.total || 0) > 0) {
        econStats.total = row.total || 0;
        econStats.users = row.users || 0;
        const top = db.prepare(`SELECT user_id, (balance + bank) as coins FROM users WHERE guild_id = ? ORDER BY (balance + bank) DESC LIMIT 1`).get(gid);
        if (top) econStats.top = top;
      }
    } catch (e) { /* table users n'existe pas ou colonne manquante */ }

    // ─── Tickets ─────────────────────────────────────────────
    let ticketStats = { open: 0, closed: 0, total: 0 };
    try {
      const all   = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?").get(gid);
      const open  = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = 'open'").get(gid);
      const close = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND status = 'closed'").get(gid);
      ticketStats.total  = all?.c  ?? 0;
      ticketStats.open   = open?.c ?? 0;
      ticketStats.closed = close?.c ?? 0;
    } catch (e) {}

    // ─── Casino ───────────────────────────────────────────────
    let casinoStats = { games: 0, bigWin: 0 };
    const casinoTables = ['casino_history', 'casino_stats', 'game_history'];
    for (const tbl of casinoTables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as games FROM ${tbl} WHERE guild_id = ?`).get(gid);
        if (row) {
          casinoStats.games = row.games || 0;
          try {
            const bw = db.prepare(`SELECT MAX(profit) as max FROM ${tbl} WHERE guild_id = ?`).get(gid);
            if (bw) casinoStats.bigWin = bw.max || 0;
          } catch(e) {}
          break;
        }
      } catch (e) {}
    }

    // ─── Partenariats ─────────────────────────────────────────
    let partnerStats = { total: 0, active: 0, pending: 0 };
    const partnerTables = ['partnerships', 'partenariats', 'partner_requests'];
    for (const tbl of partnerTables) {
      try {
        const all = db.prepare(`SELECT COUNT(*) as c FROM ${tbl} WHERE guild_id = ?`).get(gid);
        if (all) {
          partnerStats.total = all.c || 0;
          try {
            const active  = db.prepare(`SELECT COUNT(*) as c FROM ${tbl} WHERE guild_id = ? AND status = 'active'`).get(gid);
            const pending = db.prepare(`SELECT COUNT(*) as c FROM ${tbl} WHERE guild_id = ? AND status = 'pending'`).get(gid);
            partnerStats.active  = active?.c  ?? 0;
            partnerStats.pending = pending?.c ?? 0;
          } catch(e) {}
          break;
        }
      } catch (e) {}
    }

    // ─── XP / Leveling ────────────────────────────────────────
    let xpStats = { users: 0, topLevel: 0 };
    try {
      const row = db.prepare("SELECT COUNT(*) as users, MAX(level) as top FROM levels WHERE guild_id = ?").get(gid);
      if (row) { xpStats.users = row.users || 0; xpStats.topLevel = row.top || 0; }
    } catch(e) {}
    if (xpStats.users === 0) {
      try {
        const row = db.prepare("SELECT COUNT(*) as users, MAX(level) as top FROM leveling WHERE guild_id = ?").get(gid);
        if (row) { xpStats.users = row.users || 0; xpStats.topLevel = row.top || 0; }
      } catch(e) {}
    }

    // ─── Statut global ────────────────────────────────────────
    const systemStatus = [
      `💰 Économie : ${econStats.users > 0 ? '✅ Actif' : '⬜ Aucune donnée'}`,
      `🎰 Casino   : ${casinoStats.games > 0 ? '✅ Actif' : '⬜ Aucune donnée'}`,
      `🎫 Tickets  : ${ticketStats.total > 0 ? '✅ Actif' : '⬜ Aucune donnée'}`,
      `🤝 Partners : ${partnerStats.total > 0 ? '✅ Actif' : '⬜ Aucune donnée'}`,
      `⭐ XP/Level : ${xpStats.users > 0 ? '✅ Actif' : '⬜ Aucune donnée'}`,
    ].join('\n');

    // ─── Embed ────────────────────────────────────────────────
    const { EmbedBuilder: EB } = require('discord.js');
    const embed = new EB()
      .setColor(0x5865F2)
      .setTitle('🔍  Ultra Review — NexusBot')
      .setDescription(
        `**Serveur :** ${interaction.guild.name}\n` +
        `**Généré le :** <t:${Math.floor(Date.now() / 1000)}:f>\n\n` +
        `**Systèmes actifs**\n${systemStatus}`
      )
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        {
          name: '🤖  Bot',
          value: [
            `**Ping :** \`${ping}ms\``,
            `**Uptime :** \`${uptimeStr}\``,
            `**Membres :** ${totalMembers.toLocaleString('fr-FR')}`,
            `**Serveurs :** ${client.guilds.cache.size}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💰  Économie',
          value: [
            `**Joueurs :** ${econStats.users.toLocaleString('fr-FR')}`,
            `**Coins totaux :** ${(econStats.total || 0).toLocaleString('fr-FR')} 🪙`,
            econStats.top
              ? `**#1 :** <@${econStats.top.user_id}>\n↳ ${(econStats.top.coins || 0).toLocaleString('fr-FR')} 🪙`
              : '**#1 :** —',
          ].join('\n'),
          inline: true,
        },
        {
          name: '⭐  Leveling',
          value: [
            `**Joueurs XP :** ${xpStats.users.toLocaleString('fr-FR')}`,
            `**Niveau max :** ${xpStats.topLevel}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎰  Casino',
          value: [
            `**Parties :** ${casinoStats.games.toLocaleString('fr-FR')}`,
            casinoStats.bigWin > 0
              ? `**Plus gros gain :** ${casinoStats.bigWin.toLocaleString('fr-FR')} 🪙`
              : '**Plus gros gain :** —',
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎫  Tickets',
          value: [
            `🟢 **Ouverts :** ${ticketStats.open}`,
            `🔴 **Fermés :** ${ticketStats.closed}`,
            `📊 **Total :** ${ticketStats.total}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🤝  Partenariats',
          value: [
            `✅ **Actifs :** ${partnerStats.active}`,
            `⏳ **En attente :** ${partnerStats.pending}`,
            `📊 **Total :** ${partnerStats.total}`,
          ].join('\n'),
          inline: true,
        },
      )
      .setFooter({ text: `NexusBot Ultra Review • Demandé par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
