/**
 * NexusBot — Événements économiques et XP
 * /evenement — Double XP, boosts de coins, événements spéciaux
 * Fonctionnalité UNIQUE — aucun bot concurrent ne propose ça
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS eco_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT, type TEXT,
    multiplier REAL DEFAULT 2.0,
    start_time INTEGER, end_time INTEGER,
    created_by TEXT, active INTEGER DEFAULT 1,
    channel_announced TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evenement')
    .setDescription('🎊 Créer des événements spéciaux (Double XP, Double coins...)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s.setName('creer').setDescription('🎊 Lancer un événement spécial')
      .addStringOption(o => o.setName('nom').setDescription('Nom de l\'événement').setRequired(true).setMaxLength(80))
      .addStringOption(o => o.setName('type').setDescription('Type d\'événement').setRequired(true)
        .addChoices(
          { name: '⭐ Double XP',       value: 'double_xp' },
          { name: '💰 Double Coins',    value: 'double_coins' },
          { name: '🎯 XP x3',          value: 'triple_xp' },
          { name: '💎 Coins x3',       value: 'triple_coins' },
          { name: '📅 Daily x2',       value: 'double_daily' },
          { name: '💼 Salaire x2',     value: 'double_salary' },
          { name: '🛒 Réduction boutique 50%', value: 'shop_discount' },
          { name: '🎲 Lootbox gratuite', value: 'free_lootbox' },
        ))
      .addChannelOption(o => o.setName('annoncer_dans').setDescription('Salon pour l\'annonce publique')))

    .addSubcommand(s => s.setName('terminer').setDescription('🛑 Terminer un événement')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'événement').setRequired(true)))

    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les événements actifs'))

    .addSubcommand(s => s.setName('historique').setDescription('📜 Historique des événements passés')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const now = Math.floor(Date.now() / 1000);

    const typeLabels = {
      double_xp: { emoji:'⭐', label:'Double XP', desc:'Tous les gains d\'XP sont ×2' },
      double_coins: { emoji:'💰', label:'Double Coins', desc:'Tous les gains de coins sont ×2' },
      triple_xp: { emoji:'🌟', label:'XP ×3', desc:'Tous les gains d\'XP sont ×3' },
      triple_coins: { emoji:'💎', label:'Coins ×3', desc:'Tous les gains de coins sont ×3' },
      double_daily: { emoji:'📅', label:'Daily ×2', desc:'Le daily rapporte le double' },
      double_salary: { emoji:'💼', label:'Salaire ×2', desc:'Tous les salaires sont doublés' },
      shop_discount: { emoji:'🛒', label:'-50% Boutique', desc:'Tous les articles coûtent moitié prix' },
      free_lootbox: { emoji:'🎲', label:'Lootbox gratuite', desc:'Les lootboxes sont gratuites' },
    };

    if (sub === 'creer') {
      const nom      = interaction.options.getString('nom');
      const type     = interaction.options.getString('type');
      const duree    = parseInt(interaction.options.getString('duree_heures'));
      const annoncer = interaction.options.getChannel('annoncer_dans');
      const endTime  = now + duree * 3600;
      const info     = typeLabels[type];

      // Désactive l'ancien événement du même type
      db.db.prepare('UPDATE eco_events SET active=0 WHERE guild_id=? AND type=? AND active=1').run(guildId, type);

      const result = db.db.prepare(`
        INSERT INTO eco_events (guild_id,name,type,start_time,end_time,created_by,channel_announced)
        VALUES(?,?,?,?,?,?,?)
      `).run(guildId, nom, type, now, endTime, interaction.user.id, annoncer?.id ?? null);

      const embed = new EmbedBuilder().setColor('#F59E0B')
        .setTitle(`🎊 ÉVÉNEMENT — ${info.emoji} ${nom}`)
        .setDescription(`**${info.label}** est maintenant actif !\n${info.desc}`)
        .addFields(
          { name: '⏰ Durée',    value: `${duree}h`, inline: true },
          { name: '🔚 Fin',      value: `<t:${endTime}:R>`, inline: true },
          { name: '🆔 ID',       value: `#${result.lastInsertRowid}`, inline: true },
        )
        .setFooter({ text: `Événement lancé par ${interaction.user.username}` });

      if (annoncer) {
        await annoncer.send({ embeds: [embed] }).catch(() => {});
        return interaction.reply({ content: `✅ Événement lancé et annoncé dans ${annoncer} !`, ephemeral: true });
      }
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'terminer') {
      const id = parseInt(interaction.options.getString('id'));
      const evt = db.db.prepare('SELECT * FROM eco_events WHERE id=? AND guild_id=?').get(id, guildId);
      if (!evt) return interaction.reply({ content: `❌ Événement #${id} introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE eco_events SET active=0 WHERE id=?').run(id);
      const info = typeLabels[evt.type] || { emoji:'🎊', label: evt.type };
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#95A5A6')
        .setDescription(`🛑 Événement **${info.emoji} ${evt.name}** terminé.`)] });
    }

    if (sub === 'liste') {
      const events = db.db.prepare('SELECT * FROM eco_events WHERE guild_id=? AND active=1 AND end_time>? ORDER BY end_time ASC').all(guildId, now);
      if (!events.length) return interaction.reply({ content: '📋 Aucun événement actif.', ephemeral: true });
      const lines = events.map(e => {
        const info = typeLabels[e.type] || { emoji:'🎊', label:e.type };
        return `**#${e.id}** ${info.emoji} **${e.name}** (${info.label}) — Fin : <t:${e.end_time}:R>`;
      });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle('🎊 Événements actifs')
        .setDescription(lines.join('\n'))] });
    }

    if (sub === 'historique') {
      const events = db.db.prepare('SELECT * FROM eco_events WHERE guild_id=? ORDER BY created_at DESC LIMIT 10').all(guildId);
      if (!events.length) return interaction.reply({ content: '📜 Aucun événement.', ephemeral: true });
      const lines = events.map(e => {
        const info = typeLabels[e.type] || { emoji:'🎊', label:e.type };
        const status = e.active && e.end_time > now ? '🟢' : '⚫';
        return `${status} **${info.emoji} ${e.name}** — <t:${e.created_at}:d>`;
      });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#6B7280')
        .setTitle('📜 Historique des événements')
        .setDescription(lines.join('\n'))], ephemeral: true });
    }
  }
};
