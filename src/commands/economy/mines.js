/**
 * /mines <mise> [mines] — Démineur casino. Mises ILLIMITÉES.
 * État persisté en BDD → survit aux redémarrages.
 */
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
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
  data: new SlashCommandBuilder()
    .setName('mines')
    .setDescription('💣 Démineur casino — découvre les diamants sans toucher les mines')
    .addStringOption(o => o.setName('mise').setDescription('Ex: 500, 1000, all, 25%').setRequired(true).setMaxLength(20)),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value) : null;
    const mines  = parseInt(interaction.options.getString('mines')) ?? 3;

    const bet = parseBet(raw, user.balance);
    if (bet == null) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise minimum : 1.', ephemeral: true });
    if (bet > BigInt(user.balance)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant (**${user.balance.toLocaleString('fr-FR')}${symbol}**).`, ephemeral: true });

    db.removeCoins(interaction.user.id, interaction.guildId, Number(bet));

    const game = mi.createGame(bet, mines);
    const embedOpts = { symbol, color: cfg.color || '#F39C12', userName: interaction.user.username };

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [mi.buildEmbed(game, embedOpts)],
      components: mi.buildButtons(game),
      fetchReply: true,
    });

    db.saveGameSession(msg.id, interaction.user.id, interaction.guildId, interaction.channelId, 'mines', { state: game, embedOpts }, 1800);
  },
};
