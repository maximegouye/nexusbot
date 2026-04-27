const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Jeu de la chaîne de mots : chaque mot doit commencer par la dernière lettre du précédent
const activeGames = new Map(); // guildId:channelId → game state

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chainemots')
    .setDescription('🔤 Jeu de la chaîne de mots !')
    .addSubcommand(s => s.setName('start').setDescription('▶️ Démarrer une partie'))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Arrêter la partie en cours'))
    .addSubcommand(s => s.setName('info').setDescription('ℹ️ Voir les règles')),
  cooldown: 5,

  async execute(interaction) {
    try {
    const sub  = interaction.options.getSubcommand();
    const key  = `${interaction.guildId}:${interaction.channelId}`;

    if (sub === 'info') {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor('#9B59B6')
          .setTitle('🔤 Règles - Chaîne de Mots')
          .setDescription(
            '**Comment jouer :**\n' +
            '1️⃣ Un premier mot est proposé.\n' +
            '2️⃣ Le joueur suivant doit écrire un mot **commençant par la dernière lettre** du mot précédent.\n' +
            '3️⃣ Pas de répétition ! Un mot déjà utilisé = élimination.\n' +
            '4️⃣ Dépasser le temps imparti = élimination.\n\n' +
            '**Exemple :** Chien → Nuit → Tigre → Éléphant → ...'
          )
        ]
      });
    }

    if (sub === 'stop') {
      if (!activeGames.has(key))
        return interaction.reply({ content: '❌ Aucune partie en cours dans ce salon.', ephemeral: true });

      const game = activeGames.get(key);
      game.collector?.stop('manual');
      activeGames.delete(key);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription('⏹️ Partie de chaîne de mots arrêtée.')]
      });
    }

    // START
    if (activeGames.has(key))
      return interaction.reply({ content: '⏳ Une partie est déjà en cours dans ce salon !', ephemeral: true });

    const timeLimit = (interaction.options.getInteger('temps') || 30) * 1000;
    const starterWords = ['chat', 'arbre', 'soleil', 'montagne', 'fleuve', 'oiseau', 'nuage', 'fleur', 'étoile', 'rivière'];
    const firstWord = starterWords[Math.floor(Math.random() * starterWords.length)];

    const game = {
      currentWord:  firstWord,
      usedWords:    new Set([firstWord]),
      lastUserId:   null,
      scores:       new Map(), // userId → score
      timeLimit,
      timeoutId:    null,
      collector:    null,
    };
    activeGames.set(key, game);

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🔤 Chaîne de Mots — Démarré !')
      .setDescription(`Le premier mot est : **${firstWord}**\n\nProchain mot à commencer par : **${firstWord.slice(-1).toUpperCase()}**\n\nVous avez **${timeLimit / 1000}s** par mot.`)
      .setFooter({ text: 'Écrivez votre mot dans ce salon !' });

    await interaction.reply({ embeds: [embed] });

    // Lancer le timer
    function resetTimer() {
      if (game.timeoutId) clearTimeout(game.timeoutId);
      game.timeoutId = setTimeout(async () => {
        activeGames.delete(key);
        game.collector?.stop('timeout');
        // Afficher les scores
        const scores = [...game.scores.entries()].sort((a, b) => b[1] - a[1]);
        const scoreList = scores.length > 0
          ? scores.map(([uid, s], i) => `${i + 1}. <@${uid}> — **${s} point${s > 1 ? 's' : ''}**`).join('\n')
          : 'Aucun point marqué.';
        interaction.channel.send({
          embeds: [new EmbedBuilder()
            .setColor('#F39C12')
            .setTitle('⏰ Temps écoulé ! Fin de partie')
            .setDescription(`Personne n'a répondu à temps après **${game.currentWord}** !\n\n**Classement :**\n${scoreList}`)
          ]
        }).catch(() => {});
      }, timeLimit);
    }

    resetTimer();

    // Collector de messages
    const filter = m => !m.author.bot && m.channelId === interaction.channelId;
    const collector = interaction.channel.createMessageCollector({ filter, time: 600000 }); // 10min max
    game.collector = collector;

    collector.on('collect', async (msg) => {
      const gm = activeGames.get(key);
      if (!gm) return collector.stop();

      const word = msg.content.trim().toLowerCase().replace(/[^a-zéèêàâùûîôçœæ]/gi, '');
      if (!word || word.length < 2) return;

      const expectedLetter = gm.currentWord.slice(-1).toLowerCase();

      if (word[0] !== expectedLetter) {
        const warn = await msg.reply(`❌ Ton mot doit commencer par **${expectedLetter.toUpperCase()}** ! (dernier mot : **${gm.currentWord}**)`).catch(() => {});
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }

      if (gm.usedWords.has(word)) {
        const warn = await msg.reply(`❌ **${word}** a déjà été utilisé ! Pénalité.`).catch(() => {});
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }

      if (gm.lastUserId === msg.author.id) {
        const warn = await msg.reply('❌ Tu ne peux pas jouer deux fois de suite !').catch(() => {});
        if (warn) setTimeout(() => warn.delete().catch(() => {}), 5000);
        return;
      }

      // Mot valide
      gm.usedWords.add(word);
      gm.currentWord = word;
      gm.lastUserId  = msg.author.id;
      gm.scores.set(msg.author.id, (gm.scores.get(msg.author.id) || 0) + 1);

      await msg.react('✅').catch(() => {});
      resetTimer();

      // Réponse avec indication du prochain
      const nextLetter = word.slice(-1).toUpperCase();
      const info = await msg.channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ **${word}** — Prochain mot à commencer par **${nextLetter}** | Score <@${msg.author.id}> : ${gm.scores.get(msg.author.id)} pt${gm.scores.get(msg.author.id) > 1 ? 's' : ''}`)
        ]
      }).catch(() => {});
      if (info) setTimeout(() => info.delete().catch(() => {}), 10000);
    });

    collector.on('end', () => {
      if (game.timeoutId) clearTimeout(game.timeoutId);
      activeGames.delete(key);
    });
    } catch (err) {
    console.error('[CMD] Erreur execute:', err?.message || err);
    const errMsg = { content: `❌ Une erreur est survenue : ${err?.message || 'Erreur inconnue'}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    } catch {}
  }}
};
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
