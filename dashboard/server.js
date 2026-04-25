// ============================================================
// dashboard/server.js — Serveur web NexusBot Dashboard
// Express + Socket.io + Discord OAuth2 + EJS
// Démarre automatiquement avec le bot via start()
// ============================================================
'use strict';

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const session     = require('express-session');
const path        = require('path');
const fs          = require('fs');
const ejs         = require('ejs');

const { router: authRouter, injectUser } = require('./routes/auth');
const { router: apiRouter, setClient }   = require('./routes/api');

// ── Config ────────────────────────────────────────────────
const PORT           = parseInt(process.env.DASHBOARD_PORT || process.env.PORT || 3001);
const SESSION_SECRET = process.env.SESSION_SECRET || 'nexusbot-dashboard-secret-changeme';
const VIEWS_DIR      = path.join(__dirname, 'views');
const PUBLIC_DIR     = path.join(__dirname, 'public');

// ── Application ───────────────────────────────────────────
const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

// ── Store sessions en mémoire (sans warning production) ───
class SilentMemoryStore extends session.Store {
  constructor() {
    super();
    this._store = new Map();
    // Nettoyage automatique toutes les 15 min (sessions expirées)
    setInterval(() => {
      const now = Date.now();
      for (const [sid, sess] of this._store) {
        if (sess.cookie && sess.cookie.expires && new Date(sess.cookie.expires) < now) {
          this._store.delete(sid);
        }
      }
    }, 15 * 60 * 1000).unref();
  }
  get(sid, cb)     { cb(null, this._store.get(sid) ?? null); }
  set(sid, s, cb)  { this._store.set(sid, s); cb(); }
  destroy(sid, cb) { this._store.delete(sid); cb(); }
  length(cb)       { cb(null, this._store.size); }
  clear(cb)        { this._store.clear(); cb(); }
}

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use(session({
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store:             new SilentMemoryStore(),
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7j
}));

// ── Intercepteur logs → Socket.io ─────────────────────────
const originalLog   = console.log.bind(console);
const originalError = console.error.bind(console);
const originalWarn  = console.warn.bind(console);

function emitLog(level, args) {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  io.emit('log', { level, msg, time: new Date().toISOString() });
}

console.log   = (...a) => { originalLog(...a);   emitLog('info',  a); };
console.error = (...a) => { originalError(...a); emitLog('error', a); };
console.warn  = (...a) => { originalWarn(...a);  emitLog('warn',  a); };

// ── Rendu EJS inline (sans moteur de vue) ─────────────────
async function renderView(file, locals = {}) {
  const p = path.join(VIEWS_DIR, file);
  if (!fs.existsSync(p)) return `<h1>Vue introuvable : ${file}</h1>`;
  const tpl = fs.readFileSync(p, 'utf-8');
  return ejs.render(tpl, locals, { filename: p });
}

// ── Routes principales ────────────────────────────────────
app.use(injectUser);

// Accueil / dashboard
app.get(['/', '/dashboard'], async (req, res) => {
  try {
    const html = await renderView('index.html', { user: req.session?.user ?? null });
    res.send(html);
  } catch (e) {
    console.error('[Dashboard] Render error:', e.message);
    res.status(500).send('<h1>Erreur serveur</h1><pre>' + e.message + '</pre>');
  }
});

// Auth Discord OAuth2
app.use('/auth', authRouter);

// API REST
app.use('/api', apiRouter);

// 404
app.use((req, res) => {
  res.status(404).send(`
    <html><head><title>404</title>
    <style>body{font-family:sans-serif;background:#0d1117;color:#e6edf3;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:12px}</style>
    </head><body>
    <h1 style="font-size:5rem;margin:0">404</h1>
    <p style="color:#8b949e">Page introuvable</p>
    <a href="/" style="color:#5865F2">← Retour au dashboard</a>
    </body></html>
  `);
});

// ── Socket.io ─────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Dashboard] Client connecté: ${socket.id}`);
  socket.emit('log', { level: 'ok', msg: '✅ Connecté au dashboard NexusBot !', time: new Date().toISOString() });
  socket.on('disconnect', () => {
    originalLog(`[Dashboard] Client déconnecté: ${socket.id}`);
  });
});

// ── Export : démarrage depuis le bot ─────────────────────
function start(client = null) {
  if (client) {
    setClient(client);
    originalLog('[Dashboard] Client Discord injecté.');
  }

  httpServer.listen(PORT, () => {
    originalLog(`[Dashboard] ✅ Dashboard disponible sur http://localhost:${PORT}`);
    originalLog(`[Dashboard] URL publique : ${process.env.DASHBOARD_URL || `http://localhost:${PORT}`}`);
  });

  httpServer.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      originalLog(`[Dashboard] Port ${PORT} occupé — dashboard non démarré.`);
    } else {
      originalError('[Dashboard] Erreur serveur:', e.message);
    }
  });

  return { app, io, httpServer };
}

// Démarrage autonome (node dashboard/server.js)
if (require.main === module) {
  start(null);
}

module.exports = { start, app, io };
