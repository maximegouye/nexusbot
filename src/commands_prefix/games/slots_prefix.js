/**
 * &slots <mise> — Même moteur, même rendu que /slots.
 */
const sl = require('../../utils/slotsEngine');

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
  name: 'slots',
  aliases: ['machine', 'slot'],
  description: 'Machine à sous — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#9B59B6';
    const raw    = args[0];

    if (!raw) return message.reply({ content: '🎰 Utilise `&slots <mise>`. Exemples : `&slots 100`, `&slots all`, `&slots 25%`.' });

    const bet = parseBet(raw, user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`);

    const miseNum = Number(bet);
    db.removeCoins(message.author.id, message.guild.id, miseNum);

    const sent = await message.reply({
      embeds: [sl.buildSpinEmbed({ userName: message.author.username, mise: miseNum, symbol, color })],
      allowedMentions: { repliedUser: false },
    });

    await new Promise(r => setTimeout(r, 1500));

    const { reels, gain, label } = sl.runRound(miseNum);
    if (gain > 0) db.addCoins(message.author.id, message.guild.id, gain);
    const balanceAfter = Math.max(0, user.balance - miseNum + gain);

    await sent.edit({
      embeds: [sl.buildResultEmbed({ userName: message.author.username, mise: miseNum, gain, label, reels, balanceAfter, symbol, color })],
      components: [sl.buildReplayButtons(miseNum)],
    }).catch(() => {});
  },
};
