const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ROWS = 6, COLS = 7;
const EMPTY = '⬛', P1 = '🔴', P2 = '🟡';
const games = new Map();

function makeGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY)); }

function dropPiece(grid, col, piece) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r][col] === EMPTY) { grid[r][col] = piece; return r; }
  }
  return -1; // colonne pleine
}

function checkWin(grid, piece) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== piece) continue;
      // horizontal
      if (c+3 < COLS && [1,2,3].every(i => grid[r][c+i]===piece)) return true;
      // vertical
      if (r+3 < ROWS && [1,2,3].every(i => grid[r+i][c]===piece)) return true;
      // diag
      if (r+3 < ROWS && c+3 < COLS && [1,2,3].every(i => grid[r+i][c+i]===piece)) return true;
      if (r+3 < ROWS && c-3 >= 0 && [1,2,3].every(i => grid[r+i][c-i]===piece)) return true;
    }
  }
  return false;
}

function renderGrid(grid) {
  return grid.map(row => row.join('')).join('\n') + '\n' +
    Array.from({length: COLS}, (_, i) => `${i+1}️⃣`).join('');
}

function buildButtons(game, disabled = false) {
  const rows = [];
  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const row = new ActionRowBuilder();
    for (let col = rowIdx * 4; col < Math.min((rowIdx + 1) * 4, COLS); col++) {
      const full = game.grid[0][col] !== EMPTY;
      row.addComponents(new ButtonBuilder()
        .setCustomId(`c4_${col}`)
        .setLabel(`${col + 1}`)
        .setStyle(full ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(disabled || full));
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('connect4')
    .setDescription('🔴🟡 Jouer à Puissance 4 contre un adversaire')
    .addUserOption(o => o.setName('adversaire').setDescription('Membre à défier (vide = bot)').setRequired(false)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const opponent = interaction.options.getUser('adversaire');
    if (opponent?.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas jouer contre toi-même.', ephemeral: true });

    const p1 = interaction.user;
    const p2 = opponent && !opponent.bot ? opponent : interaction.client.user;
    const vsBot = !opponent || opponent.bot;

    const game = { grid: makeGrid(), turn: 0, p1, p2, vsBot, active: true };
    games.set(interaction.channelId, game);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('🔴🟡 Puissance 4')
      .setDescription(`${P1} **${p1.username}** vs ${P2} **${p2.username}**\n\nC'est le tour de ${P1} **${p1.username}**\n\n${renderGrid(game.grid)}`);

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: buildButtons(game), fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async i => {
      const g = games.get(i.channelId);
      if (!g?.active) return i.deferUpdate();

      const currentPlayer = g.players?.[g.turn % 2] || (g.turn % 2 === 0 ? g.p1.id : g.p2.id);
      const expectedId = g.turn % 2 === 0 ? g.p1.id : g.p2.id;
      if (i.user.id !== expectedId) return i.reply({ content: '❌ Ce n\'est pas ton tour !', ephemeral: true });

      const col = parseInt(i.customId.split('_')[1]);
      const piece = g.turn % 2 === 0 ? P1 : P2;
      const row = dropPiece(g.grid, col, piece);
      if (row === -1) return i.reply({ content: '❌ Cette colonne est pleine.', ephemeral: true });
      g.turn++;

      if (checkWin(g.grid, piece)) {
        g.active = false;
        games.delete(i.channelId);
        const winner = piece === P1 ? g.p1 : g.p2;
        return i.update({ embeds: [new EmbedBuilder().setColor('Green').setTitle('🏆 Puissance 4 — Victoire !')
          .setDescription(`${piece} **${winner.username}** remporte la partie !\n\n${renderGrid(g.grid)}`)], components: buildButtons(g, true) });
      }

      if (g.grid[0].every(c => c !== EMPTY)) {
        g.active = false;
        games.delete(i.channelId);
        return i.update({ embeds: [new EmbedBuilder().setColor('Yellow').setTitle('🤝 Match nul !')
          .setDescription(`\n\n${renderGrid(g.grid)}`)], components: buildButtons(g, true) });
      }

      const nextPiece = g.turn % 2 === 0 ? P1 : P2;
      const nextUser = g.turn % 2 === 0 ? g.p1 : g.p2;

      // Bot joue
      if (g.vsBot && nextUser.id === i.client.user.id) {
        // Simple AI: essaie de gagner, sinon bloque, sinon random
        let botCol = -1;
        // Chercher une victoire en 1 coup
        for (let c = 0; c < COLS && botCol === -1; c++) {
          const tmp = g.grid.map(r => [...r]);
          if (dropPiece(tmp, c, P2) >= 0 && checkWin(tmp, P2)) botCol = c;
        }
        // Bloquer joueur
        if (botCol === -1) {
          for (let c = 0; c < COLS && botCol === -1; c++) {
            const tmp = g.grid.map(r => [...r]);
            if (dropPiece(tmp, c, P1) >= 0 && checkWin(tmp, P1)) botCol = c;
          }
        }
        // Random
        if (botCol === -1) {
          const avail = Array.from({length: COLS}, (_,c) => c).filter(c => g.grid[0][c] === EMPTY);
          botCol = avail[Math.floor(Math.random() * avail.length)];
        }
        dropPiece(g.grid, botCol, P2);
        g.turn++;

        if (checkWin(g.grid, P2)) {
          g.active = false;
          games.delete(i.channelId);
          return i.update({ embeds: [new EmbedBuilder().setColor('Red').setTitle('💻 Le bot gagne !')
            .setDescription(`${P2} Le bot a gagné !\n\n${renderGrid(g.grid)}`)], components: buildButtons(g, true) });
        }
        if (g.grid[0].every(c => c !== EMPTY)) {
          g.active = false;
          games.delete(i.channelId);
          return i.update({ embeds: [new EmbedBuilder().setColor('Yellow').setTitle('🤝 Match nul !')
            .setDescription(renderGrid(g.grid))], components: buildButtons(g, true) });
        }
      }

      const nowUser = g.turn % 2 === 0 ? g.p1 : g.p2;
      const nowPiece = g.turn % 2 === 0 ? P1 : P2;
      return i.update({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('🔴🟡 Puissance 4')
        .setDescription(`${P1} **${g.p1.username}** vs ${P2} **${g.p2.username}**\n\nTour: ${nowPiece} **${nowUser.username}**\n\n${renderGrid(g.grid)}`)],
        components: buildButtons(g) });
    });

    collector.on('end', () => { const g = games.get(interaction.channelId); if (g?.active) { g.active=false; games.delete(interaction.channelId); } });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.editReply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
