const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('💸 Envoie des coins à un autre membre')
    .addUserOption(o => o.setName('membre').setDescription('Destinataire').setRequired(true))
    .addIntegerOption(o => o.setName('montant').setDescription('Montant à transférer').setMinValue(1).setRequired(true)),
  cooldown: 10,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* déjà ack */ }
    }

    try {
    const cfg    = db.getConfig(interaction.guildId);
    const emoji  = cfg.currency_emoji || '€';
    const name   = cfg.currency_name  || 'Euros';
    const target = interaction.options.getUser('membre');
    const amount = interaction.options.getInteger('montant');

    if (target.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas envoyer de coins à un bot.', ephemeral: true });
    if (target.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas t\'envoyer des coins à toi-même.', ephemeral: true });

    const sender = db.getUser(interaction.user.id, interaction.guildId);

    // Frais de transfert : 2% (arrondi)
    const fee   = Math.ceil(amount * 0.02);
    const total = amount + fee;

    if (sender.balance < total) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
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

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }},
  name: 'transfer',
  aliases: ["virer2"],
    async run(message, args) {
    const target = message.mentions.users.first();
    const montant = args.find(a => !a.startsWith('<'));
    if (!target || !montant) return message.reply('❌ Usage : `&transfer @membre <montant>`');
    const fake = mkFake(message, { getUser: () => target, getInteger: (k) => k === 'montant' ? parseInt(montant) : null });
    await this.execute(fake);
  },
};
