const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const REWARD_WIN = 150;
const REWARD_DRAW = 50;
const activeMorpions = new Map();

function renderBoard(board) {
  const symbols = { '': '⬜', 'X': '❌', 'O': '⭕' };
  return board.map(cell => symbols[cell] || '⬜').join('');
}

function checkWin(board) {
  const lines = [
    [0,1,2],[3,4,5],[6,7,8], // lignes
    [0,3,6],[1,4,7],[2,5,8], // colonnes
    [0,4,8],[2,4,6],          // diagonales
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(c => c !== '')) return 'draw';
  return null;
}

function buildGrid(game) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const rowBuilder = new ActionRowBuilder();
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cell = game.board[idx];
      rowBuilder.addComponents(
        new ButtonBuilder()
          .setCustomId(`morpion_${game.id}_${idx}`)
          .setLabel(cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '·')
          .setStyle(cell ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(!!cell)
      );
    }
    rows.push(rowBuilder);
  }
  return rows;
}


// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts) {
  opts = opts || {};
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('morpion')
    .setDescription('⬜ Jeu de morpion — Défiez un autre membre !')
    .addSubcommand(s => s.setName('defier').setDescription('⚔️ Défier quelqu\'un au morpion')
      .addUserOption(o => o.setName('adversaire').setDescription('Membre à défier').setRequired(true))),

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'defier') {
      const opponent = interaction.options.getUser('adversaire');
      if (opponent.id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas vous défier vous-même.', ephemeral: true });
      if (opponent.bot) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas défier un bot.', ephemeral: true });

      const gameId = `${guildId}_${userId}_${Date.now()}`;
      const game = {
        id: gameId,
        guildId,
        playerX: userId,
        playerO: opponent.id,
        board: Array(9).fill(''),
        currentTurn: userId,
        started: false,
        time: Date.now(),
      };

      // Demander confirmation à l'adversaire
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('⬜ Défi Morpion !')
        .setDescription(`<@${userId}> vous défie au **Morpion** ! Acceptez-vous ?`)
        .addFields({ name: '💰 Mise', value: `${REWARD_WIN} ${coin} pour le gagnant`, inline: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`morpion_accept_${gameId}`).setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`morpion_decline_${gameId}`).setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
      );

      activeMorpions.set(gameId, game);
      setTimeout(() => activeMorpions.delete(gameId), 60000);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `<@${opponent.id}>`, embeds: [embed], components: [row] });
    }
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
  }},

  async handleComponent(interaction) {
    const db = require('../../database/db');
    const cfg = db.getConfig(interaction.guildId);
    const coin = cfg.currency_emoji || '🪙';
    const parts = interaction.customId.split('_');

    // Accept/Decline
    if (parts[1] === 'accept' || parts[1] === 'decline') {
      const gameId = parts.slice(2).join('_');
      const game = activeMorpions.get(gameId);
      if (!game) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce défi a expiré.', ephemeral: true });
      if (interaction.user.id !== game.playerO) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce n\'est pas votre défi.', ephemeral: true });

      if (parts[1] === 'decline') {
        activeMorpions.delete(gameId);
        return interaction.update({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Défi refusé').setDescription(`<@${game.playerO}> a refusé le défi.`)], components: [] });
      }

      game.started = true;
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('⬜ Morpion')
        .setDescription(`❌ <@${game.playerX}> vs ⭕ <@${game.playerO}>`)
        .addFields({ name: '🎮 Tour de', value: `❌ <@${game.currentTurn}>`, inline: true });

      return interaction.update({ embeds: [embed], components: buildGrid(game) });
    }

    // Coup de jeu
    const gameId = parts.slice(2, -1).join('_');
    const cellIdx = parseInt(parts[parts.length - 1]);
    const game = activeMorpions.get(gameId);
    if (!game?.started) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Partie introuvable.', ephemeral: true });

    if (interaction.user.id !== game.currentTurn) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce n\'est pas votre tour.', ephemeral: true });
    if (game.board[cellIdx]) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cette case est déjà prise.', ephemeral: true });

    const symbol = game.currentTurn === game.playerX ? 'X' : 'O';
    game.board[cellIdx] = symbol;

    const winner = checkWin(game.board);

    if (winner) {
      activeMorpions.delete(gameId);

      if (winner === 'draw') {
        db.addCoins(game.playerX, game.guildId, REWARD_DRAW);
        db.addCoins(game.playerO, game.guildId, REWARD_DRAW);
        return interaction.update({ embeds: [
          new EmbedBuilder().setColor('#F39C12').setTitle('🤝 Match nul !')
            .setDescription(`❌ <@${game.playerX}> vs ⭕ <@${game.playerO}>\n\nPersonne ne gagne, mais chacun reçoit **${REWARD_DRAW} ${coin}** !`)
        ], components: [] });
      }

      const winnerId = winner === 'X' ? game.playerX : game.playerO;
      const loserId = winner === 'X' ? game.playerO : game.playerX;
      db.addCoins(winnerId, game.guildId, REWARD_WIN);

      return interaction.update({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('🏆 Victoire !')
          .setDescription(`${winner === 'X' ? '❌' : '⭕'} <@${winnerId}> a gagné ! +**${REWARD_WIN} ${coin}** !`)
          .addFields({ name: '📊 Plateau final', value: [
            `${game.board.slice(0,3).map(c => c === 'X' ? '❌' : c === 'O' ? '⭕' : '⬜').join('')}`,
            `${game.board.slice(3,6).map(c => c === 'X' ? '❌' : c === 'O' ? '⭕' : '⬜').join('')}`,
            `${game.board.slice(6,9).map(c => c === 'X' ? '❌' : c === 'O' ? '⭕' : '⬜').join('')}`,
          ].join('\n') })
      ], components: [] });
    }

    game.currentTurn = game.currentTurn === game.playerX ? game.playerO : game.playerX;

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('⬜ Morpion')
      .setDescription(`❌ <@${game.playerX}> vs ⭕ <@${game.playerO}>`)
      .addFields({ name: '🎮 Tour de', value: `${game.currentTurn === game.playerX ? '❌' : '⭕'} <@${game.currentTurn}>`, inline: true });

    return interaction.update({ embeds: [embed], components: buildGrid(game) });
  },

  name: 'morpion',
  aliases: ['tictactoe', 'xo'],
  async run(message, args) {
    const opponent = message.mentions.users.first() || null;
    const fake = mkFake(message, {
      getSubcommand: () => 'defier',
      getUser: (k) => k === 'adversaire' ? opponent : null,
    });
    await this.execute(fake);
  },

};

module.exports.activeMorpions = activeMorpions;
