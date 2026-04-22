// ============================================================
// pfc.js — Pile ou Face amélioré avec animations
// Emplacement : src/commands_guild/games/pfc.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SPIN_FRAMES = ['🌀', '💫', '🌀', '💫', '🌀'];

async function playCoinFlip(source, userId, guildId, mise, choix) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  if (!u || u.solde < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.reply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  const side   = ['pile', 'face'];
  const chosen = choix ? choix.toLowerCase() : null;
  if (chosen && !side.includes(chosen)) {
    const err = '❌ Choisis `pile` ou `face`.';
    if (isInteraction) return source.reply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Animation
  const animEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🪙 ・ Pile ou Face ・')
    .setDescription('**La pièce tourne dans les airs...**\n\n🌀')
    .addFields({ name: '🎯 Ton choix', value: chosen ? (chosen === 'pile' ? '🟡 Pile' : '⚪ Face') : '🎲 Aléatoire', inline: true });

  let msg;
  if (isInteraction) {
    await source.reply({ embeds: [animEmbed] });
    msg = await source.fetchReply();
  } else {
    msg = await source.reply({ embeds: [animEmbed] });
  }

  for (const frame of SPIN_FRAMES) {
    await sleep(350);
    const e = new EmbedBuilder().setColor('#E67E22').setTitle('🪙 ・ Pile ou Face ・').setDescription(`**La pièce tourne...**\n\n${frame}`);
    await msg.edit({ embeds: [e] });
  }
  await sleep(400);

  const result = Math.random() < 0.5 ? 'pile' : 'face';
  const won    = !chosen || chosen === result;
  const gain   = won ? Math.floor(mise * 2) : 0;
  if (won) db.addCoins(userId, guildId, gain);

  const emoji  = result === 'pile' ? '🟡' : '⚪';
  const color  = won ? '#2ECC71' : '#E74C3C';
  const desc   = won
    ? `${emoji} **${result.toUpperCase()}** ! 🎉 Tu as gagné **+${gain} ${coin}** !`
    : `${emoji} **${result.toUpperCase()}** ! 😔 Tu as perdu **${mise} ${coin}**...`;

  // Boutons rejouer
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`pfc_pile_${userId}_${mise}`).setLabel('🟡 Pile').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`pfc_face_${userId}_${mise}`).setLabel('⚪ Face').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pfc_random_${userId}_${mise}`).setLabel('🎲 Aléatoire').setStyle(ButtonStyle.Success),
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🪙 ・ Pile ou Face — Résultat ・')
    .setDescription(`# ${emoji}\n\n${desc}`)
    .addFields(
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.solde || 0} ${coin}`, inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed], components: [row] });

  // Collector rejouer
  const filter = i => i.user.id === userId && i.customId.startsWith('pfc_');
  const collector = msg.createMessageComponentCollector({ filter, time: 30_000 });

  collector.on('collect', async i => {
    await i.deferUpdate();
    collector.stop();
    const parts  = i.customId.split('_');
    const newChoix = parts[1] === 'random' ? null : parts[1];
    const newMise  = parseInt(parts[3]);
    await playCoinFlip(
      source.channel ? { ...source, reply: (d) => source.channel.send(d), editReply: null } : source,
      userId, guildId, newMise, newChoix
    );
  });
  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pile-ou-face')
    .setDescription('🪙 Pile ou Face — 50/50, ×2 si tu gagnes !')
    .addStringOption(o => o.setName('mise').setDescription('Montant à miser').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choix').setDescription('pile ou face (optionnel)').addChoices(
      { name: '🟡 Pile', value: 'pile' },
      { name: '⚪ Face', value: 'face' },
    )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    await playCoinFlip(
      interaction,
      interaction.user.id,
      interaction.guildId,
      parseInt(interaction.options.getString('mise')),
      interaction.options.getString('choix'),
    );
  },

  name: 'pile-ou-face',
  aliases: ['pf', 'coinflip', 'cf', 'flip'],
  async run(message, args) {
    const mise  = parseInt(args[0]);
    const choix = args[1] || null;
    if (!mise || mise < 1) return message.reply('❌ Usage : `&pile-ou-face <mise> [pile/face]`');
    await playCoinFlip(message, message.author.id, message.guildId, mise, choix);
  },
};
