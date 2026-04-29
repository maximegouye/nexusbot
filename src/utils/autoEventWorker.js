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

let lastQuizSlot = -1;     // Slot 4h (0-5) du dernier quiz posté aujourd'hui
let lastQuizDate  = -1;    // Date du dernier slot
let lastChallengeWeek = -1; // Semaine du dernier défi
let lastMiniDate  = -1;    // Date du dernier mini-event
let lastMiniSlot  = -1;    // Slot 2h (0-11) du dernier mini-event

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

  // ============= QUIZ TOUTES LES 4H (8h, 12h, 16h, 20h, 0h, 4h) =============
  // 6 quiz par jour pour garder le serveur actif
  const quizSlot = Math.floor(hour / 4); // 0..5
  const quizSlotHour = quizSlot * 4;
  if (hour === quizSlotHour && minutes === 0 && (lastQuizDate !== currentDate || lastQuizSlot !== quizSlot)) {
    lastQuizDate = currentDate;
    lastQuizSlot = quizSlot;
    await postDailyQuiz(client);
  }

  // ============= MINI-EVENT TOUTES LES 2H (heures impaires + paires alternantes) =============
  // 12 par jour : 1h, 3h, 5h, 7h, 9h, 11h, 13h, 15h, 17h, 19h, 21h, 23h
  if (hour % 2 === 1 && minutes === 0 && (lastMiniDate !== currentDate || lastMiniSlot !== hour)) {
    lastMiniDate = currentDate;
    lastMiniSlot = hour;
    await postMiniEvent(client);
  }

  // ============= DÉFI HEBDOMADAIRE (Lundi 9h00) =============
  if (dayOfWeek === 1 && hour === 9 && minutes === 0 && lastChallengeWeek !== currentWeek) {
    lastChallengeWeek = currentWeek;
    await postWeeklyChallenge(client);
  }
}

// ─── Mini-events : devinettes / faits / défis rapides ──────
const MINI_EVENTS = [
  { type: 'fact',     emoji: '💡', title: 'Le Saviez-Vous ?', text: 'Une partie de roulette \'européenne\' offre 97.3% de RTP — meilleur que l\'américaine (94.7%) ! 🎡' },
  { type: 'fact',     emoji: '💡', title: 'Astuce Casino', text: 'Joue ton `/daily` chaque jour — au bout d\'une semaine, le bonus monte à **base × 5** ! 🔥' },
  { type: 'fact',     emoji: '💡', title: 'Stratégie', text: 'Sur slots, plus tu actives de paylines, plus tu as de chances de gagner. Essaie `/slots mise:50 lignes:5` ! 🎰' },
  { type: 'fact',     emoji: '💡', title: 'Le Saviez-Vous ?', text: 'Le `/coffre-magique` a 5 niveaux : si tu vas jusqu\'au bout, tu multiplies ta mise par **×7** ! 🗝️' },
  { type: 'fact',     emoji: '💡', title: 'Stratégie', text: 'Sur la `/roue-fortune`, le segment JACKPOT donne **×50** ta mise. Mise petit pour tester ! 🎡' },
  { type: 'challenge', emoji: '🎯', title: 'Mini-défi rapide', text: 'Le premier qui gagne **+10 000€** dans les 30 prochaines minutes via `/slots` reçoit **+5 000€** bonus ! ⚡' },
  { type: 'challenge', emoji: '🎯', title: 'Mini-défi rapide', text: 'Tente ta chance sur la `/roue-fortune` — qui sera le premier à toucher le JACKPOT cette heure ? 🌟' },
  { type: 'reminder',  emoji: '⏰', title: 'Rappel quotidien', text: 'Tu n\'as pas encore fait ton `/daily` aujourd\'hui ? File chercher tes coins gratuits ! 💰' },
  { type: 'reminder',  emoji: '⏰', title: 'Bourse active', text: 'Les cryptos bougent en temps réel ! Tape `/bourse` ou `/crypto` pour voir les prix. 📈' },
  { type: 'reminder',  emoji: '⏰', title: 'Travail = Argent', text: 'Pas de coins ? Tape `/work` toutes les heures pour gagner sans risque. 💼' },
  { type: 'fact',     emoji: '💡', title: 'Top Joueurs', text: 'Tape `/leaderboard` pour voir les plus riches du serveur. Vise le top 10 ! 🏆' },
  { type: 'fact',     emoji: '💡', title: 'Achievements', text: 'Tape `/achievements` pour voir les défis à débloquer et leurs récompenses. 🎖️' },
];

async function postMiniEvent(client) {
  const event = MINI_EVENTS[Math.floor(Math.random() * MINI_EVENTS.length)];
  const guilds = getActiveGuilds();
  for (const cfg of guilds) {
    try {
      const guild = client.guilds.cache.get(cfg.guild_id);
      if (!guild) continue;
      const channel = guild.channels.cache.get(cfg.general_channel);
      if (!channel || !channel.isTextBased()) continue;

      const colors = { fact: 0x3498db, challenge: 0xE67E22, reminder: 0x9B59B6 };
      const embed = new EmbedBuilder()
        .setColor(colors[event.type] || 0x7B2FBE)
        .setTitle(`${event.emoji} ${event.title}`)
        .setDescription(event.text)
        .setFooter({ text: 'NexusBot · Mini-event automatique' });

      await channel.send({ embeds: [embed] }).catch(() => {});
    } catch (e) {
      console.error('[AutoEvent] mini-event:', e.message);
    }
  }
}

function getActiveGuilds() {
  try {
    let guilds = db.db.prepare(
      'SELECT guild_id, general_channel FROM guild_config WHERE general_channel IS NOT NULL AND general_channel != \'\''
    ).all();
    if (guilds.length === 0) {
      guilds = db.db.prepare(
        'SELECT guild_id, welcome_channel as general_channel FROM guild_config WHERE welcome_channel IS NOT NULL AND welcome_channel != \'\''
      ).all();
    }
    return guilds;
  } catch { return []; }
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
        .setFooter({ text: 'Réponds en moins de 10 minutes pour gagner 5 000€ !' })
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
    return await interaction.reply({
      content: 'Ce quiz a expiré ou n\'existe plus.',
      ephemeral: true
    }).catch(() => {});
  }

  if (quiz.guildId !== guildId) {
    return await interaction.reply({
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

    // Donner 5 000€ (au lieu de 500€)
    const guildObj = interaction.guild;
    if (guildObj) {
      db.addCoins(interaction.user.id, guildObj.id, 5000);
    }

    await interaction.reply({
      content: `🎉 Bravo <@${interaction.user.id}> ! Vous avez remporté le quiz et gagné **5 000€** ! 💰`,
      ephemeral: false
    }).catch(() => {});
  } else if (isCorrect && quiz.winner && quiz.winner === interaction.user.id) {
    return await interaction.reply({
      content: 'Vous avez déjà répondu correctement !',
      ephemeral: true
    }).catch(() => {});
  } else if (isCorrect && quiz.winner) {
    return await interaction.reply({
      content: 'Quelqu\'un d\'autre a déjà trouvé la bonne réponse !',
      ephemeral: true
    }).catch(() => {});
  } else {
    // Mauvaise réponse
    return await interaction.reply({
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
