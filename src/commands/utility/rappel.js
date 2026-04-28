const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS rappels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, channel_id TEXT,
    message TEXT, remind_at INTEGER,
    done INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

// Parse "1h30m", "2d", "45m", etc.
function parseDuration(str) {
  let total = 0;
  const regex = /(\d+)\s*(s|m|h|d|j|w|semaine|heure|minute|seconde|jour)/gi;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const n = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (['s', 'seconde'].includes(unit)) total += n;
    else if (['m', 'minute'].includes(unit)) total += n * 60;
    else if (['h', 'heure'].includes(unit)) total += n * 3600;
    else if (['d', 'j', 'jour'].includes(unit)) total += n * 86400;
    else if (['w', 'semaine'].includes(unit)) total += n * 604800;
  }
  return total;
}

// Vérifier les rappels (appeler depuis index.js idéalement, ou ici à chaque commande)
async function checkReminders(client) {
  const now = Math.floor(Date.now() / 1000);
  const due = db.db.prepare('SELECT * FROM rappels WHERE done=0 AND remind_at<=?').all(now);
  for (const r of due) {
    try {
      const ch = await client.channels.fetch(r.channel_id).catch(() => null);
      if (ch) {
        await ch.send({ embeds: [
          new EmbedBuilder().setColor('#F1C40F').setTitle('⏰ Rappel !')
            .setDescription(`<@${r.user_id}> → **${r.message}**`)
            .setFooter({ text: `Rappel créé le ${new Date(r.created_at * 1000).toLocaleString('fr-FR')}` })
        ]});
      }
    } catch {}
    await db.db.prepare('UPDATE rappels SET done=1 WHERE id=?').run(r.id);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rappel')
    .setDescription('⏰ Créez des rappels temporels personnalisés')
    .addSubcommand(s => s.setName('creer').setDescription('⏰ Créer un rappel')
      .addStringOption(o => o.setName('duree').setDescription('Ex: 1h30m, 2d, 45m, 1semaine').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Message du rappel').setRequired(true).setMaxLength(300)))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir vos rappels actifs'))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un rappel')
      .addIntegerOption(o => o.setName('id').setDescription('ID du rappel (voir /rappel liste)').setRequired(true))),

  checkReminders,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);

    // Vérifier les rappels dus
    await checkReminders(interaction.client);

    if (sub === 'creer') {
      const dureeStr = interaction.options.getString('duree');
      const message = interaction.options.getString('message');
      const seconds = parseDuration(dureeStr);

      if (seconds < 10) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Durée trop courte (minimum 10 secondes). Exemples : `30m`, `2h`, `1j`, `1semaine`.', ephemeral: true });
      if (seconds > 2592000) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Durée trop longue (maximum 30 jours).', ephemeral: true });

      const activeCount = db.db.prepare('SELECT COUNT(*) as c FROM rappels WHERE guild_id=? AND user_id=? AND done=0').get(guildId, userId);
      if (activeCount.c >= 10) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 10 rappels actifs.', ephemeral: true });

      const remindAt = now + seconds;
      await db.db.prepare('INSERT INTO rappels (guild_id, user_id, channel_id, message, remind_at) VALUES (?,?,?,?,?)').run(guildId, userId, interaction.channelId, message, remindAt);

      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('⏰ Rappel créé !')
          .setDescription(`Je vous rappellerai ici : **${message}**`)
          .addFields({ name: '📅 Dans', value: `<t:${remindAt}:R> (<t:${remindAt}:F>)`, inline: false })
      ], ephemeral: true });
    }

    if (sub === 'liste') {
      const rappels = db.db.prepare('SELECT * FROM rappels WHERE guild_id=? AND user_id=? AND done=0 ORDER BY remind_at ASC').all(guildId, userId);
      if (!rappels.length) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '✅ Aucun rappel actif.', ephemeral: true });

      const lines = rappels.map(r => `**#${r.id}** — <t:${r.remind_at}:R>\n> ${r.message}`).join('\n\n');
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('⏰ Vos rappels actifs').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const id = interaction.options.getInteger('id');
      const r = db.db.prepare('SELECT * FROM rappels WHERE id=? AND guild_id=? AND user_id=? AND done=0').get(id, guildId, userId);
      if (!r) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Rappel #${id} introuvable.`, ephemeral: true });

      await db.db.prepare('DELETE FROM rappels WHERE id=?').run(id);
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Rappel #${id} supprimé.`, ephemeral: true });
    }
  }
};
