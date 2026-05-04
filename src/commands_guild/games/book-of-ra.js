const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SYMBOLS = {
  '📖': { name: 'Livre', value: 250, isScatter: true, isWild: true },
  '🏺': { name: 'Pharaon', value: 150 },
  '🦅': { name: 'Horus', value: 100 },
  '🐍': { name: 'Serpent', value: 75 },
  '🪲': { name: 'Scarabée', value: 50 },
  '💰': { name: 'Or', value: 30 },
  '🗝️': { name: 'Ankh', value: 20 },
  '⭐': { name: 'Étoile', value: 15 },
  '🃏': { name: 'Carte', value: 10 }
};

const REGULAR_SYMBOLS = ['🏺', '🦅', '🐍', '🪲', '💰', '🗝️', '⭐', '🃏'];
const ALL_SYMBOLS = ['📖', '🏺', '🦅', '🐍', '🪲', '💰', '🗝️', '⭐', '🃏'];

const PAYLINES = [
  [0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 1, 1],
  [2, 2, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1]
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

function checkPayline(grid, payline, expandingSymbol, expandedReels) {
  let matches = 0;
  let expandingCount = 0;

  for (let i = 0; i < payline.length; i++) {
    const symbol = grid[payline[i]][i];
    const isExpanded = expandedReels.includes(i);

    if (symbol === '📖' || (isExpanded && symbol === expandingSymbol)) {
      matches++;
    } else if (symbol === expandingSymbol) {
      expandingCount++;
    } else {
      break;
    }
  }

  return matches >= 3 ? matches : 0;
}

function calculateWin(grid, baseMise, expandingSymbol = null, expandedReels = []) {
  let totalWin = 0;

  PAYLINES.forEach(payline => {
    const matches = checkPayline(grid, payline, expandingSymbol, expandedReels);
    if (matches >= 3) {
      const symbolValue = SYMBOLS[grid[payline[0]][0]].value || SYMBOLS[expandingSymbol]?.value || 0;
      totalWin += symbolValue * matches * baseMise;
    }
  });

  return Math.floor(totalWin);
}

async function playFreeSpins(mise, freeSpins) {
  const expandingSymbol = REGULAR_SYMBOLS[Math.floor(Math.random() * REGULAR_SYMBOLS.length)];
  let totalWin = 0;

  for (let spin = 0; spin < freeSpins; spin++) {
    const grid = generateGrid(5, 3);
    const expandedReels = [];

    for (let reel = 0; reel < 5; reel++) {
      if (Math.random() < 0.3) {
        expandedReels.push(reel);
      }
    }

    const spinWin = calculateWin(grid, mise, expandingSymbol, expandedReels);
    totalWin += spinWin;
  }

  return { totalWin: Math.floor(totalWin), expandingSymbol };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('book-of-ra')
    .setDescription('📖 Book of Ra — Égypte antique, symboles expandants, 10 Free Spins')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser (minimum 10€)').setRequired(true).setMinValue(10)),
  name: 'book-of-ra',
  aliases: ['bor', 'ra'],

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

    db.removeCoins(userId, guildId, mise, { type: 'game_bet', note: 'book-of-ra' });

    let scatterCount = 0;
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col] === '📖') scatterCount++;
      }
    }

    let totalWin = calculateWin(grid, mise);
    let freeSpins = 0;
    let expandingSymbol = null;

    if (scatterCount >= 3) {
      freeSpins = 10;
      const fsResult = await playFreeSpins(mise, freeSpins);
      totalWin += fsResult.totalWin;
      expandingSymbol = fsResult.expandingSymbol;
    }

    if (totalWin > 0) db.addCoins(userId, guildId, totalWin, { type: 'game_win', note: 'book-of-ra' });
    const newBalance = db.getUser(userId, guildId)?.balance || 0;

    const resultColor = totalWin > 0 ? '#FFD700' : '#8B4513';
    const resultEmbed = new EmbedBuilder()
      .setColor(resultColor)
      .setTitle('📖 Book of Ra - Résultat')
      .setDescription(gridDisplay)
      .addFields(
        { name: 'Mise', value: `${mise}€`, inline: true },
        { name: 'Gain', value: `${totalWin}€`, inline: true },
        { name: 'Livres 📖', value: `${scatterCount}`, inline: true },
        freeSpins > 0 ? { name: '🎁 Free Spins', value: `${freeSpins} (${expandingSymbol} expand)`, inline: true } : { name: '​', value: '​', inline: true },
        { name: 'Nouveau solde', value: `${newBalance}€`, inline: true }
      );

    const row = makeGameRow('bor', userId, mise);
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

    if (cid.startsWith('bor_replay_')) {
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

    if (cid.startsWith('bor_changemise_')) {
      const modal = changeMiseModal('bor', userId);
      await interaction.showModal(modal);
      return true;
    }

    if (cid.startsWith('bor_modal_')) {
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
