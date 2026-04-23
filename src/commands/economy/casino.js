/**
 * /casino — Menu unifié du casino NexusBot.
 * Affiche tous les jeux + stats personnelles + top gagnants.
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function buildMainEmbed(interaction, cfg) {
  const user = db.getUser(interaction.user.id, interaction.guildId);
  const symbol = cfg.currency_emoji || '€';

  // Stats perso
  const stats = db.getGameStats ? db.getGameStats(interaction.user.id, interaction.guildId) : [];
  const totalPlayed = stats.reduce((s, g) => s + (g.played || 0), 0);
  const totalWon    = stats.reduce((s, g) => s + (g.total_won || 0), 0);
  const totalBet    = stats.reduce((s, g) => s + (g.total_bet || 0), 0);
  const biggestWin  = Math.max(0, ...stats.map(g => g.biggest_win || 0));

  return new EmbedBuilder()
    .setColor(cfg.color || '#E67E22')
    .setTitle('🎰 CASINO NexusBot · Les Grands Jeux')
    .setDescription(
      `Bienvenue **${interaction.user.username}** au Casino Royal NexusBot 🎲\n\n` +
      `*Tu as **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche, **${user.bank.toLocaleString('fr-FR')}${symbol}** en banque.*\n` +
      `*Toutes les mises acceptent : nombres, \`all\`, \`tout\`, \`50%\`, \`moitié\`, \`25%\`…*\n\n` +
      '**🎴 Cartes**\n' +
      '• `/blackjack` · `&bj` — Bat le croupier à 21\n' +
      '• `/poker` · `&poker` — Video Poker Jacks or Better\n\n' +
      '**🎡 Tables**\n' +
      '• `/roulette` · `&roul` — 13 types de paris (rouge, noir, numéro…)\n' +
      '• `/roue` · `&roue` — Roue de la fortune · jusqu\'à ×10\n\n' +
      '**🎰 Machines & Risque**\n' +
      '• `/slots` · `&slots` — Machine à sous · JACKPOT ×50\n' +
      '• `/mines` · `&mines` — Démineur · cash out avant la mine\n' +
      '• `/crash` · `&crash` — Vise un multi · encaisse avant le crash\n\n' +
      '**🎲 Rapides**\n' +
      '• `/des` · `&des` — 2 dés · 6 types de paris\n' +
      '• `/coinflip` · `&cf` — Pile ou face entre membres\n\n' +
      '**💰 Investissement**\n' +
      '• `/crypto` · `&crypto` — Trading crypto (6 monnaies fluctuantes)',
    )
    .addFields(
      { name: '🎮 Parties jouées',  value: `**${totalPlayed}**`, inline: true },
      { name: `💰 Total misé`,      value: `**${totalBet.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: `🏆 Total gagné`,     value: `**${totalWon.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: `💎 Plus gros gain`,   value: `**${biggestWin.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: `📊 Profit net`,       value: `**${(totalWon - totalBet).toLocaleString('fr-FR')}${symbol}**`, inline: true },
    )
    .setFooter({ text: '🎰 Casino NexusBot · mises ILLIMITÉES · FR · addictif' })
    .setTimestamp();
}

function buildButtons(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`casino_bj:${userId}`).setLabel('♠️ Blackjack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`casino_poker:${userId}`).setLabel('🎴 Poker').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`casino_roul:${userId}`).setLabel('🎡 Roulette').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`casino_roue:${userId}`).setLabel('🌀 Roue').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`casino_slots:${userId}`).setLabel('🎰 Slots').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`casino_mines:${userId}`).setLabel('💣 Mines').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`casino_crash:${userId}`).setLabel('📈 Crash').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`casino_des:${userId}`).setLabel('🎲 Dés').setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`casino_crypto:${userId}`).setLabel('💹 Crypto').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`casino_stats:${userId}`).setLabel('📊 Mes stats détaillées').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`casino_top:${userId}`).setLabel('🏆 Top gagnants').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('🎰 Casino NexusBot · tous les jeux · stats · classements'),
  cooldown: 3,

  async execute(interaction) {
    const cfg = db.getConfig(interaction.guildId);
    return interaction.editReply({ embeds: [buildMainEmbed(interaction, cfg)], components: buildButtons(interaction.user.id) });
  },

  _build: { buildMainEmbed, buildButtons },
};
