/**
 * NexusBot — Salons de statistiques en temps réel
 * /statssalons — Afficher les stats du serveur dans des salons vocaux
 * Fonctionnalité unique impossible ailleurs sans configuration complexe
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS stats_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT,
    type TEXT, template TEXT,
    UNIQUE(guild_id, type)
  )`).run();
} catch {}

const STAT_TYPES = {
  membres_total:  { label: '👥 Membres',          default: '👥 Membres : {value}' },
  membres_online: { label: '🟢 En ligne',          default: '🟢 En ligne : {value}' },
  membres_bots:   { label: '🤖 Bots',              default: '🤖 Bots : {value}' },
  salons_total:   { label: '💬 Salons',            default: '💬 Salons : {value}' },
  boosts:         { label: '💎 Boosts',            default: '💎 Boosts : {value}' },
  coins_total:    { label: '💰 Coins en circ.',    default: '💰 {value} €' },
  joueurs_eco:    { label: '🎮 Joueurs (éco)',      default: '🎮 Joueurs : {value}' },
  niveau_max:     { label: '🏆 Niveau max',         default: '🏆 Nv. max : {value}' },
};

async function getStatValue(type, guild, guildId) {
  switch (type) {
    case 'membres_total':  return guild.memberCount;
    case 'membres_online': {
      await guild.members.fetch();
      return guild.members.cache.filter(m => m.presence?.status !== 'offline' && !m.user.bot).size;
    }
    case 'membres_bots':   return guild.members.cache.filter(m => m.user.bot).size;
    case 'salons_total':   return guild.channels.cache.size;
    case 'boosts':         return guild.premiumSubscriptionCount || 0;
    case 'coins_total': {
      const r = db.db.prepare('SELECT SUM(balance+bank) as total FROM users WHERE guild_id=?').get(guildId);
      return r?.total || 0;
    }
    case 'joueurs_eco': {
      const r = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=?').get(guildId);
      return r?.c || 0;
    }
    case 'niveau_max': {
      const r = db.db.prepare('SELECT MAX(level) as m FROM users WHERE guild_id=?').get(guildId);
      return r?.m || 1;
    }
    default: return '?';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statssalons')
    .setDescription('📊 Créer des salons vocaux avec des statistiques en temps réel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Créer un salon de statistique')
      .addStringOption(o => o.setName('type').setDescription('Type de statistique').setRequired(true)
        .addChoices(...Object.entries(STAT_TYPES).map(([k,v]) => ({ name: v.label, value: k }))))
      .addStringOption(o => o.setName('template').setDescription('Modèle du nom (utilisez {value} pour la valeur)').setMaxLength(50)))

    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un salon de statistique')
      .addStringOption(o => o.setName('type').setDescription('Type à supprimer').setRequired(true)
        .addChoices(...Object.entries(STAT_TYPES).map(([k,v]) => ({ name: v.label, value: k })))))

    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les salons de statistiques configurés'))

    .addSubcommand(s => s.setName('actualiser').setDescription('🔄 Mettre à jour manuellement tous les salons de stat')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'ajouter') {
      const type    = interaction.options.getString('type');
      const info    = STAT_TYPES[type];
      const template = interaction.options.getString('template') || info.default;

      const value = await getStatValue(type, interaction.guild, guildId);
      const name  = template.replace('{value}', value);

      // Crée le salon vocal
      const channel = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [{ id: interaction.guild.roles.everyone, deny: ['Connect'] }],
      }).catch(() => null);

      if (!channel) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de créer le salon. Vérifiez les permissions du bot.', ephemeral: true });

      db.db.prepare(`INSERT INTO stats_channels (guild_id,channel_id,type,template) VALUES(?,?,?,?)
        ON CONFLICT(guild_id,type) DO UPDATE SET channel_id=?, template=?`)
        .run(guildId, channel.id, type, template, channel.id, template);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('✅ Salon de statistique créé')
        .addFields(
          { name: '📊 Type',      value: info.label, inline: true },
          { name: '💬 Salon',     value: `${channel}`, inline: true },
          { name: '🔢 Valeur',    value: `${value}`, inline: true },
          { name: '📝 Template',  value: `\`${template}\``, inline: false },
        )
        .setFooter({ text: 'Mis à jour automatiquement toutes les 10 minutes' })] });
    }

    if (sub === 'supprimer') {
      const type = interaction.options.getString('type');
      const entry = db.db.prepare('SELECT * FROM stats_channels WHERE guild_id=? AND type=?').get(guildId, type);
      if (!entry) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun salon configuré pour ce type.`, ephemeral: true });

      const channel = interaction.guild.channels.cache.get(entry.channel_id);
      if (channel) await channel.delete().catch(() => {});
      db.db.prepare('DELETE FROM stats_channels WHERE guild_id=? AND type=?').run(guildId, type);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setDescription(`🗑️ Salon de statistique **${STAT_TYPES[type]?.label || type}** supprimé.`)] });
    }

    if (sub === 'liste') {
      const entries = db.db.prepare('SELECT * FROM stats_channels WHERE guild_id=?').all(guildId);
      if (!entries.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📊 Aucun salon de stat configuré.', ephemeral: true });
      const lines = entries.map(e => `**${STAT_TYPES[e.type]?.label || e.type}** → <#${e.channel_id}> | \`${e.template}\``);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('📊 Salons de statistiques')
        .setDescription(lines.join('\n'))], ephemeral: true });
    }

    if (sub === 'actualiser') {
      const entries = db.db.prepare('SELECT * FROM stats_channels WHERE guild_id=?').all(guildId);
      if (!entries.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun salon configuré.', ephemeral: true });

      let updated = 0;
      for (const entry of entries) {
        const channel = interaction.guild.channels.cache.get(entry.channel_id);
        if (!channel) continue;
        const value = await getStatValue(entry.type, interaction.guild, guildId);
        const name = entry.template.replace('{value}', value);
        await channel.setName(name).catch(() => {});
        updated++;
      }
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ **${updated}** salon(s) de statistique mis à jour.`, ephemeral: true });
    }
  }
};
