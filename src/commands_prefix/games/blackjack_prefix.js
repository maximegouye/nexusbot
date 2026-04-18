/**
 * &blackjack <mise> — Même moteur que le slash, même rendu, même qualité.
 * Accepte nombres, `all`, `tout`, `moitié`, `50%`.
 */
const { ComponentType } = require('discord.js');
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
  description: 'Blackjack — mise illimitée',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args, client, db) {
    const cfg    = db.getConfig(message.guild.id);
    const user   = db.getUser(message.author.id, message.guild.id);
    const symbol = cfg.currency_emoji || '€';
    const raw    = (args[0] || '').trim();
    if (!raw) return message.reply({ content: `💡 Utilise \`${'&blackjack <mise>'}\`. Exemples : \`&blackjack 500\`, \`&blackjack all\`, \`&blackjack 25%\`.` });

    const bet = parseBet(raw, user.balance);
    if (bet == null)              return message.reply({ content: '❌ Mise invalide.' });
    if (bet < 1n)                 return message.reply({ content: '❌ La mise doit être d\'au moins **1**.' });
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

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 5 * 60_000,
      filter: i => i.user.id === message.author.id,
    });

    collector.on('collect', async (btn) => {
      if (game.over) return btn.reply({ content: '❌ Partie terminée.', ephemeral: true });
      try {
        switch (btn.customId) {
          case 'bj_hit':       bj.playerHit(game); break;
          case 'bj_stand':     bj.playerStand(game); break;
          case 'bj_double': {
            const cur = db.getUser(message.author.id, message.guild.id);
            if (BigInt(cur.balance) < game.bet) { await btn.reply({ content: '❌ Solde insuffisant pour doubler.', ephemeral: true }); return; }
            db.removeCoins(message.author.id, message.guild.id, Number(game.bet));
            bj.playerDouble(game); break;
          }
          case 'bj_surrender': bj.playerSurrender(game); break;
          case 'bj_insurance': {
            const cur = db.getUser(message.author.id, message.guild.id);
            const insAmount = game.bet / 2n;
            if (BigInt(cur.balance) < insAmount) { await btn.reply({ content: '❌ Solde insuffisant pour l\'assurance.', ephemeral: true }); return; }
            db.removeCoins(message.author.id, message.guild.id, Number(insAmount));
            bj.playerInsure(game); break;
          }
        }
        await btn.update({
          embeds: [bj.buildEmbed(game, embedOpts)],
          components: game.over ? [] : [bj.buildButtons(game)],
        });
        if (game.over) {
          if (game.payout > 0n) db.addCoins(message.author.id, message.guild.id, Number(game.payout));
          collector.stop();
        }
      } catch (e) { console.error('[&bj]', e); }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time' && !game.over) {
        db.addCoins(message.author.id, message.guild.id, Number(game.bet));
        game.message = '⏱️ Temps écoulé — mise remboursée.';
        game.over = true;
        await sent.edit({ embeds: [bj.buildEmbed(game, embedOpts)], components: [] }).catch(() => {});
      }
    });
  },
};
