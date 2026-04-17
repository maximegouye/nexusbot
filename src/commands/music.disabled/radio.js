const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateQueue } = require('../../utils/musicManager');
const { queues } = require('../../utils/musicManager');

const STATIONS = [
  { name: '🎵 NRJ',           genre: 'Pop/Hits',      url: 'https://scdn.nrjaudio.fm/adwz1/fr/30001/aac_64.mp3', flag: '🇫🇷' },
  { name: '🎵 Fun Radio',      genre: 'Électro/Dance', url: 'https://streaming.radio.funradio.fr/fun-1-44-128', flag: '🇫🇷' },
  { name: '🎵 Virgin Radio',   genre: 'Rock/Hits',     url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', flag: '🇫🇷' },
  { name: '🎵 FIP',            genre: 'Eclectique',    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', flag: '🇫🇷' },
  { name: '🎵 France Info',    genre: 'Infos',         url: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3', flag: '🇫🇷' },
  { name: '🎵 Lofi Hip-Hop',   genre: 'Lofi/Chill',    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv', flag: '🌍' },
  { name: '🎵 Jazz Radio',     genre: 'Jazz',          url: 'https://jazz.stream.laut.fm/jazz', flag: '🌍' },
  { name: '🎵 Classic FM',     genre: 'Classique',     url: 'http://media-ice.musicradio.com/ClassicFMMP3', flag: '🇬🇧' },
  { name: '🎵 Chillhop',       genre: 'Chillhop',      url: 'https://stream.chillhop.com/stream/128kbps', flag: '🌍' },
  { name: '🎵 Radio Metal',    genre: 'Metal',         url: 'https://streaming.radio-metal.com/metal', flag: '🇫🇷' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('📻 Écouter une radio en direct')
    .addStringOption(o => o.setName('station').setDescription('Choisir une station').setRequired(true)
      .addChoices(...STATIONS.map((s, i) => ({ name: `${s.flag} ${s.name.replace('🎵 ','')} — ${s.genre}`, value: String(i) }))))
    .addSubcommand ? undefined : undefined,

  async execute(interaction) {
    if (!interaction.member?.voice?.channel) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Rejoins un salon vocal d\'abord !')], ephemeral: true });
    }

    const idx     = parseInt(interaction.options.getString('station'));
    const station = STATIONS[idx];
    if (!station) return interaction.reply({ content: '❌ Station inconnue.', ephemeral: true });

    await interaction.deferReply();

    const track = {
      title: `📻 ${station.name} — ${station.genre}`,
      url: station.url,
      duration: 0,  // live = 0
      thumbnail: null,
      requester: interaction.user.id,
      isRadio: true,
    };

    const queue = await getOrCreateQueue(interaction);
    if (!queue) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Impossible de rejoindre le salon vocal.')] });

    // Arrêter ce qui joue et jouer la radio directement
    queue.tracks = [];
    await queue.addTrack(track);

    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('📻 Radio en direct')
      .setDescription(`**${station.flag} ${station.name}**\n*${station.genre}*`)
      .addFields(
        { name: '🎵 Genre', value: station.genre, inline: true },
        { name: '👤 Lancé par', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: 'Utilise /stop pour arrêter la radio' });

    return interaction.editReply({ embeds: [embed] });
  }
};
