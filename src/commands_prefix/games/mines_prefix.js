/**
 * &mines <mise> [nbMines] — Démineur casino.
 */
const mi = require('../../utils/minesEngine');

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
  name: 'mines',
  aliases: ['demineur', 'mine'],
  description: 'Démineur casino — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async run(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#F39C12';

    if (!args.length) return message.reply('💣 Utilise `&mines <mise> [nb_mines]`. Ex : `&mines 500 3`, `&mines all 5`, `&mines 25%`.');

    const bet = parseBet(args[0], user.balance);
    if (bet == null) return message.reply('❌ Mise invalide.');
    if (bet < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (bet > BigInt(user.balance)) return message.reply(`❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`);

    const mines = parseInt(args[1], 10);
    const nbMines = isNaN(mines) ? 3 : Math.max(1, Math.min(19, mines));

    db.removeCoins(message.author.id, message.guild.id, Number(bet));
    const game = mi.createGame(bet, nbMines);
    const embedOpts = { symbol, color, userName: message.author.username };

    const sent = await message.reply({
      embeds: [mi.buildEmbed(game, embedOpts)],
      components: mi.buildButtons(game),
      allowedMentions: { repliedUser: false },
    });

    db.saveGameSession(sent.id, message.author.id, message.guild.id, message.channel.id, 'mines', { state: game, embedOpts }, 1800);
  },
};
