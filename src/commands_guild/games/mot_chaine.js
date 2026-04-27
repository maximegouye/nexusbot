/**
 * NexusBot — Jeu du Mot Enchaîné
 * /mot-chaine — Chaque mot doit commencer par la dernière lettre du précédent
 */
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

const activeSessions = new Map(); // channelId → session

const THEMES = {
  animaux:   ['chat', 'tigre', 'éléphant', 'tigre'],
  villes:    ['Paris', 'Rome', 'Marseille', 'Lyon'],
  libre:     [],
};

const USED_WORDS = new Map(); // channelId → Set(words)

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mot-chaine')
    .setDescription('🔤 Jeu du mot enchaîné — chaque mot commence par la dernière lettre du précédent')
    .addSubcommand(s => s.setName('start')
      .setDescription('▶️ Démarrer une partie')
      .addStringOption(o => o.setName('theme').setDescription('Thème du jeu')
        .addChoices(
          { name: '🌍 Libre (tous les mots)', value: 'libre' },
          { name: '🐾 Animaux', value: 'animaux' },
          { name: '🌆 Villes', value: 'villes' },
        ))
      .addStringOption(o => o.setName('mot_debut').setDescription('Mot de départ (optionnel)')))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Arrêter la partie en cours'))
    .addSubcommand(s => s.setName('status').setDescription('📊 Voir la partie en cours')),

  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const sub     = interaction.options.getSubcommand();
    const channel = interaction.channel;
    const guildId = interaction.guildId;

    if (sub === 'start') {
      if (activeSessions.has(channel.id)) {
        return interaction.editReply({ content: '⚠️ Une partie est déjà en cours dans ce salon !', ephemeral: true });
      }

      const theme   = interaction.options.getString('theme') || 'libre';
      const temps   = interaction.options.getInteger('temps') || 30;
      const debutOpt = interaction.options.getString('mot_debut');
      const motDebut = (debutOpt || getRandomWord(theme) || 'DRAGON').toUpperCase().trim();

      const session = {
        theme,
        temps,
        motCourant: motDebut,
        lettreRequise: motDebut.slice(-1),
        scores: {},
        usedWords: new Set([motDebut]),
        startedBy: interaction.user.id,
        active: true,
        lastPlayer: null,
      };
      activeSessions.set(channel.id, session);

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('🔤 Mot Enchaîné — Partie démarrée !')
        .setDescription([
          `**Thème :** ${theme === 'libre' ? 'Libre' : theme}`,
          `**Premier mot :** **${motDebut}**`,
          `**Prochain mot doit commencer par :** **${session.lettreRequise}**`,
          '',
          '📝 **Règles :**',
          '• Réponds dans ce salon avec un mot commençant par la lettre indiquée',
          '• Le même mot ne peut pas être utilisé deux fois',
          '• Tu as 30 secondes par tour',
          '• +1 point par mot correct',
        ].join('\n'))
        .setFooter({ text: `Démarre par : ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Collecteur de messages
      const collector = channel.createMessageCollector({
        filter: m => !m.author.bot,
        time: 10 * 60 * 1000, // 10 min max
      });

      session.collector = collector;

      collector.on('collect', async (msg) => {
        const sess = activeSessions.get(channel.id);
        if (!sess || !sess.active) return;

        const word = msg.content.trim().toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ]/g, '');
        if (!word || word.length < 2) return;

        // Vérifie la bonne lettre
        if (word[0] !== sess.lettreRequise) {
          await msg.react('❌');
          await channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`❌ **${msg.author.username}** — Le mot doit commencer par **${sess.lettreRequise}** !`)] });
          return;
        }

        // Vérifie si déjà utilisé
        if (sess.usedWords.has(word)) {
          await msg.react('🔄');
          await channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🔄 **${word}** a déjà été utilisé !`)] });
          return;
        }

        // Vérifie que ce n'est pas le même joueur qui joue deux fois de suite
        if (sess.lastPlayer === msg.author.id) {
          await msg.react('⚠️');
          await channel.send({ embeds: [new EmbedBuilder().setColor('#f39c12').setDescription(`⚠️ Attends qu'un autre joueur joue !`)] });
          return;
        }

        // Mot accepté !
        sess.usedWords.add(word);
        sess.motCourant = word;
        sess.lettreRequise = word.slice(-1);
        sess.lastPlayer = msg.author.id;
        sess.scores[msg.author.id] = (sess.scores[msg.author.id] || 0) + 1;

        await msg.react('✅');

        const scoreDisplay = Object.entries(sess.scores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, pts], i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} <@${id}> — ${pts} pts`)
          .join('\n');

        await channel.send({ embeds: [new EmbedBuilder()
          .setColor('#2ecc71')
          .setDescription(`✅ **${word}** — Prochain mot commence par **${sess.lettreRequise}**\n\n${scoreDisplay}`)
        ]});
      });

      collector.on('end', async () => {
        const sess = activeSessions.get(channel.id);
        activeSessions.delete(channel.id);
        if (!sess) return;

        const scores = Object.entries(sess.scores || {}).sort((a, b) => b[1] - a[1]);
        const embed = new EmbedBuilder()
          .setColor('#f39c12')
          .setTitle('⏹️ Mot Enchaîné — Partie terminée !')
          .setDescription(scores.length ? scores.map(([id, pts], i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} <@${id}> — **${pts} points**`).join('\n') : 'Aucun score.')
          .setFooter({ text: `${sess.usedWords.size} mots utilisés` });

        await channel.send({ embeds: [embed] }).catch(() => {});
      });

      return;
    }

    if (sub === 'stop') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return interaction.editReply({ content: '❌ Aucune partie en cours.', ephemeral: true });
      sess.collector?.stop();
      activeSessions.delete(channel.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('⏹️ Partie arrêtée.')] });
    }

    if (sub === 'status') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return interaction.editReply({ content: '❌ Aucune partie en cours.', ephemeral: true });
      const scores = Object.entries(sess.scores || {}).sort((a, b) => b[1] - a[1]);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Mot Enchaîné — Status')
        .addFields(
          { name: '🔤 Mot courant', value: sess.motCourant, inline: true },
          { name: '📍 Lettre requise', value: sess.lettreRequise, inline: true },
          { name: '📚 Mots utilisés', value: `${sess.usedWords.size}`, inline: true },
          { name: '🏆 Scores', value: scores.length ? scores.map(([id, pts]) => `<@${id}> — ${pts} pts`).join('\n') : 'Aucun', inline: false },
        );
      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.editReply(_em).catch(() => {});
    } catch {}
  }}
};

function getRandomWord(theme) {
  const lists = {
    animaux: ['LION', 'NUIT', 'TIGRE', 'ELEPHANT', 'TORTUE', 'RENARD', 'DAUPHIN'],
    villes:  ['PARIS', 'STRASBOURG', 'GRENOBLE', 'ORLEANS', 'LENS', 'NICE', 'EVRY'],
    libre:   ['DRAGON', 'NUIT', 'TABLEAU', 'UNIVERS', 'SOLEIL', 'LUNE'],
  };
  const list = lists[theme] || lists.libre;
  return list[Math.floor(Math.random() * list.length)];
}

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
