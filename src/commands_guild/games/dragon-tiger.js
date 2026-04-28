// ============================================================
// dragon-tiger.js — Dragon Tiger v1
// Le jeu le plus rapide du casino asiatique
// 1 carte Dragon vs 1 carte Tiger — le plus haut gagne
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Cartes et couleurs ────────────────────────────────────────────
const SUITS = {
  '♥': '❤️',
  '♦': '♦️',
  '♣': '♣️',
  '♠': '♠️',
};

const RANKS = {
  1: 'A', 2: '2', 3: '3', 4: '4', 5: '5',
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'V', 12: 'D', 13: 'K'
};

function drawCard() {
  const rank = Math.floor(Math.random() * 13) + 1;
  const suit = Object.keys(SUITS)[Math.floor(Math.random() * 4)];
  return { rank, suit };
}

function isRed(card) {
  return card.suit === '♥' || card.suit === '♦';
}

function cardEmoji(suit) {
  return SUITS[suit];
}

function cardStr(card) {
  return `${cardEmoji(card.suit)} ${RANKS[card.rank].padStart(2, ' ')}`;
}

function cardBox(card, width = 14) {
  const emoji = cardEmoji(card.suit);
  const rank = RANKS[card.rank].padEnd(2);
  const lines = [
    '┌' + '─'.repeat(width) + '┐',
    `│ ${emoji}  ${rank.padEnd(width - 5)}│`,
    '│' + ' '.repeat(width) + '│',
    `│ ${rank.padStart(width - 5)} ${emoji}  │`,
    '└' + '─'.repeat(width) + '┘',
  ];
  return lines.join('\n');
}

// ─── Parsing des paris ──────────────────────────────────────────────
function parseBet(s_raw) {
  const s = s_raw.toLowerCase().trim();

  if (s === 'dragon' || s === 'd')      return { label: '🐉 Dragon (×2)', key: 'dragon', payout: 1 };
  if (s === 'tiger'  || s === 't')      return { label: '🐯 Tiger (×2)', key: 'tiger', payout: 1 };
  if (s === 'tie'    || s === 'equal')  return { label: '🤝 Égalité (×8)', key: 'tie', payout: 7 };
  if (s === 'dr'     || s === 'dragon_red')    return { label: '🐉❤️ Dragon Rouge (×0.75)', key: 'dragon_red', payout: -0.25 };
  if (s === 'db'     || s === 'dragon_black')  return { label: '🐉♠️ Dragon Noir (×0.75)', key: 'dragon_black', payout: -0.25 };
  if (s === 'tr'     || s === 'tiger_red')     return { label: '🐯❤️ Tiger Rouge (×0.75)', key: 'tiger_red', payout: -0.25 };
  if (s === 'tb'     || s === 'tiger_black')   return { label: '🐯♠️ Tiger Noir (×0.75)', key: 'tiger_black', payout: -0.25 };

  return null;
}

const BET_HELP = [
  '**══════════ DRAGON TIGER ══════════**',
  '🐉 `dragon` / `d`      → ×2  (50%)',
  '🐯 `tiger` / `t`       → ×2  (50%)',
  '🤝 `tie` / `equal`     → ×8  (5.9%)',
  '',
  '**────── PARIS COULEUR (×0.75) ──────**',
  '🐉❤️ `dragon_red` / `dr`    → Dragon Rouge',
  '🐉♠️ `dragon_black` / `db`  → Dragon Noir',
  '🐯❤️ `tiger_red` / `tr`     → Tiger Rouge',
  '🐯♠️ `tiger_black` / `tb`   → Tiger Noir',
  '',
  '**Multi-paris** : `dragon,tiger_red` (max 2)',
].join('\n');

function header() {
  return [
    '```',
    '╔════════════════════════════════╗',
    '║  🐉  DRAGON TIGER  🐯          ║',
    '║  L\'affrontement des cartes    ║',
    '╚════════════════════════════════╝',
    '```',
  ].join('\n');
}

// ─── Jeu principal ─────────────────────────────────────────────────
async function playDragonTiger(source, userId, guildId, mise, betString) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  const betStr = betString.toLowerCase().trim();
  const bets = betStr.split(/[,~]/).map(s => s.trim()).filter(Boolean)
    .map(p => parseBet(p)).filter(Boolean).slice(0, 2);

  if (!bets.length) {
    const err = `❌ Type de pari invalide.\n\n${BET_HELP}`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  const totalMise = mise * bets.length;

  if (!u || u.balance < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance?.toLocaleString('fr-FR') || 0} ${coin}** (mise totale : **${totalMise.toLocaleString('fr-FR')} ${coin}**).`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10** par pari.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);

  const betLabels = bets.map(b => b.label).join(' + ');
  const maxPot = bets.reduce((s, b) => {
    if (b.payout < 0) return s + mise * (1 + b.payout); // couleur = ×0.75
    return s + mise * (b.payout + 1);
  }, 0);

  const betDesc = bets.length === 1
    ? `**Pari :** ${bets[0].label}\n**Gain potentiel :** ${maxPot.toLocaleString('fr-FR')} ${coin}`
    : `**Paris (${bets.length}) :**\n${bets.map(b => {
        const gain = b.payout < 0 ? mise * (1 + b.payout) : mise * (b.payout + 1);
        return `▸ ${b.label} — pot. +${gain.toLocaleString('fr-FR')} ${coin}`;
      }).join('\n')}\n**Gain max :** ${maxPot.toLocaleString('fr-FR')} ${coin}`;

  // ── Embed départ ──────────────────────────────────────────────
  const startEmbed = new EmbedBuilder()
    .setColor('#8B4513')
    .setTitle('🐉 🐯 DRAGON TIGER')
    .setDescription([
      header(),
      '🎪 *L\'arène des cartes est prête...*',
      '',
      betDesc,
      `**Mise totale :** 💰 **${totalMise.toLocaleString('fr-FR')} ${coin}**`,
      '',
      '```',
      '🐉 DRAGON              🐯 TIGER',
      '┌──────────────┐    ┌──────────────┐',
      '│              │    │              │',
      '│   ??? ???    │    │   ??? ???    │',
      '│              │    │              │',
      '└──────────────┘    └──────────────┘',
      '```',
      '',
      '🔮 *Les cartes se révèlent...*',
    ].join('\n'));

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [startEmbed] });
  else msg = await source.reply({ embeds: [startEmbed] });

  await sleep(800);

  // ── Cartes révélées ──────────────────────────────────────────
  const dragonCard = drawCard();
  const tigerCard = drawCard();

  const dragonDisplay = cardBox(dragonCard);
  const tigerDisplay = cardBox(tigerCard);

  const revealEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('🐉 🐯 DRAGON TIGER — LES CARTES SE LÈVENT !')
    .setDescription([
      header(),
      '',
      '```',
      '🐉 DRAGON              🐯 TIGER',
      dragonDisplay.split('\n').map((l, i) => l + '    ' + tigerDisplay.split('\n')[i]).join('\n'),
      '```',
      '',
      `**Dragon :** ${RANKS[dragonCard.rank]} ${cardEmoji(dragonCard.suit)} (${dragonCard.rank})  |  **Tiger :** ${RANKS[tigerCard.rank]} ${cardEmoji(tigerCard.suit)} (${tigerCard.rank})`,
      `**Paris :** ${betLabels}  |  **Mise :** 💰 **${totalMise.toLocaleString('fr-FR')} ${coin}**`,
    ].join('\n'));

  await msg.edit({ embeds: [revealEmbed] });
  await sleep(600);

  // ── Déterminer le résultat ────────────────────────────────────
  let result; // 'dragon' | 'tiger' | 'tie'
  let resultTitle;
  let resultColor;

  if (dragonCard.rank > tigerCard.rank) {
    result = 'dragon';
    resultTitle = '🐉 DRAGON TRIOMPHE ! 🐉';
    resultColor = '#FF6B6B';
  } else if (tigerCard.rank > dragonCard.rank) {
    result = 'tiger';
    resultTitle = '🐯 TIGER GAGNE ! 🐯';
    resultColor = '#4ECDC4';
  } else {
    result = 'tie';
    resultTitle = '🤝 ÉGALITÉ ! 🤝';
    resultColor = '#F1C40F';
  }

  // ── Évaluer les paris ────────────────────────────────────────
  const betResults = bets.map(bet => {
    let won = false;
    let gain = 0;

    if (bet.key === 'dragon' && result === 'dragon') {
      won = true;
      gain = mise * 2;
    } else if (bet.key === 'tiger' && result === 'tiger') {
      won = true;
      gain = mise * 2;
    } else if (bet.key === 'tie' && result === 'tie') {
      won = true;
      gain = mise * 8;
    } else if (bet.key === 'dragon_red' && result === 'dragon' && isRed(dragonCard)) {
      won = true;
      gain = Math.round(mise * 0.75);
    } else if (bet.key === 'dragon_black' && result === 'dragon' && !isRed(dragonCard)) {
      won = true;
      gain = Math.round(mise * 0.75);
    } else if (bet.key === 'tiger_red' && result === 'tiger' && isRed(tigerCard)) {
      won = true;
      gain = Math.round(mise * 0.75);
    } else if (bet.key === 'tiger_black' && result === 'tiger' && !isRed(tigerCard)) {
      won = true;
      gain = Math.round(mise * 0.75);
    }

    return { bet, won, gain };
  });

  let totalGain = 0;
  betResults.forEach(({ won, gain }) => {
    if (won) { db.addCoins(userId, guildId, gain); totalGain += gain; }
  });

  const netDiff = totalGain - totalMise;
  const anyWon = betResults.some(r => r.won);

  await sleep(500);

  // ── Résultat final ────────────────────────────────────────────
  const betDetail = betResults.map(r =>
    `${r.won ? '✅' : '❌'} ${r.bet.label} → ${r.won ? `**+${r.gain.toLocaleString('fr-FR')} ${coin}**` : `−${mise.toLocaleString('fr-FR')} ${coin}`}`
  ).join('\n');

  const newBal = db.getUser(userId, guildId)?.balance || 0;

  let resultBox;
  if (anyWon && betResults.every(r => r.won)) {
    const sign = netDiff >= 0 ? '+' : '';
    resultBox = [
      '```',
      '╔════════════════════════════════╗',
      `║  🏆  VICTOIRE TOTALE ! 🏆       ║`,
      `║  Net : ${sign}${String((netDiff.toLocaleString('fr-FR')+' '+coin)).padEnd(23)}║`,
      '╚════════════════════════════════╝',
      '```',
    ].join('\n');
  } else if (anyWon) {
    const sign = netDiff >= 0 ? '+' : '';
    resultBox = [
      '```',
      '╔════════════════════════════════╗',
      `║  ✅  GAIN PARTIEL ✅             ║`,
      `║  Net : ${sign}${String((netDiff.toLocaleString('fr-FR')+' '+coin)).padEnd(23)}║`,
      '╚════════════════════════════════╝',
      '```',
    ].join('\n');
  } else {
    resultBox = [
      '```',
      '╔════════════════════════════════╗',
      '║  ❌  DÉFAITE ❌                 ║',
      `║  -${String((totalMise.toLocaleString('fr-FR')+' '+coin)).padEnd(26)}║`,
      '╚════════════════════════════════╝',
      '```',
    ].join('\n');
  }

  const finalDesc = [
    header(),
    `**${resultTitle}**`,
    '',
    '```',
    '🐉 DRAGON              🐯 TIGER',
    dragonDisplay.split('\n').map((l, i) => l + '    ' + tigerDisplay.split('\n')[i]).join('\n'),
    '```',
    '',
    resultBox,
    '',
    betDetail,
    '',
    `**Mise :** 💰 **${totalMise.toLocaleString('fr-FR')} ${coin}**  |  **Solde :** **${newBal.toLocaleString('fr-FR')} ${coin}**`,
  ].join('\n');

  const row = makeGameRow('dt', userId, mise, betString);

  const quickRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`dt_quickbet_${userId}_${mise}_dragon`).setLabel('🐉 Dragon ×2').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`dt_quickbet_${userId}_${mise}_tiger`).setLabel('🐯 Tiger ×2').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`dt_quickbet_${userId}_${mise}_tie`).setLabel('🤝 Tie ×8').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`dt_table_${userId}`).setLabel('📋 Règles').setStyle(ButtonStyle.Secondary),
  );

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor(resultColor)
      .setTitle(resultTitle)
      .setDescription(finalDesc)
      .setFooter({ text: 'Jouez responsable · Mise min : 10 · Max 2 paris · 🐉 Dragon Tiger 🐯' })
      .setTimestamp()],
    components: [row, quickRow],
  });
}

// ─── Exports ───────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('dragon-tiger')
    .setDescription('🐉🐯 Dragon Tiger — Choisissez votre champion !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise par pari (min 10)').setRequired(true).setMinValue(10))
    .addStringOption(o => o.setName('choix').setDescription('Ex: dragon | tiger | tie | dragon_red (max 2 paris)').setRequired(true)
      .addChoices(
        { name: '🐉 Dragon (×2)', value: 'dragon' },
        { name: '🐯 Tiger (×2)', value: 'tiger' },
        { name: '🤝 Tie/Égalité (×8)', value: 'tie' },
        { name: '🐉❤️ Dragon Rouge (×0.75)', value: 'dragon_red' },
        { name: '🐉♠️ Dragon Noir (×0.75)', value: 'dragon_black' },
        { name: '🐯❤️ Tiger Rouge (×0.75)', value: 'tiger_red' },
        { name: '🐯♠️ Tiger Noir (×0.75)', value: 'tiger_black' },
      )),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playDragonTiger(interaction, interaction.user.id, interaction.guildId,
      interaction.options.getInteger('mise'), interaction.options.getString('choix'));
  },

  name: 'dragon-tiger',
  aliases: ['dt', 'dragon', 'tiger'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&dragon-tiger <mise> <choix>`\nEx: `&dragon-tiger 100 dragon`');
    const u   = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') mise = bal;
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 10) return message.reply('❌ Mise minimale : 10. Usage : `&dragon-tiger <mise> <choix>`');
    const betType = args.slice(1).join(' ');
    if (!betType) return message.reply(`❌ Précise ton pari.\n\n${BET_HELP}`);
    await playDragonTiger(message, message.author.id, message.guildId, mise, betType);
  },

  betHelp: BET_HELP,

  async handleComponent(interaction, cid) {
    if (cid.startsWith('dt_quickbet_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betType = parts[4];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      await playDragonTiger(interaction, userId, interaction.guildId, mise, betType);
      return true;
    }

    if (cid.startsWith('dt_table_')) {
      const userId = cid.split('_')[2];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      const tableEmbed = new EmbedBuilder()
        .setColor('#8B4513')
        .setTitle('📋 Règles — Dragon Tiger')
        .setDescription(header() + '\n' + BET_HELP)
        .setFooter({ text: 'La carte la plus haute gagne — Mise min : 10' });
      await interaction.editReply({ embeds: [tableEmbed], components: [] });
      return true;
    }

    if (cid.startsWith('dt_replay_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const mise    = parseInt(parts[3]);
      const betStr  = parts.slice(4).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      await playDragonTiger(interaction, userId, interaction.guildId, mise, betStr);
      return true;
    }

    if (cid.startsWith('dt_changemise_')) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.showModal(changeMiseModal('dt', userId, betStr));
      return true;
    }

    if (cid.startsWith('dt_modal_') && interaction.isModalSubmit()) {
      const parts   = cid.split('_');
      const userId  = parts[2];
      const betStr  = parts.slice(3).join('_');
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u       = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 10) {
        return interaction.reply({ content: '❌ Mise invalide (min 10/pari).', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
      await playDragonTiger(interaction, userId, interaction.guildId, newMise, betStr);
      return true;
    }

    return false;
  },
};
