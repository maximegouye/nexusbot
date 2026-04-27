const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const mots = [
  'abricot', 'avalanche', 'baleine', 'bibliothèque', 'bouteille', 'brouillard',
  'cascade', 'cerisier', 'chocolat', 'chrysanthème', 'citronnade', 'colibri',
  'crocodile', 'cyclone', 'dauphin', 'dinosaure', 'éléphant', 'escalier',
  'fantôme', 'flambeau', 'fourmi', 'galaxie', 'girafe', 'grenadine',
  'hibou', 'hirondelle', 'horizon', 'igloo', 'impératrice', 'jaguar',
  'labyrinthe', 'lavande', 'librairie', 'luciole', 'magicien', 'manchot',
  'montagne', 'mouette', 'mystère', 'nénuphar', 'numérique', 'orchidée',
  'parapluie', 'perroquet', 'pyramide', 'rhinocéros', 'sablier', 'scorpion',
  'tourbillon', 'trampoline', 'tropical', 'typhon', 'univers', 'vampire',
  'vigilance', 'violoncelle', 'volcan', 'xylophone', 'zèbre', 'zoologie',
];

const ETAPES = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

const activeGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pendu')
    .setDescription('🪢 Joue au pendu et devine le mot caché !'),
  cooldown: 10,

  async execute(interaction) {
    const key = `${interaction.user.id}:${interaction.guildId}`;
    if (activeGames.has(key))
      return interaction.reply({ content: '⏳ Tu as déjà une partie en cours !', ephemeral: true });

    const mot    = mots[Math.floor(Math.random() * mots.length)];
    const lettre = mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split('');
    const jeu    = {
      mot,
      lettresNorm: lettre,
      trouvees:    new Set(),
      erreurs:     0,
      maxErreurs:  6,
    };
    activeGames.set(key, jeu);

    function buildDisplay(j) {
      return j.mot.split('').map(c => {
        const n = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return j.trouvees.has(n) ? c : (c === ' ' ? ' ' : '\\_');
      }).join(' ');
    }

    function buildEmbed(j, msg = '') {
      const display = buildDisplay(j);
      const found   = [...j.trouvees].join(', ') || 'Aucune';
      return new EmbedBuilder()
        .setColor(j.erreurs >= j.maxErreurs ? '#E74C3C' : j.erreurs >= 4 ? '#F39C12' : '#3498DB')
        .setTitle('🪢 Le Pendu')
        .setDescription(`${ETAPES[j.erreurs]}\n\n**Mot :** ${display}\n\n${msg}`)
        .addFields({ name: '✅ Lettres trouvées', value: found, inline: true },
                   { name: '❌ Erreurs', value: `${j.erreurs}/${j.maxErreurs}`, inline: true })
        .setFooter({ text: 'Réponds avec une lettre ou un mot complet !' });
    }

    const sentMsg = await interaction.reply({ embeds: [buildEmbed(jeu)], fetchReply: true });

    const filter    = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: 180000 });

    collector.on('collect', async (msg) => {
      const j    = activeGames.get(key);
      if (!j) return collector.stop();
      const input = msg.content.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let feedbackMsg = '';

      // Tentative de mot complet
      if (input.length > 1) {
        const motNorm = mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (input === motNorm) {
          mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split('').forEach(c => j.trouvees.add(c));
          feedbackMsg = `🎉 Bravo ! Tu as deviné le mot : **${mot}** !`;
          activeGames.delete(key);
          collector.stop('won');
        } else {
          j.erreurs++;
          feedbackMsg = `❌ Non, ce n'est pas **${msg.content.trim()}** !`;
        }
      } else if (input.length === 1) {
        if (j.trouvees.has(input)) {
          feedbackMsg = `⚠️ Tu as déjà proposé la lettre **${input}** !`;
        } else if (j.lettresNorm.includes(input)) {
          j.trouvees.add(input);
          const remaining = j.lettresNorm.filter(c => !j.trouvees.has(c));
          if (remaining.length === 0) {
            feedbackMsg = `🎉 Bravo ! Tu as trouvé le mot : **${mot}** !`;
            activeGames.delete(key);
            collector.stop('won');
          } else {
            feedbackMsg = `✅ La lettre **${input}** est dans le mot !`;
          }
        } else {
          j.erreurs++;
          feedbackMsg = `❌ La lettre **${input}** n'est pas dans le mot.`;
        }
      }

      if (j.erreurs >= j.maxErreurs && activeGames.has(key)) {
        feedbackMsg = `💀 Perdu ! Le mot était **${mot}**.`;
        activeGames.delete(key);
        collector.stop('lost');
      }

      await msg.reply({ embeds: [buildEmbed(activeGames.get(key) || j, feedbackMsg)] }).catch(() => {});
      await msg.delete().catch(() => {});
    });

    collector.on('end', async (_, reason) => {
      activeGames.delete(key);
      if (reason === 'time') {
        interaction.channel.send({
          embeds: [new EmbedBuilder().setColor('#888888').setDescription(`⏰ <@${interaction.user.id}> Temps écoulé ! Le mot était **${mot}**.`)]
        }).catch(() => {});
      }
    });
  }
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
