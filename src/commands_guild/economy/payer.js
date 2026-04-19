/**
 * NexusBot — /payer
 * Envoyer de l'argent à un autre membre avec confirmation
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('payer')
    .setDescription('💸 Envoyer des euros à un autre membre')
    .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
    .addStringOption(o => o.setName('montant').setDescription('Montant à envoyer (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30))
    .addStringOption(o => o.setName('note').setDescription('Note/raison (optionnel)').setRequired(false).setMaxLength(100)),
  cooldown: 5,

  async execute(interaction) {
    const target  = interaction.options.getUser('membre');
    const senderPre = db.getUser(interaction.user.id, interaction.guildId);
    const parseBet = (raw, base) => {
      const s = String(raw ?? '').replace(/[\s_,]/g, '').toLowerCase();
      if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
      if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
      const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
      return Math.floor(n);
    };
    const amount = parseBet(interaction.options.get('montant')?.value, senderPre.balance);
    if (!Number.isFinite(amount) || amount < 1) {
      return interaction.reply({ content: '❌ Montant invalide. Minimum **1**. Tape un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
    }
    const note    = interaction.options.getString('note') || '';
    const cfg     = db.getConfig(interaction.guildId);
    const symbol  = cfg.currency_emoji || '€';

    if (target.id === interaction.user.id)
      return interaction.reply({ content: '❌ Tu ne peux pas te payer toi-même !', ephemeral: true });
    if (target.bot)
      return interaction.reply({ content: '❌ Tu ne peux pas payer un bot.', ephemeral: true });

    const sender = db.getUser(interaction.user.id, interaction.guildId);
    if (sender.balance < amount) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Tu as **${sender.balance.toLocaleString('fr-FR')}${symbol}** mais tu veux envoyer **${amount.toLocaleString('fr-FR')}${symbol}**.`)
        ], ephemeral: true
      });
    }

    // Frais de transaction : 2% plafonné à 50€
    const fee = Math.min(50, Math.floor(amount * 0.02));
    const totalCost = amount + fee;

    if (sender.balance < totalCost) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Solde insuffisant (frais inclus)')
          .setDescription(`Transaction : **${amount}${symbol}** + frais **${fee}${symbol}** = **${totalCost}${symbol}** requis\nTon solde : **${sender.balance.toLocaleString('fr-FR')}${symbol}**`)
        ], ephemeral: true
      });
    }

    // Confirmation
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`pay_confirm_${interaction.id}`).setLabel('Confirmer').setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`pay_cancel_${interaction.id}`).setLabel('Annuler').setEmoji('❌').setStyle(ButtonStyle.Danger),
    );

    const confirmEmbed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('💸 Confirmer le virement')
      .setDescription(`Tu vas envoyer de l'argent à <@${target.id}>.`)
      .addFields(
        { name: '💵 Montant',         value: `**${amount.toLocaleString('fr-FR')}${symbol}**`,     inline: true },
        { name: '💳 Frais (2%)',      value: `**${fee.toLocaleString('fr-FR')}${symbol}**`,         inline: true },
        { name: '💸 Coût total',      value: `**${totalCost.toLocaleString('fr-FR')}${symbol}**`,   inline: true },
        ...(note ? [{ name: '📝 Note', value: note, inline: false }] : []),
      )
      .setFooter({ text: 'Confirme dans 30 secondes sinon annulé auto.' });

    const msg = await interaction.reply({ embeds: [confirmEmbed], components: [row], fetchReply: true });

    const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000 });

    collector.on('collect', async i => {
      if (i.customId === `pay_confirm_${interaction.id}`) {
        // Vérifier solde encore (pourrait avoir changé)
        const senderNow = db.getUser(interaction.user.id, interaction.guildId);
        if (senderNow.balance < totalCost) {
          collector.stop();
          return i.update({
            embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Solde insuffisant').setDescription('Ton solde a changé.')],
            components: []
          });
        }

        db.removeCoins(interaction.user.id, interaction.guildId, totalCost);
        db.addCoins(target.id, interaction.guildId, amount);
        collector.stop();

        return i.update({
          embeds: [new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Virement effectué !')
            .addFields(
              { name: '👤 Expéditeur',    value: `<@${interaction.user.id}>`,                   inline: true },
              { name: '👤 Destinataire',  value: `<@${target.id}>`,                             inline: true },
              { name: '💵 Montant reçu',  value: `**${amount.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: '💳 Frais payés',   value: `**${fee.toLocaleString('fr-FR')}${symbol}**`,    inline: true },
              ...(note ? [{ name: '📝 Note', value: note, inline: false }] : []),
            )
            .setTimestamp()
          ],
          components: []
        });
      }

      if (i.customId === `pay_cancel_${interaction.id}`) {
        collector.stop();
        return i.update({
          embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Virement annulé').setDescription('Transaction annulée.')],
          components: []
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        msg.edit({
          embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('⏰ Virement expiré').setDescription('Tu n\'as pas confirmé à temps.')],
          components: []
        }).catch(() => {});
      }
    });
  }
};
