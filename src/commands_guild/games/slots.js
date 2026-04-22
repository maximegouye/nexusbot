// ============================================================
// slots.js — Machine à sous 5 rouleaux ultra-complète
// Emplacement : src/commands_guild/games/slots.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── Symboles & poids ─────────────────────────────────────
const SYMBOLS = [
  { id: 'cherry',  emoji: '🍒', name: 'Cerise',    weight: 30, value: 2   },
  { id: 'lemon',   emoji: '🍋', name: 'Citron',    weight: 25, value: 3   },
  { id: 'orange',  emoji: '🍊', name: 'Orange',    weight: 20, value: 4   },
  { id: 'grape',   emoji: '🍇', name: 'Raisin',    weight: 15, value: 5   },
  { id: 'melon',   emoji: '🍉', name: 'Melon',     weight: 10, value: 8   },
  { id: 'bell',    emoji: '🔔', name: 'Cloche',    weight: 8,  value: 10  },
  { id: 'star',    emoji: '⭐', name: 'Étoile',    weight: 5,  value: 15  },
  { id: 'seven',   emoji: '7️⃣', name: 'Sept',     weight: 3,  value: 25  },
  { id: 'diamond', emoji: '💎', name: 'Diamant',   weight: 2,  value: 50  },
  { id: 'wild',    emoji: '🃏', name: 'WILD',      weight: 2,  value: 0   }, // remplace tout
  { id: 'bonus',   emoji: '🎁', name: 'BONUS',     weight: 1,  value: 0   }, // déclenche bonus
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function spinReel() {
  let rng = Math.random() * TOTAL_WEIGHT;
  for (const sym of SYMBOLS) {
    rng -= sym.weight;
    if (rng <= 0) return sym;
  }
  return SYMBOLS[0];
}

// ─── Jackpot progressif ───────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS slots_jackpot (
    guild_id TEXT PRIMARY KEY,
    amount   INTEGER DEFAULT 5000
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS slots_stats (
    user_id  TEXT,
    guild_id TEXT,
    spins    INTEGER DEFAULT 0,
    wins     INTEGER DEFAULT 0,
    jackpots INTEGER DEFAULT 0,
    biggest  INTEGER DEFAULT 0,
    PRIMARY KEY(user_id, guild_id)
  )`).run();
} catch {}

function getJackpot(guildId) {
  let row = db.db.prepare('SELECT amount FROM slots_jackpot WHERE guild_id=?').get(guildId);
  if (!row) {
    db.db.prepare('INSERT OR IGNORE INTO slots_jackpot (guild_id,amount) VALUES (?,5000)').run(guildId);
    row = { amount: 5000 };
  }
  return row.amount;
}
function addToJackpot(guildId, amount) {
  db.db.prepare('INSERT OR IGNORE INTO slots_jackpot (guild_id) VALUES (?)').run(guildId);
  db.db.prepare('UPDATE slots_jackpot SET amount=amount+? WHERE guild_id=?').run(amount, guildId);
}
function resetJackpot(guildId) {
  db.db.prepare('UPDATE slots_jackpot SET amount=5000 WHERE guild_id=?').run(guildId);
}
function addStats(userId, guildId, won, amount, isJackpot) {
  db.db.prepare('INSERT OR IGNORE INTO slots_stats (user_id,guild_id) VALUES (?,?)').run(userId, guildId);
  db.db.prepare(`UPDATE slots_stats SET
    spins=spins+1,
    wins=wins+?,
    jackpots=jackpots+?,
    biggest=MAX(biggest,?)
    WHERE user_id=? AND guild_id=?
  `).run(won ? 1 : 0, isJackpot ? 1 : 0, amount, userId, guildId);
}

// ─── 5 rouleaux × 3 rangées ───────────────────────────────
function spinGrid() {
  // [col0..col4][row0..row2]
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => spinReel())
  );
}

function gridRow(grid, row) {
  return grid.map(col => col[row].emoji).join(' ');
}

function renderGrid(grid, spinning = false) {
  const spin = '🌀';
  if (spinning) return `${spin} ${spin} ${spin} ${spin} ${spin}\n${spin} ${spin} ${spin} ${spin} ${spin}\n${spin} ${spin} ${spin} ${spin} ${spin}`;
  return `${gridRow(grid, 0)}\n**${gridRow(grid, 1)}**\n${gridRow(grid, 2)}`;
}

// ─── Évaluation des lignes ────────────────────────────────
// Lignes de payement : horizontal (×3), diagonales
const PAYLINES = [
  [0, 1, 2, 3, 4], // rangée du milieu (principale)
  // rangée haut/bas
  [0, 0, 0, 0, 0].map((_, i) => i), // sera remplacée
];

function evalLine(grid, row) {
  const cells = grid.map(col => col[row]);
  const wilds  = cells.filter(c => c.id === 'wild').length;
  const bonuses = cells.filter(c => c.id === 'bonus').length;

  // Compter le symbole non-wild/bonus le plus fréquent
  const counts = {};
  for (const c of cells) {
    if (c.id === 'wild' || c.id === 'bonus') continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
  }

  // 3+ bonus → free spins
  if (bonuses >= 3) return { type: 'bonus', bonuses, mult: 0 };

  // Si que wilds → jackpot / mega win
  if (wilds === 5) return { type: 'jackpot', mult: 0 };

  // Meilleur match
  let bestSym = null, bestCount = 0;
  for (const [id, count] of Object.entries(counts)) {
    if (count + wilds >= 3 && count > bestCount) {
      bestSym   = SYMBOLS.find(s => s.id === id);
      bestCount = count;
    }
  }

  if (!bestSym) return { type: 'miss', mult: 0 };

  const total = bestCount + wilds;
  const mult  = bestSym.value * (total === 3 ? 1 : total === 4 ? 3 : 8);
  return { type: 'win', symbol: bestSym, count: total, wilds, mult };
}

function evalGrid(grid) {
  const results = [];
  for (let row = 0; row < 3; row++) {
    results.push({ row, ...evalLine(grid, row) });
  }
  // Diagonale ↘
  const diagDown = [grid[0][0], grid[1][1], grid[2][2], grid[3][1], grid[4][0]];
  // Diagonale ↗
  const diagUp   = [grid[0][2], grid[1][1], grid[2][0], grid[3][1], grid[4][2]];

  // Chercher jackpot global
  const hasJackpot = results.some(r => r.type === 'jackpot');
  const hasBonus   = results.some(r => r.type === 'bonus');
  const wins       = results.filter(r => r.type === 'win');

  return { results, hasJackpot, hasBonus, wins };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Animation ────────────────────────────────────────────
async function animateSpin(msg, grid, coin, mise, jackpot) {
  // Phase 1 : tout tourne
  for (let f = 0; f < 3; f++) {
    const e = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🎰 ・ Machine à Sous ・')
      .setDescription(`\`\`\`\n🌀 🌀 🌀 🌀 🌀\n🌀 🌀 🌀 🌀 🌀\n🌀 🌀 🌀 🌀 🌀\n\`\`\`\n*Les rouleaux tournent...*`)
      .addFields(
        { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
        { name: '🏆 Jackpot', value: `${jackpot} ${coin}`, inline: true },
      );
    await msg.edit({ embeds: [e] });
    await sleep(400);
  }

  // Phase 2 : rouleaux s'arrêtent un par un
  const partial = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => ({ emoji: '🌀' }) ));
  for (let col = 0; col < 5; col++) {
    partial[col] = grid[col];
    await sleep(350);
    const rows = ['', '', ''];
    for (let row = 0; row < 3; row++) {
      rows[row] = partial.map(c => c[row]?.emoji || '🌀').join(' ');
    }
    const e = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('🎰 ・ Machine à Sous ・')
      .setDescription(`\`\`\`\n${rows[0]}\n${rows[1]}\n${rows[2]}\n\`\`\``)
      .addFields({ name: '💰 Mise', value: `${mise} ${coin}`, inline: true });
    await msg.edit({ embeds: [e] });
  }
}

// ─── Jeu principal ────────────────────────────────────────
async function playSlots(source, userId, guildId, mise, lines = 1) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';
  const jackpot = getJackpot(guildId);

  const totalMise = mise * lines;
  if (!u || u.solde < totalMise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}** (mise totale : ${totalMise}).`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 5) {
    const err = '❌ Mise minimale : **5 coins** par ligne.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -totalMise);
  addToJackpot(guildId, Math.floor(totalMise * 0.02)); // 2% va au jackpot

  const startEmbed = new EmbedBuilder()
    .setColor('#F39C12')
    .setTitle('🎰 ・ Machine à Sous ・')
    .setDescription('`🌀 🌀 🌀 🌀 🌀\n🌀 🌀 🌀 🌀 🌀\n🌀 🌀 🌀 🌀 🌀`\n*Lancement des rouleaux...*')
    .addFields(
      { name: '💰 Mise', value: `${totalMise} ${coin} (${lines} ligne${lines > 1 ? 's' : ''})`, inline: true },
      { name: '🏆 Jackpot', value: `**${jackpot} ${coin}**`, inline: true },
    );

  let msg;
  if (isInteraction) {
    await source.deferReply();
    msg = await source.editReply({ embeds: [startEmbed] });
  } else {
    msg = await source.reply({ embeds: [startEmbed] });
  }

  const grid = spinGrid();
  await animateSpin(msg, grid, coin, totalMise, jackpot);

  // Évaluation
  const { results, hasJackpot, hasBonus, wins } = evalGrid(grid);

  let totalGain = 0;
  let color = '#E74C3C';
  let title = '🎰 ・ Machine à Sous ・';
  let desc  = '';
  let isJackpotWon = false;

  const rows = [0, 1, 2].map(row => {
    const r = results[row];
    const line = grid.map(col => col[row].emoji).join(' ');
    if (r.type === 'win') return `**${line}** ✅ ×${r.mult}`;
    if (r.type === 'jackpot') return `**${line}** 🏆 JACKPOT!`;
    if (r.type === 'bonus') return `**${line}** 🎁 BONUS!`;
    return line;
  }).join('\n');

  if (hasJackpot) {
    isJackpotWon = true;
    const jp = getJackpot(guildId);
    totalGain = jp;
    resetJackpot(guildId);
    color  = '#FFD700';
    title  = '🏆 ・ JACKPOT PROGRESSIF ・ 🏆';
    desc   = `🎊 **FÉLICITATIONS !** Tu as décroché le **JACKPOT** !\n\n**+${jp} ${coin}** remportés !`;
    db.addCoins(userId, guildId, jp);
  } else if (hasBonus) {
    const freeSpins = 5;
    color = '#9B59B6';
    title = '🎁 ・ BONUS FREE SPINS ・ 🎁';
    desc  = `🎁 **BONUS DÉCLENCHÉ !** +${freeSpins} tours gratuits offerts !\n*(Non implémentés en temps réel, valeur en coins offerte)*`;
    const bonusCoins = totalMise * 3;
    totalGain = bonusCoins;
    db.addCoins(userId, guildId, bonusCoins);
  } else if (wins.length > 0) {
    for (const w of wins) {
      totalGain += Math.floor(mise * w.mult);
    }
    db.addCoins(userId, guildId, totalGain);
    color = totalGain > totalMise * 3 ? '#F1C40F' : '#2ECC71';
    title = totalGain > totalMise * 5 ? '🌟 ・ GROS GAIN ! ・ 🌟' : '🎰 ・ Machine à Sous ・';
    desc  = wins.map(w =>
      `**Ligne ${w.row + 1}** : ${w.count}× ${w.symbol.emoji} ${w.symbol.name} → +${Math.floor(mise * w.mult)} ${coin}`
    ).join('\n');
  } else {
    desc = '😔 Pas de combinaison gagnante. Retente ta chance !';
  }

  addStats(userId, guildId, totalGain > 0, totalGain, isJackpotWon);

  const finalEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`\`\`\`\n${rows}\n\`\`\`\n\n${desc}`)
    .addFields(
      { name: '💰 Mise', value: `${totalMise} ${coin}`, inline: true },
      { name: totalGain > 0 ? '✅ Gain' : '❌ Perte', value: `${totalGain > 0 ? '+' : '-'}${totalGain > 0 ? totalGain : totalMise} ${coin}`, inline: true },
      { name: '🏆 Nouveau Jackpot', value: `${getJackpot(guildId)} ${coin}`, inline: true },
    )
    .setFooter({ text: `Solde actuel : ${db.getUser(userId, guildId)?.solde || 0} ${coin}` })
    .setTimestamp();

  // Bouton rejouer
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`slots_replay_${userId}_${mise}_${lines}`)
      .setLabel('🎰 Rejouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('slots_info')
      .setLabel('📊 Mes Stats').setStyle(ButtonStyle.Secondary),
  );

  await msg.edit({ embeds: [finalEmbed], components: [row] });

  // Collector pour rejouer
  const filter = i => i.user.id === userId;
  const collector = msg.createMessageComponentCollector({ filter, time: 30_000 });

  collector.on('collect', async i => {
    if (i.customId.startsWith('slots_replay_')) {
      await i.deferUpdate();
      collector.stop();
      const parts = i.customId.split('_');
      const newMise   = parseInt(parts[3]);
      const newLines  = parseInt(parts[4]);
      await playSlots(source.channel ? { ...source, reply: (d) => source.channel.send(d) } : source, userId, guildId, newMise, newLines);
    } else if (i.customId === 'slots_info') {
      await i.deferUpdate();
      const stats = db.db.prepare('SELECT * FROM slots_stats WHERE user_id=? AND guild_id=?').get(userId, guildId);
      if (!stats) return i.followUp({ content: 'Aucune statistique trouvée.', ephemeral: true });
      const winRate = stats.spins ? ((stats.wins / stats.spins) * 100).toFixed(1) : 0;
      await i.followUp({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('📊 ・ Tes Stats Slots ・')
          .addFields(
            { name: '🎰 Tours joués', value: `${stats.spins}`, inline: true },
            { name: '✅ Victoires', value: `${stats.wins} (${winRate}%)`, inline: true },
            { name: '🏆 Jackpots', value: `${stats.jackpots}`, inline: true },
            { name: '💰 Plus gros gain', value: `${stats.biggest} ${coin}`, inline: true },
          )],
        ephemeral: true,
      });
    }
  });

  collector.on('end', () => {
    msg.edit({ components: [] }).catch(() => {});
  });
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous — 5 rouleaux, jackpot progressif !')
    .addStringOption(o => o
      .setName('mise').setDescription('Mise par ligne (min 5)').setRequired(true).setMinValue(5))
    .addStringOption(o => o
      .setName('lignes').setDescription('Nombre de lignes (1-3, défaut 1)').setMinValue(1).setMaxValue(3)),

  async execute(interaction) {
    const mise   = parseInt(interaction.options.getString('mise'));
    const lignes = parseInt(interaction.options.getString('lignes')) || 1;
    await playSlots(interaction, interaction.user.id, interaction.guildId, mise, lignes);
  },

  name: 'slots',
  aliases: ['slot', 'machine', 'jackpot'],
  async run(message, args) {
    const mise   = parseInt(args[0]);
    const lignes = parseInt(args[1]) || 1;
    if (!mise || mise < 5) return message.reply('❌ Usage : `&slots <mise> [lignes]`\nEx: `&slots 100 3`');
    await playSlots(message, message.author.id, message.guildId, mise, Math.min(3, Math.max(1, lignes)));
  },
};
