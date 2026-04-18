const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Jouer au Blackjack avec une mise')
    .addIntegerOption(option =>
      option
        .setName('mise')
        .setDescription('Montant à parier (10-50000 pièces)')
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(50000)
    ),

  cooldown: 3,

  execute: async (interaction) => {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const bet = interaction.options.getInteger('mise');
    const cfg = db.getConfig(guildId);
    const coin = cfg?.currency_emoji || '💰';

    // Vérifier le compte utilisateur
    const userRow = db.db.prepare('SELECT balance FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (!userRow) {
      return interaction.reply({
        content: '❌ Vous devez créer un compte d\'abord. Utilisez `/balance` pour créer un compte.',
        ephemeral: true
      });
    }

    if (userRow.balance < bet) {
      return interaction.reply({
        content: `❌ Vous n'avez pas assez de pièces. Votre solde: ${userRow.balance} ${coin}`,
        ephemeral: true
      });
    }

    // Déduire la mise immédiatement
    db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(bet, userId, guildId);

    // Initialiser l'état du jeu
    const game = {
      playerHand: [],
      dealerHand: [],
      playerValue: 0,
      dealerValue: 0,
      gameOver: false,
      playerStand: false,
    };

    // Distribuer les cartes initiales
    game.playerHand.push(drawCard());
    game.playerHand.push(drawCard());
    game.dealerHand.push(drawCard());
    game.dealerHand.push(drawCard());

    updateHandValues(game);

    // Vérifier le blackjack naturel
    if (game.playerValue === 21 && game.playerHand.length === 2) {
      const winnings = Math.floor(bet * 2.5);
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);

      const embed = createGameEmbed(game, `🎉 BLACKJACK ! Vous gagnez **${winnings}** ${coin} !`, true);
      return interaction.reply({ embeds: [embed] });
    }

    // Créer les boutons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hit')
        .setLabel('🎴 Tirer')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('stand')
        .setLabel('🛑 Rester')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('double')
        .setLabel('✖️ Doubler')
        .setStyle(ButtonStyle.Danger)
    );

    const embed = createGameEmbed(game, 'À votre tour !', false);
    const response = await interaction.reply({ embeds: [embed], components: [buttons], fetchReply: true });

    // Collecteur pour les interactions de bouton
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      filter: i => i.user.id === userId,
    });

    let doubleBet = false;

    collector.on('collect', async (i) => {
      if (game.gameOver) {
        await i.reply({ content: '❌ Le jeu est déjà terminé !', ephemeral: true });
        return;
      }

      if (i.customId === 'hit') {
        game.playerHand.push(drawCard());
        updateHandValues(game);

        if (game.playerValue > 21) {
          game.gameOver = true;
          const embed = createGameEmbed(game, `💥 BUST ! Vous avez dépassé 21. Vous perdez **${bet}** ${coin}.`, true);
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          const embed = createGameEmbed(game, 'À votre tour !', false);
          await i.update({ embeds: [embed] });
        }
      } else if (i.customId === 'stand') {
        game.playerStand = true;
        // Tour du croupier
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
          const embed = createGameEmbed(game, `🎉 Vous gagnez ! +**${winnings}** ${coin} !`, true, true);
          await i.update({ embeds: [embed], components: [] });
        } else if (result === 'dealer-win') {
          const embed = createGameEmbed(game, `💥 Le croupier gagne. Vous perdez **${bet}** ${coin}.`, true, true);
          await i.update({ embeds: [embed], components: [] });
        } else {
          winnings = bet;
          db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
          const embed = createGameEmbed(game, `🤝 Égalité ! Votre mise de **${bet}** ${coin} est restituée.`, true, true);
          await i.update({ embeds: [embed], components: [] });
        }

        collector.stop();
      } else if (i.customId === 'double') {
        // Vérifier si l'utilisateur a assez de pièces pour doubler
        const updatedUser = db.db.prepare('SELECT balance FROM users WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
        if (updatedUser.balance < bet) {
          await i.reply({ content: `❌ Vous n'avez pas assez de pièces pour doubler !`, ephemeral: true });
          return;
        }

        doubleBet = true;
        db.db.prepare('UPDATE users SET balance = balance - ? WHERE user_id = ? AND guild_id = ?').run(bet, userId, guildId);

        game.playerHand.push(drawCard());
        updateHandValues(game);

        if (game.playerValue > 21) {
          game.gameOver = true;
          const doubleLoss = bet * 2;
          const embed = createGameEmbed(game, `💥 BUST au doublement ! Vous perdez **${doubleLoss}** ${coin}.`, true);
          await i.update({ embeds: [embed], components: [] });
          collector.stop();
        } else {
          game.playerStand = true;
          // Tour du croupier
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
            const embed = createGameEmbed(game, `🎉 Doublement gagnant ! +**${winnings}** ${coin} !`, true, true);
            await i.update({ embeds: [embed], components: [] });
          } else if (result === 'dealer-win') {
            const embed = createGameEmbed(game, `💥 Le croupier gagne. Vous perdez **${totalBet}** ${coin}.`, true, true);
            await i.update({ embeds: [embed], components: [] });
          } else {
            winnings = totalBet;
            db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(winnings, userId, guildId);
            const embed = createGameEmbed(game, `🤝 Égalité au doublement ! Votre mise de **${totalBet}** ${coin} est restituée.`, true, true);
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

// Fonctions d'aide
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
        name: "🎰 Main du Croupier",
        value: `${gameEnd || game.playerStand ? formatHand(game.dealerHand) : formatHand(game.dealerHand, true)}\n**Valeur :** ${gameEnd || game.playerStand ? game.dealerValue : '?'}`,
        inline: false,
      },
      {
        name: "🎯 Votre Main",
        value: `${formatHand(game.playerHand)}\n**Valeur :** ${game.playerValue}`,
        inline: false,
      },
      {
        name: '📊 Statut',
        value: status,
        inline: false,
      }
    )
    .setFooter({ text: 'Bonne chance !' })
    .setTimestamp();

  return embed;
}
