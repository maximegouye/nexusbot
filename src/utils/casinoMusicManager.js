// ============================================================
// casinoMusicManager.js — Gestionnaire de musique casino permanent
// ============================================================

const { ChannelType, PermissionFlagsBits } = require('discord.js');

// Lazy imports pour éviter les crashs au démarrage
let _voice  = null;
let _playdl = null;
let _sodiumReady = false;

async function ensureEncryption() {
  if (_sodiumReady) return;
  try {
    const sodium = require('libsodium-wrappers');
    if (sodium?.ready) await sodium.ready;
    console.log('[CasinoMusic] ✅ libsodium-wrappers prêt');
  } catch {
    console.log('[CasinoMusic] ℹ️ Fallback tweetnacl/opusscript (sans libsodium-wrappers)');
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

// ─── Playlist premium 10 styles ──────────────────────────────
const CASINO_PLAYLIST = [
  { title: '🎷 Casino Jazz Lounge',     query: 'casino jazz lounge music ambient 1 hour' },
  { title: '🎹 Las Vegas Piano Bar',    query: 'las vegas piano bar jazz lounge music' },
  { title: '🃏 Casino Royale Ambiance', query: 'casino royale james bond jazz lounge soundtrack' },
  { title: '🌙 Bossa Nova Casino',      query: 'bossa nova jazz lounge bar smooth elegant' },
  { title: '🎸 Rat Pack Vegas Swing',   query: 'rat pack vegas style jazz swing music sinatra' },
  { title: '🎺 Big Band Casino Night',  query: 'big band swing jazz casino elegant night club' },
  { title: '🥂 Cocktail Jazz Piano',    query: 'cocktail jazz piano lounge elegant ambiance bar' },
  { title: '🎻 Smooth Jazz Sax',        query: 'smooth jazz saxophone evening lounge relaxing' },
  { title: '💎 VIP Lounge Ambiance',    query: 'vip lounge ambient music luxury sophisticated jazz' },
  { title: '🌟 Vegas Nights Jazz',      query: 'vegas nights jazz cool vibes lounge modern' },
];

// ─── État par guild ───────────────────────────────────────────
const guildStates = new Map();

// ─── Fisher-Yates shuffle ─────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Auto-détection salon vocal casino ────────────────────────
function findCasinoVoiceChannel(guild) {
  const PATTERNS = ['casino', 'musique', 'music', 'ambiance', 'lounge', 'jeux', '🎰', '🎵', '🎶'];
  for (const p of PATTERNS) {
    const ch = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildVoice && c.name.toLowerCase().includes(p)
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
    const results = await pd.search(track.query, { source: { youtube: 'video' }, limit: 5 });

    if (!results?.length) {
      console.warn(`[CasinoMusic] Aucun résultat pour "${track.query}" — skip`);
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
    console.log(`[CasinoMusic] 🎵 [${guildId}] "${pick.title}"`);
  } catch (err) {
    console.error(`[CasinoMusic] Erreur lecture "${track.title}":`, err?.message);
    setTimeout(() => playNext(guildId).catch(() => {}), 3000);
  }
}

// ─── Connexion voice avec retry ───────────────────────────────
async function joinWithRetry(guild, channel, maxAttempts = 3) {
  const v      = voice();
  let lastErr  = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Attendre que le shard soit en état Ready
    const shard = guild.shard;
    if (shard && shard.status !== 0 /* Status.Ready = 0 */) {
      console.log(`[CasinoMusic] Shard pas prêt (status=${shard.status}) — attente 3s (tentative ${attempt})`);
      await new Promise(r => setTimeout(r, 3000));
    }

    // Pré-init sodium + céder le tick pour l'IIFE de @discordjs/voice
    await ensureEncryption();
    await new Promise(r => setImmediate(r));

    // Déclarer stateHistory AVANT le try pour qu'il soit accessible dans catch
    const stateHistory = [`attempt${attempt}:initial`];
    let connection;

    try {
      console.log(`[CasinoMusic] Tentative ${attempt}/${maxAttempts} — join ${channel.name} (${guild.id})`);

      connection = v.joinVoiceChannel({
        channelId:      channel.id,
        guildId:        guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf:       true,
      });

      connection.on('stateChange', (oldS, newS) => {
        stateHistory.push(newS.status);
        console.log(`[CasinoMusic] State ${oldS.status} → ${newS.status} (${guild.id})`);
      });

      await v.entersState(connection, v.VoiceConnectionStatus.Ready, 30_000);
      console.log(`[CasinoMusic] ✅ Voice Ready (tentative ${attempt})`);
      return { connection, stateHistory };

    } catch (err) {
      lastErr = err;
      const hist = stateHistory.join('→');
      console.error(`[CasinoMusic] Tentative ${attempt} échouée [${hist}]:`, err?.message);
      try { connection?.destroy(); } catch (_) {}

      if (attempt < maxAttempts) {
        const delay = attempt * 4000; // 4s, 8s...
        console.log(`[CasinoMusic] Retry dans ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        const hist2 = stateHistory.join('→');
        throw Object.assign(new Error(`${err?.message || err}`), { stateHistory: hist2 });
      }
    }
  }
  throw lastErr;
}

// ─── Démarrer la musique ──────────────────────────────────────
async function startMusic(guild, channelId) {
  const guildId = guild.id;

  // Vérifier si déjà actif
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

  // Vérifier les permissions du bot
  const me = guild.members.me || guild.members.cache.get(guild.client.user.id);
  if (me) {
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.Connect)) {
      return { success: false, reason: `Le bot n'a pas la permission de rejoindre <#${channelId}>.` };
    }
    if (!perms?.has(PermissionFlagsBits.Speak)) {
      return { success: false, reason: `Le bot n'a pas la permission de parler dans <#${channelId}>.` };
    }
  }

  let connection, stateHistory;

  try {
    const result = await joinWithRetry(guild, channel, 3);
    connection   = result.connection;
    stateHistory = result.stateHistory;
  } catch (err) {
    const hist = err.stateHistory || 'N/A';
    return { success: false, reason: `Connexion impossible après 3 tentatives.\nDerniers états: \`${hist}\`\nErreur: \`${err?.message || err}\`` };
  }

  const v      = voice();
  const player = v.createAudioPlayer({
    behaviors: { noSubscriber: v.NoSubscriberBehavior.Play },
  });

  connection.subscribe(player);

  const state = {
    connection,
    player,
    channelId,
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

  // Piste suivante automatiquement
  player.on(v.AudioPlayerStatus.Idle, () => {
    const s = guildStates.get(guildId);
    if (s && !s.stopping) playNext(guildId).catch(() => {});
  });
  player.on('error', err => {
    console.error('[CasinoMusic] Player error:', err?.message);
    const s = guildStates.get(guildId);
    if (s && !s.stopping) setTimeout(() => playNext(guildId).catch(() => {}), 2000);
  });

  // Reconnexion automatique sur déconnexion
  connection.on(v.VoiceConnectionStatus.Disconnected, async () => {
    const s = guildStates.get(guildId);
    if (!s || s.stopping) return;
    try {
      await Promise.race([
        v.entersState(connection, v.VoiceConnectionStatus.Signalling, 5_000),
        v.entersState(connection, v.VoiceConnectionStatus.Connecting,  5_000),
      ]);
      console.log(`[CasinoMusic] 🔄 Reconnexion réussie (${guildId})`);
    } catch {
      console.log(`[CasinoMusic] 🔁 Recréation connexion dans 6s... (${guildId})`);
      try { connection.destroy(); } catch (_) {}
      guildStates.delete(guildId);
      if (s.reconnectTimer) clearTimeout(s.reconnectTimer);
      s.reconnectTimer = setTimeout(async () => {
        try { await startMusic(guild, channelId); }
        catch (e) { console.error('[CasinoMusic] Reconnexion complète échouée:', e?.message); }
      }, 6000);
    }
  });

  connection.on(v.VoiceConnectionStatus.Destroyed, () => {
    console.log(`[CasinoMusic] 🗑️ Connexion détruite (${guildId})`);
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

async function skipTrack(guildId) {
  const state = guildStates.get(guildId);
  if (!state) return false;
  await playNext(guildId);
  return true;
}

function getState(guildId) {
  return guildStates.get(guildId) || null;
}

async function autoInit(client, guildId) {
  try {
    await new Promise(r => setTimeout(r, 20_000));
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = findCasinoVoiceChannel(guild);
    if (!channel) return;
    const result = await startMusic(guild, channel.id);
    if (result.success && !result.alreadyPlaying) {
      console.log(`[CasinoMusic] ✅ Auto-démarrage dans #${channel.name}`);
    }
  } catch (err) {
    console.error('[CasinoMusic] autoInit error:', err?.message);
  }
}

// ─── Boucle de retry permanente (appelée une fois au démarrage) ─────────────
let _bgRetryActive = false;

async function startBackgroundRetry(client, guildId) {
  if (_bgRetryActive) return;
  _bgRetryActive = true;

  while (true) {
    await new Promise(r => setTimeout(r, 30_000)); // attendre 30s entre chaque cycle

    if (guildStates.has(guildId)) continue; // déjà actif, rien à faire

    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = findCasinoVoiceChannel(guild);
      if (!channel) continue;

      console.log('[CasinoMusic] 🔄 Background retry — tentative connexion automatique...');
      const result = await startMusic(guild, channel.id);
      if (result.success) {
        console.log('[CasinoMusic] ✅ Background retry réussi !');
      }
    } catch (e) {
      console.log('[CasinoMusic] ⚠️ Background retry échoué:', e?.message);
    }
  }
}

// ─── Redémarrer la musique après shard resume ─────────────
async function onShardResume(client, guildId) {
  if (guildStates.has(guildId)) return; // déjà actif

  console.log('[CasinoMusic] 📡 Shard repris — tentative reconnexion voice dans 8s...');
  await new Promise(r => setTimeout(r, 8_000)); // laisser le shard se stabiliser

  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = findCasinoVoiceChannel(guild);
    if (!channel) return;
    await startMusic(guild, channel.id);
  } catch (e) {
    console.log('[CasinoMusic] onShardResume retry échoué:', e?.message);
  }
}

module.exports = {
  startMusic, stopMusic, setVolume, skipTrack,
  getState, autoInit, findCasinoVoiceChannel, CASINO_PLAYLIST,
  startBackgroundRetry, onShardResume,
};
