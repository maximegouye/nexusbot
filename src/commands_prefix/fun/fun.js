const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: '8ball',
    category: 'Amusement',
    aliases: ['boule', 'oracle', 'question'],
    description: 'Posez une question à la boule magique',
    usage: '[question]',
    cooldown: 3,
    async run(message, args) {
      const q = args.join(' ');
      if (!q) return message.reply('❌ Posez une question !');
      const answers = ['✅ Absolument oui.','✅ C\'est certain !','✅ Sans aucun doute.','✅ Oui, définitivement !','✅ Vous pouvez compter dessus.','🟡 Je ne peux pas prédire maintenant.','🟡 Réponse floue, réessayez.','🟡 Pas encore sûr.','🟡 Mieux vaut ne pas vous le dire.','❌ N\'y comptez pas.','❌ Ma réponse est non.','❌ Mes sources disent non.','❌ Très peu probable.','❌ Non.'];
      const a = answers[Math.floor(Math.random() * answers.length)];
      const color = a.startsWith('✅') ? '#2ECC71' : a.startsWith('🟡') ? '#F1C40F' : '#E74C3C';
      message.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('🎱 Boule Magique').addFields({ name: '❓ Question', value: q }, { name: '🔮 Réponse', value: `**${a}**` })] });
    }
  },
  {
    name: 'meme',
    category: 'Amusement',
    aliases: ['blague', 'joke'],
    description: 'Blague aléatoire',
    cooldown: 5,
    async run(message) {
      const blagues = [
        ['Pourquoi les plongeurs plongent toujours en arrière ?', 'Parce que sinon, ils tomberaient dans le bateau !'],
        ['Qu\'est-ce qu\'un crocodile qui surveille les gardes-robes ?', 'Un vestiaire-dile !'],
        ['Pourquoi les informaticiens confondent-ils Halloween et Noël ?', 'Parce que OCT 31 = DEC 25 !'],
        ['Qu\'est-ce qu\'un canif ?', 'C\'est le petit du canif. Non, du couteau !'],
        ['Comment appelle-t-on un chat tombé dans un pot de peinture ?', 'Un chat peint !'],
        ['Pourquoi les garçons coiffeurs sont-ils plus heureux que les filles ?', 'Parce qu\'ils ont l\'avantage !'],
        ['Qu\'est-ce qu\'un avion qui s\'écrase ?', 'Un avion-plié...'],
        ['Comment appelle-t-on un cerf sans yeux ?', 'Un cerf qui ne voit pas !'],
      ];
      const b = blagues[Math.floor(Math.random() * blagues.length)];
      message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12').setTitle('😂 Blague').setDescription(`**${b[0]}**\n\n||${b[1]}||`)] });
    }
  },
  {
    name: 'pp',
    category: 'Amusement',
    aliases: ['size', 'taille'],
    description: 'Mesurer la taille de votre truc',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const size = Math.floor(Math.random() * 20);
      const bar = '8' + '='.repeat(size) + 'D';
      message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle(`📏 Mesure de ${target.username}`).setDescription(`\`${bar}\` — **${size} cm**`)] });
    }
  },
  {
    name: 'rate',
    category: 'Amusement',
    aliases: ['noter', 'evaluer'],
    description: 'Évaluer quelque chose',
    usage: '[chose à noter]',
    cooldown: 3,
    async run(message, args) {
      const thing = args.join(' ') || message.author.username;
      const score = Math.floor(Math.random() * 101);
      const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
      const color = score >= 70 ? '#2ECC71' : score >= 40 ? '#F1C40F' : '#E74C3C';
      message.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle(`⭐ Évaluation`).setDescription(`**${thing}** → \`[${bar}]\` **${score}/100**`)] });
    }
  },
  {
    name: 'ship',
    category: 'Amusement',
    aliases: ['shipper', 'amour', 'couple'],
    description: 'Calculer la compatibilité entre deux membres',
    usage: '@membre1 @membre2',
    cooldown: 5,
    async run(message, args) {
      const u1 = message.mentions.users.first() || message.author;
      const u2 = message.mentions.users.at(1) || { username: args[1] || 'Quelqu\'un', id: '0' };
      const pct = Math.floor(Math.random() * 101);
      const heart = pct >= 80 ? '💖' : pct >= 60 ? '💗' : pct >= 40 ? '💛' : pct >= 20 ? '💙' : '💔';
      const desc = pct >= 80 ? 'Âmes sœurs !' : pct >= 60 ? 'Très compatible !' : pct >= 40 ? 'Ça peut marcher.' : pct >= 20 ? 'Difficile...' : 'Pas vraiment faits l\'un pour l\'autre.';
      message.reply({ embeds: [new EmbedBuilder().setColor('#FF6B9D').setTitle(`${heart} Compatibilité`).setDescription(`**${u1.username}** 💕 **${u2.username || u2}**\n\n${heart.repeat(3)} **${pct}%** — ${desc}`)] });
    }
  },
  {
    name: 'rps',
    category: 'Amusement',
    aliases: ['chifoumi', 'pierre', 'feuille', 'ciseaux'],
    description: 'Pierre Feuille Ciseaux',
    usage: '[pierre/feuille/ciseaux]',
    cooldown: 3,
    async run(message, args) {
      const choices = { pierre: '🪨', feuille: '📄', ciseaux: '✂️', rock: '🪨', paper: '📄', scissors: '✂️', p: '🪨', f: '📄', c: '✂️' };
      const userPick = args[0]?.toLowerCase();
      if (!choices[userPick]) return message.reply('❌ Choisissez `pierre`, `feuille` ou `ciseaux`.');
      const botChoices = ['pierre', 'feuille', 'ciseaux'];
      const botPick = botChoices[Math.floor(Math.random() * 3)];
      let result;
      if (userPick === botPick) result = '🤝 Égalité !';
      else if ((userPick === 'pierre' && botPick === 'ciseaux') || (userPick === 'feuille' && botPick === 'pierre') || (userPick === 'ciseaux' && botPick === 'feuille')) result = '✅ Vous gagnez !';
      else result = '❌ Vous perdez !';
      message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle('✂️ Pierre Feuille Ciseaux').addFields({ name: '👤 Vous', value: `${choices[userPick]} ${userPick}`, inline: true }, { name: '🤖 Bot', value: `${choices[botPick]} ${botPick}`, inline: true }, { name: '🏆 Résultat', value: result, inline: false })] });
    }
  },
  {
    name: 'would',
    category: 'Amusement',
    aliases: ['wouldyourather', 'plutot', 'dilemme'],
    description: 'Tu préfères... ?',
    cooldown: 5,
    async run(message) {
      const questions = [
        ['Être riche mais malheureux', 'Être pauvre mais heureux'],
        ['Avoir la capacité de voler', 'Être invisible'],
        ['Vivre dans le passé', 'Vivre dans le futur'],
        ['Ne plus jamais dormir', 'Dormir 20h par jour'],
        ['Tout savoir mais ne rien ressentir', 'Tout ressentir mais ne rien savoir'],
        ['Être célèbre mais seul', 'Inconnu mais entouré d\'amour'],
        ['Parler 50 langues', 'Jouer de 50 instruments'],
      ];
      const q = questions[Math.floor(Math.random() * questions.length)];
      message.reply({ embeds: [new EmbedBuilder().setColor('#E91E63').setTitle('🤔 Tu préfères...').addFields({ name: '🅰️ Option A', value: q[0], inline: true }, { name: '🅱️ Option B', value: q[1], inline: true })] });
    }
  },
  {
    name: 'compliment',
    category: 'Amusement',
    aliases: ['flatter', 'complimenter', 'feliciter'],
    description: 'Complimenter un membre',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const compliments = ['est absolument brillant(e) !','a un sourire qui illumine la pièce !','est incroyablement talentueux/se !','est une personne exceptionnelle !','a un cœur en or !','est la meilleure personne du serveur !','rend ce serveur meilleur rien qu\'en étant là !','est un génie incompris !','a une présence charismatique !'];
      const c = compliments[Math.floor(Math.random() * compliments.length)];
      message.reply({ embeds: [new EmbedBuilder().setColor('#FF6B9D').setDescription(`💝 <@${target.id}> ${c}`)] });
    }
  },
  {
    name: 'reverse',
    category: 'Amusement',
    aliases: ['inverser', 'retourner'],
    description: 'Inverser du texte',
    usage: '[texte]',
    cooldown: 3,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Donnez du texte à inverser.');
      const text = args.join(' ');
      message.reply(`🔄 **${text.split('').reverse().join('')}**`);
    }
  },
  {
    name: 'mock',
    category: 'Amusement',
    aliases: ['moquer', 'spongebob'],
    description: 'Transformer du texte en mode moqueur (SpOnGeBoB)',
    usage: '[texte]',
    cooldown: 3,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Donnez du texte.');
      const text = args.join(' ').split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
      message.reply(`🐠 ${text}`);
    }
  },
  {
    name: 'hug',
    category: 'Amusement',
    aliases: ['caliner', 'serrer', 'bisou'],
    description: 'Câliner quelqu\'un',
    usage: '@membre',
    cooldown: 5,
    async run(message, args) {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Mentionnez quelqu\'un à câliner.');
      const actions = ['🤗 serre fort dans ses bras','💕 donne un bisou sur la joue à','🫂 câline affectueusement','❤️ envoie tout son amour à','🌹 offre des fleurs à'];
      const a = actions[Math.floor(Math.random() * actions.length)];
      message.reply(`${a.split(' à')[0]} **${message.author.username}** ${a.includes(' à') ? a.split(' à')[1] + ' ' : ''}**<@${target.id}>** !`);
    }
  },
  {
    name: 'roast',
    category: 'Amusement',
    aliases: ['insulter', 'vanner', 'clash'],
    description: 'Vannes humoristiques',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args) {
      const target = message.mentions.users.first() || message.author;
      const roasts = ['Si l\'intelligence était une maladie, tu serais en parfaite santé.','Tu es tellement lent que les escargots te klaxonnent.','Si les bêtises étaient de l\'or, tu serais millionnaire.','Même Google ne pourrait pas trouver ta logique.','Tu es la raison pour laquelle le bouton "muet" existe.'];
      const r = roasts[Math.floor(Math.random() * roasts.length)];
      message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`🔥 <@${target.id}> : *"${r}"*`)] });
    }
  },
  {
    name: 'fact',
    category: 'Amusement',
    aliases: ['fait', 'saviez', 'info'],
    description: 'Fait aléatoire intéressant',
    cooldown: 5,
    async run(message) {
      const facts = ['Les pieuvres ont 3 cœurs et du sang bleu.','Un groupe de flamants roses s\'appelle un flamant.','Le miel ne se périme jamais — on en a trouvé dans des pyramides vieilles de 3000 ans.','Les fourmis n\'ont pas de poumons.','Le cerveau humain génère suffisamment d\'électricité pour allumer une ampoule.','Les dauphins dorment avec un seul œil ouvert.','Il y a plus de combinaisons possibles dans un jeu de 52 cartes qu\'il y a d\'atomes sur Terre.','Les chats passent 70% de leur vie à dormir.','Les piranhas sont omnivores et mangent aussi des fruits.','Un nuage pèse environ 500 tonnes en moyenne.'];
      const f = facts[Math.floor(Math.random() * facts.length)];
      message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🧠 Le Saviez-Vous ?').setDescription(f)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
