const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('📊 Créer un sondage interactif')
    .addStringOption(o => o.setName('question').setDescription('Question du sondage').setRequired(true).setMaxLength(256))
    .addStringOption(o => o.setName('choix1').setDescription('Choix 1').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('choix2').setDescription('Choix 2').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('choix3').setDescription('Choix 3 (optionnel)').setRequired(false).setMaxLength(100))
    .addStringOption(o => o.setName('choix4').setDescription('Choix 4 (optionnel)').setRequired(false).setMaxLength(100))
  cooldown: 30,

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const duration = (parseInt(interaction.options.getString('duree_heures')) || 24) * 3600;
    const cfg      = db.getConfig(interaction.guildId);

    const choices = [
      interaction.options.getString('choix1'),
      interaction.options.getString('choix2'),
      interaction.options.getString('choix3'),
      interaction.options.getString('choix4'),
    ].filter(Boolean);

    const emojis = ['🇦', '🇧', '🇨', '🇩'];
    const colors = ['#5865F2', '#57F287', '#FEE75C', '#ED4245'];

    const endsAt = Math.floor(Date.now() / 1000) + duration;

    // Sauvegarde en DB
    const stmt = db.db.prepare(`
      INSERT INTO polls (guild_id, channel_id, creator_id, question, choices, ends_at, votes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      interaction.guildId,
      interaction.channelId,
      interaction.user.id,
      question,
      JSON.stringify(choices),
      endsAt,
      JSON.stringify({})
    );
    const pollId = result.lastInsertRowid;

    const buildPollEmbed = (votesObj) => {
      const total = Object.values(votesObj).flat().length;
      const embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`📊 ${question}`)
        .setDescription(`*Créé par ${interaction.user.username}*\n⏰ Fin : <t:${endsAt}:R>`)
        .setFooter({ text: `${total} vote${total !== 1 ? 's' : ''} • ID: ${pollId}` });

      for (let i = 0; i < choices.length; i++) {
        const count    = (votesObj[i] || []).length;
        const pct      = total > 0 ? Math.round(count / total * 100) : 0;
        const barLen   = 20;
        const filled   = Math.round(pct / 100 * barLen);
        const bar      = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        embed.addFields({ name: `${emojis[i]} ${choices[i]}`, value: `${bar} **${pct}%** (${count})`, inline: false });
      }
      return embed;
    };

    const buildRow = () => new ActionRowBuilder().addComponents(
      ...choices.map((c, i) => new ButtonBuilder()
        .setCustomId(`poll_vote_${pollId}_${i}`)
        .setLabel(c.length > 20 ? c.slice(0, 17) + '…' : c)
        .setEmoji(emojis[i])
        .setStyle(ButtonStyle.Primary)
      )
    );

    const msg = await interaction.reply({
      embeds: [buildPollEmbed({})],
      components: [buildRow()],
      fetchReply: true,
    });

    db.db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(msg.id, pollId);
  }
};
