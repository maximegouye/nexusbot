/**
 * NexusBot — Worker pour les événements automatiques
 *
 * Poste automatiquement:
 * - Quiz quotidien à 12h00 (30 questions hard-codées)
 * - Défi hebdomadaire chaque lundi à 9h00
 *
 * Les réponses du quiz sont stockées en mémoire dans activeQuizzes.
 * Les boutons quiz sont traités dans interactionCreate.js avec handleQuizButton().
 *
 * Appelé depuis src/index.js au démarrage avec `startAutoEvents(client)`.
 */

const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../database/db');

// Map pour tracer les quiz actifs: messageId => { guildId, questionIndex, correctAnswer, winner: userId | null, startedAt }
const activeQuizzes = new Map();

// Questions de quiz hard-codées (30+ questions variées en français)
const QUIZ_QUESTIONS = [
  // Histoire
  { q: 'Quelle est la capitale de l\'Australie ?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], answer: 2 },
  { q: 'En quelle année a eu lieu la Révolution française ?', choices: ['1776', '1789', '1804', '1815'], answer: 1 },
  { q: 'Qui a peint la Joconde ?', choices: ['Michel-Ange', 'Léonard de Vinci', 'Raphaël', 'Botticelli'], answer: 1 },
  { q: 'En quelle année l\'homme a-t-il marché sur la lune ?', choices: ['1962', '1965', '1969', '1972'], answer: 2 },
  { q: 'Quel était le premier empire romain ?', choices: ['République romaine', 'Empire romain d\'Occident', 'Empire romain d\'Orient', 'République française'], answer: 1 },

  // Science
  { q: 'Combien de planètes y a-t-il dans notre système solaire ?', choices: ['8', '9', '10', '11'], answer: 0 },
  { q: 'Quel élément a le symbole chimique Fe ?', choices: ['Fluor', 'Fer', 'Francium', 'Phosphore'], answer: 1 },
  { q: 'Quelle est la plus grande planète de notre système solaire ?', choices: ['Saturne', 'Jupiter', 'Uranus', 'Neptune'], answer: 1 },
  { q: 'Combien de côtés a un hexagone ?', choices: ['5', '6', '7', '8'], answer: 1 },
  { q: 'Quel scientifique a découvert la pénicilline ?', choices: ['Marie Curie', 'Albert Einstein', 'Alexander Fleming', 'Isaac Newton'], answer: 2 },

  // Géographie
  { q: 'Quelle est la capitale de la Suisse ?', choices: ['Zurich', 'Genève', 'Berne', 'Lausanne'], answer: 2 },
  { q: 'Quel est le fleuve le plus long du monde ?', choices: ['Amazone', 'Nil', 'Yangtse', 'Mississippi'], answer: 1 },
  { q: 'Combien de pays y a-t-il en Europe ?', choices: ['40', '44', '50', '54'], answer: 1 },
  { q: 'Quelle est la plus haute montagne du monde ?', choices: ['K2', 'Mont-Blanc', 'Everest', 'Kilimandjaro'], answer: 2 },
  { q: 'Quel est le plus grand désert du monde ?', choices: ['Gobi', 'Sahara', 'Kalahari', 'Atacama'], answer: 1 },

  // Cinéma & Pop Culture
  { q: 'En quelle année le film Titanic est-il sorti ?', choices: ['1995', '1997', '1999', '2001'], answer: 1 },
  { q: 'Quel acteur joue Batman dans les films The Dark Knight ?', choices: ['Val Kilmer', 'George Clooney', 'Christian Bale', 'Ben Affleck'], answer: 2 },
  { q: 'Quel est le personnage principal de Harry Potter ?', choices: ['Ron Weasley', 'Harry Potter', 'Hermione Granger', 'Dumbledore'], answer: 1 },
  { q: 'Combien de films Avengers y a-t-il actuellement ?', choices: ['3', '4', '5', '6'], answer: 1 },
  { q: 'Quel est le symbole du Seigneur des Anneaux ?', choices: ['L\'Épée Excalibur', 'L\'Anneau Unique', 'La Couronne d\'Aragorn', 'Le Bâton de Gandalf'], answer: 1 },

  // Musique
  { q: 'En quelle année The Beatles se sont-ils formés ?', choices: ['1958', '1960', '1962', '1964'], answer: 1 },
  { q: 'Quel musicien a composé La Symphonie Fantastique ?', choices: ['Beethoven', 'Mozart', 'Hector Berlioz', 'Wagner'], answer: 2 },
  { q: 'Quel artiste a créé "Bohemian Rhapsody" ?', choices: ['Pink Floyd', 'Queen', 'The Who', 'Led Zeppelin'], answer: 1 },
  { q: 'Combien de cordes a une guitare classique ?', choices: ['5', '6', '7', '8'], answer: 1 },
  { q: 'Quel est le plus grand festival de musique en France ?', choices: ['Rock en Seine', 'Solidays', 'Déferlantes', 'Hellfest'], answer: 0 },

  // Sports
  { q: 'Combien de joueurs y a-t-il dans une équipe de football sur le terrain ?', choices: ['9', '10', '11', '12'], answer: 2 },
  { q: 'En quelle année les Jeux Olympiques de 2024 ont-ils eu lieu ?', choices: ['2022', '2023', '2024', '2025'], answer: 2 },
  { q: 'Quel sport utilise un filet et une balle avec des petits trous ?', choices: ['Tennis', 'Badminton', 'Golf', 'Squash'], answer: 2 },
  { q: 'Combien de manche au maximum y a-t-il en tennis (Grand Slam) ?', choices: ['2', '3', '4', '5'], answer: 1 },
  { q: 'Quel est le plus grand stade de football français ?', choices: ['Parc des Princes', 'Stade Vélodrome', 'Stade de France', 'Matmut Atlantique'], answer: 2 },
];

let lastQuizDate = -1; // Pour tracker si on a déjà posté le quiz aujourd'hui
let lastChallengeWeek = -1; // Pour tracker la semaine du dernier défi

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function checkAndPostEvents(client) {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const dayOfWeek = now.getDay();
  const currentDate = now.getDate();
  const currentWeek = getWeekNumber(now);

  // ============= QUIZ QUOTIDIEN (12h00) =============
  if (hour === 12 && minutes === 0 && lastQuizDate !== currentDate) {
    lastQuizDate = currentDate;
    await postDailyQuiz(client);
  }

  // ============= DÉFI HEBDOMADAIRE (Lundi 9h00) =============
  if (dayOfWeek === 1 && hour === 9 && minutes === 0 && lastChallengeWeek !== currentWeek) {
    lastChallengeWeek = currentWeek;
    await postWeeklyChallenge(client);
  }
}

async function postDailyQuiz(client) {
  // Choisir une question aléatoire
  const questionIndex = Math.floor(Math.random() * QUIZ_QUESTIONS.length);
  const question = QUIZ_QUESTIONS[questionIndex];

  // Récupérer tous les guilds avec un canal général configuré
  let guilds = [];
  try {
    guilds = db.db.prepare(`
      SELECT guild_id, general_channel FROM guild_config
      WHERE general_channel IS NOT NULL AND general_channel != ''
    `).all();

    // Fallback: utiliser welcome_channel
    if (guilds.length === 0) {
      guilds = db.db.prepare(`
        SELECT guild_id, welcome_channel as general_channel FROM guild_config
        WHERE welcome_channel IS NOT NULL AND welcome_channel != ''
      `).all();
    }
  } catch (err) {
    console.error('[AutoEvent] Erreur lecture config pour quiz:', err.message);
    return;
  }

  for (const cfg of guilds) {
    try {
      const guild = client.guilds.cache.get(cfg.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.general_channel);
      if (!channel || !channel.isTextBased()) continue;

      // Créer les boutons
      const buttons = question.choices.map((choice, idx) => {
        return new ButtonBuilder()
          .setCustomId(`quiz_event_${String.fromCharCode(65 + idx)}_${cfg.guild_id}_${questionIndex}`)
          .setLabel(`${String.fromCharCode(65 + idx)}) ${choice}`)
          .setStyle(ButtonStyle.Primary);
      });

      const row = new ActionRowBuilder().addComponents(buttons);

      const embed = new EmbedBuilder()
        .setColor(0x3498db) // Bleu
        .setTitle('🎯 Quiz Quotidien')
        .setDescription(question.q)
        .setFooter({ text: 'Réponds en moins de 10 minutes pour gagner 500€ !' })
        .setTimestamp();

      const msg = await channel.send({
        embeds: [embed],
        components: [row]
      }).catch(err => {
        console.error(`[AutoEvent] Erreur envoi quiz pour ${cfg.guild_id}:`, err.message);
        return null;
      });

      if (msg) {
        // Enregistrer le quiz actif
        activeQuizzes.set(msg.id, {
          guildId: cfg.guild_id,
          questionIndex,
          correctAnswer: question.answer,
          winner: null,
          startedAt: Date.now()
        });

        // Désactiver les boutons après 10 minutes et supprimer l'entrée
        setTimeout(() => {
          activeQuizzes.delete(msg.id);
        }, 600_000); // 10 minutes
      }

    } catch (err) {
      console.error(`[AutoEvent] Erreur traitement quiz pour guild:`, err.message);
    }
  }
}

async function postWeeklyChallenge(client) {
  // Récupérer tous les guilds
  let guilds = [];
  try {
    guilds = db.db.prepare(`
      SELECT guild_id, general_channel FROM guild_config
      WHERE general_channel IS NOT NULL AND general_channel != ''
    `).all();

    if (guilds.length === 0) {
      guilds = db.db.prepare(`
        SELECT guild_id, welcome_channel as general_channel FROM guild_config
        WHERE welcome_channel IS NOT NULL AND welcome_channel != ''
      `).all();
    }
  } catch (err) {
    console.error('[AutoEvent] Erreur lecture config pour défi:', err.message);
    return;
  }

  for (const cfg of guilds) {
    try {
      const guild = client.guilds.cache.get(cfg.guild_id);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.general_channel);
      if (!channel || !channel.isTextBased()) continue;

      // Récupérer le top 5 actuel
      const topUsers = db.db.prepare(`
        SELECT user_id, (balance + bank) as total
        FROM users
        WHERE guild_id = ?
        ORDER BY total DESC
        LIMIT 5
      `).all(cfg.guild_id);

      let topField = topUsers.length > 0
        ? topUsers.map((u, i) => `#${i + 1} <@${u.user_id}> — ${u.total}€`).join('\n')
        : 'Aucune donnée';

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71) // Vert
        .setTitle('💰 Défi Hebdomadaire')
        .setDescription('Cette semaine, qui finira avec le plus d\'€ ? 🏆')
        .addFields(
          { name: 'Top 5 Actuel', value: topField || 'Aucune donnée', inline: false }
        )
        .setFooter({ text: 'Bonne chance à tous !' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(err => {
        console.error(`[AutoEvent] Erreur envoi défi pour ${cfg.guild_id}:`, err.message);
      });

    } catch (err) {
      console.error(`[AutoEvent] Erreur traitement défi pour guild:`, err.message);
    }
  }
}

async function handleQuizButton(interaction) {
  // interaction.customId format: quiz_event_A_guildId_questionIndex
  const parts = interaction.customId.split('_');
  if (parts.length < 5) return;

  const answerLetter = parts[2]; // A, B, C, D
  const guildId = parts[3];
  const questionIndexStr = parts.slice(4).join('_'); // Au cas où il y a des underscores
  const questionIndex = parseInt(questionIndexStr, 10);

  const msgId = interaction.message.id;
  const quiz = activeQuizzes.get(msgId);

  if (!quiz) {
    return interaction.reply({
      content: 'Ce quiz a expiré ou n\'existe plus.',
      ephemeral: true
    }).catch(() => {});
  }

  if (quiz.guildId !== guildId) {
    return interaction.reply({
      content: 'Ce quiz n\'appartient pas à votre serveur.',
      ephemeral: true
    }).catch(() => {});
  }

  // Convertir la lettre en index (A=0, B=1, C=2, D=3)
  const answerIndex = answerLetter.charCodeAt(0) - 65;

  // Vérifier la réponse
  const isCorrect = answerIndex === quiz.correctAnswer;

  if (isCorrect && !quiz.winner) {
    // C'est le premier à répondre correctement
    quiz.winner = interaction.user.id;

    // Donner 500€
    const guildObj = interaction.guild;
    if (guildObj) {
      db.addCoins(interaction.user.id, guildObj.id, 500);
    }

    await interaction.reply({
      content: `🎉 Bravo <@${interaction.user.id}> ! Vous avez remporté le quiz et gagné **500€** !`,
      ephemeral: false
    }).catch(() => {});
  } else if (isCorrect && quiz.winner && quiz.winner === interaction.user.id) {
    return interaction.reply({
      content: 'Vous avez déjà répondu correctement !',
      ephemeral: true
    }).catch(() => {});
  } else if (isCorrect && quiz.winner) {
    return interaction.reply({
      content: 'Quelqu\'un d\'autre a déjà trouvé la bonne réponse !',
      ephemeral: true
    }).catch(() => {});
  } else {
    // Mauvaise réponse
    return interaction.reply({
      content: '❌ Mauvaise réponse, réessaye !',
      ephemeral: true
    }).catch(() => {});
  }
}

function startAutoEvents(client) {
  // Vérifier toutes les 60 secondes
  setInterval(() => {
    checkAndPostEvents(client).catch(err => {
      console.error('[AutoEvent] Erreur principale:', err.message);
    });
  }, 60_000);

  console.log('[AutoEvent] démarré (vérification toutes les 60 s pour quiz 12h et défi lundi 9h).');
}

module.exports = { startAutoEvents, handleQuizButton, activeQuizzes };
