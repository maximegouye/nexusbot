// ============================================================
// grattage.js — Carte à gratter animée (3×3 symboles)
// /grattage mise:500  |  &grattage 500
// ============================================================
'use strict';
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ─── Symboles ────────────────────────────────────────────────
const SYMBOLES = [
  { emoji: '💎', name: 'Diamant',  weight: 2,  mult: 20 },
  { emoji: '🏆', name: 'Trophée', weight: 3,  mult: 12 },
  { emoji: '🌟', name: 'Étoile',  weight: 5,  mult: 7  },
  { emoji: '🎯', name: 'Cible',   weight: 7,  mult: 5  },
  { emoji: '🃏', name: 'Joker',   weight: 8,  mult: 4  },
  { emoji: '🍀', name: 'Trèfle',  weight: 10, mult: 3  },
  { emoji: '🍒', name: 'Cerise',  weight: 14, mult: 2  },
  { emoji: '🍋', name: 'Citron',  weight: 18, mult: 1.5 },
  { emoji: '🍊', name: 'Orange',  weight: 22, mult: 0  }, // rien
  { emoji: '🔔', name: 'Cloche',  weight: 11, mult: 0  }, // rien
];
const TOTAL_W = SYMBOLES.reduce((s, x) => s + x.weight, 0);

function pickSym() {
  let r = Math.random() * TOTAL_W;
  for (const s of SYMBOLES) { r -= s.weight; if (r <= 0) return s; }
  return SYMBOLES[SYMBOLES.length - 1];
}

function genGrid() { return Array.from({ length: 9 }, () => pickSym()); }

// ─── Calcul des gains ────────────────────────────────────────
function calcGain(grid, mise) {
  // Compter les occurrences de chaque emoji
  const counts = {};
  for (const s of grid) counts[s.emoji] = (counts[s.emoji] || 0) + 1;

  let bestMult = 0, bestSym = null, matched = 0;

  for (const s of SYMBOLES) {
    const c = counts[s.emoji] || 0;
    if (c >= 3 && s.mult > 0) {
      // Le multiplicateur augmente si > 3 matches
      const effectiveMult = s.mult * (c >= 6 ? 3 : c >= 4 ? 2 : 1);
      if (effectiveMult > bestMult) {
        bestMult = effectiveMult;
        bestSym  = s;
        matched  = c;
      }
    }
  }

  if (bestMult === 0) return { gain: 0, mult: 0, sym: null, matched: 0 };
  const gain = Math.floor(mise * bestMult);
  return { gain, mult: bestMult, sym: bestSym, matched };
}

// ─── Rendu de la grille ──────────────────────────────────────
function renderGrid(grid, revealed, hidden = '⬛') {
  let out = '';
  for (let i = 0; i < 9; i++) {
    out += revealed[i] ? grid[i].emoji : hidden;
    if ((i + 1) % 3 === 0) out += '\n';
    else out += ' ';
  }
  return out.trim();
}

// ─── Store en mémoire ────────────────────────────────────────
const sessions = new Map(); // key = userId_guildId

// ─── Helpers embed ────────────────────────────────────────────
function buildEmbed(mise, grid, revealed, result, phase) {
  const allRevealed = revealed.every(Boolean);
  const gridStr = renderGrid(grid, revealed);

  let color = '#5865F2', title = '🎰 Carte à Gratter', desc = '';

  if (phase === 'start') {
    color = '#5865F2';
    desc = `Mise : **${mise.toLocaleString()} 💰**\n\n${gridStr}\n\n> ⬛ cases cachées — Gratte pour révéler !`;
  } else if (!allRevealed) {
    color = '#F39C12';
    desc = `Mise : **${mise.toLocaleString()} 💰**\n\n${gridStr}\n\n> Continue à gratter, ${9 - revealed.filter(Boolean).length} case(s) restante(s)`;
  } else {
    if (result.gain > 0) {
      color = result.mult >= 10 ? '#FFD700' : result.mult >= 5 ? '#2ECC71' : '#27AE60';
      title = result.mult >= 10 ? '🎊 JACKPOT !!!' : result.mult >= 5 ? '🎉 GRANDE VICTOIRE !' : '✅ Tu as gagné !';
      const bonus = result.matched > 3 ? ` (×${result.matched} = **bonus ×${result.matched > 5 ? 3 : 2}** !)` : '';
      desc =
        `Mise : **${mise.toLocaleString()} 💰**\n\n${gridStr}\n\n` +
        `${'─'.repeat(28)}\n` +
        `${result.sym.emoji} **${result.sym.name}** × ${result.matched}${bonus}\n` +
        `Multiplicateur : **×${result.mult}**\n` +
        `💰 **+${result.gain.toLocaleString()} coins**`;
    } else {
      color = '#E74C3C';
      title = '😔 Pas de chance !';
      const totalL = [
        'Pas de combinaison gagnante... Retente ta chance !',
        'Dommage, aucun match cette fois. La chance tourne !',
        'Ce n\'est pas ton jour, mais le prochain sera le bon !',
      ];
      desc = `Mise : **${mise.toLocaleString()} 💰**\n\n${gridStr}\n\n${totalL[Math.floor(Math.random() * totalL.length)]}`;
    }
  }

  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc)
    .setFooter({ text: 'NexusBot Casino • Carte à Gratter' });
}

function buildButtons(sessionId, revealed) {
  const allRevealed = revealed.every(Boolean);
  if (allRevealed) return [];

  const firstHidden = revealed.indexOf(false);
  const rows = [];

  // Boutons de grattage (par rangée de 3)
  for (let row = 0; row < 3; row++) {
    const btns = [];
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const isRev = revealed[idx];
      btns.push(
        new ButtonBuilder()
          .setCustomId(`grattage_cell_${sessionId}_${idx}`)
          .setLabel(isRev ? '✓' : `${row+1}${col+1}`)
          .setStyle(isRev ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(isRev)
      );
    }
    rows.push(new ActionRowBuilder().addComponents(...btns));
  }

  // Bouton "Tout révéler"
  const hiddenCount = revealed.filter(x => !x).length;
  if (hiddenCount > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`grattage_all_${sessionId}`)
        .setLabel('🎰 Tout révéler d\'un coup !')
        .setStyle(ButtonStyle.Success)
    ));
  }

  return rows;
}

// ─── Commande principale ─────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('grattage')
    .setDescription('🎰 Achète une carte à gratter et tente ta chance !')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Montant à parier (50–50 000 coins)')
      .setRequired(true)
      .setMinValue(50)
      .setMaxValue(50000)
    ),
  cooldown: 8,

  async execute(interaction) {
    const mise = interaction.options.getInteger('mise');
    return runGame(interaction, mise);
  },

  // Préfixe & (ex: &grattage 500)
  run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 50 || mise > 50000)
      return message.reply('❌ Usage : `&grattage <mise>` (50–50 000 coins)');
    return runGame(message, mise, true);
  },

  handleComponent,
};

// ─── Logique partagée ────────────────────────────────────────
async function runGame(ctx, mise, isPrefix = false) {
  const userId  = isPrefix ? ctx.author.id : ctx.user.id;
  const guildId = ctx.guildId;
  const userData = db.getUser(userId, guildId);

  if (!userData || userData.balance < mise) {
    const reply = { content: `❌ Solde insuffisant ! Tu as **${(userData?.balance || 0).toLocaleString()} 💰** et tu mises **${mise.toLocaleString()} 💰**.`, ephemeral: true };
    return isPrefix ? ctx.reply(reply.content) : ctx.reply(reply);
  }

  // Débiter
  db.addCoins(userId, guildId, -mise);

  const grid     = genGrid();
  const revealed = Array(9).fill(false);
  const sessionId = `${userId}_${guildId}_${Date.now()}`;
  sessions.set(sessionId, { grid, revealed, mise, userId, guildId });

  // Timeout 3 min
  setTimeout(() => {
    const s = sessions.get(sessionId);
    if (s && !s.revealed.every(Boolean)) {
      sessions.delete(sessionId);
    }
  }, 3 * 60 * 1000);

  const embed    = buildEmbed(mise, grid, revealed, null, 'start');
  const buttons  = buildButtons(sessionId, revealed);
  const payload  = { embeds: [embed], components: buttons };

  if (isPrefix) {
    ctx.reply(payload);
  } else {
    await ctx.reply(payload);
  }
}

// ─── Gestion des boutons ─────────────────────────────────────
async function handleComponent(interaction, customId) {
  if (!customId.startsWith('grattage_')) return false;

  const parts = customId.split('_');
  const action = parts[1]; // 'cell' | 'all'

  // Retrouver la session
  let sessionId;
  if (action === 'cell') {
    sessionId = `${parts[2]}_${parts[3]}_${parts[4]}`;
  } else if (action === 'all') {
    sessionId = `${parts[2]}_${parts[3]}_${parts[4]}`;
  } else return false;

  const session = sessions.get(sessionId);
  if (!session) {
    await interaction.reply({ content: '❌ Session expirée (3 min). Relance une nouvelle carte !', ephemeral: true });
    return true;
  }

  // Vérif ownership
  const userId = interaction.user.id;
  if (session.userId !== userId) {
    await interaction.reply({ content: '❌ Ce n\'est pas ta carte à gratter !', ephemeral: true });
    return true;
  }

  await interaction.deferUpdate();

  if (action === 'cell') {
    const idx = parseInt(parts[5]);
    if (!session.revealed[idx]) session.revealed[idx] = true;
  } else if (action === 'all') {
    session.revealed.fill(true);
  }

  const allRevealed = session.revealed.every(Boolean);
  let result = null;

  if (allRevealed) {
    result = calcGain(session.grid, session.mise);
    // Créditer les gains
    if (result.gain > 0) {
      db.addCoins(session.userId, session.guildId, result.gain);
      try { db.addXP(session.userId, session.guildId, Math.max(5, Math.floor(result.gain / 50))); } catch {}
    }
    sessions.delete(sessionId);
  }

  const embed   = buildEmbed(session.mise, session.grid, session.revealed, result, allRevealed ? 'end' : 'mid');
  const buttons = buildButtons(sessionId, session.revealed);

  await interaction.editReply({ embeds: [embed], components: buttons });
  return true;
}
