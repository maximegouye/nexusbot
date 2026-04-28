const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const ENIGMES = [
  { q: 'Plus je sèche, plus je suis mouillée. Qui suis-je ?', a: ['serviette', 'une serviette'], hint: 'On l\'utilise après la douche' },
  { q: 'J\'ai des villes, mais pas de maisons. Des forêts, mais pas d\'arbres. De l\'eau, mais pas de poissons. Qui suis-je ?', a: ['carte', 'une carte', 'map'], hint: 'On me consulte pour s\'orienter' },
  { q: 'Je parle sans bouche et entends sans oreilles. Je n\'ai pas de corps mais je prends vie avec le vent. Qui suis-je ?', a: ['echo', 'un écho', 'écho'], hint: 'Phénomène acoustique dans les montagnes' },
  { q: 'Qu\'est-ce qu\'un homme peut faire et qu\'une femme ne peut pas faire debout, qu\'un homme ne peut pas faire assis, et qu\'une femme peut faire assise et debout ?', a: ['serrer la main', 'donner la main'], hint: 'Geste de politesse' },
  { q: 'Je suis sans fenêtre ni porte, et pleine de trésors. Qui suis-je ?', a: ['noix', 'une noix', 'noisette'], hint: 'Un fruit à coque' },
  { q: 'Je commence par la lettre E, je se termine par la lettre E, mais je ne contiens qu\'une lettre. Qui suis-je ?', a: ['enveloppe', 'une enveloppe'], hint: 'On met des lettres dedans' },
  { q: 'Quelle est la chose que tu peux briser même sans y toucher ?', a: ['silence', 'le silence'], hint: 'Ce qui règne dans le calme absolu' },
  { q: 'Je n\'ai pas d\'ailes, mais je vole. Je n\'ai pas d\'yeux, mais je pleure. Qui suis-je ?', a: ['nuage', 'un nuage'], hint: 'Dans le ciel' },
  { q: 'Les pauvres en ont, les riches en manquent, et si tu en manges, tu mourras. Qu\'est-ce que c\'est ?', a: ['rien', 'le rien'], hint: 'L\'absence totale' },
  { q: 'Qu\'est-ce qui est toujours devant toi, mais ne se voit jamais ?', a: ['futur', 'l\'avenir', 'avenir', 'le futur'], hint: 'Ce qui n\'est pas encore arrivé' },
  { q: 'Quelle est la rivière qu\'on ne peut pas traverser à la nage ?', a: ['seine', 'la seine'], hint: 'Coule à Paris' },
  { q: 'Je suis léger comme une plume, mais le plus fort ne peut me tenir plus d\'une minute. Qui suis-je ?', a: ['souffle', 'le souffle', 'respiration', 'air'], hint: 'On le retient sous l\'eau' },
];

const REWARD = 100;
const activeEnigmes = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enigme')
    .setDescription('🧩 Résolvez des énigmes et gagnez des € !')
    .addSubcommand(s => s.setName('jouer').setDescription('🧩 Recevoir une nouvelle énigme'))
    .addSubcommand(s => s.setName('reponse').setDescription('💡 Donner votre réponse')
      .addStringOption(o => o.setName('texte').setDescription('Votre réponse').setRequired(true)))
    .addSubcommand(s => s.setName('indice').setDescription('🔍 Obtenir un indice (-50% de la récompense)')),

  async execute(interaction) {
    try {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';
    const key = `${guildId}_${userId}`;

    if (sub === 'jouer') {
      if (activeEnigmes.has(key)) return interaction.editReply({ content: '❌ Vous avez déjà une énigme en cours ! Répondez avec `/enigme reponse`.', ephemeral: true });

      const enigme = ENIGMES[Math.floor(Math.random() * ENIGMES.length)];
      activeEnigmes.set(key, { ...enigme, hintUsed: false, time: Date.now() });

      // Auto-expire après 5 minutes
      setTimeout(() => {
        if (activeEnigmes.has(key)) {
          activeEnigmes.delete(key);
        }
      }, 300000);

      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#9B59B6').setTitle('🧩 Énigme !')
          .setDescription(`**${enigme.q}**`)
          .addFields(
            { name: '💰 Récompense', value: `**${REWARD} ${coin}** (ou ${REWARD/2} avec indice)`, inline: true },
            { name: '⏳ Temps', value: '5 minutes', inline: true },
          )
          .setFooter({ text: '/enigme reponse <réponse> • /enigme indice' })
      ]});
    }

    if (sub === 'reponse') {
      const game = activeEnigmes.get(key);
      if (!game) return interaction.editReply({ content: '❌ Aucune énigme en cours. Lancez-en une avec `/enigme jouer` !', ephemeral: true });

      const texte = interaction.options.getString('texte').toLowerCase().trim();
      const isCorrect = game.a.some(a => texte.includes(a.toLowerCase()));

      if (isCorrect) {
        const reward = game.hintUsed ? REWARD / 2 : REWARD;
        db.addCoins(userId, guildId, reward);
        activeEnigmes.delete(key);

        const timeTaken = ((Date.now() - game.time) / 1000).toFixed(1);
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor('#2ECC71').setTitle('🎉 Bonne réponse !')
            .setDescription(`La réponse était : **${game.a[0]}**\nVous avez gagné **+${reward} ${coin}** !`)
            .addFields({ name: '⏱️ Temps', value: `${timeTaken}s`, inline: true })
        ]});
      } else {
        return interaction.editReply({ content: `❌ Mauvaise réponse ! Réessayez ou demandez un \`/enigme indice\`.`, ephemeral: true });
      }
    }

    if (sub === 'indice') {
      const game = activeEnigmes.get(key);
      if (!game) return interaction.editReply({ content: '❌ Aucune énigme en cours.', ephemeral: true });
      if (game.hintUsed) return interaction.editReply({ content: '❌ Vous avez déjà utilisé votre indice.', ephemeral: true });

      game.hintUsed = true;
      return interaction.editReply({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🔍 Indice')
          .setDescription(`**${game.hint}**\n⚠️ La récompense est réduite à **${REWARD/2} ${coin}**`)
      ], ephemeral: true });
    }
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
    }
  }
};

// Réactivé comme prefix-only (limite slash Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
