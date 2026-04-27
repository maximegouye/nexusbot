/**
 * NexusBot — Jeopardy ! Quiz avancé multi-catégories
 * /jeopardy — Quiz format Jeopardy avec catégories et niveaux de difficulté
 */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const db = require('../../database/db');

const QUESTIONS = {
  'Science': {
    200:  { q: 'Quelle est la formule chimique de l\'eau ?',             a: 'h2o',    hint: 'Elle a 3 atomes.' },
    400:  { q: 'Quel est le symbole chimique de l\'or ?',                a: 'au',     hint: '2 lettres, du latin.' },
    600:  { q: 'Combien de planètes dans notre système solaire ?',       a: '8',      hint: 'Pluton n\'est plus une planète.' },
    800:  { q: 'Quelle est la vitesse de la lumière en km/s ?',          a: '300000', hint: 'Environ 300 000.' },
    1000: { q: 'Quel scientifique a formulé la théorie de la relativité ?', a: 'einstein', hint: 'E = mc²' },
  },
  'Géographie': {
    200:  { q: 'Quelle est la capitale de la France ?',        a: 'paris',   hint: 'Ville lumière.' },
    400:  { q: 'Quel est le plus grand pays du monde ?',       a: 'russie',  hint: 'En Europe et Asie.' },
    600:  { q: 'Quel est le plus long fleuve du monde ?',      a: 'nil',     hint: 'En Afrique.' },
    800:  { q: 'Quelle est la plus haute montagne du monde ?', a: 'everest', hint: '8 848 mètres.' },
    1000: { q: 'Dans quel pays se trouve le lac Titicaca ?',  a: 'pérou',   hint: 'Amérique du Sud.' },
  },
  'Histoire': {
    200:  { q: 'En quelle année a eu lieu la Révolution française ?',   a: '1789',   hint: 'XVIIIe siècle.' },
    400:  { q: 'Qui était le premier président des États-Unis ?',       a: 'washington', hint: 'Son prénom est George.' },
    600:  { q: 'En quelle année s\'est terminée la Seconde Guerre Mondiale ?', a: '1945', hint: 'Après 6 ans.' },
    800:  { q: 'Qui a peint la Joconde ?',                              a: 'leonard de vinci', hint: 'Un génie de la Renaissance.' },
    1000: { q: 'Quelle civilisation a construit Machu Picchu ?',        a: 'inca',   hint: 'Amérique du Sud précolombienne.' },
  },
  'Culture Pop': {
    200:  { q: 'Dans quelle ville se déroule "Emily in Paris" ?',       a: 'paris',    hint: 'La capitale française.' },
    400:  { q: 'Quel groupe a chanté "Bohemian Rhapsody" ?',            a: 'queen',    hint: 'Des rois du rock.' },
    600:  { q: 'Dans quelle série trouve-t-on les personnages de "Friends" ?', a: 'friends', hint: 'C\'est le nom de la série !' },
    800:  { q: 'Quel personnage Marvel est joué par Robert Downey Jr. ?', a: 'iron man', hint: 'Il vole en armure.' },
    1000: { q: 'Dans quel film apparaît le vaisseau Millennium Falcon ?', a: 'star wars', hint: 'La guerre des étoiles.' },
  },
  'Sport': {
    200:  { q: 'Combien de joueurs dans une équipe de football ?',      a: '11',       hint: 'Un de chaque poste.' },
    400:  { q: 'Dans quel pays s\'est déroulé le Mondial 2018 ?',       a: 'russie',   hint: 'Très grand pays.' },
    600:  { q: 'Quel pays a remporté le plus de Coupes du Monde de foot ?', a: 'brésil', hint: '5 victoires.' },
    800:  { q: 'Combien de sets gagne-t-on une finale de Wimbledon ?',  a: '3',        hint: 'En 5 sets max.' },
    1000: { q: 'Quelle distance fait un marathon ?',                    a: '42km',     hint: '42,195 km exactement.' },
  },
};

const CATEGORIES = Object.keys(QUESTIONS);
const activeSessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jeopardy')
    .setDescription('🎮 Quiz Jeopardy — Catégories, niveaux, compétition !')
    .addSubcommand(s => s.setName('start')
      .setDescription('▶️ Lancer une partie de Jeopardy'))
    .addSubcommand(s => s.setName('question')
      .setDescription('❓ Choisir une catégorie et une valeur')
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie').setRequired(true)
        .addChoices(
          { name: '🔬 Science', value: 'Science' },
          { name: '🌍 Géographie', value: 'Géographie' },
          { name: '📜 Histoire', value: 'Histoire' },
          { name: '🎬 Culture Pop', value: 'Culture Pop' },
          { name: '⚽ Sport', value: 'Sport' },
        ))
      .addStringOption(o => o.setName('valeur').setDescription('Valeur de la question').setRequired(true)
        .addChoices(
          { name: '💰 200', value: '200' },
          { name: '💰 400', value: '400' },
          { name: '💰 600', value: '600' },
          { name: '💰 800', value: '800' },
          { name: '💰 1000', value: '1000' },
        )))
    .addSubcommand(s => s.setName('scores').setDescription('🏆 Voir les scores de la partie'))
    .addSubcommand(s => s.setName('stop').setDescription('⏹️ Terminer la partie')),

  cooldown: 5,

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub     = interaction.options.getSubcommand();
    const channel = interaction.channel;
    const guildId = interaction.guildId;

    if (sub === 'start') {
      if (activeSessions.has(channel.id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '⚠️ Une partie est déjà en cours !', ephemeral: true });
      const duree = parseInt(interaction.options.getString('duree')) || 10;
      const sess = {
        scores: {},
        used: new Set(),
        startedBy: interaction.user.id,
        endsAt: Date.now() + duree * 60000,
      };
      activeSessions.set(channel.id, sess);

      // Tableau des questions disponibles
      const board = CATEGORIES.map(cat => {
        const vals = [200, 400, 600, 800, 1000];
        return `**${cat}** : ${vals.map(v => `~~${v}~~`).join(' | ')}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🎮 JEOPARDY ! Partie commencée')
        .setDescription(`Durée : **${duree} minutes** | Fin <t:${Math.floor(sess.endsAt/1000)}:R>\n\n**Tableau des catégories :**\n${CATEGORIES.join(' | ')}\n\nValeurs : 200, 400, 600, 800, 1000\n\nUtilise \`/jeopardy question [catégorie] [valeur]\` pour jouer !`)
        .setFooter({ text: `Lancé par ${interaction.user.username}` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'question') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours ! Lance avec `/jeopardy start`', ephemeral: true });
      if (Date.now() > sess.endsAt) {
        activeSessions.delete(channel.id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '⏱️ La partie est terminée !' });
      }

      const cat  = interaction.options.getString('categorie');
      const val  = parseInt(interaction.options.getString('valeur'));
      const key  = `${cat}-${val}`;

      if (sess.used.has(key)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Cette question a déjà été utilisée !`, ephemeral: true });

      const qData = QUESTIONS[cat]?.[val];
      if (!qData) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Question introuvable.', ephemeral: true });

      sess.used.add(key);
      sess.currentQ = { key, cat, val, ...qData, asker: interaction.user.id };

      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`❓ ${cat} — ${val} points`)
        .setDescription(qData.q)
        .setFooter({ text: `Tapez votre réponse dans le chat ! ⏱️ 30 secondes` })
        .setTimestamp()
      ]});

      // Collecteur 30s
      const collector = channel.createMessageCollector({ filter: m => !m.author.bot, time: 30000 });
      let answered = false;

      collector.on('collect', async (msg) => {
        const answer = msg.content.toLowerCase().trim();
        const correct = qData.a.toLowerCase();
        if (answer.includes(correct) || correct.includes(answer) && answer.length >= 3) {
          answered = true;
          collector.stop('answered');
          sess.scores[msg.author.id] = (sess.scores[msg.author.id] || 0) + val;
          await msg.react('✅');
          db.addCoins(msg.author.id, guildId, val);
          await channel.send({ embeds: [new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(`✅ **${msg.author.username}** a la bonne réponse !\nRéponse : **${qData.a}**\n+**${val}** points & +**${val}** 🪙 !`)
          ]});
        }
      });

      collector.on('end', async (_, reason) => {
        if (!answered) {
          await channel.send({ embeds: [new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription(`⏱️ Temps écoulé !\nLa réponse était : **${qData.a}**\nIndice : *${qData.hint}*`)
          ]}).catch(() => {});
        }
        sess.currentQ = null;
      });
      return;
    }

    if (sub === 'scores') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours.', ephemeral: true });
      const scores = Object.entries(sess.scores).sort((a, b) => b[1] - a[1]);
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏆 Scores Jeopardy')
        .setDescription(scores.length ? scores.map(([id, pts], i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} <@${id}> — **${pts} pts**`).join('\n') : 'Personne n\'a encore répondu.')
        .setFooter({ text: `Questions utilisées : ${sess.used.size}/25` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'stop') {
      const sess = activeSessions.get(channel.id);
      if (!sess) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune partie en cours.', ephemeral: true });
      activeSessions.delete(channel.id);
      const scores = Object.entries(sess.scores).sort((a, b) => b[1] - a[1]);
      const embed = new EmbedBuilder()
        .setColor('#f39c12')
        .setTitle('🏁 Jeopardy — Partie terminée !')
        .setDescription(scores.length ? scores.map(([id, pts], i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} <@${id}> — **${pts} points**`).join('\n') : 'Aucun point marqué.')
        .setFooter({ text: `${sess.used.size}/25 questions utilisées` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
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
