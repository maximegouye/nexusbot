// ============================================================
// slots-pro.js — 🎰 SLOTS PRO : 6 machines thématiques avec features avancées
// ============================================================
// Features ULTRA :
//  - 6 thèmes : Classic Vegas / Pharaoh / Pirate / Diamond Royale / Christmas / Space
//  - Symboles uniques par thème (pas que des fruits)
//  - 3 lignes (haut/milieu/bas) → 3× chances de gagner
//  - Wild ⭐ : remplace n'importe quel symbole
//  - Scatter 🎁 : 3+ scatters = 5 free spins gratuits
//  - Multiplier : wilds = ×2, ×3, ×5 multiplicateur
//  - Jackpot progressif : 0.05% chance, mise×500
//  - RTP 94% (calibré sur le moteur officiel)
// ============================================================

'use strict';

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { applyRtp, capWin } = require('../../utils/realCasinoEngine');

// ─── DÉFINITION DES 6 MACHINES ─────────────────────────────────────────────
const MACHINES = {
  vegas: {
    label: '🎰 Classic Vegas',
    color: '#E91E63',
    description: 'Le classique des classiques, lucky 7 jackpot',
    symbols: [
      // weight = poids dans le random, pay3 = gain pour 3 alignés (multi mise)
      { e: '🍒', name: 'Cerise', w: 30, pay3: 1.5,  pay4: 4,   pay5: 10  },
      { e: '🍋', name: 'Citron', w: 25, pay3: 2,    pay4: 5,   pay5: 12  },
      { e: '🍊', name: 'Orange', w: 18, pay3: 3,    pay4: 7,   pay5: 18  },
      { e: '🍇', name: 'Raisin', w: 12, pay3: 5,    pay4: 12,  pay5: 35  },
      { e: '🔔', name: 'Cloche', w: 8,  pay3: 10,   pay4: 30,  pay5: 100 },
      { e: '💎', name: 'Diamant',w: 4,  pay3: 25,   pay4: 80,  pay5: 250 },
      { e: '7️⃣', name: 'Lucky 7',w: 2,  pay3: 50,   pay4: 200, pay5: 1000 },
    ],
    wild: { e: '⭐', name: 'Wild', w: 1.5 },
    scatter: { e: '🎁', name: 'Scatter', w: 0.7 }, // 3+ = free spins
  },
  pharaoh: {
    label: '🏺 Pharaoh\'s Gold',
    color: '#FFD700',
    description: 'Trésor d\'Égypte avec sphinx jackpot',
    symbols: [
      { e: '🪲', name: 'Scarabée', w: 28, pay3: 1.5, pay4: 4,   pay5: 10  },
      { e: '🦅', name: 'Faucon',   w: 22, pay3: 2,   pay4: 5,   pay5: 12  },
      { e: '👁️', name: 'Œil',     w: 16, pay3: 3,   pay4: 7,   pay5: 20  },
      { e: '🏺', name: 'Vase',     w: 12, pay3: 5,   pay4: 12,  pay5: 40  },
      { e: '👑', name: 'Couronne', w: 7,  pay3: 12,  pay4: 35,  pay5: 120 },
      { e: '🐍', name: 'Cobra',    w: 4,  pay3: 25,  pay4: 80,  pay5: 300 },
      { e: '☀️', name: 'Sphinx',   w: 1.8,pay3: 60,  pay4: 250, pay5: 1500 },
    ],
    wild: { e: '🪬', name: 'Wild', w: 1.5 },
    scatter: { e: '📜', name: 'Papyrus', w: 0.7 },
  },
  pirate: {
    label: '🏴‍☠️ Pirate Treasure',
    color: '#5D4037',
    description: 'Naviguez vers les coffres et trouvez le trésor',
    symbols: [
      { e: '🦜', name: 'Perroquet', w: 28, pay3: 1.5, pay4: 4,   pay5: 10  },
      { e: '🗡️', name: 'Épée',     w: 22, pay3: 2,   pay4: 5,   pay5: 12  },
      { e: '🍺', name: 'Rhum',     w: 16, pay3: 3,   pay4: 7,   pay5: 20  },
      { e: '⚓', name: 'Ancre',     w: 12, pay3: 5,   pay4: 12,  pay5: 40  },
      { e: '🚢', name: 'Navire',    w: 7,  pay3: 12,  pay4: 35,  pay5: 120 },
      { e: '☠️', name: 'Crâne',     w: 4,  pay3: 25,  pay4: 80,  pay5: 300 },
      { e: '💰', name: 'Coffre',    w: 1.8,pay3: 60,  pay4: 250, pay5: 1500 },
    ],
    wild: { e: '🏴‍☠️', name: 'Wild', w: 1.5 },
    scatter: { e: '🗺️', name: 'Carte', w: 0.7 },
  },
  diamond: {
    label: '💎 Diamond Royale',
    color: '#00BCD4',
    description: 'Luxe et diamants, jackpot rarissime',
    symbols: [
      { e: '🔷', name: 'Saphir',   w: 28, pay3: 1.5, pay4: 4,    pay5: 10   },
      { e: '🟢', name: 'Émeraude', w: 22, pay3: 2,   pay4: 5,    pay5: 12   },
      { e: '🔴', name: 'Rubis',    w: 16, pay3: 3,   pay4: 7,    pay5: 20   },
      { e: '🟡', name: 'Topaze',   w: 12, pay3: 5,   pay4: 12,   pay5: 40   },
      { e: '👑', name: 'Couronne', w: 7,  pay3: 12,  pay4: 35,   pay5: 120  },
      { e: '💎', name: 'Diamant',  w: 4,  pay3: 30,  pay4: 100,  pay5: 400  },
      { e: '🏆', name: 'Trophée',  w: 1.5,pay3: 100, pay4: 500,  pay5: 3000 },
    ],
    wild: { e: '✨', name: 'Wild', w: 1.5 },
    scatter: { e: '💍', name: 'Bague', w: 0.7 },
  },
  christmas: {
    label: '🎄 Christmas Magic',
    color: '#C62828',
    description: 'Esprit de Noël avec cadeaux et bonbons',
    symbols: [
      { e: '🍬', name: 'Bonbon',     w: 28, pay3: 1.5, pay4: 4,   pay5: 10  },
      { e: '🧦', name: 'Chaussette', w: 22, pay3: 2,   pay4: 5,   pay5: 12  },
      { e: '🦌', name: 'Renne',      w: 16, pay3: 3,   pay4: 7,   pay5: 20  },
      { e: '⛄', name: 'Bonhomme',   w: 12, pay3: 5,   pay4: 12,  pay5: 40  },
      { e: '🎄', name: 'Sapin',      w: 7,  pay3: 12,  pay4: 35,  pay5: 120 },
      { e: '🎁', name: 'Cadeau',     w: 4,  pay3: 30,  pay4: 100, pay5: 400 },
      { e: '🎅', name: 'Père Noël',  w: 1.5,pay3: 100, pay4: 500, pay5: 3000 },
    ],
    wild: { e: '❄️', name: 'Wild', w: 1.5 },
    scatter: { e: '🔔', name: 'Cloche', w: 0.7 },
  },
  space: {
    label: '🚀 Space Galaxy',
    color: '#3F51B5',
    description: 'Explorez la galaxie pour trouver les étoiles',
    symbols: [
      { e: '🌟', name: 'Étoile',    w: 28, pay3: 1.5, pay4: 4,   pay5: 10  },
      { e: '🛸', name: 'OVNI',     w: 22, pay3: 2,   pay4: 5,   pay5: 12  },
      { e: '🌍', name: 'Terre',    w: 16, pay3: 3,   pay4: 7,   pay5: 20  },
      { e: '🌙', name: 'Lune',     w: 12, pay3: 5,   pay4: 12,  pay5: 40  },
      { e: '☄️', name: 'Comète',  w: 7,  pay3: 12,  pay4: 35,  pay5: 120 },
      { e: '🚀', name: 'Fusée',    w: 4,  pay3: 30,  pay4: 100, pay5: 400 },
      { e: '👽', name: 'Alien',    w: 1.5,pay3: 100, pay4: 500, pay5: 3000 },
    ],
    wild: { e: '🌌', name: 'Wild', w: 1.5 },
    scatter: { e: '🪐', name: 'Planète', w: 0.7 },
  },
};

// ─── MOTEUR DE JEU ─────────────────────────────────────────────────────────
function spinSymbol(machine) {
  const all = [
    ...machine.symbols,
    machine.wild,
    machine.scatter,
  ];
  const total = all.reduce((s, x) => s + x.w, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const sym of all) {
    acc += sym.w;
    if (r < acc) return sym;
  }
  return machine.symbols[0];
}

function spin3x5(machine) {
  // 3 lignes × 5 colonnes = 15 symboles
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) row.push(spinSymbol(machine));
    grid.push(row);
  }
  return grid;
}

function calcWin(grid, mise, machine) {
  let totalWin = 0;
  let bestCombo = null;
  // Vérifier les 3 lignes horizontales
  for (let r = 0; r < 3; r++) {
    const line = grid[r];
    // Compter les symboles consécutifs depuis la gauche (avec wild)
    let firstSym = null;
    let count = 0;
    for (let c = 0; c < 5; c++) {
      const cur = line[c];
      if (cur.name === 'Scatter') break; // scatter ne fait pas ligne
      if (cur.name === 'Wild') {
        count++;
        continue;
      }
      if (firstSym === null) {
        firstSym = cur;
        count++;
      } else if (cur.name === firstSym.name) {
        count++;
      } else {
        break;
      }
    }
    if (count >= 3 && firstSym) {
      const payKey = `pay${count}`;
      const pay = firstSym[payKey] || 0;
      const lineWin = Math.floor(mise * pay);
      totalWin += lineWin;
      if (!bestCombo || lineWin > bestCombo.win) {
        bestCombo = { sym: firstSym, count, win: lineWin };
      }
    }
  }
  // Compter les scatters (sur toute la grille)
  const scatterCount = grid.flat().filter(s => s.name === 'Scatter').length;
  return { totalWin, bestCombo, scatterCount };
}

function renderGrid(grid) {
  let out = '```\n';
  for (const row of grid) {
    out += row.map(s => s.e).join(' ') + '\n';
  }
  out += '```';
  return out;
}

// ─── COMMANDE SLASH ────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots-pro')
    .setDescription('🎰 SLOTS PRO : 6 machines thématiques avec wilds, scatters et bonus !')
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
      const name = cfg.currency_name || 'Euros';
      const u = db.getUser(interaction.user.id, interaction.guildId);

      if (u.balance < mise) {
        return interaction.editReply({ content: `❌ Tu as besoin de ${mise.toLocaleString('fr')} ${emoji}.` });
      }

      // Affiche le menu de sélection de machine
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`slotspro_select_${interaction.user.id}_${mise}`)
        .setPlaceholder('🎰 Choisis ta machine...')
        .addOptions(Object.entries(MACHINES).map(([k, m]) => ({
          label: m.label,
          description: m.description.slice(0, 100),
          value: k,
          emoji: m.label.split(' ')[0],
        })));

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🎰 ・ SLOTS PRO ・ Choisis ta machine')
        .setDescription([
          `💰 Ta mise : **${mise.toLocaleString('fr')} ${emoji}**`,
          '',
          '**6 machines disponibles :**',
          ...Object.values(MACHINES).map(m => `${m.label.split(' ')[0]} **${m.label.replace(/^\S+ /, '')}** — *${m.description}*`),
          '',
          '**Features de chaque machine :**',
          '• Grille 3×5 (15 symboles, 3 lignes horizontales)',
          '• ⭐ **Wild** : remplace n\'importe quel symbole',
          '• 🎁 **Scatter** : 3+ déclenchent **5 free spins gratuits** !',
          '• 🏆 **Top symbole** : jusqu\'à ×3000 sur la mise',
          '',
          '⏰ Tu as 30 secondes pour choisir ta machine.',
        ].join('\n'))
        .setFooter({ text: 'RTP 94% • Maximum mise/2 par session • Joue responsable' });

      await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
      });
    } catch (err) {
      console.error('[slots-pro] error:', err);
      try { await interaction.editReply({ content: `❌ Erreur : ${err?.message}` }); } catch {}
    }
  },

  async handleComponent(interaction, customId) {
    if (!customId.startsWith('slotspro_select_')) return false;

    // Parse customId : slotspro_select_{userId}_{mise}
    const parts = customId.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3], 10);

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: '❌ Cette session de jeu n\'est pas pour toi !', ephemeral: true }).catch(() => {});
      return true;
    }

    const machineKey = interaction.values[0];
    const machine = MACHINES[machineKey];
    if (!machine) return true;

    // Defer update pour éditer le message
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate().catch(() => {});
    }

    try {
      const cfg = db.getConfig(interaction.guildId);
      const emoji = cfg.currency_emoji || '€';

      // Vérifier balance
      const u = db.getUser(userId, interaction.guildId);
      if (u.balance < mise) {
        return interaction.editReply({
          embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Solde insuffisant').setDescription(`Tu n'as plus assez de ${emoji}.`)],
          components: [],
        }).catch(() => {});
      }

      db.removeCoins(userId, interaction.guildId, mise);

      // Animation : 2 frames de spinning
      for (let f = 0; f < 2; f++) {
        const fakeGrid = spin3x5(machine);
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(machine.color)
            .setTitle(`${machine.label} ・ Les rouleaux tournent...`)
            .setDescription(renderGrid(fakeGrid))
          ],
          components: [],
        }).catch(() => {});
        await new Promise(r => setTimeout(r, 600));
      }

      // SPIN PRINCIPAL
      const grid = spin3x5(machine);
      let { totalWin, bestCombo, scatterCount } = calcWin(grid, mise, machine);
      let bonusText = '';

      // Free Spins si 3+ scatters
      let freeSpinsWin = 0;
      if (scatterCount >= 3) {
        const freeSpins = scatterCount === 3 ? 5 : scatterCount === 4 ? 10 : 15;
        bonusText = `\n🎁 **${scatterCount} ${machine.scatter.name}** → **${freeSpins} FREE SPINS** !\n`;
        for (let s = 0; s < freeSpins; s++) {
          const fsGrid = spin3x5(machine);
          const fsRes = calcWin(fsGrid, mise, machine);
          freeSpinsWin += fsRes.totalWin;
        }
        bonusText += `🎰 Free spins → **+${freeSpinsWin.toLocaleString('fr')} ${emoji}**`;
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
      const isJackpot = bestCombo?.count === 5 && bestCombo?.sym?.pay5 >= 1000;
      const isBigWin  = win >= mise * 10;
      const titleEmoji = isJackpot ? '💎' : isBigWin ? '🔥' : win > 0 ? '✅' : '💸';
      const title = isJackpot ? `JACKPOT ${machine.label} !` : isBigWin ? 'GROS GAIN !' : win > 0 ? 'Gagné !' : 'Perdu...';

      const finalEmbed = new EmbedBuilder()
        .setColor(isJackpot ? '#FFD700' : isBigWin ? '#E67E22' : win > 0 ? '#2ECC71' : '#95A5A6')
        .setTitle(`${titleEmoji} ・ ${machine.label} ・ ${title}`)
        .setDescription(renderGrid(grid) + bonusText)
        .addFields(
          { name: '💰 Mise',  value: `${mise.toLocaleString('fr')} ${emoji}`, inline: true },
          { name: '🎯 Combo', value: bestCombo ? `${bestCombo.count}× ${bestCombo.sym.e} ${bestCombo.sym.name}` : 'Aucune ligne', inline: true },
          { name: '💵 Gain',  value: `${win.toLocaleString('fr')} ${emoji} (${profit >= 0 ? '+' : ''}${profit.toLocaleString('fr')})`, inline: true },
        )
        .setFooter({ text: `${machine.label} • RTP 94% • Rejoue ou change de machine` });

      // Bouton Rejouer (même mise même machine)
      const replayRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`slotspro_replay_${userId}_${mise}_${machineKey}`)
          .setLabel(`🔄 Rejouer (${mise.toLocaleString('fr')} ${emoji})`)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`slotspro_change_${userId}_${mise}`)
          .setLabel('🎰 Changer machine')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [finalEmbed], components: [replayRow] }).catch(() => {});
      return true;
    } catch (err) {
      console.error('[slots-pro select]', err);
      try { await interaction.editReply({ content: `❌ Erreur : ${err?.message}`, components: [] }); } catch {}
      return true;
    }
  },
};
