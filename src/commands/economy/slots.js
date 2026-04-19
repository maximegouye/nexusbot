/**
 * /slots [mise] — Machine à sous CASINO interactive.
 * Ouvre un panneau avec ajustement de mise, spin, HOLD, respin, auto-spin,
 * gamble feature et paytable. L'ancienne version en one-shot est conservée
 * via /slots_fast pour le mode rapide.
 */
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
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
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 Machine à sous Vegas Royale — interactive avec HOLD, Auto-spin, Gamble')
    .addStringOption(o => o.setName('mise').setDescription('Mise initiale (défaut: 100) — ILLIMITÉE').setMaxLength(30)),
  cooldown: 2,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const color  = cfg.color || '#FFD700';

    const miseRaw = interaction.options.getString('mise');
    const mise = Math.min(parseBet(miseRaw, user.balance), Math.max(1, user.balance));

    // Persistance de la session via guild_kv (survit aux redémarrages Railway)
    const sessionKey = `cslot:${interaction.user.id}`;
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
    try {
      db.kvSet(interaction.guildId, sessionKey, initState);
    } catch (e) { console.error('[cslot] init session:', e); }

    return interaction.reply({
      embeds: [cm.buildMenuEmbed({
        userName: interaction.user.username,
        mise,
        balance: user.balance,
        symbol,
        color,
        freeSpins: 0,
        session: initState.session,
      })],
      components: cm.buildMenuButtons(interaction.user.id, mise, 0),
    });
  },
};
