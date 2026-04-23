/**
 * /crash <mise> <cashout> — Jeu du Crash.
 *
 * Principe :
 *  - Tu mises un montant
 *  - Tu choisis un multiplicateur cible (ex: 2.0, 10.0, 50.0)
 *  - Le bot tire un multiplicateur de "crash" (distribution exponentielle,
 *    edge maison 3%)
 *  - Si crash_point >= ton cashout → tu gagnes mise × cashout
 *  - Sinon → tu perds la mise
 *
 * C'est un jeu mathématique simple (pas de boutons intermédiaires) mais
 * l'animation donne une sensation de tension. Les cashouts élevés donnent
 * gros mais avec forte probabilité de perte.
 */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// Tire un crash point selon distribution exponentielle (edge maison 3%)
// Médiane ~2x, moyenne infinie en théorie
function drawCrashPoint() {
  // 3% de chance de crash immédiat (1.00)
  if (Math.random() < 0.03) return 1.00;
  const r = Math.random();
  // Formule classique : crash = (100 - 3) / (1 - r) / 100
  return Math.max(1.00, (100 - 3) / ((1 - r) * 100));
}

function parseBet(raw, balance) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return BigInt(balance);
  if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return BigInt(Math.floor(balance / 2));
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n < 0) return null;
  if (m[2] === '%') return BigInt(Math.floor(balance * Math.min(100, n) / 100));
  return BigInt(Math.floor(n));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crash')
    .setDescription('📈 Jeu du Crash — vise un multiplicateur, encaisse avant le crash')
    .addStringOption(o => o.setName('mise').setDescription('Ex: 500, 1000, all, 25%').setRequired(true).setMaxLength(20))
    .addNumberOption(o => o.setName('cashout').setDescription('Multiplicateur cible (ex: 2.0, 5.0, 1000, pas de max)').setRequired(true).setMinValue(1.01)),
  cooldown: 3,

  async execute(interaction) {
    const cfg     = db.getConfig(interaction.guildId);
    const user    = db.getUser(interaction.user.id, interaction.guildId);
    const symbol  = cfg.currency_emoji || '€';
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value) : null;
    const cashout = parseFloat(interaction.options.getString('cashout'));

    const bet = parseBet(raw, user.balance);
    if (bet == null) return interaction.editReply({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)    return interaction.editReply({ content: '❌ Mise minimum : 1.', ephemeral: true });
    if (bet > BigInt(user.balance)) return interaction.editReply({ content: `❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`, ephemeral: true });

    const miseNum = Number(bet);
    db.removeCoins(interaction.user.id, interaction.guildId, miseNum);

    const color = cfg.color || '#E67E22';

    // Animation suspense : 3 frames avec multiplicateur qui monte progressivement
    const buildClimb = (mult, label) => new EmbedBuilder().setColor(color)
      .setTitle('📈 Le multiplicateur grimpe…')
      .setDescription([
        '```',
        `  ×${mult.toFixed(2)}`,
        '',
        ('▁'.repeat(Math.max(1, Math.min(20, Math.floor(mult * 2))))) + '🚀',
        '```',
        label,
        '',
        `**${interaction.user.username}** mise **${miseNum.toLocaleString('fr-FR')}${symbol}** · cashout auto à **×${cashout}**`,
      ].join('\n'));

    await interaction.editReply({ embeds: [buildClimb(1.10, '🚀 Décollage…')] });
    await new Promise(r => setTimeout(r, 800));
    await interaction.editReply({ embeds: [buildClimb(1.85, '⚡ Ça monte vite !')] }).catch(() => {});
    await new Promise(r => setTimeout(r, 800));
    await interaction.editReply({ embeds: [buildClimb(3.20, '🔥 Le multi explose !')] }).catch(() => {});
    await new Promise(r => setTimeout(r, 700));

    const crashPoint = drawCrashPoint();
    const won = crashPoint >= cashout;
    const gain = won ? Math.floor(miseNum * cashout) : 0;
    if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);
    const balanceAfter = Math.max(0, user.balance - miseNum + gain);

    const barLen = Math.min(20, Math.floor(crashPoint * 2));
    const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));

    const embed = new EmbedBuilder()
      .setColor(won ? '#2ECC71' : '#E74C3C')
      .setTitle(won ? `📈 CASHED OUT ×${cashout.toFixed(2)} !` : `💥 CRASH à ×${crashPoint.toFixed(2)}`)
      .setDescription(
        won
          ? `🎉 Ton cashout à **×${cashout}** a été atteint ! Le multi est allé jusqu'à **×${crashPoint.toFixed(2)}**.\n\n\`${bar}\` ×${crashPoint.toFixed(2)}`
          : `💥 Le multi a crashé à **×${crashPoint.toFixed(2)}** AVANT ton cashout (×${cashout}). Perte totale.\n\n\`${bar}\` ×${crashPoint.toFixed(2)}`
      )
      .addFields(
        { name: '💰 Mise',    value: `${miseNum.toLocaleString('fr-FR')}${symbol}`, inline: true },
        { name: '🎯 Cashout', value: `×${cashout.toFixed(2)}`,                       inline: true },
        { name: '💥 Crash',   value: `×${crashPoint.toFixed(2)}`,                    inline: true },
        won
          ? { name: '💵 Gain net', value: `**+${(gain - miseNum).toLocaleString('fr-FR')}${symbol}**`, inline: true }
          : { name: '💸 Perte',    value: `**-${miseNum.toLocaleString('fr-FR')}${symbol}**`,          inline: true },
        { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`,      inline: true },
      )
      .setFooter({ text: '📈 Crash · plus le cashout est élevé, plus c\'est risqué' })
      .setTimestamp();

    const encoded = encodeURIComponent(`${miseNum}:${cashout}`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_replay:${encoded}`).setLabel('📈 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`crash_double:${encoded}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
