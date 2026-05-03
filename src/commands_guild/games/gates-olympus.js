const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Symboles Grecs avec valeurs
const SYMBOLS = {
  ZEUS: { emoji: '⚡', value: 25 },
  AMPHORA: { emoji: '🏺', value: 20 },
  EAGLE: { emoji: '🦅', value: 18 },
  GEM: { emoji: '💎', value: 15 },
  LAUREL: { emoji: '🌿', value: 12 },
  MOON: { emoji: '🌕', value: 10 },
  WINE: { emoji: '🍷', value: 8 },
  SWORD: { emoji: '⚔️', value: 6 },
  SCATTER: { emoji: '🎰', value: 0 },
  MULTIPLIER: { emoji: '✨', value: 0 }
};

const SYMBOL_KEYS = Object.keys(SYMBOLS).filter(k => !['SCATTER', 'MULTIPLIER'].includes(k));
const MULTIPLIER_VALUES = [2, 3, 5, 8, 10];

// Grille 6x5 (6 colonnes, 5 lignes)
const COLS = 6;
const ROWS = 5;

// Générer une grille aléatoire
function generateGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const rand = Math.random();
      if (rand < 0.12) {
        row.push('SCATTER');
      } else {
        row.push(SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]);
      }
    }
    grid.push(row);
  }
  return grid;
}

// BFS pour détecter les clusters adjacents
function findClusters(grid) {
  const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
  const clusters = [];

  function bfs(startR, startC, symbol) {
    const queue = [[startR, startC]];
    const cluster = [];
    visited[startR][startC] = true;

    while (queue.length > 0) {
      const [r, c] = queue.shift();
      cluster.push([r, c]);

      // Vérifier les 4 directions (haut, bas, gauche, droite)
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && grid[nr][nc] === symbol) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }

    return cluster;
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!visited[r][c] && grid[r][c] !== null && grid[r][c] !== 'SCATTER') {
        const symbol = grid[r][c];
        const cluster = bfs(r, c, symbol);
        if (cluster.length >= 8) {
          clusters.push({ symbol, positions: cluster, size: cluster.length });
        }
      }
    }
  }

  return clusters;
}

// Ajouter des multiplicateurs Zeus aléatoirement
function addMultipliers(grid) {
  const multiplierPositions = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === null && Math.random() < 0.3) {
        const mult = MULTIPLIER_VALUES[Math.floor(Math.random() * MULTIPLIER_VALUES.length)];
        grid[r][c] = { type: 'MULTIPLIER', value: mult };
        multiplierPositions.push({ r, c, mult });
      }
    }
  }
  return multiplierPositions;
}

// Faire tomber les symboles
function dropSymbols(grid) {
  for (let c = 0; c < COLS; c++) {
    const symbols = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] !== null && grid[r][c] !== undefined) {
        symbols.push(grid[r][c]);
      }
    }
    for (let r = 0; r < ROWS; r++) {
      grid[r][c] = null;
    }
    for (let i = 0; i < symbols.length; i++) {
      grid[ROWS - 1 - i][c] = symbols[i];
    }
  }
  // Remplir les cases vides
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === null) {
        const rand = Math.random();
        if (rand < 0.1) {
          grid[r][c] = 'SCATTER';
        } else {
          grid[r][c] = SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)];
        }
      }
    }
  }
}

// Calculer le gain pour un cluster
function calculateClusterWin(cluster, bet) {
  const symbol = cluster.symbol;
  const size = cluster.size;
  const symValue = SYMBOLS[symbol].value;
  // Gain = mise × (cluster_size / 10) × (symbol.value / 5)
  const gain = bet * (size / 10) * (symValue / 5);
  return Math.floor(gain);
}

// Afficher la grille (6 colonnes x 5 lignes)
function gridToString(grid) {
  const lines = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r][c];
      if (cell === null) {
        row.push('⬛');
      } else if (typeof cell === 'object' && cell.type === 'MULTIPLIER') {
        row.push(`×${cell.value}`);
      } else {
        row.push(SYMBOLS[cell]?.emoji || '❓');
      }
    }
    lines.push(row.join(' '));
  }
  return lines.join('\n');
}

// Compter les scatters pour les free spins
function countScatters(grid) {
  let count = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === 'SCATTER') count++;
    }
  }
  return count;
}

async function playGatesOlympus(interaction, bet) {
  let totalWin = 0;
  let cascades = 0;
  let baseMultiplier = 1;
  let grid = generateGrid();
  const cascadeDetails = [];

  // Boucle cascade
  for (let cascade = 0; cascade < 5; cascade++) {
    const clusters = findClusters(grid);
    if (clusters.length === 0) break;

    cascades++;
    baseMultiplier = 1 + cascade * 0.5; // 1, 1.5, 2, 2.5, 3

    // Ajouter des multiplicateurs Zeus
    const multipliers = addMultipliers(grid);
    let cascadeMultiplier = 1;
    for (const { mult } of multipliers) {
      cascadeMultiplier *= mult;
    }

    // Calculer gains
    let cascadeWin = 0;
    for (const cluster of clusters) {
      const clusterWin = calculateClusterWin(cluster, bet);
      cascadeWin += clusterWin;
    }
    cascadeWin = Math.floor(cascadeWin * baseMultiplier * cascadeMultiplier);
    totalWin += cascadeWin;

    const multiplierStr = multipliers.length > 0 ? ` + ⚡ ${multipliers.map(m => `×${m.mult}`).join('×')}` : '';
    cascadeDetails.push(`Cascade ${cascade + 1}: +${cascadeWin}€ (×${baseMultiplier.toFixed(1)}${multiplierStr})`);

    // Explosion des clusters
    for (const cluster of clusters) {
      for (const [r, c] of cluster.positions) {
        grid[r][c] = null;
      }
    }
    for (const { r, c } of multipliers) {
      grid[r][c] = null;
    }

    // Chute
    dropSymbols(grid);
    await sleep(300);
  }

  // Vérifier les free spins
  const scatterCount = countScatters(grid);
  let freeSpins = 0;
  if (scatterCount >= 4) {
    freeSpins = 15;
  }

  // Embed résultat
  const embed = new EmbedBuilder()
    .setColor('#ffd700')
    .setTitle('⚡ Gates of Olympus')
    .setDescription(`Mise: ${bet}€`)
    .addFields(
      { name: 'Grille Finale (6×5)', value: '```\n' + gridToString(grid) + '\n```' },
      { name: 'Cascades', value: cascadeDetails.length > 0 ? cascadeDetails.join('\n') : 'Aucune cascade' },
      { name: 'Gain Total', value: `**${totalWin}€**`, inline: true },
      { name: 'Bénéfice', value: `**${totalWin - bet}€**`, inline: true }
    );

  if (freeSpins > 0) {
    embed.addFields({ name: '🎰 Free Spins', value: `${freeSpins} Free Spins déclenchés!` });
  }

  embed.setFooter({ text: 'NexusBot Casino' })
    .setTimestamp();

  return { embed, totalWin, grid, freeSpins };
}

async function playGatesOlympusFreeSpins(interaction, bet, remainingSpins) {
  let totalWin = 0;
  let cascades = 0;
  let baseMultiplier = 3; // Multiplicateur de base pour free spins
  let grid = generateGrid();
  const cascadeDetails = [];

  // Boucle cascade
  for (let cascade = 0; cascade < 5; cascade++) {
    const clusters = findClusters(grid);
    if (clusters.length === 0) break;

    cascades++;
    baseMultiplier = 3 + cascade * 0.5; // 3, 3.5, 4, 4.5, 5

    // Ajouter des multiplicateurs Zeus
    const multipliers = addMultipliers(grid);
    let cascadeMultiplier = 1;
    for (const { mult } of multipliers) {
      cascadeMultiplier *= mult;
    }

    // Calculer gains
    let cascadeWin = 0;
    for (const cluster of clusters) {
      const clusterWin = calculateClusterWin(cluster, bet);
      cascadeWin += clusterWin;
    }
    cascadeWin = Math.floor(cascadeWin * baseMultiplier * cascadeMultiplier);
    totalWin += cascadeWin;

    const multiplierStr = multipliers.length > 0 ? ` + ⚡ ${multipliers.map(m => `×${m.mult}`).join('×')}` : '';
    cascadeDetails.push(`Cascade ${cascade + 1}: +${cascadeWin}€ (×${baseMultiplier.toFixed(1)}${multiplierStr})`);

    // Explosion des clusters
    for (const cluster of clusters) {
      for (const [r, c] of cluster.positions) {
        grid[r][c] = null;
      }
    }
    for (const { r, c } of multipliers) {
      grid[r][c] = null;
    }

    // Chute
    dropSymbols(grid);
    await sleep(300);
  }

  // Vérifier les scatters supplémentaires
  const scatterCount = countScatters(grid);
  let bonusSpins = 0;
  if (scatterCount >= 4) {
    bonusSpins = 5;
  }

  // Embed résultat
  const embed = new EmbedBuilder()
    .setColor('#ffd700')
    .setTitle('⚡ Gates of Olympus - Free Spin')
    .setDescription(`Mise: ${bet}€ | Spins restants: ${remainingSpins - 1}`)
    .addFields(
      { name: 'Grille Finale (6×5)', value: '```\n' + gridToString(grid) + '\n```' },
      { name: 'Cascades', value: cascadeDetails.length > 0 ? cascadeDetails.join('\n') : 'Aucune cascade' },
      { name: 'Gain Spin', value: `**${totalWin}€**`, inline: true },
      { name: 'Spins Restants', value: `**${remainingSpins - 1}**`, inline: true }
    );

  if (bonusSpins > 0) {
    embed.addFields({ name: '⚡ Spins Bonus', value: `+${bonusSpins} Free Spins déclenchés!` });
  }

  embed.setFooter({ text: 'NexusBot Casino' })
    .setTimestamp();

  return { embed, totalWin, grid, bonusSpins };
}

module.exports = {
  // Accessible via /casino — pas de slash command séparée pour rester sous la limite des 100
  name: 'gates-olympus',
  aliases: ['go', 'olympus'],
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const bet = interaction.options.getInteger('mise');
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const user = db.getUser(userId, guildId);
    const balance = user?.balance || 0;

    if (balance < bet) {
      return interaction.editReply({ content: '💸 Solde insuffisant!' });
    }

    db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gates-olympus' });
    const { embed, totalWin } = await playGatesOlympus(interaction, bet);
    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gates-olympus' });

    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

    const row = makeGameRow('go', userId, bet);
    return interaction.editReply({ embeds: [embed], components: [row] });
  },
  async run(message, args) {
    const bet = parseInt(args[0]) || 10;
    const userId = message.author.id;
    const guildId = message.guildId;
    const user = db.getUser(userId, guildId);
    const balance = user?.balance || 0;

    if (balance < bet) {
      return message.reply('💸 Solde insuffisant!');
    }

    db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gates-olympus' });
    const { embed, totalWin } = await playGatesOlympus(message, bet);
    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gates-olympus' });

    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

    const row = makeGameRow('go', userId, bet);
    return message.reply({ embeds: [embed], components: [row] });
  },
  async handleComponent(interaction, cid) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const balance = db.getUser(userId, guildId)?.balance || 0;

    if (cid.startsWith('go_replay_')) {
      const parts = cid.split('_');
      const bet = parseInt(parts[parts.length - 1]);
      if (balance < bet) {
        return interaction.reply({ content: '💸 Solde insuffisant!', ephemeral: true });
      }

      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});

      db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gates-olympus' });
      const { embed, totalWin } = await playGatesOlympus(interaction, bet);
      if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gates-olympus' });

      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

      const row = makeGameRow('go', userId, bet);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (cid.startsWith('go_changemise_')) {
      const modal = changeMiseModal('go', userId);
      return interaction.showModal(modal);
    }

    if (cid.startsWith('go_modal_')) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const rawMise = interaction.fields.getTextInputValue('newmise');
      const parsedMise = parseMise(rawMise, balance);

      if (!parsedMise || parsedMise < 10) {
        return interaction.editReply({ content: '❌ Mise invalide (min 10€)' });
      }

      if (balance < parsedMise) {
        return interaction.editReply({ content: '💸 Solde insuffisant!' });
      }

      db.removeCoins(userId, guildId, parsedMise, { type: 'game_bet', note: 'gates-olympus' });
      const { embed, totalWin } = await playGatesOlympus(interaction, parsedMise);
      if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gates-olympus' });

      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

      const row = makeGameRow('go', userId, parsedMise);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return false;
  }
};
