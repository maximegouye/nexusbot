const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
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
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


const LANGUES = [
  { name: '🇫🇷 Français', value: 'fr' }, { name: '🇬🇧 Anglais', value: 'en' },
  { name: '🇪🇸 Espagnol', value: 'es' }, { name: '🇩🇪 Allemand', value: 'de' },
  { name: '🇮🇹 Italien', value: 'it' }, { name: '🇵🇹 Portugais', value: 'pt' },
  { name: '🇷🇺 Russe', value: 'ru' }, { name: '🇯🇵 Japonais', value: 'ja' },
  { name: '🇰🇷 Coréen', value: 'ko' }, { name: '🇨🇳 Chinois', value: 'zh' },
  { name: '🇸🇦 Arabe', value: 'ar' }, { name: '🇳🇱 Néerlandais', value: 'nl' },
  { name: '🇵🇱 Polonais', value: 'pl' }, { name: '🇹🇷 Turc', value: 'tr' },
  { name: '🇸🇪 Suédois', value: 'sv' },
];

async function translate(text, targetLang, sourceLang = 'auto') {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encoded}`;
    https.get(url, { headers: { 'User-Agent': 'NexusBot/2.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ text: j[0].map(s => s[0]).filter(Boolean).join(''), detected: j[2] || sourceLang });
        } catch { reject(new Error('Erreur de traduction')); }
      });
    }).on('error', reject);
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('traduction')
    .setDescription('🌍 Traduire du texte en plusieurs langues')
    .addSubcommand(s => s.setName('traduire').setDescription('✍️ Traduire un texte')
      .addStringOption(o => o.setName('texte').setDescription('Texte à traduire').setRequired(true))
      .addStringOption(o => o.setName('vers').setDescription('Langue cible').setRequired(true).addChoices(...LANGUES))
      .addStringOption(o => o.setName('depuis').setDescription('Langue source (auto-détection par défaut)').addChoices(...LANGUES)))
    .addSubcommand(s => s.setName('detecter').setDescription('🔍 Détecter la langue d\'un texte')
      .addStringOption(o => o.setName('texte').setDescription('Texte à analyser').setRequired(true)))
    .addSubcommand(s => s.setName('langues').setDescription('📋 Voir toutes les langues disponibles')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'traduire') {
      const texte = interaction.options.getString('texte');
      const vers = interaction.options.getString('vers');
      const depuis = interaction.options.getString('depuis') || 'auto';

      if (texte.length > 1000) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Texte trop long (1000 caractères max).', ephemeral: true });
      await interaction.deferReply();

      try {
        const result = await translate(texte, vers, depuis);
        const langSource = LANGUES.find(l => l.value === result.detected)?.name || result.detected;
        const langTarget = LANGUES.find(l => l.value === vers)?.name || vers;

        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder()
            .setColor('#4285F4')
            .setTitle('🌍 Traduction')
            .addFields(
              { name: `🔤 Texte original (${langSource})`, value: `\`\`\`${texte.slice(0, 500)}\`\`\`` },
              { name: `✅ Traduction en ${langTarget}`, value: `\`\`\`${result.text.slice(0, 500)}\`\`\`` },
            )
            .setFooter({ text: 'Traduction via Google Translate' })
        ]});
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(`❌ Erreur de traduction : ${e.message}`);
      }
    }

    if (sub === 'detecter') {
      const texte = interaction.options.getString('texte');
      await interaction.deferReply({ ephemeral: true });

      try {
        const result = await translate(texte.slice(0, 100), 'fr', 'auto');
        const langName = LANGUES.find(l => l.value === result.detected)?.name || `Code: ${result.detected}`;
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
          new EmbedBuilder().setColor('#4285F4')
            .setDescription(`🔍 Langue détectée : **${langName}**`)
        ]});
      } catch {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)('❌ Impossible de détecter la langue.');
      }
    }

    if (sub === 'langues') {
      const list = LANGUES.map(l => l.name).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#4285F4').setTitle('🌍 Langues disponibles').setDescription(list)
      ], ephemeral: true });
    }
  },
  name: 'traduction2',
  aliases: ["trad2"],
    async run(message, args) {
    const vers = args[0] || 'fr';
    const texte = args.slice(1).join(' ') || args.join(' ');
    const fake = mkFake(message, { getSubcommand: () => 'texte', getString: (k) => k === 'texte' ? texte : k === 'vers' ? vers : null });
    await this.execute(fake);
  },
};
