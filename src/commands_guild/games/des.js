// ============================================================
// des.js — Dés améliorés avec animations et bouton rejouer
// Emplacement : src/commands_guild/games/des.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

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
  { delay:80,  color:'#E74C3C', text:'🎲 *Le gobelet est agité violemment !*' },
  { delay:100, color:'#C0392B', text:'🎲 *Les dés s\'entrechoquent !*' },
  { delay:130, color:'#E67E22', text:'🎲 *Ils roulent à toute vitesse !*' },
  { delay:170, color:'#D35400', text:'🎲 *Ralentissement...*' },
  { delay:230, color:'#F39C12', text:'🎲 *Presque...*' },
  { delay:310, color:'#F1C40F', text:'🎲 *Les dés s\'immobilisent...*' },
  { delay:420, color:'#2ECC71', text:'🎲 *Résultat dans...*' },
  { delay:600, color:'#27AE60', text:'🎲 *🔔 CLAC !*' },
];

async function playDice(source, userId, guildId, mise, betStr, numDice = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

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
      '╔════════════════════════════╗',
      '║   🎉  VICTOIRE !  🎉        ║',
      '║  ✨  DÉS CHANCEUX  ✨       ║',
      `║   +${String(gain).padEnd(6,' ')} ${coin}             ║`,
      '║  ████████████████████████  ║',
      '╚════════════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultBox = [
      '```',
      '╔════════════════════════════╗',
      '║   ❌  PERDU !  ❌           ║',
      '║  😢  Pas de chance...      ║',
      `║   -${String(mise).padEnd(6,' ')} ${coin}             ║`,
      '║  ░░░░░░░░░░░░░░░░░░░░░░░░  ║',
      '╚════════════════════════════╝',
      '```',
    ].join('\n');
  }

  const desc = [
    `# ${rollStr}`,
    numDice === 2 ? `*(somme : ${sum})*` : '',
    '',
    resultBox,
  ].filter(Boolean).join('\n');

  // Boutons rejouer + changer la mise
  const row = makeGameRow('des', userId, mise, `${betStr}_${numDice}`);

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
    try {
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
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(_em).catch(() => {});
      else await interaction.editReply(_em).catch(() => {});
    } catch {}
  }},

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
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      await playDice(interaction, userId, interaction.guildId, mise, newBet, newNumD);
      return true;
    }
    if (cid.startsWith('des_changemise_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const betStr = parts[3];
      const numDice = parseInt(parts[4]) || 1;
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      await interaction.showModal(changeMiseModal('des', userId, `${betStr}_${numDice}`));
      return true;
    }
    if (cid.startsWith('des_modal_') && interaction.isModalSubmit()) {
      const parts = cid.split('_');
      const userId = parts[2];
      const betStr = parts[3];
      const numDice = parseInt(parts[4]) || 1;
      if (interaction.user.id !== userId) {
        await interaction.editReply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 5) {
        return interaction.editReply({ content: '❌ Mise invalide (min 5 coins).', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
      await playDice(interaction, userId, interaction.guildId, newMise, betStr, numDice);
      return true;
    }
    return false;
  },
};

