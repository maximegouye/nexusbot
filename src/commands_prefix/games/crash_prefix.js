/**
 * &crash <mise> <cashout> — Même logique que /crash.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function drawCrashPoint() {
  if (Math.random() < 0.03) return 1.00;
  const r = Math.random();
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
  name: 'crash',
  aliases: ['boom'],
  description: 'Jeu du Crash — vise un multi, encaisse avant le crash',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#E67E22';

    if (args.length < 2) return message.reply('📈 Utilise `&crash <mise> <cashout>`. Ex : `&crash 500 2.5`, `&crash all 10`, `&crash 100 100`.');

    const bet = parseBet(args[0], user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`);

    const cashout = parseFloat(args[1]);
    if (isNaN(cashout) || cashout < 1.01) return message.reply('❌ Cashout invalide (minimum 1.01, pas de max).');

    const miseNum = Number(bet);
    db.removeCoins(message.author.id, message.guild.id, miseNum);

    const sent = await message.reply({
      embeds: [new EmbedBuilder().setColor(color).setTitle('📈 Le multiplicateur grimpe…')
        .setDescription(`🚀 ×1.00 — 1.50 — 2.00 …\n\nMise **${miseNum.toLocaleString('fr-FR')}${symbol}** · cashout auto à **×${cashout}**`)
      ],
      allowedMentions: { repliedUser: false },
    });

    await new Promise(r => setTimeout(r, 2200));

    const crashPoint = drawCrashPoint();
    const won = crashPoint >= cashout;
    const gain = won ? Math.floor(miseNum * cashout) : 0;
    if (gain > 0) db.addCoins(message.author.id, message.guild.id, gain);
    const balanceAfter = Math.max(0, user.balance - miseNum + gain);

    const barLen = Math.min(20, Math.floor(crashPoint * 2));
    const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 20 - barLen));

    const embed = new EmbedBuilder()
      .setColor(won ? '#2ECC71' : '#E74C3C')
      .setTitle(won ? `📈 CASHED OUT ×${cashout.toFixed(2)} !` : `💥 CRASH à ×${crashPoint.toFixed(2)}`)
      .setDescription(won
        ? `🎉 Cashout ×${cashout} atteint ! Le multi est monté jusqu'à **×${crashPoint.toFixed(2)}**.\n\n\`${bar}\` ×${crashPoint.toFixed(2)}`
        : `💥 Crash à **×${crashPoint.toFixed(2)}** avant ton cashout (×${cashout}). Perte totale.\n\n\`${bar}\` ×${crashPoint.toFixed(2)}`)
      .addFields(
        { name: '💰 Mise',    value: `${miseNum.toLocaleString('fr-FR')}${symbol}`, inline: true },
        { name: '🎯 Cashout', value: `×${cashout.toFixed(2)}`,                       inline: true },
        { name: '💥 Crash',   value: `×${crashPoint.toFixed(2)}`,                    inline: true },
        won
          ? { name: '💵 Gain net', value: `**+${(gain - miseNum).toLocaleString('fr-FR')}${symbol}**`, inline: true }
          : { name: '💸 Perte',    value: `**-${miseNum.toLocaleString('fr-FR')}${symbol}**`,          inline: true },
        { name: `${symbol} Solde`, value: `**${balanceAfter.toLocaleString('fr-FR')}${symbol}**`,      inline: true },
      )
      .setFooter({ text: '📈 Crash · plus le cashout est haut, plus c\'est risqué' })
      .setTimestamp();

    const encoded = encodeURIComponent(`${miseNum}:${cashout}`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_replay:${encoded}`).setLabel('📈 Rejouer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`crash_double:${encoded}`).setLabel('✖️ Rejouer ×2').setStyle(ButtonStyle.Success),
    );

    await sent.edit({ embeds: [embed], components: [row] }).catch(() => {});
  },
};
