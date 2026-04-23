const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS sondages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT, message_id TEXT,
    user_id TEXT, question TEXT,
    options TEXT, votes TEXT DEFAULT '{}',
    ends_at INTEGER, ended INTEGER DEFAULT 0,
    anonymous INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('📊 Créez des sondages avancés avec options personnalisées')
    .addSubcommand(s => s.setName('creer').setDescription('📊 Créer un nouveau sondage')
      .addStringOption(o => o.setName('question').setDescription('Question du sondage').setRequired(true).setMaxLength(256))
      .addStringOption(o => o.setName('options').setDescription('Options séparées par | (ex: Option1|Option2|Option3)').setRequired(true))
      .addBooleanOption(o => o.setName('anonyme').setDescription('Votes anonymes (défaut: non)')))
    .addSubcommand(s => s.setName('terminer').setDescription('🔒 Terminer un sondage prématurément')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message sondage').setRequired(true)))
    .addSubcommand(s => s.setName('resultats').setDescription('📊 Voir les résultats d\'un sondage')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message sondage').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const question = interaction.options.getString('question');
      const optionsRaw = interaction.options.getString('options');
      const duree = parseInt(interaction.options.getString('duree')) || 0;
      const anonymous = interaction.options.getBoolean('anonyme') || false;

      const options = optionsRaw.split('|').map(o => o.trim()).filter(o => o.length > 0);
      if (options.length < 2) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Minimum 2 options séparées par `|`.', ephemeral: true });
      if (options.length > 10) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 10 options.', ephemeral: true });

      const endsAt = duree > 0 ? now + duree * 60 : 0;
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

      const optionsDisplay = options.map((o, i) => `${emojis[i]} ${o} — **0 vote** (0%)`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`📊 ${question}`)
        .setDescription(optionsDisplay)
        .addFields(
          { name: '👤 Créé par', value: `<@${userId}>`, inline: true },
          { name: '🔒 Mode', value: anonymous ? '🔕 Anonyme' : '👁️ Public', inline: true },
          { name: '⏰ Fin', value: endsAt ? `<t:${endsAt}:R>` : 'Aucune limite', inline: true },
        )
        .setFooter({ text: `0 vote au total` })
        .setTimestamp();

      // Créer les boutons par rangée de 5
      const rows = [];
      for (let i = 0; i < options.length; i += 5) {
        const slice = options.slice(i, i + 5);
        rows.push(new ActionRowBuilder().addComponents(
          slice.map((_, j) => {
            const idx = i + j;
            return new ButtonBuilder()
              .setCustomId(`sondage_vote_${idx}`) // ID temporaire, sera remplacé après création
              .setLabel(options[idx].slice(0, 40))
              .setEmoji(emojis[idx])
              .setStyle(ButtonStyle.Primary);
          })
        ));
      }

      const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: rows, fetchReply: true });

      // Sauvegarder avec l'ID du message
      db.db.prepare('INSERT INTO sondages (guild_id, channel_id, message_id, user_id, question, options, ends_at, anonymous) VALUES (?,?,?,?,?,?,?,?)')
        .run(guildId, interaction.channelId, msg.id, userId, question, JSON.stringify(options), endsAt, anonymous ? 1 : 0);

      // Mettre à jour les custom IDs avec l'ID du message
      const updatedRows = [];
      for (let i = 0; i < options.length; i += 5) {
        const slice = options.slice(i, i + 5);
        updatedRows.push(new ActionRowBuilder().addComponents(
          slice.map((_, j) => {
            const idx = i + j;
            return new ButtonBuilder()
              .setCustomId(`sondagev_${msg.id}_${idx}`)
              .setLabel(options[idx].slice(0, 40))
              .setEmoji(emojis[idx])
              .setStyle(ButtonStyle.Primary);
          })
        ));
      }
      await msg.edit({ components: updatedRows });
    }

    if (sub === 'terminer' || sub === 'resultats') {
      const msgId = interaction.options.getString('message_id');
      const sondage = db.db.prepare('SELECT * FROM sondages WHERE guild_id=? AND message_id=?').get(guildId, msgId);
      if (!sondage) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Sondage introuvable.', ephemeral: true });

      if (sub === 'terminer') {
        if (sondage.user_id !== userId && !interaction.member.permissions.has(0x4000n))
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le créateur ou un modérateur peut terminer ce sondage.', ephemeral: true });
        db.db.prepare('UPDATE sondages SET ended=1 WHERE id=?').run(sondage.id);
      }

      const options = JSON.parse(sondage.options);
      const votes = JSON.parse(sondage.votes || '{}');
      const totalVotes = Object.values(votes).flat().length;
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

      const results = options.map((o, i) => {
        const optVotes = votes[i] ? votes[i].length : 0;
        const pct = totalVotes > 0 ? Math.round(optVotes / totalVotes * 100) : 0;
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        return `${emojis[i]} **${o}**\n${bar} ${optVotes} vote(s) — **${pct}%**`;
      }).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#5865F2').setTitle(`📊 Résultats — ${sondage.question}`)
          .setDescription(results)
          .addFields({ name: '🗳️ Total', value: `**${totalVotes}** vote(s)`, inline: true })
          .setFooter({ text: sondage.ended ? 'Sondage terminé' : 'Sondage en cours' })
      ], ephemeral: false });
    }
  }
};
