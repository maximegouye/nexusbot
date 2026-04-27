const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// S'assurer que la table warnings a les bons champs
db.db.prepare(`CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, user_id TEXT, mod_id TEXT, reason TEXT,
  timestamp INTEGER DEFAULT (strftime('%s','now')),
  active INTEGER DEFAULT 1
)`).run();

const TYPE_ICONS = { warn: '⚠️', mute: '🔇', kick: '👢', ban: '🔨', tempban: '⏱️🔨', unban: '✅', note: '📝', timeout: '⏱️' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('📋 Historique des sanctions modération')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('voir').setDescription('Voir les sanctions d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Filtrer par type').setRequired(false)
        .addChoices(
          { name: '⚠️ Avertissements', value: 'warn' },
          { name: '🔇 Mutes', value: 'mute' },
          { name: '👢 Kicks', value: 'kick' },
          { name: '🔨 Bans', value: 'ban' },
        )))
    .addSubcommand(s => s.setName('info').setDescription('Détails d\'un cas précis')
      .addIntegerOption(o => o.setName('id').setDescription('ID du cas').setRequired(true)))
    .addSubcommand(s => s.setName('modifier').setDescription('Modifier la raison d\'un cas')
      .addIntegerOption(o => o.setName('id').setDescription('ID du cas').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Nouvelle raison').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un cas (Admin)')
      .addIntegerOption(o => o.setName('id').setDescription('ID du cas').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('Statistiques de modération du serveur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre');
      const type   = interaction.options.getString('type');
      let query = 'SELECT * FROM warnings WHERE guild_id=? AND user_id=?';
      const params = [interaction.guildId, target.id];
      if (type) { query += ' AND reason LIKE ?'; params.push(`%[${type.toUpperCase()}]%`); }
      query += ' ORDER BY id DESC LIMIT 20';

      const cases = db.db.prepare(query).all(...params);
      if (!cases.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ <@${target.id}> n'a aucun antécédent${type ? ` de type ${type}` : ''}.`)], ephemeral: true });

      const lines = cases.map(c => {
        const icon = Object.entries(TYPE_ICONS).find(([k]) => c.reason?.toLowerCase().includes(k))?.[1] || '📋';
        return `**#${c.id}** ${icon} | <t:${c.timestamp}:R> | <@${c.mod_id}> | ${c.reason?.slice(0, 80) || 'Aucune raison'}`;
      }).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📋 Historique de ${target.username} (${cases.length} cas)`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(lines)
        .setFooter({ text: `Utilise /cases info <id> pour les détails` })
      ], ephemeral: true });
    }

    if (sub === 'info') {
      const id = interaction.options.getInteger('id');
      const c  = db.db.prepare('SELECT * FROM warnings WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      if (!c) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cas #${id} introuvable.`, ephemeral: true });
      const icon = Object.entries(TYPE_ICONS).find(([k]) => c.reason?.toLowerCase().includes(k))?.[1] || '📋';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`${icon} Cas #${c.id}`)
        .addFields(
          { name: '👤 Membre',      value: `<@${c.user_id}>`, inline: true },
          { name: '🛡️ Modérateur', value: `<@${c.mod_id}>`, inline: true },
          { name: '📅 Date',        value: `<t:${c.timestamp}:F>`, inline: true },
          { name: '📋 Raison',      value: c.reason || 'Aucune raison' },
        )
      ], ephemeral: true });
    }

    if (sub === 'modifier') {
      const id     = interaction.options.getInteger('id');
      const raison = interaction.options.getString('raison');
      const c      = db.db.prepare('SELECT * FROM warnings WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      if (!c) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cas #${id} introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE warnings SET reason=? WHERE id=?').run(raison, id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Cas **#${id}** mis à jour.`)], ephemeral: true });
    }

    if (sub === 'supprimer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin requis.', ephemeral: true });
      const id = interaction.options.getInteger('id');
      const r  = db.db.prepare('DELETE FROM warnings WHERE id=? AND guild_id=?').run(id, interaction.guildId);
      if (!r.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cas #${id} introuvable.`, ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🗑️ Cas **#${id}** supprimé.`)], ephemeral: true });
    }

    if (sub === 'stats') {
      const total  = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=?').get(interaction.guildId)?.c ?? 0;
      const today  = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND timestamp > ?').get(interaction.guildId, Math.floor(Date.now()/1000) - 86400)?.c ?? 0;
      const topMod = db.db.prepare('SELECT mod_id, COUNT(*) as c FROM warnings WHERE guild_id=? GROUP BY mod_id ORDER BY c DESC LIMIT 1').get(interaction.guildId);
      const topUser = db.db.prepare('SELECT user_id, COUNT(*) as c FROM warnings WHERE guild_id=? GROUP BY user_id ORDER BY c DESC LIMIT 1').get(interaction.guildId);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Stats de Modération')
        .addFields(
          { name: '📋 Total des cas', value: `${total}`, inline: true },
          { name: '📅 Aujourd\'hui', value: `${today}`, inline: true },
          { name: '🏆 Modérateur actif', value: topMod ? `<@${topMod.mod_id}> (${topMod.c} cas)` : 'Aucun', inline: true },
          { name: '⚠️ Membre le + sanctionné', value: topUser ? `<@${topUser.user_id}> (${topUser.c} cas)` : 'Aucun', inline: true },
        )
      ], ephemeral: true });
    }
  }
};
