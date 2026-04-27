const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('🛠️ Définir l\'XP d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true))
    .addIntegerOption(o => o.setName('xp').setDescription('Valeur XP').setMinValue(0).setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('Action').setRequired(false)
      .addChoices(
        { name: 'Définir (remplace)', value: 'set' },
        { name: 'Ajouter', value: 'add' },
        { name: 'Soustraire', value: 'remove' },
      )),
  cooldown: 3,

  async execute(interaction) {
    try {
    const target = interaction.options.getUser('membre');
    const xpVal  = interaction.options.getInteger('xp');
    const action = interaction.options.getString('action') || 'set';
    const user   = db.getUser(target.id, interaction.guildId);

    let newXP;
    if (action === 'set')    newXP = xpVal;
    if (action === 'add')    newXP = (user.xp || 0) + xpVal;
    if (action === 'remove') newXP = Math.max(0, (user.xp || 0) - xpVal);

    // Recalcul du niveau
    let newLevel = 1;
    while (Math.floor(100 * Math.pow(1.35, newLevel)) <= newXP) newLevel++;

    db.db.prepare('UPDATE users SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ?')
      .run(newXP, newLevel, target.id, interaction.guildId);

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setDescription(`✅ **${target.username}** : **${newXP.toLocaleString('fr-FR')} XP** → Niveau **${newLevel}**.`)
      ]
    });
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
