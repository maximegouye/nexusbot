/**
 * NexusBot — Comptes à Rebours Publics
 * /countdown — Créez des comptes à rebours pour événements, sorties, etc.
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS countdowns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    creator_id  TEXT NOT NULL,
    title       TEXT NOT NULL,
    emoji       TEXT DEFAULT '⏳',
    target_ts   INTEGER NOT NULL,
    channel_id  TEXT,
    msg_id      TEXT,
    notify      INTEGER DEFAULT 1,
    active      INTEGER DEFAULT 1,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

function parseDate(str) {
  // Format DD/MM/YYYY HH:MM ou DD/MM/YYYY
  const full  = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  const short = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (full) {
    const d = new Date(`${full[3]}-${full[2]}-${full[1]}T${full[4]}:${full[5]}:00`);
    return Math.floor(d.getTime() / 1000);
  }
  if (short) {
    const d = new Date(`${short[3]}-${short[2]}-${short[1]}T00:00:00`);
    return Math.floor(d.getTime() / 1000);
  }
  return null;
}

function formatTimeLeft(seconds) {
  if (seconds <= 0) return '🔴 Terminé !';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && d === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('countdown')
    .setDescription('⏳ Comptes à rebours publics')
    .addSubcommand(s => s.setName('creer')
      .setDescription('➕ Créer un compte à rebours')
      .addStringOption(o => o.setName('titre').setDescription('Nom de l\'événement').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('date').setDescription('Date cible : JJ/MM/AAAA ou JJ/MM/AAAA HH:MM').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji (optionnel)').setMaxLength(4))
      .addChannelOption(o => o.setName('salon').setDescription('Salon pour les annonces')))
    .addSubcommand(s => s.setName('voir')
      .setDescription('👁️ Voir un compte à rebours')
      .addIntegerOption(o => o.setName('id').setDescription('ID du compte à rebours').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les comptes à rebours actifs'))
    .addSubcommand(s => s.setName('supprimer')
      .setDescription('🗑️ Supprimer un compte à rebours')
      .addIntegerOption(o => o.setName('id').setDescription('ID').setRequired(true))),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;
    const now     = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const titre    = interaction.options.getString('titre');
      const dateStr  = interaction.options.getString('date');
      const emoji    = interaction.options.getString('emoji') || '⏳';
      const salon    = interaction.options.getChannel('salon');
      const targetTs = parseDate(dateStr);

      if (!targetTs) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format de date invalide ! Utilisez : `JJ/MM/AAAA` ou `JJ/MM/AAAA HH:MM`' });
      if (targetTs <= now) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ La date doit être dans le futur !' });
      if (targetTs > now + 365 * 86400 * 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 5 ans dans le futur !' });

      const result = db.db.prepare('INSERT INTO countdowns (guild_id, creator_id, title, emoji, target_ts, channel_id) VALUES (?,?,?,?,?,?)')
        .run(guildId, userId, titre, emoji, targetTs, salon?.id || null);
      const id = result.lastInsertRowid;

      const timeLeft = targetTs - now;
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`${emoji} Compte à Rebours #${id} — ${titre}`)
        .addFields(
          { name: '📅 Date cible',    value: `<t:${targetTs}:F>`,       inline: true },
          { name: '⏳ Temps restant', value: formatTimeLeft(timeLeft),   inline: true },
          { name: '🔔 Relatif',       value: `<t:${targetTs}:R>`,       inline: true },
        )
        .setFooter({ text: `Créé par ${interaction.user.username} • /countdown voir ${id}` })
        .setTimestamp();

      if (salon) {
        const msg = await salon.send({ embeds: [embed] }).catch(() => null);
        if (msg) db.db.prepare('UPDATE countdowns SET msg_id=? WHERE id=?').run(msg.id, id);
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'voir') {
      const id = parseInt(interaction.options.getInteger('id'));
      const cd = db.db.prepare('SELECT * FROM countdowns WHERE id=? AND guild_id=?').get(id, guildId);
      if (!cd) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Compte à rebours #${id} introuvable.` });

      const timeLeft = cd.target_ts - now;
      const pct      = Math.max(0, Math.min(100, Math.round((1 - timeLeft / (cd.target_ts - cd.created_at)) * 100)));
      const bar      = '█'.repeat(Math.floor(pct/5)) + '░'.repeat(20 - Math.floor(pct/5));

      const embed = new EmbedBuilder()
        .setColor(timeLeft > 0 ? '#3498db' : '#2ecc71')
        .setTitle(`${cd.emoji} Compte à Rebours #${id} — ${cd.title}`)
        .addFields(
          { name: '📅 Date cible',    value: `<t:${cd.target_ts}:F>`,   inline: true },
          { name: '⏳ Temps restant', value: formatTimeLeft(timeLeft),   inline: true },
          { name: '🔔 Dans',          value: `<t:${cd.target_ts}:R>`,   inline: true },
          { name: '📊 Progression',   value: `\`${bar}\` ${pct}%`,      inline: false },
        )
        .setFooter({ text: `Créé par <@${cd.creator_id}> le ${new Date(cd.created_at*1000).toLocaleDateString('fr-FR')}` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'liste') {
      const list = db.db.prepare('SELECT * FROM countdowns WHERE guild_id=? AND active=1 AND target_ts>=? ORDER BY target_ts ASC LIMIT 10').all(guildId, now);
      if (!list.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun compte à rebours actif !')] });
      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('⏳ Comptes à Rebours Actifs')
        .setDescription(list.map(cd => {
          const tl = cd.target_ts - now;
          return `**#${cd.id}** ${cd.emoji} **${cd.title}**\n> ${formatTimeLeft(tl)} — <t:${cd.target_ts}:R>`;
        }).join('\n\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getInteger('id'));
      const cd = db.db.prepare('SELECT * FROM countdowns WHERE id=? AND guild_id=?').get(id, guildId);
      if (!cd) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Compte à rebours #${id} introuvable.` });

      const canDel = cd.creator_id === userId || interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
      if (!canDel) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le créateur ou un admin peut supprimer ce compte à rebours.' });

      db.db.prepare('UPDATE countdowns SET active=0 WHERE id=?').run(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🗑️ Compte à rebours **#${id}** supprimé.`)] });
    }
  }
};
