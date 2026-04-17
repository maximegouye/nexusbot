const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT,
    role_id TEXT, emoji TEXT, label TEXT,
    style TEXT DEFAULT 'Primary',
    UNIQUE(guild_id, message_id, role_id)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS reaction_role_panels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT,
    title TEXT, description TEXT,
    UNIQUE(guild_id, message_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('🎭 Système de rôles automatiques par bouton')
    .addSubcommand(s => s.setName('creer').setDescription('✨ Créer un panel de rôles boutons')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où envoyer le panel').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('titre').setDescription('Titre du panel').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('description').setDescription('Description').setMaxLength(1000)))
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Ajouter un rôle à un panel existant')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message panel').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à assigner').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Texte du bouton').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji du bouton'))
      .addStringOption(o => o.setName('style').setDescription('Style du bouton')
        .addChoices(
          { name: '🟦 Bleu (Primary)', value: 'Primary' },
          { name: '🟩 Vert (Success)', value: 'Success' },
          { name: '🟥 Rouge (Danger)', value: 'Danger' },
          { name: '⬜ Gris (Secondary)', value: 'Secondary' },
        )))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les panels sur ce serveur'))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un panel')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message panel').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!interaction.member.permissions.has(0x10000000n)) // ManageGuild
      return interaction.reply({ content: '❌ Permission insuffisante (Gérer le serveur).', ephemeral: true });

    if (sub === 'creer') {
      const channel = interaction.options.getChannel('salon');
      const titre = interaction.options.getString('titre');
      const desc = interaction.options.getString('description') || 'Cliquez sur un bouton pour obtenir ou retirer un rôle.';

      const embed = new EmbedBuilder()
        .setColor(db.getConfig(guildId).color || '#7B2FBE')
        .setTitle(`🎭 ${titre}`)
        .setDescription(desc)
        .setFooter({ text: 'Cliquez sur un bouton pour toggler un rôle' });

      const msg = await channel.send({ embeds: [embed], components: [] });

      db.db.prepare('INSERT INTO reaction_role_panels (guild_id, channel_id, message_id, title, description) VALUES (?,?,?,?,?)')
        .run(guildId, channel.id, msg.id, titre, desc);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Panel créé !')
          .addFields(
            { name: '📍 Salon', value: `${channel}`, inline: true },
            { name: '🆔 Message ID', value: `\`${msg.id}\``, inline: true },
          )
          .setDescription('Ajoutez des rôles avec `/reactionroles ajouter`')
      ], ephemeral: true });
    }

    if (sub === 'ajouter') {
      const msgId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('emoji');
      const style = interaction.options.getString('style') || 'Primary';

      const panel = db.db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id=? AND message_id=?').get(guildId, msgId);
      if (!panel) return interaction.reply({ content: '❌ Panel introuvable. Vérifiez l\'ID du message.', ephemeral: true });

      const existing = db.db.prepare('SELECT COUNT(*) as c FROM reaction_roles WHERE guild_id=? AND message_id=?').get(guildId, msgId);
      if (existing.c >= 20) return interaction.reply({ content: '❌ Maximum 20 rôles par panel.', ephemeral: true });

      try {
        db.db.prepare('INSERT INTO reaction_roles (guild_id, channel_id, message_id, role_id, emoji, label, style) VALUES (?,?,?,?,?,?,?)')
          .run(guildId, panel.channel_id, msgId, role.id, emoji || null, label, style);
      } catch {
        return interaction.reply({ content: '❌ Ce rôle est déjà dans ce panel.', ephemeral: true });
      }

      // Reconstruire le message
      const allRoles = db.db.prepare('SELECT * FROM reaction_roles WHERE guild_id=? AND message_id=?').all(guildId, msgId);
      const rows = [];
      for (let i = 0; i < allRoles.length; i += 5) {
        const rowRoles = allRoles.slice(i, i + 5);
        rows.push(new ActionRowBuilder().addComponents(
          rowRoles.map(r => {
            const btn = new ButtonBuilder()
              .setCustomId(`rr_${r.role_id}`)
              .setLabel(r.label)
              .setStyle(ButtonStyle[r.style] || ButtonStyle.Primary);
            if (r.emoji) btn.setEmoji(r.emoji);
            return btn;
          })
        ));
      }

      try {
        const ch = await interaction.client.channels.fetch(panel.channel_id);
        const msg = await ch.messages.fetch(msgId);
        await msg.edit({ components: rows });
      } catch (e) {
        return interaction.reply({ content: `❌ Impossible de modifier le message : ${e.message}`, ephemeral: true });
      }

      return interaction.reply({ content: `✅ Rôle **${role.name}** ajouté au panel !`, ephemeral: true });
    }

    if (sub === 'liste') {
      const panels = db.db.prepare('SELECT p.*, COUNT(r.id) as role_count FROM reaction_role_panels p LEFT JOIN reaction_roles r ON p.message_id=r.message_id WHERE p.guild_id=? GROUP BY p.message_id').all(guildId);
      if (!panels.length) return interaction.reply({ content: '❌ Aucun panel. Créez-en un avec `/reactionroles creer`.', ephemeral: true });

      const lines = panels.map(p => `**${p.title}** — <#${p.channel_id}> | 🎭 ${p.role_count} rôle(s)\n> ID: \`${p.message_id}\``).join('\n\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('🎭 Panels de Rôles').setDescription(lines)
      ], ephemeral: true });
    }

    if (sub === 'supprimer') {
      const msgId = interaction.options.getString('message_id');
      const panel = db.db.prepare('SELECT * FROM reaction_role_panels WHERE guild_id=? AND message_id=?').get(guildId, msgId);
      if (!panel) return interaction.reply({ content: '❌ Panel introuvable.', ephemeral: true });

      db.db.prepare('DELETE FROM reaction_roles WHERE guild_id=? AND message_id=?').run(guildId, msgId);
      db.db.prepare('DELETE FROM reaction_role_panels WHERE guild_id=? AND message_id=?').run(guildId, msgId);

      try {
        const ch = await interaction.client.channels.fetch(panel.channel_id);
        const msg = await ch.messages.fetch(msgId);
        await msg.delete();
      } catch {}

      return interaction.reply({ content: '✅ Panel supprimé !', ephemeral: true });
    }
  }
};
