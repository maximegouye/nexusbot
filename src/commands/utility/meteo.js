const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

// -- Adaptateur prefixe->interaction
function mkFake(message, opts) {
  opts = opts || {};
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}


function fetchWeather(city) {
  return new Promise((resolve, reject) => {
    const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
    https.get(url, { headers: { 'User-Agent': 'NexusBot/2.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Ville introuvable ou erreur API')); }
      });
    }).on('error', reject);
  });
}

const CONDITIONS = {
  113: '☀️ Ensoleillé', 116: '⛅ Partiellement nuageux', 119: '☁️ Nuageux',
  122: '☁️ Couvert', 143: '🌫️ Brouillard', 176: '🌦️ Averses légères',
  185: '🌨️ Grésil', 200: '⛈️ Orages', 227: '❄️ Blizzard', 230: '❄️ Blizzard fort',
  248: '🌫️ Brouillard', 260: '🌫️ Brouillard glacé', 263: '🌦️ Bruine légère',
  266: '🌦️ Bruine', 281: '🌨️ Grésil', 284: '🌨️ Grésil fort', 293: '🌧️ Pluie légère',
  296: '🌧️ Pluie légère', 299: '🌧️ Pluie modérée', 302: '🌧️ Pluie modérée',
  305: '🌧️ Pluie forte', 308: '🌧️ Pluie forte', 311: '🌧️ Bruine verglaçante',
  314: '🌧️ Bruine verglaçante', 317: '🌨️ Grésil léger', 320: '🌨️ Grésil modéré',
  323: '🌨️ Neige légère', 326: '🌨️ Neige légère', 329: '❄️ Neige modérée',
  332: '❄️ Neige modérée', 335: '❄️ Neige forte', 338: '❄️ Neige forte',
  350: '🌨️ Grêle', 353: '🌦️ Averses légères', 356: '🌧️ Averses',
  359: '🌧️ Averses fortes', 362: '🌧🌨️ Averses de grésil', 365: '🌨️ Averses de grésil',
  368: '🌨️ Averses de neige', 371: '❄️ Averses de neige forte', 374: '🌨️ Averses de grêle',
  377: '🌨️ Averses de grêle', 386: '⛈️ Orages avec pluie', 389: '⛈️ Orages forts',
  392: '⛈️ Orages avec neige', 395: '⛈️ Blizzard',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meteo')
    .setDescription('🌤️ Météo en temps réel pour n\'importe quelle ville')
    .addSubcommand(s => s.setName('actuelle').setDescription('🌡️ Météo actuelle')
      .addStringOption(o => o.setName('ville').setDescription('Nom de la ville').setRequired(true)))
    .addSubcommand(s => s.setName('previsions').setDescription('📅 Prévisions 3 jours')
      .addStringOption(o => o.setName('ville').setDescription('Nom de la ville').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const ville = interaction.options.getString('ville');
    await interaction.deferReply();

    let data;
    try { data = await fetchWeather(ville); }
    catch (e) { return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(`❌ Ville introuvable : **${ville}**. Vérifie l'orthographe.`); }

    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    const cityName = area ? `${area.areaName[0].value}, ${area.country[0].value}` : ville;

    if (sub === 'actuelle') {
      const code = parseInt(current.weatherCode);
      const condition = CONDITIONS[code] || '🌤️ Conditions variables';
      const temp = current.temp_C;
      const feelsLike = current.FeelsLikeC;
      const humidity = current.humidity;
      const wind = current.windspeedKmph;
      const visibility = current.visibility;
      const uv = current.uvIndex;

      const colorMap = { C: '#4FC3F7', H: '#FF7043', M: '#66BB6A' };
      const tempNum = parseInt(temp);
      const color = tempNum < 10 ? '#4FC3F7' : tempNum < 25 ? '#66BB6A' : '#FF7043';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(`${condition} — ${cityName}`)
          .addFields(
            { name: '🌡️ Température', value: `**${temp}°C** (ressenti ${feelsLike}°C)`, inline: true },
            { name: '💧 Humidité', value: `**${humidity}%**`, inline: true },
            { name: '💨 Vent', value: `**${wind} km/h**`, inline: true },
            { name: '👁️ Visibilité', value: `**${visibility} km**`, inline: true },
            { name: '☀️ Index UV', value: `**${uv}**`, inline: true },
          )
          .setFooter({ text: 'Données météo via wttr.in' })
          .setTimestamp()
      ]});
    }

    if (sub === 'previsions') {
      const days = data.weather?.slice(0, 3) || [];
      const fields = days.map(day => {
        const date = new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
        const code = parseInt(day.hourly?.[4]?.weatherCode || 113);
        const cond = CONDITIONS[code] || '🌤️';
        return {
          name: date,
          value: `${cond}\n🌡️ ${day.mintempC}°C → ${day.maxtempC}°C\n💧 ${day.hourly?.[4]?.humidity || '?'}%`,
          inline: true
        };
      });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor('#64B5F6')
          .setTitle(`📅 Prévisions 3 jours — ${cityName}`)
          .addFields(...fields)
          .setFooter({ text: 'Données météo via wttr.in' })
          .setTimestamp()
      ]});
    }
  },
  name: 'meteo2',
  aliases: ["weather", "temps2"],
    async run(message, args) {
    const ville = args.join(' ') || 'Paris';
    const fake = mkFake(message, { getSubcommand: function() { return 'ville'; }, getString: function() { return ville; } });
    await this.execute(fake);
  },
};
