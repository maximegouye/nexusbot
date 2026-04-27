/**
 * NexusBot — Quiz Musical
 * /musicquiz — Devinez les artistes, albums et chansons !
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const QUESTIONS = {
  artiste: [
    { q: 'Quel artiste a sorti l\'album "Thriller" en 1982 ?',           a: ['michael jackson', 'jackson'],       hint: 'Roi de la pop.' },
    { q: 'Qui chante "Lose Yourself" ?',                                   a: ['eminem'],                           hint: 'Rappeur américain, 8 Mile.' },
    { q: 'Quel groupe a sorti "Bohemian Rhapsody" ?',                     a: ['queen'],                            hint: 'Des rois.' },
    { q: 'Qui a créé les morceaux "Blinding Lights" et "Starboy" ?',      a: ['the weeknd', 'weeknd'],             hint: 'Artiste canadien.' },
    { q: 'Quel artiste est connu sous le nom "Ye" ?',                     a: ['kanye west', 'kanye', 'ye'],        hint: 'Rappeur américain influent.' },
    { q: 'Qui chante "Rolling in the Deep" ?',                             a: ['adele'],                            hint: 'Chanteuse britannique.' },
    { q: 'Quel duo a sorti "Get Lucky" ?',                                 a: ['daft punk'],                        hint: 'Robots français.' },
    { q: 'Qui est l\'artiste derrière "Bad Guy" ?',                       a: ['billie eilish', 'eilish'],          hint: 'Artiste avec des cheveux verts.' },
    { q: 'Quel artiste chante "Despacito" ?',                             a: ['luis fonsi', 'fonsi'],              hint: 'Chanteur portoricain.' },
    { q: 'Qui a sorti "Shape of You" ?',                                   a: ['ed sheeran', 'sheeran'],            hint: 'Guitariste roux britannique.' },
    { q: 'Quel groupe français chante "Alors on Danse" ?',                a: ['stromae'],                          hint: 'Artiste belge.' },
    { q: 'Qui chante "Baby" avec Justin Bieber ?',                         a: ['ludacris'],                         hint: 'Rappeur américain.' },
    { q: 'Quel artiste a sorti "God\'s Plan" ?',                          a: ['drake'],                            hint: 'Rappeur canadien de Toronto.' },
    { q: 'Qui est "l\'Artiste" français connu pour ses hits variétés ?',  a: ['gims', 'maître gims'],              hint: 'Membre de la Sexion d\'Assaut.' },
    { q: 'Quel groupe chante "Smells Like Teen Spirit" ?',                a: ['nirvana'],                          hint: 'Grunge, Seattle.' },
    { q: 'Qui chante "Happy" dans le film Despicable Me 2 ?',             a: ['pharrell williams', 'pharrell'],    hint: 'Chapeau iconique.' },
    { q: 'Quel artiste a lancé "Old Town Road" ?',                        a: ['lil nas x', 'nas x'],               hint: 'Record de semaines #1.' },
    { q: 'Qui est le chanteur de Coldplay ?',                              a: ['chris martin', 'martin'],           hint: 'Frontman britannique.' },
    { q: 'Quel artiste chante "Savage" ?',                                 a: ['megan thee stallion', 'megan'],    hint: 'Rappeuse texane.' },
    { q: 'Qui a sorti l\'album "ASTROWORLD" ?',                           a: ['travis scott', 'travis'],           hint: 'Rappeur de Houston.' },
  ],
  annee: [
    { q: 'En quelle année est sorti "Thriller" de Michael Jackson ?',         a: ['1982'], hint: 'Début des années 80.' },
    { q: 'En quelle année est sorti "Bohemian Rhapsody" de Queen ?',          a: ['1975'], hint: 'Milieu des années 70.' },
    { q: 'En quelle année Taylor Swift a-t-elle sorti "1989" ?',              a: ['2014'], hint: '5 ans avant 2019.' },
    { q: 'En quelle année est sortie "Lose Yourself" d\'Eminem ?',            a: ['2002'], hint: 'Début des années 2000.' },
    { q: 'En quelle année est sorti "Rolling in the Deep" d\'Adele ?',        a: ['2011'], hint: 'Début des années 2010.' },
    { q: 'En quelle année "Blinding Lights" de The Weeknd est sorti ?',       a: ['2019'], hint: 'Avant la pandémie.' },
    { q: 'En quelle année est sorti "Despacito" ?',                           a: ['2017'], hint: 'Été viral.' },
    { q: 'En quelle année "Shape of You" d\'Ed Sheeran est sorti ?',          a: ['2017'], hint: 'Même année que Despacito.' },
    { q: 'En quelle année "God\'s Plan" de Drake est sorti ?',               a: ['2018'], hint: 'Fin des années 2010.' },
    { q: 'En quelle année est sorti "Old Town Road" ?',                        a: ['2019'], hint: 'Été 2019.' },
  ],
  chanson: [
    { q: 'Comment s\'appelle le titre phare de Michael Jackson avec un zombie ?', a: ['thriller'],              hint: 'C\'est aussi le nom de l\'album.' },
    { q: 'Quel est le titre de la chanson d\'Eminem du film 8 Mile ?',            a: ['lose yourself'],         hint: 'Tu as une chance.' },
    { q: 'Comment s\'appelle le tube de Dua Lipa sorti en 2020 ?',                a: ['levitating', 'physical','don\'t start now'], hint: 'Elle flotte.' },
    { q: 'Quel titre de Drake parle d\'un "plan de Dieu" ?',                      a: ['god\'s plan', 'gods plan'], hint: 'Plan divin.' },
    { q: 'Comment s\'appelle le tube de Pharrell Williams dans Despicable Me 2 ?', a: ['happy'],                 hint: 'Sentiment positif.' },
    { q: 'Quel est le titre le plus connu de Nirvana ?',                          a: ['smells like teen spirit'], hint: 'Esprit de la jeunesse.' },
    { q: 'Quelle chanson de Billie Eilish parle d\'une "mauvaise fille" ?',       a: ['bad guy'],                hint: 'Méchante fille.' },
    { q: 'Comment s\'appelle le tube de The Weeknd avec des lumières aveugles ?', a: ['blinding lights'],        hint: 'Lumières éblouissantes.' },
    { q: 'Quel morceau de Coldplay parle de "Yellow" ?',                          a: ['yellow'],                 hint: 'Couleur du soleil.' },
    { q: 'Comment s\'appelle la chanson d\'Adele "Rouler dans les profondeurs" ?', a: ['rolling in the deep'],   hint: 'Traduction littérale.' },
  ],
};

const ALL_TYPES = Object.keys(QUESTIONS);
const activeSessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('musicquiz')
    .setDescription('🎵 Quiz Musical — Artistes, dates et chansons !')
    .addSubcommand(s => s.setName('jouer')
      .setDescription('▶️ Lancer une partie de quiz musical')
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie de questions')
        .addChoices(
          { name: '🎤 Artistes', value: 'artiste' },
          { name: '📅 Années',   value: 'annee'   },
          { name: '🎵 Chansons', value: 'chanson' },
          { name: '🎲 Mixte',    value: 'mixte'   },
        )))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Arrêter la partie en cours'))
    .addSubcommand(s => s.setName('scores').setDescription('🏆 Voir les scores de la partie')),

  cooldown: 5,

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const channel = interaction.channel;
    const guildId = interaction.guildId;

    if (sub === 'stop') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours.', ephemeral: true });
      activeSessions.delete(channel.id);
      const scores = Object.entries(sess.scores).sort((a,b) => b[1]-a[1]);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#e74c3c').setTitle('⏹️ Partie arrêtée')
        .setDescription(scores.length ? scores.map(([id,pts],i) => `${i===0?'🥇':i===1?'🥈':'🥉'} <@${id}> — **${pts} pts**`).join('\n') : 'Aucun point.')
      ]});
    }

    if (sub === 'scores') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours.', ephemeral: true });
      const scores = Object.entries(sess.scores).sort((a,b) => b[1]-a[1]);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#f39c12').setTitle('🏆 Scores Music Quiz')
        .setDescription(scores.length ? scores.map(([id,pts],i) => `${i===0?'🥇':i===1?'🥈':'🥉'} <@${id}> — **${pts} pts**`).join('\n') : 'Personne n\'a encore répondu.')
        .setFooter({ text: `Question ${sess.current}/${sess.total}` })
      ], ephemeral: true });
    }

    if (sub === 'jouer') {
      if (activeSessions.has(channel.id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '⚠️ Une partie est déjà en cours !', ephemeral: true });

      const categorie = interaction.options.getString('categorie') || 'mixte';
      const nbQ       = parseInt(interaction.options.getString('questions')) || 5;

      // Sélectionner les questions
      let pool = [];
      if (categorie === 'mixte') {
        ALL_TYPES.forEach(t => pool.push(...QUESTIONS[t].map(q => ({ ...q, type: t }))));
      } else {
        pool = QUESTIONS[categorie].map(q => ({ ...q, type: categorie }));
      }

      // Shuffle et limiter
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const questions = pool.slice(0, Math.min(nbQ, pool.length));

      const sess = { scores: {}, current: 0, total: questions.length, questions, guildId };
      activeSessions.set(channel.id, sess);

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#e91e8c')
        .setTitle('🎵 Music Quiz — Partie lancée !')
        .setDescription(`**${questions.length} questions** sur le thème : **${categorie === 'mixte' ? 'Mixte' : categorie}**\n\nRépondez dans le chat ! ⏱️ 20 secondes par question.\n\nBonne chance ! 🎶`)
        .setFooter({ text: `Lancé par ${interaction.user.username}` })
      ]});

      // Lancer les questions séquentiellement
      const askNext = async () => {
        const sess = activeSessions.get(channel.id);
        if (!sess) return;

        if (sess.current >= sess.total) {
          activeSessions.delete(channel.id);
          const scores = Object.entries(sess.scores).sort((a,b) => b[1]-a[1]);

          if (scores.length > 0) {
            db.addCoins(scores[0][0], guildId, 200);
            if (scores[1]) db.addCoins(scores[1][0], guildId, 100);
            if (scores[2]) db.addCoins(scores[2][0], guildId, 50);
          }

          await channel.send({ embeds: [new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🏆 Fin du Music Quiz !')
            .setDescription(scores.length
              ? scores.slice(0,5).map(([id,pts],i) => `${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} <@${id}> — **${pts} pts**`).join('\n')
              : 'Personne n\'a répondu...')
            .setFooter({ text: '🥇 +200 coins | 🥈 +100 coins | 🥉 +50 coins' })
          ]}).catch(() => {});
          return;
        }

        const q = sess.questions[sess.current];
        sess.current++;

        const catEmoji = { artiste: '🎤', annee: '📅', chanson: '🎵' };
        const embed = new EmbedBuilder()
          .setColor('#e91e8c')
          .setTitle(`${catEmoji[q.type]} Question ${sess.current}/${sess.total}`)
          .setDescription(`**${q.q}**`)
          .setFooter({ text: '⏱️ 20 secondes pour répondre !' })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});

        let answered = false;
        const collector = channel.createMessageCollector({ filter: m => !m.author.bot, time: 20000 });

        collector.on('collect', async (msg) => {
          const ans = msg.content.toLowerCase().trim();
          const isCorrect = q.a.some(correct => ans.includes(correct) || correct.includes(ans) && ans.length >= 3);

          if (isCorrect) {
            answered = true;
            collector.stop('answered');
            const s = activeSessions.get(channel.id);
            if (s) s.scores[msg.author.id] = (s.scores[msg.author.id] || 0) + 10;
            await msg.react('✅').catch(() => {});
            await channel.send({ embeds: [new EmbedBuilder()
              .setColor('#2ecc71')
              .setDescription(`✅ **${msg.author.username}** a la bonne réponse : **${q.a[0]}** ! (+10 pts)`)
            ]}).catch(() => {});
          }
        });

        collector.on('end', async (_, reason) => {
          if (!answered) {
            await channel.send({ embeds: [new EmbedBuilder()
              .setColor('#e74c3c')
              .setDescription(`⏱️ Temps écoulé !\nLa réponse était : **${q.a[0]}**\n💡 Indice : *${q.hint}*`)
            ]}).catch(() => {});
          }
          setTimeout(askNext, 2000);
        });
      };

      setTimeout(askNext, 2000);
      return;
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

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
