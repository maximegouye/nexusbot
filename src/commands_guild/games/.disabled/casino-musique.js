// ============================================================
// casino-musique.js — Commande musique casino premium
// Emplacement : src/commands_guild/games/casino-musique.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const {
  startMusic,
  stopMusic,
  setVolume,
  skipTrack,
  getState,
  findCasinoVoiceChannel,
} = require('../../utils/casinoMusicManager');

// ─── Helpers embed ────────────────────────────────────────────
function errorEmbed(msg) {
  return new EmbedBuilder()
    .setColor('#E74C3C')
    .setTitle('❌ Erreur')
    .setDescription(msg)
    .setFooter({ text: 'Casino Music System' });
}

function warnEmbed(title, desc) {
  return new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: 'Casino Music System' });
}

function volumeBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` **${pct}%**`;
}

// ─── Commande principale ──────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino-musique')
    .setDescription('🎵 Système de musique casino — ambiance 24h/24 de haute qualité')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('▶️ Démarrer la musique casino')
        .addChannelOption(o =>
          o.setName('salon')
            .setDescription('Salon vocal (optionnel — sinon auto-détecté)')
            .addChannelTypes(ChannelType.GuildVoice)
        )
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('⏹️ Arrêter la musique et quitter le salon')
    )
    .addSubcommand(sub =>
      sub.setName('skip')
        .setDescription('⏭️ Passer à la piste suivante (playlist aléatoire de 10 styles)')
    )
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('🔊 Régler le volume de la musique')
        .addIntegerOption(o =>
          o.setName('niveau')
            .setDescription('Volume entre 0 et 100')
            .setMinValue(0)
            .setMaxValue(100)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('nowplaying')
        .setDescription('🎶 Afficher la piste en cours de lecture')
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const guild   = interaction.guild;

    // ══════════════════════════════════════════════════════════
    // PLAY
    // ══════════════════════════════════════════════════════════
    if (sub === 'play') {
      // Priorité : option salon > salon de l'utilisateur > auto-détection
      let channel = interaction.options.getChannel('salon')
        || interaction.member?.voice?.channel
        || findCasinoVoiceChannel(guild);

      if (!channel) {
        return interaction.editReply({
          embeds: [errorEmbed('Aucun salon vocal trouvé.\nRejoignez un salon ou utilisez l\'option `salon` pour en préciser un.')],
        });
      }

      // Déjà actif ?
      const existing = getState(guildId);
      if (existing) {
        return interaction.editReply({
          embeds: [warnEmbed(
            '⚠️ Musique déjà active',
            `La musique casino est déjà en cours dans <#${existing.channelId}>.\n\n` +
            `• \`/casino-musique skip\` → changer de piste\n` +
            `• \`/casino-musique stop\` → arrêter\n` +
            `• \`/casino-musique nowplaying\` → voir la piste actuelle`
          )],
        });
      }

      // Message de chargement pendant la connexion
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('⏳ Connexion en cours...')
          .setDescription('🎵 Le bot rejoint le salon vocal et charge la première piste casino...\n\n*Cela peut prendre quelques secondes.*')
          .setFooter({ text: 'Casino Music System · Playlist de 10 styles' })
        ],
      });

      const result = await startMusic(guild, channel.id);

      if (!result.success) {
        return interaction.editReply({
          embeds: [errorEmbed(`Impossible de démarrer la musique :\n\`${result.reason || 'Erreur inconnue'}\`\n\nVérifiez que le bot a les permissions de rejoindre le salon vocal.`)],
        });
      }

      // Attendre 1s pour que la piste se charge
      await new Promise(r => setTimeout(r, 1200));
      const s = getState(guildId);

      const embed = new EmbedBuilder()
        .setColor('#1DB954')
        .setTitle('🎰 Casino Music — En cours !')
        .setDescription(
          `**🎵 Now Playing :**\n> ${s?.currentStation?.title || s?.currentTitle || s?.currentStation?.title || s?.currentTitle || '*Chargement...*'}\n\n` +
          `*La musique tourne en boucle 24h/24 — même quand le salon est vide.*`
        )
        .addFields(
          { name: '📻 Salon',         value: `<#${channel.id}>`,                                  inline: true },
          { name: '🔊 Volume',        value: `${Math.round((s?.volume || 0.5) * 100)}%`,          inline: true },
          { name: '🎭 Style actuel',  value: s?.currentStation?.title || s?.currentTitle || '...',                      inline: true },
          { name: '📡 Source',         value: '10 stations radio · Jazz · Lounge · SomaFM · 24h/24', inline: false },
        )
        .setFooter({ text: 'Casino Music · Musique de haute qualité · Playlist aléatoire infinie' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ══════════════════════════════════════════════════════════
    // STOP
    // ══════════════════════════════════════════════════════════
    if (sub === 'stop') {
      const stopped = stopMusic(guildId);

      if (!stopped) {
        return interaction.editReply({
          embeds: [warnEmbed('⚠️ Aucune musique active', 'Aucune musique casino n\'est en cours sur ce serveur.')],
        });
      }

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('⏹️ Casino Music — Arrêtée')
          .setDescription('La musique a été arrêtée et le bot a quitté le salon vocal.\n\nUtilisez `/casino-musique play` pour relancer.')
          .setTimestamp()
        ],
      });
    }

    // ══════════════════════════════════════════════════════════
    // SKIP
    // ══════════════════════════════════════════════════════════
    if (sub === 'skip') {
      const state = getState(guildId);
      if (!state) {
        return interaction.editReply({
          embeds: [warnEmbed('⚠️ Aucune musique active', 'Démarrez d\'abord la musique avec `/casino-musique play`.')],
        });
      }

      const oldStyle = state.currentStation?.title || state.currentTitle || '...';
      const oldTitle = state.currentYTTitle || oldStyle;

      await skipTrack(guildId);

      // Attendre le chargement de la nouvelle piste
      await new Promise(r => setTimeout(r, 1500));
      const ns = getState(guildId);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('⏭️ Piste suivante')
          .setDescription(
            `**Précédente :** ~~${oldTitle}~~\n\n` +
            `**Maintenant :** 🎵 ${ns?.currentStation?.title || ns?.currentTitle || '*Chargement...*'}`
          )
          .addFields(
            { name: '🎭 Style', value: ns?.currentStation?.title || ns?.currentTitle || '...', inline: true },
            { name: '🔊 Volume', value: `${Math.round((ns?.volume || 0.5) * 100)}%`, inline: true },
          )
          .setTimestamp()
        ],
      });
    }

    // ══════════════════════════════════════════════════════════
    // VOLUME
    // ══════════════════════════════════════════════════════════
    if (sub === 'volume') {
      const niveau = interaction.options.getInteger('niveau');
      const ratio  = niveau / 100;
      const ok     = setVolume(guildId, ratio);

      if (!ok) {
        return interaction.editReply({
          embeds: [warnEmbed('⚠️ Aucune musique active', 'Démarrez d\'abord la musique avec `/casino-musique play`.')],
        });
      }

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🔊 Volume ajusté')
          .setDescription(`\`${volumeBar(niveau)}\``)
          .setTimestamp()
        ],
      });
    }

    // ══════════════════════════════════════════════════════════
    // NOW PLAYING
    // ══════════════════════════════════════════════════════════
    if (sub === 'nowplaying') {
      const state = getState(guildId);

      if (!state) {
        return interaction.editReply({
          embeds: [warnEmbed('⚠️ Aucune musique active', 'Aucune musique casino n\'est en cours.\nUtilisez `/casino-musique play` pour démarrer.')],
        });
      }

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#F39C12')
          .setTitle('🎵 Now Playing — Casino Music')
          .setDescription(`**${state.currentStation?.title || state.currentTitle || 'Chargement...'}**`)
          .addFields(
            { name: '📻 Salon',        value: `<#${state.channelId}>`,                         inline: true },
            { name: '🔊 Volume',       value: volumeBar(Math.round(state.volume * 100)),        inline: true },
            { name: '🎭 Style',        value: state.currentStation?.title || state.currentTitle || '...',               inline: true },
          )
          .setFooter({ text: 'Casino Music · 10 styles · Playlist aléatoire infinie' })
          .setTimestamp()
        ],
      });
    }
  },

  // ─── Compatibilité : appelé par les jeux casino ─────────────
  async tryPlayCasinoMusic(client, interaction) {
    try {
      const guildId = interaction.guildId;
      if (getState(guildId)) return true; // Déjà actif

      const channel = interaction.member?.voice?.channel
        || findCasinoVoiceChannel(interaction.guild);
      if (!channel) return false;

      const result = await startMusic(interaction.guild, channel.id);
      return result.success;
    } catch {
      return false;
    }
  },

  name: 'casino-musique',
  aliases: ['cmusique', 'casinomusic'],
  async run(message, args) {
    return message.reply('❌ Cette commande est uniquement disponible en slash : `/casino-musique`');
  },
};
