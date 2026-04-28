const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('📋 Voir les avertissements d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('membre').setDescription('Membre').setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const target = interaction.options.getUser('membre');
    const warns  = db.db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20')
      .all(interaction.guildId, target.id);

    const embed = new EmbedBuilder()
      .setColor('#FFA500')
      .setTitle(`⚠️ Avertissements de ${target.username}`)
      .setThumbnail(target.displayAvatarURL());

    if (!warns.length) {
      embed.setDescription('✅ Aucun avertissement !');
    } else {
      let desc = `**${warns.length} avertissement${warns.length > 1 ? 's' : ''}** au total\n\n`;
      for (const w of warns) {
        const mod = await interaction.client.users.fetch(w.mod_id).catch(() => ({ tag: 'Inconnu' }));
        desc += `**#${w.id}** — <t:${w.created_at}:D>\n👮 ${mod.username}\n📝 ${w.reason}\n\n`;
      }
      embed.setDescription(desc);
    }

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
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
