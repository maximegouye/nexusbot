// ============================================================
// conversationStarter.js — Prompts/sondages auto pour relancer
// le chat dans #général. Différent de dailyQuestion : ici on
// poste plusieurs fois par jour des MICRO-prompts variés (sondages,
// défis, "would you rather", anecdotes) à des intervalles aléatoires.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Banque de prompts variés (mix de sondages 2 options, anecdotes, défis)
const PROMPTS = [
  // Would you rather (2 options claires, fait participer)
  { type:'wyr', q:'Voler ou être invisible ?',                    a:'🪶 Voler', b:'👻 Invisible' },
  { type:'wyr', q:'Voyager dans le passé ou le futur ?',          a:'⏮️ Passé',  b:'⏭️ Futur' },
  { type:'wyr', q:'Vivre à la mer ou à la montagne ?',            a:'🌊 Mer',    b:'🏔️ Montagne' },
  { type:'wyr', q:'Pouvoir parler à tous les animaux ou parler toutes les langues ?', a:'🐕 Animaux', b:'🌍 Langues' },
  { type:'wyr', q:'Sucre ou sel pour le pop-corn ?',              a:'🍿 Sucre',  b:'🧂 Sel' },
  { type:'wyr', q:'Café le matin ou thé l\'après-midi ?',         a:'☕ Café',   b:'🍵 Thé' },
  { type:'wyr', q:'Lire un livre ou regarder un film ?',          a:'📚 Livre',  b:'🎬 Film' },
  { type:'wyr', q:'Hiver chaud ou été frais ?',                   a:'❄️ Hiver chaud', b:'🌞 Été frais' },
  { type:'wyr', q:'Travailler 4j/sem ou 6h/jour ?',               a:'4️⃣ jours/sem', b:'⏰ 6h/jour' },
  { type:'wyr', q:'Pizza ou burger ?',                            a:'🍕 Pizza',  b:'🍔 Burger' },
  { type:'wyr', q:'Console ou PC ?',                              a:'🎮 Console',b:'💻 PC' },
  { type:'wyr', q:'Chats ou chiens ?',                            a:'🐱 Chats',  b:'🐶 Chiens' },
  { type:'wyr', q:'Plage tropicale ou ville historique ?',        a:'🏖️ Plage',  b:'🏛️ Ville' },
  { type:'wyr', q:'Économiser ou dépenser ?',                     a:'💰 Économiser', b:'💸 Dépenser' },

  // Mini-défis (incite à poster une réponse)
  { type:'defi', text:'🎯 Décris ta journée avec 3 emojis maximum.' },
  { type:'defi', text:'🎬 Donne le titre d\'un film en 1 phrase. Les autres doivent deviner.' },
  { type:'defi', text:'📸 Poste la photo la plus drôle dans ton téléphone (en restant SFW bien sûr).' },
  { type:'defi', text:'😂 Quelle est ta meilleure punchline / blague pourrie ?' },
  { type:'defi', text:'🎵 Partage la dernière musique que tu as écoutée — ce que ça dit de toi.' },
  { type:'defi', text:'🌟 Cite UN truc dont tu es fier(ère) cette semaine, même petit.' },
  { type:'defi', text:'💡 Invente le nom d\'un super-héros à partir de ton métier/études.' },
  { type:'defi', text:'🎨 Décris ton humeur du moment en 1 couleur + 1 émotion.' },

  // Anecdotes / révélations légères
  { type:'reveal', text:'🤐 La dernière chose que tu as cherchée sur Google ? (Si ça passe le filtre 😂)' },
  { type:'reveal', text:'📱 Combien d\'apps tu as ouvertes en arrière-plan en ce moment ?' },
  { type:'reveal', text:'🍴 Le truc le plus bizarre que tu aies mangé ?' },
  { type:'reveal', text:'⏰ À quelle heure tu t\'es couché hier ? (sois honnête 👀)' },
  { type:'reveal', text:'🎁 Le meilleur cadeau qu\'on t\'ait jamais fait ?' },

  // Casino-themed (sur ton serveur thématique)
  { type:'wyr', q:'Tout miser au casino ou jouer petit/sûr ?',    a:'🎰 All-in',  b:'🎯 Petit/sûr' },
  { type:'defi', text:'🎰 Partage ton meilleur (ou pire) gain au /casino jusqu\'ici !' },
];

function findGeneralChannel(guild) {
  const candidates = ['général', 'general', 'chat', 'discussion'];
  for (const name of candidates) {
    const ch = guild.channels.cache.find(c => c.name === name && c.isTextBased && c.isTextBased());
    if (ch) return ch;
  }
  return guild.systemChannel || guild.channels.cache.find(c =>
    c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages')
  );
}

function initConvTable() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS conversation_log (
      guild_id TEXT NOT NULL,
      posted_at INTEGER NOT NULL,
      prompt_idx INTEGER,
      PRIMARY KEY (guild_id, posted_at)
    )`).run();
  } catch {}
}

// Vérifie si on a posté dans les dernières N heures (anti-spam)
function recentlyPosted(guildId, hours = 4) {
  try {
    const since = Math.floor(Date.now() / 1000) - hours * 3600;
    const row = db.db.prepare('SELECT 1 FROM conversation_log WHERE guild_id = ? AND posted_at >= ? LIMIT 1').get(guildId, since);
    return !!row;
  } catch { return false; }
}

function logPost(guildId, idx) {
  try {
    db.db.prepare('INSERT INTO conversation_log (guild_id, posted_at, prompt_idx) VALUES (?, ?, ?)')
      .run(guildId, Math.floor(Date.now() / 1000), idx);
  } catch {}
}

async function postPromptInGuild(guild) {
  initConvTable();
  if (recentlyPosted(guild.id, 4)) return false; // Pas plus d'1 prompt par 4h

  const channel = findGeneralChannel(guild);
  if (!channel) return false;

  const idx = Math.floor(Math.random() * PROMPTS.length);
  const p = PROMPTS[idx];

  let embed;
  if (p.type === 'wyr') {
    embed = new EmbedBuilder().setColor('#9B59B6')
      .setTitle('🤔 Tu préférerais...')
      .setDescription(`# ${p.q}\n\n${p.a}  ⚖️  ${p.b}\n\n*Réagis avec un emoji ou réponds dans le chat — pas de mauvaise réponse !*`)
      .setFooter({ text:'Sondage spontané · Zone Entraide' });
  } else if (p.type === 'defi') {
    embed = new EmbedBuilder().setColor('#E67E22')
      .setTitle('🎯 Mini-défi')
      .setDescription(`${p.text}\n\n*Réponds dans le chat — qui ose en premier ?*`)
      .setFooter({ text:'Défi spontané · Zone Entraide' });
  } else {
    embed = new EmbedBuilder().setColor('#3498DB')
      .setTitle('💬 Question rapide')
      .setDescription(p.text)
      .setFooter({ text:'Zone Entraide · Réponds quand tu veux' });
  }

  try {
    const sent = await channel.send({ embeds: [embed] });
    logPost(guild.id, idx);
    // Pour les WYR, ajoute des réactions A/B pour faciliter le vote
    if (p.type === 'wyr') {
      const emojiA = (p.a.match(/\p{Extended_Pictographic}/u) || ['🇦'])[0];
      const emojiB = (p.b.match(/\p{Extended_Pictographic}/u) || ['🇧'])[0];
      await sent.react(emojiA).catch(() => {});
      await sent.react(emojiB).catch(() => {});
    }
    return true;
  } catch { return false; }
}

function startConversationScheduler(client) {
  initConvTable();
  // Vérifie toutes les 60 min, poste avec 30% de chance si rien dans les 4 dernières h
  // (résultat moyen : ~1 post toutes les 4-6h)
  const tick = async () => {
    try {
      const now = new Date();
      const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
      const parisHour = (now.getUTCHours() + parisOffset) % 24;
      // Actif uniquement entre 10h et 23h Paris (pas la nuit)
      if (parisHour < 10 || parisHour >= 23) return;
      if (Math.random() > 0.3) return; // 30% chance par tick
      for (const guild of client.guilds.cache.values()) {
        await postPromptInGuild(guild).catch(() => {});
      }
    } catch {}
  };
  setTimeout(tick, 180_000); // premier tick après 3 min
  setInterval(tick, 60 * 60 * 1000); // toutes les heures
  console.log('[conversationStarter] Scheduler démarré — prompts spontanés 10h-23h Paris');
}

module.exports = { startConversationScheduler, postPromptInGuild, PROMPTS };
