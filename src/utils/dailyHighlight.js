// ============================================================
// dailyHighlight.js — Détecte le message le plus engageant du
// jour (le plus de réactions) et le re-poste à 22h dans #général.
// Crée un sentiment de "moments mémorables" et valorise les
// membres qui contribuent.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

function init() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS daily_highlight_log (
      guild_id TEXT NOT NULL,
      day TEXT NOT NULL,
      message_id TEXT,
      channel_id TEXT,
      author_id TEXT,
      reaction_count INTEGER,
      posted_at INTEGER,
      PRIMARY KEY (guild_id, day)
    )`).run();
  } catch {}
}
init();

function alreadyPostedToday(guildId, day) {
  try {
    return !!db.db.prepare('SELECT 1 FROM daily_highlight_log WHERE guild_id=? AND day=?').get(guildId, day);
  } catch { return false; }
}

function findGeneralChannel(guild) {
  const candidates = ['général', 'general', 'chat', 'discussion'];
  for (const name of candidates) {
    const ch = guild.channels.cache.find(c => c.name === name && c.isTextBased && c.isTextBased());
    if (ch) return ch;
  }
  return null;
}

// Cherche le meilleur message des dernières 24h dans les canaux publics
async function findBestMessage(guild) {
  // On ne scanne que les canaux les plus actifs : général, chat, mémés, etc.
  const candidates = ['général', 'general', 'chat', 'discussion', 'mémes', 'memes', 'humour'];
  const channels = guild.channels.cache.filter(c =>
    c.isTextBased() && candidates.includes(c.name)
  );

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let best = null;
  let bestScore = 0;

  for (const ch of channels.values()) {
    try {
      const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
      if (!msgs) continue;
      for (const m of msgs.values()) {
        if (m.author.bot) continue;
        if (m.createdTimestamp < cutoff) continue;
        // Score = total des reactions + nombre de uniques contributeurs
        let totalReacts = 0;
        m.reactions.cache.forEach(r => { totalReacts += r.count || 0; });
        const score = totalReacts;
        if (score >= 3 && score > bestScore) { // au moins 3 réactions
          bestScore = score;
          best = m;
        }
      }
    } catch {}
  }
  return best;
}

async function postDailyHighlightInGuild(guild) {
  init();
  const today = new Date().toISOString().slice(0, 10);
  if (alreadyPostedToday(guild.id, today)) return false;

  const channel = findGeneralChannel(guild);
  if (!channel) return false;

  const best = await findBestMessage(guild);
  if (!best) {
    // Pas de message qualifié aujourd'hui, on log quand même pour ne pas reboucler
    try {
      db.db.prepare(`INSERT OR REPLACE INTO daily_highlight_log
                     (guild_id, day, message_id, channel_id, author_id, reaction_count, posted_at)
                     VALUES (?, ?, '', '', '', 0, ?)`)
        .run(guild.id, today, Math.floor(Date.now() / 1000));
    } catch {}
    return false;
  }

  let totalReacts = 0;
  best.reactions.cache.forEach(r => { totalReacts += r.count || 0; });
  const reactionEmojis = best.reactions.cache.map(r => r.emoji.toString()).slice(0, 5).join(' ');

  const embed = new EmbedBuilder()
    .setColor('#9B59B6')
    .setTitle('✨ Message du jour — Highlight de la communauté')
    .setDescription([
      `Le message le plus apprécié des dernières 24h vient de <@${best.author.id}> !`,
      '',
      `> ${best.content.slice(0, 1000) || '*[image / fichier]*'}`,
      '',
      `**${totalReacts} réactions** ${reactionEmojis}`,
      `📍 [Voir le message](${best.url})`,
    ].join('\n'))
    .setFooter({ text: 'Highlight quotidien · Zone Entraide' })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    // Récompense l'auteur du highlight
    try { db.addCoins(best.author.id, guild.id, 1000); } catch {}

    db.db.prepare(`INSERT OR REPLACE INTO daily_highlight_log
                   (guild_id, day, message_id, channel_id, author_id, reaction_count, posted_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(guild.id, today, best.id, best.channel.id, best.author.id, totalReacts, Math.floor(Date.now() / 1000));
    return true;
  } catch { return false; }
}

function startDailyHighlightScheduler(client) {
  init();
  const CHECK_INTERVAL = 30 * 60 * 1000;
  const tick = async () => {
    try {
      const now = new Date();
      const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
      const parisHour = (now.getUTCHours() + parisOffset) % 24;
      if (parisHour !== 22) return; // Tous les jours à 22h Paris
      for (const guild of client.guilds.cache.values()) {
        await postDailyHighlightInGuild(guild).catch(() => {});
      }
    } catch {}
  };
  setTimeout(tick, 150_000);
  setInterval(tick, CHECK_INTERVAL);
  console.log('[dailyHighlight] Scheduler démarré — highlight chaque jour à 22h Paris');
}

module.exports = {
  startDailyHighlightScheduler,
  postDailyHighlightInGuild,
};
