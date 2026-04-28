// ============================================================
// mines.js — Minesweeper Gambling interactif
// Emplacement : src/commands_guild/games/mines.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Multiplicateurs selon mines & cases révélées ─────────
// Table précalculée : mult[minesCount][revealed]
function calcMult(totalCases, minesCount, revealed) {
  if (revealed === 0) return 1.0;
  let mult = 1.0;
  const safe = totalCases - minesCount;
  for (let i = 0; i < revealed; i++) {
    mult *= (totalCases - minesCount - i) / (totalCases - i);
  }
  return parseFloat((0.99 / mult).toFixed(2)); // house edge 1%
}

// ─── Probabilité de sécurité pour la prochaine case ───────
function calcNextSafeProbability(totalCases, minesCount, revealed) {
  const safeCells = totalCases - minesCount;
  const safeRemaining = safeCells - revealed;
  const cellsRemaining = totalCases - revealed;
  if (cellsRemaining === 0) return 0;
  return Math.round((safeRemaining / cellsRemaining) * 100);
}

// ─── Parties actives avec TTL (10 minutes) ────────────────
const sessions = new Map(); // userId → { state, timeout }
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function setSessionTimeout(userId, state) {
  // Clear old timeout if exists
  if (state.timeout) clearTimeout(state.timeout);

  // Set new timeout
  state.timeout = setTimeout(() => {
    sessions.delete(userId);
  }, SESSION_TTL);
}

// ─── Grille 4×5 (4 rangées × 5 colonnes = 20 cases + 1 rangée cash-out = 5 ActionRows max) ───
const GRID_ROWS   = 4;
const GRID_COLS   = 5;
const GRID_SIZE   = GRID_COLS; // compat avec les boucles existantes
const TOTAL_CELLS = GRID_ROWS * GRID_COLS; // 20

function buildGrid(minesCount) {
  const cells = Array(TOTAL_CELLS).fill('safe');
  // Placer les mines
  const positions = Array.from({ length: TOTAL_CELLS }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (let i = 0; i < minesCount; i++) cells[positions[i]] = 'mine';
  return cells; // 'safe' | 'mine'
}

// ─── Rendu des boutons ────────────────────────────────────
function buildGridComponents(state) {
  const rows = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const rowBuilder = new ActionRowBuilder();
    for (let c = 0; c < GRID_COLS; c++) {
      const idx     = r * GRID_COLS + c;
      const cell    = state.grid[idx];
      const revealed = state.revealed[idx];
      let label, style, disabled;

      if (revealed === 'safe') {
        label    = '💎';
        style    = ButtonStyle.Success;
        disabled = true;
      } else if (revealed === 'mine') {
        label    = '💣';
        style    = ButtonStyle.Danger;
        disabled = true;
      } else if (state.ended) {
        // Partie terminée : révèle tout
        label    = cell === 'mine' ? '💣' : '⬜';
        style    = cell === 'mine' ? ButtonStyle.Danger : ButtonStyle.Secondary;
        disabled = true;
      } else {
        label    = '⬜';
        style    = ButtonStyle.Secondary;
        disabled = false;
      }

      rowBuilder.addComponents(
        new ButtonBuilder()
          .setCustomId(`mines_${state.userId}_${idx}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled),
      );
    }
    rows.push(rowBuilder);
  }

  // Bouton cash-out
  if (!state.ended) {
    const cashRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`mines_cashout_${state.userId}`)
        .setLabel(`💰 Cash-Out (×${calcMult(TOTAL_CELLS, state.minesCount, state.safeRevealed).toFixed(2)})`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state.safeRevealed === 0),
    );
    rows.push(cashRow);
  } else {
    // Rejouer + Changer la mise + difficulty presets
    const replayRow = makeGameRow('mines', state.userId, state.mise, `${state.minesCount}`);
    rows.push(replayRow);
    // Quick difficulty change (même mise, difficulté différente)
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mines_preset_${state.userId}_3_${state.mise}`).setLabel('🟢 3 mines').setStyle(state.minesCount === 3 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mines_preset_${state.userId}_5_${state.mise}`).setLabel('🟡 5 mines').setStyle(state.minesCount === 5 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mines_preset_${state.userId}_10_${state.mise}`).setLabel('🟠 10 mines').setStyle(state.minesCount === 10 ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mines_preset_${state.userId}_15_${state.mise}`).setLabel('🔴 15 mines').setStyle(state.minesCount === 15 ? ButtonStyle.Danger : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`mines_preset_${state.userId}_20_${state.mise}`).setLabel('☠️ 20 mines').setStyle(state.minesCount === 20 ? ButtonStyle.Danger : ButtonStyle.Secondary),
    ));
  }

  return rows;
}

function buildEmbed(state, status = '') {
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.currency_emoji || '🪙';
  const mult  = calcMult(TOTAL_CELLS, state.minesCount, state.safeRevealed);
  const color = status === 'win'  ? '#2ECC71'
              : status === 'lose' ? '#E74C3C'
              : '#2C3E50';

  // Calculer les stats pour le jeu en cours
  const safeCells = TOTAL_CELLS - state.minesCount;
  const nextSafePct = calcNextSafeProbability(TOTAL_CELLS, state.minesCount, state.safeRevealed);
  const cellsRemaining = TOTAL_CELLS - state.safeRevealed;

  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(
      status === 'win'  ? '💎 Mines - Cash-Out Reussi' :
      status === 'lose' ? '💥 Mines - BOOM !' :
      '💣 Mines - Evite les bombes'
    )
    .addFields(
      { name: '💣 Mines cachees', value: `${state.minesCount} / ${TOTAL_CELLS}`, inline: true },
      { name: '💎 Cases sures revelees', value: `${state.safeRevealed}`, inline: true },
      { name: '📈 Multiplicateur', value: `×${mult.toFixed(2)}`, inline: true },
      { name: '💰 Mise', value: `${state.mise} ${coin}`, inline: true },
    );

  // Ajouter les stats en temps réel si la partie est en cours
  if (!status) {
    e.addFields(
      { name: '🎯 Prochaine case sûre', value: `${nextSafePct}% de probabilité`, inline: true },
      { name: '📊 Cellules restantes', value: `${cellsRemaining}`, inline: true }
    );
  }

  if (status === 'win') {
    const gain = Math.floor(state.mise * mult);
    e.addFields({ name: '✅ Gain', value: `+${gain} ${coin}`, inline: true });
    e.setDescription(`🎉 Tu as empoché **${gain} ${coin}** sans exploser !`);
  } else if (status === 'lose') {
    e.addFields({ name: '❌ Perte', value: `-${state.mise} ${coin}`, inline: true });
    e.setDescription('💥 **BOOM !** Tu as touché une mine. Partie terminée.');
  } else {
    e.setDescription(`Clique sur les cases pour les reveler.\nEvite les **${state.minesCount} mines** et cash-out avant d'exploser !`);
  }

  return e;
}

// ─── Explosion animation ──────────────────────────────────
async function animateExplosion(msg, state) {
  // 6-7 frames avec couleurs et emojis progressifs pour maximum d'impact
  const explosionFrames = [
    { color:'#E74C3C', title:'💥 Mines — BOOM !',   desc:'*...* 🔥', delay: 120 },
    { color:'#C0392B', title:'💥💥 EXPLOSION !',     desc:'🔥 💥 🔥', delay: 120 },
    { color:'#E74C3C', title:'💣 KA-BOOM ! 💣',     desc:'💥 🔥 💥 🔥 💥', delay: 100 },
    { color:'#922B21', title:'☠️ Mine touchée !',   desc:'💣 💥 ☠️ 💥 💣', delay: 100 },
    { color:'#7B241C', title:'💀 Partie terminée',  desc:'*Boom.* 💀', delay: 120 },
    { color:'#641E16', title:'🔥 Total annihilation 🔥', desc:'☠️ 💣 💥 💀 🔥', delay: 100 },
  ];
  for (const { color, title, desc, delay } of explosionFrames) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc);
    await msg.edit({ embeds: [embed] }).catch(() => {});
    await sleep(delay);
  }
}

// ─── Safe reveal animation ────────────────────────────────
async function animateSafeReveal(msg, state) {
  // 2-3 frames avec animation verte progressive pour plus de punch
  const safeFrames = [
    { color:'#16A085', title:'✨ Case Sûre !', desc:'*Révélation...*', delay: 150 },
    { color:'#1E8449', title:'💎 Case Sûre !', desc:'✨ *Ouf !*', delay: 120 },
    { color:'#0E6251', title:'✅ Case Sûre !', desc:'💎 *Bravo !*', delay: 100 },
  ];
  for (const { color, title, desc, delay } of safeFrames) {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc);
    await msg.edit({ embeds: [embed] }).catch(() => {});
    await sleep(delay);
  }
}

// ─── Jeu principal ────────────────────────────────────────
async function playMines(source, userId, guildId, mise, minesCount) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (sessions.has(userId)) {
    const err = '⚠️ Tu as deja une partie de Mines en cours !';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10 coins**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (minesCount < 1 || minesCount > 24) {
    const err = '❌ Nombre de mines entre **1** et **24**.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const state = {
    userId, guildId, mise, minesCount,
    grid:          buildGrid(minesCount),
    revealed:      Array(TOTAL_CELLS).fill(null),
    safeRevealed:  0,
    ended:         false,
    timeout:       null,
  };
  sessions.set(userId, state);
  setSessionTimeout(userId, state);

  // Animation intro : grille qui se "charge"
  const introEmbed = new EmbedBuilder()
    .setColor('#2C3E50')
    .setTitle('💣 Mines')
    .setDescription('⚙️ *Placement des mines...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜')
    .addFields({name:'💣 Mines',value:`${minesCount}`,inline:true},{name:'💰 Mise',value:`${mise} ${coin}`,inline:true});

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [introEmbed] });
  } else {
    msg = await source.reply({ embeds: [introEmbed] });
  }

  // 4-5 frames d'intro AMÉLIORÉES — placement des mines avec suspense progressif
  const introFrames = [
    { desc:'💣 *Placement des mines...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#1A252F', delay: 350 },
    { desc:'💣 *Mélange des mines...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ❓ ⬜ ⬜\n⬜ ❓ ⬜ ❓ ⬜\n⬜ ⬜ ❓ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#244C45', delay: 380 },
    { desc:'⚡ *Mines en place...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ❓ ⬜ ❓ ⬜\n❓ ⬜ ⬜ ⬜ ❓\n⬜ ⬜ ❓ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#1F4A43', delay: 350 },
    { desc:'✨ *Grille prête...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#2C3E50', delay: 300 },
    { desc:'🎯 *C\'est parti ! Bonne chance...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#34495E', delay: 250 },
  ];
  for (const { desc, color, delay } of introFrames) {
    await sleep(delay);
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle('💣 Mines').setDescription(desc)
      .addFields({name:'💣 Mines',value:`${minesCount}`,inline:true},{name:'💰 Mise',value:`${mise} ${coin}`,inline:true})] });
  }
  await sleep(300);

  // Affiche la vraie grille interactive
  await msg.edit({ embeds: [buildEmbed(state)], components: buildGridComponents(state) });

  // Collecteur
  const filter = i => i.user.id === userId && (
    i.customId.startsWith(`mines_${userId}_`) ||
    i.customId === `mines_cashout_${userId}` ||
    i.customId.startsWith(`mines_replay_`)
  );
  const collector = msg.createMessageComponentCollector({ filter, time: 10 * 60 * 1000 }); // 10 min

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});
    const st = sessions.get(userId);
    if (!st || st.ended) return;

    // Reset timeout on interaction
    setSessionTimeout(userId, st);

    if (i.customId === `mines_cashout_${userId}`) {
      // Cash-out
      const mult = calcMult(TOTAL_CELLS, st.minesCount, st.safeRevealed);
      const gain = Math.floor(st.mise * mult);
      db.addCoins(userId, guildId, gain);
      st.ended = true;
      sessions.delete(userId);
      collector.stop('cashout');

      await msg.edit({
        embeds: [buildEmbed(st, 'win')],
        components: buildGridComponents(st),
      });
    } else if (i.customId.startsWith('mines_replay_')) {
      collector.stop('replay');
      const parts = i.customId.split('_');
      const customUserId = parts[2];
      const replayMise = parseInt(parts[3]);
      const replayMines = parseInt(parts[4]);

      if (customUserId === userId) {
        const source = { editReply: (d) => i.editReply(d), deferred: true };
        await playMines(source, userId, guildId, replayMise, replayMines);
      }
    } else {
      // Reveler une case
      const idx = parseInt(i.customId.split('_').pop());
      if (st.revealed[idx] !== null) return;

      const cellType = st.grid[idx];

      if (cellType === 'mine') {
        // BOOM
        await animateExplosion(msg, st);

        st.revealed[idx] = 'mine';
        st.ended = true;
        sessions.delete(userId);
        collector.stop('boom');

        // Revele toutes les mines
        for (let c = 0; c < TOTAL_CELLS; c++) {
          if (st.grid[c] === 'mine') st.revealed[c] = 'mine';
        }
        await msg.edit({
          embeds: [buildEmbed(st, 'lose')],
          components: buildGridComponents(st),
        });
      } else {
        // Case sure
        await animateSafeReveal(msg, st);

        st.revealed[idx] = 'safe';
        st.safeRevealed++;

        // Toutes les cases sures revelees = victoire automatique
        const safeCells = TOTAL_CELLS - st.minesCount;
        if (st.safeRevealed >= safeCells) {
          const mult = calcMult(TOTAL_CELLS, st.minesCount, st.safeRevealed);
          const gain = Math.floor(st.mise * mult);
          db.addCoins(userId, guildId, gain);
          st.ended = true;
          sessions.delete(userId);
          collector.stop('all_safe');
          await msg.edit({
            embeds: [buildEmbed(st, 'win')],
            components: buildGridComponents(st),
          });
        } else {
          await msg.edit({
            embeds: [buildEmbed(st)],
            components: buildGridComponents(st),
          });
        }
      }
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      const st = sessions.get(userId);
      if (st && !st.ended) {
        sessions.delete(userId);
        // Remboursement si timeout
        db.addCoins(userId, guildId, Math.floor(st.mise * 0.5));
        msg.edit({ content: '⏰ Temps ecoulé - 50% de la mise remboursee.', components: [] }).catch(() => {});
      }
    }
  });
}

// ─── Handle Component ──────────────────────────────────────
async function handleComponent(interaction) {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  if (interaction.customId.startsWith('mines_replay_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const mise = parseInt(parts[3]);
    const mines = parseInt(parts[4]);

    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true }).catch(() => {});


    }

    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playMines(source, userId, guildId, mise, mines);
    return true;
  }

  // ── Difficulty preset buttons ─────────────────────────────
  if (interaction.customId.startsWith('mines_preset_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const minesCount   = parseInt(parts[3]);
    const mise         = parseInt(parts[4]);
    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.deferUpdate();
    const source = { editReply: (d) => interaction.editReply(d), deferred: true };
    await playMines(source, userId, guildId, mise, minesCount);
    return true;
  }

  if (interaction.customId.startsWith('mines_changemise_')) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const minesCount = parseInt(parts[3]) || 3;
    if (customUserId !== userId) {
      return interaction.editReply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('mines', userId, `${minesCount}`));
    return true;
  }

  if (interaction.customId.startsWith('mines_modal_') && interaction.isModalSubmit()) {
    const parts = interaction.customId.split('_');
    const customUserId = parts[2];
    const minesCount = parseInt(parts[3]) || 3;
    if (customUserId !== userId) {
      return interaction.reply({ content: '❌ Ce modal n\'est pas pour toi.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 coins).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playMines(interaction, userId, guildId, newMise, minesCount);
    return true;
  }
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('💣 Mines - revele les cases sans toucher les bombes !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant a miser (min 10)').setRequired(true).setMinValue(10))
    .addIntegerOption(o => o
      .setName('mines').setDescription('Nombre de mines 1-24 (defaut 3)').setMinValue(1).setMaxValue(24)),

  async execute(interaction) {
    try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playMines(
      interaction,
      interaction.user.id,
      interaction.guildId,
      interaction.options.getInteger('mise'),
      interaction.options.getInteger('mines') || 3,
    );
    } catch (err) {
    console.error('[CMD] Erreur:', err?.message || err);
    const _em = { content: `❌ Erreur : ${String(err?.message || 'Erreur inconnue').slice(0,200)}`, ephemeral: true };
    try {
      await interaction.editReply(_em).catch(() => {});
    } catch {}
  }},

  name: 'mines',
  aliases: ['minesweeper', 'bombes'],
  async run(message, args) {
    const mise   = parseInt(args[0]);
    const mines  = parseInt(args[1]) || 3;
    if (!mise || mise < 10) return message.reply('❌ Usage : `&mines <mise> [mines]`\nEx: `&mines 500 5`');
    await playMines(message, message.author.id, message.guildId, mise, mines);
  },

  handleComponent,
};
