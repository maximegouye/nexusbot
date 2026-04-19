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
    if (bet == null)                return interaction.reply({ content: '❌ Mise invalide.', ephemeral: true });
    if (bet < 1n)                   return interaction.reply({ content: '❌ La mise doit être d\'au moins **1**.', ephemeral: true });
    if (bet > BigInt(user.balance)) return interaction.reply({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`, ephemeral: true });

    db.removeCoins(interaction.user.id, interaction.guildId, Number(bet), {
      type: 'game_loss',
      note: `Mise blackjack ${Number(bet).toLocaleString('fr-FR')}${symbol}`,
      meta: { game: 'blackjack', bet: Number(bet) },
    });
    const balanceAfter = BigInt(user.balance) - bet;

    const { game, immediateFinish } = bj.startGame({ bet, balance: balanceAfter });
    const embedOpts = { symbol, color: cfg.color || '#FFD700', userName: interaction.user.username };

    // ── Animation de distribution : révèle les cartes progressivement ──
    // 1. Écran initial : aucune carte
    const { EmbedBuilder } = require('discord.js');
    const dealEmbed = (step, hide = []) => new EmbedBuilder()
      .setColor(cfg.color || '#FFD700')
      .setTitle('♠️ Blackjack — Distribution…')
      .setDescription([
        '```',
        '╔══════════════════════════════╗',
        `║  Le croupier distribue…      ║`,
        '╚══════════════════════════════╝',
        '```',
        `🎰 **${interaction.user.username}** · mise : **${Number(bet).toLocaleString('fr-FR')}${symbol}**`,
        '',
        step >= 1 ? `🂠 **Toi** : ${bj.formatCard(game.playerHands[0].cards[0])}` : '🂠 **Toi** : …',
        step >= 2 ? `🂠 **Croupier** : ${bj.formatCard(game.dealer[0])}` : '🂠 **Croupier** : …',
        step >= 3 ? `🂠 **Toi** : ${bj.formatCard(game.playerHands[0].cards[0])} ${bj.formatCard(game.playerHands[0].cards[1])}` : '',
        step >= 4 ? `🂠 **Croupier** : ${bj.formatCard(game.dealer[0])} 🂠` : '',
      ].filter(Boolean).join('\n'))
      .setFooter({ text: 'Distribution des cartes…' });

    await interaction.reply({ embeds: [dealEmbed(0)], fetchReply: true });
    await new Promise(r => setTimeout(r, 350));
    await interaction.editReply({ embeds: [dealEmbed(1)] }).catch(() => {});
    await new Promise(r => setTimeout(r, 380));
    await interaction.editReply({ embeds: [dealEmbed(2)] }).catch(() => {});
    await new Promise(r => setTimeout(r, 380));
    await interaction.editReply({ embeds: [dealEmbed(3)] }).catch(() => {});
    await new Promise(r => setTimeout(r, 380));
    await interaction.editReply({ embeds: [dealEmbed(4)] }).catch(() => {});
    await new Promise(r => setTimeout(r, 450));

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(interaction.user.id, interaction.guildId, Number(game.payout), {
        type: 'game_win',
        note: `Blackjack naturel · gain ${Number(game.payout).toLocaleString('fr-FR')}${symbol}`,
        meta: { game: 'blackjack', payout: Number(game.payout) },
      });
      return interaction.editReply({ embeds: [bj.buildEmbed(game, embedOpts)], components: [] }).catch(() => {});
    }

    const msg = await interaction.editReply({
      embeds: [bj.buildEmbed(game, embedOpts)],
      components: [bj.buildButtons(game)],
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
