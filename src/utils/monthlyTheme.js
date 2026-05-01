// ============================================================
// monthlyTheme.js — Thèmes saisonniers automatiques :
// chaque 1er du mois à midi, le bot poste une bannière thématique
// dans #général et change son statut. Crée du sentiment d'événement
// récurrent qui rythme la communauté.
// ============================================================
const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// 12 thèmes mensuels, chacun avec : titre, description, couleur, statut bot
const THEMES = {
  1:  { name: '❄️ Janvier — Nouveau Départ',     color: '#3498DB', desc: 'Bonne année ! 🎉 C\'est le moment de fixer ses résolutions, de se lancer dans de nouveaux projets et de partager ses objectifs pour 2026. Quelle est ta résolution cette année ?',           activity: '❄️ Bonne année 2026 !' },
  2:  { name: '💕 Février — Mois de l\'Amour',   color: '#E74C3C', desc: 'Saint-Valentin approche ! Que tu sois en couple, célibataire heureux ou compliqué, partage tes meilleurs souvenirs/conseils en amour avec la communauté.',                                  activity: '💕 Mois de la Saint-Valentin' },
  3:  { name: '🌸 Mars — Printemps & Renouveau', color: '#F39C12', desc: 'Le printemps arrive ! On range, on respire, on recommence. C\'est aussi le mois pour partager tes activités outdoor préférées et profiter du beau temps qui revient.',                          activity: '🌸 Printemps !' },
  4:  { name: '🌷 Avril — Mois Créatif',          color: '#2ECC71', desc: 'Avril est le mois de la créativité ! Partage tes œuvres, tes projets DIY, tes dessins, écrits ou tout ce que tu fabriques. La communauté veut voir ton talent.',                              activity: '🌷 Mois de la création' },
  5:  { name: '🌞 Mai — Festivité & Voyages',    color: '#F1C40F', desc: 'Mai en France = ponts, jours fériés, premiers vrais soleils. Quelle est ton spot/voyage de prédilection ? Partage tes plans pour l\'été qui approche !',                                       activity: '🌞 Mois des ponts' },
  6:  { name: '☀️ Juin — Été & Détente',         color: '#F39C12', desc: 'Les beaux jours s\'installent. Plage, soirées tardives, glaces, festivals... Mois parfait pour des défis fun, des soirées vocales et des giveaways d\'été !',                                  activity: '☀️ Été !' },
  7:  { name: '🏖️ Juillet — Vacances',           color: '#16A085', desc: 'Les vacances commencent ! Que tu pars ou que tu restes, le serveur reste ouvert pour échanger sur tes destinations, tes lectures et passer du bon temps ensemble.',                            activity: '🏖️ Bonnes vacances' },
  8:  { name: '🌅 Août — Soleil & Souvenirs',    color: '#E67E22', desc: 'Août = climax de l\'été. Photos de tes coins préférés, souvenirs marquants, conseils anti-canicule... Profite-en avant la rentrée !',                                                          activity: '🌅 Mois du soleil' },
  9:  { name: '🍂 Septembre — Rentrée',           color: '#A04000', desc: 'La rentrée est là ! Nouveaux objectifs, nouvelle énergie. Bonne reprise à tous, qu\'on soit étudiant, salarié, entrepreneur ou freelance. Partage tes plans pour la fin d\'année.',           activity: '🍂 Bonne rentrée' },
  10: { name: '🎃 Octobre — Halloween',          color: '#D35400', desc: 'Mois d\'Halloween ! Films d\'horreur, costumes, citrouilles, soirées hantées... Partage tes anecdotes effrayantes et tes traditions. Boo ! 👻',                                                  activity: '🎃 Halloween approche' },
  11: { name: '🍁 Novembre — Cocooning',         color: '#7B241C', desc: 'Le froid s\'installe, on rentre, on cocoone. Bougies, séries, plaids et bonnes soupes. Quel est ton rituel d\'automne préféré ?',                                                                activity: '🍁 Mois cocooning' },
  12: { name: '🎄 Décembre — Magie de Noël',     color: '#27AE60', desc: 'Le mois magique est là ! Calendrier de l\'avent, listes au Père Noël, repas en famille. **Événement spécial : un giveaway/event chaque semaine de décembre.** 🎁',                              activity: '🎄 Magie de Noël' },
};

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

function initThemeTable() {
  try {
    db.db.prepare(`CREATE TABLE IF NOT EXISTS monthly_theme_log (
      guild_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      posted_at INTEGER,
      PRIMARY KEY (guild_id, month_key)
    )`).run();
  } catch {}
}

function alreadyPostedForMonth(guildId, monthKey) {
  try {
    const row = db.db.prepare('SELECT 1 FROM monthly_theme_log WHERE guild_id = ? AND month_key = ?')
      .get(guildId, monthKey);
    return !!row;
  } catch { return false; }
}

function markPosted(guildId, monthKey) {
  try {
    db.db.prepare('INSERT OR REPLACE INTO monthly_theme_log (guild_id, month_key, posted_at) VALUES (?, ?, ?)')
      .run(guildId, monthKey, Math.floor(Date.now() / 1000));
  } catch {}
}

async function postMonthlyThemeInGuild(guild) {
  initThemeTable();
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  if (alreadyPostedForMonth(guild.id, monthKey)) return false;

  const theme = THEMES[month];
  if (!theme) return false;
  const channel = findGeneralChannel(guild);
  if (!channel) return false;

  const embed = new EmbedBuilder()
    .setColor(theme.color)
    .setTitle(theme.name)
    .setDescription(theme.desc)
    .setFooter({ text: `Zone Entraide · Thème du mois ${monthKey}` })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
    markPosted(guild.id, monthKey);
    return true;
  } catch { return false; }
}

// Met à jour le statut/activité du bot selon le mois
function updateBotActivity(client) {
  try {
    const month = new Date().getMonth() + 1;
    const theme = THEMES[month];
    if (!theme) return;
    client.user.setActivity(theme.activity, { type: 0 }); // 0 = Playing
  } catch {}
}

function startMonthlyThemeScheduler(client) {
  initThemeTable();
  // Met à jour le statut bot dès le boot et toutes les 6h
  updateBotActivity(client);
  setInterval(() => updateBotActivity(client), 6 * 3600 * 1000);

  // Vérifie quotidiennement à midi si on est le 1er du mois
  const CHECK_INTERVAL = 30 * 60 * 1000;
  const tick = async () => {
    try {
      const now = new Date();
      const dayOfMonth = now.getUTCDate();
      const parisOffset = now.getMonth() >= 2 && now.getMonth() <= 9 ? 2 : 1;
      const parisHour = (now.getUTCHours() + parisOffset) % 24;
      if (dayOfMonth !== 1) return; // pas le 1er
      if (parisHour !== 12) return;  // pas midi
      for (const guild of client.guilds.cache.values()) {
        await postMonthlyThemeInGuild(guild).catch(() => {});
      }
    } catch {}
  };
  setTimeout(tick, 120_000);
  setInterval(tick, CHECK_INTERVAL);
  console.log('[monthlyTheme] Scheduler démarré — bannière le 1er de chaque mois');
}

module.exports = {
  startMonthlyThemeScheduler,
  postMonthlyThemeInGuild,
  updateBotActivity,
  THEMES,
};
