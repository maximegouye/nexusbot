// ============================================================
// des.js — Dés améliorés avec animations et modes de jeu
// Emplacement : src/commands_guild/games/des.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const DICE_EMOJIS = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const SPIN_DICE   = ['🎲','🎯','🎲','🎯'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rollDie()  { return Math.floor(Math.random() * 6) + 1; }
function diceEmoji(n) { return DICE_EMOJIS[n - 1]; }

// Modes de pari
// - "haut"  : 4-6 (×1.8)
// - "bas"   : 1-3 (×1.8)
// - "pair"  : 2,4,6 (×1.8)
// - "impair": 1,3,5 (×1.8)
// - "1" à "6": exact (×5.5)
// - "2d-X"  : somme de 2 dés = X (×3 à ×30 selon proba)

const EXACT_SUMS_2D = {
  2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5,
  8: 6, 9: 8, 10: 11, 11: 17, 12: 35,
};

async function playDice(source, userId, guildId, mise, betStr, numDice = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  if (!u || u.solde < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.reply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  let payout = 0, winCondition, betLabel;
  const bet = betStr.toLowerCase().trim();

  if (bet === 'haut' || bet === 'high')    { winCondition = r => r >= 4; payout = 1.8; betLabel = '⬆️ Haut (4-6)'; }
  else if (bet === 'bas' || bet === 'low') { winCondition = r => r <= 3; payout = 1.8; betLabel = '⬇️ Bas (1-3)'; }
  else if (bet === 'pair' || bet === 'even')   { winCondition = r => r % 2 === 0; payout = 1.8; betLabel = '🔢 Pair'; }
  else if (bet === 'impair' || bet === 'odd')  { winCondition = r => r % 2 !== 0; payout = 1.8; betLabel = '🔢 Impair'; }
  else if (/^\d+$/.test(bet) && parseInt(bet) >= 1 && parseInt(bet) <= 6) {
    const n = parseInt(bet);
    winCondition = r => r === n;
    payout = 5.5;
    betLabel = `🎯 Exact ${diceEmoji(n)}`;
  } else if (bet.startsWith('somme') || bet.startsWith('sum')) {
    const n = parseInt(bet.replace(/[^0-9]/g, ''));
    if (!n || n < 2 || n > 12 || numDice < 2) {
      const err = '❌ Pour parier sur une somme, utilisez 2 dés. Ex: `&des 100 somme7 2`';
      if (isInteraction) return source.reply({ content: err, ephemeral: true });
      return source.reply(err);
    }
    winCondition = (r1, r2) => r1 + r2 === n;
    payout = EXACT_SUMS_2D[n] || 5;
    betLabel = `➕ Somme ${n}`;
    numDice = 2;
  } else {
    const help = '**Paris disponibles :**\n`haut` (4-6) ×1.8\n`bas` (1-3) ×1.8\n`pair` ×1.8\n`impair` ×1.8\n`1` à `6` (exact) ×5.5\n`somme7` (2 dés, somme exacte) ×variable';
    const err = `❌ Pari invalide.\n\n${help}`;
    if (isInteraction) return source.reply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Animation lancer
  const animEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎲 ・ Dés ・')
    .setDescription(`${SPIN_DICE.join(' ')} *Lancer en cours...*`)
    .addFields({ name: '🎯 Pari', value: betLabel, inline: true }, { name: '💰 Mise', value: `${mise} ${coin}`, inline: true });

  let msg;
  if (isInteraction) {
    await source.reply({ embeds: [animEmbed] });
    msg = await source.fetchReply();
  } else {
    msg = await source.reply({ embeds: [animEmbed] });
  }

  for (let f = 0; f < 4; f++) {
    await sleep(300);
    const fakeRolls = Array.from({ length: numDice }, () => DICE_EMOJIS[Math.floor(Math.random() * 6)]).join(' ');
    const e = new EmbedBuilder().setColor('#E67E22').setTitle('🎲 ・ Dés ・').setDescription(`${fakeRolls}\n*Lancer...*`);
    await msg.edit({ embeds: [e] });
  }

  await sleep(400);

  // Résultat
  const rolls = Array.from({ length: numDice }, () => rollDie());
  const rollStr = rolls.map(diceEmoji).join(' ');
  const sum = rolls.reduce((a, b) => a + b, 0);

  let won;
  if (numDice === 2 && betLabel.includes('Somme')) {
    won = winCondition(rolls[0], rolls[1]);
  } else {
    won = winCondition(rolls[0]);
  }

  const gain = won ? Math.floor(mise * (payout + 1)) : 0;
  if (won) db.addCoins(userId, guildId, gain);

  const color  = won ? '#2ECC71' : '#E74C3C';
  const result = won
    ? `🎉 **Gagné !** ${rollStr} — +**${gain} ${coin}**`
    : `💸 **Perdu.** ${rollStr}${numDice === 2 ? ` (somme: ${sum})` : ''} — -**${mise} ${coin}**`;

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎲 ・ Résultat des Dés ・')
    .setDescription(`# ${rollStr}\n\n${result}`)
    .addFields(
      { name: '🎯 Pari', value: betLabel, inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.solde || 0} ${coin}`, inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('des')
    .setDescription('🎲 Lancez les dés et pariez sur le résultat !')
    .addStringOption(o => o.setName('mise').setDescription('Mise (min 5)').setRequired(true))
    .addStringOption(o => o.setName('pari').setDescription('haut/bas/pair/impair/1-6/somme7').setRequired(true))
    .addStringOption(o => o.setName('des').setDescription('Nombre de dés (1 ou 2)')),

  async execute(interaction) {
    await playDice(
      interaction,
      interaction.user.id,
      interaction.guildId,
      parseInt(interaction.options.getString('mise')),
      interaction.options.getString('pari'),
      parseInt(interaction.options.getString('des')) || 1,
    );
  },

  name: 'des',
  aliases: ['dice', 'dé', 'roll'],
  async run(message, args) {
    const mise  = parseInt(args[0]);
    const pari  = args[1] || 'haut';
    const numD  = parseInt(args[2]) || 1;
    if (!mise || mise < 5) return message.reply('❌ Usage : `&des <mise> <pari> [dés]`\nEx: `&des 100 haut` ou `&des 200 somme7 2`');
    await playDice(message, message.author.id, message.guildId, mise, pari, numD);
  },
};
