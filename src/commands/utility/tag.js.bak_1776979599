const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, name TEXT, content TEXT, author_id TEXT,
  uses INTEGER DEFAULT 0, created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(guild_id, name)
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('🏷️ Créer et utiliser des tags (réponses rapides)')
    .addSubcommand(s => s.setName('utiliser').setDescription('Utiliser un tag')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tag').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('creer').setDescription('Créer un tag')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tag (sans espaces)').setRequired(true))
      .addStringOption(o => o.setName('contenu').setDescription('Contenu du tag').setRequired(true)))
    .addSubcommand(s => s.setName('modifier').setDescription('Modifier un tag (modéro requis)')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tag').setRequired(true))
      .addStringOption(o => o.setName('contenu').setDescription('Nouveau contenu').setRequired(true)))
    .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un tag')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tag').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('Voir tous les tags du serveur'))
    .addSubcommand(s => s.setName('info').setDescription('Infos sur un tag')
      .addStringOption(o => o.setName('nom').setDescription('Nom du tag').setRequired(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const tags = db.db.prepare('SELECT name FROM tags WHERE guild_id=? AND name LIKE ? LIMIT 25')
      .all(interaction.guildId, `%${focused}%`);
    await interaction.respond(tags.map(t => ({ name: t.name, value: t.name })));
  },

  async execute(interaction) {
    const sub  = interaction.options.getSubcommand();
    const nom  = interaction.options.getString('nom');

    if (sub === 'utiliser') {
      const tag = db.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(interaction.guildId, nom);
      if (!tag) return interaction.reply({ content: `❌ Tag \`${nom}\` introuvable.`, ephemeral: true });
      db.db.prepare('UPDATE tags SET uses=uses+1 WHERE id=?').run(tag.id);
      return interaction.reply({ content: tag.content });
    }

    if (sub === 'creer') {
      const content = interaction.options.getString('contenu');
      const clean   = nom.toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (!clean) return interaction.reply({ content: '❌ Nom invalide.', ephemeral: true });
      try {
        db.db.prepare('INSERT INTO tags (guild_id,name,content,author_id) VALUES (?,?,?,?)').run(interaction.guildId, clean, content, interaction.user.id);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Tag \`${clean}\` créé !`)], ephemeral: true });
      } catch {
        return interaction.reply({ content: `❌ Le tag \`${clean}\` existe déjà.`, ephemeral: true });
      }
    }

    if (sub === 'modifier') {
      const tag = db.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(interaction.guildId, nom);
      if (!tag) return interaction.reply({ content: `❌ Tag \`${nom}\` introuvable.`, ephemeral: true });
      const canEdit = tag.author_id === interaction.user.id || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!canEdit) return interaction.reply({ content: '❌ Tu ne peux pas modifier ce tag.', ephemeral: true });
      const content = interaction.options.getString('contenu');
      db.db.prepare('UPDATE tags SET content=? WHERE id=?').run(content, tag.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Green').setDescription(`✅ Tag \`${nom}\` modifié.`)], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const tag = db.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(interaction.guildId, nom);
      if (!tag) return interaction.reply({ content: `❌ Tag \`${nom}\` introuvable.`, ephemeral: true });
      const canDelete = tag.author_id === interaction.user.id || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!canDelete) return interaction.reply({ content: '❌ Tu ne peux pas supprimer ce tag.', ephemeral: true });
      db.db.prepare('DELETE FROM tags WHERE id=?').run(tag.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🗑️ Tag \`${nom}\` supprimé.`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const tags = db.db.prepare('SELECT name, uses FROM tags WHERE guild_id=? ORDER BY uses DESC').all(interaction.guildId);
      if (!tags.length) return interaction.reply({ content: 'Aucun tag sur ce serveur.', ephemeral: true });
      const lines = tags.map((t, i) => `**${i+1}.** \`${t.name}\` — ${t.uses} utilisations`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setTitle(`🏷️ Tags du serveur (${tags.length})`)
        .setDescription(lines.slice(0, 4000))], ephemeral: false });
    }

    if (sub === 'info') {
      const tag = db.db.prepare('SELECT * FROM tags WHERE guild_id=? AND name=?').get(interaction.guildId, nom);
      if (!tag) return interaction.reply({ content: `❌ Tag \`${nom}\` introuvable.`, ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setTitle(`🏷️ Tag: ${tag.name}`)
        .setDescription(tag.content.slice(0, 500))
        .addFields(
          { name: '👤 Créé par', value: `<@${tag.author_id}>`, inline: true },
          { name: '📊 Utilisations', value: `${tag.uses}`, inline: true },
          { name: '📅 Créé', value: `<t:${tag.created_at}:R>`, inline: true },
        )], ephemeral: true });
    }
  }
};
