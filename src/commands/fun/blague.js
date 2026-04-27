const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

// Blagues embarquées (fallback si l'API externe échoue)
const BLAGUES_FALLBACK = [
  { setup: 'Pourquoi les plongeurs plongent-ils toujours en arrière ?', punchline: 'Parce que sinon ils tomberaient dans le bateau !' },
  { setup: 'Qu\'est-ce qu\'un canif ?', punchline: 'C\'est le petit frère du canif... Non, c\'est un petit fi !' },
  { setup: 'Pourquoi les poissons n\'aiment pas l\'ordinateur ?', punchline: 'Parce qu\'ils ont peur du Net !' },
  { setup: 'Qu\'est-ce qu\'un crocodile qui surveille des grains ?', punchline: 'Un gar-de-riz !' },
  { setup: 'Que dit une baguette à une autre baguette ?', punchline: 'Salut pain !' },
  { setup: 'Pourquoi les fantômes sont de mauvais menteurs ?', punchline: 'Parce qu\'on voit à travers eux !' },
  { setup: 'Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ?', punchline: 'Un chat-peint de Noël !' },
  { setup: 'Quelle est la journée préférée des dents ?', punchline: 'Lundi !' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blague')
    .setDescription('😂 Une blague aléatoire pour mettre l\'ambiance !')
    .addStringOption(o => o.setName('categorie').setDescription('Catégorie de blague').setRequired(false)
      .addChoices(
        { name: '🤣 Général', value: 'global' },
        { name: '💻 Dev', value: 'dev' },
        { name: '😬 Dark (18+)', value: 'dark' },
        { name: '💑 Beauf', value: 'beauf' },
      )),
  cooldown: 5,

  async execute(interaction) {
    const cfg = db.getConfig(interaction.guildId);
    const cat = interaction.options.getString('categorie') || 'global';

    await interaction.deferReply();

    let joke = null;

    // Tenter l'API blagues-api (optionnelle, nécessite BLAGUES_API_KEY dans .env)
    if (process.env.BLAGUES_API_KEY) {
      try {
        const axios = require('axios');
        const res   = await axios.get(`https://www.blagues-api.fr/api/type/${cat}/random`, {
          headers: { Authorization: `Bearer ${process.env.BLAGUES_API_KEY}` },
          timeout: 3000,
        });
        if (res.data?.setup && res.data?.delivery) {
          joke = { setup: res.data.setup, punchline: res.data.delivery };
        }
      } catch {}
    }

    // Fallback local
    if (!joke) {
      joke = BLAGUES_FALLBACK[Math.floor(Math.random() * BLAGUES_FALLBACK.length)];
    }

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle('😂 Blague du moment')
      .setDescription(`**${joke.setup}**\n\n||${joke.punchline}||`)
      .setFooter({ text: '👆 Clique sur || pour révéler la chute !' });

    await interaction.editReply({ embeds: [embed] });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
