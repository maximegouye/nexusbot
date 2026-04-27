/**
 * &blackjack <mise> — Même logique persistée que /blackjack.
 */
const bj = require('../../utils/blackjackEngine');

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
  name: 'blackjack',
  aliases: ['bj', '21'],
  description: 'Blackjack — mise illimitée, état persisté',
  category: 'Jeux',
  cooldown: 3,

  async run(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const raw    = (args[0] || '').trim();
    if (!raw) return message.reply({ content: '💡 Utilise `&blackjack <mise>`. Exemples : `&bj 500`, `&bj all`, `&bj 25%`.' });

    const bet = parseBet(raw, user.balance);
    if (bet == null)                return message.reply({ content: '❌ Mise invalide.' });
    if (bet < 1n)                   return message.reply({ content: '❌ La mise doit être d\'au moins **1**.' });
    if (bet > BigInt(user.balance)) return message.reply({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.` });

    db.removeCoins(message.author.id, message.guild.id, Number(bet));
    const balanceAfter = BigInt(user.balance) - bet;

    const { game, immediateFinish } = bj.startGame({ bet, balance: balanceAfter });
    const embedOpts = { symbol, color: cfg.color || '#FFD700', userName: message.author.username };

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(message.author.id, message.guild.id, Number(game.payout));
      return message.reply({ embeds: [bj.buildEmbed(game, embedOpts)], allowedMentions: { repliedUser: false } });
    }

    const sent = await message.reply({
      embeds: [bj.buildEmbed(game, embedOpts)],
      components: [bj.buildButtons(game)],
      allowedMentions: { repliedUser: false },
    });

    // Persiste la session (30 min, survit au redémarrage)
    db.saveGameSession(
      sent.id,
      message.author.id,
      message.guild.id,
      message.channel.id,
      'blackjack',
      { state: bj.serialize(game), embedOpts },
      1800
    );
  },
};
