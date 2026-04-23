const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('💤 Passer en mode AFK — les mentions t\'enverront un message auto')
    .addStringOption(o => o.setName('raison').setDescription('Raison de ton absence').setRequired(false).setMaxLength(200)),
  cooldown: 5,

  async execute(interaction) {
    const raison = interaction.options.getString('raison') || 'AFK';
    const now    = Math.floor(Date.now() / 1000);

    db.db.prepare(`INSERT INTO afk (guild_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET reason = ?, created_at = ?`)
      .run(interaction.guildId, interaction.user.id, raison, now, raison, now);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💤 Mode AFK activé')
        .setDescription(`Tu es maintenant en AFK : *"${raison}"*\n\nLes personnes qui te mentionneront seront informées de ton absence.`)
        .setFooter({ text: 'Écris un message pour retirer l\'AFK' })
      ], ephemeral: true
    });
  }
};
