/**
 * ticketFollowUp.js
 * ─────────────────────────────────────────────────────────
 * Tâche cron : relances intelligentes des tickets
 *  - Relance utilisateur après 48h d'inactivité (quand le staff a répondu)
 *  - Alerte staff si ticket URGENT sans réponse après 4h
 *  - Reset automatique des alertes après activité
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');

// Migrations safe
try {
  const cols = db.db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!cols.includes('follow_up_sent'))  db.db.prepare('ALTER TABLE tickets ADD COLUMN follow_up_sent INTEGER DEFAULT 0').run();
  if (!cols.includes('staff_alerted'))   db.db.prepare('ALTER TABLE tickets ADD COLUMN staff_alerted INTEGER DEFAULT 0').run();
  if (!cols.includes('summary'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN summary TEXT').run();
  if (!cols.includes('trust_score'))     db.db.prepare('ALTER TABLE tickets ADD COLUMN trust_score INTEGER DEFAULT 75').run();
  if (!cols.includes('is_private'))      db.db.prepare('ALTER TABLE tickets ADD COLUMN is_private INTEGER DEFAULT 0').run();
  if (!cols.includes('voice_channel_id'))db.db.prepare('ALTER TABLE tickets ADD COLUMN voice_channel_id TEXT').run();
  if (!cols.includes('auto_assigned'))   db.db.prepare('ALTER TABLE tickets ADD COLUMN auto_assigned INTEGER DEFAULT 0').run();
  if (!cols.includes('subject'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN subject TEXT').run();
} catch {}

// Migrations guild_config
try {
  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('ticket_max_open'))       db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_max_open INTEGER DEFAULT 1').run();
  if (!gc.includes('ticket_eco_rewards'))    db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_eco_rewards INTEGER DEFAULT 1').run();
  if (!gc.includes('ticket_followup_hours')) db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_followup_hours INTEGER DEFAULT 48').run();
  if (!gc.includes('ticket_voice_category')) db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_voice_category TEXT').run();
  if (!gc.includes('ticket_msg_support'))    db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_msg_support TEXT').run();
  if (!gc.includes('ticket_msg_bug'))        db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_msg_bug TEXT').run();
  if (!gc.includes('ticket_msg_achat'))      db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_msg_achat TEXT').run();
  if (!gc.includes('ticket_msg_signalement'))db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_msg_signalement TEXT').run();
  if (!gc.includes('ticket_msg_partenariat'))db.db.prepare('ALTER TABLE guild_config ADD COLUMN ticket_msg_partenariat TEXT').run();
} catch {}

const FOLLOWUP_HOURS  = 48; // Relance utilisateur après 48h d'inactivité
const STAFF_ALERT_HRS = 4;  // Alerte staff : ticket urgent sans réponse

async function runTicketFollowUp(client) {
  const now = Math.floor(Date.now() / 1000);
  const openTickets = db.db.prepare("SELECT * FROM tickets WHERE status='open'").all();

  for (const ticket of openTickets) {
    try {
      const guild = client.guilds.cache.get(ticket.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(ticket.channel_id);
      if (!channel) {
        // Salon supprimé manuellement
        db.db.prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")
          .run(now, ticket.id);
        continue;
      }

      // Récupérer les derniers messages
      const msgs = await channel.messages.fetch({ limit: 3 }).catch(() => null);
      if (!msgs) continue;

      const lastMsg  = msgs.first();
      if (!lastMsg) continue;

      const inactiveHours = (now - Math.floor(lastMsg.createdTimestamp / 1000)) / 3600;

      // ── Relance utilisateur ────────────────────────────────────────────────
      // Dernier message = staff (≠ utilisateur, ≠ bot) + inactif depuis FOLLOWUP_HOURS
      if (
        inactiveHours >= FOLLOWUP_HOURS &&
        lastMsg.author.id !== ticket.user_id &&
        !lastMsg.author.bot &&
        !ticket.follow_up_sent
      ) {
        const hoursLeft = Math.ceil(FOLLOWUP_HOURS * 2 - inactiveHours);

        await channel.send({
          content: `<@${ticket.user_id}>`,
          embeds: [
            new EmbedBuilder()
              .setColor('#F1C40F')
              .setTitle('💬 Relance — As-tu encore besoin d\'aide ?')
              .setDescription(
                `Le staff a répondu à ce ticket il y a **${Math.floor(inactiveHours)}h** mais nous n'avons pas eu de retour de ta part.\n\n` +
                `• ✅ Problème résolu ? → Clique sur **Fermer le ticket**\n` +
                `• ❓ Encore besoin d'aide ? → Réponds ici maintenant !\n\n` +
                `> ⚠️ Sans réponse, ce ticket sera **automatiquement fermé dans ~${hoursLeft}h**.`
              )
              .setFooter({ text: `Ticket #${ticket.id} • Rappel automatique NexusBot` })
              .setTimestamp(),
          ],
        }).catch(() => {});

        db.db.prepare('UPDATE tickets SET follow_up_sent=1 WHERE id=?').run(ticket.id);
      }

      // ── Alerte staff : ticket urgent sans réponse ──────────────────────────
      // Dernier message = utilisateur + ticket urgent + pas de réponse depuis STAFF_ALERT_HRS
      if (
        ticket.priority === 'urgente' &&
        inactiveHours >= STAFF_ALERT_HRS &&
        lastMsg.author.id === ticket.user_id &&
        !ticket.staff_alerted
      ) {
        const cfg = db.db.prepare('SELECT * FROM guild_config WHERE guild_id=?').get(ticket.guild_id);

        await channel.send({
          content: cfg?.ticket_staff_role ? `<@&${cfg.ticket_staff_role}>` : undefined,
          embeds: [
            new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle('🚨 Ticket URGENT — Aucune réponse staff !')
              .setDescription(
                `Ce ticket urgent **n'a reçu aucune réponse** du staff depuis **${Math.floor(inactiveHours)}h** !\n\n` +
                `> L'utilisateur attend. Merci de traiter cette demande dès que possible.`
              )
              .addFields(
                { name: '👤 Utilisateur',    value: `<@${ticket.user_id}>`,      inline: true },
                { name: '⏰ Inactif depuis', value: `**${Math.floor(inactiveHours)}h**`, inline: true },
              )
              .setFooter({ text: `Ticket #${ticket.id} • Priorité URGENTE` })
              .setTimestamp(),
          ],
        }).catch(() => {});

        db.db.prepare('UPDATE tickets SET staff_alerted=1 WHERE id=?').run(ticket.id);
      }

      // ── Reset follow_up si l'utilisateur a répondu ────────────────────────
      if (ticket.follow_up_sent && lastMsg.author.id === ticket.user_id) {
        db.db.prepare('UPDATE tickets SET follow_up_sent=0 WHERE id=?').run(ticket.id);
      }

    } catch { /* Ignorer les erreurs par ticket */ }
  }
}

module.exports = { runTicketFollowUp };
