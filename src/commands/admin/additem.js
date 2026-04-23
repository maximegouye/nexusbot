const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('🛒 Ajouter un article à la boutique')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true).setMaxLength(50))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(false).setMaxLength(200))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false).setMaxLength(10))
    .addRoleOption(o => o.setName('role').setDescription('Rôle Discord à donner').setRequired(false))
  cooldown: 5,

  async execute(interaction) {
    const nom      = interaction.options.getString('nom');
    const prix     = parseInt(interaction.options.getString('prix'));
    const desc     = interaction.options.getString('description') || null;
    const emoji    = interaction.options.getString('emoji') || null;
    const role     = interaction.options.getRole('role');
    const duree    = parseInt(interaction.options.getString('duree_heures')) || null;
    const maxUser  = parseInt(interaction.options.getString('max_par_user')) || null;

    const result = db.db.prepare(`
      INSERT INTO shop (guild_id, name, description, price, emoji, role_id, duration_hours, max_per_user, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(interaction.guildId, nom, desc, prix, emoji, role?.id || null, duree || null, maxUser || null);

    const cfg = db.getConfig(interaction.guildId);

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`✅ Article ajouté — ${emoji || '📦'} ${nom}`)
        .addFields(
          { name: '🆔 ID',           value: `**#${result.lastInsertRowid}**`,                       inline: true },
          { name: '💰 Prix',         value: `**${prix.toLocaleString('fr-FR')}** ${cfg.currency_name || 'Coins'}`, inline: true },
          ...(role ? [{ name: '🎭 Rôle', value: `<@&${role.id}>`, inline: true }] : []),
          ...(duree ? [{ name: '⏱️ Durée', value: `${duree}h`, inline: true }] : []),
        )
        .setFooter({ text: 'Visible via /shop' })
      ], ephemeral: true
    });
  }
};
