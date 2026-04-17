const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS quiz_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT,
    correct INTEGER DEFAULT 0, wrong INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}

const QUESTIONS = [
  // Culture générale
  { q: 'Quelle est la capitale de la France ?', a: 'Paris', choices: ['Lyon', 'Paris', 'Marseille', 'Bordeaux'], cat: '🌍 Géographie' },
  { q: 'Combien y a-t-il de continents sur Terre ?', a: '7', choices: ['5', '6', '7', '8'], cat: '🌍 Géographie' },
  { q: 'Quel est le plus grand océan du monde ?', a: 'Pacifique', choices: ['Atlantique', 'Indien', 'Pacifique', 'Arctique'], cat: '🌍 Géographie' },
  { q: 'Quelle est la monnaie du Japon ?', a: 'Yen', choices: ['Yuan', 'Won', 'Yen', 'Dong'], cat: '🌍 Géographie' },
  // Science
  { q: 'Quelle est la formule chimique de l\'eau ?', a: 'H₂O', choices: ['CO₂', 'H₂O', 'O₂', 'NaCl'], cat: '🔬 Science' },
  { q: 'Quel est le symbole chimique de l\'or ?', a: 'Au', choices: ['Ag', 'Fe', 'Au', 'Or'], cat: '🔬 Science' },
  { q: 'Combien y a-t-il d\'os dans le corps humain adulte ?', a: '206', choices: ['165', '206', '235', '300'], cat: '🔬 Science' },
  { q: 'À quelle vitesse voyage la lumière (arrondi) ?', a: '300 000 km/s', choices: ['150 000 km/s', '300 000 km/s', '500 000 km/s', '1 000 000 km/s'], cat: '🔬 Science' },
  // Histoire
  { q: 'En quelle année a eu lieu la Révolution française ?', a: '1789', choices: ['1776', '1789', '1815', '1848'], cat: '📜 Histoire' },
  { q: 'Qui a peint la Joconde ?', a: 'Léonard de Vinci', choices: ['Michel-Ange', 'Raphaël', 'Léonard de Vinci', 'Botticelli'], cat: '🎨 Art' },
  { q: 'Quel pays a envoyé le premier homme dans l\'espace ?', a: 'URSS', choices: ['USA', 'URSS', 'France', 'Chine'], cat: '📜 Histoire' },
  // Maths
  { q: 'Combien font 15 × 15 ?', a: '225', choices: ['205', '215', '225', '230'], cat: '🔢 Maths' },
  { q: 'Quel est le résultat de √144 ?', a: '12', choices: ['11', '12', '13', '14'], cat: '🔢 Maths' },
  { q: 'Combien font 2^10 ?', a: '1024', choices: ['512', '1000', '1024', '2048'], cat: '🔢 Maths' },
  // Technologie
  { q: 'Que signifie "HTTP" ?', a: 'HyperText Transfer Protocol', choices: ['High Tech Transfer Protocol', 'HyperText Transfer Protocol', 'Hyper Transfer Text Program', 'Home Text Transfer Protocol'], cat: '💻 Tech' },
  { q: 'Quel langage est utilisé pour le style sur les sites web ?', a: 'CSS', choices: ['HTML', 'CSS', 'JavaScript', 'PHP'], cat: '💻 Tech' },
  { q: 'Que signifie "RAM" ?', a: 'Random Access Memory', choices: ['Read Access Memory', 'Random Access Memory', 'Rapid Access Mode', 'Read Accessible Memory'], cat: '💻 Tech' },
  // Sport
  { q: 'Combien de joueurs y a-t-il dans une équipe de football ?', a: '11', choices: ['9', '10', '11', '12'], cat: '⚽ Sport' },
  { q: 'Quelle est la durée d\'un match de football (temps réglementaire) ?', a: '90 minutes', choices: ['80 minutes', '90 minutes', '100 minutes', '120 minutes'], cat: '⚽ Sport' },
  { q: 'Dans quel sport utilise-t-on un "smash" ?', a: 'Tennis', choices: ['Football', 'Basketball', 'Tennis', 'Volleyball'], cat: '⚽ Sport' },
];

const REWARD = 75;
const activeQuizzes = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quiz')
    .setDescription('🧠 Testez vos connaissances et gagnez des coins !')
    .addSubcommand(s => s.setName('jouer').setDescription('🧠 Répondre à une question aléatoire')
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie (optionnel)')
        .addChoices(
          { name: '🌍 Géographie', value: 'geographie' },
          { name: '🔬 Science', value: 'science' },
          { name: '📜 Histoire', value: 'histoire' },
          { name: '🔢 Maths', value: 'maths' },
          { name: '💻 Tech', value: 'tech' },
          { name: '⚽ Sport', value: 'sport' },
          { name: '🎲 Aléatoire', value: 'aleatoire' },
        )))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Voir vos statistiques de quiz')
      .addUserOption(o => o.setName('membre').setDescription('Voir les stats d\'un membre')))
    .addSubcommand(s => s.setName('classement').setDescription('🏆 Top des champions du quiz')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'jouer') {
      if (activeQuizzes.has(`${guildId}_${userId}`)) return interaction.reply({ content: '❌ Vous avez déjà une question en cours !', ephemeral: true });

      const cat = interaction.options.getString('categorie') || 'aleatoire';
      let pool = QUESTIONS;
      if (cat !== 'aleatoire') {
        const catMap = { geographie: '🌍 Géographie', science: '🔬 Science', histoire: '📜 Histoire', maths: '🔢 Maths', tech: '💻 Tech', sport: '⚽ Sport' };
        pool = QUESTIONS.filter(q => q.cat === catMap[cat]);
      }

      const q = pool[Math.floor(Math.random() * pool.length)];
      // Mélanger les choix
      const shuffled = [...q.choices].sort(() => Math.random() - 0.5);
      const letters = ['A', 'B', 'C', 'D'];

      activeQuizzes.set(`${guildId}_${userId}`, { q, shuffled, time: Date.now() });

      const row = new ActionRowBuilder().addComponents(
        shuffled.map((choice, i) =>
          new ButtonBuilder()
            .setCustomId(`quiz_${userId}_${i}`)
            .setLabel(`${letters[i]}. ${choice.slice(0, 50)}`)
            .setStyle(ButtonStyle.Primary)
        )
      );

      const embed = new EmbedBuilder().setColor('#7B2FBE').setTitle(`🧠 Question — ${q.cat}`)
        .setDescription(`**${q.q}**`)
        .setFooter({ text: `Bonne réponse = +${REWARD} ${coin} • 30 secondes` });

      const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

      const collector = msg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async i => {
        if (i.user.id !== userId) return i.reply({ content: '❌ Ce n\'est pas votre quiz.', ephemeral: true });

        const game = activeQuizzes.get(`${guildId}_${userId}`);
        if (!game) return;

        activeQuizzes.delete(`${guildId}_${userId}`);
        collector.stop();

        const answerIndex = parseInt(i.customId.split('_')[2]);
        const chosen = game.shuffled[answerIndex];
        const isCorrect = chosen === game.q.a;
        const timeTaken = ((Date.now() - game.time) / 1000).toFixed(1);

        // Mettre à jour les stats
        let stats = db.db.prepare('SELECT * FROM quiz_stats WHERE guild_id=? AND user_id=?').get(guildId, userId);
        if (!stats) {
          db.db.prepare('INSERT INTO quiz_stats (guild_id, user_id) VALUES (?,?)').run(guildId, userId);
          stats = { correct: 0, wrong: 0, total_earned: 0 };
        }

        if (isCorrect) {
          db.addCoins(userId, guildId, REWARD);
          db.db.prepare('UPDATE quiz_stats SET correct=correct+1, total_earned=total_earned+? WHERE guild_id=? AND user_id=?').run(REWARD, guildId, userId);
        } else {
          db.db.prepare('UPDATE quiz_stats SET wrong=wrong+1 WHERE guild_id=? AND user_id=?').run(guildId, userId);
        }

        const answerDisplay = shuffled.map((c, idx) => {
          const l = letters[idx];
          if (c === game.q.a) return `✅ **${l}. ${c}** ← Bonne réponse`;
          if (idx === answerIndex && !isCorrect) return `❌ ~~${l}. ${c}~~`;
          return `${l}. ${c}`;
        }).join('\n');

        await i.update({ embeds: [
          new EmbedBuilder()
            .setColor(isCorrect ? '#2ECC71' : '#E74C3C')
            .setTitle(`🧠 ${isCorrect ? '✅ Bonne réponse !' : '❌ Mauvaise réponse !'}`)
            .setDescription(answerDisplay)
            .addFields(
              { name: '⏱️ Temps', value: `${timeTaken}s`, inline: true },
              { name: '💰 Gain', value: isCorrect ? `+${REWARD} ${coin}` : `0 ${coin}`, inline: true },
            )
        ], components: [] });
      });

      collector.on('end', () => {
        if (activeQuizzes.has(`${guildId}_${userId}`)) {
          activeQuizzes.delete(`${guildId}_${userId}`);
        }
      });
    }

    if (sub === 'stats') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const stats = db.db.prepare('SELECT * FROM quiz_stats WHERE guild_id=? AND user_id=?').get(guildId, target.id);

      if (!stats || (stats.correct + stats.wrong) === 0) return interaction.reply({ content: `❌ ${target.id === userId ? 'Vous n\'avez' : `<@${target.id}> n'a`} pas encore joué au quiz !`, ephemeral: true });

      const total = stats.correct + stats.wrong;
      const pct = Math.round(stats.correct / total * 100);

      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle(`🧠 Stats Quiz — ${target.username}`)
          .addFields(
            { name: '✅ Bonnes réponses', value: `**${stats.correct}**`, inline: true },
            { name: '❌ Mauvaises', value: `**${stats.wrong}**`, inline: true },
            { name: '📊 Précision', value: `**${pct}%**`, inline: true },
            { name: '💰 Total gagné', value: `**${stats.total_earned} ${coin}**`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'classement') {
      const top = db.db.prepare('SELECT * FROM quiz_stats WHERE guild_id=? AND (correct+wrong)>0 ORDER BY correct DESC LIMIT 10').all(guildId);
      if (!top.length) return interaction.reply({ content: '❌ Aucun joueur.', ephemeral: true });
      const medals = ['🥇', '🥈', '🥉'];
      const lines = top.map((s, i) => {
        const pct = Math.round(s.correct / (s.correct + s.wrong) * 100);
        return `${medals[i] || `**${i+1}.**`} <@${s.user_id}> — ✅ ${s.correct} | 📊 ${pct}% | 💰 ${s.total_earned} ${coin}`;
      }).join('\n');
      return interaction.reply({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle('🏆 Champions du Quiz').setDescription(lines)
      ]});
    }
  }
};
