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
    .addIntegerOption(o => o.setName('duree_heures').setDescription('Durée en heures (défaut : 24)').setRequired(false).setMinValue(1).setMaxValue(720)),
  cooldown: 30,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const question = interaction.options.getString('question');
    const duration = (interaction.options.getInteger('duree_heures') || 24) * 3600;
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

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [buildPollEmbed({})],
      components: [buildRow()],
      fetchReply: true,
    });

    await db.db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(msg.id, pollId);

  },

  async handleComponent(interaction, customId) {
    if (!customId.startsWith('poll_')) return false;

    const parts = customId.split('_');
    if (parts.length < 4) return false;

    const pollId = parseInt(parts[2]);
    const choiceIdx = parseInt(parts[3]);

    if (isNaN(pollId) || isNaN(choiceIdx)) return false;

    await interaction.deferUpdate().catch(() => {});

    try {
      const poll = db.db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
      if (!poll) {
        await interaction.editReply({ content: '❌ Sondage non trouvé.', ephemeral: true }).catch(() => {});
        return true;
      }

      const choices = JSON.parse(poll.choices);
      const votes = JSON.parse(poll.votes);
      const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

      // Initialiser le tableau de votes
      if (!Array.isArray(votes[choiceIdx])) votes[choiceIdx] = [];

      // Ajouter le vote (sans doublon)
      if (!votes[choiceIdx].includes(interaction.user.id)) {
        votes[choiceIdx].push(interaction.user.id);
        await db.db.prepare('UPDATE polls SET votes = ? WHERE id = ?').run(JSON.stringify(votes), pollId);
      }

      // Reconstruire l'embed
      const cfg = db.getConfig(interaction.guildId);
      const total = Object.values(votes).flat().length;
      const emojis = ['🇦', '🇧', '🇨', '🇩'];
      const embed = new EmbedBuilder()
        .setColor(cfg?.color || '#7B2FBE')
        .setTitle(`📊 ${poll.question}`)
        .setDescription(`*Créé par <@${poll.creator_id}>*\n⏰ Fin : <t:${poll.ends_at}:R>`)
        .setFooter({ text: `${total} vote${total !== 1 ? 's' : ''} • ID: ${pollId}` });

      for (let i = 0; i < choices.length; i++) {
        const count = (votes[i] || []).length;
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        const barLen = 20;
        const filled = Math.round(pct / 100 * barLen);
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        embed.addFields({ name: `${emojis[i]} ${choices[i]}`, value: `${bar} **${pct}%** (${count})`, inline: false });
      }

      const row = new ActionRowBuilder().addComponents(
        ...choices.map((c, i) => new ButtonBuilder()
          .setCustomId(`poll_vote_${pollId}_${i}`)
          .setLabel(c.length > 20 ? c.slice(0, 17) + '…' : c)
          .setEmoji(emojis[i])
          .setStyle(ButtonStyle.Primary)
        )
      );

      await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
      return true;
    } catch (err) {
      console.error('[POLL handleComponent]', err?.message || err);
      return true;
    }
  }
};