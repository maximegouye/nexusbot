/**
 * NexusBot — Citations et proverbes (prefix)
 * n!citation, n!proverbe, n!motivation, n!sagesse, n!philosophie...
 */
const { EmbedBuilder } = require('discord.js');

const CITATIONS = [
  { text: "La vie, c'est comme une bicyclette, il faut avancer pour ne pas perdre l'équilibre.", author: "Albert Einstein" },
  { text: "Soyez le changement que vous voulez voir dans le monde.", author: "Mahatma Gandhi" },
  { text: "L'imagination est plus importante que le savoir.", author: "Albert Einstein" },
  { text: "Le seul vrai voyage, c'est d'aller vers les autres.", author: "Romain Rolland" },
  { text: "La liberté des uns s'arrête là où commence celle des autres.", author: "Phrase philosophique" },
  { text: "Ce que l'on conçoit bien s'énonce clairement.", author: "Nicolas Boileau" },
  { text: "Il n'y a pas de vent favorable pour celui qui ne sait pas où il va.", author: "Sénèque" },
  { text: "La plus grande gloire n'est pas de ne jamais tomber, mais de se relever à chaque chute.", author: "Confucius" },
  { text: "Mieux vaut être seul que mal accompagné.", author: "Proverbe français" },
  { text: "La connaissance s'acquiert par l'expérience, tout le reste n'est que de l'information.", author: "Albert Einstein" },
  { text: "N'attends pas. Le moment ne sera jamais juste.", author: "Napoléon Hill" },
  { text: "Un voyage de mille lieues commence toujours par un premier pas.", author: "Lao Tseu" },
  { text: "La plus grande aventure de la vie est de découvrir qui tu es.", author: "Sheila Murray Bethel" },
  { text: "Chaque jour est une nouvelle chance de changer ta vie.", author: "Proverbe" },
  { text: "Le succès c'est d'aller d'échec en échec sans perdre son enthousiasme.", author: "Winston Churchill" },
  { text: "Celui qui déplace des montagnes commence par enlever les petites pierres.", author: "Confucius" },
  { text: "Le bonheur n'est pas d'avoir ce qu'on veut, mais de vouloir ce qu'on a.", author: "Proverbe" },
  { text: "La créativité c'est l'intelligence qui s'amuse.", author: "Albert Einstein" },
  { text: "Tout ce que tu cherches se trouve de l'autre côté de la peur.", author: "George Addair" },
  { text: "Le talent sans travail n'est que du potentiel gaspillé.", author: "Proverbe sportif" },
];

const PROVERBES = [
  { text: "Après la pluie, le beau temps.", pays: "France" },
  { text: "L'union fait la force.", pays: "Belgique" },
  { text: "Vouloir c'est pouvoir.", pays: "France" },
  { text: "Mieux vaut tard que jamais.", pays: "France" },
  { text: "Pierre qui roule n'amasse pas mousse.", pays: "France" },
  { text: "Les cordonniers sont les plus mal chaussés.", pays: "France" },
  { text: "Quand le chat n'est pas là, les souris dansent.", pays: "France" },
  { text: "On n'attrape pas les mouches avec du vinaigre.", pays: "France" },
  { text: "Il ne faut pas vendre la peau de l'ours avant de l'avoir tué.", pays: "France" },
  { text: "Qui sème le vent récolte la tempête.", pays: "France" },
  { text: "L'habit ne fait pas le moine.", pays: "France" },
  { text: "Rome ne s'est pas faite en un jour.", pays: "International" },
  { text: "La nuit porte conseil.", pays: "France" },
  { text: "Loin des yeux, loin du cœur.", pays: "France" },
  { text: "Deux précautions valent mieux qu'une.", pays: "France" },
];

const MOTIVATIONS = [
  "Tu es plus fort(e) que tu ne le crois. Continue !",
  "Chaque effort compte. Ne lâche pas !",
  "La persévérance est la clé du succès.",
  "Tu peux le faire — crois en toi !",
  "Aujourd'hui est un nouveau départ.",
  "Les rêves ne fonctionnent que si tu travailles.",
  "Ton futur se construit maintenant.",
  "Sois fier(e) de chaque petit progrès.",
  "La force vient de l'intérieur.",
  "Un pas à la fois — tu y arriveras !",
];

const PHILOSOPHES = [
  { name: "Socrate", citation: "Connais-toi toi-même.", ecole: "Socratisme" },
  { name: "Platon", citation: "La musique donne une âme à nos cœurs et des ailes à la pensée.", ecole: "Idéalisme" },
  { name: "Aristote", citation: "La racine de l'éducation est amère, mais ses fruits sont doux.", ecole: "Péripatétisme" },
  { name: "Descartes", citation: "Je pense donc je suis.", ecole: "Rationalisme" },
  { name: "Nietzsche", citation: "Ce qui ne me tue pas me rend plus fort.", ecole: "Nihilisme/Existentialisme" },
  { name: "Sartre", citation: "L'existence précède l'essence.", ecole: "Existentialisme" },
  { name: "Camus", citation: "Il faut imaginer Sisyphe heureux.", ecole: "Absurdisme" },
  { name: "Kant", citation: "Le ciel étoilé au-dessus de moi, la loi morale en moi.", ecole: "Criticisme" },
];

const commands = [
  {
    name: 'citation',
    aliases: ['quote', 'citations', 'inspire'],
    description: 'Citation inspirante aléatoire',
    category: 'Citations',
    cooldown: 3,
    async run(message, args) {
      const c = CITATIONS[Math.floor(Math.random() * CITATIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('💬 Citation du moment')
        .setDescription(`*"${c.text}"*`)
        .setFooter({ text: `— ${c.author}` })] });
    }
  },
  {
    name: 'proverbe',
    aliases: ['prov', 'sagesse'],
    description: 'Proverbe aléatoire',
    category: 'Citations',
    cooldown: 3,
    async run(message, args) {
      const p = PROVERBES[Math.floor(Math.random() * PROVERBES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('📜 Proverbe')
        .setDescription(`*"${p.text}"*`)
        .setFooter({ text: `Origine : ${p.pays}` })] });
    }
  },
  {
    name: 'motivation',
    aliases: ['motiver', 'boost', 'go'],
    description: 'Message de motivation aléatoire',
    category: 'Citations',
    cooldown: 3,
    async run(message, args) {
      const name = message.member?.displayName || message.author.username;
      const m = MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`💪 ${name}, voici ta motivation !`)
        .setDescription(`**${m}**`)] });
    }
  },
  {
    name: 'philosophe',
    aliases: ['philo', 'philosopher'],
    description: 'Citation d\'un philosophe célèbre',
    category: 'Citations',
    cooldown: 3,
    async run(message, args) {
      const p = PHILOSOPHES[Math.floor(Math.random() * PHILOSOPHES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🎓 ${p.name} — ${p.ecole}`)
        .setDescription(`*"${p.citation}"*`)] });
    }
  },
  {
    name: 'compliment',
    aliases: ['flatter', 'eloge', 'bravo'],
    description: 'Complimenter un membre',
    category: 'Citations',
    cooldown: 5,
    async run(message, args) {
      const COMP = [
        "est une personne brillante et créative !",
        "a une énergie communicative incroyable !",
        "fait preuve d'une intelligence remarquable !",
        "est quelqu'un de vraiment exceptionnel !",
        "apporte une bonne humeur contagieuse !",
        "est toujours là quand on a besoin d'aide !",
        "mérite toute notre admiration !",
      ];
      const target = message.mentions.users.first() || message.author;
      const comp = COMP[Math.floor(Math.random() * COMP.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#FF69B4')
        .setDescription(`💖 **${target.username}** ${comp}`)] });
    }
  },
  {
    name: 'insulte_drole',
    aliases: ['vannes', 'tacle', 'banter'],
    description: 'Petite vanne humoristique (fun)',
    category: 'Citations',
    cooldown: 5,
    async run(message, args) {
      const VANNES = [
        "est si lent(e) que même les escargots te doublent !",
        "confond Google Maps et Google Earth depuis 2015.",
        "met 10 minutes à regarder Orange Is The New Black.",
        "pense que Wi-Fi est une marque de yaourt.",
        "a mis 5 étoiles à un restaurant après avoir lu le menu dehors.",
      ];
      const target = message.mentions.users.first() || message.author;
      const v = VANNES[Math.floor(Math.random() * VANNES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setDescription(`😂 **${target.username}** ${v} *(c'est une blague !)*`)] });
    }
  },
  {
    name: 'defi_du_jour',
    aliases: ['challenge', 'defi', 'chalday'],
    description: 'Défi du jour aléatoire',
    category: 'Citations',
    cooldown: 10,
    async run(message, args) {
      const DEFIS = [
        "Aujourd'hui, dis bonjour à 3 inconnus.",
        "Écris 3 choses pour lesquelles tu es reconnaissant(e).",
        "Désactive les notifs pendant 2 heures et lis un livre.",
        "Fais 20 pompes maintenant. Vas-y !",
        "Apprends 5 mots dans une nouvelle langue.",
        "Cuisine quelque chose que tu n'as jamais fait.",
        "Envoie un message de remerciement à quelqu'un d'important.",
        "Médite pendant 10 minutes en silence.",
        "Dessine quelque chose, même si tu n'es pas artiste.",
        "Écoute un genre musical que tu n'écoutes jamais.",
      ];
      const d = DEFIS[Math.floor(Math.random() * DEFIS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#27AE60')
        .setTitle('🎯 Défi du jour !')
        .setDescription(`**${d}**`)
        .setFooter({ text: 'Tu relèves le défi ?' })] });
    }
  },
  {
    name: 'mantra',
    aliases: ['affirmation', 'positif'],
    description: 'Affirmation positive pour bien commencer',
    category: 'Citations',
    cooldown: 5,
    async run(message, args) {
      const name = message.member?.displayName || message.author.username;
      const MANTRAS = [
        "Je suis capable d'accomplir de grandes choses.",
        "Chaque jour, je grandis et je m'améliore.",
        "Je choisis d'être heureux/heureuse maintenant.",
        "J'ai tout ce dont j'ai besoin en moi.",
        "Mes erreurs me rendent plus fort(e).",
        "Je mérite le bonheur et la réussite.",
        "Je suis en paix avec qui je suis.",
      ];
      const m = MANTRAS[Math.floor(Math.random() * MANTRAS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#1ABC9C')
        .setTitle(`🧘 Mantra pour ${name}`)
        .setDescription(`*"${m}"*`)
        .setFooter({ text: 'Répète-le 3 fois !' })] });
    }
  },
  {
    name: 'ridiculiser',
    aliases: ['mock', 'roast_light'],
    description: 'Petit roast gentil (humoristique)',
    category: 'Citations',
    cooldown: 5,
    async run(message, args) {
      const ROASTS = [
        "essaie de paraître intelligent(e) en ligne, mais on voit tout.",
        "a la personnalité d'un formulaire de déclaration de revenus.",
        "est né(e) un lundi et ça se voit encore.",
        "pense que MDR veut dire 'Ma Douleur Réelle'.",
        "a été en retard même à sa propre naissance.",
      ];
      const target = message.mentions.users.first() || message.author;
      const r = ROASTS[Math.floor(Math.random() * ROASTS.length)];
      return message.reply(`😜 **${target.username}** ${r} *(tout ça en mode humour hein!)*`);
    }
  },
  {
    name: 'fait_jour',
    aliases: ['funfact', 'fait', 'anecdote'],
    description: 'Anecdote/fait insolite du jour',
    category: 'Citations',
    cooldown: 5,
    async run(message, args) {
      const FAITS = [
        "Les pieuvres ont trois cœurs et du sang bleu.",
        "Le miel ne se périme jamais — on en a trouvé dans des tombeaux égyptiens, encore comestible.",
        "Un groupe de flamants roses s'appelle... une 'flamboyance' !",
        "Cleopatra a vécu plus près de nous dans le temps que de la construction des pyramides.",
        "Le gris d'un ordinateur en attente '404' vient du bureau 404 du CERN.",
        "Les chats ne peuvent pas goûter le sucré.",
        "Le son 'uhh' que les humains font en réfléchissant est universel dans toutes les langues.",
        "Il n'y a aucun mot dans le dictionnaire anglais qui rime avec 'orange'.",
        "Les requins existaient avant les arbres.",
        "L'ADN humain est identique à 99,9% entre tous les humains.",
      ];
      const f = FAITS[Math.floor(Math.random() * FAITS.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle('💡 Le savais-tu ?')
        .setDescription(`**${f}**`)] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
