/**
 * NexusBot — Roulette Casino
 * /roulette <mise> <pari>
 * Parier sur : rouge/noir, pair/impair, 1-12/13-24/25-36, ou un numéro précis
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// 0-36, 0 est vert (banque gagne toujours sur 0)
const ROUGES = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

function getColor(n) {
  if (n === 0) return '🟢';
  return ROUGES.includes(n) ? '🔴' : '⚫';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🎡 Casino Roulette — tente ta chance !')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Montant à miser (€)')
      .setRequired(true)
      .setMinValue(5)
      .setMaxValue(10000)
    )
    .addStringOption(o => o
      .setName('pari')
      .setDescription('Sur quoi miser ?')
      .setRequired(true)
      .addChoices(
        { name: '🔴 Rouge (×2)',             value: 'rouge' },
        { name: '⚫ Noir (×2)',               value: 'noir' },
        { name: '🔢 Pair (×2)',               value: 'pair' },
        { name: '🔢 Impair (×2)',             value: 'impair' },
        { name: '1️⃣ 1-12 (×3)',              value: '1-12' },
        { name: '2️⃣ 13-24 (×3)',             value: '13-24' },
        { name: '3️⃣ 25-36 (×3)',             value: '25-36' },
        { name: '🟩 0 (×35)',                 value: '0' },
      )
    ),
  cooldown: 5,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const mise   = interaction.options.getInteger('mise');
    const pari   = interaction.options.getString('pari');

    // Vérification solde
    if (user.balance < mise) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Tu as **${user.balance.toLocaleString('fr')}${symbol}** mais tu veux miser **${mise.toLocaleString('fr')}${symbol}**.`)
          .setFooter({ text: '/work /daily /crime pour gagner de l\'argent !' })
        ], ephemeral: true
      });
    }

    // Lancer la roulette
    const result = Math.floor(Math.random() * 37); // 0 à 36
    const colorEmoji = getColor(result);
    const isRouge = ROUGES.includes(result);
    const isNoir  = result > 0 && !isRouge;
    const isPair  = result > 0 && result % 2 === 0;
    const isImpair = result > 0 && result % 2 === 1;

    // Calcul gain
    let won = false;
    let mult = 0;

    switch (pari) {
      case 'rouge':  won = isRouge;                          mult = 2; break;
      case 'noir':   won = isNoir;                           mult = 2; break;
      case 'pair':   won = isPair;                           mult = 2; break;
      case 'impair': won = isImpair;                         mult = 2; break;
      case '1-12':   won = result >= 1 && result <= 12;      mult = 3; break;
      case '13-24':  won = result >= 13 && result <= 24;     mult = 3; break;
      case '25-36':  won = result >= 25 && result <= 36;     mult = 3; break;
      case '0':      won = result === 0;                     mult = 35; break;
    }

    const pariLabels = {
      rouge: '🔴 Rouge', noir: '⚫ Noir', pair: '🔢 Pair', impair: '🔢 Impair',
      '1-12': '1️⃣ 1-12', '13-24': '2️⃣ 13-24', '25-36': '3️⃣ 25-36', '0': '🟩 0',
    };

    if (won) {
      const gain = mise * mult;
      const profit = gain - mise;
      db.addCoins(interaction.user.id, interaction.guildId, profit);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🎡 Roulette — GAGNÉ !')
          .setDescription(`La bille s'arrête sur **${colorEmoji} ${result}** !`)
          .addFields(
            { name: '🎯 Pari',          value: pariLabels[pari],                          inline: true },
            { name: '💰 Mise',          value: `${mise.toLocaleString('fr')}${symbol}`,   inline: true },
            { name: '✖️ Multiplicateur', value: `×${mult}`,                                inline: true },
            { name: '💵 Gain',          value: `**+${profit.toLocaleString('fr')}${symbol}**`, inline: true },
            { name: `${symbol} Solde`,  value: `**${(user.balance + profit).toLocaleString('fr')}${symbol}**`, inline: true },
          )
          .setFooter({ text: '🎡 La roulette tourne encore !' })
          .setTimestamp()
        ]
      });
    } else {
      db.removeCoins(interaction.user.id, interaction.guildId, mise);
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🎡 Roulette — Perdu !')
          .setDescription(`La bille s'arrête sur **${colorEmoji} ${result}**... Ce n'était pas ton numéro.`)
          .addFields(
            { name: '🎯 Pari',          value: pariLabels[pari],                           inline: true },
            { name: '💸 Perdu',         value: `**-${mise.toLocaleString('fr')}${symbol}**`, inline: true },
            { name: `${symbol} Solde`,  value: `**${Math.max(0, user.balance - mise).toLocaleString('fr')}${symbol}**`, inline: true },
          )
          .setFooter({ text: 'Retente ta chance !' })
          .setTimestamp()
        ]
      });
    }
  }
};
