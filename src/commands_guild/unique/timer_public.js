const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS timers_publics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT,
    title TEXT, end_time INTEGER, created_by TEXT,
    active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const activeTimers = new Map();

function formatDuration(seconds) {
  if (seconds <= 0) return '**TERMINÉ !**';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || !parts.length) parts.push(`${s}s`);
  return parts.join(' ');
}

function parseDuration(str) {
  let secs = 0;
  const matches = str.match(/(\d+)\s*([jhdms])/gi) || [];
  for (const match of matches) {
    const val = parseInt(match);
    const unit = match.replace(/\d+\s*/g, '').toLowerCase();
    if (unit === 'j') secs += val * 86400;
    else if (unit === 'h') secs += val * 3600;
    else if (unit === 'm') secs += val * 60;
    else if (unit === 's') secs += val;
  }
  return secs;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timer')
    .setDescription('⏱️ Créez des timers publics visibles par tous')
    .addSubcommand(s => s.setName('creer').setDescription('⏱️ Créer un nouveau timer')
      .addStringOption(o => o.setName('titre').setDescription('Titre du timer').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 1h30m, 2j, 45m)').setRequired(true))
      .addChannelOption(o => o.setName('salon').setDescription('Salon où afficher le timer (actuel par défaut)')))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les timers actifs'))
    .addSubcommand(s => s.setName('annuler').setDescription('🗑️ Annuler un timer')
      .addIntegerOption(o => o.setName('id').setDescription('ID du timer').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === 'creer') {
      const titre = interaction.options.getString('titre');
      const dureeStr = interaction.options.getString('duree');
      const targetChannel = interaction.options.getChannel('salon') || interaction.channel;
      const duree = parseDuration(dureeStr);

      if (duree < 10) return interaction.editReply({ content: '❌ Durée trop courte (minimum 10 secondes).', ephemeral: true });
      if (duree > 30 * 86400) return interaction.editReply({ content: '❌ Durée trop longue (maximum 30 jours).', ephemeral: true });

      const endTime = Math.floor(Date.now() / 1000) + duree;

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`⏱️ ${titre}`)
        .setDescription(`⏳ Temps restant : **${formatDuration(duree)}**`)
        .addFields(
          { name: '🏁 Se termine', value: `<t:${endTime}:R>`, inline: true },
          { name: '👤 Créé par', value: `<@${userId}>`, inline: true },
        )
        .setFooter({ text: `Timer ID: ? • Mis à jour toutes les 30s` })
        .setTimestamp();

      await interaction.editReply({ content: '✅ Timer créé !', ephemeral: true });
      const msg = await targetChannel.send({ embeds: [embed] }).catch(() => null);
      if (!msg) return;

      const result = db.db.prepare('INSERT INTO timers_publics (guild_id, channel_id, message_id, title, end_time, created_by) VALUES (?,?,?,?,?,?)')
        .run(guildId, targetChannel.id, msg.id, titre, endTime, userId);
      const timerId = result.lastInsertRowid;

      // Mettre à jour le footer avec l'ID réel
      embed.setFooter({ text: `Timer #${timerId} • Mis à jour toutes les 30s` });
      await msg.edit({ embeds: [embed] }).catch(() => {});

      // Démarrer la mise à jour
      const interval = setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = endTime - now;
        const timerRecord = db.db.prepare('SELECT * FROM timers_publics WHERE id=? AND active=1').get(timerId);

        if (!timerRecord) { clearInterval(interval); activeTimers.delete(timerId); return; }

        const updEmbed = new EmbedBuilder()
          .setColor(remaining <= 0 ? '#E74C3C' : remaining <= 300 ? '#E67E22' : '#3498DB')
          .setTitle(`⏱️ ${titre}`)
          .setDescription(remaining <= 0 ? '🎉 **TERMINÉ !**' : `⏳ Temps restant : **${formatDuration(remaining)}**`)
          .addFields(
            { name: '🏁 Se termine', value: `<t:${endTime}:R>`, inline: true },
            { name: '👤 Créé par', value: `<@${userId}>`, inline: true },
          )
          .setFooter({ text: `Timer #${timerId}` })
          .setTimestamp();

        try {
          const channel2 = interaction.client.channels.cache.get(timerRecord.channel_id);
          if (channel2) {
            const msg2 = await channel2.messages.fetch(timerRecord.message_id).catch(() => null);
            if (msg2) await msg2.edit({ embeds: [updEmbed] }).catch(() => {});
          }
        } catch {}

        if (remaining <= 0) {
          clearInterval(interval);
          activeTimers.delete(timerId);
          db.db.prepare('UPDATE timers_publics SET active=0 WHERE id=?').run(timerId);
        }
      }, 30000);

      activeTimers.set(timerId, interval);
    }

    if (sub === 'liste') {
      const timers = db.db.prepare('SELECT * FROM timers_publics WHERE guild_id=? AND active=1 ORDER BY end_time ASC').all(guildId);
      if (!timers.length) return interaction.editReply({ content: '❌ Aucun timer actif.', ephemeral: true });

      const now = Math.floor(Date.now() / 1000);
      const desc = timers.map(t => {
        const remaining = t.end_time - now;
        return `**#${t.id}** ${t.title} — ${remaining > 0 ? formatDuration(remaining) : '🏁 Terminé'} • <t:${t.end_time}:R>`;
      }).join('\n');

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle('⏱️ Timers actifs').setDescription(desc)
      ], ephemeral: true });
    }

    if (sub === 'annuler') {
      const id = interaction.options.getInteger('id');
      const timer = db.db.prepare('SELECT * FROM timers_publics WHERE id=? AND guild_id=?').get(id, guildId);
      if (!timer) return interaction.editReply({ content: `❌ Timer #${id} introuvable.`, ephemeral: true });
      if (timer.created_by !== userId && !interaction.member.permissions.has(0x4000n)) {
        return interaction.editReply({ content: '❌ Vous ne pouvez annuler que vos propres timers.', ephemeral: true });
      }

      db.db.prepare('UPDATE timers_publics SET active=0 WHERE id=?').run(id);
      if (activeTimers.has(id)) { clearInterval(activeTimers.get(id)); activeTimers.delete(id); }

      return interaction.editReply({ content: `✅ Timer **#${id}** annulé.`, ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
