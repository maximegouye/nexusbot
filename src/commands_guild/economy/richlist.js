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
    .setName('richlist')
    .setDescription('💰 Top 10 des membres les plus riches du serveur')
    .addStringOption(o => o.setName('type').setDescription('Classement par').setRequired(false)
      .addChoices(
        { name: '💳 Solde total (wallet + banque)', value: 'total' },
        { name: '👛 Portefeuille', value: 'balance' },
        { name: '🏦 Banque', value: 'bank' },
        { name: '💎 Total gagné (all-time)', value: 'earned' },
      )),

  async execute(interaction) {
    await interaction.deferReply().catch(() => {});
    const type = interaction.options.getString('type') || 'total';

    let query, label;
    switch (type) {
      case 'balance': query = 'SELECT user_id, balance as amount FROM users WHERE guild_id=? ORDER BY balance DESC LIMIT 10'; label = '👛 Portefeuille'; break;
      case 'bank':    query = 'SELECT user_id, bank as amount FROM users WHERE guild_id=? ORDER BY bank DESC LIMIT 10'; label = '🏦 Banque'; break;
      case 'earned':  query = 'SELECT user_id, total_earned as amount FROM users WHERE guild_id=? ORDER BY total_earned DESC LIMIT 10'; label = '💎 Total gagné'; break;
      default:        query = 'SELECT user_id, (balance+bank) as amount FROM users WHERE guild_id=? ORDER BY (balance+bank) DESC LIMIT 10'; label = '💰 Solde total';
    }

    const rows = db.db.prepare(query).all(interaction.guildId);
    if (!rows.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: 'Aucune donnée économique.' });

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(rows.map(async (r, i) => {
      let name;
      try { const u = await interaction.client.users.fetch(r.user_id); name = u.username; } catch { name = `Utilisateur inconnu`; }
      const medal = medals[i] || `**${i+1}.**`;
      return `${medal} **${name}** — ${r.amount?.toLocaleString('fr-FR') ?? 0} €`;
    }));

    // Rang du joueur actuel
    const selfRow = db.db.prepare(
      type === 'total' ? 'SELECT COUNT(*)+1 as rank FROM users WHERE guild_id=? AND (balance+bank) > (SELECT balance+bank FROM users WHERE guild_id=? AND user_id=?)'
        : `SELECT COUNT(*)+1 as rank FROM users WHERE guild_id=? AND ${type} > (SELECT ${type} FROM users WHERE guild_id=? AND user_id=?)`
    ).get(interaction.guildId, interaction.guildId, interaction.user.id);

    const cfg = db.getConfig(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(`💰 Classement ${label} — ${interaction.guild.name}`)
      .setDescription(lines.join('\n'))
      .addFields({ name: '📊 Ton rang', value: `#${selfRow?.rank ?? '?'}`, inline: true })
      .setThumbnail(interaction.guild.iconURL())
      .setFooter({ text: `Monnaie: ${cfg.currency_emoji || '€'} ${cfg.currency_name || 'Euros'}` })
      .setTimestamp();

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  },
  name: 'richlist',
  aliases: ["toprichesse"],
  async run(message, args) {
    const type = args[0] || 'total';
    const fake = mkFake(message, { getString: (k) => k === 'type' ? type : null });
    await this.execute(fake);
  },
};
