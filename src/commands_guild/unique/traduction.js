const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const https = require('https');

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

      if (texte.length > 1000) return interaction.reply({ content: '❌ Texte trop long (1000 caractères max).', ephemeral: true }).catch(() => {});
      await interaction.deferReply().catch(() => {});

      try {
        const result = await translate(texte, vers, depuis);
        const langSource = LANGUES.find(l => l.value === result.detected)?.name || result.detected;
        const langTarget = LANGUES.find(l => l.value === vers)?.name || vers;

        return await interaction.editReply({ embeds: [
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
        return await interaction.editReply(`❌ Erreur de traduction : ${e.message}`);
      }
    }

    if (sub === 'detecter') {
      const texte = interaction.options.getString('texte');
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      try {
        const result = await translate(texte.slice(0, 100), 'fr', 'auto');
        const langName = LANGUES.find(l => l.value === result.detected)?.name || `Code: ${result.detected}`;
        return await interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#4285F4')
            .setDescription(`🔍 Langue détectée : **${langName}**`)
        ]});
      } catch {
        return await interaction.editReply('❌ Impossible de détecter la langue.');
      }
    }

    if (sub === 'langues') {
      const list = LANGUES.map(l => l.name).join('\n');
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#4285F4').setTitle('🌍 Langues disponibles').setDescription(list)
      ], ephemeral: true });
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
