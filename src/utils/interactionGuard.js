// ============================================================
// interactionGuard.js — Système BULLETPROOF anti-erreur Discord
// ============================================================
// Garantit qu'AUCUNE interaction Discord ne reste sans réponse,
// jamais. Élimine les "L'application ne répond plus".
//
// PRINCIPE :
// 1. Watchdog timer : si le handler n'a rien ack après 2.5s,
//    on défère automatiquement (silencieux côté user).
// 2. Promise.race : le handler continue son travail en parallèle.
// 3. Try/catch global avec fallback graceful sur toutes les
//    erreurs. Logs centralisés pour debug post-mortem.
// 4. Helpers safeReply/safeUpdate/safeDefer qui ne plantent jamais.
// ============================================================

'use strict';

/**
 * Watchdog : si l'interaction n'a pas été acquittée à 2.5s,
 * on fait deferUpdate() automatiquement. Côté Discord, le user
 * verra juste un loading spinner qui disparaît, pas d'erreur.
 *
 * @param {Interaction} interaction - L'interaction Discord
 * @param {Promise} handlerPromise - La promise du handler à protéger
 * @returns {Promise<void>}
 */
async function withWatchdog(interaction, handlerPromise) {
  const WATCHDOG_MS = 2500; // Discord timeout = 3s, on prend marge
  let watchdogTriggered = false;

  const watchdogPromise = new Promise((resolve) => {
    setTimeout(async () => {
      if (interaction.replied || interaction.deferred) {
        resolve();
        return;
      }
      watchdogTriggered = true;
      try {
        // Pour boutons/menus → deferUpdate (silencieux)
        // Pour modal submits → deferReply ephemeral
        if (interaction.isModalSubmit?.()) {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true }).catch(() => {});
          }
        } else if (interaction.isButton?.() || interaction.isAnySelectMenu?.() || interaction.isStringSelectMenu?.()) {
          await interaction.deferUpdate();
        } else if (interaction.isChatInputCommand?.()) {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: false }).catch(() => {});
          }
        }
      } catch (_) { /* l'interaction a peut-être été ack entre temps */ }
      resolve();
    }, WATCHDOG_MS);
  });

  try {
    await Promise.race([handlerPromise, watchdogPromise]);
  } catch (_) { /* erreurs gérées en aval */ }

  // S'assurer que le handler a fini (en background si watchdog déclenché)
  if (watchdogTriggered) {
    handlerPromise.catch(err => {
      console.error('[guard] handler failed after watchdog:', err?.message || err);
    });
  }
  return { watchdogTriggered };
}

/**
 * Reply safely — tente reply, sinon followUp, sinon swallow.
 * Ne throw JAMAIS.
 */
async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp({ ...payload, ephemeral: payload.ephemeral !== false }).catch(() => null);
    }
    return await interaction.reply({ ...payload, ephemeral: payload.ephemeral !== false }).catch(() => null);
  } catch { return null; }
}

/**
 * EditReply safely — tente editReply, sinon followUp, sinon swallow.
 */
async function safeEditReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload).catch(() => null);
    }
    return await interaction.reply({ ...payload, ephemeral: payload.ephemeral !== false }).catch(() => null);
  } catch { return null; }
}

/**
 * Update safely — pour les boutons qui mettent à jour le message original.
 */
async function safeUpdate(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      // Si déjà répondu, fallback : modifier le message original via fetchReply + edit
      const msg = await interaction.fetchReply().catch(() => null);
      if (msg) return await msg.edit(payload).catch(() => null);
      return null;
    }
    return await interaction.update(payload).catch(() => null);
  } catch { return null; }
}

/**
 * Defer safely — selon le type d'interaction.
 */
async function safeDefer(interaction, opts = {}) {
  if (interaction.replied || interaction.deferred) return null;
  try {
    if (interaction.isButton?.() || interaction.isAnySelectMenu?.() || interaction.isStringSelectMenu?.()) {
      return await interaction.deferUpdate().catch(() => null);
    }
    return await interaction.deferReply({ ephemeral: opts.ephemeral !== false }).catch(() => null);
  } catch { return null; }
}

/**
 * Garantit qu'une interaction sera acquittée, peu importe ce qui se passe.
 * À appeler en fin de handleComponent ou execute.
 */
async function ensureAcked(interaction) {
  if (interaction.replied || interaction.deferred) return;
  try {
    if (interaction.isModalSubmit?.()) {
      await interaction.deferReply({ ephemeral: true });
    } else if (interaction.isButton?.() || interaction.isAnySelectMenu?.() || interaction.isStringSelectMenu?.()) {
      await interaction.deferUpdate();
    } else {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
      }
    }
  } catch { /* swallow */ }
}

/**
 * Loguer une erreur Discord avec contexte enrichi (pas critique si fail).
 */
function logError(context, err, meta = {}) {
  const m = err?.message || String(err);
  const code = err?.code || err?.rawError?.code;
  const summary = `[${context}] ${m}${code ? ` (code ${code})` : ''}`;
  console.error(summary);
  if (meta.cid)        console.error('  customId:', meta.cid);
  if (meta.userId)     console.error('  userId:', meta.userId);
  if (meta.guildId)    console.error('  guildId:', meta.guildId);
  if (err?.stack && !m.includes('Unknown interaction')) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
}

module.exports = {
  withWatchdog,
  safeReply,
  safeEditReply,
  safeUpdate,
  safeDefer,
  ensureAcked,
  logError,
};
