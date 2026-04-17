const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play a game of blackjack with a bet')
    .addIntegerOption(option =>
      option
        .setName('mise')
        .setDescription('Amount to bet (10-10000 coins)')
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(10000)
    ),

  cooldown: 3,

  execute: async (interaction) => {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const bet = interaction.options.getInteger('mise');

    // Check user balance
    const userRow = db.db.prepare('SELECT balance FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (!userRow) {
      return interaction.reply({ content: '❌ You need to have an account first. Use `/balance` to create one.', ephemeral: true });
    }

    if (userRow.balance < bet) {
      return interaction.reply({ content: `❌ You don't have enough coins. Your balance: ${userRow.balance} coins`, ephemeral: true });
    }

    // Deduct bet from balance immediately
    db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(bet, userId, guildId);

    // Initialize game state
    const game = {
      playerHand: [],
      dealerHand: [],
      playerValue: 0,
      dealerValue: 0,
      gameOver: false,
      playerStand: false,
    };

    // Deal initial cards
    game.playerHand.push(drawCard());
    game.playerHand.push(drawCard());
    game.dealerHand.push(drawCard());
    game.dealerHand.push(drawCard());

    updateHandValues(game);

    // Check for blackjack
    if (game.playerValue === 21 && game.playerHand.length === 2) {
      const winnings = Math.floor(bet * 2.5); // 1.5x on original bet = 2.5x total (bet + winnings)
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);

      const embed = createGameEmbed(game, `🎉 BLACKJACK! You win **${winnings}** coins!`, true);
      return interaction.reply({ embeds: [embed] });
    }

    // Create buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hit')
        .setLabel('Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('stand')
        .setLabel('Stand')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('double')
        .setLabel('Double Down')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = createGameEmbed(game, 'Your turn!', false);
    const response = await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });

    // Collector for button interactions
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      filter: i => i.user.id === userId,
    });

    let doubleBet = false;

    collector.on('collect', async (i) => {
      if (game.gameOver) {
        await i.reply({ content: 'Game is already over!', ephemeral: true });
        return;
      }

      if (i.customId === 'hit') {
        game.playerHand.push(drawCard());
        updateHandValues(game);

        if (game.playerValue > 21) {
          game.gameOver = true;
          db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(0, userId, guildId); // Already deducted
          const embed = createGameEmbed(game, `💥 BUST! You went over 21. You lose **${bet}** coins.`, true);
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          const embed = createGameEmbed(game, 'Your turn!', false);
          await i.update({ embeds: [embed] });
        }
      } else if (i.customId === 'stand') {
        game.playerStand = true;
        // Dealer's turn
        while (game.dealerValue < 17) {
          game.dealerHand.push(drawCard());
          updateHandValues(game);
        }

        game.gameOver = true;
        const result = determineWinner(game);
        let winnings = 0;

        if (result === 'player-win') {
          winnings = bet * 2;
          db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
          const embed = createGameEmbed(game, `🎉 You win! +**${winnings}** coins!`, true, true);
          await i.update({ embeds: [embed], components: [] });
        } else if (result === 'dealer-win') {
          const embed = createGameEmbed(game, `💥 Dealer wins. You lose **${bet}** coins.`, true, true);
          await i.update({ embeds: [embed], components: [] });
        } else {
          winnings = bet; // Return original bet on push
          db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
          const embed = createGameEmbed(game, `🤝 Push! Your bet of **${bet}** coins is returned.`, true, true);
          await i.update({ embeds: [embed], components: [] });
        }

        collector.stop();
      } else if (i.customId === 'double') {
        // Check if user has enough coins for double down (original bet already deducted)
        const updatedUser = db.db.prepare('SELECT balance FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
        if (updatedUser.balance < bet) {
          await i.reply({ content: `❌ You don't have enough coins to double down!`, ephemeral: true });
          return;
        }

        doubleBet = true;
        db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(bet, userId, guildId);

        game.playerHand.push(drawCard());
        updateHandValues(game);

        if (game.playerValue > 21) {
          game.gameOver = true;
          const doubleLoss = bet * 2;
          const embed = createGameEmbed(game, `💥 BUST on double down! You lose **${doubleLoss}** coins.`, true);
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          game.playerStand = true;
          // Dealer's turn
          while (game.dealerValue < 17) {
            game.dealerHand.push(drawCard());
            updateHandValues(game);
          }

          game.gameOver = true;
          const result = determineWinner(game);
          let winnings = 0;
          const totalBet = bet * 2;

          if (result === 'player-win') {
            winnings = totalBet * 2;
            db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
            const embed = createGameEmbed(game, `🎉 Double down wins! +**${winnings}** coins!`, true, true);
            await i.update({ embeds: [embed], components: [] });
          } else if (result === 'dealer-win') {
            const embed = createGameEmbed(game, `💥 Dealer wins. You lose **${totalBet}** coins.`, true, true);
            await i.update({ embeds: [embed], components: [] });
          } else {
            winnings = totalBet;
            db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
            const embed = createGameEmbed(game, `🤝 Push on double down! Your **${totalBet}** coins are returned.`, true, true);
            await i.update({ embeds: [embed], components: [] });
          }

          collector.stop();
        }
      }
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time') {
        response.edit({ components: [] }).catch(() => {});
      }
    });
  },
};

// Helper functions
function drawCard() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  return { suit, rank };
}

function getCardValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function updateHandValues(game) {
  game.playerValue = calculateHandValue(game.playerHand);
  game.dealerValue = calculateHandValue(game.dealerHand);
}

function calculateHandValue(hand) {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === 'A') aces++;
    value += getCardValue(card);
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function formatHand(hand, hideDealer = false) {
  if (hideDealer && hand.length > 0) {
    return `${hand[0].rank}${hand[0].suit} 🂠`;
  }

  return hand.map(card => `${card.rank}${card.suit}`).join(' ');
}

function determineWinner(game) {
  const playerValue = game.playerValue;
  const dealerValue = game.dealerValue;

  if (dealerValue > 21) return 'player-win';
  if (playerValue > dealerValue) return 'player-win';
  if (dealerValue > playerValue) return 'dealer-win';
  return 'push';
}

function createGameEmbed(game, status, gameEnd = false, showDealer = false) {
  const embed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('♠♥ Blackjack ♦♣')
    .addFields(
      {
        name: "🎰 Dealer's Hand",
        value: `${gameEnd || game.playerStand ? formatHand(game.dealerHand) : formatHand(game.dealerHand, true)}\n**Total:** ${gameEnd || game.playerStand ? game.dealerValue : '?'}`,
        inline: false,
      },
      {
        name: "🎯 Your Hand",
        value: `${formatHand(game.playerHand)}\n**Total:** ${game.playerValue}`,
        inline: false,
      },
      {
        name: '📊 Status',
        value: status,
        inline: false,
      }
    )
    .setFooter({ text: 'Good luck!' })
    .setTimestamp();

  return embed;
}
