const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SYMBOLS = {
  '⭐': { name: 'Wild Étoile', value: 0, isWild: true },
  '💜': { name: 'Améthyste', value: 25 },
  '💙': { name: 'Saphir', value: 22 },
  '💚': { name: 'Émeraude', value: 20 },
  '💛': { name: 'Topaze', value: 18 },
  '🔴': { name: 'Rubis', value: 15 },
  '🌀': { name: 'Opale', value: 12 },
  '🔮': { name: 'Cristal', value: 10 }
};

const REGULAR_SYMBOLS = ['💜', '💙', '💚', '💛', '🔴', '🌀', '🔮'];
const ALL_SYMBOLS = ['⭐', '💜', '💙', '💚', '💛', '🔴', '🌀', '🔮'];

const PAYLINES_LTOR = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0]
];

const PAYLINES_RTOL = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0]
];

function generateGrid(width = 5, height = 3) {
  const grid = [];
  for (let i = 0; i < height; i++) {
    const row = [];
    for (let j = 0; j < width; j++) {
      row.push(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
    }
    grid.push(row);
  }
  return grid;
}

function displayGrid(grid) {
  return grid.map(row => row.join('')).join('\n');
}

function getWildReels(grid) {
  const reels = [];
  for (let col = 0; col < grid[0].length; col++) {
    for (let row = 0; row < grid.length; row++) {
      if (grid[row][col] === '⭐') {
        reels.push(col);
        break;
      }
    }
  }
  return [...new Set(reels)];
}

function checkPayline(grid, payline, direction = 'ltor', expandedReels = []) {
  if (direction === 'rtol') {
    payline = payline.map((row, idx) => ({
      row,
      col: grid[0].length - 1 - idx
    }));
  }

  let matches = 0;
  let firstSymbol = null;

  for (let i = 0; i < payline.length; i++) {
    const row = direction === 'ltor' ? payline[i] : payline[i].row;
    const col = direction === 'ltor' ? i : payline[i].col;
    const symbol = grid[row][col];
    const isExpanded = expandedReels.includes(col);

    if (symbol === '⭐' || isExpanded) {
      matches++;
      if (!firstSymbol) firstSymbol = isExpanded ? grid[0][col] : symbol;
    } else if (!firstSymbol) {
      if (matches < 3) matches = 0;
      break;
    } else if (symbol === firstSymbol) {
      matches++;
    } else {
      break;
    }
  }

  return matches >= 3 ? { matches, symbol: firstSymbol } : null;
}

function calculateWin(grid, baseMise, expandedReels = []) {
  let totalWin = 0;

  PAYLINES_LTOR.forEach(payline => {
    const result = checkPayline(grid, payline, 'ltor', expandedReels);
    if (result) {
      const symbolValue = SYMBOLS[result.symbol]?.value || 0;
      totalWin += symbolValue * result.matches * baseMise;
    }
  });

  PAYLINES_RTOL.forEach(payline => {
    const result = checkPayline(grid, payline, 'rtol', expandedReels);
    if (result) {
      const symbolValue = SYMBOLS[result.symbol]?.value || 0;
      totalWin += symbolValue * result.matches * baseMise;
    }
  });

  return Math.floor(totalWin);
}

async function playRespin(grid, mise, reelsWithWilds) {
  let totalWin = 0;
  const expandedReels = reelsWithWilds;

  const newGrid = generateGrid(5, 3);
  for (const reel of expandedReels) {
    for (let row = 0; row < newGrid.length; row++) {
      newGrid[row][reel] = grid[row][reel];
    }
  }

  const respinWin = calculateWin(newGrid, mise, expandedReels);
  totalWin += respinWin;

  const additionalWilds = getWildReels(newGrid);
  const newWilds = additionalWilds.filter(w => !reelsWithWilds.includes(w));

  if (newWilds.length > 0 && expandedReels.length < 5) {
    expandedReels.push(...newWilds);
    const chainedWin = await playRespin(newGrid, mise, expandedReels);
    totalWin += chainedWin;
  }

  return totalWin;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starburst')
    .setDescription('⭐ Starburst — Gemmes néon, wilds expandants, Re-Spins chaînés')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser (minimum 10€)').setRequired(true).setMinValue(10)),
  name: 'starburst',
  aliases: ['st', 'star'],

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const mise = interaction.options.getInteger('mise');
    const user = db.getUser(userId, guildId);

    if (!user || user.balance < mise) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#ff0000').setTitle('❌ Solde insuffisant').setDescription(`Tu as besoin de ${mise}€. Solde: ${user?.balance || 0}€`)]
      });
    }

    const grid = generateGrid(5, 3);
    const gridDisplay = displayGrid(grid);

    db.removeCoins(userId, guildId, mise, { type: 'game_bet', note: 'starburst' });

    let totalWin = calculateWin(grid, mise);
    const wildReels = getWildReels(grid);
    let respins = 0;

    if (wildReels.length > 0) {
      respins = wildReels.length;
      const respinWin = await playRespin(grid, mise, wildReels);
      totalWin += respinWin;
    }

    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'starburst' });
    const newBalance = db.getUser(userId, guildId)?.balance || 0;

    const resultColor = totalWin > 0 ? '#00FF00' : '#FF1493';
    const resultEmbed = new EmbedBuilder()
      .setColor(resultColor)
      .setTitle('⭐ Starburst - Résultat')
      .setDescription(gridDisplay)
      .addFields(
        { name: 'Mise', value: `${mise}€`, inline: true },
        { name: 'Gain', value: `${totalWin}€`, inline: true },
        { name: 'Wilds ⭐', value: `${wildReels.length}`, inline: true },
        respins > 0 ? { name: '🔄 Re-Spins', value: `${respins}`, inline: true } : { name: '​', value: '​', inline: true },
        { name: 'Nouveau solde', value: `${newBalance}€`, inline: true }
      );

    const row = makeGameRow('st', userId, mise);
    await interaction.editReply({ embeds: [resultEmbed], components: [row] });
  },

  async run(message, args) {
    const mise = parseInt(args[0]) || 50;
    const userId = message.author.id;
    const guildId = message.guildId;
    const user = db.getUser(userId, guildId);

    if (!user || user.balance < mise) {
      return message.reply(`❌ Solde insuffisant. Tu as ${user?.balance || 0}€.`);
    }

    const fakeInteraction = {
      user: message.author,
      guildId,
      options: { getInteger: () => mise },
      deferred: false,
      replied: false,
      deferReply: async () => {},
      editReply: (content) => message.reply(content)
    };

    await this.execute(fakeInteraction);
  },

  async handleComponent(interaction, cid) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const balance = db.getUser(userId, guildId)?.balance || 0;

    if (cid.startsWith('st_replay_')) {
      const parts = cid.split('_');
      const mise = parseInt(parts[parts.length - 1]);
      if (balance < mise) {
        return interaction.reply({ content: '💸 Solde insuffisant!', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});
      const fakeInteraction = {
        user: interaction.user,
        guildId,
        options: { getInteger: () => mise },
        deferred: true,
        replied: true,
        editReply: (content) => interaction.editReply(content)
      };
      await this.execute(fakeInteraction);
      return true;
    }

    if (cid.startsWith('st_changemise_')) {
      const modal = changeMiseModal('st', userId);
      await interaction.showModal(modal);
      return true;
    }

    if (cid.startsWith('st_modal_')) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const parsedMise = parseMise(rawMise, balance);

      if (!parsedMise || parsedMise < 10) {
        return interaction.editReply({ content: '❌ Mise invalide (min 10€)' });
      }
      if (balance < parsedMise) {
        return interaction.editReply({ content: '💸 Solde insuffisant!' });
      }

      const fakeInteraction = {
        user: interaction.user,
        guildId,
        options: { getInteger: () => parsedMise },
        deferred: true,
        replied: true,
        editReply: (content) => interaction.editReply(content)
      };
      await this.execute(fakeInteraction);
      return true;
    }

    return false;
  }
};
