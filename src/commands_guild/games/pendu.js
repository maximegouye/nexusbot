const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const WORDS = [
  // Animaux
  'elephant', 'girafe', 'kangourou', 'manchot', 'crocodile', 'hippopotame', 'cameleon',
  // Fruits
  'ananas', 'pastèque', 'mangue', 'framboise', 'grenade', 'abricot', 'nectarine',
  // Pays
  'portugal', 'argentine', 'australie', 'ethiopie', 'cambodge', 'venezuela',
  // Objets
  'telescope', 'parachute', 'microscope', 'helicoptere', 'submarine', 'ordinateur',
  // Métiers
  'chirurgien', 'astronaute', 'electricien', 'photographe', 'architecte', 'veterinaire',
  // Divers
  'chocolat', 'bibliotheque', 'encyclopedie', 'paradoxe', 'revolution', 'aventure',
];

const HANGMAN = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

const REWARD = 200;
const activeGames = new Map();

function buildDisplay(word, guessed) {
  return word.split('').map(l => guessed.includes(l) ? `**${l.toUpperCase()}**` : '\\_').join(' ');
}

function buildKeyboard(guessed) {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const rows = [];
  for (let i = 0; i < letters.length; i += 7) {
    rows.push(new ActionRowBuilder().addComponents(
      letters.slice(i, i + 7).map(l =>
        new ButtonBuilder()
          .setCustomId(`pendu_${l}`)
          .setLabel(l.toUpperCase())
          .setStyle(guessed.includes(l) ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(guessed.includes(l))
      )
    ));
  }
  return rows.slice(0, 4); // Max 4 lignes de boutons
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pendu')
    .setDescription('🎯 Jeu du pendu — Devinez le mot lettre par lettre !')
    .addSubcommand(s => s.setName('jouer').setDescription('🎯 Commencer une nouvelle partie')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const key = `${guildId}_${userId}`;

    if (sub === 'jouer') {
      if (activeGames.has(key)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà une partie en cours ! Cliquez sur les boutons pour jouer.', ephemeral: true });

      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      const game = { word, guessed: [], errors: 0, time: Date.now() };
      activeGames.set(key, game);

      setTimeout(() => activeGames.delete(key), 600000); // 10 min

      const display = buildDisplay(word, []);
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🎯 Pendu !')
        .addFields(
          { name: '🔤 Mot', value: display, inline: false },
          { name: '❌ Erreurs', value: `0/6`, inline: true },
          { name: '💰 Récompense', value: `${REWARD} ${coin}`, inline: true },
        )
        .setDescription(HANGMAN[0])
        .setFooter({ text: `${word.length} lettres • Cliquez une lettre` });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], components: buildKeyboard([]) });
    }
  },

  // Gestionnaire de bouton (appelé depuis interactionCreate)
  async handleButton(interaction) {
    const db = require('../../database/db');
    const letter = interaction.customId.replace('pendu_', '');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const key = `${guildId}_${userId}`;

    const game = activeGames.get(key);
    if (!game) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours. Lancez `/pendu jouer`.', ephemeral: true });

    if (game.guessed.includes(letter)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous avez déjà essayé **${letter.toUpperCase()}**.`, ephemeral: true });

    game.guessed.push(letter);
    if (!game.word.includes(letter)) game.errors++;

    const display = buildDisplay(game.word, game.guessed);
    const allFound = game.word.split('').every(l => game.guessed.includes(l));

    if (allFound) {
      activeGames.delete(key);
      db.addCoins(userId, guildId, REWARD);
      const time = ((Date.now() - game.time) / 1000).toFixed(1);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('🎉 Bravo ! Vous avez gagné !')
          .setDescription(HANGMAN[game.errors])
          .addFields(
            { name: '✅ Mot', value: `**${game.word.toUpperCase()}**`, inline: true },
            { name: '⏱️ Temps', value: `${time}s`, inline: true },
            { name: '💰 Gain', value: `+${REWARD} ${coin}`, inline: true },
          )
        ], components: []
      });
    }

    if (game.errors >= 6) {
      activeGames.delete(key);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('💀 Perdu !')
          .setDescription(HANGMAN[6])
          .addFields(
            { name: '❌ Mot', value: `Le mot était : **${game.word.toUpperCase()}**`, inline: false },
          )
        ], components: []
      });
    }

    const embed = new EmbedBuilder()
      .setColor(game.errors >= 4 ? '#E74C3C' : '#9B59B6')
      .setTitle('🎯 Pendu')
      .setDescription(HANGMAN[game.errors])
      .addFields(
        { name: '🔤 Mot', value: display, inline: false },
        { name: '❌ Erreurs', value: `${game.errors}/6`, inline: true },
        { name: '🔠 Essayés', value: game.guessed.map(l => l.toUpperCase()).join(' ') || '—', inline: true },
      )
      .setFooter({ text: `${game.word.length} lettres` });

    return interaction.update({ embeds: [embed], components: buildKeyboard(game.guessed) });
  }
};

module.exports.activeGames = activeGames;
