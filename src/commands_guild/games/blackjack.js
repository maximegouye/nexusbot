// ============================================================
// blackjack.js — Commande /blackjack (moteur: blackjackEngine + BDD persistée)
// Emplacement : src/commands_guild/games/blackjack.js
// Les boutons (bj_hit, bj_stand, etc.) sont gérés par interactionCreate.js
// ============================================================
const { SlashCommandBuilder } = require('discord.js');
const db  = require('../../database/db');
const bjm = require('../../utils/blackjackEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 Jouez au BlackJack contre le croupier')
    .addIntegerOption(o => o
      .setName('mise')
      .setDescription('Montant à miser (min 10)')
      .setRequired(true)
      .setMinValue(10)),

  async execute(interaction) {
    const mise    = interaction.options.getInteger('mise');
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;

    // ── Config et utilisateur ─────────────────────────────────
    const user   = db.getUser(userId, guildId);
    const cfg    = db.getConfig ? db.getConfig(guildId) : null;
    const symbol = cfg?.coin || '🪙';
    const balance = Number(user?.balance ?? user?.solde ?? 0);

    // ── Vérifications ─────────────────────────────────────────
    if (!user || balance < mise) {
      return interaction.reply({
        content: `❌ Solde insuffisant. Tu as **${balance}** ${symbol}.`,
        ephemeral: true,
      });
    }
    if (mise < 10) {
      return interaction.reply({
        content: `❌ Mise minimale : **10** ${symbol}.`,
        ephemeral: true,
      });
    }

    // ── Déduire la mise et démarrer ───────────────────────────
    db.removeCoins(userId, guildId, mise);

    const embedOpts = {
      symbol,
      color:    '#FFD700',
      userName: interaction.user.username,
    };
    const { game, immediateFinish } = bjm.startGame({
      bet:     BigInt(mise),
      balance: BigInt(balance),
    });

    // ── Blackjack naturel ou égalité immédiate ─────────────────
    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(userId, guildId, Number(game.payout));
      return interaction.reply({ embeds: [bjm.buildEmbed(game, embedOpts)] });
    }

    // ── Partie normale : envoyer embed + boutons ───────────────
    await interaction.reply({
      embeds:     [bjm.buildEmbed(game, embedOpts)],
      components: [bjm.buildButtons(game)],
    });

    // ── Sauvegarder la session par messageId (pour les boutons) ─
    try {
      const msg = await interaction.fetchReply();
      db.saveGameSession(
        msg.id,
        userId,
        guildId,
        interaction.channelId,
        'blackjack',
        { state: bjm.serialize(game), embedOpts },
        1800,
      );
    } catch (e) {
      console.error('[BLACKJACK] saveGameSession error:', e.message);
    }
  },

  // ── Préfixe !blackjack <mise> ─────────────────────────────────
  name: 'blackjack',
  aliases: ['bj', '21'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 10) {
      return message.reply('❌ Usage : `!blackjack <mise>` (min 10)');
    }
    const userId  = message.author.id;
    const guildId = message.guildId;

    const user   = db.getUser(userId, guildId);
    const cfg    = db.getConfig ? db.getConfig(guildId) : null;
    const symbol = cfg?.coin || '🪙';
    const balance = Number(user?.balance ?? user?.solde ?? 0);

    if (!user || balance < mise) {
      return message.reply(`❌ Solde insuffisant. Tu as **${balance}** ${symbol}.`);
    }

    db.removeCoins(userId, guildId, mise);

    const embedOpts = { symbol, color: '#FFD700', userName: message.author.username };
    const { game, immediateFinish } = bjm.startGame({
      bet:     BigInt(mise),
      balance: BigInt(balance),
    });

    if (immediateFinish) {
      if (game.payout > 0n) db.addCoins(userId, guildId, Number(game.payout));
      return message.reply({ embeds: [bjm.buildEmbed(game, embedOpts)] });
    }

    const msg = await message.reply({
      embeds:     [bjm.buildEmbed(game, embedOpts)],
      components: [bjm.buildButtons(game)],
    });

    db.saveGameSession(
      msg.id, userId, guildId, message.channelId,
      'blackjack',
      { state: bjm.serialize(game), embedOpts },
      1800,
    );
  },
};
