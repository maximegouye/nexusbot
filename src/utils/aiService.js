/**
 * NexusBot — Service IA centralisé (Anthropic Claude + OpenAI compatible)
 *
 * Configuration via variables d'environnement (Railway Dashboard) :
 *   ANTHROPIC_API_KEY  → Claude (recommandé, provider par défaut)
 *   OPENAI_API_KEY     → GPT (fallback si Anthropic pas dispo)
 *   AI_DEFAULT_MODEL   → modèle par défaut (optionnel)
 *
 * Réglages per-guild via le panneau /config → 🧠 IA :
 *   - Toggle global
 *   - Provider (anthropic | openai | auto)
 *   - Modèle (claude-3-5-sonnet, claude-3-5-haiku, gpt-4o, gpt-4o-mini, ...)
 *   - Max tokens (réponse)
 *   - Rôle requis
 *   - Salons autorisés
 *   - Toggle "mention = question"
 *
 * Rate-limit : 5 req/user/min + 30 req/guild/min (tweakable via env).
 */

const https = require('https');

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT (en mémoire, TTL 60s)
// ═══════════════════════════════════════════════════════════════
const _userBuckets  = new Map(); // userId → { count, resetAt }
const _guildBuckets = new Map();
const USER_LIMIT  = parseInt(process.env.AI_USER_LIMIT  || '5',  10);
const GUILD_LIMIT = parseInt(process.env.AI_GUILD_LIMIT || '30', 10);

function _tick(bucket, key, limit) {
  const now = Date.now();
  let b = bucket.get(key);
  if (!b || now >= b.resetAt) { b = { count: 0, resetAt: now + 60_000 }; bucket.set(key, b); }
  if (b.count >= limit) return { allowed: false, retryIn: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { allowed: true };
}

function checkRateLimit(guildId, userId) {
  const u = _tick(_userBuckets,  userId,  USER_LIMIT);
  if (!u.allowed) return u;
  const g = _tick(_guildBuckets, guildId, GUILD_LIMIT);
  if (!g.allowed) return g;
  return { allowed: true };
}

// ═══════════════════════════════════════════════════════════════
// CONFIG PAR SERVEUR
// ═══════════════════════════════════════════════════════════════
const AI_DEFAULTS = {
  enabled:        0,
  provider:       'auto',               // 'auto' | 'anthropic' | 'openai'
  model:          'claude-3-5-haiku-20241022',
  max_tokens:     512,
  mention_reply:  0,                    // bot répond quand mentionné
  required_role:  null,
  allowed_channels: [],
  system_prompt:  null,                 // custom system prompt (optionnel)
};

function getAIConfig(guildId, db) {
  try {
    const raw = db.kvGet ? db.kvGet(guildId, 'ai_config', {}) : {};
    return { ...AI_DEFAULTS, ...(raw || {}) };
  } catch {
    return { ...AI_DEFAULTS };
  }
}

function setAIConfig(guildId, db, patch) {
  const current = getAIConfig(guildId, db);
  const next = { ...current, ...patch };
  db.kvSet(guildId, 'ai_config', next);
  return next;
}

// ═══════════════════════════════════════════════════════════════
// RESOLVE PROVIDER / API KEY
// ═══════════════════════════════════════════════════════════════
function resolveProvider(cfg) {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasOpenAI    = !!process.env.OPENAI_API_KEY;
  let provider = cfg.provider || 'auto';
  if (provider === 'auto') {
    if (hasAnthropic) provider = 'anthropic';
    else if (hasOpenAI) provider = 'openai';
    else provider = null;
  }
  if (provider === 'anthropic' && !hasAnthropic) return null;
  if (provider === 'openai'    && !hasOpenAI)    return null;
  return provider;
}

function isAvailable() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

// ═══════════════════════════════════════════════════════════════
// APPELS HTTP NATIFS (sans SDK — évite l'ajout de dépendance)
// ═══════════════════════════════════════════════════════════════
function httpJSON({ host, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      host, path, method: 'POST', headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers,
      },
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(chunks);
          if (res.statusCode >= 400) return reject(new Error(`${res.statusCode}: ${parsed.error?.message || parsed.message || chunks.slice(0,200)}`));
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Parse: ${e.message} — raw: ${chunks.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30_000, () => req.destroy(new Error('Timeout 30s')));
    req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
// ANTHROPIC
// ═══════════════════════════════════════════════════════════════
async function askAnthropic({ model, system, messages, maxTokens }) {
  const res = await httpJSON({
    host: 'api.anthropic.com',
    path: '/v1/messages',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: {
      model: model || 'claude-3-5-haiku-20241022',
      max_tokens: maxTokens || 512,
      system: system || undefined,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    },
  });
  const text = (res.content || []).map(c => c.text || '').join('').trim();
  const usage = res.usage || {};
  return { text, usage, provider: 'anthropic', model: res.model || model };
}

// ═══════════════════════════════════════════════════════════════
// OPENAI (chat completions, compatible aussi avec Groq, OpenRouter, etc.)
// ═══════════════════════════════════════════════════════════════
async function askOpenAI({ model, system, messages, maxTokens }) {
  const msgs = [];
  if (system) msgs.push({ role: 'system', content: system });
  for (const m of messages) msgs.push({ role: m.role, content: m.content });

  const host = process.env.OPENAI_API_HOST || 'api.openai.com';
  const res = await httpJSON({
    host,
    path: '/v1/chat/completions',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: {
      model: model || 'gpt-4o-mini',
      max_tokens: maxTokens || 512,
      messages: msgs,
    },
  });
  const text = res.choices?.[0]?.message?.content?.trim() || '';
  const usage = res.usage || {};
  return { text, usage, provider: 'openai', model: res.model || model };
}

// ═══════════════════════════════════════════════════════════════
// API PUBLIQUE
// ═══════════════════════════════════════════════════════════════
const DEFAULT_SYSTEM = (
  `Tu es NexusBot, un assistant Discord francophone, chaleureux, clair et concis. ` +
  `Tu réponds toujours en français par défaut (sauf si l'utilisateur s'exprime clairement dans une autre langue). ` +
  `Tu es utile, direct, sans bla-bla. Tu respectes les règles Discord. ` +
  `Si on te demande quelque chose de dangereux, illégal ou contraire aux ToS, tu refuses poliment. ` +
  `Tes réponses doivent tenir dans ~1800 caractères maximum pour s'afficher dans un embed Discord.`
);

/**
 * Pose une question à l'IA.
 * @param {object} opts
 * @param {string} opts.prompt
 * @param {string} [opts.system]
 * @param {Array<{role, content}>} [opts.history]
 * @param {string} [opts.guildId]
 * @param {string} [opts.userId]
 * @param {object} [opts.cfg] — config serveur (override)
 * @returns {Promise<{text, usage, provider, model}>}
 */
async function askAI({ prompt, system, history = [], guildId, userId, cfg }) {
  if (!isAvailable()) {
    throw new Error('Aucune clé API IA configurée (ANTHROPIC_API_KEY ou OPENAI_API_KEY).');
  }

  const provider = resolveProvider(cfg || AI_DEFAULTS);
  if (!provider) throw new Error('Provider indisponible pour ce serveur.');

  if (guildId && userId) {
    const rl = checkRateLimit(guildId, userId);
    if (!rl.allowed) {
      const e = new Error(`Limite atteinte. Réessaie dans ${rl.retryIn}s.`);
      e.code = 'RATE_LIMIT';
      e.retryIn = rl.retryIn;
      throw e;
    }
  }

  const messages = [
    ...(Array.isArray(history) ? history.slice(-8) : []),
    { role: 'user', content: String(prompt).slice(0, 6000) },
  ];

  const opts = {
    model:     cfg?.model || AI_DEFAULTS.model,
    system:    system || cfg?.system_prompt || DEFAULT_SYSTEM,
    messages,
    maxTokens: Math.min(2048, Math.max(64, parseInt(cfg?.max_tokens || AI_DEFAULTS.max_tokens, 10))),
  };

  if (provider === 'anthropic') return askAnthropic(opts);
  return askOpenAI(opts);
}

/**
 * Résume une liste de messages.
 */
async function summarize({ messages, guildId, userId, cfg, language = 'français' }) {
  const lines = messages.map(m => `[${m.authorName}] ${m.content}`).join('\n').slice(0, 12000);
  const prompt = `Voici une conversation Discord. Résume-la de façon claire et concise en ${language}, en 3-6 phrases maximum. Mets en gras les points importants. Ne liste pas message par message, fais un vrai résumé synthétique.\n\n=== MESSAGES ===\n${lines}\n=== FIN ===`;
  return askAI({
    prompt,
    system: `Tu es un assistant qui résume des conversations Discord en ${language}. Tu es factuel, synthétique et clair.`,
    guildId, userId, cfg,
  });
}

/**
 * Traduit un texte vers une langue cible.
 */
async function translate({ text, targetLang = 'français', guildId, userId, cfg }) {
  const prompt = `Traduis ce texte vers ${targetLang}. Donne UNIQUEMENT la traduction, sans commentaire ni explication :\n\n${text}`;
  return askAI({
    prompt,
    system: `Tu es un traducteur professionnel. Tu traduis fidèlement en ${targetLang}, en préservant le ton et les nuances. Tu ne donnes QUE la traduction, rien d'autre.`,
    guildId, userId, cfg,
  });
}

module.exports = {
  isAvailable,
  getAIConfig,
  setAIConfig,
  resolveProvider,
  checkRateLimit,
  askAI,
  summarize,
  translate,
  DEFAULT_SYSTEM,
  AI_DEFAULTS,
};
