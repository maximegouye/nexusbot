const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SYMBOLS = {
  '🍭': { name: 'Sucette-Bombe', value: 0, isScatter: true },
  '🍬': { name: 'Bonbon', value: 25 },
  '🍒': { name: 'Cerise', value: 20 },
  '🍇': { name: 'Raisin', value: 18 },
  '🍉': { name: 'Pastèque', value: 15 },
  '🍑': { name: 'Pêche', value: 12 },
  '🍋': { name: 'Citron', value: 10 },
  '💗': { name: 'Cœur Sucre', value: 8 }
};

const REGULAR_SYMBOLS = ['🍬', '🍒', '🍇', '🍉', '🍑', '🍋', '💗'];
const ALL_SYMBOLS = ['🍭', '🍬', '🍒', '🍇', '🍉', '🍑', '🍋', '💗'];

function generateGrid(width = 6, height = 5) {
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

function findClusters(grid) {
  const visited = new Set();
  const clusters = [];

  function dfs(row, col, symbol, cluster) {
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return;
    const key = `${row},${col}`;
    if (visited.has(key) || grid[row][col] !== symbol) return;

    visited.add(key);
    cluster.push({ row, col });

    dfs(row - 1, col, symbol, cluster);
    dfs(row + 1, col, symbol, cluster);
    dfs(row, col - 1, symbol, cluster);
    dfs(row, col + 1, symbol, cluster);
  }

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[0].length; j++) {
      const key = `${i},${j}`;
      if (!visited.has(key) && grid[i][j] !== '⬜') {
        const cluster = [];
        dfs(i, j, grid[i][j], cluster);
        if (cluster.length >= 8) {
          clusters.push({ symbol: grid[i][j], positions: cluster });
        }
      }
    }
  }

  return clusters;
}

function cascadeGrid(grid) {
  let hasCascade = false;
  const toRemove = new Set();

  const clusters = findClusters(grid);
  clusters.forEach(c => {
    c.positions.forEach(p => toRemove.add(`${p.row},${p.col}`));
  });

  for (let col = 0; col < grid[0].length; col++) {
    let writePos = grid.length - 1;
    for (let row = grid.length - 1; row >= 0; row--) {
      if (!toRemove.has(`${row},${col}`)) {
        grid[writePos][col] = grid[row][col];
        if (writePos !== row) hasCascade = true;
        writePos--;
      }
    }
    for (let row = writePos; row >= 0; row--) {
      grid[row][col] = REGULAR_SYMBOLS[Math.floor(Math.random() * REGULAR_SYMBOLS.length)];
      hasCascade = true;
    }
  }

  return { grid, hasCascade: hasCascade || clusters.length > 0, clusters };
}

function displayGrid(grid) {
  return grid.map(row => row.join('')).join('\n');
}

function calculateWin(grid, baseMise) {
  let totalWin = 0;
  let cascadeMultiplier = 1;

  while (true) {
    const { grid: newGrid, clusters } = cascadeGrid(grid);
    grid = newGrid;

    if (clusters.length === 0) break;

    clusters.forEach(cluster => {
      const symbolValue = SYMBOLS[cluster.symbol].value || 0;
      totalWin += symbolValue * cluster.positions.length * baseMise * cascadeMultiplier;
    });

    cascadeMultiplier += 0.5;
  }

  return Math.floor(totalWin);
}

async function playFreeSpins(mise, freeSpins) {
  let totalWin = 0;
  let multiplicatorAcc = 1;

  for (let spin = 0; spin < freeSpins; spin++) {
    let grid = generateGrid(6, 5);

    while (true) {
      const { clusters } = cascadeGrid(grid);
      if (clusters.length === 0) break;

      if (Math.random() < 0.6) {
        const multipliers = [2, 3, 5, 8, 10, 25, 50, 100];
        multiplicatorAcc *= multipliers[Math.floor(Math.random() * multipliers.length)];
      }

      clusters.forEach(cluster => {
        const symbolValue = SYMBOLS[cluster.symbol].value || 0;
        totalWin += symbolValue * cluster.positions.length * mise * multiplicatorAcc;
      });

      const { grid: cascaded } = cascadeGrid(grid);
      grid = cascaded;
    }
  }

  return Math.floor(totalWin);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sweet-bonanza')
    .setDescription('🍭 Sweet Bonanza — Bombes ×100, 10 Free Spins accumulateurs')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser (minimum 10€)').setRequired(true).setMinValue(10)),
  name: 'sweet-bonanza',
  aliases: ['sb', 'bonanza'],

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

    let grid = generateGrid(6, 5);
    const initialDisplay = displayGrid(grid);

    db.removeCoins(userId, guildId, mise, { type: 'game_bet', note: 'sweet-bonanza' });

    let totalWin = 0;
    let freeSpins = 0;
    let scatterCount = 0;

    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col] === '🍭') scatterCount++;
      }
    }

    if (scatterCount >= 4) {
      freeSpins = 10;
      totalWin = await playFreeSpins(mise, freeSpins);
    } else {
      totalWin = calculateWin(JSON.parse(JSON.stringify(grid)), mise);
    }

    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'sweet-bonanza' });
    const newBalance = db.getUser(userId, guildId)?.balance || 0;

    const resultColor = totalWin > 0 ? '#00ff00' : '#ff0000';
    const resultEmbed = new EmbedBuilder()
      .setColor(resultColor)
      .setTitle('🍭 Sweet Bonanza - Résultat')
      .setDescription(initialDisplay)
      .addFields(
        { name: 'Mise', value: `${mise}€`, inline: true },
        { name: 'Gain', value: `${totalWin}€`, inline: true },
        { name: 'Bombes', value: `${scatterCount}`, inline: true },
        freeSpins > 0 ? { name: '🎁 Free Spins', value: `${freeSpins}`, inline: true } : { name: '​', value: '​', inline: true },
        { name: 'Nouveau solde', value: `${newBalance}€`, inline: true }
      );

    const row = makeGameRow('sb', userId, mise);
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

    if (cid.startsWith('sb_replay_')) {
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

    if (cid.startsWith('sb_changemise_')) {
      const modal = changeMiseModal('sb', userId);
      await interaction.showModal(modal);
      return true;
    }

    if (cid.startsWith('sb_modal_')) {
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
