// ============================================================
// casinoMusicManager.js — Gestionnaire de musique casino permanent
// Emplacement : src/utils/casinoMusicManager.js
// ============================================================

const { ChannelType } = require('discord.js');

let _voice = null;
let _playdl = null;

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

// ─── Background retry state ───────────────────────────────────
let _bgRetryActive = false;

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

// ─── Joindre le vocal avec retry (3 tentatives) ──────────────
async function joinWithRetry(guild, channel, maxAttempts = 3) {
  const v = voice();
  let lastErr = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // stateHistory DOIT être déclarée AVANT le try (block scoping JS)
    const stateHistory = [`attempt${attempt}:initial`];
    let connection;

    try {
      // Vérification permissions avant chaque tentative
      const me = guild.members.me;
      if (me) {
        const perms = channel.permissionsFor(me);
        if (!perms?.has('Connect') || !perms?.has('Speak')) {
          throw new Error(`Permissions insuffisantes (Connect/Speak) dans #${channel.name}`);
        }
      }

      connection = v.joinVoiceChannel({
        channelId:      channel.id,
        guildId:        guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf:       true,
      });

      connection.on('stateChange', (oldS, newS) => {
        stateHistory.push(newS.status);
      });

      await v.entersState(connection, v.VoiceConnectionStatus.Ready, 30_000);
      console.log(`[CasinoMusic] ✅ Connexion ready (tentative ${attempt}) — ${stateHistory.join('→')}`);
      return { connection, stateHistory: stateHistory.join('→') };

    } catch (err) {
      lastErr = err;
      const hist = stateHistory.join('→');
      console.warn(`[CasinoMusic] ⚠️ Tentative ${attempt}/${maxAttempts} échouée — ${hist} — ${err?.message}`);
      try { connection?.destroy(); } catch (_) {}

      if (attempt < maxAttempts) {
        const delay = 3000 * attempt; // 3s puis 6s
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error(lastErr?.message || 'Impossible de rejoindre le salon vocal');
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

  // Déjà actif et connexion vivante → rien à faire
  if (guildStates.has(guildId)) {
    const existing = guildStates.get(guildId);
    const v = voice();
    const status = existing.connection?.state?.status;
    if (status && status !== v.VoiceConnectionStatus.Destroyed) {
      return { success: true, alreadyPlaying: true, channelId: existing.channelId };
    }
    // Connexion morte → nettoyer
    try { existing.connection?.destroy(); } catch (_) {}
    guildStates.delete(guildId);
  }

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return { success: false, reason: 'Salon vocal introuvable.' };

  const v = voice();
  let connection;

  try {
    const result = await joinWithRetry(guild, channel, 3);
    connection = result.connection;
  } catch (err) {
    console.error('[CasinoMusic] Échec connexion après 3 tentatives:', err?.message);
    return { success: false, reason: 'Impossible de rejoindre le salon vocal.' };
  }

  const player = v.createAudioPlayer({
    behaviors: { noSubscriber: v.NoSubscriberBehavior.Play },
  });

  connection.subscribe(player);

  const state = {
    connection,
    player,
    channelId:      channel.id,
    guildRef:       guild,
    volume:         0.5,
    shuffledList:   shuffle(CASINO_PLAYLIST),
    playlistIndex:  -1,
    currentTrack:   null,
    currentYTTitle: null,
    stopping:       false,
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

  // ── Reconnexion automatique sur Disconnected ───────────────
  connection.on(v.VoiceConnectionStatus.Disconnected, async () => {
    const s = guildStates.get(guildId);
    if (!s || s.stopping) return;

    try {
      await Promise.race([
        v.entersState(connection, v.VoiceConnectionStatus.Signalling, 5_000),
        v.entersState(connection, v.VoiceConnectionStatus.Connecting,  5_000),
      ]);
      console.log(`[CasinoMusic] 🔄 Reconnexion auto réussie (${guildId})`);
    } catch {
      console.log(`[CasinoMusic] 🔁 Reconnexion manuelle dans 6s (${guildId})`);
      try { connection.destroy(); } catch (_) {}
      guildStates.delete(guildId);

      if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
      s.reconnectTimer = setTimeout(async () => {
        try { await startMusic(guild, channelId); }
        catch (e) { console.error('[CasinoMusic] Échec reconnexion manuelle:', e?.message); }
      }, 6_000);
    }
  });

  // ── AUTO-RESTART sur Destroyed ─────────────────────────────
  // Déclenché par: shard Discord RESUMED, kick bot, ou destroy() explicite
  connection.on(v.VoiceConnectionStatus.Destroyed, () => {
    const s = guildStates.get(guildId);
    const wasStopping = s?.stopping || false;
    guildStates.delete(guildId);

    if (!wasStopping) {
      console.log(`[CasinoMusic] ♻️ Connexion détruite (shard reset?) — restart dans 8s (${guildId})`);
      setTimeout(async () => {
        // Vérifier que personne d'autre n'a déjà relancé entre-temps
        if (guildStates.has(guildId)) return;
        try { await startMusic(guild, channelId); }
        catch (e) { console.error('[CasinoMusic] Échec restart après Destroyed:', e?.message); }
      }, 8_000);
    } else {
      console.log(`[CasinoMusic] ⏹️ Connexion détruite proprement — ${guildId}`);
    }
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

// ─── Background retry — tourne toutes les 45s ────────────────
// Si la connexion tombe et que le Destroyed listener ne relance pas (ex: erreur réseau)
async function startBackgroundRetry(client, guildId) {
  if (_bgRetryActive) return;
  _bgRetryActive = true;

  console.log('[CasinoMusic] 🔄 Background retry loop démarré (45s interval)');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise(r => setTimeout(r, 45_000));

    if (guildStates.has(guildId)) continue; // Déjà actif

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = findCasinoVoiceChannel(guild);
      if (!channel) continue;

      console.log('[CasinoMusic] 🔁 Background retry: tentative reconnexion...');
      const result = await startMusic(guild, channel.id);
      if (result.success) {
        console.log(`[CasinoMusic] ✅ Background retry réussi dans #${channel.name}`);
      }
    } catch (e) {
      console.error('[CasinoMusic] Background retry échec:', e?.message);
    }
  }
}

// ─── Appelé quand le shard Discord se reconnecte (RESUMED) ───
async function onShardResume(client, guildId) {
  console.log('[CasinoMusic] 📡 Shard RESUMED — restart musique dans 10s...');

  // Attendre que le shard soit stable et que le Destroyed listener ait eu le temps d'agir
  await new Promise(r => setTimeout(r, 10_000));

  if (guildStates.has(guildId)) {
    console.log('[CasinoMusic] ✅ Déjà reconnecté après shard resume — skip');
    return;
  }

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = findCasinoVoiceChannel(guild);
    if (!channel) return;

    const result = await startMusic(guild, channel.id);
    if (result.success && !result.alreadyPlaying) {
      console.log(`[CasinoMusic] ✅ Reconnexion post-shard-resume réussie dans #${channel.name}`);
    }
  } catch (e) {
    console.error('[CasinoMusic] Erreur reconnexion post-shard-resume:', e?.message);
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
  startBackgroundRetry,
  onShardResume,
  CASINO_PLAYLIST,
};
