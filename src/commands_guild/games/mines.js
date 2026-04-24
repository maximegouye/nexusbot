// ============================================================
// mines.js — Minesweeper Gambling interactif
// Emplacement : src/commands_guild/games/mines.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

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

// ─── Parties actives ──────────────────────────────────────
const sessions = new Map(); // userId → state

// ─── Grille 5×5 ───────────────────────────────────────────
const GRID_SIZE  = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE; // 25

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
  for (let r = 0; r < GRID_SIZE; r++) {
    const rowBuilder = new ActionRowBuilder();
    for (let c = 0; c < GRID_SIZE; c++) {
      const idx     = r * GRID_SIZE + c;
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
  }

  return rows;
}

function buildEmbed(state, status = '') {
  const coin = (db.getConfig ? db.getConfig(state.guildId) : null)?.currency_emoji || '🪙';
  const mult  = calcMult(TOTAL_CELLS, state.minesCount, state.safeRevealed);
  const color = status === 'win'  ? '#2ECC71'
              : status === 'lose' ? '#E74C3C'
              : '#2C3E50';

  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(
      status === 'win'  ? '💎 ・ Mines — Cash-Out Réussi ・' :
      status === 'lose' ? '💥 ・ Mines — BOOM ! ・' :
      '💣 ・ Mines — Évite les bombes ・'
    )
    .addFields(
      { name: '💣 Mines cachées', value: `${state.minesCount} / ${TOTAL_CELLS}`, inline: true },
      { name: '💎 Cases sûres révélées', value: `${state.safeRevealed}`, inline: true },
      { name: '📈 Multiplicateur', value: `×${mult.toFixed(2)}`, inline: true },
      { name: '💰 Mise', value: `${state.mise} ${coin}`, inline: true },
    );

  if (status === 'win') {
    const gain = Math.floor(state.mise * mult);
    e.addFields({ name: '✅ Gain', value: `+${gain} ${coin}`, inline: true });
    e.setDescription(`🎉 Tu as empoché **${gain} ${coin}** sans exploser !`);
  } else if (status === 'lose') {
    e.addFields({ name: '❌ Perte', value: `-${state.mise} ${coin}`, inline: true });
    e.setDescription('💥 **BOOM !** Tu as touché une mine. Partie terminée.');
  } else {
    e.setDescription(`Clique sur les cases pour les révéler.\nÉvite les **${state.minesCount} mines** et cash-out avant d'exploser !`);
  }

  return e;
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
    const err = '⚠️ Tu as déjà une partie de Mines en cours !';
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
  };
  sessions.set(userId, state);

  // Animation intro : grille qui se "charge"
  const introEmbed = new EmbedBuilder()
    .setColor('#2C3E50')
    .setTitle('💣 ・ Mines ・')
    .setDescription('⚙️ *Placement des mines...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜')
    .addFields({name:'💣 Mines',value:`${minesCount}`,inline:true},{name:'💰 Mise',value:`${mise} ${coin}`,inline:true});

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [introEmbed] });
  } else {
    msg = await source.reply({ embeds: [introEmbed] });
  }

  // 2 frames d'intro (grille qui s'initialise)
  const introFrames = [
    { desc:'💣 *Mélange des mines...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ❓ ⬜ ⬜\n⬜ ❓ ⬜ ❓ ⬜\n⬜ ⬜ ❓ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#1A252F' },
    { desc:'💣 *Prêt ! Bonne chance...*\n\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜\n⬜ ⬜ ⬜ ⬜ ⬜', color:'#2C3E50' },
  ];
  for (const { desc, color } of introFrames) {
    await sleep(380);
    await msg.edit({ embeds: [new EmbedBuilder().setColor(color).setTitle('💣 ・ Mines ・').setDescription(desc)
      .addFields({name:'💣 Mines',value:`${minesCount}`,inline:true},{name:'💰 Mise',value:`${mise} ${coin}`,inline:true})] });
  }
  await sleep(300);

  // Affiche la vraie grille interactive
  await msg.edit({ embeds: [buildEmbed(state)], components: buildGridComponents(state) });

  // Collecteur
  const filter = i => i.user.id === userId && (
    i.customId.startsWith(`mines_${userId}_`) ||
    i.customId === `mines_cashout_${userId}`
  );
  const collector = msg.createMessageComponentCollector({ filter, time: 300_000 }); // 5 min

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});
    const st = sessions.get(userId);
    if (!st || st.ended) return;

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
    } else {
      // Révéler une case
      const idx = parseInt(i.customId.split('_').pop());
      if (st.revealed[idx] !== null) return;

      const cellType = st.grid[idx];

      if (cellType === 'mine') {
        // BOOM
        st.revealed[idx] = 'mine';
        st.ended = true;
        sessions.delete(userId);
        collector.stop('boom');

        // Révèle toutes les mines
        for (let c = 0; c < TOTAL_CELLS; c++) {
          if (st.grid[c] === 'mine') st.revealed[c] = 'mine';
        }
        await msg.edit({
          embeds: [buildEmbed(st, 'lose')],
          components: buildGridComponents(st),
        });
      } else {
        // Case sûre
        st.revealed[idx] = 'safe';
        st.safeRevealed++;

        // Toutes les cases sûres révélées = victoire automatique
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
        msg.edit({ content: '⏰ Temps écoulé — 50% de la mise remboursée.', components: [] }).catch(() => {});
      }
    }
  });
}

// ─── Exports ──────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('💣 Mines — révèle les cases sans toucher les bombes !')
    .addIntegerOption(o => o
      .setName('mise').setDescription('Montant à miser (min 10)').setRequired(true).setMinValue(10))
    .addIntegerOption(o => o
      .setName('mines').setDescription('Nombre de mines 1-24 (défaut 3)').setMinValue(1).setMaxValue(24)),

  async execute(interaction) {
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
  },

  name: 'mines',
  aliases: ['minesweeper', 'bombes'],
  async run(message, args) {
    const mise   = parseInt(args[0]);
    const mines  = parseInt(args[1]) || 3;
    if (!mise || mise < 10) return message.reply('❌ Usage : `&mines <mise> [mines]`\nEx: `&mines 500 5`');
    await playMines(message, message.author.id, message.guildId, mise, mines);
  },
};

