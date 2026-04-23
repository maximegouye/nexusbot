const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS role_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, channel_id TEXT, message_id TEXT,
  title TEXT, description TEXT, roles TEXT DEFAULT '[]',
  max_choices INTEGER DEFAULT 0, required_role TEXT
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('🎭 Créer un menu de sélection de rôles avec boutons')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('creer').setDescription('Créer un menu de rôles')
      .addStringOption(o => o.setName('titre').setDescription('Titre du menu').setRequired(true))
      .addRoleOption(o => o.setName('role1').setDescription('Rôle 1 (obligatoire)').setRequired(true))
      .addRoleOption(o => o.setName('role2').setDescription('Rôle 2').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('Rôle 3').setRequired(false))
      .addRoleOption(o => o.setName('role4').setDescription('Rôle 4').setRequired(false))
      .addRoleOption(o => o.setName('role5').setDescription('Rôle 5').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Description / instructions').setRequired(false))
      .addChannelOption(o => o.setName('salon').setDescription('Salon où envoyer le menu').setRequired(false))
    )
    .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un menu (par ID)')
      .addStringOption(o => o.setName('id').setDescription('ID du menu').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('Voir tous les menus du serveur')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'creer') {
      await interaction.deferReply({ ephemeral: true });
      const titre  = interaction.options.getString('titre');
      const desc   = interaction.options.getString('description') || 'Clique sur un bouton pour obtenir/retirer le rôle correspondant.';
      const salon  = interaction.options.getChannel('salon') || interaction.channel;
      const maxC   = parseInt(interaction.options.getString('max')) ?? 0;

      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const r = interaction.options.getRole(`role${i}`);
        if (r) roles.push({ id: r.id, name: r.name, color: r.hexColor });
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🎭 ${titre}`)
        .setDescription(desc + (maxC ? `\n\n*Maximum ${maxC} rôle(s) sélectionnable(s)*` : ''))
        .addFields(roles.map(r => ({ name: `<@&${r.id}>`, value: r.name, inline: true })))
        .setFooter({ text: 'NexusBot • Rôles par bouton' });

      // Créer les boutons (max 5 par row, max 25 total)
      const rows = [];
      let currentRow = new ActionRowBuilder();
      for (let i = 0; i < roles.length; i++) {
        if (i > 0 && i % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`rolemenu_toggle_${roles[i].id}`)
            .setLabel(roles[i].name.slice(0, 80))
            .setStyle(ButtonStyle.Secondary)
        );
      }
      rows.push(currentRow);

      const sent = await salon.send({ embeds: [embed], components: rows });
      const menuId = db.db.prepare('INSERT INTO role_menus (guild_id,channel_id,message_id,title,description,roles,max_choices) VALUES (?,?,?,?,?,?,?) RETURNING id')
        .get(interaction.guildId, salon.id, sent.id, titre, desc, JSON.stringify(roles.map(r => r.id)), maxC);

      return interaction.editReply({ content: `✅ Menu de rôles créé dans <#${salon.id}> (ID: ${menuId?.id})` });
    }

    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getString('id'));
      const menu = db.db.prepare('SELECT * FROM role_menus WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      if (!menu) return interaction.editReply({ content: '❌ Menu introuvable.', ephemeral: true });
      try {
        const ch = interaction.guild.channels.cache.get(menu.channel_id);
        if (ch) { const m = await ch.messages.fetch(menu.message_id).catch(() => null); if (m) await m.delete(); }
      } catch {}
      db.db.prepare('DELETE FROM role_menus WHERE id=?').run(id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🗑️ Menu #${id} supprimé.`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const menus = db.db.prepare('SELECT * FROM role_menus WHERE guild_id=?').all(interaction.guildId);
      if (!menus.length) return interaction.editReply({ content: 'Aucun menu de rôles.', ephemeral: true });
      const lines = menus.map(m => `**#${m.id}** — ${m.title} (<#${m.channel_id}>)`).join('\n');
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('🎭 Menus de rôles').setDescription(lines)], ephemeral: true });
    }
  }
};
