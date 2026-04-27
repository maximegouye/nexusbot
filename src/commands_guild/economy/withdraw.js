const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('💸 Retire des coins de ta banque')
    .addStringOption(o => o.setName('montant').setDescription('Montant à retirer (ou "tout")').setRequired(true)),
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
      amount = user.bank;
    } else {
      amount = parseInt(input);
    }

    if (isNaN(amount) || amount <= 0) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Montant invalide.', ephemeral: true });
    }
    if (amount > user.bank) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setDescription(`❌ Tu n'as que **${user.bank.toLocaleString('fr-FR')} ${name}** en banque.`)
        ], ephemeral: true
      });
    }

    db.db.prepare('UPDATE users SET bank = bank - ?, balance = balance + ? WHERE user_id = ? AND guild_id = ?')
      .run(amount, amount, interaction.user.id, interaction.guildId);

    const updated = db.getUser(interaction.user.id, interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`💸 Retrait bancaire`)
      .addFields(
        { name: `${emoji} Retiré`,       value: `**${amount.toLocaleString('fr-FR')}** ${name}`, inline: true },
        { name: `${emoji} Portefeuille`, value: `**${updated.balance.toLocaleString('fr-FR')}** ${name}`, inline: true },
        { name: '🏦 Banque',             value: `**${updated.bank.toLocaleString('fr-FR')}** ${name}`, inline: true },
      );

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
