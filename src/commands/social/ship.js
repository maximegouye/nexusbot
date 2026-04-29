const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const PHRASES = [
  [0,  10,  '💔 Aucune chance... Circulez, il n\'y a rien à voir.'],
  [10, 25,  '😬 C\'est très compliqué... Peut-être dans une autre vie.'],
  [25, 45,  '🤔 Il y a une légère étincelle. Mais très légère.'],
  [45, 60,  '😊 Pas mal ! Il y a quelque chose à construire ici.'],
  [60, 75,  '😍 Oh là là ! La compatibilité est bonne !'],
  [75, 90,  '💕 Wow ! Vous faites un super match !'],
  [90, 100, '💘 PARFAIT ! C\'est l\'amour absolu ! 😍🔥'],
  [100, 101,'💞 100% — Les âmes sœurs ! C\'est le destin !'],
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('💘 Calcule la compatibilité entre deux membres !')
    .addUserOption(o => o.setName('membre1').setDescription('Premier membre').setRequired(true))
    .addUserOption(o => o.setName('membre2').setDescription('Deuxième membre (toi si vide)').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }).catch(() => {}); } catch (e) { /* already ack'd */ }
    }

    const m1 = interaction.options.getUser('membre1');
    const m2 = interaction.options.getUser('membre2') || interaction.user;

    // Score déterministe (basé sur les IDs pour être reproductible)
    const seed  = BigInt(m1.id) ^ BigInt(m2.id);
    const score = Number(seed % 101n < 0n ? -(seed % 101n) : seed % 101n);

    const phrase = PHRASES.find(([min, max]) => score >= min && score < max);

    const barLen = 20;
    const filled = Math.round(score / 100 * barLen);
    const bar    = '❤️'.repeat(Math.max(0, Math.floor(filled / 2))) + '🖤'.repeat(Math.max(0, 10 - Math.floor(filled / 2)));

    const color = score >= 75 ? '#FF73FA' : score >= 50 ? '#E91E8C' : score >= 25 ? '#FF6B6B' : '#888888';

    // Nom combiné
    const name1 = m1.username.slice(0, Math.ceil(m1.username.length / 2));
    const name2 = m2.username.slice(Math.floor(m2.username.length / 2));
    const shipName = name1 + name2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`💘 Ship-o-mètre`)
      .setDescription(`**${m1.username}** 💕 **${m2.username}**\n\n🚢 Nom de couple : **${shipName}**\n\n${bar}\n\n💯 Compatibilité : **${score}%**\n\n${phrase?.[2] || ''}`)
      .setFooter({ text: 'Résultat garanti scientifiquement ! 😄' });

    await interaction.editReply({ embeds: [embed] });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
