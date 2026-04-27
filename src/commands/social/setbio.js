const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbio')
    .setDescription('✏️ Modifier ta bio sur ton profil')
    .addStringOption(o => o.setName('texte').setDescription('Ta bio (max 200 caractères)').setRequired(true).setMaxLength(200)),
  cooldown: 10,

  async execute(interaction) {
    const bio = interaction.options.getString('texte');
    db.db.prepare('UPDATE users SET bio = ? WHERE user_id = ? AND guild_id = ?')
      .run(bio, interaction.user.id, interaction.guildId);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Bio mise à jour : *"${bio}"*\n\nElle apparaît sur ton \`/profil\`.`)],
      ephemeral: true
    });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
