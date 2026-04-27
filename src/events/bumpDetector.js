// ============================================================
// bumpDetector.js — Détecte le bump DISBOARD et sauvegarde
// en base de données (persistant entre les redémarrages).
// La vérification + envoi du rappel est gérée par
// bumpReminderCheck.js via setInterval dans ready.js.
// ============================================================
'use strict';

const { EmbedBuilder } = require('discord.js');
const db               = require('../database/db');

const DISBOARD_ID = '302050872383242240';

// ── Migration table bump_reminders ────────────────────────
try {
  db.db.prepare(`
    CREATE TABLE IF NOT EXISTS bump_reminders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id    TEXT NOT NULL,
      channel_id  TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      bumped_at   INTEGER NOT NULL,
      reminded    INTEGER DEFAULT 0
    )
  `).run();
  // Ajouter colonne bump_role si absente
  const cols = db.db.prepare("PRAGMA table_info(guild_config)").all().map(c => c.name);
  if (!cols.includes('bump_role'))
    db.db.prepare("ALTER TABLE guild_config ADD COLUMN bump_role TEXT").run();
} catch {}

// ── Détection du message de confirmation DISBOARD ─────────
function isDisboardBumpConfirm(message) {
  if (message.author.id !== DISBOARD_ID) return false;

  for (const embed of message.embeds) {
    const text = [
      embed.description || '',
      embed.title       || '',
      ...(embed.fields || []).map(f => f.value + f.name),
    ].join(' ').toLowerCase();

    if (
      text.includes('bump') &&
      (text.includes('2 hours')   || text.includes('2 heures') ||
       text.includes('done')      || text.includes('effectué') ||
       text.includes('successfully') || text.includes('next bump'))
    ) return true;
  }

  const content = (message.content || '').toLowerCase();
  return content.includes('bump') && (content.includes('done') || content.includes('next'));
}

// ── Module principal ──────────────────────────────────────
module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    if (message.author.id !== DISBOARD_ID || !message.guild) return;
    if (!isDisboardBumpConfirm(message)) return;

    const guildId   = message.guild.id;
    const channelId = message.channel.id;
    const now       = Math.floor(Date.now() / 1000);

    // Trouver qui a bumpé (message référencé ou dernier message humain)
    let bumperId = null;
    try {
      if (message.reference) {
        const ref = await message.channel.messages
          .fetch(message.reference.messageId).catch(() => null);
        if (ref) bumperId = ref.author?.id ?? null;
      }
      if (!bumperId) {
        const recent = await message.channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (recent) {
          const human = recent.find(m => !m.author.bot && m.id !== message.id);
          if (human) bumperId = human.author.id;
        }
      }
    } catch (_) {}

    // Sauvegarder en DB (marquer les anciens comme "reminded" pour éviter les doublons)
    db.db.prepare("UPDATE bump_reminders SET reminded=1 WHERE guild_id=? AND reminded=0")
      .run(guildId);
    db.db.prepare(
      "INSERT INTO bump_reminders (guild_id, channel_id, user_id, bumped_at, reminded) VALUES (?,?,?,?,0)"
    ).run(guildId, channelId, bumperId || '0', now);

    console.log(`[BumpDetector] Bump détecté sur "${message.guild.name}" par ${bumperId} — rappel dans 2h`);

    // Confirmation visuelle dans le salon
    await message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(
            `✅ **Bump enregistré !**\n` +
            `${bumperId ? `Merci <@${bumperId}> !` : ''} ` +
            `Je vous rappellerai dans **2 heures** pour rebumper. 🔔`
          )
          .setFooter({ text: 'NexusBot • Bump Reminder — persistant entre les redémarrages' }),
      ],
    }).catch(() => {});
  },
};
