// ============================================================
// casinoMusicManager.js — Musique casino permanente v3
// Source: streams radio jazz/lounge HTTP (plus fiable que YouTube)
// ============================================================
'use strict';

const { ChannelType } = require('discord.js');

let _voice = null;
function voice() {
  if (!_voice) _voice = require('@discordjs/voice');
  return _voice;
}

// ─── Stations radio jazz/lounge — HTTP direct, 0 auth, 100% Railway ───
const RADIO_STATIONS = [
  { title: '🎷 Smooth Jazz Florida',    url: 'http://smoothjazz.cdnstream1.com/2585_128.mp3' },
  { title: '🎹 Jazz 24 (KPLU)',         url: 'https://kplu.streamguys1.com/jazz24-free' },
  { title: '🃏 Radio Paradise Jazz',    url: 'https://stream.radioparadise.com/jazz-aac-320' },
  { title: '🌙 1.FM Jazz & Blues',      url: 'http://strm112.1.fm/jazzblues_mobile_mp3' },
  { title: '🥂 181.FM Smooth Jazz',     url: 'http://listen.181fm.com/181-smooth_128k.mp3' },
  { title: '💎 SomaFM Lush',           url: 'http://ice6.somafm.com/lush-128-mp3' },
  { title: '🌟 SomaFM Groove Salad',   url: 'http://ice6.somafm.com/groovesalad-128-mp3' },
  { title: '🎵 SomaFM Illinois Street', url: 'http://ice6.somafm.com/illstreet-128-mp3' },
  { title: '🎺 SomaFM Suburb',         url: 'http://ice6.somafm.com/suburbsofgoa-128-mp3' },
  { title: '🎸 SomaFM Left Coast 70s',  url: 'http://ice6.somafm.com/seventies-128-mp3' },
];

// ─── État par guild ───────────────────────────────────────────
const guildStates = new Map();
let _bgRetryActive = false;

// ─── Trouver le salon vocal casino ───────────────────────────
function findCasinoVoiceChannel(guild) {
  const PATTERNS = ['casino', 'musique', 'music', 'ambiance', 'lounge', 'jeux', '🎰', '🎵', '🎶', '🎸'];
  for (const pattern of PATTERNS) {
    const ch = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildVoice &&
      c.name.toLowerCase().includes(pattern)
    );
    if (ch) return ch;
  }
  return guild.channels.cache.find(c => c.type === ChannelType.GuildVoice) || null;
}

// ─── Joindre le vocal (3 tentatives, backoff exponentiel) ────
async function joinWithRetry(guild, channel, maxAttempts = 3) {
  const v = voice();
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let connection;
    const history = [`att${attempt}:start`];

    try {
      // Vérifier permissions avant chaque tentative
      const me = guild.members.me;
      if (me) {
        const perms = channel.permissionsFor(me);
        if (!perms?.has('Connect') || !perms?.has('Speak')) {
          throw new Error(`Permissions manquantes (Connect/Speak) dans #${channel.name}`);
        }
      }

      // Détruire proprement toute connexion zombie
      const zombie = v.getVoiceConnection(guild.id);
      if (zombie) { try { zombie.destroy(); } catch (_) {} await new Promise(r => setTimeout(r, 600)); }

      connection = v.joinVoiceChannel({
        channelId:      channel.id,
        guildId:        guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf:       true,
      });

      connection.on('stateChange', (_, ns) => history.push(ns.status));

      await v.entersState(connection, v.VoiceConnectionStatus.Ready, 40_000);
      console.log(`[CasinoMusic] ✅ Connexion ready (att.${attempt}) — ${history.join('→')}`);
      return connection;

    } catch (err) {
      lastErr = err;
      console.warn(`[CasinoMusic] ⚠️ Att.${attempt}/${maxAttempts} — ${history.join('→')} — ${err?.message}`);
      try { connection?.destroy(); } catch (_) {}
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 5_000 * attempt));
    }
  }
  throw new Error(lastErr?.message || 'Impossible de rejoindre le salon vocal');
}

// ─── Lancer le stream radio ───────────────────────────────────
async function playStation(guildId, station) {
  const s = guildStates.get(guildId);
  if (!s || s.stopping) return;

  const v   = voice();
  const idx = Math.floor(Math.random() * RADIO_STATIONS.length);
  const st  = station || RADIO_STATIONS[idx];

  try {
    const resource = v.createAudioResource(st.url, {
      inputType:    v.StreamType.Arbitrary,
      inlineVolume: true,
    });
    if (resource.volume) resource.volume.setVolume(s.volume);
    s.player.play(resource);
    s.currentStation = st;
    s.currentTitle   = st.title;
    console.log(`[CasinoMusic] 🎵 [${guildId}] → ${st.title}`);
  } catch (err) {
    console.error(`[CasinoMusic] Erreur lecture "${st.title}":`, err?.message);
    const next = RADIO_STATIONS[(RADIO_STATIONS.indexOf(st) + 1) % RADIO_STATIONS.length];
    setTimeout(() => playStation(guildId, next).catch(() => {}), 3_000);
  }
}

// ─── Démarrer la musique ──────────────────────────────────────
async function startMusic(guild, channelId) {
  const guildId = guild.id;
  const v       = voice();

  // Déjà actif ?
  if (guildStates.has(guildId)) {
    const s      = guildStates.get(guildId);
    const status = s.connection?.state?.status;
    if (status && status !== v.VoiceConnectionStatus.Destroyed) {
      return { success: true, alreadyPlaying: true, channelId: s.channelId };
    }
    try { s.connection?.destroy(); } catch (_) {}
    guildStates.delete(guildId);
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { success: false, reason: 'Salon vocal introuvable.' };

  let connection;
  try {
    connection = await joinWithRetry(guild, channel, 3);
  } catch (err) {
    return { success: false, reason: err?.message };
  }

  const player = v.createAudioPlayer({
    behaviors: { noSubscriber: v.NoSubscriberBehavior.Play },
  });
  connection.subscribe(player);

  const state = {
    connection, player,
    channelId:      channel.id,
    guildRef:       guild,
    volume:         0.5,
    currentStation: null,
    currentTitle:   null,
    stopping:       false,
    reconnectTimer: null,
  };
  guildStates.set(guildId, state);

  // ── Idle → relancer le même stream (radio = flux continu, ne finit pas normalement) ──
  player.on(v.AudioPlayerStatus.Idle, () => {
    const s2 = guildStates.get(guildId);
    if (!s2 || s2.stopping) return;
    const next = s2.currentStation || RADIO_STATIONS[0];
    console.log(`[CasinoMusic] Stream interrompu — reprise dans 2s : ${next.title}`);
    setTimeout(() => playStation(guildId, next).catch(() => {}), 2_000);
  });

  player.on('error', err => {
    console.error('[CasinoMusic] Player error:', err?.message);
    const s2 = guildStates.get(guildId);
    if (s2 && !s2.stopping) {
      const next = RADIO_STATIONS[Math.floor(Math.random() * RADIO_STATIONS.length)];
      setTimeout(() => playStation(guildId, next).catch(() => {}), 3_000);
    }
  });

  // ── Disconnected → tenter reconnexion rapide, sinon restart ──
  connection.on(v.VoiceConnectionStatus.Disconnected, async () => {
    const s2 = guildStates.get(guildId);
    if (!s2 || s2.stopping) return;
    try {
      await Promise.race([
        v.entersState(connection, v.VoiceConnectionStatus.Signalling, 6_000),
        v.entersState(connection, v.VoiceConnectionStatus.Connecting,  6_000),
      ]);
      console.log(`[CasinoMusic] 🔄 Reconnexion auto OK (${guildId})`);
    } catch {
      try { connection.destroy(); } catch (_) {}
      guildStates.delete(guildId);
      if (s2.reconnectTimer) clearTimeout(s2.reconnectTimer);
      s2.reconnectTimer = setTimeout(async () => {
        if (guildStates.has(guildId)) return;
        try { await startMusic(guild, channelId); }
        catch (e) { console.error('[CasinoMusic] Reconnexion manuelle échouée:', e?.message); }
      }, 8_000);
    }
  });

  // ── Destroyed → restart automatique après 10s ─────────────
  connection.on(v.VoiceConnectionStatus.Destroyed, () => {
    const s2      = guildStates.get(guildId);
    const wasLive = !s2?.stopping;
    guildStates.delete(guildId);
    if (!wasLive) return;
    console.log(`[CasinoMusic] ♻️ Connexion détruite → restart 10s (${guildId})`);
    setTimeout(async () => {
      if (guildStates.has(guildId)) return;
      try { await startMusic(guild, channelId); }
      catch (e) { console.error('[CasinoMusic] Restart post-Destroyed échoué:', e?.message); }
    }, 10_000);
  });

  // Démarrer la lecture avec une station aléatoire
  const first = RADIO_STATIONS[Math.floor(Math.random() * RADIO_STATIONS.length)];
  await playStation(guildId, first);

  return { success: true, alreadyPlaying: false, channel };
}

// ─── Stop propre ──────────────────────────────────────────────
function stopMusic(guildId) {
  const s = guildStates.get(guildId);
  if (!s) return false;
  s.stopping = true;
  if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
  try { s.player.stop(true); } catch (_) {}
  try { s.connection.destroy(); } catch (_) {}
  guildStates.delete(guildId);
  return true;
}

// ─── Skip → station suivante ─────────────────────────────────
async function skipTrack(guildId) {
  const s = guildStates.get(guildId);
  if (!s) return false;
  const idx  = RADIO_STATIONS.indexOf(s.currentStation);
  const next = RADIO_STATIONS[(idx + 1) % RADIO_STATIONS.length];
  await playStation(guildId, next);
  return true;
}

// ─── Volume ───────────────────────────────────────────────────
function setVolume(guildId, ratio) {
  const s = guildStates.get(guildId);
  if (!s) return false;
  s.volume = Math.max(0, Math.min(1, ratio));
  try {
    const res = s.player.state?.resource;
    if (res?.volume) res.volume.setVolume(s.volume);
  } catch (_) {}
  return true;
}

// ─── État ─────────────────────────────────────────────────────
function getState(guildId) { return guildStates.get(guildId) || null; }

// ─── Auto-init — attend que le cache guild soit prêt ─────────
async function autoInit(client, guildId) {
  try {
    let guild = null;
    for (let i = 0; i < 10; i++) { // jusqu'à 50s
      guild = client.guilds.cache.get(guildId);
      if (guild) break;
      await new Promise(r => setTimeout(r, 5_000));
    }
    if (!guild) { console.log('[CasinoMusic] Guild introuvable après 50s — skip'); return; }

    const channel = findCasinoVoiceChannel(guild);
    if (!channel) { console.log('[CasinoMusic] Aucun salon casino/musique détecté — /casino-musique play'); return; }

    const result = await startMusic(guild, channel.id);
    if (result.success && !result.alreadyPlaying) {
      console.log(`[CasinoMusic] ✅ Auto-démarrage : ${result.channel?.name || channel.name}`);
    }
  } catch (err) {
    console.error('[CasinoMusic] autoInit error:', err?.message);
  }
}

// ─── Background retry (boucle 45s si plus rien dans guildStates) ─
async function startBackgroundRetry(client, guildId) {
  if (_bgRetryActive) return;
  _bgRetryActive = true;
  console.log('[CasinoMusic] 🔄 Background retry actif (45s interval)');
  try {
    while (true) {
      await new Promise(r => setTimeout(r, 45_000));
      if (guildStates.has(guildId)) continue;
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const ch = findCasinoVoiceChannel(guild);
        if (!ch) continue;
        console.log('[CasinoMusic] 🔁 Retry background...');
        const r = await startMusic(guild, ch.id);
        if (r.success) console.log(`[CasinoMusic] ✅ Retry OK dans #${ch.name}`);
      } catch (e) { console.error('[CasinoMusic] Retry error:', e?.message); }
    }
  } finally {
    _bgRetryActive = false;
  }
}

// ─── Post-shard resume ────────────────────────────────────────
async function onShardResume(client, guildId) {
  console.log('[CasinoMusic] 📡 Shard resumed — vérification dans 12s');
  await new Promise(r => setTimeout(r, 12_000));
  if (guildStates.has(guildId)) { console.log('[CasinoMusic] ✅ Déjà connecté'); return; }
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const ch = findCasinoVoiceChannel(guild);
    if (!ch) return;
    const r = await startMusic(guild, ch.id);
    if (r.success) console.log(`[CasinoMusic] ✅ Reconnecté post-shard dans #${ch.name}`);
  } catch (e) { console.error('[CasinoMusic] Post-shard error:', e?.message); }
}

module.exports = {
  startMusic, stopMusic, setVolume, skipTrack, getState,
  autoInit, startBackgroundRetry, onShardResume,
  findCasinoVoiceChannel,
  RADIO_STATIONS,
  get CASINO_PLAYLIST() { return RADIO_STATIONS; }, // compat
};
