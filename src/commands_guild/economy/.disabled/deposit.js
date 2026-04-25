const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('🏦 Dépose des coins en banque (protégés du vol)')
    .addStringOption(o => o.setName('montant').setDescription('Montant à déposer (ou "tout")').setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg   = db.getConfig(interaction.guildId);
    const user  = db.getUser(interaction.user.id, interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const input = interaction.options.getString('montant').toLowerCase();

    let amount;
    if (input === 'tout' || input === 'all') {
      amount = user.balance;
    } else {
      amount = parseInt(input);
    }

    if (isNaN(amount) || amount <= 0) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Montant invalide.', ephemeral: true });
    }
    if (amount > user.balance) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')} ${name}** en portefeuille.`)
        ], ephemeral: true
      });
    }

    db.db.prepare('UPDATE users SET balance = balance - ?, bank = bank + ? WHERE user_id = ? AND guild_id = ?')
      .run(amount, amount, interaction.user.id, interaction.guildId);

    const updated = db.getUser(interaction.user.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle(`🏦 Dépôt bancaire`)
      .addFields(
        { name: `${emoji} Déposé`,     value: `**+${amount.toLocaleString('fr-FR')}** ${name}`, inline: true },
        { name: `${emoji} Portefeuille`, value: `**${updated.balance.toLocaleString('fr-FR')}** ${name}`, inline: true },
        { name: '🏦 Banque',           value: `**${updated.bank.toLocaleString('fr-FR')}** ${name}`, inline: true },
      )
      .setFooter({ text: 'Les coins en banque sont protégés du vol !' });

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};
