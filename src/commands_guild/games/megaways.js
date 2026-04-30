// megaways.js — 🏺 Pharaoh Megaways : slot 6 reels avec lignes variables
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// Symboles avec leurs probabilités et payouts (multiplicateur sur la mise)
const SYMBOLS = [
  { e: '🏺', name: 'Vase',     w: 25, pay3: 1.5, pay4: 4,   pay5: 10,  pay6: 30 },
  { e: '🪲', name: 'Scarabée', w: 22, pay3: 2,   pay4: 5,   pay5: 15,  pay6: 50 },
  { e: '🦅', name: 'Faucon',   w: 18, pay3: 2.5, pay4: 7,   pay5: 25,  pay6: 80 },
  { e: '👁️', name: 'Œil',     w: 14, pay3: 4,   pay4: 12,  pay5: 50,  pay6: 200 },
  { e: '👑', name: 'Couronne', w: 9,  pay3: 8,   pay4: 25,  pay5: 100, pay6: 500 },
  { e: '🐍', name: 'Cobra',    w: 6,  pay3: 15,  pay4: 50,  pay5: 250, pay6: 1500 },
  { e: '☀️', name: 'Soleil',   w: 4,  pay3: 25,  pay4: 100, pay5: 500, pay6: 5000 }, // top
  { e: '⭐', name: 'Wild',     w: 1.5, pay3: 50, pay4: 200, pay5: 1000, pay6: 10000 }, // jackpot
  { e: '🎁', name: 'Scatter',  w: 0.5 }, // déclenche free spins
];
const TOTAL_W = SYMBOLS.reduce((s, x) => s + x.w, 0);

function spinSymbol() {
  const r = Math.random() * TOTAL_W;
  let acc = 0;
  for (const s of SYMBOLS) { acc += s.w; if (r < acc) return s; }
  return SYMBOLS[0];
}

// Megaways : chaque colonne a 2-7 symboles (lignes variables jusqu'à 117k)
function spinReels() {
  const reels = [];
  for (let c = 0; c < 6; c++) {
    const height = 2 + Math.floor(Math.random() * 6); // 2-7
    const col = [];
    for (let i = 0; i < height; i++) col.push(spinSymbol());
    reels.push(col);
  }
  return reels;
}

function calcWaysWin(reels, mise) {
  // Compte les "ways" : pour chaque symbole top-payant, multiplie par le nombre d'occurrences sur chaque colonne
  let bestWin = 0;
  let bestSymbol = null;
  let bestCount = 0;

  // Récupère les symboles uniques (sauf scatter)
  const allSyms = SYMBOLS.filter(s => s.name !== 'Scatter');

  for (const sym of allSyms) {
    const counts = reels.map(col => col.filter(c => c.name === sym.name || c.name === 'Wild').length);
    // Trouver la séquence consécutive depuis la gauche
    let consecCols = 0;
    let ways = 1;
    for (let c = 0; c < 6; c++) {
      if (counts[c] === 0) break;
      consecCols++;
      ways *= counts[c];
    }
    if (consecCols < 3) continue;

    const payKey = `pay${consecCols}`;
    const mult = sym[payKey] || 0;
    const win = Math.floor(mise * mult * ways / 100); // /100 pour pas que ce soit absurde
    if (win > bestWin) {
      bestWin = win;
      bestSymbol = sym;
      bestCount = consecCols;
    }
  }

  return { win: bestWin, symbol: bestSymbol, count: bestCount };
}

function renderReels(reels) {
  // Aligne sur la hauteur max
  const maxH = Math.max(...reels.map(c => c.length));
  let out = '```\n';
  for (let r = 0; r < maxH; r++) {
    let line = '';
    for (let c = 0; c < 6; c++) {
      line += (reels[c][r]?.e || '⬛') + ' ';
    }
    out += line + '\n';
  }
  out += '```';
  return out;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('megaways')
    .setDescription('🏺 Pharaoh Megaways — slot 6 reels avec lignes variables et bonus !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 200)').setMinValue(200).setMaxValue(500000).setRequired(true)),
  cooldown: 4,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      const mise = interaction.options.getInteger('mise');
      const cfg  = db.getConfig(interaction.guildId);
      const emoji= cfg.currency_emoji || '€';
      const name = cfg.currency_name  || 'Euros';
      const u    = db.getUser(interaction.user.id, interaction.guildId);

      if (u.balance < mise) {
        return interaction.editReply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji}.` });
      }

      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      // Anim de spin (3 frames)
      const placeholder = '```\n' + '🎰 🎰 🎰 🎰 🎰 🎰\n'.repeat(3) + '```';
      await interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#9B59B6').setTitle('🏺 ・ Pharaoh Megaways ・')
        .setDescription(placeholder + '\nLes rouleaux tournent...')
      ]}).catch(() => {});
      await new Promise(r => setTimeout(r, 900));

      const reels = spinReels();
      let { win, symbol, count } = calcWaysWin(reels, mise);

      // Compter les scatters (free spins)
      const scatterCount = reels.flat().filter(s => s.name === 'Scatter').length;
      let bonusMsg = '';
      if (scatterCount >= 3) {
        const bonus = Math.floor(mise * (scatterCount * 1.5));
        win += bonus;
        bonusMsg = `\n🎁 **${scatterCount} scatters** → bonus de ${bonus.toLocaleString('fr')} ${emoji} !`;
      }

      // Apply RTP + cap
      win = applyRtp('megaways', mise, win);
      win = capWin('megaways', mise, win);

      if (win > 0) db.addCoins(interaction.user.id, interaction.guildId, win);

      const profit = win - mise;
      const isJackpot = symbol?.name === 'Wild' && count === 6;
      const isBigWin  = win >= mise * 10;
      const titleEmoji = isJackpot ? '💎' : (isBigWin ? '🔥' : (win > 0 ? '✅' : '💸'));
      const title = isJackpot ? 'JACKPOT MÉGAWAYS !' : (isBigWin ? 'GROS GAIN !' : (win > 0 ? 'Gagné !' : 'Perdu...'));

      const e = new EmbedBuilder()
        .setColor(isJackpot ? '#FFD700' : isBigWin ? '#E67E22' : win > 0 ? '#2ECC71' : '#95A5A6')
        .setTitle(`${titleEmoji} ・ Pharaoh Megaways ・ ${title}`)
        .setDescription(renderReels(reels) + bonusMsg)
        .addFields(
          { name: '💰 Mise',  value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
          { name: '🎯 Combo', value: symbol ? `${count}× ${symbol.e} ${symbol.name}` : 'Aucune ligne', inline: true },
          { name: '💵 Gain',  value: `${win.toLocaleString('fr')} ${emoji} (${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr')})`, inline: true },
        )
        .setFooter({ text: `RTP 94% • Megaways = jusqu'à 117k lignes • Mise ${mise} ${name}` });

      await interaction.editReply({ embeds: [e] });

    } catch (err) {
      console.error('[CMD megaways]', err);
      await interaction.editReply({ content: `❌ Erreur : ${err?.message || err}` }).catch(() => {});
    }
  }
};
