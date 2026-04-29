const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// Assurer que la table existe
db.db.prepare(`
  CREATE TABLE IF NOT EXISTS temp_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`).run();

function parseDuration(str) {
  const map = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const match = str.match(/^(\d+)([smhdw])$/i);
  if (!match) return null;
  return parseInt(match[1]) * (map[match[2].toLowerCase()] || 0);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('⏳ Donner un rôle temporaire à un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s
      .setName('donner')
      .setDescription('Donner un rôle temporaire')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à donner').setRequired(true))
      .addStringOption(o => o.setName('duree').setDescription('Durée (ex: 1h, 30m, 7d, 2w)').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false))
    )
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('Retirer un rôle temporaire avant expiration')
      .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à retirer').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('liste')
      .setDescription('Voir les rôles temporaires actifs')
    ),

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const sub = interaction.options.getSubcommand();

    if (sub === 'donner') {
      const member  = interaction.options.getMember('membre');
      const role    = interaction.options.getRole('role');
      const duree   = interaction.options.getString('duree');
      const raison  = interaction.options.getString('raison') || 'Aucune raison';

      const ms = parseDuration(duree);
      if (!ms) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('❌ Durée invalide. Ex: `30m`, `2h`, `7d`');

      const expires = Math.floor((Date.now() + ms) / 1000); // stocké en secondes

      // Donner le rôle
      await member.roles.add(role, raison).catch(e => {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(`❌ Impossible d'ajouter le rôle : ${e.message}`);
      });

      // Enregistrer en BDD
      db.db.prepare('INSERT INTO temp_roles (guild_id, user_id, role_id, expires_at) VALUES (?,?,?,?)')
        .run(interaction.guildId, member.id, role.id, expires);

      const expiresTs = expires; // déjà en secondes
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('Green')
          .setTitle('✅ Rôle temporaire attribué')
          .addFields(
            { name: '👤 Membre',   value: `<@${member.id}>`, inline: true },
            { name: '🎭 Rôle',     value: `<@&${role.id}>`, inline: true },
            { name: '⏰ Expire',   value: `<t:${expiresTs}:R>`, inline: true },
            { name: '📋 Raison',   value: raison },
          )
        ]
      });
    }

    if (sub === 'retirer') {
      const member = interaction.options.getMember('membre');
      const role   = interaction.options.getRole('role');

      await member.roles.remove(role).catch(() => {});
      db.db.prepare('DELETE FROM temp_roles WHERE guild_id=? AND user_id=? AND role_id=?')
        .run(interaction.guildId, member.id, role.id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(`✅ Rôle <@&${role.id}> retiré de <@${member.id}>.`);
    }

    if (sub === 'liste') {
      const rows = db.db.prepare('SELECT * FROM temp_roles WHERE guild_id=? AND expires_at > ?')
        .all(interaction.guildId, Math.floor(Date.now() / 1000));

      if (!rows.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('Aucun rôle temporaire actif.');

      const lines = rows.map(r =>
        `<@${r.user_id}> → <@&${r.role_id}> — expire <t:${Math.floor(r.expires_at / 1000)}:R>`
      ).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle(`⏳ Rôles temporaires actifs (${rows.length})`)
          .setDescription(lines)
        ]
      });
    }
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
