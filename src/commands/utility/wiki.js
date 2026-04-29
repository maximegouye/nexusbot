/**
 * NexusBot — Recherche Wikipédia
 * /wiki — Recherchez des informations sur Wikipédia directement dans Discord !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

function fetchWiki(query) {
  return new Promise((resolve, reject) => {
    const url = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    https.get(url, { headers: { 'User-Agent': 'NexusBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

function fetchWikiSearch(query) {
  return new Promise((resolve, reject) => {
    const url = `https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json`;
    https.get(url, { headers: { 'User-Agent': 'NexusBot/1.0' } }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}


// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('📚 Rechercher sur Wikipédia')
    .addSubcommand(s => s.setName('rechercher')
      .setDescription('🔍 Rechercher un article')
      .addStringOption(o => o.setName('requete').setDescription('Votre recherche').setRequired(true).setMaxLength(200)))
    .addSubcommand(s => s.setName('aleatoire').setDescription('🎲 Article aléatoire du jour')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();

    if (sub === 'aleatoire') {
      const articles = ['Chat', 'Cheval', 'Soleil', 'Révolution_française', 'Tour_Eiffel', 'Pythagore', 'Piano', 'Football', 'Amazone_(fleuve)', 'ADN'];
      const random   = articles[Math.floor(Math.random() * articles.length)];

      try {
        const data = await fetchWiki(random);
        const embed = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle(`📚 Article Aléatoire — ${data.title}`)
          .setDescription((data.extract || 'Pas de résumé disponible.').slice(0, 1000))
          .setURL(data.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${encodeURIComponent(data.title)}`);
        if (data.thumbnail?.source) embed.setThumbnail(data.thumbnail.source);
        embed.setFooter({ text: 'Source : Wikipédia Français' });
        return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
      } catch {
        return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible de récupérer un article aléatoire.' });
      }
    }

    if (sub === 'rechercher') {
      const query = interaction.options.getString('requete');

      try {
        // Essayer d'abord la recherche directe
        const data = await fetchWiki(query.replace(/ /g, '_'));

        if (data.type === 'disambiguation') {
          // Page de désambiguïsation
          const results = await fetchWikiSearch(query);
          const titles  = results[1] || [];
          const urls    = results[3] || [];
          const embed   = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle(`🔍 Plusieurs résultats pour "${query}"`)
            .setDescription(titles.slice(0,5).map((t,i) => `**${i+1}.** [${t}](${urls[i]})`).join('\n'))
            .setFooter({ text: 'Précisez votre recherche pour un résultat plus précis.' });
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
        }

        if (!data.title || data.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
          throw new Error('Not found');
        }

        const extract = (data.extract || '').slice(0, 1000);
        const embed   = new EmbedBuilder()
          .setColor('#3498db')
          .setTitle(`📚 ${data.title}`)
          .setDescription(extract || 'Pas de résumé disponible.')
          .setURL(data.content_urls?.desktop?.page || `https://fr.wikipedia.org/wiki/${encodeURIComponent(data.title)}`);

        if (data.thumbnail?.source) embed.setThumbnail(data.thumbnail.source);
        if (data.description) embed.addFields({ name: '📝 Description', value: data.description, inline: false });
        embed.setFooter({ text: 'Source : Wikipédia Français | Cliquez sur le titre pour en savoir plus' });
        return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });

      } catch {
        // Recherche alternative
        try {
          const results = await fetchWikiSearch(query);
          const titles  = results[1] || [];
          const descs   = results[2] || [];
          const urls    = results[3] || [];

          if (!titles.length) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun résultat trouvé pour **"${query}"** sur Wikipédia.` });

          const embed = new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle(`🔍 Résultats de recherche : "${query}"`)
            .setDescription(titles.slice(0,5).map((t,i) => `**${i+1}.** [${t}](${urls[i]})${descs[i] ? `\n> ${descs[i].slice(0,80)}` : ''}`).join('\n\n'))
            .setFooter({ text: 'Source : Wikipédia Français' });
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
        } catch {
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun résultat pour **"${query}"**. Essayez avec d'autres termes.` });
        }
      }
    }
  },

  name: 'wiki',
  aliases: ['wikipedia', 'wp'],
  async run(message, args) {
    const sub   = args[0] === 'aleatoire' ? 'aleatoire' : 'rechercher';
    const query = sub === 'rechercher' ? args.join(' ') : null;
    const fake = mkFake(message, {
      getSubcommand: () => sub,
      getString: (k) => k === 'requete' ? query : null,
    });
    await this.execute(fake);
  },

};
