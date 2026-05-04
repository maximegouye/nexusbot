const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    title TEXT, content TEXT,
    pinned INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  // data retiré — doublon de src/commands/utility/notes.js (global), accessible globalement
  name: 'notes',

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'ajouter') {
      const count = db.db.prepare('SELECT COUNT(*) as c FROM notes WHERE guild_id=? AND user_id=?').get(guildId, userId);
      if (count.c >= 25) return await interaction.editReply({ content: '❌ Maximum 25 notes. Supprimez-en d\'abord.', ephemeral: true });

      const title = interaction.options.getString('titre');
      const content = interaction.options.getString('contenu');
      const r = db.db.prepare('INSERT INTO notes (guild_id, user_id, title, content) VALUES (?,?,?,?)').run(guildId, userId, title, content);

      return await interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle('📝 Note ajoutée !')
          .addFields(
            { name: '🏷️ Titre', value: title, inline: true },
            { name: '#️⃣ ID', value: `**${r.lastInsertRowid}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'liste') {
      const notes = db.db.prepare('SELECT * FROM notes WHERE guild_id=? AND user_id=? ORDER BY pinned DESC, updated_at DESC').all(guildId, userId);
      if (!notes.length) return await interaction.editReply({ content: '📝 Aucune note. Créez-en une avec `/notes ajouter` !', ephemeral: true });

      const lines = notes.map(n => `${n.pinned ? '📌' : '📝'} **#${n.id}** — ${n.title}\n> ${n.content.slice(0, 60)}${n.content.length > 60 ? '...' : ''}`).join('\n\n');
      return await interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#3498DB').setTitle(`📝 Vos notes (${notes.length}/25)`).setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'lire') {
      const id = interaction.options.getInteger('id');
      const note = db.db.prepare('SELECT * FROM notes WHERE id=? AND guild_id=? AND user_id=?').get(id, guildId, userId);
      if (!note) return await interaction.editReply({ content: `❌ Note #${id} introuvable.`, ephemeral: true });

      return await interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#3498DB')
          .setTitle(`${note.pinned ? '📌' : '📝'} ${note.title}`)
          .setDescription(note.content)
          .setFooter({ text: `Note #${note.id} • Modifiée le ${new Date(note.updated_at * 1000).toLocaleString('fr-FR')}` })
      ], ephemeral: true });
    }

    if (sub === 'modifier') {
      const id = interaction.options.getInteger('id');
      const content = interaction.options.getString('contenu');
      const r = db.db.prepare('UPDATE notes SET content=?, updated_at=? WHERE id=? AND guild_id=? AND user_id=?').run(content, now, id, guildId, userId);
      if (!r.changes) return await interaction.editReply({ content: `❌ Note #${id} introuvable.`, ephemeral: true });
      return await interaction.editReply({ content: `✅ Note **#${id}** modifiée !`, ephemeral: true });
    }

    if (sub === 'supprimer') {
      const id = interaction.options.getInteger('id');
      const r = db.db.prepare('DELETE FROM notes WHERE id=? AND guild_id=? AND user_id=?').run(id, guildId, userId);
      if (!r.changes) return await interaction.editReply({ content: `❌ Note #${id} introuvable.`, ephemeral: true });
      return await interaction.editReply({ content: `✅ Note **#${id}** supprimée.`, ephemeral: true });
    }

    if (sub === 'epingler') {
      const id = interaction.options.getInteger('id');
      const note = db.db.prepare('SELECT * FROM notes WHERE id=? AND guild_id=? AND user_id=?').get(id, guildId, userId);
      if (!note) return await interaction.editReply({ content: `❌ Note #${id} introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE notes SET pinned=? WHERE id=?').run(note.pinned ? 0 : 1, id);
      return await interaction.editReply({ content: `✅ Note **#${id}** ${note.pinned ? 'désépinglée' : '📌 épinglée'} !`, ephemeral: true });
    }

    if (sub === 'effacer') {
      const count = db.db.prepare('DELETE FROM notes WHERE guild_id=? AND user_id=?').run(guildId, userId);
      return await interaction.editReply({ content: `✅ **${count.changes}** note(s) supprimée(s).`, ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
