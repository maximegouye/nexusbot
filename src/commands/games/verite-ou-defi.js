const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const verites = [
  'Quelle est ta plus grande peur ?',
  'Quel est ton secret le plus embarrassant ?',
  'As-tu déjà menti à quelqu\'un de proche ? Pour quelle raison ?',
  'Quelle est la chose la plus stupide que tu aies faite ?',
  'As-tu déjà triche à un examen ?',
  'Quelle est ta plus grande qualité et ton plus grand défaut ?',
  'Quel est le pire mensonge que tu aies jamais dit ?',
  'Si tu pouvais changer une chose dans ta vie, ce serait quoi ?',
  'Quel est ton plus grand regret ?',
  'As-tu déjà eu un coup de foudre ? Pour qui ?',
  'Qu\'est-ce qui te rend le plus jaloux/jalouse ?',
  'Quelle est la chose dont tu es le plus fier/fière dans ta vie ?',
  'Quel est le talent caché que tu n\'as jamais montré ?',
  'Quelle est la chose la plus bizarre que tu aies mangée ?',
  'Quel est le film ou la série qui t\'a fait pleurer ?',
];

const defis = [
  'Imite le son d\'un animal pendant 30 secondes.',
  'Chante le refrain de ta chanson préférée.',
  'Fais 10 pompes en direct.',
  'Écris un poème de 4 lignes sur un membre de ce serveur.',
  'Change ton pseudo Discord pour "Poulet Rôti" pendant 1 heure.',
  'Envoie un selfie avec une grimace ridicule.',
  'Dis "Je suis le roi des crêpes" 5 fois de suite.',
  'Parle en verlan pendant les 5 prochains messages.',
  'Envoie un message vocal en chuchotant.',
  'Invente un mot et donne-lui une définition sérieuse.',
  'Décris le dernier film que tu as vu en 3 emojis seulement.',
  'Raconte une blague (nulle ou pas) en 30 secondes.',
  'Change ton statut Discord pour quelque chose d\'absurde pendant 30 minutes.',
  'Imite un personnage de dessin animé célèbre.',
  'Fais une déclaration d\'amour à un membre de ce serveur (fiction totale).',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verite-ou-defi')
    .setDescription('💬 Tire une vérité ou un défi aléatoire !')
    .addUserOption(o => o.setName('cible').setDescription('Membre à qui poser la question (optionnel)').setRequired(false)),
  cooldown: 5,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    try {
    const cible = interaction.options.getUser('cible') || interaction.user;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tod_verite').setLabel('💬 Vérité').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tod_defi').setLabel('🔥 Défi').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tod_aleatoire').setLabel('🎲 Aléatoire').setStyle(ButtonStyle.Secondary),
    );

    const introEmbed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('💬 Vérité ou Défi ?')
      .setDescription(`<@${cible.id}> doit choisir : **Vérité** ou **Défi** ?`)
      .setFooter({ text: 'Clique sur un bouton ci-dessous !' });

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [introEmbed], components: [row], fetchReply: true });

    const filter  = i => i.user.id === cible.id || i.user.id === interaction.user.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (btn) => {
      await btn.deferUpdate();
      let choice = btn.customId;
      if (choice === 'tod_aleatoire') choice = Math.random() < 0.5 ? 'tod_verite' : 'tod_defi';

      if (choice === 'tod_verite') {
        const q = verites[Math.floor(Math.random() * verites.length)];
        await msg.edit({
          embeds: [new EmbedBuilder()
            .setColor('#3498DB')
            .setTitle('💬 Vérité !')
            .setDescription(`<@${cible.id}> doit répondre honnêtement à :\n\n❓ **${q}**`)
            .setFooter({ text: 'Pas le choix... dis la vérité !' })
          ],
          components: []
        });
      } else {
        const d = defis[Math.floor(Math.random() * defis.length)];
        await msg.edit({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('🔥 Défi !')
            .setDescription(`<@${cible.id}> doit relever le défi :\n\n🎯 **${d}**`)
            .setFooter({ text: 'Courage... tu peux le faire !' })
          ],
          components: []
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        msg.edit({ components: [] }).catch(() => {});
      }
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
