// ============================================================
// des.js — Dés améliorés avec animations et bouton rejouer
// Emplacement : src/commands_guild/games/des.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

const DICE_EMOJIS = ['⚀','⚁','⚂','⚃','⚄','⚅'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rollDie()  { return Math.floor(Math.random() * 6) + 1; }
function diceEmoji(n) { return DICE_EMOJIS[n - 1]; }

// Modes de pari
const EXACT_SUMS_2D = {
  2: 35, 3: 17, 4: 11, 5: 8, 6: 6, 7: 5,
  8: 6, 9: 8, 10: 11, 11: 17, 12: 35,
};

const BET_HELP = [
  '**═══ TABLE DE MISE (Dés) ═══**',
  '⬆️ `haut` (4-6)      → ×1.8',
  '⬇️ `bas` (1-3)       → ×1.8',
  '🔢 `pair`            → ×1.8',
  '🔢 `impair`          → ×1.8',
  '🎯 `1` à `6` (exact) → ×5.5',
  '➕ `somme7` (2 dés)  → ×variable',
].join('\n');

// Phases d'animation des dés
const ROLL_PHASES = [
  { delay:130, color:'#F39C12', text:'🎲 Les dés roulent... Lancement !' },
  { delay:170, color:'#E67E22', text:'🎲 Les dés roulent... Vitesse maximale !' },
  { delay:230, color:'#D35400', text:'🎲 Les dés roulent... Presque...' },
  { delay:310, color:'#C0392B', text:'🎲 Les dés roulent... Dernière rotation...' },
  { delay:400, color:'#922B21', text:'🎲 Les dés roulent... Suspense...' },
];

async function playDice(source, userId, guildId, mise, betStr, numDice = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  let payout = 0, winCondition, betLabel;
  const bet = betStr.toLowerCase().trim();

  if (bet === 'haut' || bet === 'high')         { winCondition = r => r >= 4; payout = 1.8; betLabel = '⬆️ Haut (4-6)'; }
  else if (bet === 'bas' || bet === 'low')       { winCondition = r => r <= 3; payout = 1.8; betLabel = '⬇️ Bas (1-3)'; }
  else if (bet === 'pair' || bet === 'even')     { winCondition = r => r % 2 === 0; payout = 1.8; betLabel = '🔢 Pair'; }
  else if (bet === 'impair' || bet === 'odd')    { winCondition = r => r % 2 !== 0; payout = 1.8; betLabel = '🔢 Impair'; }
  else if (/^\d+$/.test(bet) && parseInt(bet) >= 1 && parseInt(bet) <= 6) {
    const n = parseInt(bet);
    winCondition = r => r === n;
    payout = 5.5;
    betLabel = `🎯 Exact ${diceEmoji(n)} (${n})`;
  } else if (bet.startsWith('somme') || bet.startsWith('sum')) {
    const n = parseInt(bet.replace(/[^0-9]/g, ''));
    if (!n || n < 2 || n > 12 || numDice < 2) {
      const err = '❌ Pour parier sur une somme, utilisez 2 dés. Ex: `&des 100 somme7 2`';
      if (isInteraction) return source.editReply({ content: err, ephemeral: true });
      return source.reply(err);
    }
    winCondition = (r1, r2) => r1 + r2 === n;
    payout = EXACT_SUMS_2D[n] || 5;
    betLabel = `➕ Somme ${n}`;
    numDice = 2;
  } else {
    const err = `❌ Pari invalide.\n\n${BET_HELP}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  // Embed de départ
  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎲 Lancé de Dés')
    .setDescription('🎲 🎲 *Les dés sont lancés...*')
    .addFields(
      { name: '🎯 Pari', value: betLabel, inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
    );

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  // Animation : dés qui s'agitent
  for (const { delay, color, text } of ROLL_PHASES) {
    const fakeRolls = Array.from({ length: numDice }, () => DICE_EMOJIS[Math.floor(Math.random() * 6)]).join('  ');
    const e = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎲 Lancé de Dés')
      .setDescription(`# ${fakeRolls}\n\n*${text}*`)
      .addFields(
        { name: '🎯 Pari', value: betLabel, inline: true },
        { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      );
    await msg.edit({ embeds: [e] });
    await sleep(delay);
  }
  await sleep(300);

  // Résultat
  const rolls = Array.from({ length: numDice }, () => rollDie());
  const rollStr = rolls.map(diceEmoji).join('  ');
  const sum = rolls.reduce((a, b) => a + b, 0);

  let won;
  if (numDice === 2 && betLabel.includes('Somme')) {
    won = winCondition(rolls[0], rolls[1]);
  } else {
    won = winCondition(rolls[0]);
  }

  const gain = won ? Math.floor(mise * (payout + 1)) : 0;
  if (won) db.addCoins(userId, guildId, gain);

  const color  = won ? '#27AE60' : '#E74C3C';
  const newBal = db.getUser(userId, guildId)?.balance || 0;

  let resultBox;
  if (won) {
    resultBox = [
      '```',
      '╔══════════════════════════╗',
      '║  🎉  VICTOIRE !  🎉        ║',
      `║  +${String(gain).padEnd(6,' ')} ${coin}        ║`,
      '║  ████████████████████      ║',
      '╚══════════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultBox = [
      '```',
      '╔══════════════════════════╗',
      '║  ❌  PERDU !  ❌           ║',
      `║  -${String(mise).padEnd(6,' ')} ${coin}        ║`,
      '║  ░░░░░░░░░░░░░░░░░░░░      ║',
      '╚══════════════════════════╝',
      '```',
    ].join('\n');
  }

  const desc = [
    `# ${rollStr}`,
    numDice === 2 ? `*(somme : ${sum})*` : '',
    '',
    resultBox,
  ].filter(Boolean).join('\n');

  // Bouton rejouer
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`des_replay_${userId}_${mise}_${betStr}_${numDice}`)
      .setLabel('🎲 Rejouer')
      .setStyle(ButtonStyle.Primary),
  );

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('🎲 Lancé de Dés — Résultat')
    .setDescription(desc)
    .addFields(
      { name: '🎯 Pari', value: betLabel, inline: true },
      { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      { name: '🏦 Solde', value: `${newBal} ${coin}`, inline: true },
    )
    .setTimestamp();

  await msg.edit({ embeds: [finalEmbed], components: [row] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('des')
    .setDescription('🎲 Lancez les dés et pariez sur le résultat !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o.setName('pari').setDescription('haut/bas/pair/impair/1-6/somme7').setRequired(true))
    .addIntegerOption(o => o.setName('des').setDescription('Nombre de dés (1 ou 2)').setMinValue(1).setMaxValue(2)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playDice(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getString('pari'),
      interaction.options.getInteger('des') || 1,
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

  async handleComponent(interaction, cid) {
    if (cid.startsWith('des_replay_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const mise = parseInt(parts[3]);
      const newBet = parts[4];
      const newNumD = parseInt(parts[5]) || 1;
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      await playDice(interaction, userId, interaction.guildId, mise, newBet, newNumD);
      return true;
    }
    return false;
  },
};

