const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggestion')
    .setDescription('💡 Système de suggestions')
    .addSubcommand(s => s.setName('proposer').setDescription('💡 Faire une suggestion')
      .addStringOption(o => o.setName('idee').setDescription('Ton idée').setRequired(true).setMaxLength(500)))
    .addSubcommand(s => s.setName('accepter').setDescription('✅ Accepter une suggestion (Admin)')
      .addIntegerOption(o => o.setName('id').setDescription('ID de la suggestion').setRequired(true))
      .addStringOption(o => o.setName('reponse').setDescription('Réponse de l\'équipe').setRequired(false)))
    .addSubcommand(s => s.setName('refuser').setDescription('❌ Refuser une suggestion (Admin)')
      .addIntegerOption(o => o.setName('id').setDescription('ID de la suggestion').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du refus').setRequired(false)))
    .addSubcommand(s => s.setName('setup').setDescription('⚙️ Configurer le canal de suggestions')
      .addChannelOption(o => o.setName('canal').setDescription('Canal').setRequired(true))),
  cooldown: 30,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });
      const canal = interaction.options.getChannel('canal');
      db.setConfig(interaction.guildId, 'suggestion_channel', canal.id);
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Canal de suggestions configuré : ${canal}`)], ephemeral: true });
    }

    if (sub === 'proposer') {
      if (!cfg.suggestion_channel) return interaction.reply({ content: '❌ Le canal de suggestions n\'est pas configuré. Un admin doit utiliser `/suggestion setup`.', ephemeral: true });
      const idee = interaction.options.getString('idee');
      const channel = interaction.guild.channels.cache.get(cfg.suggestion_channel);
      if (!channel) return interaction.reply({ content: '❌ Canal de suggestions introuvable.', ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sugg_up').setLabel('0').setEmoji('👍').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sugg_down').setLabel('0').setEmoji('👎').setStyle(ButtonStyle.Danger),
      );

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💡 Nouvelle Suggestion')
        .setDescription(idee)
        .addFields({ name: '👤 Proposé par', value: `${interaction.user.username}`, inline: true })
        .setFooter({ text: 'Vote pour ou contre cette suggestion !' })
        .setTimestamp();

      const msg = await channel.send({ embeds: [embed], components: [row] });

      // Sauvegarder en DB
      db.db.prepare('INSERT INTO suggestions (guild_id, channel_id, message_id, user_id, content, status, upvotes, downvotes, created_at) VALUES (?, ?, ?, ?, ?, "pending", 0, 0, ?)')
        .run(interaction.guildId, channel.id, msg.id, interaction.user.id, idee, Math.floor(Date.now() / 1000));

      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Ta suggestion a été envoyée dans ${channel} ! Merci pour ta contribution.`)], ephemeral: true });
    }

    if (sub === 'accepter' || sub === 'refuser') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });
      const id      = interaction.options.getInteger('id');
      const message = interaction.options.getString('reponse') || interaction.options.getString('raison') || null;
      const sugg    = db.db.prepare('SELECT * FROM suggestions WHERE id = ? AND guild_id = ?').get(id, interaction.guildId);

      if (!sugg) return interaction.reply({ content: `❌ Suggestion #${id} introuvable.`, ephemeral: true });

      const accepted = sub === 'accepter';
      db.db.prepare('UPDATE suggestions SET status = ?, mod_id = ?, mod_response = ? WHERE id = ?')
        .run(accepted ? 'accepted' : 'refused', interaction.user.id, message, id);

      // Mettre à jour le message original
      const channel = interaction.guild.channels.cache.get(sugg.channel_id);
      if (channel) {
        try {
          const msg = await channel.messages.fetch(sugg.message_id);
          const oldEmbed = msg.embeds[0]?.toJSON() || {};
          const newEmbed = new EmbedBuilder()
            .setColor(accepted ? '#2ECC71' : '#FF6B6B')
            .setTitle(`💡 ${accepted ? '✅ Suggestion Acceptée' : '❌ Suggestion Refusée'}`)
            .setDescription(sugg.content)
            .addFields(
              { name: '👤 Proposé par', value: `<@${sugg.user_id}>`, inline: true },
              { name: `${accepted ? '✅' : '❌'} Décision`, value: `${interaction.user.username}`, inline: true },
              ...(message ? [{ name: '💬 Commentaire', value: message, inline: false }] : []),
            )
            .setTimestamp();
          await msg.edit({ embeds: [newEmbed], components: [] });
        } catch {}
      }

      return interaction.reply({ embeds: [new EmbedBuilder().setColor(accepted ? '#2ECC71' : '#FF6B6B').setDescription(`${accepted ? '✅ Suggestion #' + id + ' acceptée.' : '❌ Suggestion #' + id + ' refusée.'}`)], ephemeral: true });
    }
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
