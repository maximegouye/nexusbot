const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('additem')
    .setDescription('🛒 Ajouter un article à la boutique')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true).setMaxLength(50))
    .addIntegerOption(o => o.setName('prix').setDescription('Prix en coins').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(false).setMaxLength(200))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false).setMaxLength(10))
    .addRoleOption(o => o.setName('role').setDescription('Rôle Discord à donner').setRequired(false))
    .addIntegerOption(o => o.setName('duree_heures').setDescription('Durée du rôle en heures').setMinValue(1).setRequired(false))
    .addIntegerOption(o => o.setName('max_par_user').setDescription('Max par utilisateur').setMinValue(1).setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: true }); } catch (e) { /* already ack'd */ }
    }

    try {
    const nom      = interaction.options.getString('nom');
    const prix     = interaction.options.getInteger('prix');
    const desc     = interaction.options.getString('description') || null;
    const emoji    = interaction.options.getString('emoji') || null;
    const role     = interaction.options.getRole('role');
    const duree    = interaction.options.getInteger('duree_heures') || null;
    const maxUser  = interaction.options.getInteger('max_par_user') || null;

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
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
