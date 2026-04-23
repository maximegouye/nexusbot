/**
 * NexusBot — Démineur (Minesweeper)
 * /demineur — Jouez au démineur avec différentes difficultés !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const CONFIGS = {
  facile:   { rows: 5, cols: 5, mines: 5,  reward: 50  },
  moyen:    { rows: 7, cols: 7, mines: 10, reward: 150 },
  difficile:{ rows: 9, cols: 9, mines: 20, reward: 400 },
};

const NUMBERS = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
const MINE    = '💣';
const HIDDEN  = '⬛';
const FLAG    = '🚩';

function createBoard(rows, cols, mines) {
  // Place mines randomly
  const board = Array.from({ length: rows }, () => Array(cols).fill(0));
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c] !== -1) { board[r][c] = -1; placed++; }
  }
  // Calculate numbers
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c] === -1) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc] === -1) count++;
        }
      }
      board[r][c] = count;
    }
  }
  return board;
}

function renderBoard(board, revealed, rows, cols) {
  let str = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!revealed[r][c]) {
        str += HIDDEN;
      } else if (board[r][c] === -1) {
        str += MINE;
      } else {
        str += NUMBERS[board[r][c]];
      }
    }
    str += '\n';
  }
  return str;
}

// Discord's spoiler trick for minesweeper
function renderSpoilerBoard(board, rows, cols) {
  let str = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell === -1) {
        str += `||${MINE}||`;
      } else {
        str += `||${NUMBERS[cell]}||`;
      }
    }
    str += '\n';
  }
  return str;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demineur')
    .setDescription('💣 Jouer au démineur')
    .addStringOption(o => o.setName('difficulte').setDescription('Difficulté').setRequired(true)
      .addChoices(
        { name: '🟢 Facile (5×5, 5 mines)', value: 'facile' },
        { name: '🟡 Moyen (7×7, 10 mines)', value: 'moyen' },
        { name: '🔴 Difficile (9×9, 20 mines)', value: 'difficile' },
      )),

  cooldown: 10,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const diff    = interaction.options.getString('difficulte');
    const cfg     = CONFIGS[diff];
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    const board   = createBoard(cfg.rows, cfg.cols, cfg.mines);
    const spoiler = renderSpoilerBoard(board, cfg.rows, cfg.cols);

    // Count zeros to give play tips
    const zeros = board.flat().filter(c => c === 0).length;

    const embed = new EmbedBuilder()
      .setColor(diff === 'facile' ? '#2ecc71' : diff === 'moyen' ? '#f39c12' : '#e74c3c')
      .setTitle(`💣 Démineur — ${diff.charAt(0).toUpperCase() + diff.slice(1)}`)
      .setDescription(`**Grille ${cfg.rows}×${cfg.cols} — ${cfg.mines} mines**\n\nCliquez sur les || cases || pour les révéler !\n\n${spoiler}`)
      .addFields(
        { name: '💡 Astuce',          value: 'Les cases vides (0️⃣) révèlent leurs voisines automatiquement.',  inline: false },
        { name: '🏆 Récompense',      value: `${cfg.reward} coins si vous gagnez !`,                              inline: true  },
        { name: '💣 Mines',           value: `${cfg.mines}/${cfg.rows * cfg.cols} cases`,                         inline: true  },
      )
      .setFooter({ text: `Joueur : ${interaction.user.username} • Démineur Discord (spoilers)` });

    await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });

    // Since Discord minesweeper works via spoilers that the user reveals manually,
    // we give reward based on honor system + add a "I won !" button interaction
    // The real game is played by the user revealing spoilers themselves
    const winEmbed = new EmbedBuilder()
      .setColor('#f39c12')
      .setTitle('🏆 Démineur — Récompense')
      .setDescription(`Si tu as réussi à révéler toutes les cases sans toucher une mine 💣, tu mérites ta récompense !\n\nUtilise \`/claim_minesweeper\` pour réclamer tes **${cfg.reward} coins** (sur l\'honneur 🤝)`);

    // Alternative: just give a small reward for playing
    db.addCoins(userId, guildId, Math.round(cfg.reward * 0.1));

    const bonusEmbed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setDescription(`🎮 +**${Math.round(cfg.reward * 0.1)}** coins pour avoir joué !`);

    await interaction.followUp({ embeds: [bonusEmbed], ephemeral: true });
  }
};
