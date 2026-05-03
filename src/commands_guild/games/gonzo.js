const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Symboles Aztèques avec valeurs
const SYMBOLS = {
  IDOL: { emoji: '🗿', value: 50 },
  EAGLE: { emoji: '🦅', value: 30 },
  CAIMAN: { emoji: '🐊', value: 20 },
  GEM: { emoji: '💎', value: 15 },
  SPIRAL: { emoji: '🌀', value: 10 },
  MOON: { emoji: '🌕', value: 8 },
  ORB: { emoji: '🔮', value: 5 },
  SCATTER: { emoji: '🌟', value: 0 }
};

const SYMBOL_KEYS = Object.keys(SYMBOLS).filter(k => k !== 'SCATTER');

// Grille 5x3
const COLS = 5;
const ROWS = 3;

// Générer une grille aléatoire
function generateGrid() {
  const grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const rand = Math.random();
      if (rand < 0.15) {
        row.push('SCATTER');
      } else {
        row.push(SYMBOL_KEYS[Math.floor(Math.random() * SYMBOL_KEYS.length)]);
      }
    }
    grid.push(row);
  }
  return grid;
}

// Déterminer si c'est un gain horizontal
function checkPaylines(grid) {
  const wins = [];
  // Paylines horizontales
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 3; c++) {
      const s1 = grid[r][c];
      const s2 = grid[r][c + 1];
      const s3 = grid[r][c + 2];
      if (s1 === s2 && s2 === s3 && s1 !== null) {
        for (let i = c; i < COLS && grid[r][i] === s1; i++) {
          wins.push([r, i]);
        }
      }
    }
  }
  // Diagonales (gauche-droite)
  for (let r = 0; r <= ROWS - 3; r++) {
    for (let c = 0; c <= COLS - 3; c++) {
      const s1 = grid[r][c];
      const s2 = grid[r + 1][c + 1];
      const s3 = grid[r + 2][c + 2];
      if (s1 === s2 && s2 === s3 && s1 !== null) {
        wins.push([r, c], [r + 1, c + 1], [r + 2, c + 2]);
      }
    }
  }
  // Diagonales (droite-gauche)
  for (let r = 0; r <= ROWS - 3; r++) {
    for (let c = 2; c < COLS; c++) {
      const s1 = grid[r][c];
      const s2 = grid[r + 1][c - 1];
      const s3 = grid[r + 2][c - 2];
      if (s1 === s2 && s2 === s3 && s1 !== null) {
        wins.push([r, c], [r + 1, c - 1], [r + 2, c - 2]);
      }
    }
  }
  return [...new Set(wins.map(w => JSON.stringify(w)))].map(w => JSON.parse(w));
}

// Faire tomber les symboles après explosion
function dropSymbols(grid) {
  for (let c = 0; c < COLS; c++) {
    const symbols = [];
    for (let r = 0; r < ROWS; r++) {
      if (grid[r][c] !== null) {
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

// Calculer gain pour les positions gagnantes
function calculateWin(grid, winPositions, multiplier) {
  const symbolCounts = {};
  for (const [r, c] of winPositions) {
    const sym = grid[r][c];
    if (sym && sym !== 'SCATTER') {
      symbolCounts[sym] = (symbolCounts[sym] || 0) + 1;
    }
  }
  let totalWin = 0;
  for (const [sym, count] of Object.entries(symbolCounts)) {
    if (count >= 3) {
      totalWin += SYMBOLS[sym].value * count * multiplier;
    }
  }
  return totalWin;
}

// Afficher la grille
function gridToString(grid) {
  return grid.map(row => row.map(s => SYMBOLS[s]?.emoji || '❓').join(' ')).join('\n');
}

async function playGonzo(interaction, bet) {
  let totalWin = 0;
  let cascades = 0;
  let multiplier = 1;
  let grid = generateGrid();
  const cascadeDetails = [];

  // Boucle avalanche
  for (let cascade = 0; cascade < 5; cascade++) {
    const wins = checkPaylines(grid);
    if (wins.length === 0) break;

    cascades++;
    multiplier = Math.pow(2, cascade); // 1, 2, 4, 8, 16
    const cascadeWin = calculateWin(grid, wins, multiplier);
    totalWin += cascadeWin;
    cascadeDetails.push(`Cascade ${cascade + 1}: +${cascadeWin}€ (×${multiplier})`);

    // Explosion
    for (const [r, c] of wins) {
      grid[r][c] = null;
    }

    // Chute
    dropSymbols(grid);
    await sleep(300);
  }

  // Embed résultat
  const embed = new EmbedBuilder()
    .setColor('#9b59b6')
    .setTitle("🎰 Gonzo's Quest")
    .setDescription(`Mise: ${bet}€`)
    .addFields(
      { name: 'Grille Finale', value: '```\n' + gridToString(grid) + '\n```' },
      { name: 'Cascades', value: cascadeDetails.length > 0 ? cascadeDetails.join('\n') : 'Aucune cascade' },
      { name: 'Gain Total', value: `**${totalWin}€**`, inline: true },
      { name: 'Bénéfice', value: `**${totalWin - bet}€**`, inline: true }
    )
    .setFooter({ text: 'NexusBot Casino' })
    .setTimestamp();

  return { embed, totalWin, grid };
}

module.exports = {
  // Accessible via /casino — pas de slash command séparée pour rester sous la limite des 100
  name: 'gonzo',
  aliases: ['gz'],
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

    db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gonzo' });
    const { embed, totalWin } = await playGonzo(interaction, bet);
    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gonzo' });

    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

    const row = makeGameRow('gz', userId, bet);
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

    db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gonzo' });
    const { embed, totalWin } = await playGonzo(message, bet);
    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gonzo' });

    const newBalance = db.getUser(userId, guildId)?.balance || 0;
    embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

    const row = makeGameRow('gz', userId, bet);
    return message.reply({ embeds: [embed], components: [row] });
  },
  async handleComponent(interaction, cid) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const balance = db.getUser(userId, guildId)?.balance || 0;

    if (cid.startsWith('gz_replay_')) {
      // customId = gz_replay_{userId}_{bet}
      const parts = cid.split('_');
      const bet = parseInt(parts[parts.length - 1]);
      if (balance < bet) {
        return interaction.reply({ content: '💸 Solde insuffisant!', ephemeral: true });
      }

      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});

      db.removeCoins(userId, guildId, bet, { type: 'game_bet', note: 'gonzo' });
      const { embed, totalWin } = await playGonzo(interaction, bet);
      if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gonzo' });

      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

      const row = makeGameRow('gz', userId, bet);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (cid.startsWith('gz_changemise_')) {
      const modal = changeMiseModal('gz', userId);
      return interaction.showModal(modal);
    }

    if (cid.startsWith('gz_modal_')) {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }).catch(() => {});

      const rawMise = interaction.fields.getTextInputValue('newmise');
      const parsedMise = parseMise(rawMise, balance);

      if (!parsedMise || parsedMise < 10) {
        return interaction.editReply({ content: '❌ Mise invalide (min 10€)' });
      }

      if (balance < parsedMise) {
        return interaction.editReply({ content: '💸 Solde insuffisant!' });
      }

      db.removeCoins(userId, guildId, parsedMise, { type: 'game_bet', note: 'gonzo' });
      const { embed, totalWin } = await playGonzo(interaction, parsedMise);
      if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'gonzo' });

      const newBalance = db.getUser(userId, guildId)?.balance || 0;
      embed.addFields({ name: 'Nouveau solde', value: `${newBalance}€` });

      const row = makeGameRow('gz', userId, parsedMise);
      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    return false;
  }
};
