/**
 * ticketAutoClose.js
 * - Avertissement à WARN_HOURS (24h) d'inactivité → rappel avec bouton "Je suis encore là"
 * - Fermeture auto à AUTO_CLOSE_HOURS (48h) → transcript + DM + suppression du salon
 */
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../database/db');

// Migration warn_sent (safe, exécuté une seule fois)
try {
  const cols = db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!cols.includes('warn_sent')) db.prepare('ALTER TABLE tickets ADD COLUMN warn_sent INTEGER DEFAULT 0').run();
} catch {}

const WARN_HOURS        = 24; // heures avant l'avertissement
const AUTO_CLOSE_HOURS  = 48; // heures avant fermeture auto

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

      const lastMsg = messages.first();
      const lastActivity = lastMsg
        ? Math.floor(lastMsg.createdTimestamp / 1000)
        : ticket.created_at;

      const inactiveHours = (Date.now() / 1000 - lastActivity) / 3600;

      // ── 1) AVERTISSEMENT à 24h ───────────────────────────────────
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
              `📌 Clique sur le bouton si tu as encore besoin d'aide, sinon il sera archivé.`
            )
            .setFooter({ text: `Seuil de fermeture : ${AUTO_CLOSE_HOURS}h d'inactivité` })
          ],
          components: [keepRow],
        }).catch(() => {});

        db.prepare('UPDATE tickets SET warn_sent=1 WHERE id=?').run(ticket.id);
        continue; // ← pas encore fermé
      }

      // ── 2) FERMETURE AUTO à 48h ──────────────────────────────────
      if (inactiveHours < AUTO_CLOSE_HOURS) continue;

      const cfg = db.prepare('SELECT * FROM guild_config WHERE guild_id=?').get(ticket.guild_id);

      // Générer transcript
      let transcriptBuffer;
      try {
        const { generateTranscript, getCatInfo, getPriInfo } = require('../commands/unique/ticket');
        transcriptBuffer = await generateTranscript(channel, ticket);
        const cat = getCatInfo(ticket.category);
        const pri = getPriInfo(ticket.priority);

        // Log dans le salon des tickets
        if (cfg?.ticket_log_channel) {
          const logCh = guild.channels.cache.get(cfg.ticket_log_channel);
          if (logCh) {
            await logCh.send({
              embeds: [new EmbedBuilder()
                .setColor('#FF9900')
                .setTitle(`⏰ Ticket auto-fermé — ${channel.name}`)
                .setDescription(`Inactif depuis **${Math.floor(inactiveHours)}h** (seuil : ${AUTO_CLOSE_HOURS}h)`)
                .addFields(
                  { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
                  { name: `${cat.emoji} Catégorie`, value: cat.label, inline: true },
                  { name: `${pri.emoji} Priorité`, value: pri.label, inline: true },
                  { name: '✋ Pris en charge', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : 'Non réclamé', inline: true },
                )
                .setTimestamp()
              ],
              files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` })],
            }).catch(() => {});
          }
        }

        // DM créateur avec transcript
        const creator = await guild.members.fetch(ticket.user_id).catch(() => null);
        if (creator) {
          creator.send({
            embeds: [new EmbedBuilder()
              .setColor('#FF9900')
              .setTitle('⏰ Ton ticket a été fermé automatiquement')
              .setDescription(
                `Ton ticket **${channel.name}** sur **${guild.name}** était inactif depuis **${Math.floor(inactiveHours)}h**.\n\n` +
                `Le transcript est ci-joint. Si tu as encore besoin d'aide, ouvre un nouveau ticket.`
              )
            ],
            files: [new AttachmentBuilder(transcriptBuffer, { name: `transcript-${channel.name}.txt` })],
          }).catch(() => {});
        }
      } catch {}

      // Marquer fermé en DB
      db.prepare("UPDATE tickets SET status='closed', closed_at=?, close_reason=? WHERE id=?")
        .run(Math.floor(Date.now() / 1000), `Auto-fermé (inactif ${Math.floor(inactiveHours)}h)`, ticket.id);

      // Message final dans le salon
      await channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#FF9900')
          .setTitle('⏰ Fermeture automatique')
          .setDescription(
            `Ce ticket est inactif depuis **${Math.floor(inactiveHours)}h**.\n` +
            `Il sera supprimé dans **10 secondes**.\n\n` +
            `Si tu avais encore besoin d'aide, ouvre un nouveau ticket depuis <#${cfg?.ticket_channel || 'le salon support'}>.`
          )
        ]
      }).catch(() => {});

      setTimeout(() => channel.delete().catch(() => {}), 10000);

    } catch { /* ignore ce ticket */ }
  }
}

module.exports = { autoCloseInactiveTickets };
