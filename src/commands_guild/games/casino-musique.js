// ============================================================
// casino-musique.js — Commande musique d'ambiance casino
// Emplacement : src/commands_guild/games/casino-musique.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const db = require('../../database/db');

// ─── Gestion des connexions actives ───────────────────────────
// Clé: `${guildId}`, Valeur: { connection, player, stream }
const activeConnections = new Map();

// ─── Utilitaire pour rejoindre et jouer de la musique ─────────
async function tryPlayCasinoMusic(client, interaction) {
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const voiceChannel = interaction.member?.voice?.channel;

    // Vérifier que l'utilisateur est dans un salon vocal
    if (!voiceChannel) {
      return false; // L'utilisateur n'est pas dans un salon vocal
    }

    // Vérifier si la musique est déjà en cours dans ce guild
    if (activeConnections.has(guildId)) {
      return true; // Déjà en cours, pas d'erreur à signaler
    }

    // Trouver une track de musique casino/jazz
    let track = null;
    try {
      const results = await playdl.search('casino jazz ambiance music lofi', {
        source: { youtube: 'video' },
        limit: 3,
      });

      if (results && results.length > 0) {
        track = results[0];
      }
    } catch (searchErr) {
      console.error('[CASINO-MUSIQUE] Erreur recherche playdl:', searchErr?.message || searchErr);
      return false;
    }

    if (!track) {
      return false; // Aucune track trouvée
    }

    // Rejoindre le salon vocal
    let connection;
    try {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      });

      // Attendre que la connexion soit prête
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (joinErr) {
      console.error('[CASINO-MUSIQUE] Erreur connexion vocale:', joinErr?.message || joinErr);
      return false;
    }

    // Créer le lecteur audio et la ressource
    let audioResource;
    try {
      const stream = await playdl.stream(track);
      audioResource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });
    } catch (streamErr) {
      console.error('[CASINO-MUSIQUE] Erreur stream:', streamErr?.message || streamErr);
      connection.destroy();
      return false;
    }

    // Créer et configurer le lecteur
    const player = createAudioPlayer();
    player.play(audioResource);
    connection.subscribe(player);

    // Gestion des erreurs du lecteur
    player.on('error', (err) => {
      console.error('[CASINO-MUSIQUE] Erreur lecteur:', err?.message || err);
      connection.destroy();
      activeConnections.delete(guildId);
    });

    // Boucle infinie : rejouer quand la musique se termine
    player.on(AudioPlayerStatus.Idle, async () => {
      try {
        const newResults = await playdl.search('casino jazz ambiance music lofi', {
          source: { youtube: 'video' },
          limit: 1,
        });

        if (newResults && newResults.length > 0) {
          const newTrack = newResults[0];
          const newStream = await playdl.stream(newTrack);
          const newResource = createAudioResource(newStream.stream, {
            inputType: newStream.type,
          });
          player.play(newResource);
        } else {
          // Pas de nouvelle track, on arrête
          connection.destroy();
          activeConnections.delete(guildId);
        }
      } catch (replayErr) {
        console.error('[CASINO-MUSIQUE] Erreur replay:', replayErr?.message || replayErr);
        connection.destroy();
        activeConnections.delete(guildId);
      }
    });

    // Enregistrer la connexion active
    activeConnections.set(guildId, { connection, player, stream: track });

    return true; // Succès
  } catch (err) {
    console.error('[CASINO-MUSIQUE] tryPlayCasinoMusic erreur globale:', err?.message || err);
    return false;
  }
}

// ─── Commande principale ──────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino-musique')
    .setDescription('🎵 Ambiance musicale casino pour vos jeux')
    .addStringOption(o =>
      o
        .setName('action')
        .setDescription('Que voulez-vous faire ?')
        .setRequired(true)
        .addChoices(
          { name: '▶️ Jouer', value: 'play' },
          { name: '⏹️ Arrêter', value: 'stop' },
          { name: '🔊 Volume', value: 'volume' },
        ),
    )
    .addIntegerOption(o =>
      o
        .setName('volume')
        .setDescription('Niveau de volume (0-100) pour l\'action volume')
        .setMinValue(0)
        .setMaxValue(100),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const action = interaction.options.getString('action');
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // ─── Action: PLAY ───────────────────────────────────────
    if (action === 'play') {
      const voiceChannel = interaction.member?.voice?.channel;

      if (!voiceChannel) {
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('🔴 Erreur')
          .setDescription('❌ Vous devez être dans un salon vocal pour écouter la musique !');
        return interaction.editReply({ embeds: [embed] });
      }

      // Vérifier si déjà en cours
      if (activeConnections.has(guildId)) {
        const embed = new EmbedBuilder()
          .setColor('#FFB347')
          .setTitle('⚠️ Musique en cours')
          .setDescription('🎵 La musique casino est déjà en cours dans ce serveur !');
        return interaction.editReply({ embeds: [embed] });
      }

      // Lancer la musique
      const success = await tryPlayCasinoMusic(interaction.client, interaction);

      if (success) {
        const embed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('✅ Musique lancée')
          .setDescription('🎵 **Ambiance casino activée !**\n\nUne musique jazz/lofi douce se joue en boucle dans votre salon vocal.')
          .addFields(
            { name: '🔊 Volume par défaut', value: '50%', inline: true },
            { name: '🔁 Mode', value: 'Boucle infinie', inline: true },
            { name: '⏹️ Commande stop', value: 'Utilisez `/casino-musique action: stop`', inline: false },
          )
          .setFooter({ text: 'Musique casino · Ambiance de jeu' });
        return interaction.editReply({ embeds: [embed] });
      } else {
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Erreur')
          .setDescription('Impossible de lancer la musique. Vérifiez votre connexion Internet ou réessayez plus tard.');
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ─── Action: STOP ───────────────────────────────────────
    if (action === 'stop') {
      const connection = activeConnections.get(guildId);

      if (!connection) {
        const embed = new EmbedBuilder()
          .setColor('#FFB347')
          .setTitle('⚠️ Aucune musique')
          .setDescription('Aucune musique casino n\'est actuellement en cours sur ce serveur.');
        return interaction.editReply({ embeds: [embed] });
      }

      try {
        connection.player.stop(true);
        connection.connection.destroy();
        activeConnections.delete(guildId);

        const embed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('✅ Musique arrêtée')
          .setDescription('⏹️ La musique casino a été arrêtée et le bot a quitté le salon vocal.');
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[CASINO-MUSIQUE] Erreur arrêt:', err?.message || err);
        activeConnections.delete(guildId);

        const embed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('✅ Arrêt demandé')
          .setDescription('⏹️ L\'arrêt a été traité.');
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // ─── Action: VOLUME ─────────────────────────────────────
    if (action === 'volume') {
      const volumeLevel = interaction.options.getInteger('volume');

      if (volumeLevel === null) {
        const embed = new EmbedBuilder()
          .setColor('#FFB347')
          .setTitle('⚠️ Volume non spécifié')
          .setDescription('Veuillez spécifier un niveau de volume entre 0 et 100.');
        return interaction.editReply({ embeds: [embed] });
      }

      const connection = activeConnections.get(guildId);

      if (!connection) {
        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Pas de musique')
          .setDescription('Aucune musique casino n\'est actuellement en cours.');
        return interaction.editReply({ embeds: [embed] });
      }

      try {
        // Convertir 0-100 en ratio 0-1
        const ratio = volumeLevel / 100;
        connection.player.volume.setVolume(ratio);

        const embed = new EmbedBuilder()
          .setColor('#4CAF50')
          .setTitle('🔊 Volume ajusté')
          .setDescription(`Volume défini à **${volumeLevel}%**\n\n${'█'.repeat(Math.floor(volumeLevel / 10))}${'░'.repeat(10 - Math.floor(volumeLevel / 10))} ${volumeLevel}%`);
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[CASINO-MUSIQUE] Erreur volume:', err?.message || err);

        const embed = new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('❌ Erreur')
          .setDescription('Impossible d\'ajuster le volume.');
        return interaction.editReply({ embeds: [embed] });
      }
    }
  },

  // Exportation de la fonction utilitaire pour les jeux casino
  tryPlayCasinoMusic,

  // Map partagée pour les jeux qui veulent vérifier si la musique est active
  activeConnections,

  // Pas de handleComponent puisque pas de boutons/modals
};
