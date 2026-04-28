// ============================================================
// transfert.js — Transfert P2P de coins entre membres
// Emplacement : src/commands_guild/economy/transfert.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfert')
    .setDescription('💸 Envoyer des € à un autre membre du serveur')
    .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
    .addIntegerOption(o => o.setName('montant').setDescription('Montant à envoyer').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('raison').setDescription('Raison (optionnel)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const target  = interaction.options.getUser('membre');
    const montant = interaction.options.getInteger('montant');
    const raison  = interaction.options.getString('raison') || null;
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '€';

    if (target.id === userId) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas t\'te transférer des €.', ephemeral: true });
    }
    if (target.bot) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible d\'envoyer des € à un bot.', ephemeral: true });
    }

    const sender = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
    if (!sender || sender.balance < montant) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        content: `❌ Solde insuffisant. Tu as **${(sender?.balance || 0).toLocaleString('fr-FR')} ${coin}**.`,
        ephemeral: true,
      });
    }

    // Transaction sécurisée
    db.removeCoins(userId, guildId, montant);
    db.addCoins(target.id, guildId, montant);

    // Log dans transactions si la table existe
    try {
      db.db.prepare(
        'INSERT INTO transactions (guild_id, from_id, to_id, amount, reason, type) VALUES (?,?,?,?,?,?)'
      ).run(guildId, userId, target.id, montant, raison, 'transfer');
    } catch {}

    const newBal = db.getUser(userId, guildId)?.balance || 0;

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('💸 Transfert effectué')
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: '👤 De',           value: `${interaction.user}`,            inline: true },
        { name: '👤 À',            value: `${target}`,                      inline: true },
        { name: '💰 Montant',      value: `**${montant.toLocaleString('fr-FR')} ${coin}**`, inline: true },
        { name: '🏦 Votre solde',  value: `${newBal.toLocaleString('fr-FR')} ${coin}`,    inline: true },
      );

    if (raison) embed.addFields({ name: '📝 Raison', value: raison, inline: false });

    embed.setTimestamp();

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  },

  name: 'transfert',
  aliases: ['envoyer', 'send', 'payer', 'pay'],
  async run(message, args) {
    const mention = message.mentions.users.first();
    const montant = parseInt(args[1]);
    const raison  = args.slice(2).join(' ') || null;
    const userId  = message.author.id;
    const guildId = message.guildId;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '€';

    if (!mention || !montant || montant < 1) {
      return message.reply('❌ Usage : `&transfert @membre <montant> [raison]`\nEx: `&transfert @Bob 500 remboursement`');
    }
    if (mention.id === userId) return message.reply('❌ Tu ne peux pas t\'envoyer des €.');
    if (mention.bot)           return message.reply('❌ Impossible d\'envoyer des € à un bot.');

    const sender = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
    if (!sender || sender.balance < montant) {
      return message.reply(`❌ Solde insuffisant. Tu as **${(sender?.balance || 0).toLocaleString('fr-FR')} ${coin}**.`);
    }

    db.removeCoins(userId, guildId, montant);
    db.addCoins(mention.id, guildId, montant);
    try {
      db.db.prepare('INSERT INTO transactions (guild_id,from_id,to_id,amount,reason,type) VALUES (?,?,?,?,?,?)').run(guildId, userId, mention.id, montant, raison, 'transfer');
    } catch {}

    const newBal = db.getUser(userId, guildId)?.balance || 0;
    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Transfert effectué')
        .setDescription(`Tu as envoyé **${montant.toLocaleString('fr-FR')} ${coin}** à ${mention}${raison ? `\n📝 *${raison}*` : ''}`)
        .addFields({ name: '🏦 Votre solde', value: `${newBal.toLocaleString('fr-FR')} ${coin}`, inline: true })
        .setTimestamp()],
    });
  },
};

