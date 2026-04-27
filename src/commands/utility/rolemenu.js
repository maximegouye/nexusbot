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
      .addIntegerOption(o => o.setName('max').setDescription('Maximum de rôles sélectionnables').setMinValue(0).setMaxValue(5).setRequired(false))
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
      const maxC   = interaction.options.getInteger('max') ?? 0;

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
      const menuInsert = db.db.prepare('INSERT INTO role_menus (guild_id,channel_id,message_id,title,description,roles,max_choices) VALUES (?,?,?,?,?,?,?)')
        .run(interaction.guildId, salon.id, sent.id, titre, desc, JSON.stringify(roles.map(r => r.id)), maxC);
      const menuId = menuInsert.lastInsertRowid;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Menu de rôles créé dans <#${salon.id}> (ID: ${menuId})` });
    }

    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getString('id'));
      const menu = db.db.prepare('SELECT * FROM role_menus WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      if (!menu) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Menu introuvable.', ephemeral: true });
      try {
        const ch = interaction.guild.channels.cache.get(menu.channel_id);
        if (ch) { const m = await ch.messages.fetch(menu.message_id).catch(() => null); if (m) await m.delete(); }
      } catch {}
      db.db.prepare('DELETE FROM role_menus WHERE id=?').run(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`🗑️ Menu #${id} supprimé.`)], ephemeral: true });
    }

    if (sub === 'liste') {
      const menus = db.db.prepare('SELECT * FROM role_menus WHERE guild_id=?').all(interaction.guildId);
      if (!menus.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: 'Aucun menu de rôles.', ephemeral: true });
      const lines = menus.map(m => `**#${m.id}** — ${m.title} (<#${m.channel_id}>)`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('🎭 Menus de rôles').setDescription(lines)], ephemeral: true });
    }
  }
};

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('rolemenu_')) return false;

  const roleId = customId.replace('rolemenu_toggle_', '');
  const role = interaction.guild.roles.cache.get(roleId);

  if (!role) {
    await interaction.reply({ content: '❌ Rôle introuvable.', ephemeral: true }).catch(() => {});
    return true;
  }

  // Vérif max_choices
  const menu = db.db.prepare('SELECT * FROM role_menus WHERE message_id=? AND guild_id=?').get(interaction.message?.id, interaction.guildId);
  if (menu && menu.max_choices > 0) {
    const menuRoles = JSON.parse(menu.roles || '[]');
    const userRoles = menuRoles.filter(id => interaction.member.roles.cache.has(id));
    if (!interaction.member.roles.cache.has(roleId) && userRoles.length >= menu.max_choices) {
      await interaction.reply({ content: `❌ Maximum ${menu.max_choices} rôle(s) autorisé(s) pour ce menu.`, ephemeral: true }).catch(() => {});
      return true;
    }
  }

  try {
    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);
      await interaction.reply({ content: `✅ Rôle **${role.name}** retiré.`, ephemeral: true }).catch(() => {});
    } else {
      await interaction.member.roles.add(roleId);
      await interaction.reply({ content: `✅ Rôle **${role.name}** ajouté.`, ephemeral: true }).catch(() => {});
    }
  } catch (e) {
    await interaction.reply({ content: `❌ Erreur: ${e.message}`, ephemeral: true }).catch(() => {});
  }

  return true;
}

module.exports.handleComponent = handleComponent;
