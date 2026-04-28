// ============================================================
// hilo.js — Hi-Lo Card Game
// Emplacement : src/commands_guild/games/hilo.js
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const db = require('../../database/db');
const { C, chipStr, balanceLine, casinoFooter, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

// ─── Game sessions storage (Map with TTL) ───────────────────
const gamesSessions = new Map();

const CARD_VALUES = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const CARD_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_SUITS = ['♠', '♥', '♦', '♣'];
const CARD_EMOJIS = {
  '♠': '🂡', '♥': '🂱', '♦': '🃁', '♣': '🃑',
};

function getRandomCard() {
  const name = CARD_NAMES[Math.floor(Math.random() * CARD_NAMES.length)];
  const suit = CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)];
  return { name, suit, value: CARD_VALUES[name] };
}

function formatCard(card) {
  return `**${card.name}${card.suit}**`;
}

function getProbabilityInfo(cardValue) {
  // Cartes basses (A-6): environ 67% de chances que la suivante soit plus haute
  if (cardValue <= 6) {
    return { emoji: '📈', text: '~67% de chances que la suivante soit plus haute' };
  }
  // Cartes hautes (8-K): environ 67% de chances que la suivante soit plus basse
  if (cardValue >= 8) {
    return { emoji: '📉', text: '~67% de chances que la suivante soit plus basse' };
  }
  // 7: 50/50
  return { emoji: '⚖️', text: '~50/50' };
}

function getGameId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function cleanupSession(userId, gameId) {
  const key = `${userId}:${gameId}`;
  gamesSessions.delete(key);
}

function saveSession(userId, gameId, data) {
  const key = `${userId}:${gameId}`;
  const timeout = setTimeout(() => {
    gamesSessions.delete(key);
  }, 5 * 60 * 1000); // 5 minutes TTL
  gamesSessions.set(key, { ...data, timeout });
}

function getSession(userId, gameId) {
  const key = `${userId}:${gameId}`;
  return gamesSessions.get(key);
}

function buildGameEmbed(session, status = 'playing') {
  const user = db.getUser(session.userId, session.guildId);
  if (!user) return null;

  const coin = (db.getConfig ? db.getConfig(session.guildId) : null)?.currency_emoji || '🪙';
  const embed = new EmbedBuilder()
    .setTitle('🃏 Hi-Lo — Prédis si la prochaine carte sera plus haute ou plus basse !')
    .setColor(status === 'win' ? C.WIN : status === 'loss' ? C.LOSS : status === 'push' ? C.PUSH : C.NEUTRAL);

  // Display current card
  if (session.currentCard) {
    embed.addFields({
      name: '📍 Carte actuelle',
      value: formatCard(session.currentCard),
      inline: false,
    });
  }

  // Display probability
  const probInfo = getProbabilityInfo(session.currentCard.value);
  embed.addFields({
    name: '🎯 Probabilité',
    value: `${probInfo.emoji} ${probInfo.text}`,
    inline: false,
  });

  // Display chain info
  const chainText = session.rounds > 0
    ? `**${session.rounds}** ${session.rounds === 1 ? 'manche' : 'manches'} gagnées\nMultiplicateur : **×${(1.9 ** session.rounds).toFixed(2)}**`
    : 'Aucune manche gagnée encore';

  embed.addFields({
    name: '⛓️ Chaîne',
    value: chainText,
    inline: true,
  });

  embed.addFields({
    name: '💰 Mise initiale',
    value: chipStr(session.initialMise, coin),
    inline: true,
  });

  const currentWinnings = Math.floor(session.initialMise * (1.9 ** session.rounds));
  embed.addFields({
    name: '🎯 Gains actuels',
    value: chipStr(currentWinnings, coin),
    inline: true,
  });

  embed.addFields({
    name: '💳 Votre solde',
    value: chipStr(user.balance, coin),
    inline: true,
  });

  if (status === 'result') {
    const diff = session.resultMessage ? '' : '';
    embed.addFields({
      name: '⏸️ Résultat',
      value: session.resultMessage || 'En attente...',
      inline: false,
    });
  }

  embed.setFooter({ text: casinoFooter('Hi-Lo') });
  return embed;
}

// ───────────────────────────────────────────────────────────
// SlashCommand Definition
// ───────────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('hilo')
  .setDescription('🃏 Hi-Lo — Prédit si la prochaine carte sera plus haute ou plus basse !')
  .addIntegerOption(o =>
    o
      .setName('mise')
      .setDescription('Montant à miser')
      .setRequired(true)
      .setMinValue(1)
  );

async function execute(interaction) {
  try {
    await interaction.deferReply();

    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const mise = interaction.options.getInteger('mise');
    const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

    const user = db.getUser(userId, guildId);
    if (!user) {
      return interaction.editReply({
        content: '❌ Profil non trouvé. Utilise `/daily` d\'abord.',
        ephemeral: true,
      });
    }

    if (mise < 1 || mise > 1000000) {
      return interaction.editReply({
        content: `❌ Mise invalide. Entre 1 et 1 000 000 ${coin}.`,
        ephemeral: true,
      });
    }

    if (user.balance < mise) {
      return interaction.editReply({
        content: `❌ Solde insuffisant.\nTu as **${user.balance} ${coin}** mais tu essaies de miser **${mise} ${coin}**.`,
        ephemeral: true,
      });
    }

    // Deduct the bet from balance
    db.addCoins(userId, guildId, -mise);

    // Initialize game session
    const gameId = getGameId();
    const firstCard = getRandomCard();

    const session = {
      userId,
      guildId,
      gameId,
      initialMise: mise,
      currentCard: firstCard,
      rounds: 0,
      resultMessage: '',
      messageId: null,
    };

    saveSession(userId, gameId, session);

    // Build initial embed
    const embed = buildGameEmbed(session, 'playing');
    embed.setDescription(`La première carte est ${formatCard(firstCard)}.\n\nQuelle sera la prochaine ?`);

    // Button row
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hilo_higher_${userId}_${gameId}`)
        .setLabel('📈 Plus haute')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hilo_lower_${userId}_${gameId}`)
        .setLabel('📉 Plus basse')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hilo_rules_${userId}`)
        .setLabel('📋 Règles')
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    session.messageId = msg.id;
    saveSession(userId, gameId, session);
  } catch (err) {
    console.error('[hilo execute]', err);
    await interaction.editReply({
      content: '❌ Une erreur est survenue. Réessaie plus tard.',
      ephemeral: true,
    }).catch(() => {});
  }
}

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('hilo_')) return false;

  try {
    const parts = customId.split('_');
    const action = parts[1]; // 'higher', 'lower', 'collect', 'changemise', 'modal', 'rules'
    const userId = parts[2];
    const gameId = parts[3] || null;

    // Verify permission
    if (interaction.user.id !== userId) {
      return interaction.reply({
        content: '❌ Ce n\'est pas ton jeu.',
        ephemeral: true,
      });
    }

    const coin = (db.getConfig ? db.getConfig(interaction.guildId) : null)?.currency_emoji || '🪙';

    // ───── Rules button ─────
    if (action === 'rules') {
      await interaction.deferUpdate().catch(() => {});
      const rulesEmbed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('📋 Règles du Hi-Lo')
        .setDescription('Prédit si la prochaine carte sera plus haute ou plus basse que la carte actuelle.')
        .addFields(
          { name: '🎮 Gameplay', value: 'Chaque bonne prédiction gagne et accumule un multiplicateur de ×1.9', inline: false },
          { name: '⛓️ Chaîne de victoires', value: 'Chaque manche gagnée multiplie vos gains par 1.9x', inline: false },
          { name: '💰 Encaisser', value: 'Encaissez vos gains à tout moment après la première victoire', inline: false },
          { name: '❌ Défaite', value: 'Une mauvaise prédiction termine la partie et perd votre mise', inline: false },
          { name: '🔄 Cartes identiques', value: 'Si deux cartes sont identiques, c\'est une victoire bonus!', inline: false },
          { name: '📊 Probabilités', value: 'Les cartes basses (2-6) ont plus de chances d\'être suivies par une carte plus haute (~67%)', inline: false },
        )
        .setFooter({ text: 'Hi-Lo · Maximum 5 manches par partie' });
      return interaction.editReply({ embeds: [rulesEmbed], ephemeral: true });
    }

    // ───── Modal for changing bet ─────
    if (action === 'modal') {
      await interaction.deferReply().catch(() => {});
      try {
        const newMiseRaw = interaction.fields.getTextInputValue('newmise');
        const user = db.getUser(userId, interaction.guildId);
        if (!user) {
          return interaction.editReply({
            content: '❌ Profil non trouvé.',
            ephemeral: true,
          });
        }

        const newMise = parseMise(newMiseRaw, user.balance);
        if (!newMise || newMise < 1) {
          return interaction.editReply({
            content: `❌ Mise invalide. Entre 1 et ${user.balance} ${coin}.`,
            ephemeral: true,
          });
        }

        if (user.balance < newMise) {
          return interaction.editReply({
            content: `❌ Solde insuffisant. Tu as **${user.balance} ${coin}** mais tu essaies de miser **${newMise} ${coin}**.`,
            ephemeral: true,
          });
        }

        // Refund previous session if exists and collect/reset
        const gameId = customId.includes('_modal_') ? null : parts[3];
        const session = gameId ? getSession(userId, gameId) : null;

        if (session) {
          // Refund the initial bet
          db.addCoins(userId, interaction.guildId, session.initialMise);
          cleanupSession(userId, gameId);
        }

        // Start new game with new bet
        db.addCoins(userId, interaction.guildId, -newMise);
        const newGameId = getGameId();
        const firstCard = getRandomCard();

        const newSession = {
          userId,
          guildId: interaction.guildId,
          gameId: newGameId,
          initialMise: newMise,
          currentCard: firstCard,
          rounds: 0,
          resultMessage: '',
          messageId: null,
        };

        saveSession(userId, newGameId, newSession);

        const embed = buildGameEmbed(newSession, 'playing');
        embed.setDescription(`La première carte est ${formatCard(firstCard)}.\n\nQuelle sera la prochaine ?`);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`hilo_higher_${userId}_${newGameId}`)
            .setLabel('📈 Plus haute')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`hilo_lower_${userId}_${newGameId}`)
            .setLabel('📉 Plus basse')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`hilo_rules_${userId}`)
            .setLabel('📋 Règles')
            .setStyle(ButtonStyle.Secondary),
        );

        const msg = await interaction.editReply({ embeds: [embed], components: [row] });
        newSession.messageId = msg.id;
        saveSession(userId, newGameId, newSession);
      } catch (err) {
        console.error('[hilo modal]', err);
        await interaction.editReply({
          content: '❌ Erreur lors du traitement de la mise.',
          ephemeral: true,
        }).catch(() => {});
      }
      return true;
    }

    // Get session for other actions
    const session = getSession(userId, gameId);
    if (!session) {
      return interaction.editReply({
        content: '❌ Partie expirée. Recommence avec `/hilo`.',
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    // ───── Change bet ─────
    if (action === 'changemise') {
      const modal = new ModalBuilder()
        .setCustomId(`hilo_modal_${userId}`)
        .setTitle('💰 Nouvelle mise')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('newmise')
              .setLabel('Montant à miser (min 1)')
              .setPlaceholder('Ex : 500 ou "all"')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(12)
          )
        );

      await interaction.showModal(modal);
      return true;
    }

    // ───── Collect winnings ─────
    if (action === 'collect') {
      await interaction.deferUpdate().catch(() => {});
      const winnings = Math.floor(session.initialMise * (1.9 ** session.rounds));
      db.addCoins(userId, session.guildId, winnings);

      const user = db.getUser(userId, session.guildId);
      const newBalance = user?.balance || 0;

      const embed = new EmbedBuilder()
        .setColor(C.WIN)
        .setTitle('💰 Gains encaissés !')
        .setDescription(`Tu as remporté **${winnings} ${coin}** !`)
        .addFields(
          { name: '⛓️ Manches gagnées', value: session.rounds.toString(), inline: true },
          { name: '📊 Multiplicateur', value: `×${(1.9 ** session.rounds).toFixed(2)}`, inline: true },
          { name: '💳 Nouveau solde', value: balanceLine(newBalance, winnings, coin), inline: false },
        )
        .setFooter({ text: casinoFooter('Hi-Lo') });

      await interaction.message.edit({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`hilo_replay_${userId}`)
              .setLabel('🔄 Rejouer')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`hilo_changemise_${userId}`)
              .setLabel('💰 Autre mise')
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      }).catch(() => {});

      db.addGameStat(userId, session.guildId, 'hilo', {
        won: true,
        bet: session.initialMise,
        payout: winnings,
      });

      cleanupSession(userId, gameId);
      return true;
    }

    // ───── Predict Higher or Lower ─────
    if (action === 'higher' || action === 'lower') {
      // Check max 5 rounds
      if (session.rounds >= 5) {
        const embed = new EmbedBuilder()
          .setColor(C.LOSS)
          .setTitle('⚠️ Limite atteinte')
          .setDescription('Maximum 5 manches. Encaisse tes gains !');

        await interaction.message.edit({ embeds: [embed] }).catch(() => {})
        return true;
      }

      const nextCard = getRandomCard();
      const currentValue = session.currentCard.value;
      const nextValue = nextCard.value;
      const prediction = action === 'higher' ? 'higher' : 'lower';

      let isCorrect = false;
      if (prediction === 'higher' && nextValue > currentValue) {
        isCorrect = true;
      } else if (prediction === 'lower' && nextValue < currentValue) {
        isCorrect = true;
      } else if (nextValue === currentValue) {
        // Exact match: player wins 2x (bonus)
        isCorrect = true;
      }

      if (isCorrect) {
        // Win: continue to next round
        session.rounds += 1;
        session.currentCard = nextCard;
        session.resultMessage = `✅ Exact ! ${formatCard(nextCard)} ${nextValue > currentValue ? '(' : ''}${nextValue > currentValue ? 'Plus haute' : nextValue < currentValue ? 'Plus basse' : 'Identique'}${nextValue > currentValue ? ')' : nextValue < currentValue ? ')' : '!'}`;

        const currentWinnings = Math.floor(session.initialMise * (1.9 ** session.rounds));
        const embed = buildGameEmbed(session, 'playing');
        embed.setDescription(
          `${session.resultMessage}\n\nLa carte est maintenant ${formatCard(nextCard)}.\nGains actuels : **${currentWinnings} ${coin}**\n\nContinuer ou encaisser ?`
        );

        const buttons = [
          new ButtonBuilder()
            .setCustomId(`hilo_higher_${userId}_${gameId}`)
            .setLabel('📈 Plus haute')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`hilo_lower_${userId}_${gameId}`)
            .setLabel('📉 Plus basse')
            .setStyle(ButtonStyle.Danger),
        ];

        // Can collect after first win
        if (session.rounds > 0) {
          buttons.push(
            new ButtonBuilder()
              .setCustomId(`hilo_collect_${userId}_${gameId}`)
              .setLabel('💰 Encaisser')
              .setStyle(ButtonStyle.Primary)
          );
        }

        const row = new ActionRowBuilder().addComponents(buttons);

        await interaction.message.edit({
          embeds: [embed],
          components: [row],
        }).catch(() => {});

        saveSession(userId, gameId, session);
      } else {
        // Loss: end game
        const lostAmount = session.initialMise;
        const user = db.getUser(userId, session.guildId);
        const newBalance = user?.balance || 0;

        const embed = new EmbedBuilder()
          .setColor(C.LOSS)
          .setTitle('❌ Perdu !')
          .setDescription(
            `${formatCard(nextCard)} n'était pas ${action === 'higher' ? 'plus haute' : 'plus basse'}.\nLa carte actuelle était ${formatCard(session.currentCard)}.`
          )
          .addFields(
            { name: '⛓️ Manches gagnées', value: session.rounds.toString(), inline: true },
            { name: '💸 Perdu', value: chipStr(lostAmount, coin), inline: true },
            { name: '💳 Nouveau solde', value: balanceLine(newBalance, -lostAmount, coin), inline: false },
          )
          .setFooter({ text: casinoFooter('Hi-Lo') });

        await interaction.message.edit({
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`hilo_replay_${userId}`)
                .setLabel('🔄 Rejouer')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId(`hilo_changemise_${userId}`)
                .setLabel('💰 Autre mise')
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
        }).catch(() => {});

        db.addGameStat(userId, session.guildId, 'hilo', {
          won: false,
          bet: session.initialMise,
          payout: 0,
        });

        cleanupSession(userId, gameId);
      }
    }

    return true;
  } catch (err) {
    console.error('[hilo handleComponent]', err);
    await interaction.editReply({
      content: '❌ Une erreur est survenue.',
      ephemeral: true,
    }).catch(() => {});
    return true;
  }
}

module.exports = {
  name: 'hilo',
  aliases: ['hi-lo', 'hilow'],
  data,
  async execute(interaction) {
    return execute(interaction);
  },
  async handleComponent(interaction, customId) {
    return handleComponent(interaction, customId);
  },
  async run(message, args) {
    const mise = parseInt(args[0]) || 50;
    if (mise < 5) return message.reply('❌ Mise minimale : 5 coins. Usage : `&hilo <mise>`');
    const fake = {
      user: message.author, member: message.member,
      guild: message.guild, guildId: message.guildId,
      channel: message.channel, client: message.client,
      deferred: false, replied: false,
      options: {
        getInteger: (k) => k === 'mise' ? mise : null,
        getString: () => null, getUser: () => null, getBoolean: () => null,
      },
      deferReply: async () => {},
      editReply:  async (d) => message.channel.send(d).catch(() => {}),
      reply:      async (d) => message.reply(d).catch(() => message.channel.send(d).catch(() => {})),
      followUp:   async (d) => message.channel.send(d).catch(() => {}),
    };
    await execute(fake);
  },
};
