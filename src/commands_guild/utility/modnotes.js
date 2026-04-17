/**
 * NexusBot — Mod Notes (Notes de modération privées)
 * /modnote — Ajoutez des notes privées sur les membres
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS mod_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    mod_id      TEXT NOT NULL,
    note        TEXT NOT NULL,
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modnote')
    .setDescription('📝 Gérer les notes de modération privées')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName('ajouter')
      .setDescription('➕ Ajouter une note sur un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true))
      .addStringOption(o => o.setName('note').setDescription('Contenu de la note').setRequired(true).setMaxLength(1000)))
    .addSubcommand(s => s.setName('voir')
      .setDescription('👁️ Voir les notes d\'un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre cible').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer')
      .setDescription('🗑️ Supprimer une note par son ID')
      .addIntegerOption(o => o.setName('id').setDescription('ID de la note (visible avec /modnote voir)').setRequired(true)))
    .addSubcommand(s => s.setName('recents')
      .setDescription('🕐 Voir les dernières notes ajoutées')),

  cooldown: 3,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'ajouter') {
      const target = interaction.options.getUser('membre');
      const note   = interaction.options.getString('note');
      db.db.prepare('INSERT INTO mod_notes (guild_id, user_id, mod_id, note) VALUES (?,?,?,?)').run(guildId, target.id, interaction.user.id, note);
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('📝 Note ajoutée')
        .addFields(
          { name: '👤 Membre', value: `${target.username} (<@${target.id}>)`, inline: true },
          { name: '📋 Note',   value: note, inline: false },
        )
        .setFooter({ text: `Ajoutée par ${interaction.user.username}` })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'voir') {
      const target = interaction.options.getUser('membre');
      const notes  = db.db.prepare('SELECT * FROM mod_notes WHERE guild_id=? AND user_id=? ORDER BY created_at DESC').all(guildId, target.id);
      if (!notes.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription(`Aucune note pour **${target.username}**.`)] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle(`📝 Notes de modération — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(notes.map(n => {
          const date = new Date(n.created_at * 1000).toLocaleDateString('fr-FR');
          return `**#${n.id}** • <@${n.mod_id}> — *${date}*\n> ${n.note}`;
        }).join('\n\n'))
        .setFooter({ text: `${notes.length} note(s) au total` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'supprimer') {
      const noteId = interaction.options.getInteger('id');
      const note   = db.db.prepare('SELECT * FROM mod_notes WHERE id=? AND guild_id=?').get(noteId, guildId);
      if (!note) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ Note #${noteId} introuvable.`)] });
      db.db.prepare('DELETE FROM mod_notes WHERE id=?').run(noteId);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Note **#${noteId}** supprimée.`)] });
    }

    if (sub === 'recents') {
      const notes = db.db.prepare('SELECT * FROM mod_notes WHERE guild_id=? ORDER BY created_at DESC LIMIT 15').all(guildId);
      if (!notes.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune note récente.')] });
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('📝 Notes récentes')
        .setDescription(notes.map(n => {
          const date = new Date(n.created_at * 1000).toLocaleDateString('fr-FR');
          return `**#${n.id}** <@${n.user_id}> • par <@${n.mod_id}> (*${date}*)\n> ${n.note.slice(0, 80)}${n.note.length > 80 ? '...' : ''}`;
        }).join('\n\n'))
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
