/**
 * /blackjack <mise> — Mises ILLIMITÉES, état persisté en BDD.
 *
 * L'état de la partie est sauvegardé dans game_sessions → survit aux
 * redémarrages Railway. Les boutons sont gérés globalement par
 * interactionCreate.js (pas par un collector en mémoire).
 */
const { SlashCommandBuilder } = require('discord.js');
const db = require('../../database/db');
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
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('♠♥ Blackjack — mise ce que tu veux (pas de limite)')
    .addStringOption(o => o.setName('mise').setDescription('Ex: 500, 1000, all, 50%').setRequired(true).setMaxLength(20)),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const miseRaw = interaction.options.get('mise');
    const raw     = miseRaw ? String(miseRaw.value).trim().toLowerCase() : '';

    const bet = parseBet(raw, user.balance);
    if (bet == null)                return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)                   return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ La mise doit être d\'au moins **1**.', ephemeral: true });
    if (bet > BigInt(user.balance)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`, ephemeral: true });

    db.removeCoins(interaction.user.id, interaction.guildId, Number(bet));
    const balanceAfter = BigInt(user.balance) - bet;

    const { game, immediateFinish } = bj.startGame({ bet, balance: balanceAfter });
    const embedOpts = { symbol, color: cfg.color || '#FFD700', userName: interaction.user.username };

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(interaction.user.id, interaction.guildId, Number(game.payout));
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [bj.buildEmbed(game, embedOpts)] });
    }

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [bj.buildEmbed(game, embedOpts)],
      components: [bj.buildButtons(game)],
      fetchReply: true,
    });

    // Persiste la session en BDD (TTL 30 min) → survit au redémarrage
    db.saveGameSession(
      msg.id,
      interaction.user.id,
      interaction.guildId,
      interaction.channelId,
      'blackjack',
      { state: bj.serialize(game), embedOpts },
      1800
    );
  },
};
