/**
 * NexusBot — Événements XP et Coins Boostés
 * /boost-event — Lancez des événements temporaires de double XP ou double coins
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS boost_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    type        TEXT NOT NULL,
    multiplier  REAL DEFAULT 2.0,
    reason      TEXT,
    starts_at   INTEGER NOT NULL,
    ends_at     INTEGER NOT NULL,
    created_by  TEXT,
    active      INTEGER DEFAULT 1
  )`).run();
} catch {}

function getActiveBoost(guildId, type) {
  const now = Math.floor(Date.now() / 1000);
  return db.db.prepare("SELECT * FROM boost_events WHERE guild_id=? AND type=? AND active=1 AND starts_at<=? AND ends_at>=?").get(guildId, type, now, now);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boost-event')
    .setDescription('⚡ Gérer les événements de boost XP et coins')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('activer')
      .setDescription('🚀 Lancer un événement boost')
      .addStringOption(o => o.setName('type').setDescription('Type de boost').setRequired(true)
        .addChoices(
          { name: '⭐ Double XP', value: 'xp' },
          { name: '🪙 Double Coins', value: 'coins' },
          { name: '⚡ Double XP + Coins', value: 'both' },
        ))
      .addStringOption(o => o.setName('raison').setDescription('Raison de l\'événement').setMaxLength(200)))
    .addSubcommand(s => s.setName('voir').setDescription('👁️ Voir les boosts actifs'))
    .addSubcommand(s => s.setName('arreter')
      .setDescription('⏹️ Arrêter un boost actif')
      .addStringOption(o => o.setName('id').setDescription('ID du boost').setRequired(true)))
    .addSubcommand(s => s.setName('historique').setDescription('📜 Voir l\'historique des boosts')),

  cooldown: 5,
  getActiveBoost, // export pour être utilisé dans d'autres modules

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const now     = Math.floor(Date.now() / 1000);

    if (sub === 'activer') {
      const type   = interaction.options.getString('type');
      const duree  = parseInt(interaction.options.getString('duree'));
      const multi  = parseFloat(interaction.options.getString('multiplicateur')) || 2.0;
      const raison = interaction.options.getString('raison') || 'Événement spécial !';
      const endsAt = now + duree * 60;

      // Désactiver les anciens boosts du même type
      db.db.prepare("UPDATE boost_events SET active=0 WHERE guild_id=? AND type=? AND active=1").run(guildId, type);
      if (type === 'both') db.db.prepare("UPDATE boost_events SET active=0 WHERE guild_id=? AND (type='xp' OR type='coins') AND active=1").run(guildId);

      const result = db.db.prepare('INSERT INTO boost_events (guild_id, type, multiplier, reason, starts_at, ends_at, created_by) VALUES (?,?,?,?,?,?,?)').run(guildId, type, multi, raison, now, endsAt, interaction.user.id);

      const typeLabel = type === 'xp' ? '⭐ Double XP' : type === 'coins' ? '🪙 Double Coins' : '⚡ Double XP + Coins';
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`🚀 ÉVÉNEMENT BOOST LANCÉ — ${typeLabel}`)
        .setDescription(`@everyone — Un événement boost est en cours !`)
        .addFields(
          { name: '⚡ Type',          value: typeLabel,                   inline: true },
          { name: '✖️ Multiplicateur', value: `×${multi}`,                 inline: true },
          { name: '⏱️ Durée',          value: `${duree} minutes`,          inline: true },
          { name: '🏁 Fin',            value: `<t:${endsAt}:R>`,           inline: true },
          { name: '📋 Raison',         value: raison,                      inline: false },
        )
        .setFooter({ text: `ID: ${result.lastInsertRowid} • Lancé par ${interaction.user.username}` })
        .setTimestamp();

      // Annoncer dans le salon log si configuré
      const cfg = db.getConfig(guildId);
      if (cfg.log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.log_channel);
        if (logCh) await logCh.send({ embeds: [embed] }).catch(() => {});
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'voir') {
      const boosts = db.db.prepare("SELECT * FROM boost_events WHERE guild_id=? AND active=1 AND ends_at>=? ORDER BY ends_at ASC").all(guildId, now);
      if (!boosts.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun boost actif en ce moment.')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('⚡ Boosts Actifs')
        .setDescription(boosts.map(b => {
          const typeLabel = b.type === 'xp' ? '⭐ XP' : b.type === 'coins' ? '🪙 Coins' : '⚡ XP+Coins';
          return `**#${b.id}** ${typeLabel} ×${b.multiplier} — Fin <t:${b.ends_at}:R>\n> ${b.reason}`;
        }).join('\n\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'arreter') {
      const id = parseInt(interaction.options.getString('id'));
      const b  = db.db.prepare('SELECT * FROM boost_events WHERE id=? AND guild_id=? AND active=1').get(id, guildId);
      if (!b) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Boost #${id} introuvable ou déjà terminé.` });
      db.db.prepare('UPDATE boost_events SET active=0 WHERE id=?').run(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`⏹️ Boost **#${id}** arrêté.`)] });
    }

    if (sub === 'historique') {
      const hist = db.db.prepare('SELECT * FROM boost_events WHERE guild_id=? ORDER BY created_at DESC LIMIT 15').all(guildId);
      if (!hist.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun historique de boost.')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('📜 Historique des Boosts')
        .setDescription(hist.map(b => {
          const status = b.active && b.ends_at >= now ? '✅' : '⏹️';
          return `${status} **#${b.id}** — ${b.type} ×${b.multiplier} — ${b.reason}`;
        }).join('\n'));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }
  }
};
