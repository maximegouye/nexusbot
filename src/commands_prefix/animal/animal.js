/**
 * NexusBot — Faits animaliers et nature (prefix)
 * n!animal_fait, n!chat_fait, n!chien_fait, n!oiseau, n!insecte, n!ocean_animal...
 */
const { EmbedBuilder } = require('discord.js');

const ANIMAL_FACTS = {
  chat: [
    "Les chats dorment entre 12 et 16 heures par jour.",
    "Un chat peut sauter jusqu'à 6 fois sa propre hauteur.",
    "Les chats ne peuvent pas goûter le sucré — ils manquent des récepteurs gustatifs.",
    "Chaque chat a une empreinte de nez unique, comme les empreintes digitales.",
    "Les chats ronronnent à une fréquence de 25-150 Hz, ce qui favorise la guérison des os.",
    "Un groupe de chats s'appelle une 'clowder'.",
    "Les chats ont 32 muscles dans chaque oreille.",
  ],
  chien: [
    "Les chiens ont un odorat 10 000 à 100 000 fois plus développé que les humains.",
    "Un chien peut comprendre jusqu'à 250 mots et gestes.",
    "Le cœur d'un chien bat entre 60 et 140 fois par minute.",
    "Les chiens rêvent — leurs ondes cérébrales pendant le sommeil ressemblent aux nôtres.",
    "Chaque chien a une empreinte de truffe unique.",
    "Un chien court en moyenne à 40-50 km/h.",
    "Les chiens peuvent détecter certains cancers et crises d'épilepsie avant qu'elles surviennent.",
  ],
  dauphin: [
    "Les dauphins dorment avec la moitié du cerveau éveillée.",
    "Ils utilisent l'écholocation pour naviguer et chasser.",
    "Les dauphins se reconnaissent dans un miroir — signe d'auto-conscience.",
    "Un groupe de dauphins s'appelle un 'pod'.",
    "Ils peuvent nager jusqu'à 50 km/h.",
    "Les dauphins sont les seuls animaux qui jouent pour le plaisir, même adultes.",
  ],
  éléphant: [
    "Les éléphants ont une mémoire exceptionnelle — ils reconnaissent des individus après des années.",
    "Ils peuvent entendre des infrasons à des dizaines de kilomètres.",
    "L'éléphant d'Afrique est le plus grand animal terrestre (jusqu'à 7 tonnes).",
    "Les éléphants pleurent, jouent, rient — ils expriment des émotions complexes.",
    "Ils se servent de leur trompe pour boire, saisir des objets et communiquer.",
    "Les éléphants se souviennent de leurs morts et reviennent sur les os de leurs proches.",
  ],
  pieuvre: [
    "Les pieuvres ont 3 cœurs et du sang bleu (grâce à l'hémocyanine).",
    "Elles peuvent changer de couleur et de texture en moins d'une seconde.",
    "Chaque bras d'une pieuvre contient 2/3 de ses neurones.",
    "Les pieuvres sont extrêmement intelligentes : elles ouvrent des bocaux, jouent, se souviennent.",
    "Une pieuvre peut passer à travers n'importe quel trou plus grand que son bec.",
    "Elles sont colorblind mais peuvent détecter les couleurs via leur peau.",
  ],
};

const OISEAUX = [
  { name:'Faucon pèlerin', fact:'L\'oiseau le plus rapide au monde : 389 km/h en piqué !', emoji:'🦅' },
  { name:'Autruche', fact:'L\'oiseau le plus grand (2,7m) et le plus rapide sur terre (70 km/h).', emoji:'🦤' },
  { name:'Colibri', fact:'Peut battre des ailes jusqu\'à 80 fois par seconde. Le seul oiseau à voler en arrière.', emoji:'🐦' },
  { name:'Perroquet', fact:'Peut vivre jusqu\'à 80 ans. Certains apprennent des centaines de mots.', emoji:'🦜' },
  { name:'Chouette', fact:'Peut tourner la tête à 270°. Vision 100x meilleure que l\'humain la nuit.', emoji:'🦉' },
  { name:'Manchot', fact:'Ne peut pas voler mais est un nageur exceptionnel (25 km/h dans l\'eau).', emoji:'🐧' },
  { name:'Pie', fact:'L\'une des rares espèces (non-mammifère) à se reconnaître dans un miroir.', emoji:'🐦‍⬛' },
];

const INSECTES = [
  { name:'Fourmi', fact:'Peut soulever 50x son propre poids. Les colonies peuvent compter 300 millions d\'individus.', emoji:'🐜' },
  { name:'Abeille', fact:'Une colonie produit 30kg de miel par an. Danse pour communiquer la direction de fleurs.', emoji:'🐝' },
  { name:'Papillon', fact:'Goûte avec ses pattes. Les ailes sont couvertes d\'écailles microscopiques.', emoji:'🦋' },
  { name:'Libellule', fact:'Existe depuis 300 millions d\'années. Capture 95% de ses proies en plein vol.', emoji:'🪲' },
  { name:'Termite', fact:'Leurs termitières peuvent faire 9 mètres de haut et abriter 3 millions d\'individus.', emoji:'🐛' },
];

const OCEAN = [
  { name:'Grand requin blanc', fact:'Peut détecter une goutte de sang dans 100L d\'eau. Vit jusqu\'à 70 ans.', emoji:'🦈' },
  { name:'Baleine bleue', fact:'Le plus grand animal qui ait jamais existé : 30m et 200 tonnes. Son cœur est grand comme une voiture.', emoji:'🐋' },
  { name:'Méduse', fact:'Certaines espèces sont biologiquement immortelles. Elles existent depuis 500 millions d\'ans.', emoji:'🪼' },
  { name:'Hippocampe', fact:'Le mâle porte les petits. Se déplace en maintenant un couple pour toute la vie.', emoji:'🐠' },
  { name:'Calamar géant', fact:'Peut mesurer 13 mètres. Ses yeux (30cm) sont les plus grands du règne animal.', emoji:'🦑' },
];

const commands = [
  {
    name: 'animal_fait',
    aliases: ['animalfact', 'animal', 'zoologie'],
    description: 'Fait aléatoire sur un animal',
    category: 'Animaux',
    cooldown: 3,
    async execute(message, args) {
      const key = args[0]?.toLowerCase();
      const animals = Object.keys(ANIMAL_FACTS);
      const chosen = animals.includes(key) ? key : animals[Math.floor(Math.random() * animals.length)];
      const facts = ANIMAL_FACTS[chosen];
      const fact = facts[Math.floor(Math.random() * facts.length)];
      const cap = chosen.charAt(0).toUpperCase() + chosen.slice(1);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#27AE60')
        .setTitle(`🐾 Fait sur le ${cap}`)
        .setDescription(fact)
        .setFooter({ text: `Animaux disponibles : ${animals.join(', ')}` })] });
    }
  },
  {
    name: 'oiseau',
    aliases: ['bird', 'oiseaux', 'aviaire'],
    description: 'Fait aléatoire sur un oiseau',
    category: 'Animaux',
    cooldown: 3,
    async execute(message, args) {
      const b = OISEAUX[Math.floor(Math.random() * OISEAUX.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`${b.emoji} ${b.name}`)
        .setDescription(b.fact)] });
    }
  },
  {
    name: 'insecte',
    aliases: ['bug', 'insect', 'entomologie'],
    description: 'Fait aléatoire sur un insecte',
    category: 'Animaux',
    cooldown: 3,
    async execute(message, args) {
      const ins = INSECTES[Math.floor(Math.random() * INSECTES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle(`${ins.emoji} ${ins.name}`)
        .setDescription(ins.fact)] });
    }
  },
  {
    name: 'ocean_animal',
    aliases: ['mer', 'marin', 'ocean_fact'],
    description: 'Fait aléatoire sur un animal marin',
    category: 'Animaux',
    cooldown: 3,
    async execute(message, args) {
      const o = OCEAN[Math.floor(Math.random() * OCEAN.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2980B9')
        .setTitle(`${o.emoji} ${o.name}`)
        .setDescription(o.fact)] });
    }
  },
  {
    name: 'vitesse_animal',
    aliases: ['vitesse', 'rapide', 'animal_speed'],
    description: 'Classement des animaux les plus rapides',
    category: 'Animaux',
    cooldown: 5,
    async execute(message, args) {
      const VITESSES = [
        { rank:1, name:'Faucon pèlerin (piqué)', speed:'389 km/h' },
        { rank:2, name:'Espadon', speed:'110 km/h' },
        { rank:3, name:'Guépard', speed:'109 km/h' },
        { rank:4, name:'Lion', speed:'80 km/h' },
        { rank:5, name:'Autruche', speed:'70 km/h' },
        { rank:6, name:'Dauphin', speed:'56 km/h' },
        { rank:7, name:'Lièvre', speed:'56 km/h' },
        { rank:8, name:'Humain (sprint)', speed:'44 km/h' },
      ];
      const desc = VITESSES.map(v => `**${v.rank}.** ${v.name} — **${v.speed}**`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('🏃 Animaux les plus rapides')
        .setDescription(desc)] });
    }
  },
  {
    name: 'longévité',
    aliases: ['longevite', 'vie_animale', 'age_animal'],
    description: 'Longévité des animaux',
    category: 'Animaux',
    cooldown: 5,
    async execute(message, args) {
      const AGES = [
        { name:'Quahog (palourde)', age:'500+ ans' },
        { name:'Groenlandais (requin)', age:'400+ ans' },
        { name:'Tortue des Seychelles', age:'190+ ans' },
        { name:'Baleine boréale', age:'211+ ans' },
        { name:'Perroquet ara', age:'80+ ans' },
        { name:'Éléphant d\'Asie', age:'70 ans' },
        { name:'Corbeau', age:'40 ans' },
        { name:'Chat domestique', age:'15-20 ans' },
        { name:'Chien', age:'10-15 ans' },
        { name:'Souris', age:'2-3 ans' },
      ];
      const desc = AGES.map(a => `🐾 **${a.name}** : ${a.age}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle('⏳ Longévité des animaux')
        .setDescription(desc)] });
    }
  },
  {
    name: 'animaux_dangereux',
    aliases: ['danger', 'venimeux', 'tueurs'],
    description: 'Les animaux les plus dangereux du monde',
    category: 'Animaux',
    cooldown: 5,
    async execute(message, args) {
      const DANG = [
        { rank:1, name:'Moustique', deaths:'750 000/an (paludisme)', emoji:'🦟' },
        { rank:2, name:'Humain', deaths:'475 000/an', emoji:'👤' },
        { rank:3, name:'Serpent', deaths:'138 000/an', emoji:'🐍' },
        { rank:4, name:'Chien (rage)', deaths:'59 000/an', emoji:'🐕' },
        { rank:5, name:'Tsé-tsé (mouche)', deaths:'10 000/an', emoji:'🪰' },
        { rank:6, name:'Crocodile', deaths:'1 000/an', emoji:'🐊' },
        { rank:7, name:'Hippopotame', deaths:'500/an', emoji:'🦛' },
      ];
      const desc = DANG.map(d => `**${d.rank}.** ${d.emoji} **${d.name}** — ${d.deaths}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#C0392B')
        .setTitle('☠️ Animaux les plus meurtriers')
        .setDescription(desc)
        .setFooter({ text: 'Décès humains par an estimés (OMS)' })] });
    }
  },
  {
    name: 'bruit_animal',
    aliases: ['son_animal', 'cri', 'onomatopee'],
    description: 'Quel cri fait cet animal ?',
    category: 'Animaux',
    cooldown: 3,
    async execute(message, args) {
      const BRUITS = [
        { animal:'Lion', cri:'rugit', son:'ROOOAARRR' },
        { animal:'Chien', cri:'aboie', son:'WAF WAF' },
        { animal:'Chat', cri:'miaule', son:'MIAOU' },
        { animal:'Vache', cri:'meugle', son:'MEUH' },
        { animal:'Grenouille', cri:'coasse', son:'COAAAAX' },
        { animal:'Hibou', cri:'hulule', son:'OOHOO-OHOO' },
        { animal:'Serpent', cri:'siffle', son:'SSSSSS' },
        { animal:'Abeille', cri:'bourdonne', son:'BZZZZZ' },
        { animal:'Canard', cri:'cancane', son:'COIN COIN' },
      ];
      const b = BRUITS[Math.floor(Math.random() * BRUITS.length)];
      return message.reply(`🔊 Le **${b.animal}** **${b.cri}** : ***${b.son}***`);
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
