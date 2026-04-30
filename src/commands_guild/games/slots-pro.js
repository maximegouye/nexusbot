// ============================================================
// slots-pro.js — 🎰 SLOTS PRO V2 : 6 machines avec BOUTONS premium
// ============================================================
'use strict';

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// ─── 6 MACHINES THÉMATIQUES ────────────────────────────────────────────────
const MACHINES = {
  vegas: {
    label: 'Classic Vegas',
    icon: '🎰',
    color: '#E91E63',
    style: ButtonStyle.Danger,
    symbols: [
      { e: '🍒', name: 'Cerise',  w: 30, p3: 1.5,  p4: 4,   p5: 10  },
      { e: '🍋', name: 'Citron',  w: 25, p3: 2,    p4: 5,   p5: 12  },
      { e: '🍊', name: 'Orange',  w: 18, p3: 3,    p4: 7,   p5: 18  },
      { e: '🍇', name: 'Raisin',  w: 12, p3: 5,    p4: 12,  p5: 35  },
      { e: '🔔', name: 'Cloche',  w: 8,  p3: 10,   p4: 30,  p5: 100 },
      { e: '💎', name: 'Diamant', w: 4,  p3: 25,   p4: 80,  p5: 250 },
      { e: '7️⃣', name: 'Lucky 7', w: 2,  p3: 50,   p4: 200, p5: 1000 },
    ],
    wild: { e: '⭐', name: 'Wild', w: 1.5 },
    scatter: { e: '🎁', name: 'Scatter', w: 0.7 },
  },
  pharaoh: {
    label: 'Pharaoh\'s Gold',
    icon: '🏺',
    color: '#FFD700',
    style: ButtonStyle.Primary,
    symbols: [
      { e: '🪲', name: 'Scarabée', w: 28, p3: 1.5, p4: 4,   p5: 10  },
      { e: '🦅', name: 'Faucon',   w: 22, p3: 2,   p4: 5,   p5: 12  },
      { e: '👁️', name: 'Œil',      w: 16, p3: 3,   p4: 7,   p5: 20  },
      { e: '🏺', name: 'Vase',     w: 12, p3: 5,   p4: 12,  p5: 40  },
      { e: '👑', name: 'Couronne', w: 7,  p3: 12,  p4: 35,  p5: 120 },
      { e: '🐍', name: 'Cobra',    w: 4,  p3: 25,  p4: 80,  p5: 300 },
      { e: '☀️', name: 'Sphinx',   w: 1.8,p3: 60,  p4: 250, p5: 1500 },
    ],
    wild: { e: '🪬', name: 'Wild', w: 1.5 },
    scatter: { e: '📜', name: 'Papyrus', w: 0.7 },
  },
  pirate: {
    label: 'Pirate Treasure',
    icon: '🏴‍☠️',
    color: '#5D4037',
    style: ButtonStyle.Secondary,
    symbols: [
      { e: '🦜', name: 'Perroquet', w: 28, p3: 1.5, p4: 4,   p5: 10  },
      { e: '🗡️', name: 'Épée',     w: 22, p3: 2,   p4: 5,   p5: 12  },
      { e: '🍺', name: 'Rhum',     w: 16, p3: 3,   p4: 7,   p5: 20  },
      { e: '⚓', name: 'Ancre',     w: 12, p3: 5,   p4: 12,  p5: 40  },
      { e: '🚢', name: 'Navire',    w: 7,  p3: 12,  p4: 35,  p5: 120 },
      { e: '☠️', name: 'Crâne',     w: 4,  p3: 25,  p4: 80,  p5: 300 },
      { e: '💰', name: 'Coffre',    w: 1.8,p3: 60,  p4: 250, p5: 1500 },
    ],
    wild: { e: '🏴‍☠️', name: 'Wild', w: 1.5 },
    scatter: { e: '🗺️', name: 'Carte', w: 0.7 },
  },
  diamond: {
    label: 'Diamond Royale',
    icon: '💎',
    color: '#00BCD4',
    style: ButtonStyle.Success,
    symbols: [
      { e: '🔷', name: 'Saphir',   w: 28, p3: 1.5, p4: 4,    p5: 10   },
      { e: '🟢', name: 'Émeraude', w: 22, p3: 2,   p4: 5,    p5: 12   },
      { e: '🔴', name: 'Rubis',    w: 16, p3: 3,   p4: 7,    p5: 20   },
      { e: '🟡', name: 'Topaze',   w: 12, p3: 5,   p4: 12,   p5: 40   },
      { e: '👑', name: 'Couronne', w: 7,  p3: 12,  p4: 35,   p5: 120  },
      { e: '💎', name: 'Diamant',  w: 4,  p3: 30,  p4: 100,  p5: 400  },
      { e: '🏆', name: 'Trophée',  w: 1.5,p3: 100, p4: 500,  p5: 3000 },
    ],
    wild: { e: '✨', name: 'Wild', w: 1.5 },
    scatter: { e: '💍', name: 'Bague', w: 0.7 },
  },
  christmas: {
    label: 'Christmas Magic',
    icon: '🎄',
    color: '#C62828',
    style: ButtonStyle.Danger,
    symbols: [
      { e: '🍬', name: 'Bonbon',     w: 28, p3: 1.5, p4: 4,   p5: 10  },
      { e: '🧦', name: 'Chaussette', w: 22, p3: 2,   p4: 5,   p5: 12  },
      { e: '🦌', name: 'Renne',      w: 16, p3: 3,   p4: 7,   p5: 20  },
      { e: '⛄', name: 'Bonhomme',   w: 12, p3: 5,   p4: 12,  p5: 40  },
      { e: '🎄', name: 'Sapin',      w: 7,  p3: 12,  p4: 35,  p5: 120 },
      { e: '🎁', name: 'Cadeau',     w: 4,  p3: 30,  p4: 100, p5: 400 },
      { e: '🎅', name: 'Père Noël',  w: 1.5,p3: 100, p4: 500, p5: 3000 },
    ],
    wild: { e: '❄️', name: 'Wild', w: 1.5 },
    scatter: { e: '🔔', name: 'Cloche', w: 0.7 },
  },
  space: {
    label: 'Space Galaxy',
    icon: '🚀',
    color: '#3F51B5',
    style: ButtonStyle.Primary,
    symbols: [
      { e: '🌟', name: 'Étoile', w: 28, p3: 1.5, p4: 4,   p5: 10  },
      { e: '🛸', name: 'OVNI',   w: 22, p3: 2,   p4: 5,   p5: 12  },
      { e: '🌍', name: 'Terre',  w: 16, p3: 3,   p4: 7,   p5: 20  },
      { e: '🌙', name: 'Lune',   w: 12, p3: 5,   p4: 12,  p5: 40  },
      { e: '☄️', name: 'Comète', w: 7,  p3: 12,  p4: 35,  p5: 120 },
      { e: '🚀', name: 'Fusée',  w: 4,  p3: 30,  p4: 100, p5: 400 },
      { e: '👽', name: 'Alien',  w: 1.5,p3: 100, p4: 500, p5: 3000 },
    ],
    wild: { e: '🌌', name: 'Wild', w: 1.5 },
    scatter: { e: '🪐', name: 'Planète', w: 0.7 },
  },
};

// ─── Helpers de spin ───────────────────────────────────────────────────────
function spinSymbol(machine) {
  const all = [...machine.symbols, machine.wild, machine.scatter];
  const total = all.reduce((s, x) => s + x.w, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const sym of all) { acc += sym.w; if (r < acc) return sym; }
  return machine.symbols[0];
}

function spin3x5(machine) {
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) row.push(spinSymbol(machine));
    grid.push(row);
  }
  return grid;
}

function calcWin(grid, mise) {
  let totalWin = 0, bestCombo = null;
  for (let r = 0; r < 3; r++) {
    const line = grid[r];
    let firstSym = null, count = 0;
    for (let c = 0; c < 5; c++) {
      const cur = line[c];
      if (cur.name === 'Scatter') break;
      if (cur.name === 'Wild') { count++; continue; }
      if (firstSym === null) { firstSym = cur; count++; }
      else if (cur.name === firstSym.name) count++;
      else break;
    }
    if (count >= 3 && firstSym) {
      const pay = firstSym[`p${count}`] || 0;
      const lineWin = Math.floor(mise * pay);
      totalWin += lineWin;
      if (!bestCombo || lineWin > bestCombo.win) bestCombo = { sym: firstSym, count, win: lineWin };
    }
  }
  const scatterCount = grid.flat().filter(s => s.name === 'Scatter').length;
  return { totalWin, bestCombo, scatterCount };
}

function renderGrid(grid) {
  return '```\n' + grid.map(row => row.map(s => s.e).join(' ')).join('\n') + '\n```';
}

// ─── Boutons de sélection (2 rangées de 3) ─────────────────────────────────
function buildSelectButtons(mise) {
  const keys = Object.keys(MACHINES);
  const row1 = new ActionRowBuilder().addComponents(
    keys.slice(0, 3).map(k => new ButtonBuilder()
      .setCustomId(`slotspro_play_${k}_${mise}`)
      .setLabel(MACHINES[k].label)
      .setEmoji(MACHINES[k].icon)
      .setStyle(MACHINES[k].style)
    )
  );
  const row2 = new ActionRowBuilder().addComponents(
    keys.slice(3, 6).map(k => new ButtonBuilder()
      .setCustomId(`slotspro_play_${k}_${mise}`)
      .setLabel(MACHINES[k].label)
      .setEmoji(MACHINES[k].icon)
      .setStyle(MACHINES[k].style)
    )
  );
  return [row1, row2];
}

// ─── COMMAND ───────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots-pro')
    .setDescription('🎰 SLOTS PRO : 6 machines thématiques avec wilds et free spins')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 100)').setMinValue(100).setMaxValue(500000).setRequired(true)),
  cooldown: 4,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }

    try {
      const mise = interaction.options.getInteger('mise');
      const cfg = db.getConfig(interaction.guildId);
      const emoji = cfg.currency_emoji || '€';
      const u = db.getUser(interaction.user.id, interaction.guildId);

      if (u.balance < mise) {
        return interaction.editReply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji}.` });
      }

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🎰 ・ SLOTS PRO ・ Choisis ta machine')
        .setDescription([
          `💰 Mise : **${mise.toLocaleString('fr')} ${emoji}**`,
          '',
          '**6 machines disponibles** — clique sur celle qui te plaît :',
          '',
          ...Object.values(MACHINES).map(m =>
            `${m.icon} **${m.label}** — top ×${m.symbols[m.symbols.length - 1].p5}`
          ),
          '',
          '**Features :** ⭐ Wilds • 🎁 Scatters (3+ = free spins) • Grille 3×5 (3 lignes)',
          'RTP 94% • Pas de timeout : prends ton temps',
        ].join('\n'));

      await interaction.editReply({
        embeds: [embed],
        components: buildSelectButtons(mise),
      });
    } catch (err) {
      console.error('[slots-pro execute]', err);
      try { await interaction.editReply({ content: `❌ Erreur : ${err?.message}` }); } catch {}
    }
  },

  async handleComponent(interaction, customId) {
    // Format : slotspro_play_<machineKey>_<mise>  OU  slotspro_replay_<machineKey>_<mise>
    if (!customId.startsWith('slotspro_')) return false;

    const parts = customId.split('_');
    const action = parts[1]; // 'play' ou 'replay'
    const machineKey = parts[2];
    const mise = parseInt(parts[3], 10);

    const machine = MACHINES[machineKey];
    if (!machine || !mise || isNaN(mise)) return true;

    // Pas de check userId — n'importe qui peut cliquer (mise prélevée à celui qui clique)
    // Cela permet à l'user de cliquer même si les boutons étaient pour quelqu'un d'autre
    const userId = interaction.user.id;

    try {
      const cfg = db.getConfig(interaction.guildId);
      const emoji = cfg.currency_emoji || '€';
      const u = db.getUser(userId, interaction.guildId);

      if (u.balance < mise) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji} pour jouer.`, ephemeral: true }).catch(() => {});
        }
        return true;
      }

      // Acquittement immédiat (deferUpdate pour éditer le message)
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate().catch(() => {});
      }

      // Retire la mise
      db.removeCoins(userId, interaction.guildId, mise);

      // Animation de spin (1 frame rapide)
      try {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(machine.color)
            .setTitle(`${machine.icon} ・ ${machine.label} ・ Spin...`)
            .setDescription(renderGrid(spin3x5(machine)))
          ],
          components: [],
        });
      } catch {}
      await new Promise(r => setTimeout(r, 700));

      // SPIN PRINCIPAL
      const grid = spin3x5(machine);
      let { totalWin, bestCombo, scatterCount } = calcWin(grid, mise);
      let bonusText = '';

      // Free Spins si 3+ scatters
      if (scatterCount >= 3) {
        const freeSpins = scatterCount === 3 ? 5 : scatterCount === 4 ? 10 : 15;
        let freeSpinsWin = 0;
        for (let s = 0; s < freeSpins; s++) {
          const fsRes = calcWin(spin3x5(machine), mise);
          freeSpinsWin += fsRes.totalWin;
        }
        bonusText = `\n🎁 **${scatterCount}× ${machine.scatter.name}** → **${freeSpins} FREE SPINS** ! (+${freeSpinsWin.toLocaleString('fr')} ${emoji})`;
        totalWin += freeSpinsWin;
      }

      // Apply RTP + cap
      let win = totalWin;
      if (win > 0) {
        win = applyRtp('slots', mise, win);
        win = capWin('slots', mise, win);
        db.addCoins(userId, interaction.guildId, win);
      }

      const profit = win - mise;
      const isJackpot = bestCombo?.count === 5 && bestCombo?.sym?.p5 >= 1000;
      const isBigWin = win >= mise * 10;
      const titleEmoji = isJackpot ? '💎' : isBigWin ? '🔥' : win > 0 ? '✅' : '💸';
      const title = isJackpot ? 'JACKPOT !' : isBigWin ? 'GROS GAIN !' : win > 0 ? 'Gagné !' : 'Perdu...';

      const finalEmbed = new EmbedBuilder()
        .setColor(isJackpot ? '#FFD700' : isBigWin ? '#E67E22' : win > 0 ? '#2ECC71' : '#95A5A6')
        .setTitle(`${titleEmoji} ・ ${machine.icon} ${machine.label} ・ ${title}`)
        .setDescription(renderGrid(grid) + bonusText)
        .addFields(
          { name: '💰 Mise', value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
          { name: '🎯 Combo', value: bestCombo ? `${bestCombo.count}× ${bestCombo.sym.e}` : 'Aucune', inline: true },
          { name: '💵 Gain', value: `${win.toLocaleString('fr')} ${emoji} (${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr')})`, inline: true },
        )
        .setFooter({ text: `${machine.label} • RTP 94% • Clique Rejouer ou Changer` });

      // Boutons post-spin : Rejouer même machine + Changer machine
      const replayRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`slotspro_play_${machineKey}_${mise}`)
          .setLabel(`Rejouer (${mise.toLocaleString('fr')} ${emoji})`)
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`slotspro_choose_x_${mise}`)
          .setLabel('Changer machine')
          .setEmoji('🎰')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [finalEmbed], components: [replayRow] }).catch(() => {});
      return true;
    } catch (err) {
      console.error('[slots-pro handleComponent]', err);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Erreur : ${err?.message}`, ephemeral: true });
        } else {
          await interaction.followUp({ content: `❌ Erreur : ${err?.message}`, ephemeral: true });
        }
      } catch {}
      return true;
    }
  },
};

// Handler du bouton "Changer machine" qui réaffiche les 6 boutons
const ORIGINAL_HANDLE = module.exports.handleComponent;
module.exports.handleComponent = async function(interaction, customId) {
  if (customId.startsWith('slotspro_choose_')) {
    const mise = parseInt(customId.split('_')[3], 10);
    if (!mise || isNaN(mise)) return true;
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }
    const cfg = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎰 ・ SLOTS PRO ・ Choisis ta machine')
      .setDescription([
        `💰 Mise : **${mise.toLocaleString('fr')} ${emoji}**`,
        '',
        '**6 machines** — clique sur celle qui te plaît :',
        '',
        ...Object.values(MACHINES).map(m => `${m.icon} **${m.label}** — top ×${m.symbols[m.symbols.length - 1].p5}`),
      ].join('\n'));
    await interaction.editReply({ embeds: [embed], components: buildSelectButtons(mise) }).catch(() => {});
    return true;
  }
  return ORIGINAL_HANDLE.call(this, interaction, customId);
};
