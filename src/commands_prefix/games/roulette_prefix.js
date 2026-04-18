/**
 * &roulette <mise> [pari] [numero] — Même moteur, même rendu que /roulette.
 *
 * Exemples :
 *   &roulette 500 rouge
 *   &roulette all noir
 *   &roulette 25% douzaine_2
 *   &roulette 1000 numero 17
 */
const r = require('../../utils/rouletteEngine');

function parseBet(raw, balance) {
  if (!raw) return null;
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return BigInt(balance);
  if (s === 'moitié' || s === 'moitie' || s === '50%' || s === 'half') return BigInt(Math.floor(balance / 2));
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!isFinite(n) || n < 0) return null;
  if (m[2] === '%') return BigInt(Math.floor(balance * Math.min(100, n) / 100));
  return BigInt(Math.floor(n));
}

const TYPES_VALIDES = new Set([
  'rouge','noir','pair','impair','manque','passe',
  'douzaine_1','douzaine_2','douzaine_3',
  'colonne_1','colonne_2','colonne_3',
  'numero',
]);

module.exports = {
  name: 'roulette',
  aliases: ['roul', 'casino'],
  description: 'Roulette casino — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#9B59B6';

    if (!args.length) {
      return message.reply({ content:
        `🎡 **Usage :** \`&roulette <mise> [pari] [numéro]\`\n\n` +
        `**Paris possibles :** rouge, noir, pair, impair, manque, passe, douzaine_1/2/3, colonne_1/2/3, numero\n\n` +
        `**Exemples :**\n` +
        `• \`&roulette 500 rouge\`\n` +
        `• \`&roulette all noir\`\n` +
        `• \`&roulette 25% douzaine_2\`\n` +
        `• \`&roulette 1000 numero 17\``
      });
    }

    const mise = parseBet(args[0], user.balance);
    if (mise == null) return message.reply('❌ Mise invalide.');
    if (mise < 1n)    return message.reply('❌ Mise minimum : 1.');
    if (mise > BigInt(user.balance)) return message.reply(`❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`);

    let pariType = (args[1] || '').toLowerCase();
    let param    = null;

    if (pariType && !TYPES_VALIDES.has(pariType)) {
      return message.reply(`❌ Pari invalide \`${pariType}\`. Utilise : rouge, noir, pair, impair, manque, passe, douzaine_1, douzaine_2, douzaine_3, colonne_1, colonne_2, colonne_3, numero`);
    }

    if (pariType === 'numero') {
      const n = parseInt(args[2], 10);
      if (isNaN(n) || n < 0 || n > 36) return message.reply('❌ Pour `numero`, précise un chiffre entre 0 et 36.');
      param = n;
    }

    if (!pariType) {
      return message.reply({
        content: `🎡 Tu mises **${mise.toLocaleString('fr-FR')}${symbol}**. Choisis ton pari dans le menu ci-dessous.`,
        components: [r.buildChoiceMenu(Number(mise))],
      });
    }

    // Prélèvement
    db.removeCoins(message.author.id, message.guild.id, Number(mise));

    // Animation
    const spinMsg = await message.reply({
      embeds: [r.buildSpinningEmbed({ userName: message.author.username, bet: { type: pariType, param }, mise: Number(mise), symbol, color })],
      allowedMentions: { repliedUser: false },
    });

    await new Promise(res => setTimeout(res, 2000));

    // Résultat
    const result = r.spin();
    const { won, mult } = r.checkWin({ type: pariType, param }, result);
    const miseNum = Number(mise);
    const delta = won ? miseNum * (mult - 1) : 0;
    if (won) db.addCoins(message.author.id, message.guild.id, miseNum * mult);
    const balanceAfter = won ? user.balance - miseNum + miseNum * mult : user.balance - miseNum;

    await spinMsg.edit({
      embeds: [r.buildResultEmbed({
        userName: message.author.username,
        bet: { type: pariType, param },
        mise: miseNum, symbol, color, result, won, mult, delta,
        balanceAfter: Math.max(0, balanceAfter),
      })],
      components: [r.buildReplayButtons({ type: pariType, param }, miseNum)],
    }).catch(() => {});
  },
};
