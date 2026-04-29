const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const node_fetch = require('node-fetch');

const ACTION_DATA = {
  hug: {
    label: '🤗 Hugs (hug)',
    verb: 'serre dans ses bras',
    color: '#FF69B4',
    api: 'https://api.waifu.pics/sfw/hug',
  },
  kiss: {
    label: '😘 Embrasser (kiss)',
    verb: 'embrasse',
    color: '#FF1493',
    api: 'https://api.waifu.pics/sfw/kiss',
  },
  slap: {
    label: '😤 Gifler (slap)',
    verb: 'gifle',
    color: '#FF4500',
    api: 'https://api.waifu.pics/sfw/slap',
  },
  wave: {
    label: '👋 Saluer (wave)',
    verb: 'salue',
    color: '#FFD700',
    api: 'https://api.waifu.pics/sfw/wave',
  },
  poke: {
    label: '👉 Pousser (poke)',
    verb: 'pique',
    color: '#1E90FF',
    api: 'https://api.waifu.pics/sfw/poke',
  },
  cuddle: {
    label: '🥰 Se blottir (cuddle)',
    verb: 'se blottit contre',
    color: '#FFB6C1',
    api: 'https://api.waifu.pics/sfw/cuddle',
  },
  punch: {
    label: '👊 Donner un coup (punch)',
    verb: 'frappe',
    color: '#DC143C',
    api: 'https://api.waifu.pics/sfw/punch',
  },
};

const cooldowns = new Map();

function makeCooldownKey(userId, actionType) {
  return `${userId}:${actionType}`;
}

async function fetchGif(apiUrl) {
  try {
    const resp = await node_fetch(apiUrl, { timeout: 5000 });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.url || null;
  } catch {
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('actions')
    .setDescription('Effectue une action sur un autre membre.')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('Type d\'action')
        .setRequired(true)
        .addChoices(
          { name: '🤗 Serrer dans les bras (hug)', value: 'hug' },
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
    await interaction.deferReply().catch(() => {});
    const type   = interaction.options.getString('type');
    const target = interaction.options.getUser('cible');
    const msg    = interaction.options.getString('message');
    const data   = ACTION_DATA[type];

    if (!data) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Action inconnue.' });

    const key = makeCooldownKey(interaction.user.id, type);
    const last = cooldowns.get(key) || 0;
    if (Date.now() - last < 5000) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⏳ Attends encore quelques secondes !` });
    }
    cooldowns.set(key, Date.now());

    const gif = await fetchGif(data.api);

    const embed = new EmbedBuilder()
      .setColor(data.color)
      .setTitle(`${data.label.split(' ')[0]} Action !`)
      .setDescription(`**${interaction.user.username}** ${data.verb} **${target.username}** !${msg ? `\n\n*"${msg}"*` : ''}`)
      .setFooter({ text: `${interaction.user.username} → ${target.username}` });

    if (gif) embed.setImage(gif);

    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
  },

  async run(message, args) {
    const [actionName, ...targetParts] = args;
    const target = message.mentions.users.first();
    const customMsg = targetParts.join(' ');
    
    if (!actionName || !target) {
      return message.reply('❌ Usage: &actions <action> <@user> [message]');
    }
    
    const fakeInteraction = {
      user: message.author,
      member: message.member,
      guild: message.guild,
      guildId: message.guildId,
      channel: message.channel,
      deferred: false,
      replied: false,
      options: {
        getString: (key) => key === 'type' ? actionName : (key === 'message' ? customMsg : null),
        getUser: (key) => key === 'cible' ? target : null,
      },
      async deferReply() { this.deferred = true; },
      async reply(opts) { return await message.channel.send(opts).catch(() => {}); },
      async editReply(opts) { return await message.channel.send(opts).catch(() => {}); },
    };
    await this.execute(fakeInteraction);
  },
};
