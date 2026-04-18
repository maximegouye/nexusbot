/**
 * NexusBot — Moteur de Machine à sous partagé (slash + préfixe).
 * Mise ILLIMITÉE (min 1, max = solde).
 *
 * Symboles, poids et multiplicateurs :
 *   🍒 cerise   (poids 30) ×2
 *   🍋 citron   (poids 25) ×3
 *   🍊 orange   (poids 20) ×4
 *   🍇 raisin   (poids 15) ×5
 *   🔔 cloche   (poids 10) ×8
 *   💎 diamant  (poids  5) ×15
 *   7️⃣ seven   (poids  2) ×50
 *
 * Règles de gain :
 *   - 3 identiques : multiplicateur du symbole × mise
 *   - 2 identiques (n'importe où) : ×1.5
 *   - Sinon : perte
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const SYMBOLS = [
  { emoji: '🍒', weight: 30, mult: 2,  name: 'Cerise' },
  { emoji: '🍋', weight: 25, mult: 3,  name: 'Citron' },
  { emoji: '🍊', weight: 20, mult: 4,  name: 'Orange' },
  { emoji: '🍇', weight: 15, mult: 5,  name: 'Raisin' },
  { emoji: '🔔', weight: 10, mult: 8,  name: 'Cloche' },
  { emoji: '💎', weight:  5, mult: 15, name: 'Diamant' },
  { emoji: '7️⃣', weight:  2, mult: 50, name: '7 Chanceux' },
];
const POOL = SYMBOLS.flatMap(s => Array(s.weight).fill(s));

function spinSymbol() { return POOL[Math.floor(Math.random() * POOL.length)]; }

function runRound(mise) {
  const reels = [spinSymbol(), spinSymbol(), spinSymbol()];
  let gainMult = 0;
  let label = '';
  let kind = 'lose';

  if (reels[0].emoji === reels[1].emoji && reels[1].emoji === reels[2].emoji) {
    kind = reels[0].emoji === '7️⃣' ? 'jackpot_ultime' : reels[0].emoji === '💎' ? 'jackpot_diamant' : 'jackpot';
    gainMult = reels[0].mult;
    label = kind === 'jackpot_ultime' ? `🎊 **JACKPOT ULTIME !!** ×${gainMult}` :
            kind === 'jackpot_diamant' ? `💎 **JACKPOT DIAMANT !** ×${gainMult}` :
                                         `🎉 **JACKPOT** ×${gainMult}`;
  } else if (reels[0].emoji === reels[1].emoji || reels[1].emoji === reels[2].emoji || reels[0].emoji === reels[2].emoji) {
    kind = 'small';
    gainMult = 1.5;
    label = `✨ **Deux identiques** ×1.5`;
  } else {
    kind = 'lose';
    gainMult = 0;
    label = `😞 Aucune combinaison — retente !`;
  }
  const gain = Math.floor(mise * gainMult);
  return { reels, gain, gainMult, kind, label };
}

function buildSpinEmbed({ userName, mise, symbol, color }) {
  return new EmbedBuilder()
    .setColor(color || '#9B59B6')
    .setTitle('🎰 La machine s\'active…')
    .setDescription([
      '```',
      '╔═══════════════════╗',
      '║                   ║',
      '║   ❓   ❓   ❓    ║',
      '║                   ║',
      '╚═══════════════════╝',
      '```',
      `Mise de **${userName}** : **${mise.toLocaleString('fr-FR')}${symbol}**`,
    ].join('\n'))
    .setFooter({ text: '🎰 Les rouleaux tournent…' });
}

/**
 * Frame intermédiaire : les rouleaux se fixent progressivement
 * `locked` = nombre de rouleaux déjà fixés (0, 1, 2)
 * Les rouleaux non-fixés affichent un symbole aléatoire (brouillé)
 */
function buildAnimFrame({ userName, mise, symbol, color, locked, finalReels }) {
  const reels = [0, 1, 2].map(i => {
    if (i < locked) return finalReels[i].emoji;
    return spinSymbol().emoji;
  });
  const bars = [0, 1, 2].map(i => i < locked ? '🔒' : '🌀');
  return new EmbedBuilder()
    .setColor(color || '#9B59B6')
    .setTitle('🎰 En cours…')
    .setDescription([
      '```',
      '╔═══════════════════╗',
      `║   ${reels[0]}   ${reels[1]}   ${reels[2]}    ║`,
      '╚═══════════════════╝',
      '```',
      `${bars.join(' ')}   (${locked}/3 verrouillés)`,
      `Mise de **${userName}** : **${mise.toLocaleString('fr-FR')}${symbol}**`,
    ].join('\n'))
    .setFooter({ text: '🎰 Les rouleaux s\'arrêtent un à un…' });
}

function buildResultEmbed({ userName, mise, gain, label, reels, balanceAfter, symbol, color }) {
  const won = gain > 0;
  const net = gain - mise;
  const pickColor = gain > mise ? '#2ECC71' : gain > 0 ? '#F39C12' : '#E74C3C';
  const display = reels.map(r => r.emoji).join('   ');

  return new EmbedBuilder()
    .setColor(pickColor)
    .setTitle(won ? '🎰 Gagné !' : '🎰 Perdu…')
    .setDescription([
      '```',
      '╔═══════════════════╗',
      `║   ${reels[0].emoji}   ${reels[1].emoji}   ${reels[2].emoji}    ║`,
      '╚═══════════════════╝',
      '```',
      label,
    ].join('\n'))
    .addFields(
      { name: '💰 Mise',      value: `**${mise.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: '🏆 Gain',      value: `**${gain.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: net >= 0 ? '📈 Bénéfice' : '📉 Perte', value: `**${net > 0 ? '+' : ''}${net.toLocaleString('fr-FR')}${symbol}**`, inline: true },
      { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`, inline: true },
    )
    .setFooter({ text: userName + ' · 🎰 Machine à sous' })
    .setTimestamp();
}

function buildReplayButtons(mise) {
  const encoded = encodeURIComponent(String(mise));
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`slots_replay:${encoded}`).setLabel('🎰 Rejouer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`slots_double:${encoded}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`slots_half:${encoded}`).setLabel('½ Rejouer moitié').setStyle(ButtonStyle.Secondary),
  );
}

module.exports = { SYMBOLS, runRound, buildSpinEmbed, buildAnimFrame, buildResultEmbed, buildReplayButtons };
