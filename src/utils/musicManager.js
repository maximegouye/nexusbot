/**
 * NexusBot v2 — Gestionnaire de musique
 * Utilise @discordjs/voice + play-dl
 */
const {
  createAudioPlayer, createAudioResource,
  joinVoiceChannel, AudioPlayerStatus,
  VoiceConnectionStatus, entersState,
  StreamType
} = require('@discordjs/voice');
const play = require('play-dl');
const { EmbedBuilder } = require('discord.js');

// Map guild_id → MusicQueue
const queues = new Map();

class MusicQueue {
  constructor(guild, textChannel, voiceChannel) {
    this.guild       = guild;
    this.textChannel = textChannel;
    this.voiceChannel = voiceChannel;
    this.connection  = null;
    this.player      = createAudioPlayer();
    this.tracks      = []; // { title, url, duration, thumbnail, requester }
    this.current     = null;
    this.volume      = 80;  // 0-100
    this.loop        = 'none'; // none | track | queue
    this.playing     = false;

    this.player.on(AudioPlayerStatus.Idle, () => this._next());
    this.player.on('error', err => {
      console.error('[MUSIC] Player error:', err.message);
      this._next();
    });
  }

  async _next() {
    if (this.loop === 'track' && this.current) {
      await this._play(this.current);
      return;
    }
    if (this.loop === 'queue' && this.current) {
      this.tracks.push(this.current);
    }
    if (this.tracks.length === 0) {
      this.current = null;
      this.playing = false;
      setTimeout(() => {
        if (!this.playing && this.connection) {
          this.connection.destroy();
          queues.delete(this.guild.id);
        }
      }, 60000); // quitter après 1 min d'inactivité
      return;
    }
    const track = this.tracks.shift();
    await this._play(track);
  }

  async _play(track) {
    try {
      const stream = await play.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
        inlineVolume: true,
      });
      resource.volume.setVolumeLogarithmic(this.volume / 100);
      this.current = track;
      this.playing = true;
      this.player.play(resource);
      this._sendNowPlaying(track);
    } catch (err) {
      console.error('[MUSIC] Erreur lecture:', err.message);
      this.current = null;
      await this._next();
    }
  }

  _sendNowPlaying(track) {
    try {
      const bar = this._progressBar(0, track.duration);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🎵 En lecture')
        .setDescription(`**[${track.title}](${track.url})**`)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: '⏱️ Durée', value: formatDuration(track.duration), inline: true },
          { name: '🔊 Volume', value: `${this.volume}%`, inline: true },
          { name: '🔁 Loop', value: this.loop === 'none' ? 'Off' : this.loop === 'track' ? 'Titre' : 'File', inline: true },
          { name: '📋 File', value: `${this.tracks.length} titre(s) suivant(s)`, inline: true },
          { name: '👤 Demandé par', value: `<@${track.requester}>`, inline: true },
        )
        .setFooter({ text: 'NexusBot Music v2' });
      this.textChannel.send({ embeds: [embed] }).catch(() => {});
    } catch {}
  }

  _progressBar(current, total) {
    const len = 15;
    if (!total) return '▬'.repeat(len);
    const filled = Math.round((current / total) * len);
    return '█'.repeat(filled) + '▬'.repeat(len - filled);
  }

  async addTrack(track) {
    this.tracks.push(track);
    if (!this.playing) await this._next();
  }

  skip() {
    this.player.stop();
  }

  pause() {
    this.player.pause();
  }

  resume() {
    this.player.unpause();
  }

  setVolume(vol) {
    this.volume = Math.min(100, Math.max(0, vol));
    try {
      const resource = this.player.state?.resource;
      if (resource?.volume) resource.volume.setVolumeLogarithmic(this.volume / 100);
    } catch {}
  }

  setLoop(mode) {
    this.loop = mode;
  }

  getQueue() {
    return this.tracks;
  }

  stop() {
    this.tracks = [];
    this.loop = 'none';
    this.player.stop();
    if (this.connection) {
      this.connection.destroy();
    }
    queues.delete(this.guild.id);
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }
}

function formatDuration(secs) {
  if (!secs) return 'Live';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

async function getOrCreateQueue(interaction) {
  const member = interaction.member;
  const vc = member?.voice?.channel;
  if (!vc) return null;

  let queue = queues.get(interaction.guild.id);
  if (!queue) {
    queue = new MusicQueue(interaction.guild, interaction.channel, vc);
    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    queue.connection = connection;
    connection.subscribe(queue.player);
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      connection.destroy();
      return null;
    }
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        queue.stop();
      }
    });
    queues.set(interaction.guild.id, queue);
  }
  return queue;
}

module.exports = { queues, MusicQueue, getOrCreateQueue, formatDuration };
