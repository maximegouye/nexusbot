/**
 * ticketAutoClose.js
 * - Avertissement à WARN_HOURS (24h) d'inactivité → rappel avec bouton "Je suis encore là"
 * - Fermeture auto à AUTO_CLOSE_HOURS (48h) → résumé + transcript + DM + suppression du salon
 * - Récompense économie au staff ayant traité le ticket (note ≥ 4)
 */
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');

// Migrations safe
try {
  const cols = db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!cols.includes('warn_sent'))         db.prepare('ALTER TABLE tickets ADD COLUMN warn_sent INTEGER DEFAULT 0').run();
  if (!cols.includes('summary'))           db.prepare('ALTER TABLE tickets ADD COLUMN summary TEXT').run();
  if (!cols.includes('follow_up_sent'))    db.prepare('ALTER TABLE tickets ADD COLUMN follow_up_sent INTEGER DEFAULT 0').run();
  if (!cols.includes('staff_alerted'))     db.prepare('ALTER TABLE tickets ADD COLUMN staff_alerted INTEGER DEFAULT 0').run();
} catch {}

const WARN_HOURS       = 24; // heures avant l'avertissement
const AUTO_CLOSE_HOURS = 48; // heures avant fermeture auto

async function autoCloseInactiveTickets(client) {
  const openTickets = db.prepare("SELECT * FROM tickets WHERE status='open'").all();
  if (!openTickets.length) return;

  for (const ticket of openTickets) {
    try {
      const guild = client.guilds.cache.get(ticket.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(ticket.channel_id);
      if (!channel) {
        // Salon supprimé manuellement — nettoyer la DB
        db.prepare("UPDATE tickets SET status='closed', closed_at=? WHERE id=?")
          .run(Math.floor(Date.now() / 1000), ticket.id);
        continue;
      }

      // Récupérer le dernier message du salon
      const messages = await channel.messages.fetch({ limit: 1 }).catch(() => null);
      if (!messages) continue;

      const lastMsg      = messages.first();
      const lastActivity = lastMsg
        ? Math.floor(lastMsg.createdTimestamp / 1000)
        : ticket.created_at;

      const inactiveHours = (Date.now() / 1000 - lastActivity) / 3600;

      // ── 1) AVERTISSEMENT à 24h ───────────────────────────────────────────
      if (inactiveHours >= WARN_HOURS && inactiveHours < AUTO_CLOSE_HOURS && !ticket.warn_sent) {
        const hoursLeft = Math.ceil(AUTO_CLOSE_HOURS - inactiveHours);

        const keepRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_keepopen_${ticket.id}`)
            .setLabel('Je suis encore là !')
            .setEmoji('✋')
            .setStyle(ButtonStyle.Success),
        );

        await channel.send({
          content: `<@${ticket.user_id}>`,
          embeds: [new EmbedBuilder()
            .setColor('#FF9900')
            .setTitle('⏰ Ticket inactif — Fermeture prévue')
            .setDescription(
              `Ce ticket est inactif depuis **${Math.floor(inactiveHours)}h**.\n` +
              `Sans activité, il sera **automatiquement fermé dans ${hoursLeft}h**.\n\n` +
              `📌 Clique sur le bouton si tu as encore besoin d'aide, sinon il sera archivé automatiquement.`
            )
            .setFooter({ text: `Seuil de fermeture automatique : ${AUTO_CLOSE_HOURS}h d'inactivité` })
          ],
          components: [keepRow],
        }).catch(() => {});

        db.prepare('UPDATE tickets SET warn_sent=1 WHERE id=?').run(ticket.id);
        continue;
      }

      // ── 2) FERMETURE AUTO à 48h ──────────────────────────────────────────
      if (inactiveHours < AUTO_CLOSE_HOURS) continue;

      const cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id=?').get(ticket.guild_id);

      // Générer transcript + résumé
      let transcriptBuffer;
      let summaryText = '';
      try {
        const { generateTranscript, getCatInfo, getPriInfo } = require('../commands/unique/ticket');
        const { generateSummary } = require('./ticketIntelligence');

        // Récupérer tous les messages pour le résumé
        let allMessages = [];
        let before;
        for (let i = 0; i < 5; i++) {
          const fetched = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
          if (!fetched || !fetched.size) break;
          allMessages = allMessages.concat([...fetched.values()]);
          before = fetched.last()?.id;
          if (fetched.size < 100) break;
        }

        summaryText = generateSummary(allMessages, ticket);
        transcriptBuffer = await generateTranscript(channel, ticket);

        const cat = getCatInfo(ticket.category);
        const pri = getPriInfo(ticket.priority);

        // Sauvegarder le résumé en DB
        db.prepare('UPDATE tickets SET summary=? WHERE id=?').run(summaryText, ticket.id);

        // ── Log dans le salon des tickets ──
        if (cfg?.ticket_log_channel) {
          const logCh = guild.channels.cache.get(cfg.ticket_log_channel);
          if (logCh) {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle(`⏰ Ticket auto-fermé — ${channel.name}`)
                .setDescription(
                  `Inactif depuis **${Math.floor(inactiveHours)}h** (seuil : ${AUTO_CLOSE_HOURS}h)\n\n` +
                  `**Résumé :** ${summaryText}`
                )
                .addFields(
                  { name: '👤 Créateur',       value: `<@${ticket.user_id}>`,                                         inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label,                                                 inline: true },
                  { name: `${pri.emoji} Priorité`, value: pri.label,                                                  inline: true },
                  { name: '✋ Pris en charge', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Non réclamé',  inline: true },
                  { name: '⭐ Note',            value: ticket.rating ? `${'⭐'.repeat(ticket.rating)} ${ticket.rating}/5` : 'Non noté', inline: true },
                )
                .setTimestamp()
              ],
              files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` })],
            }).catch(() => {});
          }
        }

        // ── DM créateur avec transcript ──
        const creator = await guild.members.fetch(ticket.user_id).catch(() => null);
        if (creator) {
          creator.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF9900')
              .setTitle('⏰ Ton ticket a été fermé automatiquement')
              .setDescription(
                `Ton ticket **${channel.name}** sur **${guild.name}** était inactif depuis **${Math.floor(inactiveHours)}h**.\n\n` +
                `**Résumé :** ${summaryText}\n\n` +
                `Le transcript complet est ci-joint. Si tu as encore besoin d'aide, ouvre un nouveau ticket.`
              )
            ],
            files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` })],
          }).catch(() => {});
        }

        // ── Récompense économie au staff ayant traité (si note ≥ 4) ──
        if (ticket.claimed_by && ticket.rating >= 4 && cfg?.ticket_eco_rewards !== 0) {
          try {
            const { addCoins } = require('../database/db');
            addCoins(ticket.claimed_by, ticket.guild_id, 100);
          } catch {}
        }

      } catch (e) {
        console.error('[TICKET AUTO-CLOSE] Erreur transcript/résumé:', e.message);
      }

      // Marquer fermé en DB
      db.prepare("UPDATE tickets SET status='closed', closed_at=?, close_reason=?, follow_up_sent=0, staff_alerted=0 WHERE id=?")
        .run(Math.floor(Date.now() / 1000), `Auto-fermé (inactif ${Math.floor(inactiveHours)}h)`, ticket.id);

      // Supprimer le salon vocal lié s'il existe
      if (ticket.voice_channel_id) {
        const vc = guild.channels.cache.get(ticket.voice_channel_id);
        if (vc) vc.delete().catch(() => {});
      }

      // Message final dans le salon
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('⏰ Fermeture automatique')
          .setDescription(
            `Ce ticket est inactif depuis **${Math.floor(inactiveHours)}h**.\n` +
            `Il sera **supprimé dans 10 secondes**.\n\n` +
            (summaryText ? `**Résumé :** ${summaryText.slice(0, 300)}\n\n` : '') +
            `Si tu avais encore besoin d'aide, ouvre un nouveau ticket depuis <#${cfg?.ticket_channel || 'le salon support'}>.`
          )
        ]
      }).catch(() => {});

      setTimeout(() => channel.delete().catch(() => {}), 10000);

    } catch { /* ignore ce ticket */ }
  }
}

module.exports = { autoCloseInactiveTickets };
