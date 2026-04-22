/**
 * NexusBot — Course de Frappe (Typing Race)
 * /course-frappe — Qui tape le plus vite ? Compétition de vitesse de frappe
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const activeSessions = new Map(); // channelId → session

const PHRASES = {
  facile: [
    "Le chat dort sur le canapé.",
    "Il fait beau aujourd'hui.",
    "J'aime le chocolat au lait.",
    "La musique adoucit les mœurs.",
    "Paris est la ville lumière.",
    "Le soleil brille sur la plage.",
    "Les oiseaux chantent le matin.",
  ],
  moyen: [
    "La curiosité est le moteur de la découverte scientifique.",
    "L'amitié véritable résiste à l'épreuve du temps et de la distance.",
    "Les étoiles brillent même dans les nuits les plus sombres.",
    "Le travail acharné et la persévérance mènent au succès.",
    "Chaque jour est une nouvelle opportunité de s'améliorer.",
    "La technologie transforme notre façon de communiquer.",
  ],
  difficile: [
    "L'extraordinaire persévérance des explorateurs polaires témoigne de la capacité humaine à surmonter les conditions les plus extrêmes.",
    "La philosophie contemporaine interroge les fondements de notre rapport au numérique et à l'intelligence artificielle.",
    "L'architecture gothique des cathédrales médiévales reflète une vision transcendante du monde spirituel et céleste.",
    "La biodiversité des écosystèmes tropicaux représente un patrimoine naturel irremplaçable qu'il convient de préserver absolument.",
    "Les algorithmes de machine learning transforment radicalement les paradigmes de l'informatique moderne et de l'analyse des données.",
  ],
  code: [
    "const message = 'Hello World'; console.log(message);",
    "function add(a, b) { return a + b; }",
    "SELECT * FROM users WHERE active = 1 ORDER BY name;",
    "git commit -m 'fix: resolve authentication bug'",
    "npm install discord.js better-sqlite3 node-cron",
  ],
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('course-frappe')
    .setDescription('⌨️ Course de frappe — Qui tape le plus vite ?')
    .addSubcommand(s => s.setName('duel')
      .setDescription('🏁 Lancer une course de frappe dans ce salon')
      .addStringOption(o => o.setName('difficulte').setDescription('Niveau de difficulté')
        .addChoices(
          { name: '😊 Facile', value: 'facile' },
          { name: '🔥 Moyen', value: 'moyen' },
          { name: '💀 Difficile', value: 'difficile' },
          { name: '💻 Code', value: 'code' },
        ))
    .addSubcommand(s => s.setName('solo')
      .setDescription('⏱️ Entraînement solo — mesure ta vitesse')
      .addStringOption(o => o.setName('difficulte').setDescription('Niveau')
        .addChoices(
          { name: '😊 Facile', value: 'facile' },
          { name: '🔥 Moyen', value: 'moyen' },
          { name: '💀 Difficile', value: 'difficile' },
        )))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Arrêter la course en cours')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const channel = interaction.channel;

    if (sub === 'stop') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return interaction.editReply({ content: '❌ Aucune course en cours.', ephemeral: true });
      sess.collector?.stop('manual');
      activeSessions.delete(channel.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('⏹️ Course arrêtée.')] });
    }

    if (activeSessions.has(channel.id)) {
      return interaction.editReply({ content: '⚠️ Une course est déjà en cours !', ephemeral: true });
    }

    const diff  = interaction.options.getString('difficulte') || 'moyen';
    const temps = parseInt(interaction.options.getString('temps')) || 60;
    const phrases = PHRASES[diff];
    const phrase  = phrases[Math.floor(Math.random() * phrases.length)];

    // Décompte
    await interaction.editReply({ embeds: [new EmbedBuilder().setColor('#f39c12').setTitle('⌨️ Course de Frappe').setDescription(`**Préparez-vous !**\nDifficulté : **${diff}** | Temps : **${temps}s**\n\nLa phrase apparaîtra dans 3 secondes...`)] });
    await new Promise(r => setTimeout(r, 3000));

    const startTime = Date.now();
    const embed = new EmbedBuilder()
      .setColor('#7B2FBE')
      .setTitle('⌨️ TAPEZ CETTE PHRASE !')
      .setDescription(`\`\`\`\n${phrase}\n\`\`\``)
      .addFields({ name: '⏱️ Temps restant', value: `${temps} secondes`, inline: true })
      .setFooter({ text: 'Copiez et tapez la phrase exactement !' });

    const msg = await channel.send({ embeds: [embed] });

    const session = {
      phrase,
      startTime,
      results: [],
      active: true,
    };
    activeSessions.set(channel.id, session);

    const collector = channel.createMessageCollector({
      filter: m => !m.author.bot,
      time: temps * 1000,
    });
    session.collector = collector;

    collector.on('collect', async (m) => {
      const sess = activeSessions.get(channel.id);
      if (!sess) return;

      const typed = m.content.trim();
      if (typed.toLowerCase() === phrase.toLowerCase()) {
        const elapsed  = (Date.now() - sess.startTime) / 1000;
        const wpm      = Math.round((phrase.split(' ').length / elapsed) * 60);
        const accuracy = getAccuracy(phrase, typed);

        // Éviter les doublons (même personne)
        if (!sess.results.find(r => r.userId === m.author.id)) {
          sess.results.push({ userId: m.author.id, username: m.author.username, elapsed, wpm, accuracy });
          await m.react('✅');
          await channel.send({ embeds: [new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(`✅ **${m.author.username}** a terminé en **${elapsed.toFixed(2)}s** — **${wpm} WPM** — Précision ${accuracy}%`)
          ]});

          // Récompense coins
          const reward = Math.round(wpm * 2);
          db.addCoins(m.author.id, interaction.guildId, reward);
        }
      } else if (isPartialMatch(typed, phrase)) {
        await m.react('⌨️'); // encourage
      }
    });

    collector.on('end', async () => {
      activeSessions.delete(channel.id);
      const sess = session;

      if (!sess.results.length) {
        await channel.send({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle('⏱️ Temps écoulé !').setDescription('Personne n\'a terminé la phrase.').addFields({ name: '📋 La phrase était', value: `\`${phrase}\`` })] }).catch(() => {});
        return;
      }

      const sorted = sess.results.sort((a, b) => a.elapsed - b.elapsed);
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏆 Résultats de la course !')
        .setDescription(sorted.map((r, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
          return `${medal} **${r.username}** — ${r.elapsed.toFixed(2)}s — **${r.wpm} WPM** — ${r.accuracy}% précision`;
        }).join('\n'))
        .addFields({ name: '📋 La phrase', value: `\`${phrase}\`` })
        .setFooter({ text: 'Récompense: WPM × 2 coins !' });
      await channel.send({ embeds: [embed] }).catch(() => {});
    });
  }
};

function getAccuracy(expected, typed) {
  let correct = 0;
  const min = Math.min(expected.length, typed.length);
  for (let i = 0; i < min; i++) {
    if (expected[i] === typed[i]) correct++;
  }
  return Math.round((correct / expected.length) * 100);
}

function isPartialMatch(typed, phrase) {
  return phrase.toLowerCase().startsWith(typed.toLowerCase()) && typed.length > 5;
}
