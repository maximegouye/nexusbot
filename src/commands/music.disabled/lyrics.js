const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { queues } = require('../../utils/musicManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('📝 Afficher les paroles de la musique en cours ou d\'une chanson')
    .addStringOption(o => o.setName('chanson').setDescription('Titre + artiste (ex: "Bohemian Rhapsody Queen")').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply().catch(() => {});

    let query = interaction.options.getString('chanson');

    // Si pas de query, utiliser la musique en cours
    if (!query) {
      const queue = queues.get(interaction.guildId);
      if (!queue?.current) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune musique en cours. Spécifie un titre avec `/lyrics chanson: ...`' });
      query = queue.current.title;
    }

    // Nettoyer le titre (supprimer parenthèses, official video, etc.)
    const clean = query
      .replace(/\(.*?\)/gi, '')
      .replace(/\[.*?\]/gi, '')
      .replace(/(official|video|audio|lyrics|hd|hq|mv|ft\.|feat\.|prod\.?.*)/gi, '')
      .trim();

    // Essayer de parser "titre - artiste"
    let title, artist;
    if (clean.includes(' - ')) {
      [artist, title] = clean.split(' - ', 2).map(s => s.trim());
    } else {
      title = clean; artist = '';
    }

    try {
      const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || title)}/${encodeURIComponent(artist ? title : clean)}`;
      const res  = await fetch(url, { timeout: 8000 });
      const json = await res.json();

      if (!json.lyrics) throw new Error('not found');

      const lyrics = json.lyrics.trim();
      const chunks = [];
      let i = 0;
      while (i < lyrics.length) { chunks.push(lyrics.slice(i, i + 1800)); i += 1800; }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📝 Paroles — ${query.slice(0, 100)}`)
        .setDescription(chunks[0])
        .setFooter({ text: `Page 1/${chunks.length} • Source: lyrics.ovh` });

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });

      // Pages supplémentaires
      for (let p = 1; p < Math.min(chunks.length, 5); p++) {
        await interaction.followUp({ embeds: [new EmbedBuilder()
          .setColor('#7B2FBE')
          .setDescription(chunks[p])
          .setFooter({ text: `Page ${p+1}/${chunks.length}` })
        ]});
      }
    } catch {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('Red')
        .setTitle('❌ Paroles introuvables')
        .setDescription(`Impossible de trouver les paroles pour **${query}**.\n\nEssaie avec le format: \`Artiste - Titre\``)
      ]});
    }
  }
};
