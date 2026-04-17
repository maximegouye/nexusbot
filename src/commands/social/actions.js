const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');

// APIs GIF gratuites (nekos.best)
const ACTION_DATA = {
  hug:   { label: '🤗 câliné',   verb: 'fait un câlin à',  api: 'hug',   color: '#FF9AA2' },
  pat:   { label: '😊 tapoté',   verb: 'tape la tête de',  api: 'pat',   color: '#FFDAC1' },
  kiss:  { label: '😘 embrassé', verb: 'embrasse',         api: 'kiss',  color: '#FF6B6B' },
  slap:  { label: '😤 giflé',    verb: 'gifle',            api: 'slap',  color: '#E76F51' },
  wave:  { label: '👋 salué',    verb: 'salue',            api: 'wave',  color: '#7B2FBE' },
  poke:  { label: '👉 poussé',   verb: 'pousse',           api: 'poke',  color: '#A8DADC' },
  cuddle:{ label: '🥰 câliné',   verb: 'se blottit contre',api:'cuddle', color: '#FFB7B2' },
  punch: { label: '👊 pris un coup', verb: 'envoie un coup à', api:'punch',color: '#E63946' },
};

async function fetchGif(action) {
  try {
    const res = await fetch(`https://nekos.best/api/v2/${action}`, { timeout: 5000 });
    const json = await res.json();
    return json.results?.[0]?.url || null;
  } catch { return null; }
}

const cooldowns = new Map();

function makeCooldownKey(userId, action) { return `${userId}:${action}`; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('action')
    .setDescription('😊 Actions sociales avec GIF animé')
    .addStringOption(o => o.setName('type').setDescription('Type d\'action').setRequired(true)
      .addChoices(
        { name: '🤗 Câlin (hug)', value: 'hug' },
        { name: '😊 Tapoter (pat)', value: 'pat' },
        { name: '😘 Embrasser (kiss)', value: 'kiss' },
        { name: '😤 Gifler (slap)', value: 'slap' },
        { name: '👋 Saluer (wave)', value: 'wave' },
        { name: '👉 Pousser (poke)', value: 'poke' },
        { name: '🥰 Se blottir (cuddle)', value: 'cuddle' },
        { name: '👊 Donner un coup (punch)', value: 'punch' },
      ))
    .addUserOption(o => o.setName('cible').setDescription('Membre ciblé').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Message optionnel').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const type   = interaction.options.getString('type');
    const target = interaction.options.getUser('cible');
    const msg    = interaction.options.getString('message');
    const data   = ACTION_DATA[type];

    if (!data) return interaction.editReply({ content: '❌ Action inconnue.' });

    // Cooldown 5s
    const key = makeCooldownKey(interaction.user.id, type);
    const last = cooldowns.get(key) || 0;
    if (Date.now() - last < 5000) {
      return interaction.editReply({ content: `⏳ Attends encore quelques secondes !` });
    }
    cooldowns.set(key, Date.now());

    const gif = await fetchGif(data.api);

    const embed = new EmbedBuilder()
      .setColor(data.color)
      .setTitle(`${data.label.split(' ')[0]} Action !`)
      .setDescription(`**${interaction.user.username}** ${data.verb} **${target.username}** !${msg ? `\n\n*"${msg}"*` : ''}`)
      .setFooter({ text: `${interaction.user.username} → ${target.username}` });

    if (gif) embed.setImage(gif);

    return interaction.editReply({ embeds: [embed] });
  }
};
