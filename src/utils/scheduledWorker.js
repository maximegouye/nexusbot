/**
 * NexusBot — Worker pour les messages programmés (CRON)
 *
 * Lit la table `scheduled_messages` et envoie les messages quand l'expression
 * cron correspond. Utilise `node-cron` qui valide et interprète les expressions
 * cron standards (« m h j M J » — minute, heure, jour du mois, mois, jour de
 * semaine).
 *
 * Appelé depuis src/index.js au démarrage avec `startScheduledWorker(client)`.
 *
 * Précision : le worker reschedule toutes les 60 s pour récupérer les messages
 * créés / modifiés / désactivés depuis Discord.
 */

const cron = (() => { try { return require('node-cron'); } catch { return null; } })();
const db   = require('../database/db');
const { rebuildEmbedFromData, applyVarsToTemplate, safeJsonParse } = require('./configPanelAdvanced');

const _scheduled = new Map(); // scheduled_messages.id → cron.ScheduledTask

function startScheduledWorker(client) {
  if (!cron) {
    console.warn('[ScheduledWorker] node-cron indisponible, worker désactivé.');
    return;
  }
  refreshAll(client);
  // Rafraîchit la liste toutes les 60 s
  setInterval(() => refreshAll(client), 60_000);
  console.log('[ScheduledWorker] démarré (rafraîchissement toutes les 60 s).');
}

function refreshAll(client) {
  let rows = [];
  try {
    rows = db.db.prepare('SELECT * FROM scheduled_messages WHERE enabled = 1').all();
  } catch (e) {
    console.error('[ScheduledWorker] Lecture BDD échouée:', e.message);
    return;
  }

  const liveIds = new Set(rows.map(r => r.id));

  // Supprime les tâches dont l'entrée a été supprimée ou désactivée
  for (const [id, task] of _scheduled.entries()) {
    if (!liveIds.has(id)) {
      try { task.stop(); } catch {}
      _scheduled.delete(id);
    }
  }

  // Ajoute / remplace
  for (const row of rows) {
    const existing = _scheduled.get(row.id);
    if (existing && existing._cronExpr === row.cron) continue; // déjà planifié avec même expr
    if (existing) { try { existing.stop(); } catch {} _scheduled.delete(row.id); }

    if (!cron.validate(row.cron)) {
      console.warn(`[ScheduledWorker] Expression CRON invalide pour #${row.id}: "${row.cron}"`);
      continue;
    }

    const task = cron.schedule(row.cron, () => fire(client, row.id).catch(() => {}), { timezone: 'Europe/Paris' });
    task._cronExpr = row.cron;
    _scheduled.set(row.id, task);
  }
}

async function fire(client, id) {
  let row;
  try { row = db.db.prepare('SELECT * FROM scheduled_messages WHERE id = ? AND enabled = 1').get(id); }
  catch { return; }
  if (!row) return;

  const guild   = client.guilds.cache.get(row.guild_id);
  if (!guild) return;
  const channel = guild.channels.cache.get(row.channel_id) || await guild.channels.fetch(row.channel_id).catch(() => null);
  if (!channel || !channel.isTextBased || !channel.isTextBased()) return;

  const payload = {};
  try {
    if (row.content) payload.content = String(row.content).slice(0, 2000);
    if (row.embed_json) {
      const data = safeJsonParse(row.embed_json, null);
      if (data) {
        const eb = rebuildEmbedFromData(applyVarsToTemplate(data, {
          serverName: guild.name,
          memberCount: guild.memberCount,
        }));
        payload.embeds = [eb];
      }
    }
    if (!payload.content && !payload.embeds) return;
    await channel.send(payload);
    db.db.prepare('UPDATE scheduled_messages SET last_sent_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);
  } catch (e) {
    console.error(`[ScheduledWorker] Envoi #${id} échoué:`, e.message);
  }
}

module.exports = { startScheduledWorker };
