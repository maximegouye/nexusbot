/**
 * &poker <mise> — Video Poker "Jacks or Better".
 */
const pk = require('../../utils/pokerEngine');

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
  name: 'poker',
  aliases: ['videopoker', 'vp'],
  description: 'Video Poker Jacks or Better — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#9B59B6';

    if (!args[0]) return message.reply('🎴 Utilise `&poker <mise>`. Ex : `&poker 500`, `&poker all`, `&poker 25%`.');

    const bet = parseBet(args[0], user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`);

    db.removeCoins(message.author.id, message.guild.id, Number(bet));
    const game = pk.startGame(bet);
    const embedOpts = { symbol, color, userName: message.author.username };

    const sent = await message.reply({
      embeds: [pk.buildEmbed(game, embedOpts)],
      components: pk.buildButtons(game),
      allowedMentions: { repliedUser: false },
    });

    db.saveGameSession(sent.id, message.author.id, message.guild.id, message.channel.id, 'poker', { state: pk.serialize(game), embedOpts }, 1800);
  },
};
