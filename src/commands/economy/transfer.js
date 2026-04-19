const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('💸 Envoie des coins à un autre membre')
    .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
    .addIntegerOption(o => o.setName('montant').setDescription('Montant à envoyer').setRequired(true).setMinValue(1)),
  cooldown: 10,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');

    if (target.bot) return interaction.reply({ content: '❌ Tu ne peux pas envoyer de coins à un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ Tu ne peux pas t\'envoyer des coins à toi-même.', ephemeral: true });

    const sender = db.getUser(interaction.user.id, interaction.guildId);

    // Frais de transfert : 2% (arrondi)
    const fee   = Math.ceil(amount * 0.02);
    const total = amount + fee;

    if (sender.balance < total) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Solde insuffisant. Tu as **${sender.balance.toLocaleString('fr-FR')} ${name}** mais il te faut **${total.toLocaleString('fr-FR')}** (frais inclus).`)
        ], ephemeral: true
      });
    }

    db.removeCoins(interaction.user.id, interaction.guildId, total);
    db.addCoins(target.id, interaction.guildId, amount);

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('💸 Transfert effectué !')
      .setDescription(`Tu as envoyé **${amount.toLocaleString('fr-FR')} ${name}** ${emoji} à **${target.username}**.`)
      .addFields(
        { name: '📤 Envoyé',    value: `**${amount.toLocaleString('fr-FR')}** ${name}`, inline: true },
        { name: '💼 Frais (2%)', value: `**${fee.toLocaleString('fr-FR')}** ${name}`,   inline: true },
        { name: '📥 Reçu',      value: `**${amount.toLocaleString('fr-FR')}** ${name}`, inline: true },
      )
      .setFooter({ text: `Solde restant : ${(sender.balance - total).toLocaleString('fr-FR')} ${name}` });

    await interaction.reply({ embeds: [embed] });
  }
};
