const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const { getOrCreateQueue, formatDuration } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Jouer une musique depuis YouTube, Spotify ou SoundCloud')
    .addStringOption(o => o.setName('recherche').setDescription('URL ou nom de la musique').setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('recherche');
    if (!interaction.member.voice?.channel) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Rejoins un salon vocal d\'abord !')] });
    }

    let trackInfo;
    try {
      // Détection du type d'URL ou recherche
      let results;
      const urlType = play.yt_validate(query);
      if (urlType === 'video') {
        const info = await play.video_info(query);
        trackInfo = [{
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationInSec,
          thumbnail: info.video_details.thumbnails?.[0]?.url,
          requester: interaction.user.id,
        }];
      } else if (urlType === 'playlist') {
        const playlist = await play.playlist_info(query, { incomplete: true });
        const videos = await playlist.all_videos();
        trackInfo = videos.slice(0, 50).map(v => ({
          title: v.title,
          url: v.url,
          duration: v.durationInSec,
          thumbnail: v.thumbnails?.[0]?.url,
          requester: interaction.user.id,
        }));
      } else {
        // Recherche par nom
        results = await play.search(query, { source: { youtube: 'video' }, limit: 1 });
        if (!results.length) {
          return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Aucun résultat trouvé.')] });
        }
        trackInfo = [{
          title: results[0].title,
          url: results[0].url,
          duration: results[0].durationInSec,
          thumbnail: results[0].thumbnails?.[0]?.url,
          requester: interaction.user.id,
        }];
      }
    } catch (err) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription(`❌ Erreur: ${err.message}`)] });
    }

    const queue = await getOrCreateQueue(interaction);
    if (!queue) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Impossible de rejoindre le salon vocal.')] });
    }

    for (const track of trackInfo) await queue.addTrack(track);

    if (trackInfo.length === 1) {
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('✅ Ajouté à la file')
        .setDescription(`**[${trackInfo[0].title}](${trackInfo[0].url})**`)
        .setThumbnail(trackInfo[0].thumbnail)
        .addFields(
          { name: '⏱️ Durée', value: formatDuration(trackInfo[0].duration), inline: true },
          { name: '📋 Position', value: `${queue.tracks.length === 0 ? 'En lecture' : `#${queue.tracks.length}`}`, inline: true },
        );
      return interaction.editReply({ embeds: [embed] });
    } else {
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('✅ Playlist ajoutée')
        .setDescription(`**${trackInfo.length} titres** ajoutés à la file d'attente.`);
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
