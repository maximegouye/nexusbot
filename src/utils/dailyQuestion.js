// ============================================================
// dailyQuestion.js — Poste 1 question de discussion par jour pour
// relancer la conversation dans #général. Schedulé depuis ready.js.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Banque de 60+ questions variées (tournent sur 2 mois sans répétition)
const QUESTIONS = [
  // Casual / fun
  { q: 'Quel est ton repas préféré ? 🍕', topic: '🍽️ Question Cuisine' },
  { q: 'Si tu pouvais voyager n\'importe où demain, où irais-tu ? ✈️', topic: '🌍 Question Voyage' },
  { q: 'Team chat ou team chien ? 🐱🐶', topic: '🐾 Question Animaux' },
  { q: 'Quel est ton film favori de tous les temps ? 🎬', topic: '🎬 Question Cinéma' },
  { q: 'Quelle est ta série que tu peux re-binge sans jamais t\'en lasser ? 📺', topic: '📺 Question Séries' },
  { q: 'Café, thé ou autre boisson chaude ? ☕', topic: '☕ Question Boisson' },
  { q: 'Quelle est la dernière musique que tu as écoutée ? 🎧', topic: '🎵 Question Musique' },
  { q: 'Console ou PC pour gamer ? 🎮', topic: '🎮 Question Gaming' },
  { q: 'Été ou hiver ? Pourquoi ? ☀️❄️', topic: '🌤️ Question Saison' },
  { q: 'Sucré ou salé pour le petit-déjeuner ? 🥐🍳', topic: '🥞 Question Petit-déj' },

  // Personnel / introspection (légère)
  { q: 'Quel est ton hobby qui te fait perdre la notion du temps ? ⏰', topic: '🎯 Question Passion' },
  { q: 'Si tu pouvais maîtriser une compétence en 24h, ce serait laquelle ? 🧠', topic: '💡 Question Compétence' },
  { q: 'Quel super-pouvoir tu choisirais sans hésiter ? ⚡', topic: '🦸 Question Super-Pouvoir' },
  { q: 'Quelle est la plus belle chose que tu aies vue cette semaine ? 🌅', topic: '✨ Question Beauté' },
  { q: 'C\'est quoi le meilleur conseil qu\'on t\'ait donné ? 💬', topic: '💭 Question Sagesse' },
  { q: 'Ton plus beau souvenir d\'enfance en 1 phrase ? 🌈', topic: '🧒 Question Enfance' },
  { q: 'Quelle ville rêverais-tu d\'habiter ? 🏙️', topic: '🏠 Question Ville' },
  { q: 'À quoi rêves-tu de ressembler dans 5 ans ? 🎯', topic: '🚀 Question Futur' },
  { q: 'Quel est ton "guilty pleasure" assumé ? 🤫', topic: '😈 Question Plaisir Coupable' },
  { q: 'Plage ou montagne pour les vacances ? 🏖️🏔️', topic: '🌴 Question Vacances' },

  // Communauté / opinions soft
  { q: 'Quelle invention récente te rend la vie meilleure ? 📱', topic: '💡 Question Tech' },
  { q: 'Une langue que tu rêverais d\'apprendre ? 🗣️', topic: '🌐 Question Langues' },
  { q: 'Ton sport préféré (à pratiquer ou regarder) ? ⚽', topic: '🏆 Question Sport' },
  { q: 'Livre qui t\'a marqué à vie ? 📚', topic: '📖 Question Lecture' },
  { q: 'Quel est ton rituel du dimanche ? 🛋️', topic: '🌅 Question Rituel' },
  { q: 'Tu préfères travailler à la maison ou au bureau ? 🏡🏢', topic: '💼 Question Travail' },
  { q: 'Qu\'est-ce qui te met instantanément de bonne humeur ? 😊', topic: '🌟 Question Bonheur' },
  { q: 'Le truc le plus étrange dans ton frigo en ce moment ? 🧊', topic: '🧊 Question Frigo' },
  { q: 'Ton plat signature quand tu reçois des amis ? 👨‍🍳', topic: '🍳 Question Cuisine' },
  { q: 'Une appli que tu utilises tous les jours sans exception ? 📲', topic: '📱 Question App' },

  // Créatif / imagination
  { q: 'Si ta vie était un film, quel serait son titre ? 🎬', topic: '🎬 Question Film' },
  { q: 'Avec quel personnage de fiction aimerais-tu dîner ? 🍽️', topic: '🍽️ Question Fiction' },
  { q: 'Si tu pouvais rencontrer ton toi de 10 ans, quel conseil tu donnerais ? 🎒', topic: '⏰ Question Passé' },
  { q: 'Tu es bloqué sur une île déserte avec 3 objets : lesquels ? 🏝️', topic: '🏝️ Question Île' },
  { q: 'Quel objet que tu n\'utilises pas mérite d\'exister à ton avis ? 🤔', topic: '🤖 Question Invention' },
  { q: 'Quelle époque historique aurais-tu aimé vivre ? ⏳', topic: '⏳ Question Histoire' },
  { q: 'Si tu pouvais effacer une mémoire, ce serait laquelle ? 🧠', topic: '🧠 Question Mémoire' },
  { q: 'Tu gagnes 1M€ demain : tu fais quoi en premier ? 💰', topic: '💰 Question Million' },
  { q: 'Une chanson qui te ramène instantanément à un moment précis ? 🎶', topic: '🎶 Question Madeleine' },
  { q: 'Le surnom le plus drôle qu\'on t\'ait donné ? 😂', topic: '😄 Question Surnom' },

  // Casino / Bot-themed
  { q: 'Sur quel jeu du casino tu te sens le plus chanceux ? 🎰', topic: '🎰 Question Casino' },
  { q: 'C\'est quoi ton meilleur gain au /slots jusqu\'ici ? 💎', topic: '💎 Question Slots' },
  { q: 'Plutôt /roulette ou /blackjack ? Pourquoi ? 🃏', topic: '🃏 Question Préférence' },
  { q: 'Tu mises sur le rouge ou le noir à la roulette ? 🔴⚫', topic: '🎡 Question Roulette' },
  { q: 'Quelle stratégie au /mines ? Sécurité ou tout-ou-rien ? 💣', topic: '💣 Question Mines' },
  { q: 'Tu préfères jouer la sécurité ou prendre des risques au casino ? 🎲', topic: '🎲 Question Style' },

  // Discussions ouvertes
  { q: 'Quelle compétence tu trouves sous-estimée mais super utile ? 🛠️', topic: '🔧 Question Compétence' },
  { q: 'Si tu pouvais apprendre tout instantanément sur 1 sujet, lequel ? 📚', topic: '📚 Question Connaissance' },
  { q: 'Le truc le plus bizarre que tu aies fait pour économiser de l\'argent ? 💸', topic: '💸 Question Économie' },
  { q: 'Une habitude que tu aimerais prendre en 2026 ? ✨', topic: '✨ Question Habitude' },
  { q: 'Tu préfères être en avance ou pile à l\'heure aux RDV ? ⏰', topic: '⏰ Question Ponctualité' },
  { q: 'Le dernier truc qui t\'a fait rire aux éclats ? 😂', topic: '😄 Question Rire' },
  { q: 'Plage en été ou ski en hiver pour des vacances rêvées ? 🏖️🎿', topic: '🌊 Question Vacances' },
  { q: 'Quel mot français tu trouves vraiment beau ? 💫', topic: '💫 Question Mots' },
  { q: 'Si tu devais vivre dans un univers fictif lequel ? 🌌', topic: '🌌 Question Univers' },
  { q: 'Le truc que tu collectionnes (ou aimerais) ? 🎒', topic: '🎁 Question Collection' },

  // Communauté Zone Entraide
  { q: 'Comment as-tu découvert Zone Entraide ? 🤝', topic: '🤝 Question Communauté' },
  { q: 'Quelle feature du serveur tu adores le plus ? ❤️', topic: '❤️ Question Serveur' },
  { q: 'Si tu pouvais ajouter UN nouveau salon, ce serait quoi ? 💡', topic: '💡 Question Suggestion' },
  { q: 'Présente-toi en 3 emojis 🎨', topic: '🎨 Question Emojis' },
  { q: 'Ton meilleur souvenir sur le serveur jusqu\'ici ? 🌟', topic: '🌟 Question Souvenir' },
];

// Choisit une question pour aujourd'hui (déterministe selon la date)
function pickTodayQuestion() {
  const today = new Date();
  // Utilise le jour Julien comme index — varie chaque jour, ne se répète pas
  // dans la fenêtre de la banque (60+ questions = 2 mois de roulement)
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  return QUESTIONS[dayOfYear % QUESTIONS.length];
}

// Vérifie si on a déjà posté aujourd'hui pour ce serveur (anti-doublon)
function alreadyPostedToday(guildId) {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS daily_question_log (
      guild_id TEXT NOT NULL,
      day TEXT NOT NULL,
      question_idx INTEGER,
      posted_at INTEGER,
      PRIMARY KEY (guild_id, day)
    )`).run();
    const today = new Date().toISOString().slice(0, 10);
    const row = db.db.prepare('SELECT 1 FROM daily_question_log WHERE guild_id=? AND day=?').get(guildId, today);
    return !!row;
  } catch { return false; }
}

function markPostedToday(guildId, idx) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    db.db.prepare('INSERT OR REPLACE INTO daily_question_log (guild_id, day, question_idx, posted_at) VALUES (?, ?, ?, ?)')
      .run(guildId, today, idx, Math.floor(Date.now() / 1000));
  } catch {}
}

// Trouve le canal général ou similaire
function findGeneralChannel(guild) {
  // Priorités : "général", "general", "chat", "discussion", puis le system channel
  const candidates = ['général', 'general', 'chat', 'discussion', 'général-chat'];
  for (const name of candidates) {
    const ch = guild.channels.cache.find(c => c.name === name && c.isTextBased && c.isTextBased());
    if (ch) return ch;
  }
  // Fallback : system channel ou premier salon textuel où le bot peut écrire
  if (guild.systemChannel) return guild.systemChannel;
  return guild.channels.cache.find(c =>
    c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
  );
}

// Poste la question du jour dans #général d'un guild
async function postQuestionInGuild(guild) {
  if (alreadyPostedToday(guild.id)) return false;
  const channel = findGeneralChannel(guild);
  if (!channel) return false;
  const q = pickTodayQuestion();
  const idx = QUESTIONS.indexOf(q);

  const embed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle(q.topic)
    .setDescription(`# ${q.q}\n\n💬 **Réagis dans le chat** — pas de mauvaise réponse !\n_(Tu gagnes +XP et +€ en participant.)_`)
    .setFooter({ text: 'Question du jour · Zone Entraide' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    markPostedToday(guild.id, idx);
    return true;
  } catch { return false; }
}

// Démarre le scheduler — appelé depuis ready.js
function startDailyQuestionScheduler(client) {
  // Vérifie toutes les 30 min si on doit poster (entre 12h et 13h heure locale Paris)
  const CHECK_INTERVAL = 30 * 60 * 1000; // 30 min
  const POST_HOUR = 12; // poste à midi (heure locale serveur Railway)

  const tick = async () => {
    try {
      const now = new Date();
      // Heure de Paris approximative (UTC+1 en hiver, +2 en été)
      // Railway tourne en UTC, donc on adapte
      const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
      const parisHour = (now.getUTCHours() + parisOffset) % 24;
      if (parisHour !== POST_HOUR) return; // pas la bonne heure
      // Poste pour chaque guild
      for (const guild of client.guilds.cache.values()) {
        await postQuestionInGuild(guild).catch(() => {});
      }
    } catch {}
  };

  // Premier tick après 1 min (laisse le bot se stabiliser au boot)
  setTimeout(tick, 60_000);
  setInterval(tick, CHECK_INTERVAL);
  console.log('[dailyQuestion] Scheduler démarré — 1 question/jour à midi Paris');
}

module.exports = { startDailyQuestionScheduler, pickTodayQuestion, postQuestionInGuild };
