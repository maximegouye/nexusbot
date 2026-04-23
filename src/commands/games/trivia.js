const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, Colors } = require('discord.js');
const db = require('../../database/db');

const QUESTIONS = [
  // Histoire
  { q: "Quelle est la capitale de la France?", choices: ["Paris", "Lyon", "Marseille", "Bordeaux"], answer: 0, category: "histoire", difficulty: "facile", reward: 50 },
  { q: "En quelle année l'homme a-t-il marché sur la lune?", choices: ["1969", "1971", "1965", "1972"], answer: 0, category: "histoire", difficulty: "facile", reward: 50 },
  { q: "Qui était le premier président des États-Unis?", choices: ["George Washington", "Thomas Jefferson", "Benjamin Franklin", "John Adams"], answer: 0, category: "histoire", difficulty: "facile", reward: 50 },
  { q: "En quelle année la Bastille a-t-elle été prise?", choices: ["1789", "1793", "1799", "1776"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },
  { q: "Quel empire a construit la Grande Muraille de Chine?", choices: ["Dynastie Ming", "Dynastie Han", "Dynastie Tang", "Dynastie Song"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },
  { q: "Quel roi a signé la Magna Carta?", choices: ["Jean sans Terre", "Henri III", "Richard Cœur de Lion", "Édouard Ier"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },
  { q: "Qui a découvert l'Amérique?", choices: ["Christophe Colomb", "Léif Erikson", "Marco Polo", "Vasco de Gama"], answer: 0, category: "histoire", difficulty: "facile", reward: 50 },
  { q: "En quelle année Napoléon est-il mort?", choices: ["1821", "1815", "1825", "1812"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },
  { q: "Qui était le Premier ministre pendant la Seconde Guerre mondiale en Grande-Bretagne?", choices: ["Winston Churchill", "Clement Attlee", "Stanley Baldwin", "Neville Chamberlain"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },
  { q: "Quel philosophe grec a établi l'Académie?", choices: ["Platon", "Aristote", "Socrate", "Pythagore"], answer: 0, category: "histoire", difficulty: "moyen", reward: 100 },

  // Science
  { q: "Quel est le plus grand planète du système solaire?", choices: ["Jupiter", "Saturne", "Neptune", "Mars"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Combien de continents y a-t-il?", choices: ["7", "6", "8", "5"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Quel gaz compose la majorité de l'atmosphère terrestre?", choices: ["Azote", "Oxygène", "Argon", "Dioxyde de carbone"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus haut sommet du monde?", choices: ["Mont Everest", "K2", "Kangchenjunga", "Makalu"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Combien d'atomes d'hydrogène y a-t-il dans l'eau?", choices: ["2", "1", "3", "4"], answer: 0, category: "science", difficulty: "moyen", reward: 100 },
  { q: "Qui a formulé la théorie de la relativité?", choices: ["Albert Einstein", "Isaac Newton", "Galileo Galilei", "Stephen Hawking"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus grand océan du monde?", choices: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Quel élément chimique a le symbole Au?", choices: ["Or", "Argent", "Cuivre", "Fer"], answer: 0, category: "science", difficulty: "moyen", reward: 100 },
  { q: "Combien de pattes une araignée a-t-elle?", choices: ["8", "6", "10", "12"], answer: 0, category: "science", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus rapide animal terrestre?", choices: ["Guépard", "Antilope", "Autruche", "Lièvre"], answer: 0, category: "science", difficulty: "facile", reward: 50 },

  // Géographie
  { q: "Quelle est la capitale du Japon?", choices: ["Tokyo", "Kyoto", "Osaka", "Hiroshima"], answer: 0, category: "geographie", difficulty: "facile", reward: 50 },
  { q: "Quel pays a la plus grande population?", choices: ["Inde", "Chine", "États-Unis", "Indonésie"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quel est le fleuve le plus long du monde?", choices: ["Nil", "Amazone", "Yangtsé", "Mississippi"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quelle est la capitale de l'Australie?", choices: ["Canberra", "Sydney", "Melbourne", "Brisbane"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quel pays a le plus de lacs?", choices: ["Canada", "Suède", "Finlande", "Norvège"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quelle est la capitale de la Suisse?", choices: ["Berne", "Zurich", "Genève", "Bâle"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quel désert est le plus grand du monde?", choices: ["Sahara", "Arabie", "Gobi", "Kalahari"], answer: 0, category: "geographie", difficulty: "facile", reward: 50 },
  { q: "Quelle est la capitale du Brésil?", choices: ["Brasília", "Rio de Janeiro", "São Paulo", "Salvador"], answer: 0, category: "geographie", difficulty: "moyen", reward: 100 },
  { q: "Quel océan entoure la Nouvelle-Zélande?", choices: ["Pacifique", "Atlantique", "Indien", "Arctique"], answer: 0, category: "geographie", difficulty: "facile", reward: 50 },
  { q: "Combien d'états composent les États-Unis?", choices: ["50", "51", "48", "52"], answer: 0, category: "geographie", difficulty: "facile", reward: 50 },

  // Culture Pop
  { q: "Quel film a remporté l'Oscar du meilleur film en 2023?", choices: ["Tout partout à la fois", "Top Gun Maverick", "Avatar 2", "Glass Onion"], answer: 0, category: "culture-pop", difficulty: "moyen", reward: 100 },
  { q: "Qui joue Iron Man dans l'univers cinématique Marvel?", choices: ["Robert Downey Jr.", "Chris Evans", "Chris Hemsworth", "Mark Ruffalo"], answer: 0, category: "culture-pop", difficulty: "facile", reward: 50 },
  { q: "Dans quelle année le premier iPhone a-t-il été lancé?", choices: ["2007", "2005", "2009", "2008"], answer: 0, category: "culture-pop", difficulty: "facile", reward: 50 },
  { q: "Quel groupe a produit l'album 'Thriller'?", choices: ["Michael Jackson", "The Beatles", "Pink Floyd", "Queen"], answer: 0, category: "culture-pop", difficulty: "facile", reward: 50 },
  { q: "Quel série Netflix a remporté le plus de Emmys?", choices: ["The Crown", "Stranger Things", "Bridgerton", "Wednesday"], answer: 0, category: "culture-pop", difficulty: "moyen", reward: 100 },
  { q: "Qui est le créateur de Star Wars?", choices: ["George Lucas", "Steven Spielberg", "James Cameron", "Peter Jackson"], answer: 0, category: "culture-pop", difficulty: "facile", reward: 50 },
  { q: "En quelle année Game of Thrones a-t-elle commencé?", choices: ["2011", "2010", "2009", "2012"], answer: 0, category: "culture-pop", difficulty: "moyen", reward: 100 },
  { q: "Quel artiste a le plus de streams sur Spotify?", choices: ["Taylor Swift", "The Weeknd", "Bad Bunny", "Drake"], answer: 0, category: "culture-pop", difficulty: "moyen", reward: 100 },
  { q: "Quel est le film d'animation le plus regardé de tous les temps?", choices: ["Le Roi Lion", "La Reine des Neiges", "Toy Story", "Vaiana"], answer: 0, category: "culture-pop", difficulty: "moyen", reward: 100 },
  { q: "Quelle plateforme a créé Prime Video?", choices: ["Amazon", "Netflix", "Microsoft", "Google"], answer: 0, category: "culture-pop", difficulty: "facile", reward: 50 },

  // Sport
  { q: "Combien de fois Lionel Messi a-t-il remporté le Ballon d'Or?", choices: ["8", "7", "6", "9"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "Quel équipe a remporté la Ligue des Champions 2023?", choices: ["Manchester City", "Real Madrid", "Barcelona", "Bayern Munich"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "En quelle année Michael Jordan a-t-il pris sa retraite pour la première fois?", choices: ["1993", "1991", "1995", "1998"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "Quel pays a remporté la Coupe du Monde 2022?", choices: ["Argentine", "France", "Brésil", "Allemagne"], answer: 0, category: "sport", difficulty: "facile", reward: 50 },
  { q: "Combien de Grand Chelem Roger Federer a-t-il remporté?", choices: ["20", "18", "19", "21"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "Quel sport se joue sur un terrain de 26 mètres par 17 mètres?", choices: ["Badminton", "Tennis", "Handball", "Volleyball"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "En quelle année le Tour de France a-t-il commencé?", choices: ["1903", "1900", "1905", "1910"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "Combien de coureurs composent une équipe de cyclisme au Tour de France?", choices: ["9", "8", "10", "7"], answer: 0, category: "sport", difficulty: "facile", reward: 50 },
  { q: "Quel athlète a remporté 28 médailles olympiques?", choices: ["Michael Phelps", "Nadia Comaneci", "Carl Lewis", "Larisa Latynina"], answer: 0, category: "sport", difficulty: "moyen", reward: 100 },
  { q: "Quel pays a remporté le plus de Coupes du Monde en football?", choices: ["Brésil", "Allemagne", "Italie", "France"], answer: 0, category: "sport", difficulty: "facile", reward: 50 },

  // Divers
  { q: "Quel est le plus grand château du monde?", choices: ["Château de Wawel", "Château de Prague", "Château de Versailles", "Tour Eiffel"], answer: 0, category: "divers", difficulty: "moyen", reward: 100 },
  { q: "Combien de côtés a un hexagone?", choices: ["6", "5", "7", "8"], answer: 0, category: "divers", difficulty: "facile", reward: 50 },
  { q: "Quel est l'aliment le plus consommé au monde?", choices: ["Riz", "Maïs", "Blé", "Pommes de terre"], answer: 0, category: "divers", difficulty: "moyen", reward: 100 },
  { q: "Combien de cordes a une guitare classique?", choices: ["6", "7", "5", "8"], answer: 0, category: "divers", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus ancien musée du monde?", choices: ["Musée d'Alexandrie", "Musée du Louvre", "Musée Britannique", "Musée du Vatican"], answer: 0, category: "divers", difficulty: "moyen", reward: 100 },
  { q: "Combien de joueurs composent une équipe de basketball?", choices: ["5", "6", "4", "7"], answer: 0, category: "divers", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus haut bâtiment du monde?", choices: ["Burj Khalifa", "Merdeka 118", "Shanghai Tower", "Abraj Al-Bait Clock Tower"], answer: 0, category: "divers", difficulty: "facile", reward: 50 },
  { q: "Combien de dents un adulte humain a-t-il normalement?", choices: ["32", "30", "28", "34"], answer: 0, category: "divers", difficulty: "facile", reward: 50 },
  { q: "Quel est le plus grand lac du monde?", choices: ["Caspienne", "Supérieur", "Victoria", "Aral"], answer: 0, category: "divers", difficulty: "moyen", reward: 100 },
  { q: "Combien de continents touchent l'Océan Atlantique?", choices: ["4", "3", "5", "6"], answer: 0, category: "divers", difficulty: "moyen", reward: 100 },
];

const CATEGORIES = ['histoire', 'science', 'geographie', 'culture-pop', 'sport', 'divers'];
const CATEGORY_EMOJI = {
  'histoire': '📚',
  'science': '🔬',
  'geographie': '🌍',
  'culture-pop': '🎬',
  'sport': '⚽',
  'divers': '🎲'
};

// Initialize database tables
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS trivia_stats (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Questions de trivia amusantes!')
    .addSubcommand(sub =>
      sub.setName('jouer')
        .setDescription('Joue une question de trivia')
        .addStringOption(opt =>
          opt.setName('categorie')
            .setDescription('Catégorie (optionnel)')
            .setChoices(
              { name: '📚 Histoire', value: 'histoire' },
              { name: '🔬 Science', value: 'science' },
              { name: '🌍 Géographie', value: 'geographie' },
              { name: '🎬 Culture Pop', value: 'culture-pop' },
              { name: '⚽ Sport', value: 'sport' },
              { name: '🎲 Divers', value: 'divers' },
              { name: '🎪 Aléatoire', value: 'random' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('categories')
        .setDescription('Voir toutes les catégories disponibles')
    )
    .addSubcommand(sub =>
      sub.setName('score')
        .setDescription('Voir tes statistiques de trivia')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('Utilisateur (optionnel)')
        )
    )
    .addSubcommand(sub =>
      sub.setName('classement')
        .setDescription('Voir le classement des meilleurs joueurs')
    ),
  cooldown: 2,
  execute: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'jouer') {
      const categoryInput = interaction.options.getString('categorie') || 'random';
      let category;

      if (categoryInput === 'random') {
        category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      } else {
        category = categoryInput;
      }

      const categoryQuestions = QUESTIONS.filter(q => q.category === category);
      const question = categoryQuestions[Math.floor(Math.random() * categoryQuestions.length)];
      const questionIndex = QUESTIONS.indexOf(question);

      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`trivia_answer_A_${questionIndex}`)
            .setLabel('A')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`trivia_answer_B_${questionIndex}`)
            .setLabel('B')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`trivia_answer_C_${questionIndex}`)
            .setLabel('C')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`trivia_answer_D_${questionIndex}`)
            .setLabel('D')
            .setStyle(ButtonStyle.Primary)
        );

      const difficultyEmoji = question.difficulty === 'facile' ? '🟢' : question.difficulty === 'moyen' ? '🟡' : '🔴';

      const embed = new EmbedBuilder()
        .setTitle(`${CATEGORY_EMOJI[category]} ${question.q}`)
        .addFields(
          { name: 'A️⃣', value: question.choices[0], inline: true },
          { name: 'B️⃣', value: question.choices[1], inline: true },
          { name: '', value: '' },
          { name: 'C️⃣', value: question.choices[2], inline: true },
          { name: 'D️⃣', value: question.choices[3], inline: true },
          { name: '', value: '' },
          { name: 'Difficulté', value: `${difficultyEmoji} ${question.difficulty}`, inline: true },
          { name: 'Récompense', value: `💰 ${question.reward} coins`, inline: true }
        )
        .setColor(Colors.Blue)
        .setFooter({ text: 'Tu as 20 secondes pour répondre!' });

      const msg = await interaction.editReply({ embeds: [embed], components: [buttons], fetchReply: true });

      const collector = msg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 20000
      });

      collector.on('collect', async (buttonInteraction) => {
        const [_, answer, index] = buttonInteraction.customId.split('_');
        const answerIndex = answer.charCodeAt(0) - 65;
        const correctIndex = QUESTIONS[parseInt(index)].answer;

        let result = '';
        let coins = 0;
        let color = Colors.Red;

        if (answerIndex === correctIndex) {
          result = '✅ Bonne réponse!';
          coins = QUESTIONS[parseInt(index)].reward;
          color = Colors.Green;
        } else {
          result = `❌ Mauvaise réponse! La bonne réponse était ${String.fromCharCode(65 + correctIndex)}`;
          coins = 0;
        }

        // Update stats
        try {
          const existing = db.db.prepare('SELECT * FROM trivia_stats WHERE user_id = ? AND guild_id = ?').get(
            interaction.user.id,
            interaction.guildId
          );

          if (existing) {
            db.db.prepare(
              'UPDATE trivia_stats SET total = total + 1, correct = correct + ?, coins_earned = coins_earned + ? WHERE user_id = ? AND guild_id = ?'
            ).run(
              answerIndex === correctIndex ? 1 : 0,
              coins,
              interaction.user.id,
              interaction.guildId
            );
          } else {
            db.db.prepare(
              'INSERT INTO trivia_stats (user_id, guild_id, total, correct, coins_earned) VALUES (?, ?, ?, ?, ?)'
            ).run(
              interaction.user.id,
              interaction.guildId,
              1,
              answerIndex === correctIndex ? 1 : 0,
              coins
            );
          }
        } catch (error) {
          console.error('Error updating trivia stats:', error);
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', ephemeral: true }).catch(() => {});
          } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
            interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
          }
        }

        const resultEmbed = new EmbedBuilder()
          .setTitle(result)
          .addFields(
            { name: 'Réponse correcte', value: String.fromCharCode(65 + correctIndex) + ': ' + QUESTIONS[parseInt(index)].choices[correctIndex], inline: false },
            { name: '💰 Coins gagnés', value: `💰 ${coins}`, inline: true }
          )
          .setColor(color);

        await buttonInteraction.reply({ embeds: [resultEmbed], ephemeral: true });
        collector.stop();
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setTitle('⏰ Temps écoulé!')
            .setDescription(`La bonne réponse était **${String.fromCharCode(65 + QUESTIONS[questionIndex].answer)}**: ${QUESTIONS[questionIndex].choices[QUESTIONS[questionIndex].answer]}`)
            .setColor(Colors.Red);

          msg.reply({ embeds: [timeoutEmbed] });
        }
        msg.edit({ components: [] });
      });
    }

    if (subcommand === 'categories') {
      const categoryList = CATEGORIES.map(cat => `${CATEGORY_EMOJI[cat]} **${cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ')}** - ${QUESTIONS.filter(q => q.category === cat).length} questions`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle('📖 Catégories de Trivia')
        .setDescription(categoryList)
        .setColor(Colors.Purple)
        .setFooter({ text: 'Utilise /trivia jouer <categorie> pour jouer!' });
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'score') {
      const user = interaction.options.getUser('user') || interaction.user;

      try {
        const stats = db.db.prepare('SELECT * FROM trivia_stats WHERE user_id = ? AND guild_id = ?').get(user.id, interaction.guildId);

        if (!stats) {
          const embed = new EmbedBuilder()
            .setTitle('📊 Statistiques de Trivia')
            .setDescription(`${user.username} n'a pas encore joué!`)
            .setColor(Colors.Greyple);
          return interaction.editReply({ embeds: [embed] });
        }

        const percentage = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : 0;
        const embed = new EmbedBuilder()
          .setTitle('📊 Statistiques de Trivia')
          .setDescription(`Statistiques pour **${user.username}**`)
          .addFields(
            { name: 'Questions répondues', value: `${stats.total}`, inline: true },
            { name: 'Bonnes réponses', value: `${stats.correct}`, inline: true },
            { name: 'Pourcentage de réussite', value: `${percentage}%`, inline: true },
            { name: '💰 Coins gagnés', value: `💰 ${stats.coins_earned}`, inline: true }
          )
          .setColor(Colors.Gold)
          .setThumbnail(user.displayAvatarURL());

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error fetching trivia stats:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la récupération des statistiques.', ephemeral: true });
      }
    }

    if (subcommand === 'classement') {
      try {
        const topPlayers = db.db.prepare(
          'SELECT user_id, correct, total, coins_earned FROM trivia_stats WHERE guild_id = ? ORDER BY coins_earned DESC LIMIT 10'
        ).all(interaction.guildId);

        if (topPlayers.length === 0) {
          const embed = new EmbedBuilder()
            .setTitle('🏆 Classement Trivia')
            .setDescription('Aucun joueur n\'a encore participé au trivia sur ce serveur!')
            .setColor(Colors.Greyple);
          return interaction.editReply({ embeds: [embed] });
        }

        let leaderboardText = '';
        for (let i = 0; i < topPlayers.length; i++) {
          const player = topPlayers[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
          const percentage = ((player.correct / player.total) * 100).toFixed(1);
          leaderboardText += `${medal} <@${player.user_id}> - 💰 ${player.coins_earned} coins | ${percentage}% (${player.correct}/${player.total})\n`;
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Classement Trivia du Serveur')
          .setDescription(leaderboardText)
          .setColor(Colors.Gold)
          .setFooter({ text: 'Basé sur les coins gagnés au trivia!' });

        return interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return interaction.editReply({ content: '❌ Erreur lors de la récupération du classement.', ephemeral: true });
      }
    }
  }
};
