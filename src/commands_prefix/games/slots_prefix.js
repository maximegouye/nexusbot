/**
 * &slots [mise] — Ouvre la machine à sous Vegas Royale interactive.
 * Même expérience que /slots : ajustement mise, HOLD, auto-spin, gamble.
 */
const cm = require('../../utils/casinoMachine');

function parseBet(raw, balance) {
  if (!raw) return 100;
  const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
  if (s === 'all' || s === 'tout' || s === 'max') return Math.max(1, Number(balance || 0));
  if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.max(1, Math.floor(Number(balance || 0) / 2));
  const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
  if (!m) return 100;
  const n = parseFloat(m[1]);
  if (m[2] === '%') return Math.max(1, Math.floor((n / 100) * Number(balance || 0)));
  return Math.max(1, Math.floor(n));
}

module.exports = {
  name: 'slots',
  aliases: ['machine', 'slot', 'casino_slots'],
  description: 'Machine à sous Vegas Royale — interactive, HOLD, auto-spin, gamble',
  category: 'Jeux',
  cooldown: 2,

  async run(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#FFD700';

    const mise = Math.min(parseBet(args[0], user.balance), Math.max(1, user.balance));

    const sessionKey = `cslot:${message.author.id}`;
    const initState = {
      mise,
      freeSpins: 0,
      held: [false, false, false, false, false],
      lastGrid: null,
      lastResult: null,
      canRespin: false,
      lastGain: 0,
      session: { spins: 0, totalBet: 0, totalWon: 0, biggest: 0 },
    };
    try { db.kvSet(message.guild.id, sessionKey, initState); } catch {}

    return message.reply({
      embeds: [cm.buildMenuEmbed({
        userName: message.author.username,
        mise, balance: user.balance, symbol, color,
        freeSpins: 0, session: initState.session,
      })],
      components: cm.buildMenuButtons(message.author.id, mise, 0),
      allowedMentions: { repliedUser: false },
    });
  },
};
