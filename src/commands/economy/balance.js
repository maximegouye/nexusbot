const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// -- Adaptateur prefixe->interaction
function mkFake(message, opts) {
  opts = opts || {};
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
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💶 Affiche ton solde ou celui d\'un autre membre')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* déjà ack */ }
    }

    const target  = interaction.options.getUser('membre') || interaction.user;
    const cfg     = db.getConfig(interaction.guildId);
    const user    = db.getUser(target.id, interaction.guildId);
    const symbol  = cfg.currency_emoji || '€';
    const name    = cfg.currency_name  || 'Euros';

    // Classement par richesse totale (portefeuille + banque)
    const rank = db.db.prepare(
      'SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND (balance + bank) > ?'
    ).get(interaction.guildId, user.balance + user.bank).r + 1;

    // Total des membres avec de l'argent
    const totalMembers = db.db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE guild_id = ? AND (balance + bank) > 0"
    ).get(interaction.guildId).c;

    // Portefeuille crypto
    let cryptoValue = 0;
    let cryptoLines = '';
    try {
      const wallet = db.getWallet(target.id, interaction.guildId);
      if (wallet && wallet.length) {
        const market = new Map((db.getCryptoMarket() || []).map(c => [c.symbol, c]));
        for (const w of wallet) {
          const m = market.get(w.crypto);
          if (!m) continue;
          const val = Math.floor(w.amount * m.price);
          cryptoValue += val;
          cryptoLines += `${m.emoji} **${w.crypto}** · ${w.amount.toFixed(6)} → ${val.toLocaleString('fr-FR')}${symbol}\n`;
        }
      }
    } catch {}

    const netWorth = user.balance + user.bank + cryptoValue;
    const percentile = totalMembers > 1 ? Math.round((1 - (rank - 1) / totalMembers) * 100) : 100;
    const topPct = 100 - percentile + 1;

    // Rang coloré selon position
    const rankColor = rank === 1 ? '#FFD700' : rank <= 3 ? '#C0C0C0' : rank <= 10 ? '#CD7F32' : cfg.color || '#7B2FBE';

    // Barre de richesse relative (par rapport au #1)
    let barStr = '';
    try {
      const top1 = db.db.prepare(
        'SELECT MAX(balance + COALESCE(bank,0)) as mx FROM users WHERE guild_id=?'
      ).get(interaction.guildId)?.mx || 1;
      const pct = Math.min(Math.round((netWorth / top1) * 10), 10);
      barStr = `\`${'█'.repeat(pct)}${'░'.repeat(10 - pct)}\`  ${topPct <= 10 ? `🔥 Top ${topPct}%` : `Top ${topPct}%`}`;
    } catch {}

    // Streak daily
    const streak = user.streak || 0;
    const flames = streak > 0 ? ` · ${'🔥'.repeat(Math.min(streak, 5))} ${streak}j de série` : '';

    const embed = new EmbedBuilder()
      .setColor(rankColor)
      .setAuthor({ name: `${target.username} · Portefeuille`, iconURL: target.displayAvatarURL({ size: 64 }) })
      .setDescription(
        `**Fortune totale : ${netWorth.toLocaleString('fr-FR')} ${symbol}**\n${barStr || ''}`
      )
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👛 Liquide',       value: `**${user.balance.toLocaleString('fr-FR')}${symbol}**`,  inline: true },
        { name: '🏦 Banque',        value: `**${user.bank.toLocaleString('fr-FR')}${symbol}**`,     inline: true },
        { name: '💹 Crypto',        value: `**${cryptoValue.toLocaleString('fr-FR')}${symbol}**`,   inline: true },
        { name: '🏆 Classement',    value: `**#${rank}** / ${totalMembers}`,                        inline: true },
        { name: '📈 Total gagné',   value: `**${(user.total_earned || 0).toLocaleString('fr-FR')}${symbol}**`, inline: true },
        { name: '📅 Fidélité',      value: `**${streak} jour${streak > 1 ? 's' : ''}**${flames}`,  inline: true },
      );

    if (cryptoLines) {
      embed.addFields({ name: '💱 Détails crypto', value: cryptoLines.slice(0, 1000), inline: false });
    }

    embed.setFooter({ text: `${name} · /daily · /work · /casino pour en gagner plus !` })
      .setTimestamp();

    // Boutons d'action rapide (uniquement si l'utilisateur consulte son propre profil)
    const components = [];
    if (target.id === interaction.user.id) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`banque_dep_${interaction.user.id}`)
          .setLabel('📥 Déposer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`banque_wit_${interaction.user.id}`)
          .setLabel('📤 Retirer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`banque_pret_${interaction.user.id}`)
          .setLabel('💳 Prêt')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`banque_ref_${interaction.user.id}`)
          .setLabel('🔄 Actualiser')
          .setStyle(ButtonStyle.Secondary),
      );
      components.push(row);
    }

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components });
  },
  name: 'balance',
  aliases: ["bal", "solde", "wallet", "argent", "portefeuille"],
    async run(message, args) {
    const target = message.mentions.users.first() || message.author;
    const fake = mkFake(message, { getUser: function() { return target; } });
    await this.execute(fake);
  },
};
