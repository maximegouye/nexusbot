const { SlashCommandBuilder, EmbedBuilder, Colors } = require('discord.js');
const db = require('../../database/db');

const JOKES = [
  { setup: "Pourquoi les plongeurs plongent-ils toujours en arrière?", punchline: "Parce que si ils plongeaient en avant, ils tombent dans le bateau!" },
  { setup: "Quel est le comble pour un électricien?", punchline: "De ne pas être au courant!" },
  { setup: "Qu'est-ce qu'un crocodile qui surveille la pharmacie?", punchline: "Un Lacoste-garde!" },
  { setup: "Pourquoi les poissons n'aiment pas jouer au tennis?", punchline: "Parce qu'ils ont peur du filet!" },
  { setup: "Qu'est-ce qu'un canif?", punchline: "Un petit fien!" },
  { setup: "Quel est le sport préféré des ghosts?", punchline: "Le boo-ling!" },
  { setup: "Pourquoi les champignons vont-ils à la fête?", punchline: "Parce qu'ils sont fun-gi!" },
  { setup: "Qu'est-ce qu'un vampire végétarien?", punchline: "Un turnip!" },
  { setup: "Pourquoi les cerveaux ne jouent pas au baseball?", punchline: "Parce qu'ils ont peur de perdre leur tête!" },
  { setup: "Quel est le problème avec les secrets à la ferme?", punchline: "Les patates ont des yeux, les maïs ont des épis et les pois peuvent être vus!" },
  { setup: "Pourquoi est-ce que le scarabée a été appelé Scarabée?", punchline: "Parce qu'il était un char à beetle!" },
  { setup: "Comment appelle-t-on un ours sans dents?", punchline: "Un bonbon!" },
  { setup: "Qu'est-ce qu'un million de pieds?", punchline: "Un mille-pattes!" },
  { setup: "Pourquoi les scientifiques ne croient pas aux atomes?", punchline: "Parce qu'ils composent tout!" },
  { setup: "Quel type de clé ouvre une banane?", punchline: "Une mon-clé!" },
  { setup: "Pourquoi le livre de maths s'est-il suicidé?", punchline: "Parce qu'il avait trop de problèmes!" },
  { setup: "Qu'est-ce qu'un poisson qui vole?", punchline: "Un vol!" },
  { setup: "Pourquoi les poules traversent-elles la route?", punchline: "Pour arriver de l'autre côté!" },
  { setup: "Quel est le gâteau préféré d'un roi?", punchline: "Une couronne-fleur!" },
  { setup: "Comment appelle-t-on un chat tombé dans un pot de peinture?", punchline: "Un chat-peint!" },
  { setup: "Pourquoi le français n'aime pas jouer avec les oeufs?", punchline: "Parce qu'il a peur de les casser!" },
  { setup: "Qu'est-ce que c'est qu'un chien qui ne parle pas?", punchline: "Un mut!" },
  { setup: "Quel est le bruit d'une fraise qui rencontre un avocat?", punchline: "Choco! Choco!" },
  { setup: "Pourquoi est-ce que la bicyclette ne peut pas se tenir debout?", punchline: "Parce qu'elle est deux-roues fatigué!" },
  { setup: "Qu'est-ce qu'une noix qui rit?", punchline: "Une noix rigole!" },
  { setup: "Quel est le comble pour un pompier?", punchline: "D'avoir un fils qui ne veut pas être pompier!" },
  { setup: "Pourquoi les escargots sont lents?", punchline: "Parce qu'ils traînent leur maison!" },
  { setup: "Qu'est-ce qu'un snowman au printemps?", punchline: "Une flaque d'eau!" },
  { setup: "Comment appelle-t-on un robot qui tourne en rond?", punchline: "Un Dizzy-bot!" },
  { setup: "Quel sport pratiquent les boulangères?", punchline: "La course à pied... du pain!" },
  { setup: "Pourquoi les gardiens de prison sont gros?", punchline: "Parce qu'ils gardent les clés!" },
  { setup: "Qu'est-ce qu'un bateau qui lit?", punchline: "Un livre-bateau!" },
  { setup: "Comment s'appelle un poète qui recule?", punchline: "Un recul-poète!" },
];

const FORTUNES = [
  "La vie est belle, il faut en profiter!",
  "Chaque jour est une nouvelle opportunité.",
  "Tu es plus fort que tu ne le crois.",
  "Les rêves deviennent réalité si tu travailles dur.",
  "La patience porte ses fruits.",
  "Tu as le pouvoir de changer ta vie.",
  "L'amitié est le plus grand trésor.",
  "La joie vient de petites choses simples.",
  "Tu es capable de faire de grandes choses.",
  "La persévérance mène au succès.",
  "Souris, demain sera mieux!",
  "Tu mérites d'être heureux.",
  "La vie te surprendra de belles façons.",
  "Tu peux accomplir tes rêves.",
  "L'amour et la kindness changent le monde.",
  "Tu es un ami merveilleux.",
  "Chaque erreur est une leçon.",
  "La vie est une aventure, profite-la!",
  "Tu as une belle âme.",
  "Le bonheur t'attend au coin de la rue.",
  "Tu fais une différence dans ce monde.",
  "Les meilleurs jours sont à venir.",
  "Tu es inspirant pour les autres.",
  "La vie est un cadeau, apprécie-le.",
  "Tu vas réussir avec ton effort.",
];

const MORSE_CODE = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..',
  "'": '.----.',  '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.',
  '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

const REVERSE_MORSE = {};
Object.entries(MORSE_CODE).forEach(([char, morse]) => {
  REVERSE_MORSE[morse] = char;
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Commandes amusantes!')
    .addSubcommand(sub =>
      sub.setName('blague')
        .setDescription('Raconte une blague française aléatoire')
    )
    .addSubcommand(sub =>
      sub.setName('de')
        .setDescription('Lance un dé')
        .addStringOption(opt =>
          opt.setName('faces')
            .setDescription('Nombre de faces (2-100)')
        )
    )
    .addSubcommand(sub =>
      sub.setName('ship')
        .setDescription('Calcule le pourcentage d\'amour entre deux utilisateurs')
        .addUserOption(opt =>
          opt.setName('user1')
            .setDescription('Premier utilisateur')
            .setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('user2')
            .setDescription('Deuxième utilisateur')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('fortune')
        .setDescription('Obtiens un message de sagesse!')
    )
    .addSubcommand(sub =>
      sub.setName('mock')
        .setDescription('ConVeRtIs Le TeXtE En FoRmAt MoQuEuR')
        .addStringOption(opt =>
          opt.setName('texte')
            .setDescription('Le texte à convertir')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('morse')
        .setDescription('Convertit le texte en code Morse (ou vice versa)')
        .addStringOption(opt =>
          opt.setName('texte')
            .setDescription('Texte ou code Morse')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('inverser')
        .setDescription('Inverse le texte')
        .addStringOption(opt =>
          opt.setName('texte')
            .setDescription('Le texte à inverser')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('comptermots')
        .setDescription('Compte les mots, caractères et phrases')
        .addStringOption(opt =>
          opt.setName('texte')
            .setDescription('Le texte à analyser')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('choisir')
        .setDescription('Choisit une option aléatoirement')
        .addStringOption(opt =>
          opt.setName('option1')
            .setDescription('Première option')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('option2')
            .setDescription('Deuxième option')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('option3')
            .setDescription('Troisième option')
        )
        .addStringOption(opt =>
          opt.setName('option4')
            .setDescription('Quatrième option')
        )
        .addStringOption(opt =>
          opt.setName('option5')
            .setDescription('Cinquième option')
        )
    )
    .addSubcommand(sub =>
      sub.setName('8ball')
        .setDescription('🎱 Pose une question à la boule magique')
        .addStringOption(opt =>
          opt.setName('question')
            .setDescription('Ta question (se termine par ?)')
            .setRequired(true)
            .setMaxLength(200)
        )
    )
    .addSubcommand(sub =>
      sub.setName('rps')
        .setDescription('✊ Pierre-Feuille-Ciseaux contre le bot')
        .addStringOption(opt =>
          opt.setName('choix')
            .setDescription('Ton choix')
            .setRequired(true)
            .addChoices(
              { name: '✊ Pierre', value: 'pierre' },
              { name: '✋ Feuille', value: 'feuille' },
              { name: '✌️ Ciseaux', value: 'ciseaux' },
            )
        )
    ),
  cooldown: 3,
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'blague') {
      const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
      const embed = new EmbedBuilder()
        .setTitle('🤣 Blague Française')
        .setDescription(`**${joke.setup}**\n\n||${joke.punchline}||`)
        .setColor(Colors.Blue)
        .setFooter({ text: 'Hover pour voir la réponse!' });
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'de') {
      const faces = parseInt(interaction.options.getString('faces')) || 6;
      const result = Math.floor(Math.random() * faces) + 1;
      const embed = new EmbedBuilder()
        .setTitle('🎲 Lancer de Dé')
        .setDescription(`\`\`\`\n   ┌─────────┐\n   │  ${String(result).padStart(2, ' ')}  │\n   └─────────┘\n\`\`\``)
        .addFields(
          { name: 'Résultat', value: `**${result}** sur ${faces}`, inline: true },
          { name: 'Chance', value: `${(100 / faces).toFixed(2)}%`, inline: true }
        )
        .setColor(Colors.Gold)
        .setFooter({ text: `D${faces}` });
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'ship') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');

      const hash = parseInt(user1.id) + parseInt(user2.id);
      const percentage = (hash % 101);

      let emoji = '❌';
      let color = Colors.Red;
      if (percentage > 50) {
        emoji = '💛';
        color = Colors.Yellow;
      }
      if (percentage > 75) {
        emoji = '💕';
        color = Colors.Magenta;
      }
      if (percentage > 90) {
        emoji = '❤️';
        color = Colors.Red;
      }

      const barLength = 20;
      const filledLength = Math.floor((percentage / 100) * barLength);
      const bar = '❤️'.repeat(filledLength) + '🤍'.repeat(barLength - filledLength);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} Ship Meter ${emoji}`)
        .setDescription(`**${user1.username}** ↔️ **${user2.username}**`)
        .addFields(
          { name: 'Comptabilité', value: `\`\`\`\n${bar}\n\`\`\``, inline: false },
          { name: 'Score', value: `**${percentage}%**`, inline: true }
        )
        .setColor(color)
        .setThumbnail(user1.displayAvatarURL())
        .setImage(user2.displayAvatarURL());
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'fortune') {
      const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      const embed = new EmbedBuilder()
        .setTitle('🥠 Message de Fortune')
        .setDescription(`*${fortune}*`)
        .setColor(Colors.Purple)
        .setFooter({ text: 'Ton avenir t\'attend!' });
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'mock') {
      const text = interaction.options.getString('texte');
      let mocked = '';
      let toggle = false;
      for (const char of text) {
        if (char === ' ') {
          mocked += ' ';
        } else if (/[a-zA-Z]/.test(char)) {
          mocked += toggle ? char.toUpperCase() : char.toLowerCase();
          toggle = !toggle;
        } else {
          mocked += char;
        }
      }
      const embed = new EmbedBuilder()
        .setTitle('🤡 SpOnGeBoB MoCkInG')
        .addFields(
          { name: 'Original', value: `\`\`\`\n${text}\n\`\`\`` },
          { name: 'Moqué', value: `\`\`\`\n${mocked}\n\`\`\`` }
        )
        .setColor(Colors.Green);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'morse') {
      const input = interaction.options.getString('texte').toUpperCase().trim();
      let output = '';

      if (/^[\.\-\s]+$/.test(input)) {
        const words = input.split('   ');
        for (const word of words) {
          const chars = word.split(' ');
          for (const char of chars) {
            output += REVERSE_MORSE[char] || '?';
          }
          output += ' ';
        }
      } else {
        for (const char of input) {
          if (MORSE_CODE[char]) {
            output += MORSE_CODE[char] + ' ';
          } else if (char === ' ') {
            output += '  ';
          } else {
            output += '? ';
          }
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📡 Code Morse')
        .addFields(
          { name: 'Original', value: `\`\`\`\n${input}\n\`\`\`` },
          { name: 'Morse', value: `\`\`\`\n${output.trim()}\n\`\`\`` }
        )
        .setColor(Colors.Blurple);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'inverser') {
      const text = interaction.options.getString('texte');
      const reversed = text.split('').reverse().join('');
      const embed = new EmbedBuilder()
        .setTitle('🔄 Texte Inversé')
        .addFields(
          { name: 'Original', value: `\`\`\`\n${text}\n\`\`\`` },
          { name: 'Inversé', value: `\`\`\`\n${reversed}\n\`\`\`` }
        )
        .setColor(Colors.Orange);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'comptermots') {
      const text = interaction.options.getString('texte');
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      const chars = text.length;
      const charsNoSpace = text.replace(/\s/g, '').length;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

      const embed = new EmbedBuilder()
        .setTitle('📊 Analyse de Texte')
        .addFields(
          { name: 'Mots', value: `${words.length}`, inline: true },
          { name: 'Caractères (avec espaces)', value: `${chars}`, inline: true },
          { name: 'Caractères (sans espaces)', value: `${charsNoSpace}`, inline: true },
          { name: 'Phrases', value: `${sentences}`, inline: true },
          { name: 'Texte analysé', value: `\`\`\`\n${text}\n\`\`\`` }
        )
        .setColor(Colors.Cyan);
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'choisir') {
      const options = [
        interaction.options.getString('option1'),
        interaction.options.getString('option2'),
        interaction.options.getString('option3'),
        interaction.options.getString('option4'),
        interaction.options.getString('option5'),
      ].filter(opt => opt !== null);

      const chosen = options[Math.floor(Math.random() * options.length)];
      const embed = new EmbedBuilder()
        .setTitle('🎯 Choix Aléatoire')
        .addFields(
          { name: 'Options', value: options.map((o, i) => `${i + 1}. ${o}`).join('\n') },
          { name: '✅ Choix', value: `**${chosen}**`, inline: false }
        )
        .setColor('#7B2FBE');
      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === '8ball') {
      const REPONSES_POS = ['Absolument oui !', 'C\'est certain !', 'Sans aucun doute !', 'Oui, définitivement.', 'Tu peux compter dessus !', 'Très probable.', 'Tout indique que oui.'];
      const REPONSES_NEU = ['Impossible à prédire pour l\'instant.', 'Reconsidère et redemande.', 'Mieux vaut ne pas te répondre maintenant.', 'Je ne peux pas prédire ça.', 'Concentrate-toi et redemande.'];
      const REPONSES_NEG = ['N\'y compte pas.', 'Ma réponse est non.', 'Mes sources disent non.', 'Les perspectives ne sont pas bonnes.', 'Très douteux.'];
      const all = [
        ...REPONSES_POS.map(r => ({ r, color: '#2ECC71', emoji: '✅' })),
        ...REPONSES_NEU.map(r => ({ r, color: '#F1C40F', emoji: '🤷' })),
        ...REPONSES_NEG.map(r => ({ r, color: '#E74C3C', emoji: '❌' })),
      ];
      const pick = all[Math.floor(Math.random() * all.length)];
      const question = interaction.options.getString('question');
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(pick.color)
          .setTitle('🎱 Boule Magique')
          .addFields(
            { name: '❓ Question', value: question, inline: false },
            { name: `${pick.emoji} Réponse`, value: `**${pick.r}**`, inline: false },
          )
          .setFooter({ text: 'La boule magique a parlé...' })
        ]
      });
    }

    if (subcommand === 'rps') {
      const choix = interaction.options.getString('choix');
      const choixBot = ['pierre', 'feuille', 'ciseaux'][Math.floor(Math.random() * 3)];
      const emojis = { pierre: '✊', feuille: '✋', ciseaux: '✌️' };

      let result, color;
      if (choix === choixBot) {
        result = '🤝 Égalité !'; color = '#F1C40F';
      } else if (
        (choix === 'pierre'  && choixBot === 'ciseaux') ||
        (choix === 'feuille' && choixBot === 'pierre')  ||
        (choix === 'ciseaux' && choixBot === 'feuille')
      ) {
        result = '🎉 Tu gagnes !'; color = '#2ECC71';
      } else {
        result = '😢 Tu perds...'; color = '#E74C3C';
      }

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(color)
          .setTitle('✊ Pierre — Feuille — Ciseaux')
          .addFields(
            { name: '👤 Ton choix', value: `${emojis[choix]} ${choix.charAt(0).toUpperCase()+choix.slice(1)}`, inline: true },
            { name: '🤖 Bot',       value: `${emojis[choixBot]} ${choixBot.charAt(0).toUpperCase()+choixBot.slice(1)}`, inline: true },
            { name: '🏆 Résultat',  value: `**${result}**`, inline: false },
          )
        ]
      });
    }
  }
};
