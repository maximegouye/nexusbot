/**
 * ticketIntelligence.js
 * ─────────────────────────────────────────────────────────
 * Moteur d'intelligence pour le système de tickets NexusBot v2
 * Fournit : détection auto, trust score, spam, auto-assign, ETA, suggestions
 */

// ── Mots-clés pour la détection automatique de priorité ──────────────────────
const URGENT_KEYWORDS = [
  'urgent', 'urgente', 'critique', 'asap', 'immédiat', 'immédiatement',
  'bloqué', 'bloquée', 'impossible', 'aide immédiate', 'tout de suite',
  'tout maintenant', 'problème grave', 'grave', 'catastrophe',
  'ne fonctionne plus', 'complètement cassé', 'down', 'hors service',
];
const HIGH_KEYWORDS = [
  'bug', 'erreur', 'error', 'plantage', 'crash', 'ne fonctionne',
  'dysfonctionnement', 'ne marche pas', 'ne marche plus', 'broken',
  'cassé', 'problème', 'souci', 'issue', 'problème technique',
];
const LOW_KEYWORDS = [
  'question', 'info', 'renseignement', 'comment', 'quand', 'pourquoi',
  'curiosité', 'demande', 'petite question', 'simplement',
];

// ── Mots-clés pour la détection automatique de catégorie ─────────────────────
const CATEGORY_KEYWORDS = {
  bug: [
    'bug', 'erreur', 'error', 'plantage', 'crash', 'dysfonctionnement',
    'ne fonctionne', 'broken', 'cassé', 'ne marche', 'problème technique',
    'bogue', 'défaut',
  ],
  achat: [
    'achat', 'paiement', 'premium', 'shop', 'boutique', 'acheter',
    'payé', 'facture', 'remboursement', 'commande', 'prix', 'abonnement',
    'subscription', 'refund', 'buy',
  ],
  signalement: [
    'signalement', 'signaler', 'report', 'abus', 'abuse', 'triche',
    'cheat', 'hack', 'harcèlement', 'insult', 'menace', 'comportement',
    'toxique', 'arnaque', 'fraude',
  ],
  partenariat: [
    'partenariat', 'partner', 'collab', 'collaboration', 'partenaire',
    'promotion', 'publicité', 'sponsoring', 'deal', 'accord',
  ],
};

// ── Mots-clés pour le mode privé automatique ─────────────────────────────────
const SENSITIVE_KEYWORDS = [
  'signalement', 'harcèlement', 'abus', 'personnel', 'privé',
  'confidentiel', 'paiement', 'carte', 'facture', 'coordonnées',
  'données personnelles', 'vie privée',
];

// ── Réponses rapides par défaut ───────────────────────────────────────────────
const DEFAULT_QUICK_REPLIES = {
  qr_welcome: (user, staff) =>
    `👋 Bonjour <@${user}> ! Je suis **${staff}** et je vais m'occuper de ta demande. Décris ton problème en détail et je t'aide dès que possible !`,
  qr_wait: (user) =>
    `⏳ Merci pour ta patience <@${user}> ! Nous examinons ta demande et te revenons dès que possible.`,
  qr_screenshot: () =>
    `📷 Pourrais-tu nous fournir des **captures d'écran** ou tout autre élément visuel pour mieux comprendre le problème ? Merci !`,
  qr_info: () =>
    `🔄 Pour mieux t'aider, j'ai besoin de plus de détails :\n\n• **Contexte** : Que faisais-tu exactement ?\n• **Étapes** : Comment reproduire le problème ?\n• **Erreurs** : Y a-t-il des messages d'erreur ?\n• **Tentatives** : Qu'as-tu déjà essayé ?`,
  qr_resolved: (user) =>
    `✅ Super, le problème semble être résolu ! <@${user}>, si tu as d'autres questions, n'hésite pas. Sinon, nous allons fermer ce ticket prochainement. Merci d'avoir contacté le support !`,
  qr_closing: (user) =>
    `🔒 <@${user}> — Ce ticket va être **fermé prochainement** faute d'activité. Si tu as encore besoin d'aide, envoie un message maintenant !`,
};

// ─────────────────────────────────────────────────────────────────────────────
// FONCTIONS D'INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détecte automatiquement la priorité à partir du texte.
 * @returns {string|null} 'urgente' | 'elevee' | 'faible' | null
 */
function detectAutoPriority(text) {
  if (!text) return null;
  const low = text.toLowerCase();
  if (URGENT_KEYWORDS.some(k => low.includes(k))) return 'urgente';
  if (HIGH_KEYWORDS.some(k => low.includes(k))) return 'elevee';
  if (LOW_KEYWORDS.some(k => low.includes(k))) return 'faible';
  return null;
}

/**
 * Détecte automatiquement la catégorie à partir du texte.
 * @returns {string|null} catégorie ou null
 */
function detectAutoCategory(text) {
  if (!text) return null;
  const low = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => low.includes(k))) return cat;
  }
  return null;
}

/**
 * Détermine si le contenu est sensible (mode privé).
 */
function isSensitiveContent(category, subject = '') {
  const low = subject.toLowerCase();
  return category === 'signalement' || SENSITIVE_KEYWORDS.some(k => low.includes(k));
}

/**
 * Calcule le score de confiance d'un utilisateur (0–100).
 */
function calcTrustScore(db, guildId, userId) {
  let score = 75; // base neutre

  try {
    // Avertissements : -12 par warn
    const warns = db.prepare(
      'SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?'
    ).get(guildId, userId)?.c || 0;
    score -= warns * 12;

    // Tickets fermés normalement : +3 par ticket (max +30)
    const closed = db.prepare(
      "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND status='closed'"
    ).get(guildId, userId)?.c || 0;
    score += Math.min(closed * 3, 30);

    // Notes de modération : -5 par note
    const notes = db.prepare(
      'SELECT COUNT(*) as c FROM mod_notes WHERE guild_id=? AND user_id=?'
    ).get(guildId, userId)?.c || 0;
    score -= notes * 5;

    // Blackliste : score à 0
    const blacklisted = db.prepare(
      'SELECT COUNT(*) as c FROM ticket_blacklist WHERE guild_id=? AND user_id=?'
    ).get(guildId, userId)?.c || 0;
    if (blacklisted) return 0;

    // Notes ≥ 4 données : +2 par note positive
    const goodRatings = db.prepare(
      "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND rating >= 4"
    ).get(guildId, userId)?.c || 0;
    score += goodRatings * 2;

    // Notes < 3 données : -5 par note négative
    const badRatings = db.prepare(
      "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND rating <= 2"
    ).get(guildId, userId)?.c || 0;
    score -= badRatings * 5;

  } catch {}

  return Math.max(0, Math.min(100, score));
}

/**
 * Retourne le label et l'emoji du score de confiance.
 */
function getTrustLabel(score) {
  if (score >= 80) return { emoji: '🟢', label: 'Fiable',          color: '#2ECC71' };
  if (score >= 60) return { emoji: '🟡', label: 'Neutre',          color: '#F1C40F' };
  if (score >= 40) return { emoji: '🟠', label: 'À surveiller',    color: '#E67E22' };
  if (score >= 20) return { emoji: '🔴', label: 'Risqué',          color: '#E74C3C' };
  return              { emoji: '⛔', label: 'Très risqué',      color: '#C0392B' };
}

/**
 * Détecte le spam / abus selon les tickets récents.
 * @returns {{ spam: boolean, reason?: string }}
 */
function detectSpam(db, guildId, userId) {
  try {
    // 3+ tickets créés dans la dernière heure
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const recentCount = db.prepare(
      'SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND created_at > ?'
    ).get(guildId, userId, oneHourAgo)?.c || 0;

    if (recentCount >= 3) {
      return { spam: true, reason: `Trop de tickets en peu de temps (${recentCount} en 1h)` };
    }

    // 2+ tickets ouverts simultanément
    const openCount = db.prepare(
      "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND status='open'"
    ).get(guildId, userId)?.c || 0;

    if (openCount >= 2) {
      return { spam: true, reason: `${openCount} tickets ouverts simultanément (max 1)` };
    }

    return { spam: false };
  } catch {
    return { spam: false };
  }
}

/**
 * Retourne le membre du staff avec le moins de tickets ouverts.
 * @returns {string|null} userId ou null
 */
async function getAutoAssignStaff(guild, guildId, staffRoleId, db) {
  if (!staffRoleId) return null;

  try {
    // Fetch tous les membres du rôle staff
    await guild.members.fetch().catch(() => {});
    const staffRole = guild.roles.cache.get(staffRoleId);
    if (!staffRole) return null;

    // Filtrer les bots et trier par charge (tickets ouverts)
    const candidates = staffRole.members
      .filter(m => !m.user.bot)
      .map(m => {
        const count = db.prepare(
          "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND claimed_by=? AND status='open'"
        ).get(guildId, m.id)?.c || 0;
        const isOnline = m.presence && m.presence.status !== 'offline';
        return { id: m.id, count, isOnline };
      });

    if (!candidates.length) return null;

    // Préférence : online first, puis le moins chargé
    const online = candidates.filter(c => c.isOnline);
    const pool   = online.length ? online : candidates;

    pool.sort((a, b) => a.count - b.count);
    return pool[0].id;
  } catch {
    return null;
  }
}

/**
 * Estime le temps de réponse moyen basé sur l'historique.
 * @returns {string|null} e.g. "~2h 30min"
 */
function estimateResponseTime(db, guildId) {
  try {
    const rows = db.prepare(
      'SELECT created_at, first_response_at FROM tickets WHERE guild_id=? AND first_response_at IS NOT NULL ORDER BY created_at DESC LIMIT 20'
    ).all(guildId);

    if (!rows.length) return null;

    const avgSecs = rows.reduce((s, r) => s + (r.first_response_at - r.created_at), 0) / rows.length;

    // Charge actuelle
    const openCount = db.prepare(
      "SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='open'"
    ).get(guildId)?.c || 0;

    // Ajuster selon la charge : +10% par ticket ouvert
    const adjusted = avgSecs * (1 + openCount * 0.1);

    const hours   = Math.floor(adjusted / 3600);
    const minutes = Math.floor((adjusted % 3600) / 60);

    if (hours > 0)   return `~${hours}h${minutes > 0 ? ` ${minutes}min` : ''}`;
    if (minutes > 0) return `~${minutes} min`;
    return '< 1 min';
  } catch {
    return null;
  }
}

/**
 * Suggère les réponses rapides les plus pertinentes selon le dernier message.
 * @returns {string[]} liste de valeurs quick reply
 */
function getStaffSuggestions(lastUserMessage) {
  if (!lastUserMessage) return [];

  const low = lastUserMessage.toLowerCase();
  const suggestions = [];

  if (/bug|erreur|ne fonctionne|crash|plantage/.test(low))
    suggestions.push('qr_screenshot', 'qr_info');

  if (/merci|résolu|ça marche|super|parfait|nickel|fonctionne maintenant/.test(low))
    suggestions.push('qr_resolved');

  if (/attendre|réponse|toujours|depuis|longtemps|encore/.test(low))
    suggestions.push('qr_wait');

  if (/comment|pourquoi|que faire|explication|comprends pas/.test(low))
    suggestions.push('qr_info');

  return [...new Set(suggestions)].slice(0, 3);
}

/**
 * Génère un résumé automatique du ticket à partir des messages.
 */
function generateSummary(messages, ticket) {
  const userMsgs = messages
    .filter(m => !m.author.bot && m.content && m.content.length > 10)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .slice(0, 8);

  if (!userMsgs.length) return '*(Aucun message utilisateur significatif)*';

  const totalMsgs   = messages.filter(m => !m.author.bot).length;
  const staffMsgs   = messages.filter(m => !m.author.bot && m.author.id !== ticket.user_id).length;
  const firstMsg    = userMsgs[0]?.content?.slice(0, 200) || '';
  const lastUserMsg = userMsgs[userMsgs.length - 1]?.content?.slice(0, 200) || '';

  let summary = `**Problème initial :** "${firstMsg.slice(0, 150)}${firstMsg.length > 150 ? '…' : ''}"\n`;
  summary += `**Échanges :** ${totalMsgs} messages utilisateur • ${staffMsgs} réponses staff`;

  if (lastUserMsg !== firstMsg) {
    summary += `\n**Dernier message :** "${lastUserMsg.slice(0, 100)}${lastUserMsg.length > 100 ? '…' : ''}"`;
  }

  return summary;
}

module.exports = {
  detectAutoPriority,
  detectAutoCategory,
  isSensitiveContent,
  calcTrustScore,
  getTrustLabel,
  detectSpam,
  getAutoAssignStaff,
  estimateResponseTime,
  getStaffSuggestions,
  generateSummary,
  DEFAULT_QUICK_REPLIES,
};
