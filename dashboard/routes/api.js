// ============================================================
// dashboard/routes/api.js — REST API du dashboard
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// Expose les données live du bot (injecté par server.js)
let _client = null;
function setClient(client) { _client = client; }

// ── Helpers ───────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString('fr-FR'); }

// ── GET /api/stats ────────────────────────────────────────
router.get('/stats', (req, res) => {
  const eco    = db.getEcoStats();
  const guilds = db.getGuilds();

  let botStats = {
    guilds: guilds.length,
    users:  eco.users || 0,
    uptime: process.uptime(),
    ping:   _client?.ws?.ping ?? null,
    status: _client ? 'online' : 'unknown',
    tag:    _client?.user?.tag ?? 'NexusBot',
    id:     _client?.user?.id ?? null,
    avatar: _client?.user?.avatarURL({ dynamic: true }) ?? null,
    commandCount: _client?.commands?.size ?? 0,
  };

  res.json({
    ok: true,
    bot: botStats,
    eco: {
      totalCoins:   eco.total_balance || 0,
      totalBank:    eco.total_bank || 0,
      avgBalance:   Math.floor(eco.avg_balance || 0),
      maxTotal:     eco.max_total || 0,
      totalPlayers: eco.users || 0,
    },
    guilds: guilds.slice(0, 20),
  });
});

// ── GET /api/leaderboard ──────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  const { guild, limit = 50 } = req.query;
  const rows = db.getLeaderboard(guild || null, Math.min(parseInt(limit) || 50, 200));

  // Enrichir avec les noms Discord si client disponible
  const enriched = await Promise.all(rows.map(async (row, i) => {
    let username = `Utilisateur ${row.user_id.slice(-4)}`;
    let avatar   = null;
    if (_client) {
      try {
        const u = await _client.users.fetch(row.user_id).catch(() => null);
        if (u) {
          username = u.globalName || u.username;
          avatar   = u.avatarURL({ size: 64 }) ?? null;
        }
      } catch (_) {}
    }
    return {
      rank:    i + 1,
      userId:  row.user_id,
      guildId: row.guild_id,
      username,
      avatar,
      balance: row.balance || 0,
      bank:    row.bank || 0,
      total:   row.total || 0,
    };
  }));

  res.json({ ok: true, data: enriched });
});

// ── GET /api/wealth-distribution ─────────────────────────
router.get('/wealth-distribution', (req, res) => {
  const { guild } = req.query;
  const rows = db.getWealthDistribution(guild || null);
  res.json({ ok: true, data: rows });
});

// ── GET /api/commands ─────────────────────────────────────
router.get('/commands', (req, res) => {
  if (!_client) return res.json({ ok: true, data: [] });

  const cmds = [];
  for (const [name, cmd] of _client.commands) {
    cmds.push({
      name,
      description: cmd.data?.description ?? '',
      category:    cmd.data?.name ?? name,
      type:        cmd._sourceDir ?? 'global',
      hasPrefix:   typeof cmd.run === 'function' || typeof cmd.aliases !== 'undefined',
      aliases:     cmd.aliases ?? [],
    });
  }
  res.json({ ok: true, data: cmds.sort((a, b) => a.name.localeCompare(b.name)) });
});

// ── GET /api/config/:guildId ──────────────────────────────
router.get('/config/:guildId', (req, res) => {
  const cfg = db.getConfig(req.params.guildId);
  res.json({ ok: true, data: cfg });
});

// ── GET /api/guilds ───────────────────────────────────────
router.get('/guilds', (req, res) => {
  const guilds = db.getGuilds();
  res.json({ ok: true, data: guilds });
});

module.exports = { router, setClient };
