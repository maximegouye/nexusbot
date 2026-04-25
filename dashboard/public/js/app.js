// ============================================================
// NexusBot Dashboard — app.js
// Frontend SPA : navigation, API calls, charts, sockets
// ============================================================

const App = (() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────
  let currentPage  = null;
  let charts       = {};
  let socket       = null;
  let statsCache   = null;
  let lbCache      = null;
  let cmdsCache    = null;
  let logBuffer    = [];
  const MAX_LOGS   = 300;

  // ── Utils ──────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const fmt = (n) => (n || 0).toLocaleString('fr-FR');
  const fmtDur = (s) => {
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}j ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // ── Toast ──────────────────────────────────────────────────
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span><span class="toast-msg">${msg}</span>`;
    const container = $('#toast-container');
    if (container) container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Navigation SPA ─────────────────────────────────────────
  function navigate(page) {
    if (page === currentPage) return;
    currentPage = page;

    $$('.sidebar-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    $$('[data-view]').forEach(v => {
      v.style.display = v.dataset.view === page ? '' : 'none';
    });

    const titles = {
      home:        '🏠 Accueil',
      economy:     '💰 Économie',
      commands:    '📋 Commandes',
      admin:       '⚙️ Administration',
      premium:     '✨ Premium',
      logs:        '📊 Logs en direct',
    };
    const topTitle = $('#topbar-title');
    if (topTitle) topTitle.textContent = titles[page] || 'Dashboard';

    window.history.pushState({}, '', `#${page}`);

    // Charger les données de la page
    switch (page) {
      case 'home':     loadHome(); break;
      case 'economy':  loadEconomy(); break;
      case 'commands': loadCommands(); break;
      case 'logs':     initLogs(); break;
    }
  }

  // ── API Helper ─────────────────────────────────────────────
  async function api(endpoint) {
    try {
      const res = await fetch(`/api${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('[API]', endpoint, e.message);
      return null;
    }
  }

  // ── Page : Accueil ─────────────────────────────────────────
  async function loadHome() {
    const data = statsCache || await api('/stats');
    if (!data) return;
    statsCache = data;

    const { bot, eco } = data;

    // Cartes stats
    setInner('#stat-status',   `<span class="status-dot ${bot.status === 'online' ? 'online' : 'offline'}"></span> ${bot.status === 'online' ? 'En ligne' : 'Hors ligne'}`);
    setInner('#stat-guilds',   fmt(bot.guilds));
    setInner('#stat-users',    fmt(eco.totalPlayers));
    setInner('#stat-commands', fmt(bot.commandCount));
    setInner('#stat-uptime',   fmtDur(bot.uptime));
    setInner('#stat-ping',     bot.ping != null ? `${bot.ping}ms` : '—');
    setInner('#stat-coins',    fmt(eco.totalCoins));
    setInner('#stat-tag',      bot.tag || 'NexusBot');

    // Avater bot
    const botAvatar = $('#bot-avatar');
    if (botAvatar && bot.avatar) botAvatar.src = bot.avatar;

    // Graphique guildes
    renderGuildChart(data.guilds || []);
  }

  function renderGuildChart(guilds) {
    const ctx = $('#guild-chart');
    if (!ctx) return;
    if (charts.guild) charts.guild.destroy();

    const top5 = guilds.slice(0, 8);
    charts.guild = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top5.map(g => `Guild ${g.guild_id.slice(-4)}`),
        datasets: [{
          label: 'Membres actifs',
          data: top5.map(g => g.members),
          backgroundColor: 'rgba(88,101,242,.6)',
          borderColor: '#5865F2',
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b949e' } },
          y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8b949e' } },
        },
      },
    });
  }

  // ── Page : Économie ────────────────────────────────────────
  async function loadEconomy() {
    // Leaderboard
    const lb = lbCache || await api('/leaderboard?limit=50');
    if (lb) {
      lbCache = lb;
      renderLeaderboard(lb.data || []);
    }

    // Distribution des richesses
    const dist = await api('/wealth-distribution');
    if (dist) renderWealthChart(dist.data || []);
  }

  function renderLeaderboard(rows) {
    const tbody = $('#lb-tbody');
    if (!tbody) return;

    tbody.innerHTML = rows.map((r, i) => {
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
      const avatar = r.avatar ? `<img src="${r.avatar}" alt="" loading="lazy">` : `<div style="width:32px;height:32px;border-radius:50%;background:#5865F2;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8rem">${(r.username||'?')[0].toUpperCase()}</div>`;
      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
          <td>
            <div class="user-cell">
              ${avatar}
              <div>
                <div class="u-name">${escHtml(r.username)}</div>
                <div class="u-id">${r.userId.slice(0, 6)}…</div>
              </div>
            </div>
          </td>
          <td><strong>${fmt(r.balance)}</strong> 🪙</td>
          <td>${fmt(r.bank)} 🏦</td>
          <td><span class="badge badge-accent">💎 ${fmt(r.total)}</span></td>
        </tr>`;
    }).join('');
  }

  function renderWealthChart(data) {
    const ctx = $('#wealth-chart');
    if (!ctx) return;
    if (charts.wealth) charts.wealth.destroy();

    charts.wealth = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.range),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: ['#5865F2','#2ECC71','#F39C12','#E74C3C','#9B59B6'],
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b949e', padding: 16, boxWidth: 12 } },
        },
        cutout: '68%',
      },
    });
  }

  // ── Page : Commandes ───────────────────────────────────────
  async function loadCommands() {
    const res = cmdsCache || await api('/commands');
    if (!res) return;
    cmdsCache = res;

    renderCommandList(res.data || [], '');

    const search = $('#cmd-search');
    if (search) {
      search.addEventListener('input', () => {
        renderCommandList(res.data || [], search.value.trim().toLowerCase());
      });
    }
  }

  function renderCommandList(cmds, query) {
    const container = $('#cmd-list');
    if (!container) return;

    const filtered = query
      ? cmds.filter(c => c.name.includes(query) || c.description.toLowerCase().includes(query))
      : cmds;

    container.innerHTML = filtered.map(c => `
      <div class="card" style="margin-bottom:10px">
        <div class="card-body" style="padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <code style="background:var(--bg-hover);padding:3px 8px;border-radius:4px;font-size:.9rem;color:var(--accent)">/${c.name}</code>
              ${c.hasPrefix ? `<span class="badge badge-success" style="font-size:.7rem">&amp;${c.name}</span>` : ''}
              ${c.type === 'guild' ? '<span class="badge badge-muted" style="font-size:.7rem">Guild</span>' : ''}
            </div>
            <div style="font-size:.85rem;color:var(--text-secondary)">${escHtml(c.description)}</div>
          </div>
          ${c.aliases?.length ? `<div style="font-size:.78rem;color:var(--text-muted)">Alias: ${c.aliases.map(a => `<code>${a}</code>`).join(', ')}</div>` : ''}
        </div>
      </div>
    `).join('');

    const count = $('#cmd-count');
    if (count) count.textContent = `${filtered.length} commande${filtered.length !== 1 ? 's' : ''}`;
  }

  // ── Logs en direct ─────────────────────────────────────────
  function initLogs() {
    if (socket) return; // déjà connecté

    socket = io({ transports: ['websocket', 'polling'] });

    const console_ = $('#log-console');
    if (!console_) return;

    socket.on('log', (entry) => {
      logBuffer.push(entry);
      if (logBuffer.length > MAX_LOGS) logBuffer.shift();
      appendLog(console_, entry);
    });

    socket.on('connect',    () => appendLog(console_, { level:'ok',  msg:'Connecté au serveur de logs.' }));
    socket.on('disconnect', () => appendLog(console_, { level:'warn',msg:'Déconnecté — reconnexion...' }));

    // Rejouer buffer
    logBuffer.forEach(e => appendLog(console_, e));
  }

  function appendLog(container, entry) {
    const { level = 'info', msg = '', time } = entry;
    const t = time ? new Date(time).toLocaleTimeString('fr-FR') : new Date().toLocaleTimeString('fr-FR');
    const line = document.createElement('div');
    line.className = 'log-line fade-in';
    line.innerHTML = `<span class="log-time">${t}</span><span class="log-level ${level}">${level.toUpperCase()}</span><span class="log-msg">${escHtml(msg)}</span>`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;

    // Limite affichage
    while (container.children.length > MAX_LOGS) container.removeChild(container.firstChild);
  }

  // ── Recherche leaderboard ──────────────────────────────────
  function setupLbSearch() {
    const input = $('#lb-search');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase();
      $$('#lb-tbody tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });
  }

  // ── Sidebar mobile ──────────────────────────────────────────
  function setupMobile() {
    const toggle  = $('#menu-toggle');
    const sidebar = $('.sidebar');
    const overlay = $('#overlay');

    toggle?.addEventListener('click', () => {
      sidebar?.classList.toggle('open');
      overlay?.classList.toggle('show');
    });
    overlay?.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay?.classList.remove('show');
    });
  }

  // ── Escape HTML ────────────────────────────────────────────
  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function setInner(sel, html) {
    const el = $(sel);
    if (el) el.innerHTML = html;
  }

  // ── Premium CTA ────────────────────────────────────────────
  function setupPremium() {
    $$('.plan-cta').forEach(btn => {
      btn.addEventListener('click', () => {
        toast('Contacte-nous sur Discord pour activer le Premium ! 💎', 'success');
      });
    });
  }

  // ── Admin config ───────────────────────────────────────────
  function setupAdmin() {
    const form = $('#admin-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      toast('Configuration sauvegardée ! ✅');
    });
  }

  // ── Init ───────────────────────────────────────────────────
  function init() {
    setupMobile();
    setupPremium();
    setupAdmin();

    // Navigation via sidebar links
    $$('.sidebar-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });

    // Page depuis hash
    const hash = window.location.hash.replace('#', '') || 'home';
    navigate(hash);

    // Rafraîchir les stats toutes les 30s
    setInterval(() => {
      if (currentPage === 'home') {
        statsCache = null;
        loadHome();
      }
    }, 30_000);

    // Après le rendu du leaderboard
    setTimeout(setupLbSearch, 1000);
  }

  return { init, navigate, toast };
})();

document.addEventListener('DOMContentLoaded', App.init);
