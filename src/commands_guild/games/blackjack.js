// blackjack.js — BlackJack avec blackjackEngine + DB session
const { SlashCommandBuilder } = require('discord.js');
const db  = require('../../database/db');
const bjm = require('../../utils/blackjackEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Jouez au BlackJack contre le croupier')
    .addStringOption(o => o
      .setName('mise')
      .setDescription('Montant à miser (ex: 100, 500, all, 50%)')
      .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const user    = db.getUser(userId, guildId);
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const symbol  = cfg?.coin || '🪙';
    const balance = Number(user?.balance ?? user?.solde ?? 0);

    const rawMise = interaction.options.getString('mise');
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') {
      mise = balance;
    } else if (rawMise.endsWith('%')) {
      mise = Math.floor(balance * parseInt(rawMise) / 100);
    } else {
      mise = parseInt(rawMise);
    }

    if (isNaN(mise) || mise < 10)
      return interaction.editReply({ content: `❌ Mise invalide. Min 10 ${symbol}. Ex: \`/blackjack 100\``, ephemeral: true });
    if (!user || balance < mise)
      return interaction.editReply({ content: `❌ Solde insuffisant. Tu as **${balance}** ${symbol}.`, ephemeral: true });

    db.removeCoins(userId, guildId, mise);
    const embedOpts = { symbol, color: '#FFD700', userName: interaction.user.username };
    const { game, immediateFinish } = bjm.startGame({ bet: BigInt(mise), balance: BigInt(balance) });

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(userId, guildId, Number(game.payout));
      return interaction.editReply({ embeds: [bjm.buildEmbed(game, embedOpts)] });
    }

    await interaction.editReply({ embeds: [bjm.buildEmbed(game, embedOpts)], components: [bjm.buildButtons(game)] });
    try {
      const msg = await interaction.fetchReply();
      db.saveGameSession(msg.id, userId, guildId, interaction.channelId, 'blackjack',
        { state: bjm.serialize(game), embedOpts }, 1800);
    } catch (e) { console.error('[BLACKJACK] saveGameSession error:', e.message); }
  },

  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const userId  = message.author.id;
    const guildId = message.guildId;
    const user    = db.getUser(userId, guildId);
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const symbol  = cfg?.coin || '🪙';
    const balance = Number(user?.balance ?? user?.solde ?? 0);
    const rawMise = args[0];
    if (!rawMise) return message.reply(`❌ Usage : \`&blackjack <mise>\` (min 10)`);
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') {
      mise = balance;
    } else if (rawMise.endsWith('%')) {
      mise = Math.floor(balance * parseInt(rawMise) / 100);
    } else {
      mise = parseInt(rawMise);
    }
    if (isNaN(mise) || mise < 10) return message.reply(`❌ Mise invalide. Min 10 ${symbol}.`);
    if (!user || balance < mise) return message.reply(`❌ Solde insuffisant. Tu as **${balance}** ${symbol}.`);
    db.removeCoins(userId, guildId, mise);
    const embedOpts = { symbol, color: '#FFD700', userName: message.author.username };
    const { game, immediateFinish } = bjm.startGame({ bet: BigInt(mise), balance: BigInt(balance) });
    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(userId, guildId, Number(game.payout));
      return message.reply({ embeds: [bjm.buildEmbed(game, embedOpts)] });
    }
    const msg = await message.reply({ embeds: [bjm.buildEmbed(game, embedOpts)], components: [bjm.buildButtons(game)] });
    db.saveGameSession(msg.id, userId, guildId, message.channelId, 'blackjack',
      { state: bjm.serialize(game), embedOpts }, 1800);
  },
};
