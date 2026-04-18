/**
 * NexusBot — Système i18n / textes personnalisables
 *
 * Permet à chaque serveur de PERSONNALISER n'importe quel libellé du bot
 * (boutons, titres, messages, placeholders) directement depuis Discord
 * via `&config` → 🗣️ Textes & libellés.
 *
 * Usage :
 *   const { t } = require('./i18n');
 *   t(guildId, db, 'btn.save', '💾 Sauvegarder');   // retourne le texte custom ou le défaut FR
 *
 * Les overrides sont stockés dans la table `guild_kv` avec la clé :
 *   ui:<id_du_texte>
 * ex: `ui:btn.save`, `ui:section.embeds.title`, etc.
 */

function t(guildId, db, key, defaultFr) {
  if (!guildId || !db || !key) return defaultFr || '';
  try {
    const stored = db.kvGet(guildId, 'ui:' + key, null);
    if (stored === null || stored === undefined || stored === '') return defaultFr || '';
    return typeof stored === 'string' ? stored : String(stored);
  } catch {
    return defaultFr || '';
  }
}

function setText(guildId, db, key, value) {
  if (!guildId || !db || !key) return false;
  if (value == null || value === '') {
    db.kvDelete(guildId, 'ui:' + key);
  } else {
    db.kvSet(guildId, 'ui:' + key, String(value));
  }
  return true;
}

function listTexts(guildId, db) {
  try { return (db.kvList(guildId, 'ui:') || []).map(r => ({ key: r.key.replace(/^ui:/, ''), value: r.value })); }
  catch { return []; }
}

/**
 * Catalogue des textes principaux éditables.
 * Sert à alimenter la section 🗣️ Textes & libellés pour que l'utilisateur voie
 * quels IDs il peut personnaliser. Les IDs non présents ici peuvent quand même
 * être ajoutés manuellement via `ui:monid`.
 */
const CATALOGUE = [
  // Boutons génériques
  { key: 'btn.back',        default: '← Menu principal' },
  { key: 'btn.back_list',   default: '← Liste' },
  { key: 'btn.new',         default: '➕ Nouveau' },
  { key: 'btn.create',      default: '➕ Créer' },
  { key: 'btn.add',         default: '➕ Ajouter' },
  { key: 'btn.edit',        default: '✏️ Modifier' },
  { key: 'btn.delete',      default: '🗑️ Supprimer' },
  { key: 'btn.send',        default: '📤 Envoyer' },
  { key: 'btn.save',        default: '💾 Sauvegarder' },
  { key: 'btn.reset',       default: '↩️ Réinitialiser' },
  { key: 'btn.cancel',      default: '❌ Annuler' },
  { key: 'btn.confirm',     default: '✅ Confirmer' },
  { key: 'btn.enable',      default: '▶️ Activer' },
  { key: 'btn.disable',     default: '⏸️ Désactiver' },
  { key: 'btn.toggle',      default: '🔁 Activer / Désactiver' },
  { key: 'btn.next',        default: '▶️' },
  { key: 'btn.prev',        default: '◀️' },
  // Titres
  { key: 'title.main',      default: '⚙️ Panneau de configuration' },
  { key: 'title.embeds',    default: '🎨 Éditeur d\'encarts' },
  { key: 'title.cmds',      default: '⚡ Commandes personnalisées' },
  { key: 'title.sys_msgs',  default: '📢 Messages système' },
  { key: 'title.shop',      default: '🛒 Boutique' },
  { key: 'title.antiraid',  default: '🛡️ Protection anti-raid' },
  { key: 'title.ai',        default: '🧠 Intelligence artificielle' },
  // Messages d'erreur fréquents
  { key: 'err.not_owner',   default: '❌ Ce panneau ne t\'appartient pas.' },
  { key: 'err.generic',     default: '❌ Une erreur est survenue. Réessaie plus tard.' },
  { key: 'err.no_perm',     default: '❌ Permission manquante.' },
  { key: 'err.not_found',   default: '❌ Introuvable.' },
  // Succès
  { key: 'ok.saved',        default: '✅ Enregistré.' },
  { key: 'ok.deleted',      default: '🗑️ Supprimé.' },
  { key: 'ok.created',      default: '✅ Créé.' },
];

module.exports = { t, setText, listTexts, CATALOGUE };
