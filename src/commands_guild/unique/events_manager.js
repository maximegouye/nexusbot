/**
 * NexusBot — Gestionnaire d'Événements du Serveur
 * /event — Créez, gérez et participez aux événements avec RSVP et rappels
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS server_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    creator_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    starts_at   INTEGER NOT NULL,
    ends_at     INTEGER,
    location    TEXT,
    max_players INTEGER DEFAULT 0,
    reward_coins INTEGER DEFAULT 0,
    status      TEXT DEFAULT 'upcoming',
    image_url   TEXT,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS event_rsvp (
    event_id INTEGER NOT NULL,
    user_id  TEXT NOT NULL,
    status   TEXT DEFAULT 'going',
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (event_id, user_id)
  )`).run();
} catch {}

function formatDate(ts) {
  if (!ts) return 'N/A';
  return new Date(ts * 1000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function parseDate(str) {
  // Format: DD/MM/YYYY HH:MM
  const [datePart, timePart] = str.split(' ');
  if (!datePart || !timePart) return null;
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, min] = timePart.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, min);
  return isNaN(d.getTime()) ? null : Math.floor(d.getTime() / 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('📅 Gérer les événements du serveur')
    .addSubcommand(s => s.setName('creer')
      .setDescription('➕ Créer un nouvel événement')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'événement').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('debut').setDescription('Date/heure de début (JJ/MM/AAAA HH:MM)').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Description').setMaxLength(500))
      .addStringOption(o => o.setName('lieu').setDescription('Lieu ou lien vocal').setMaxLength(200))
      .addStringOption(o => o.setName('fin').setDescription('Date/heure de fin (JJ/MM/AAAA HH:MM)')))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les prochains événements'))
    .addSubcommand(s => s.setName('info')
      .setDescription('🔍 Voir les détails d\'un événement')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))
    .addSubcommand(s => s.setName('participer')
      .setDescription('✅ S\'inscrire à un événement')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))
    .addSubcommand(s => s.setName('desister')
      .setDescription('❌ Se désister d\'un événement')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))
    .addSubcommand(s => s.setName('mes_events').setDescription('👤 Voir les événements auxquels tu es inscrit'))
    .addSubcommand(s => s.setName('terminer')
      .setDescription('🏁 Terminer un événement et distribuer les récompenses [Admin]')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))
    .addSubcommand(s => s.setName('annuler')
      .setDescription('🗑️ Annuler un événement [Admin]')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true))),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply();
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageEvents) || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (sub === 'creer') {
      if (!isAdmin) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé aux organisateurs (Gérer les événements).', ephemeral: true });
      const titre  = interaction.options.getString('titre');
      const debut  = parseDate(interaction.options.getString('debut'));
      if (!debut)  return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format de date invalide. Utilise JJ/MM/AAAA HH:MM.' });
      const fin    = interaction.options.getString('fin') ? parseDate(interaction.options.getString('fin')) : null;
      const desc   = interaction.options.getString('description');
      const lieu   = interaction.options.getString('lieu');
      const max    = parseInt(interaction.options.getString('max_joueurs')) || 0;
      const reward = parseInt(interaction.options.getString('recompense')) || 0;

      const result = db.db.prepare(`INSERT INTO server_events (guild_id, creator_id, title, description, starts_at, ends_at, location, max_players, reward_coins)
        VALUES (?,?,?,?,?,?,?,?,?)`).run(guildId, userId, titre, desc, debut, fin, lieu, max, reward);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Événement créé — #${result.lastInsertRowid}`)
        .addFields(
          { name: '📋 Titre', value: titre, inline: true },
          { name: '📅 Début', value: formatDate(debut), inline: true },
          { name: '📍 Lieu',  value: lieu || 'Non précisé', inline: true },
          { name: '👥 Max',   value: max === 0 ? 'Illimité' : `${max} joueurs`, inline: true },
          { name: '🎁 Récompense', value: `${reward} 🪙`, inline: true },
        )
        .setFooter({ text: `Les membres peuvent s'inscrire avec /event participer ${result.lastInsertRowid}` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'liste') {
      const now   = Math.floor(Date.now() / 1000);
      const events = db.db.prepare("SELECT * FROM server_events WHERE guild_id=? AND status='upcoming' AND starts_at >= ? ORDER BY starts_at ASC LIMIT 10").all(guildId, now);
      if (!events.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setTitle('📅 Événements à venir').setDescription('Aucun événement planifié pour l\'instant.\nUn admin peut en créer avec `/event creer`.').setFooter({ text: interaction.guild.name })] });

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📅 Événements de ${interaction.guild.name}`)
        .setThumbnail(interaction.guild.iconURL());

      for (const ev of events) {
        const rsvpCount = db.db.prepare("SELECT COUNT(*) as c FROM event_rsvp WHERE event_id=?").get(ev.id).c;
        embed.addFields({
          name: `#${ev.id} — ${ev.title}`,
          value: [
            `📅 ${formatDate(ev.starts_at)}`,
            ev.location ? `📍 ${ev.location}` : '',
            `👥 ${rsvpCount}${ev.max_players > 0 ? `/${ev.max_players}` : ''} inscrits`,
            ev.reward_coins > 0 ? `🎁 +${ev.reward_coins} 🪙` : '',
          ].filter(Boolean).join(' • '),
          inline: false,
        });
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'info') {
      const id = parseInt(interaction.options.getString('id'));
      const ev = db.db.prepare('SELECT * FROM server_events WHERE id=? AND guild_id=?').get(id, guildId);
      if (!ev) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Événement #${id} introuvable.` });

      const rsvps = db.db.prepare('SELECT * FROM event_rsvp WHERE event_id=? ORDER BY joined_at ASC').all(id);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📅 ${ev.title}`)
        .addFields(
          { name: '🗓️ Début',     value: formatDate(ev.starts_at),                           inline: true },
          { name: '🏁 Fin',       value: ev.ends_at ? formatDate(ev.ends_at) : 'Non défini', inline: true },
          { name: '📍 Lieu',      value: ev.location || 'Non précisé',                        inline: true },
          { name: '👥 Inscrits',  value: `${rsvps.length}${ev.max_players > 0 ? `/${ev.max_players}` : ''}`, inline: true },
          { name: '🎁 Récompense',value: ev.reward_coins > 0 ? `${ev.reward_coins} 🪙` : 'Aucune', inline: true },
          { name: '📌 Statut',    value: ev.status, inline: true },
        );
      if (ev.description) embed.setDescription(ev.description);
      if (rsvps.length > 0) {
        embed.addFields({ name: '✅ Participants', value: rsvps.slice(0, 10).map(r => `<@${r.user_id}>`).join(', ') + (rsvps.length > 10 ? ` +${rsvps.length-10}...` : ''), inline: false });
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'participer') {
      const id = parseInt(interaction.options.getString('id'));
      const ev = db.db.prepare("SELECT * FROM server_events WHERE id=? AND guild_id=? AND status='upcoming'").get(id, guildId);
      if (!ev) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Événement #${id} introuvable ou terminé.` });

      const count = db.db.prepare('SELECT COUNT(*) as c FROM event_rsvp WHERE event_id=?').get(id).c;
      if (ev.max_players > 0 && count >= ev.max_players) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cet événement est complet !' });

      const existing = db.db.prepare('SELECT * FROM event_rsvp WHERE event_id=? AND user_id=?').get(id, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Tu es déjà inscrit à cet événement !' });

      db.db.prepare('INSERT INTO event_rsvp (event_id, user_id) VALUES (?,?)').run(id, userId);
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Inscrit à "${ev.title}"`)
        .setDescription(`📅 ${formatDate(ev.starts_at)}${ev.location ? `\n📍 ${ev.location}` : ''}${ev.reward_coins > 0 ? `\n🎁 Tu recevras **${ev.reward_coins} 🪙** à la fin !` : ''}`)
        .setFooter({ text: `${count + 1}${ev.max_players > 0 ? `/${ev.max_players}` : ''} inscrits` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'desister') {
      const id = parseInt(interaction.options.getString('id'));
      const existing = db.db.prepare('SELECT * FROM event_rsvp WHERE event_id=? AND user_id=?').get(id, userId);
      if (!existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu n\'es pas inscrit à cet événement.' });
      db.db.prepare('DELETE FROM event_rsvp WHERE event_id=? AND user_id=?').run(id, userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`✅ Désistement confirmé pour l\'événement **#${id}**.`)] });
    }

    if (sub === 'mes_events') {
      const rsvps = db.db.prepare('SELECT er.*, se.title, se.starts_at, se.status FROM event_rsvp er JOIN server_events se ON se.id=er.event_id WHERE se.guild_id=? AND er.user_id=? ORDER BY se.starts_at ASC').all(guildId, userId);
      if (!rsvps.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Tu n\'es inscrit à aucun événement.')] });
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('👤 Mes Événements')
        .setDescription(rsvps.map(r => `${r.status === 'upcoming' ? '📅' : '✅'} **#${r.event_id}** — ${r.title} (${formatDate(r.starts_at)})`).join('\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'terminer') {
      if (!isAdmin) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.' });
      const id = parseInt(interaction.options.getString('id'));
      const ev = db.db.prepare('SELECT * FROM server_events WHERE id=? AND guild_id=?').get(id, guildId);
      if (!ev) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Événement #${id} introuvable.` });

      db.db.prepare("UPDATE server_events SET status='completed' WHERE id=?").run(id);
      const rsvps = db.db.prepare('SELECT * FROM event_rsvp WHERE event_id=?').all(id);

      let rewarded = 0;
      if (ev.reward_coins > 0) {
        for (const r of rsvps) {
          db.addCoins(r.user_id, guildId, ev.reward_coins);
          rewarded++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🏁 Événement terminé — ${ev.title}`)
        .setDescription(`${rsvps.length} participants${rewarded > 0 ? `\n💰 ${rewarded} membres ont reçu **${ev.reward_coins} 🪙** chacun` : ''}`);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'annuler') {
      if (!isAdmin) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.' });
      const id = parseInt(interaction.options.getString('id'));
      db.db.prepare("UPDATE server_events SET status='cancelled' WHERE id=? AND guild_id=?").run(id, guildId);
      db.db.prepare('DELETE FROM event_rsvp WHERE event_id=?').run(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🗑️ Événement **#${id}** annulé.`)] });
    }
  }
};
