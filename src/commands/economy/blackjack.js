/**
 * /blackjack <mise> — Version premium FR, mises ILLIMITÉES (min 1, max = solde).
 */
const { SlashCommandBuilder, ComponentType } = require('discord.js');
const db = require('../../database/db');
const bj = require('../../utils/blackjackEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('♠♥ Blackjack — mise ce que tu veux (pas de limite)')
    .addStringOption(o =>
      o.setName('mise')
       .setDescription('Montant misé (ex: 500, 1000, all, 50%)')
       .setRequired(true)
       .setMaxLength(20)
    ),
  cooldown: 3,

  async execute(interaction) {
    const cfg    = db.getConfig(interaction.guildId);
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const raw    = interaction.options.getString('mise').trim().toLowerCase();

    const bet = parseBet(raw, user.balance);
    if (bet == null)       return interaction.reply({ content: '❌ Mise invalide. Essaie un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
    if (bet < 1n)          return interaction.reply({ content: '❌ La mise doit être d\'au moins **1**.', ephemeral: true });
    if (bet > BigInt(user.balance)) return interaction.reply({ content: `❌ Tu n'as que **${user.balance.toLocaleString('fr-FR')}${symbol}** en poche.`, ephemeral: true });

    // On prélève la mise
    db.removeCoins(interaction.user.id, interaction.guildId, Number(bet));
    const balanceAfter = BigInt(user.balance) - bet;

    const { game, immediateFinish } = bj.startGame({ bet, balance: balanceAfter });
    const embedOpts = { symbol, color: cfg.color || '#FFD700', userName: interaction.user.username };

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(interaction.user.id, interaction.guildId, Number(game.payout));
      return interaction.reply({ embeds: [bj.buildEmbed(game, embedOpts)] });
    }

    const msg = await interaction.reply({
      embeds: [bj.buildEmbed(game, embedOpts)],
      components: [bj.buildButtons(game)],
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60_000,
      filter: i => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (btn) => {
      if (game.over) return btn.reply({ content: '❌ Cette partie est terminée.', ephemeral: true });
      try {
        switch (btn.customId) {
          case 'bj_hit':        bj.playerHit(game); break;
          case 'bj_stand':      bj.playerStand(game); break;
          case 'bj_double': {
            // Vérifie que le solde permet de doubler
            const cur = db.getUser(interaction.user.id, interaction.guildId);
            if (BigInt(cur.balance) < game.bet) { await btn.reply({ content: '❌ Solde insuffisant pour doubler.', ephemeral: true }); return; }
            db.removeCoins(interaction.user.id, interaction.guildId, Number(game.bet));
            bj.playerDouble(game);
            break;
          }
          case 'bj_surrender':  bj.playerSurrender(game); break;
          case 'bj_insurance': {
            const cur = db.getUser(interaction.user.id, interaction.guildId);
            const insAmount = game.bet / 2n;
            if (BigInt(cur.balance) < insAmount) { await btn.reply({ content: '❌ Solde insuffisant pour l\'assurance.', ephemeral: true }); return; }
            db.removeCoins(interaction.user.id, interaction.guildId, Number(insAmount));
            bj.playerInsure(game);
            break;
          }
        }
        await btn.update({
          embeds: [bj.buildEmbed(game, embedOpts)],
          components: game.over ? [] : [bj.buildButtons(game)],
        });
        if (game.over) {
          if (game.payout > 0n) db.addCoins(interaction.user.id, interaction.guildId, Number(game.payout));
          collector.stop();
        }
      } catch (e) {
        console.error('[BLACKJACK]', e);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time' && !game.over) {
        // Timeout → rembourser la mise
        db.addCoins(interaction.user.id, interaction.guildId, Number(game.bet));
        game.message = '⏱️ Temps écoulé — mise remboursée.';
        game.over = true;
        await msg.edit({ embeds: [bj.buildEmbed(game, embedOpts)], components: [] }).catch(() => {});
      }
    });
  },
};

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
