/**
 * NexusBot — Débats et opinions (prefix)
 * n!debat, n!pour_contre, n!opinion, n!vote_sujet, n!dilemme...
 */
const { EmbedBuilder } = require('discord.js');

const SUJETS_DEBAT = [
  { sujet:"Le télétravail devrait-il être généralisé ?", pour:"Flexibilité, moins de transports, meilleure qualité de vie, productivité accrue.", contre:"Isolement social, frontières travail/vie floues, inégalités d'accès, perte de cohésion d'équipe." },
  { sujet:"Faut-il abolir les notes à l'école ?", pour:"Réduction du stress, favorise la curiosité intrinsèque, évalue mieux les compétences.", contre:"Outil de mesure objectif, prépare à la compétition professionnelle, motive certains élèves." },
  { sujet:"Les réseaux sociaux font-ils plus de mal que de bien ?", pour:"Connexions mondiales, diffusion rapide d'informations, voix aux minorités.", contre:"Addiction, désinformation, anxiété, cyberharcèlement, surveillance massive." },
  { sujet:"Devrait-on instaurer un revenu universel de base ?", pour:"Éradique la pauvreté, sécurise face à l'automatisation, stimule l'entrepreneuriat.", contre:"Coût faramineux, peut décourager le travail, inflation potentielle." },
  { sujet:"Le sport extrême devrait-il être interdit aux mineurs ?", pour:"Sécurité physique, cerveaux encore en développement, risques d'accidents.", contre:"Liberté de choix, développe le dépassement de soi, encadrement parental suffisant." },
  { sujet:"Faut-il taxer davantage les ultra-riches ?", pour:"Réduction des inégalités, financement des services publics, justice sociale.", contre:"Risque de fuite des capitaux, déjà fortement imposés, frein à l'investissement." },
  { sujet:"Le végétarisme devrait-il être encouragé par l'État ?", pour:"Impact écologique majeur, santé publique, bien-être animal.", contre:"Liberté alimentaire, traditions culturelles, accessibilité économique." },
  { sujet:"Faut-il limiter le temps d'écran pour les adultes ?", pour:"Santé mentale, qualité de sommeil, productivité.", contre:"Liberté individuelle, usage professionnel, définition floue." },
  { sujet:"L'intelligence artificielle est-elle une menace pour l'emploi ?", pour:"Automatisation de millions de postes, inégalités accrues, dépendance technologique.", contre:"Création de nouveaux métiers, augmentation de la productivité, libération des tâches répétitives." },
  { sujet:"Le sport devrait-il être gratuit et accessible à tous ?", pour:"Santé publique, cohésion sociale, égalité des chances.", contre:"Coût pour l'État, risque de dévaluation, infrastructure limitée." },
];

const DILEMMES = [
  { title:"Le Tramway (Trolley Problem)", desc:"Un tramway fou fonce sur 5 personnes. Vous pouvez dévier le rail vers 1 personne. Le faites-vous ?\n\n**Côté utilitariste :** 5 vies > 1 vie, dévier est logique.\n**Côté déontologique :** Agir pour tuer activement une personne est moralement différent de laisser faire." },
  { title:"L'île déserte — 3 objets", desc:"Vous êtes bloqué(e) sur une île déserte. Vous ne pouvez prendre que **3 objets**. Lesquels et pourquoi ? Partagez vos choix !" },
  { title:"La machine à bonheur", desc:"Si une machine pouvait vous donner un bonheur artificiel parfait permanent, l'utiliseriez-vous ? Vous ne sauriez pas que c'est artificiel.\n\n**Pour :** Le bonheur est subjectif.\n**Contre :** Authenticité et réalité ont une valeur intrinsèque." },
  { title:"Mensonge altruiste", desc:"Mentir est-il justifié pour protéger quelqu'un ?\n\nEx: Vous savez que votre ami(e) va être blessé(e) en apprenant une vérité. La cachez-vous ?" },
  { title:"Le bateau de survie", desc:"Un bateau coule. Il y a 6 personnes mais le canot n'en supporte que 4. Parmi eux : une enfant, un médecin, une personne âgée, un criminel repenti, un scientifique, un parent seul. Qui sauvez-vous ?" },
];

const OPINIONS_CONTRAIRE = [
  ["Le café est meilleur que le thé.", "Le thé est meilleur que le café."],
  ["Les chats sont plus sympas que les chiens.", "Les chiens sont plus sympas que les chats."],
  ["L'été est la meilleure saison.", "L'hiver est la meilleure saison."],
  ["La ville est meilleure pour vivre.", "La campagne est meilleure pour vivre."],
  ["Les films sont meilleurs que les séries.", "Les séries sont meilleures que les films."],
  ["Travailler tôt le matin est plus productif.", "Travailler tard le soir est plus productif."],
  ["La lecture vaut mieux que les jeux vidéo.", "Les jeux vidéo apportent autant que la lecture."],
];

const commands = [
  {
    name: 'debat',
    aliases: ['debate', 'sujet_debat', 'discussion'],
    description: 'Sujet de débat avec arguments pour/contre',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      const s = SUJETS_DEBAT[Math.floor(Math.random() * SUJETS_DEBAT.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle(`⚡ Débat : ${s.sujet}`)
        .addFields(
          { name: '✅ Arguments POUR', value: s.pour, inline: false },
          { name: '❌ Arguments CONTRE', value: s.contre, inline: false },
        )
        .setFooter({ text: 'Et vous, quel est votre avis ?' })] });
    }
  },
  {
    name: 'dilemme',
    aliases: ['dilemma', 'choix_difficile', 'philosophie'],
    description: 'Dilemme philosophique ou moral',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      const d = DILEMMES[Math.floor(Math.random() * DILEMMES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#8E44AD')
        .setTitle(`🤔 Dilemme : ${d.title}`)
        .setDescription(d.desc)] });
    }
  },
  {
    name: 'pour_contre',
    aliases: ['pourcontre', 'pros_cons'],
    description: 'Arguments pour/contre sur un sujet donné',
    category: 'Débat',
    cooldown: 5,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!pour_contre <sujet>`');
      const sujet = args.join(' ');
      const s = SUJETS_DEBAT[Math.floor(Math.random() * SUJETS_DEBAT.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`💭 Sujet : "${sujet}"`)
        .setDescription('*Arguments générés automatiquement (aléatoires — adaptez selon le contexte !)*')
        .addFields(
          { name: '✅ POUR', value: s.pour, inline: false },
          { name: '❌ CONTRE', value: s.contre, inline: false },
        )] });
    }
  },
  {
    name: 'camp',
    aliases: ['equipes', 'team_debate', 'debat_camp'],
    description: 'Diviser aléatoirement en équipes de débat',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      const mentions = message.mentions.users;
      if (mentions.size < 2) return message.reply('❌ Mentionnez au moins 2 personnes : `n!camp @user1 @user2 @user3...`');
      const members = [...mentions.values()];
      const shuffled = members.sort(() => Math.random() - 0.5);
      const mid = Math.ceil(shuffled.length / 2);
      const team1 = shuffled.slice(0, mid).map(u => u.username).join(', ');
      const team2 = shuffled.slice(mid).map(u => u.username).join(', ');
      const [opinion] = OPINIONS_CONTRAIRE[Math.floor(Math.random() * OPINIONS_CONTRAIRE.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🎯 Débat organisé !')
        .setDescription(`Sujet suggéré : *"${opinion}"*`)
        .addFields(
          { name: '🔵 Équipe POUR', value: team1, inline: true },
          { name: '🔴 Équipe CONTRE', value: team2, inline: true },
        )] });
    }
  },
  {
    name: 'opinion',
    aliases: ['avis', 'ton_avis', 'votre_avis'],
    description: 'Question d\'opinion à soumettre au serveur',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!opinion <question>`');
      const question = args.join(' ');
      const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('🗣️ Question posée au serveur')
        .setDescription(`**${question}**`)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setFooter({ text: 'Réagissez avec 👍 ou 👎 pour voter !' })] });
      await msg.react('👍');
      await msg.react('👎');
    }
  },
  {
    name: 'citer_faux',
    aliases: ['fausse_citation', 'attribuer'],
    description: 'Générer une pseudo citation absurde',
    category: 'Débat',
    cooldown: 5,
    async run(message, args) {
      const PERSOS = ['Napoléon','Albert Einstein','Socrate','Marie Curie','Darwin','Tesla','Nietzsche','Descartes'];
      const TEXTES = [
        "La pizza sans fromage est un rectangle sans angles.",
        "J'ai réfléchi longtemps, et j'en conclus que j'avais tort d'avoir raison.",
        "Le futur appartient à ceux qui mettent leur téléphone en charge avant de dormir.",
        "Pour comprendre le monde, commence par ton Wi-Fi.",
        "Ce n'est pas parce qu'on a beaucoup de réponses qu'on pose les bonnes questions.",
        "L'important n'est pas la destination, mais les piles du GPS.",
        "Deux choses sont infinies : l'univers et la liste des courses.",
      ];
      const perso = PERSOS[Math.floor(Math.random() * PERSOS.length)];
      const texte = TEXTES[Math.floor(Math.random() * TEXTES.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setDescription(`*"${texte}"*\n\n— **${perso}** *(probablement pas)*`)
        .setFooter({ text: '⚠️ Citation fictive et humoristique !' })] });
    }
  },
  {
    name: 'sondage_rapide',
    aliases: ['quickpoll', 'vote_vite'],
    description: 'Sondage rapide oui/non',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Usage : `n!sondage_rapide <question>`');
      const question = args.join(' ');
      const msg = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle('📊 Sondage rapide')
        .setDescription(`**${question}**`)
        .addFields(
          { name: '✅ Oui', value: 'Réagissez avec ✅', inline: true },
          { name: '❌ Non', value: 'Réagissez avec ❌', inline: true },
        )
        .setFooter({ text: `Sondage lancé par ${message.author.username}` })] });
      await msg.react('✅');
      await msg.react('❌');
    }
  },
  {
    name: 'classement_opinion',
    aliases: ['rank_opinion', 'palmarès'],
    description: 'Classer des options en ordre de préférence',
    category: 'Débat',
    cooldown: 10,
    async run(message, args) {
      if (args.length < 2) return message.reply('❌ Usage : `n!classement_opinion item1 item2 item3...`');
      const shuffled = [...args].sort(() => Math.random() - 0.5);
      const ranked = shuffled.map((item, i) => `**${i+1}.** ${item}`).join('\n');
      return message.reply({ embeds: [new EmbedBuilder().setColor('#F39C12')
        .setTitle('🏆 Classement aléatoire (pour lancer le débat !)')
        .setDescription(ranked)
        .setFooter({ text: 'Ordre aléatoire — dites ce que vous en pensez !' })] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
