const { db } = require('../database/db');

/**
 * Vérifie les nouvelles vidéos YouTube et les streams Twitch
 * Table DB : youtube_subs, twitch_subs (schéma db.js)
 */
async function checkNotifications(client) {
  try {
    await checkYouTubeNotifications(client);
    await checkTwitchNotifications(client);
  } catch (e) {}
}

async function checkYouTubeNotifications(client) {
  let axios, xml2js;
  try {
    axios  = require('axios');
    xml2js = require('xml2js');
  } catch {
    return; // dépendances absentes — on ignore silencieusement
  }

  let subs;
  try {
    subs = db.db.prepare('SELECT * FROM youtube_subs').all();
  } catch { return; }
  if (!subs || subs.length === 0) return;

  const xmlParser = new xml2js.Parser();

  for (const sub of subs) {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${sub.yt_channel_id}`;
      const response = await axios.get(feedUrl, { timeout: 10000 });
      const parsed   = await xmlParser.parseStringPromise(response.data);
      const entries  = parsed.feed?.entry || [];
      if (entries.length === 0) continue;

      const latest  = entries[0];
      const videoId = latest['yt:videoId']?.[0];
      const videoUrl = latest.link?.[0]?.['$']?.href;
      const title   = latest.title?.[0];
      const author  = latest['author']?.[0]?.['name']?.[0];

      if (!videoId || !videoUrl) continue;
      if (sub.last_video_id === videoId) continue; // déjà notifié

      // Mettre à jour last_video_id
      db.db.prepare('UPDATE youtube_subs SET last_video_id = ? WHERE guild_id = ? AND yt_channel_id = ?')
        .run(videoId, sub.guild_id, sub.yt_channel_id);

      // Envoyer la notification
      const ch = await client.channels.fetch(sub.channel_id).catch(() => null);
      if (!ch || !ch.isTextBased()) continue;

      const channelName = sub.yt_channel_name || author || 'YouTube';
      let msg = (sub.message || '🎬 Nouvelle vidéo de {channel} ! {url}')
        .replace('{channel}', channelName)
        .replace('{url}', videoUrl)
        .replace('{title}', title || '');

      if (sub.role_ping) msg = `<@&${sub.role_ping}> ${msg}`;

      await ch.send(msg).catch(() => {});
    } catch { /* ignore cette sub */ }
  }
}

async function checkTwitchNotifications(client) {
  const clientId     = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;

  let axios;
  try { axios = require('axios'); } catch { return; }

  let subs;
  try {
    subs = db.db.prepare('SELECT * FROM twitch_subs').all();
  } catch { return; }
  if (!subs || subs.length === 0) return;

  // Obtenir un token Twitch OAuth (client_credentials)
  let accessToken;
  try {
    const tokenRes = await axios.post(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
      {}, { timeout: 8000 }
    );
    accessToken = tokenRes.data.access_token;
  } catch { return; }

  const uniqueLogins = [...new Set(subs.map(s => s.twitch_login))];

  for (const login of uniqueLogins) {
    try {
      const res = await axios.get(
        `https://api.twitch.tv/helix/streams?user_login=${login}`,
        { headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${accessToken}` }, timeout: 8000 }
      );

      const isLive   = res.data?.data?.length > 0;
      const stream   = res.data?.data?.[0] || {};
      const loginSubs = subs.filter(s => s.twitch_login === login);

      for (const sub of loginSubs) {
        const wasLive = sub.was_live === 1;

        if (isLive && !wasLive) {
          // Vient de commencer
          db.db.prepare('UPDATE twitch_subs SET was_live = 1 WHERE guild_id = ? AND twitch_login = ?')
            .run(sub.guild_id, login);

          const ch = await client.channels.fetch(sub.channel_id).catch(() => null);
          if (!ch || !ch.isTextBased()) continue;

          let msg = (sub.message || '🔴 {streamer} est EN LIVE ! {url}')
            .replace('{streamer}', stream.user_name || login)
            .replace('{url}', `https://twitch.tv/${login}`)
            .replace('{title}', stream.title || '')
            .replace('{game}', stream.game_name || '');

          if (sub.role_ping) msg = `<@&${sub.role_ping}> ${msg}`;

          await ch.send(msg).catch(() => {});

        } else if (!isLive && wasLive) {
          // Vient de finir
          db.db.prepare('UPDATE twitch_subs SET was_live = 0 WHERE guild_id = ? AND twitch_login = ?')
            .run(sub.guild_id, login);
        }
      }
    } catch { /* ignore ce streamer */ }
  }
}

module.exports = { checkNotifications };
