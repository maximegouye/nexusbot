// ============================================================
// craps.js — Craps Casino — Le jeu de dés légendaire !
// Roll 2 dés, Pass Line, Don't Pass, Any Seven, Any Craps, etc.
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Animation des dés ─────────────────────────────────────────
const DICE_PHASES = [
  { label: '🎲 *Les dés partent en l\'air !*', emoji: '⬜🎲⬜', delay: 80, steps: 6 },
  { label: '🌀 *Ils tournent dans tous les sens !*', emoji: '⬜🎲⬜', delay: 120, steps: 5 },
  { label: '💨 *Ralentissement... la gravité reprend !*', emoji: '⬜🎲⬜', delay: 180, steps: 4 },
  { label: '🏓 *Ils rebondissent sur le tapis !*', emoji: '⬜🎲⬜', delay: 280, steps: 3 },
  { label: '🤫 *Suspense absolu...*', emoji: '⬜🎲⬜', delay: 400, steps: 2 },
];

function renderDice(d1, d2) {
  const faces = {
    1: '│ ●   │\n│     │\n│   ● │',
    2: '│ ●   │\n│     │\n│   ● │',
    3: '│ ●   │\n│  ●  │\n│   ● │',
    4: '│ ● ● │\n│     │\n│ ● ● │',
    5: '│ ● ● │\n│  ●  │\n│ ● ● │',
    6: '│ ● ● │\n│ ● ● │\n│ ● ● │',
  };
  const face1 = faces[Math.min(6, Math.max(1, d1))] || faces[1];
  const face2 = faces[Math.min(6, Math.max(1, d2))] || faces[1];
  return [
    '┌─────┐ ┌─────┐',
    face1.split('\n')[0] + ' ' + face2.split('\n')[0],
    face1.split('\n')[1] + ' ' + face2.split('\n')[1],
    face1.split('\n')[2] + ' ' + face2.split('\n')[2],
    '└─────┘ └─────┘',
  ].join('\n');
}

function rollDice() {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function betTypeLabel(type) {
  const labels = {
    pass: '🟢 Pass Line',
    dontpass: '🔴 Don\'t Pass',
    seven: '7️⃣ Any Seven',
    craps: '🎲 Any Craps',
    big6: '6️⃣ Big Six',
    big8: '8️⃣ Big Eight',
  };
  return labels[type] || type;
}

function getPayoutMultiplier(type) {
  const payouts = {
    pass: 2,
    dontpass: 2,
    seven: 4,
    craps: 7,
    big6: 1,
    big8: 1,
  };
  return payouts[type] || 1;
}

function header() {
  return [
    '```',
    '╔══════════════════════════════════╗',
    '║   🎲  CRAPS CASINO  🎲           ║',
    '║      Le Jeu des Dés Légendaire   ║',
    '╚══════════════════════════════════╝',
    '```',
  ].join('\n');
}

function chipDisplay(mise, coin) {
  const chip = mise >= 10000 ? '💎' : mise >= 5000 ? '🔴' : mise >= 1000 ? '🟣' : mise >= 500 ? '🔵' : mise >= 100 ? '🟢' : mise >= 50 ? '🟡' : '⚪';
  return `${chip} **${mise.toLocaleString('fr-FR')} ${coin}**`;
}

// ─── Évaluation des paris ──────────────────────────────────────
function evaluatePassLine(roll, point) {
  const total = roll[0] + roll[1];
  // Come-Out roll (pas encore de point)
  if (point === null) {
    if (total === 7 || total === 11) return { status: 'WIN', message: '🎉 CRAPS NATUREL ! 7 ou 11 !' };
    if (total === 2 || total === 3 || total === 12) return { status: 'LOSE', message: '💸 CRAPS ! 2, 3 ou 12 !' };
    return { status: 'POINT', point: total, message: `📍 Point établi : **${total}**` };
  }
  // Avec un point établi
  if (total === point) return { status: 'WIN', message: `🎉 POINT REFAIT ! ${total}` };
  if (total === 7) return { status: 'LOSE', message: '💸 SEVEN OUT ! 7 !' };
  return { status: 'CONTINUE', message: `Dé lancé : ${total}... continue !` };
}

function evaluateDontPass(roll, point) {
  const total = roll[0] + roll[1];
  // Come-Out roll
  if (point === null) {
    if (total === 7 || total === 11) return { status: 'LOSE', message: '💸 Perdu sur 7 ou 11 !' };
    if (total === 2 || total === 3) return { status: 'WIN', message: '🎉 Craps ! 2 ou 3 !' };
    if (total === 12) return { status: 'PUSH', message: '➖ BAR 12 — Égalité !' };
    return { status: 'POINT', point: total, message: `📍 Point établi : **${total}**` };
  }
  // Avec point
  if (total === 7) return { status: 'WIN', message: `🎉 Seven out ! 7 ! (Don't Pass gagne)` };
  if (total === point) return { status: 'LOSE', message: `💸 Point refait ! ${total}` };
  return { status: 'CONTINUE', message: `Dé lancé : ${total}... continue !` };
}

function evaluateAnySeven(roll) {
  const total = roll[0] + roll[1];
  if (total === 7) return { status: 'WIN', message: '🎉 SEPT ! Vous avez misé juste !' };
  return { status: 'LOSE', message: `💸 ${total} — Pas de 7` };
}

function evaluateAnyCraps(roll) {
  const total = roll[0] + roll[1];
  if (total === 2 || total === 3 || total === 12) return { status: 'WIN', message: `🎉 CRAPS ! ${total}` };
  return { status: 'LOSE', message: `💸 ${total} — Pas de craps` };
}

function evaluateBigSix(roll) {
  const total = roll[0] + roll[1];
  if (total === 6) return { status: 'WIN', message: '🎉 SIX ! Avant le 7 !' };
  if (total === 7) return { status: 'LOSE', message: '💸 SEPT ! Vous avez perdu' };
  return { status: 'CONTINUE', message: `${total}... continue !` };
}

function evaluateBigEight(roll) {
  const total = roll[0] + roll[1];
  if (total === 8) return { status: 'WIN', message: '🎉 HUIT ! Avant le 7 !' };
  if (total === 7) return { status: 'LOSE', message: '💸 SEPT ! Vous avez perdu' };
  return { status: 'CONTINUE', message: `${total}... continue !` };
}

// ─── Jeu principal ─────────────────────────────────────────────
async function playCraps(source, userId, guildId, mise, betType) {
  const isInteraction = !!source.editReply;
  const u = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance?.toLocaleString('fr-FR') || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (mise < 10) {
    const err = '❌ Mise minimale : **10** €.';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const payout = getPayoutMultiplier(betType);
  const maxGain = mise * payout;

  const startDesc = [
    header(),
    `🎩 **Le croupier lance les dés...**`,
    '',
    `**Type de pari :** ${betTypeLabel(betType)}`,
    `**Mise :** ${chipDisplay(mise, coin)}`,
    `**Gain potentiel :** ${maxGain.toLocaleString('fr-FR')} ${coin}`,
    '',
    renderDice(0, 0),
    '',
    '🎲 *Les dés roulent...*',
  ].join('\n');

  const startEmbed = new EmbedBuilder()
    .setColor('#C0392B')
    .setTitle('🎲 Craps Casino')
    .setDescription(startDesc);

  let msg;
  if (isInteraction) msg = await source.editReply({ embeds: [startEmbed] });
  else msg = await source.reply({ embeds: [startEmbed] });

  // ── Animation des dés ──────────────────────────────────────────
  let animStep = 0;
  for (const phase of DICE_PHASES) {
    for (let s = 0; s < phase.steps; s++) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const animDesc = [
        header(),
        `**${phase.label}**`,
        '',
        renderDice(d1, d2),
        '',
        `**Pari :** ${betTypeLabel(betType)} — **Mise :** ${chipDisplay(mise, coin)}`,
      ].join('\n');
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🎲 Craps Casino').setDescription(animDesc)] }).catch(() => {});
      await sleep(phase.delay);
      animStep++;
    }
  }

  // ── Résultat du premier lancé ──────────────────────────────────
  const [d1, d2] = rollDice();
  const total = d1 + d2;

  let outcome, finalGain = 0, won = false, point = null, needsReroll = false;

  if (betType === 'pass') {
    outcome = evaluatePassLine([d1, d2], null);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else if (outcome.status === 'POINT') { point = outcome.point; needsReroll = true; }
  } else if (betType === 'dontpass') {
    outcome = evaluateDontPass([d1, d2], null);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else if (outcome.status === 'PUSH') { db.addCoins(userId, guildId, mise); won = null; }
    else if (outcome.status === 'POINT') { point = outcome.point; needsReroll = true; }
  } else if (betType === 'seven') {
    outcome = evaluateAnySeven([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else { won = false; }
  } else if (betType === 'craps') {
    outcome = evaluateAnyCraps([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else { won = false; }
  } else if (betType === 'big6') {
    outcome = evaluateBigSix([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { needsReroll = true; }
  } else if (betType === 'big8') {
    outcome = evaluateBigEight([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * payout; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { needsReroll = true; }
  }

  // ── Flash révélation ───────────────────────────────────────────
  const revealColor = won ? '#F1C40F' : won === false ? '#C0392B' : '#F39C12';
  const revealEmoji = won ? '🎉' : won === false ? '💸' : '➖';

  const resultDesc = [
    header(),
    `**${revealEmoji} Résultat du lancé : ${d1} + ${d2} = **${total}****`,
    '',
    renderDice(d1, d2),
    '',
    outcome.message,
  ].join('\n');

  await msg.edit({ embeds: [new EmbedBuilder().setColor(revealColor).setTitle(`🎲 ${revealEmoji} CRAPS CASINO`).setDescription(resultDesc)] }).catch(() => {});
  await sleep(600);

  // ── Résultat final ou écran avec bouton "Relancer" ────────────
  if (needsReroll && point) {
    // Pour Pass/Don't Pass/Big Six/Big Eight avec point établi
    const pointDesc = [
      header(),
      `**Point établi : ${point}**`,
      '',
      `Vous aviez lancé : ${d1} + ${d2} = ${total}`,
      renderDice(d1, d2),
      '',
      `📍 Le point est **${point}**. Relancez pour refaire ce nombre !`,
      `(ou faites un 7 pour perdre)`,
      '',
      `**Type de pari :** ${betTypeLabel(betType)}`,
      `**Mise toujours en jeu :** ${chipDisplay(mise, coin)}`,
    ].join('\n');

    const rerollBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`craps_reroll_${userId}_${mise}_${betType}_${point}`)
        .setLabel('🎲 Relancer')
        .setStyle(ButtonStyle.Primary),
    );

    await msg.edit({
      embeds: [new EmbedBuilder().setColor('#2874A6').setTitle('🎲 Point Établi — Craps Casino').setDescription(pointDesc)],
      components: [rerollBtn],
    }).catch(() => {});
    return;
  }

  // ── Affichage final avec résumé ───────────────────────────────
  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const netDiff = finalGain - mise;

  let resultBox, resultTitle;
  if (won === true) {
    resultBox = [
      '```',
      '╔════════════════════════════════════╗',
      '║  🎉  VICTOIRE ! ARGENT EMPOCHE !  🎉  ║',
      `║  +${String((finalGain.toLocaleString('fr-FR')+' '+coin)).padEnd(29)}║`,
      '╚════════════════════════════════════╝',
      '```',
    ].join('\n');
    resultTitle = '🎲 🎉 VICTOIRE — Craps Casino';
  } else if (won === false) {
    resultBox = [
      '```',
      '╔════════════════════════════════════╗',
      '║  ❌  PERDU — La maison gagne !  ❌  ║',
      `║  −${String((mise.toLocaleString('fr-FR')+' '+coin)).padEnd(30)}║`,
      '╚════════════════════════════════════╝',
      '```',
    ].join('\n');
    resultTitle = '🎲 💸 PERDU — Craps Casino';
  } else {
    // Push
    resultBox = [
      '```',
      '╔════════════════════════════════════╗',
      '║  ➖  ÉGALITÉ — Mise retournée  ➖  ║',
      `║  ${String((mise.toLocaleString('fr-FR')+' '+coin)).padEnd(31)}║`,
      '╚════════════════════════════════════╝',
      '```',
    ].join('\n');
    resultTitle = '🎲 ➖ ÉGALITÉ — Craps Casino';
  }

  const finalDesc = [
    header(),
    `**Résultat : ${d1} + ${d2} = ${total}**`,
    '',
    renderDice(d1, d2),
    '',
    resultBox,
    '',
    `**Pari :** ${betTypeLabel(betType)} — **Mise :** ${chipDisplay(mise, coin)}`,
    '',
    `**Solde :** ${newBal.toLocaleString('fr-FR')} ${coin}`,
    won !== null ? `**Différence :** ${netDiff >= 0 ? '+' : ''}${netDiff.toLocaleString('fr-FR')} ${coin}` : '',
  ].join('\n');

  const finalColor = won ? '#27AE60' : won === false ? '#C0392B' : '#7F8C8D';

  const row = makeGameRow('craps', userId, mise, betType);

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor(finalColor)
      .setTitle(resultTitle)
      .setDescription(finalDesc)
      .setFooter({ text: 'Jouez responsable · Mise min : 10 · Craps Casino NexusBot' })
      .setTimestamp()],
    components: [row],
  });
}

// ─── Gestion des roulettes (point relancé) ─────────────────────
async function handleReroll(interaction, userId, mise, betType, point) {
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Ce n\'est pas ton jeu.', ephemeral: true });
  }

  await interaction.deferUpdate();

  const guildId = interaction.guildId;
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  const startDesc = [
    header(),
    `🎩 **Le croupier relance les dés...**`,
    '',
    `**Point :** ${point}`,
    `**Type de pari :** ${betTypeLabel(betType)}`,
    `**Mise :** ${chipDisplay(mise, coin)}`,
    '',
    renderDice(0, 0),
    '',
    '🎲 *Les dés roulent...*',
  ].join('\n');

  const startEmbed = new EmbedBuilder()
    .setColor('#C0392B')
    .setTitle('🎲 Craps Casino — Point Relancé')
    .setDescription(startDesc);

  let msg = interaction.message;
  await msg.edit({ embeds: [startEmbed] }).catch(() => {});

  // ── Animation courte ───────────────────────────────────────────
  const QUICK_PHASES = [
    { label: '🎲 *Les dés partent !*', delay: 100, steps: 3 },
    { label: '💨 *Ralentissement...*', delay: 180, steps: 2 },
    { label: '🤫 *Suspense...*', delay: 400, steps: 2 },
  ];

  for (const phase of QUICK_PHASES) {
    for (let s = 0; s < phase.steps; s++) {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const animDesc = [
        header(),
        `**${phase.label}** (Point: ${point})`,
        '',
        renderDice(d1, d2),
        '',
        `**Pari :** ${betTypeLabel(betType)} — **Mise :** ${chipDisplay(mise, coin)}`,
      ].join('\n');
      await msg.edit({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🎲 Craps Casino').setDescription(animDesc)] }).catch(() => {});
      await sleep(phase.delay);
    }
  }

  // ── Lancé réel ────────────────────────────────────────────────
  const [d1, d2] = rollDice();
  const total = d1 + d2;

  let outcome, finalGain = 0, won = false;

  if (betType === 'pass') {
    outcome = evaluatePassLine([d1, d2], point);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * 2; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { await playCraps(interaction, userId, guildId, mise, betType); return; }
  } else if (betType === 'dontpass') {
    outcome = evaluateDontPass([d1, d2], point);
    if (outcome.status === 'WIN') { won = true; finalGain = mise * 2; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { await playCraps(interaction, userId, guildId, mise, betType); return; }
  } else if (betType === 'big6') {
    outcome = evaluateBigSix([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { await playCraps(interaction, userId, guildId, mise, betType); return; }
  } else if (betType === 'big8') {
    outcome = evaluateBigEight([d1, d2]);
    if (outcome.status === 'WIN') { won = true; finalGain = mise; db.addCoins(userId, guildId, finalGain); }
    else if (outcome.status === 'LOSE') { won = false; }
    else { await playCraps(interaction, userId, guildId, mise, betType); return; }
  }

  // ── Flash révélation ───────────────────────────────────────────
  const revealColor = won ? '#F1C40F' : '#C0392B';
  const revealEmoji = won ? '🎉' : '💸';

  const resultDesc = [
    header(),
    `**${revealEmoji} Lancé : ${d1} + ${d2} = ${total} (Point: ${point})**`,
    '',
    renderDice(d1, d2),
    '',
    outcome.message,
  ].join('\n');

  await msg.edit({ embeds: [new EmbedBuilder().setColor(revealColor).setTitle(`🎲 ${revealEmoji}`).setDescription(resultDesc)] }).catch(() => {});
  await sleep(600);

  // ── Résumé final ───────────────────────────────────────────────
  const newBal = db.getUser(userId, guildId)?.balance || 0;
  const netDiff = finalGain - mise;

  let resultBox, resultTitle;
  if (won) {
    resultBox = [
      '```',
      '╔════════════════════════════════════╗',
      '║  🎉  POINT REFAIT ! VICTOIRE !  🎉  ║',
      `║  +${String((finalGain.toLocaleString('fr-FR')+' '+coin)).padEnd(29)}║`,
      '╚════════════════════════════════════╝',
      '```',
    ].join('\n');
    resultTitle = '🎲 🎉 POINT REFAIT — Craps Casino';
  } else {
    resultBox = [
      '```',
      '╔════════════════════════════════════╗',
      '║  ❌  SEVEN OUT ! PERDU !  ❌  ║',
      `║  −${String((mise.toLocaleString('fr-FR')+' '+coin)).padEnd(30)}║`,
      '╚════════════════════════════════════╝',
      '```',
    ].join('\n');
    resultTitle = '🎲 💸 SEVEN OUT — Craps Casino';
  }

  const finalDesc = [
    header(),
    `**Résultat relancé : ${d1} + ${d2} = ${total}**`,
    `**Point était : ${point}**`,
    '',
    renderDice(d1, d2),
    '',
    resultBox,
    '',
    `**Pari :** ${betTypeLabel(betType)} — **Mise :** ${chipDisplay(mise, coin)}`,
    `**Solde :** ${newBal.toLocaleString('fr-FR')} ${coin}`,
    `**Différence :** ${netDiff >= 0 ? '+' : ''}${netDiff.toLocaleString('fr-FR')} ${coin}`,
  ].join('\n');

  const finalColor = won ? '#27AE60' : '#C0392B';
  const row = makeGameRow('craps', userId, mise, betType);

  await msg.edit({
    embeds: [new EmbedBuilder()
      .setColor(finalColor)
      .setTitle(resultTitle)
      .setDescription(finalDesc)
      .setFooter({ text: 'Jouez responsable · Craps Casino NexusBot' })
      .setTimestamp()],
    components: [row],
  });
}

// ─── Exports ───────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('craps')
    .setDescription('🎲 Craps — Le jeu de dés légendaire des casinos !')
    .addIntegerOption(o => o.setName('mise').setDescription('Montant à miser').setRequired(true).setMinValue(10))
    .addStringOption(o => o.setName('pari').setDescription('Type de pari').setRequired(true)
      .addChoices(
        { name: '🟢 Pass Line (×2) — Classique', value: 'pass' },
        { name: '🔴 Don\'t Pass (×2) — Contre le shooter', value: 'dontpass' },
        { name: '7️⃣ Any Seven (×4) — Parie sur le 7', value: 'seven' },
        { name: '🎲 Any Craps (×7) — Parie sur 2,3,12', value: 'craps' },
        { name: '6️⃣ Big Six (×1) — 6 avant 7', value: 'big6' },
        { name: '8️⃣ Big Eight (×1) — 8 avant 7', value: 'big8' },
      )),

  async handleComponent(interaction, cid) {
    if (cid.startsWith('craps_reroll_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const mise = parseInt(parts[3]);
      const betType = parts[4];
      const point = parseInt(parts[5]);
      await handleReroll(interaction, userId, mise, betType, point);
      return true;
    }

    if (cid.startsWith('craps_replay_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const mise = parseInt(parts[3]);
      const betType = parts[4];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.deferUpdate();
      await playCraps(interaction, userId, interaction.guildId, mise, betType);
      return true;
    }

    if (cid.startsWith('craps_changemise_')) {
      const parts = cid.split('_');
      const userId = parts[2];
      const betType = parts[3];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true }).catch(() => {});
        return true;
      }
      await interaction.showModal(changeMiseModal('craps', userId, betType));
      return true;
    }

    if (cid.startsWith('craps_modal_') && interaction.isModalSubmit()) {
      const parts = cid.split('_');
      const userId = parts[2];
      const betType = parts[3];
      if (interaction.user.id !== userId) {
        await interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
        return true;
      }
      const rawMise = interaction.fields.getTextInputValue('newmise');
      const u = db.getUser(userId, interaction.guildId);
      const newMise = parseMise(rawMise, u?.balance || 0);
      if (!newMise || newMise < 10) {
        return interaction.reply({ content: '❌ Mise invalide (min 10).', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
      await playCraps(interaction, userId, interaction.guildId, newMise, betType);
      return true;
    }

    return false;
  },

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playCraps(interaction, interaction.user.id, interaction.guildId,
      interaction.options.getInteger('mise'), interaction.options.getString('pari'));
  },

  name: 'craps',
  aliases: ['cr', 'dice', 'casino-craps'],
  async run(message, args) {
    const rawMise = (args[0] || '').toLowerCase().trim();
    if (!rawMise) return message.reply('❌ Usage : `&craps <mise> <pari>`\nEx: `&craps 100 pass`');
    const u = db.getUser(message.author.id, message.guildId);
    const bal = u?.balance || 0;
    let mise;
    if (rawMise === 'all' || rawMise === 'tout') mise = bal;
    else if (rawMise.endsWith('%')) mise = Math.floor(bal * Math.min(100, parseFloat(rawMise)) / 100);
    else mise = parseInt(rawMise);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&craps <mise> <pari>` (min 10)');
    const betType = args[1];
    if (!['pass', 'dontpass', 'seven', 'craps', 'big6', 'big8'].includes(betType)) {
      return message.reply('❌ Paris valides : `pass`, `dontpass`, `seven`, `craps`, `big6`, `big8`');
    }
    await playCraps(message, message.author.id, message.guildId, mise, betType);
  },
};
