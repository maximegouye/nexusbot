// ============================================================
// casinoMusicManager.js — Gestionnaire de musique casino permanent
// Emplacement : src/utils/casinoMusicManager.js
// ============================================================

// Imports lazy : @discordjs/voice et play-dl sont chargés à la première utilisation
// Cela évite les crashs au démarrage si les binaires natifs ne sont pas disponibles
const { ChannelType } = require('discord.js');

let _voice = null;
let _playdl = null;
let _sodiumReady = false;

// Pré-initialiser libsodium-wrappers AVANT @discordjs/voice pour éviter la
// race condition dans l'IIFE d'initialisation de l'encryption (WASM async)
async function ensureEncryption() {
  if (_sodiumReady) return;
  try {
    const sodium = require('libsodium-wrappers');
    if (sodium && sodium.ready) await sodium.ready;
    console.log('[CasinoMusic] ✅ libsodium-wrappers prêt');
  } catch {
    // tweetnacl n'a pas besoin d'init async — pas de problème
    console.log('[CasinoMusic] ℹ️ Fallback tweetnacl (pas de libsodium-wrappers)');
  }
  _sodiumReady = true;
}

function voice() {
  if (!_voice) _voice = require('@discordjs/voice');
  return _voice;
}
function playdl() {
  if (!_playdl) _playdl = require('play-dl');
  return _playdl;
}

// ─── Playlist premium — 10 styles casino différents ──────────
const CASINO_PLAYLIST = [
  { title: '🎷 Casino Jazz Lounge',        query: 'casino jazz lounge music ambient 1 hour' },
  { title: '🎹 Las Vegas Piano Bar',        query: 'las vegas piano bar jazz lounge music' },
  { title: '🃏 Casino Royale Ambiance',     query: 'casino royale james bond jazz lounge soundtrack' },
  { title: '🌙 Bossa Nova Casino Night',    query: 'bossa nova jazz lounge bar smooth elegant' },
  { title: '🎸 Rat Pack Vegas Swing',       query: 'rat pack vegas style jazz swing music sinatra' },
  { title: '🎺 Big Band Casino Night',      query: 'big band swing jazz casino elegant night club' },
  { title: '🥂 Cocktail Jazz Piano',        query: 'cocktail jazz piano lounge elegant ambiance bar' },
  { title: '🎻 Smooth Jazz Saxophone',      query: 'smooth jazz saxophone evening lounge relaxing' },
  { title: '💎 VIP Lounge Ambiance',        query: 'vip lounge ambient music luxury sophisticated jazz' },
  { title: '🌟 Vegas Nights Jazz',          query: 'vegas nights jazz cool vibes lounge modern' },
];

// ─── État par guild ───────────────────────────────────────────
const guildStates = new Map();

// ─── Shuffle Fisher-Yates ─────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Auto-détection du salon vocal casino ─────────────────────
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

// ─── Jouer la piste suivante ──────────────────────────────────
async function playNext(guildId) {
  const state = guildStates.get(guildId);
  if (!state || state.stopping) return;

  state.playlistIndex = (state.playlistIndex + 1) % state.shuffledList.length;
  if (state.playlistIndex === 0) state.shuffledList = shuffle(CASINO_PLAYLIST);

  const track = state.shuffledList[state.playlistIndex];
  state.currentTrack = track;

  try {
    const pd = playdl();
    const results = await pd.search(track.query, {
      source: { youtube: 'video' },
      limit: 5,
    });

    if (!results || results.length === 0) {
      console.warn(`[CasinoMusic] Aucun résultat pour "${track.query}" — passage suivante`);
      setTimeout(() => playNext(guildId).catch(() => {}), 2500);
      return;
    }

    const pick = results[Math.floor(Math.random() * Math.min(3, results.length))];
    const stream = await pd.stream(pick.url, { quality: 2 });

    const v = voice();
    const resource = v.createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    if (resource.volume) resource.volume.setVolume(state.volume);
    state.player.play(resource);
    state.currentYTTitle = pick.title || track.title;

    console.log(`[CasinoMusic] 🎵 [${guildId}] Now playing: "${pick.title}"`);

  } catch (err) {
    console.error(`[CasinoMusic] Erreur lecture "${track.title}":`, err?.message || err);
    setTimeout(() => playNext(guildId).catch(() => {}), 3000);
  }
}

// ─── Démarrer la musique dans un guild ───────────────────────
async function startMusic(guild, channelId) {
  const guildId = guild.id;

  if (guildStates.has(guildId)) {
    const existing = guildStates.get(guildId);
    const v = voice();
    const status = existing.connection?.state?.status;
    if (status && status !== v.VoiceConnectionStatus.Destroyed) {
      return { success: true, alreadyPlaying: true, channelId: existing.channelId };
    }
    guildStates.delete(guildId);
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { success: false, reason: 'Salon vocal introuvable.' };

  // Attendre que libsodium-wrappers soit initialisé avant @discordjs/voice
  await ensureEncryption();

  const v = voice();
  let connection;
  let lastState = 'initial';

  try {
    connection = v.joinVoiceChannel({
      channelId: channel.id,
      guildId:   guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf:  true,
    });

    connection.on('stateChange', (_, newState) => {
      lastState = newState.status;
      console.log(`[CasinoMusic] State → ${newState.status} (${guildId})`);
    });

    await v.entersState(connection, v.VoiceConnectionStatus.Ready, 45_000);
  } catch (err) {
    console.error(`[CasinoMusic] Échec connexion (lastState=${lastState}):`, err?.message);
    try { connection?.destroy(); } catch (_) {}
    return { success: false, reason: `Bloqué en "${lastState}" : ${err?.message || err}` };
  }

  const player = v.createAudioPlayer({
    behaviors: { noSubscriber: v.NoSubscriberBehavior.Play },
  });

  connection.subscribe(player);

  const state = {
    connection,
    player,
    channelId:     channel.id,
    guildRef:      guild,
    volume:        0.5,
    shuffledList:  shuffle(CASINO_PLAYLIST),
    playlistIndex: -1,
    currentTrack:  null,
    currentYTTitle: null,
    stopping:      false,
    reconnectTimer: null,
  };

  guildStates.set(guildId, state);

  // ── Piste suivante quand idle ──────────────────────────────
  player.on(v.AudioPlayerStatus.Idle, () => {
    const s = guildStates.get(guildId);
    if (s && !s.stopping) {
      playNext(guildId).catch(err =>
        console.error('[CasinoMusic] playNext (idle) error:', err?.message)
      );
    }
  });

  player.on('error', err => {
    console.error('[CasinoMusic] Player error:', err?.message);
    const s = guildStates.get(guildId);
    if (s && !s.stopping) setTimeout(() => playNext(guildId).catch(() => {}), 2000);
  });

  // ── Reconnexion automatique ────────────────────────────────
  connection.on(v.VoiceConnectionStatus.Disconnected, async () => {
    const s = guildStates.get(guildId);
    if (!s || s.stopping) return;

    try {
      await Promise.race([
        v.entersState(connection, v.VoiceConnectionStatus.Signalling, 5_000),
        v.entersState(connection, v.VoiceConnectionStatus.Connecting,  5_000),
      ]);
      console.log(`[CasinoMusic] 🔄 Reconnexion automatique réussie (${guildId})`);
    } catch {
      console.log(`[CasinoMusic] 🔁 Recréation connexion pour ${guildId} dans 6s...`);
      try { connection.destroy(); } catch (_) {}
      guildStates.delete(guildId);

      if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
      s.reconnectTimer = setTimeout(async () => {
        try { await startMusic(guild, channelId); }
        catch (e) { console.error('[CasinoMusic] Échec reconnexion complète:', e?.message); }
      }, 6000);
    }
  });

  connection.on(v.VoiceConnectionStatus.Destroyed, () => {
    console.log(`[CasinoMusic] Connexion détruite — ${guildId}`);
    guildStates.delete(guildId);
  });

  await playNext(guildId);
  return { success: true, alreadyPlaying: false, channel };
}

// ─── Arrêter proprement ───────────────────────────────────────
function stopMusic(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return false;

  state.stopping = true;
  if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
  try { state.player.stop(true); } catch (_) {}
  try { state.connection.destroy(); } catch (_) {}

  guildStates.delete(guildId);
  return true;
}

// ─── Changer le volume (0.0 → 1.0) ──────────────────────────
function setVolume(guildId, ratio) {
  const state = guildStates.get(guildId);
  if (!state) return false;

  state.volume = Math.max(0, Math.min(1, ratio));
  try {
    const resource = state.player.state?.resource;
    if (resource?.volume) resource.volume.setVolume(state.volume);
  } catch (_) {}

  return true;
}

// ─── Passer à la piste suivante ──────────────────────────────
async function skipTrack(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return false;
  await playNext(guildId);
  return true;
}

// ─── État actuel ─────────────────────────────────────────────
function getState(guildId) {
  return guildStates.get(guildId) || null;
}

// ─── Initialisation automatique au démarrage ─────────────────
async function autoInit(client, guildId) {
  try {
    await new Promise(r => setTimeout(r, 20_000));

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      console.log('[CasinoMusic] Guild introuvable dans le cache — skip auto-init');
      return;
    }

    const channel = findCasinoVoiceChannel(guild);
    if (!channel) {
      console.log('[CasinoMusic] Aucun salon vocal casino détecté — utilisez /casino-musique play');
      return;
    }

    const result = await startMusic(guild, channel.id);
    if (result.success && !result.alreadyPlaying) {
      console.log(`[CasinoMusic] ✅ Auto-démarrage réussi dans #${channel.name} (${channel.id})`);
    }
  } catch (err) {
    console.error('[CasinoMusic] Erreur autoInit:', err?.message || err);
  }
}

module.exports = {
  startMusic,
  stopMusic,
  setVolume,
  skipTrack,
  getState,
  autoInit,
  findCasinoVoiceChannel,
  CASINO_PLAYLIST,
};
