const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const DEFIS = [
  'Écris le mot "ananas" à l\'envers en moins de 5 secondes !',
  'Fais 10 pompes et dis-le ici !',
  'Dis trois compliments sincères à des membres du serveur.',
  'Chante un couplet de ta chanson préférée dans un vocal.',
  'Raconte ta pire anecdote embarrassante.',
  'Change ton statut Discord en "Je suis un pingouin" pendant 1h.',
  'Envoie un selfie avec un objet improbable sur la tête.',
  'Parle avec un accent anglais pendant 10 minutes.',
  'Invente un surnom pour chaque membre actif du vocal.',
  'Dessine ton avatar Discord en moins de 2 minutes et envoie une photo.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('defi')
    .setDescription('🎯 Défie un membre avec un vrai défi !')
    .addUserOption(o => o.setName('cible').setDescription('Membre à défier').setRequired(true)),
  cooldown: 10,

  async execute(interaction) {
    try {
    const target = interaction.options.getUser('cible');
    const mise   = interaction.options.getInteger('mise');
    const cfg    = db.getConfig(interaction.guildId);
    const emoji  = cfg.currency_emoji || '🪙';
    const name   = cfg.currency_name  || 'Coins';

    if (target.bot) return interaction.reply({ content: '❌ Tu ne peux pas défier un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas te défier toi-même.', ephemeral: true });

    // Vérifier la mise si spécifiée
    if (mise) {
      const challenger = db.getUser(interaction.user.id, interaction.guildId);
      if (challenger.balance < mise) return interaction.reply({ content: `❌ Tu n'as pas assez de ${name} pour cette mise.`, ephemeral: true });
    }

    const defi = DEFIS[Math.floor(Math.random() * DEFIS.length)];
    const timeLimit = 300; // 5 minutes pour accepter
    const endsAt = Math.floor(Date.now() / 1000) + timeLimit;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('defi_accept').setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('defi_refuse').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
    );

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle('🎯 Défi lancé !')
      .setDescription(`${target} es-tu prêt(e) à relever ce défi ?`)
      .addFields(
        { name: '🎯 Le défi', value: defi, inline: false },
        ...(mise ? [{ name: `${emoji} Mise`, value: `**${mise.toLocaleString('fr')} ${name}**`, inline: true }] : []),
        { name: '⏰ Temps pour accepter', value: `<t:${endsAt}:R>`, inline: true },
      )
      .setFooter({ text: `Défi de ${interaction.user.username}` });

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === target.id,
      time: timeLimit * 1000,
      max: 1,
    });

    collector.on('collect', async i => {
      if (i.customId === 'defi_refuse') {
        return i.update({
          embeds: [new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle('🎯 Défi refusé...')
            .setDescription(`**${target.username}** a refusé le défi. Quelle peur ! 😏`)
          ],
          components: []
        });
      }

      // Défi accepté
      if (mise) {
        const defender = db.getUser(target.id, interaction.guildId);
        if (defender.balance < mise) {
          return i.update({ content: `❌ ${target.username} n'a pas assez de ${name} pour cette mise.`, components: [], embeds: [] });
        }
        db.removeCoins(interaction.user.id, interaction.guildId, mise);
        db.removeCoins(target.id, interaction.guildId, mise);
      }

      const voteRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('defi_win_challenger').setLabel(`🏆 ${interaction.user.username} gagne`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('defi_win_defender').setLabel(`🏆 ${target.username} gagne`).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('defi_draw').setLabel('🤝 Égalité').setStyle(ButtonStyle.Secondary),
      );

      await i.update({
        embeds: [new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🎯 Défi en cours !')
          .setDescription(`**${target.username}** a accepté le défi !\n\n🎯 **${defi}**\n\nUne fois terminé, votez pour le résultat ci-dessous.`)
          .setFooter({ text: 'N\'importe quel membre peut voter !' })
        ],
        components: [voteRow]
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') msg.edit({ content: '⏱️ Le défi a expiré.', components: [] }).catch(() => {});
    });

    // Handler vote résultat (dans interactionCreate.js via button ids)
    // Pour simplifier, on gère ici via un 2e collector
    const voteCollector = msg.createMessageComponentCollector({
      filter: i => ['defi_win_challenger', 'defi_win_defender', 'defi_draw'].includes(i.customId),
      time: 600000,
      max: 1,
    });

    voteCollector.on('collect', async i => {
      let resultDesc;
      if (i.customId === 'defi_win_challenger') {
        if (mise) db.addCoins(interaction.user.id, interaction.guildId, mise * 2);
        resultDesc = `🏆 **${interaction.user.username}** a remporté le défi !${mise ? ` +${mise * 2} ${name}` : ''}`;
      } else if (i.customId === 'defi_win_defender') {
        if (mise) db.addCoins(target.id, interaction.guildId, mise * 2);
        resultDesc = `🏆 **${target.username}** a remporté le défi !${mise ? ` +${mise * 2} ${name}` : ''}`;
      } else {
        if (mise) {
          db.addCoins(interaction.user.id, interaction.guildId, mise);
          db.addCoins(target.id, interaction.guildId, mise);
        }
        resultDesc = `🤝 Égalité ! Les deux joueurs récupèrent leur mise.`;
      }

      await i.update({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🎯 Résultat du défi').setDescription(resultDesc)],
        components: []
      });
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
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
