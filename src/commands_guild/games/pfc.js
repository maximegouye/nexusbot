// ============================================================
// pfc.js — Pile ou Face amélioré avec animations
// Emplacement : src/commands_guild/games/pfc.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const COIN_FRAMES = [
  { emoji:'🟡', label:'PILE',  color:'#F1C40F' },
  { emoji:'💠', label:'...',   color:'#3498DB' },
  { emoji:'⚪', label:'FACE',  color:'#95A5A6' },
  { emoji:'💠', label:'...',   color:'#2980B9' },
  { emoji:'🟡', label:'PILE',  color:'#F39C12' },
  { emoji:'💠', label:'...',   color:'#1ABC9C' },
  { emoji:'⚪', label:'FACE',  color:'#7F8C8D' },
];

async function playCoinFlip(source, userId, guildId, mise, choix) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  const side   = ['pile', 'face'];
  const chosen = choix ? choix.toLowerCase() : null;
  if (chosen && !side.includes(chosen)) {
    const err = '❌ Choisis `pile` ou `face`.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Animation
  const animEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('💶 ・ Pile ou Face ・')
    .setDescription('**La pièce tourne dans les airs...**\n\n🌀')
    .addFields({ name: '🎯 Ton choix', value: chosen ? (chosen === 'pile' ? '🟡 Pile' : '⚪ Face') : '🎲 Aléatoire', inline: true });

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [animEmbed] });
  } else {
    msg = await source.reply({ embeds: [animEmbed] });
  }

  // Animation améliorée : pièce qui tourne avec faces alternantes
  const flipSpeeds = [180, 200, 240, 300, 380, 480];
  for (let i = 0; i < COIN_FRAMES.length; i++) {
    const { emoji, label, color } = COIN_FRAMES[i];
    const delay = flipSpeeds[Math.min(i, flipSpeeds.length-1)];
    const progress = '▓'.repeat(i+1) + '░'.repeat(COIN_FRAMES.length-i-1);
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle('💶 ・ Pile ou Face ・')
      .setDescription(`# ${emoji}  ${label}\n\n` + '`' + `[${progress}]` + '`')
      .addFields({name:'🎯 Ton choix',value:chosen ? (chosen==='pile'?'🟡 Pile':'⚪ Face'):'🎲 Aléatoire',inline:true});
    await msg.edit({ embeds: [e] });
    await sleep(delay);
  }
  await sleep(300);

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
    .setTitle('💶 ・ Pile ou Face — Résultat ・')
    .setDescription(`# ${emoji}\n\n${desc}`)
    .addFields(
      { name: '€ Mise', value: `${mise} ${coin}`, inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
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
    const newSource = isInteraction ? source : { ...source, reply: (d) => source.channel.send(d), editReply: (d) => msg.edit(d) };
    await playCoinFlip(
      newSource,
      userId, guildId, newMise, newChoix
    );
  });
  collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pile-ou-face')
    .setDescription('💶 Pile ou Face — 50/50, ×2 si tu gagnes !')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('choix').setDescription('pile ou face (optionnel)').addChoices(
      { name: '🟡 Pile', value: 'pile' },
      { name: '⚪ Face', value: 'face' },
    )),

  async execute(interaction) {
    try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playCoinFlip(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('choix'),
    );
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.reply(_em).catch(() => {});
    } catch {}
  }},

  name: 'pile-ou-face',
  aliases: ['pfc', 'pf', 'coinflip', 'cf', 'flip'],
  async run(message, args) {
    const mise  = parseInt(args[0]);
    const choix = args[1] || null;
    if (!mise || mise < 1) return message.reply('❌ Usage : `&pile-ou-face <mise> [pile/face]`');
    await playCoinFlip(message, message.author.id, message.guildId, mise, choix);
  },
};


// Désactivée temporairement (limite 100 cmds Discord)
if (module.exports && module.exports.data) module.exports._prefixOnly = true;
