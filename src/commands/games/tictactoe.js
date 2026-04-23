const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const games = new Map(); // channelId -> game

function makeBoard() { return Array(9).fill(null); }

function checkWin(b, p) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return wins.some(([a,b_,c]) => b[a]===p && b[b_]===p && b[c]===p);
}

function buildComponents(board, disabled = false) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = board[i];
      row.addComponents(new ButtonBuilder()
        .setCustomId(`ttt_${i}`)
        .setLabel(cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '　')
        .setStyle(cell ? (cell === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary)
        .setDisabled(disabled || !!cell));
    }
    rows.push(row);
  }
  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('❌⭕ Jouer au Morpion contre un membre ou le bot')
    .addUserOption(o => o.setName('adversaire').setDescription('Membre à défier (laisser vide = bot)').setRequired(false)),

  async execute(interaction) {
    const opponent = interaction.options.getUser('adversaire');
    if (opponent?.id === interaction.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas jouer contre toi-même.', ephemeral: true });
    if (opponent?.bot && opponent.id !== interaction.client.user.id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu ne peux pas défier un bot.', ephemeral: true });

    const isVsBot = !opponent;
    const p1 = interaction.user;
    const p2 = isVsBot ? interaction.client.user : opponent;

    const board = makeBoard();
    const game = { board, players: [p1.id, p2.id], turn: 0, p1, p2, vsBot: isVsBot, active: true };
    games.set(interaction.channelId, game);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('❌⭕ Morpion / Tic-Tac-Toe')
      .setDescription(`**❌ ${p1.username}** vs **⭕ ${p2.username}**\n\nC'est le tour de **${p1.username}** (❌)`);

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: buildComponents(board), fetchReply: true });

    // Collecteur de boutons
    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
      const g = games.get(i.channelId);
      if (!g || !g.active) return i.deferUpdate();
      const currentPlayer = g.players[g.turn % 2];
      if (i.user.id !== currentPlayer) return i.reply({ content: '❌ Ce n\'est pas ton tour !', ephemeral: true });

      const idx = parseInt(i.customId.split('_')[1]);
      const symbol = g.turn % 2 === 0 ? 'X' : 'O';
      g.board[idx] = symbol;
      g.turn++;

      if (checkWin(g.board, symbol)) {
        g.active = false;
        games.delete(i.channelId);
        const winner = symbol === 'X' ? g.p1 : g.p2;
        const embed = new EmbedBuilder().setColor('Green')
          .setTitle('🏆 Partie terminée !')
          .setDescription(`**${winner.username}** remporte la partie ! 🎉`);
        return i.update({ embeds: [embed], components: buildComponents(g.board, true) });
      }

      if (g.board.every(c => c !== null)) {
        g.active = false;
        games.delete(i.channelId);
        const embed = new EmbedBuilder().setColor('Yellow')
          .setTitle('🤝 Match nul !').setDescription('Bien joué à tous les deux !');
        return i.update({ embeds: [embed], components: buildComponents(g.board, true) });
      }

      const nextPlayer = g.players[g.turn % 2];
      const nextUser = g.turn % 2 === 0 ? g.p1 : g.p2;
      const nextSymbol = g.turn % 2 === 0 ? '❌' : '⭕';

      // Bot joue automatiquement
      if (g.vsBot && nextPlayer === i.client.user.id) {
        const available = g.board.map((c, i2) => c === null ? i2 : null).filter(x => x !== null);
        const botIdx = available[Math.floor(Math.random() * available.length)];
        g.board[botIdx] = 'O';
        g.turn++;

        if (checkWin(g.board, 'O')) {
          g.active = false;
          games.delete(i.channelId);
          const embed = new EmbedBuilder().setColor('Red').setTitle('💻 Le bot gagne !').setDescription('Meilleure chance la prochaine fois !');
          return i.update({ embeds: [embed], components: buildComponents(g.board, true) });
        }
        if (g.board.every(c => c !== null)) {
          g.active = false;
          games.delete(i.channelId);
          const embed = new EmbedBuilder().setColor('Yellow').setTitle('🤝 Match nul !').setDescription('Bien joué !');
          return i.update({ embeds: [embed], components: buildComponents(g.board, true) });
        }

        const embed = new EmbedBuilder().setColor('#7B2FBE').setTitle('❌⭕ Morpion')
          .setDescription(`**❌ ${g.p1.username}** vs **⭕ Bot**\n\nC'est ton tour (❌) !`);
        return i.update({ embeds: [embed], components: buildComponents(g.board) });
      }

      const embed = new EmbedBuilder().setColor('#7B2FBE').setTitle('❌⭕ Morpion')
        .setDescription(`**❌ ${g.p1.username}** vs **⭕ ${g.p2.username}**\n\nC'est le tour de **${nextUser.username}** (${nextSymbol})`);
      return i.update({ embeds: [embed], components: buildComponents(g.board) });
    });

    collector.on('end', () => {
      const g = games.get(interaction.channelId);
      if (g?.active) { g.active = false; games.delete(interaction.channelId); }
    });
  }
};
