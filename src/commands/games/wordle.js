const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const WORDS = ['CHIEN','MAISON','ARBRE','FLEUR','VOILE','PIANO','PLAGE','NUAGE','SUCRE','LIVRE',
  'TABLE','CHAISE','PORTE','FENETRE','SOLEIL','LUNE','ETOILE','OCEAN','FORET','NEIGE',
  'POMME','ORANGE','CITRON','RAISIN','FRAISE','TIGRE','AIGLE','DAUPHIN','RENARD','LAPIN',
  'ROUGE','BLEU','VERT','JAUNE','BLANC','BOIRE','MANGER','COURIR','CHANTER','DANSER',
  'PAIN','FROMAGE','BEURRE','CONFITURE','GATEAU','RIVIERE','MONTAGNE','DESERT','VALLEE','COLLINE',
  'BRAVE','CALME','DOUX','FIER','FORT','GENTIL','HAUT','JOYEUX','LIBRE','NOBLE'];

const games = new Map(); // userId -> game

function pickWord() { return WORDS[Math.floor(Math.random() * WORDS.length)]; }

function evaluateGuess(guess, word) {
  const result = [];
  const wordArr = word.split('');
  const guessArr = guess.split('');
  const used = Array(word.length).fill(false);

  // Pass 1: corrects
  for (let i = 0; i < word.length; i++) {
    if (guessArr[i] === wordArr[i]) { result[i] = '🟩'; used[i] = true; }
    else result[i] = null;
  }
  // Pass 2: présents mais mal placés
  for (let i = 0; i < guess.length; i++) {
    if (result[i]) continue;
    const j = wordArr.findIndex((c, idx) => !used[idx] && c === guessArr[i]);
    if (j >= 0) { result[i] = '🟨'; used[j] = true; }
    else result[i] = '⬛';
  }
  return result;
}

function renderGame(game) {
  const lines = game.guesses.map(g => {
    const emojis = evaluateGuess(g, game.word).join('');
    return `${emojis}  \`${g}\``;
  });
  // Lignes vides restantes
  for (let i = game.guesses.length; i < 6; i++) lines.push('⬛⬛⬛⬛⬛  `_____`');
  return lines.join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('🟩 Jouer au Wordle en français (deviner un mot de 5 lettres)')
    .addSubcommand(s => s.setName('jouer').setDescription('Commencer une partie'))
    .addSubcommand(s => s.setName('deviner').setDescription('Proposer un mot')
      .addStringOption(o => o.setName('mot').setDescription('Ton mot de 5 lettres').setRequired(true)))
    .addSubcommand(s => s.setName('abandonner').setDescription('Abandonner la partie en cours')),

  async execute(interaction) {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (sub === 'jouer') {
      if (games.has(userId)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu as déjà une partie en cours ! Utilise `/wordle deviner` ou `/wordle abandonner`.', ephemeral: true });
      const word = pickWord();
      games.set(userId, { word, guesses: [], startTime: Date.now() });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🟩 Wordle — Nouvelle partie !')
        .setDescription('Devine le mot en **6 essais**.\n🟩 = Bonne lettre, bonne place\n🟨 = Bonne lettre, mauvaise place\n⬛ = Lettre absente\n\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛')
        .setFooter({ text: 'Utilise /wordle deviner <mot>' })
      ], ephemeral: true });
    }

    if (sub === 'deviner') {
      const game = games.get(userId);
      if (!game) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours. Lance `/wordle jouer`.', ephemeral: true });

      const guess = interaction.options.getString('mot').toUpperCase().trim();
      if (guess.length !== 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Le mot doit faire **5 lettres**.', ephemeral: true });
      if (!/^[A-Z]+$/.test(guess)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Lettres uniquement (sans accents).', ephemeral: true });
      if (game.guesses.includes(guess)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tu as déjà essayé ce mot.', ephemeral: true });

      game.guesses.push(guess);
      const correct = guess === game.word;
      const lost    = !correct && game.guesses.length >= 6;

      const color = correct ? 'Green' : lost ? 'Red' : '#7B2FBE';
      const title = correct ? '🎉 Bravo ! Tu as trouvé !' : lost ? `😔 Perdu ! Le mot était **${game.word}**` : `🟩 Wordle — Essai ${game.guesses.length}/6`;
      const elapsed = Math.round((Date.now() - game.startTime) / 1000);

      if (correct || lost) {
        games.delete(userId);
        const embed = new EmbedBuilder().setColor(color).setTitle(title)
          .setDescription(renderGame(game))
          .addFields(
            { name: '⏱️ Temps', value: `${elapsed}s`, inline: true },
            { name: '🎯 Essais', value: `${game.guesses.length}/6`, inline: true },
          );
        if (correct) embed.addFields({ name: '🏆 Score', value: `${(6 - game.guesses.length + 1) * 100} points`, inline: true });
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE')
        .setTitle(`🟩 Wordle — Essai ${game.guesses.length}/6`)
        .setDescription(renderGame(game))
        .setFooter({ text: `Encore ${6 - game.guesses.length} essai(s)` })
      ], ephemeral: true });
    }

    if (sub === 'abandonner') {
      const game = games.get(userId);
      if (!game) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours.', ephemeral: true });
      games.delete(userId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('Red')
        .setDescription(`🏳️ Partie abandonnée. Le mot était **${game.word}**.`)], ephemeral: true });
    }
  }
};
