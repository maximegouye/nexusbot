/**
 * NexusBot — Moteur de Roulette (européenne, un seul 0) partagé.
 *
 * Types de paris supportés :
 *   rouge / noir / pair / impair          → ×2
 *   manque (1-18) / passe (19-36)          → ×2
 *   douzaine_1 (1-12) / douzaine_2 (13-24) / douzaine_3 (25-36) → ×3
 *   colonne_1 / colonne_2 / colonne_3      → ×3
 *   numero:<n>                              → ×35
 *   pair_plein:<a>,<b>                      → ×17 (deux numéros adjacents)
 *
 * Mise ILLIMITÉE (min 1, max = solde).
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const ROUGES = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const COL_1  = [1,4,7,10,13,16,19,22,25,28,31,34];
const COL_2  = [2,5,8,11,14,17,20,23,26,29,32,35];
const COL_3  = [3,6,9,12,15,18,21,24,27,30,33,36];

function emojiFor(n) {
  if (n === 0) return '🟢';
  return ROUGES.includes(n) ? '🔴' : '⚫';
}

function spin() { return Math.floor(Math.random() * 37); } // 0..36

function checkWin(bet, result) {
  const { type, param } = bet;
  const isRouge  = ROUGES.includes(result);
  const isNoir   = result > 0 && !isRouge;
  switch (type) {
    case 'rouge':       return { won: isRouge,                              mult: 2 };
    case 'noir':        return { won: isNoir,                               mult: 2 };
    case 'pair':        return { won: result > 0 && result % 2 === 0,       mult: 2 };
    case 'impair':      return { won: result > 0 && result % 2 === 1,       mult: 2 };
    case 'manque':      return { won: result >= 1  && result <= 18,         mult: 2 };
    case 'passe':       return { won: result >= 19 && result <= 36,         mult: 2 };
    case 'douzaine_1':  return { won: result >= 1  && result <= 12,         mult: 3 };
    case 'douzaine_2':  return { won: result >= 13 && result <= 24,         mult: 3 };
    case 'douzaine_3':  return { won: result >= 25 && result <= 36,         mult: 3 };
    case 'colonne_1':   return { won: COL_1.includes(result),               mult: 3 };
    case 'colonne_2':   return { won: COL_2.includes(result),               mult: 3 };
    case 'colonne_3':   return { won: COL_3.includes(result),               mult: 3 };
    case 'numero':      return { won: result === parseInt(param, 10),       mult: 36 };
    default:            return { won: false, mult: 0 };
  }
}

const PARI_LABELS = {
  rouge:      '🔴 Rouge',
  noir:       '⚫ Noir',
  pair:       '🔢 Pair',
  impair:     '🔢 Impair',
  manque:     '1️⃣ Manque (1–18)',
  passe:      '2️⃣ Passe (19–36)',
  douzaine_1: '🎯 1ère douzaine (1–12)',
  douzaine_2: '🎯 2ème douzaine (13–24)',
  douzaine_3: '🎯 3ème douzaine (25–36)',
  colonne_1:  '📊 1ère colonne',
  colonne_2:  '📊 2ème colonne',
  colonne_3:  '📊 3ème colonne',
  numero:     '🟢 Numéro plein',
};

function buildSpinningEmbed({ userName, bet, mise, symbol, color }) {
  return new EmbedBuilder()
    .setColor(color || '#9B59B6')
    .setTitle('🎡 La roulette tourne…')
    .setDescription(`🔄 La bille roule…\n\n**${userName}** mise **${mise.toLocaleString('fr-FR')}${symbol}** sur **${labelFor(bet)}**`)
    .setFooter({ text: 'Résultat dans un instant…' });
}

function buildResultEmbed({ userName, bet, mise, symbol, color, result, won, mult, delta, balanceAfter }) {
  const resultEmoji = emojiFor(result);
  const winColor = won ? '#2ECC71' : '#E74C3C';
  const eb = new EmbedBuilder()
    .setColor(won ? winColor : '#E74C3C')
    .setTitle(won ? '🎉 GAGNÉ !' : '💥 Perdu…')
    .setDescription(`La bille s'est arrêtée sur **${resultEmoji} ${result}** !`)
    .addFields(
      { name: '🎯 Pari',          value: labelFor(bet),                                         inline: true },
      { name: '💰 Mise',          value: `${mise.toLocaleString('fr-FR')}${symbol}`,            inline: true },
      { name: '✖️ Multiplicateur', value: `×${mult}`,                                            inline: true },
      won
        ? { name: '💵 Gain net',  value: `**+${delta.toLocaleString('fr-FR')}${symbol}**`,      inline: true }
        : { name: '💸 Perte',     value: `**-${mise.toLocaleString('fr-FR')}${symbol}**`,       inline: true },
      { name: `${symbol} Solde`,  value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
    )
    .setFooter({ text: won ? '🎡 Rejoue si tu te sens en veine !' : 'La chance tourne… retente !' })
    .setTimestamp();
  return eb;
}

function labelFor(bet) {
  if (bet.type === 'numero') return `🟢 Numéro ${bet.param}`;
  return PARI_LABELS[bet.type] || bet.type;
}

function buildReplayButtons(bet, mise) {
  const encoded = encodeURIComponent(`${bet.type}:${bet.param ?? ''}:${mise}`);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`roulette_replay:${encoded}`).setLabel('🎡 Rejouer même pari').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`roulette_double:${encoded}`).setLabel('✖️ Rejouer ×2 (si tu oses)').setStyle(ButtonStyle.Success),
  );
}

// Menu de choix pour /roulette sans pari direct
function buildChoiceMenu(mise) {
  const base = encodeURIComponent(String(mise));
  const select = new StringSelectMenuBuilder()
    .setCustomId(`roulette_pick:${base}`)
    .setPlaceholder('🎯 Choisis ton pari')
    .addOptions([
      { label: '🔴 Rouge (×2)',            value: 'rouge' },
      { label: '⚫ Noir (×2)',              value: 'noir' },
      { label: '🔢 Pair (×2)',              value: 'pair' },
      { label: '🔢 Impair (×2)',            value: 'impair' },
      { label: '1️⃣ Manque 1–18 (×2)',      value: 'manque' },
      { label: '2️⃣ Passe 19–36 (×2)',      value: 'passe' },
      { label: '🎯 1ère douzaine (×3)',     value: 'douzaine_1' },
      { label: '🎯 2ème douzaine (×3)',     value: 'douzaine_2' },
      { label: '🎯 3ème douzaine (×3)',     value: 'douzaine_3' },
      { label: '📊 1ère colonne (×3)',      value: 'colonne_1' },
      { label: '📊 2ème colonne (×3)',      value: 'colonne_2' },
      { label: '📊 3ème colonne (×3)',      value: 'colonne_3' },
    ]);
  return new ActionRowBuilder().addComponents(select);
}

module.exports = {
  spin, checkWin, emojiFor, labelFor,
  buildSpinningEmbed, buildResultEmbed, buildReplayButtons, buildChoiceMenu,
  PARI_LABELS,
};
