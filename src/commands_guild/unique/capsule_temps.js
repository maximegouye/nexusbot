/**
 * NexusBot — Capsule Temporelle
 * /capsule — Envoie un message dans le futur !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS time_capsules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    message     TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    deliver_at  INTEGER NOT NULL,
    delivered   INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

function parseDelay(str) {
  // Ex: 1h, 3d, 2w, 1m, 6mo
  const match = str.match(/^(\d+)(s|m|h|d|w|mo)$/i);
  if (!match) return null;
  const [, num, unit] = match;
  const n = parseInt(num);
  const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, mo: 2592000 }[unit.toLowerCase()];
  return n * mult;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('capsule')
    .setDescription('⏳ Envoie un message dans le futur !')
    .addSubcommand(s => s.setName('envoyer')
      .setDescription('📨 Envoyer un message dans le futur')
      .addStringOption(o => o.setName('message').setDescription('Ton message pour le futur').setRequired(true).setMaxLength(1000))
      .addStringOption(o => o.setName('delai').setDescription('Délai : 1h, 3d, 2w, 1m, 6mo (max 365j)').setRequired(true))
      .addChannelOption(o => o.setName('salon').setDescription('Salon de livraison (défaut: ce salon)')))
    .addSubcommand(s => s.setName('mes_capsules').setDescription('📋 Voir tes capsules en attente'))
    .addSubcommand(s => s.setName('annuler')
      .setDescription('❌ Annuler une capsule')
      .addIntegerOption(o => o.setName('id').setDescription('ID de la capsule').setRequired(true))),

  cooldown: 10,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    if (sub === 'envoyer') {
      const message = interaction.options.getString('message');
      const delayStr = interaction.options.getString('delai');
      const salon   = interaction.options.getChannel('salon') || interaction.channel;

      const delaySec = parseDelay(delayStr);
      if (!delaySec) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format invalide. Exemples : `1h`, `3d`, `2w`, `1m`, `6mo`' });
      if (delaySec > 365 * 86400) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 365 jours !' });
      if (delaySec < 60) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Minimum 1 minute !' });

      const deliverAt = Math.floor(Date.now() / 1000) + delaySec;
      const result = db.db.prepare('INSERT INTO time_capsules (guild_id, user_id, message, channel_id, deliver_at) VALUES (?,?,?,?,?)').run(guildId, userId, message, salon.id, deliverAt);

      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('⏳ Capsule Temporelle créée !')
        .setDescription(`Ton message sera livré dans **${formatDelay(delaySec)}**`)
        .addFields(
          { name: '📋 Message',       value: message.slice(0, 100) + (message.length > 100 ? '...' : ''), inline: false },
          { name: '📅 Livraison',     value: `<t:${deliverAt}:F>`, inline: true },
          { name: '📍 Salon cible',   value: `${salon}`, inline: true },
          { name: '🔢 ID',            value: `#${result.lastInsertRowid}`, inline: true },
        )
        .setFooter({ text: 'Utilise /capsule mes_capsules pour voir tes capsules' });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'mes_capsules') {
      const capsules = db.db.prepare("SELECT * FROM time_capsules WHERE guild_id=? AND user_id=? AND delivered=0 ORDER BY deliver_at ASC").all(guildId, userId);
      if (!capsules.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune capsule en attente.')] });
      const embed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('⏳ Mes Capsules Temporelles')
        .setDescription(capsules.map(c => `**#${c.id}** — <t:${c.deliver_at}:R> → ${c.message.slice(0, 50)}${c.message.length > 50 ? '...' : ''}`).join('\n'))
        .setFooter({ text: `${capsules.length} capsule(s) en attente` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'annuler') {
      const id = parseInt(interaction.options.getString('id'));
      const cap = db.db.prepare('SELECT * FROM time_capsules WHERE id=? AND guild_id=? AND user_id=? AND delivered=0').get(id, guildId, userId);
      if (!cap) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Capsule #${id} introuvable ou déjà livrée.` });
      db.db.prepare('DELETE FROM time_capsules WHERE id=?').run(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🗑️ Capsule **#${id}** annulée.`)] });
    }
  }
};

function formatDelay(sec) {
  if (sec < 3600)  return `${Math.floor(sec/60)} minute(s)`;
  if (sec < 86400) return `${Math.floor(sec/3600)} heure(s)`;
  if (sec < 604800) return `${Math.floor(sec/86400)} jour(s)`;
  return `${Math.floor(sec/604800)} semaine(s)`;
}

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
