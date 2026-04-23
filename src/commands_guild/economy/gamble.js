const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

// ─── SLOTS ────────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
const SLOT_WEIGHTS = [30, 25, 20, 15, 6, 3, 1];

function spinSlots() {
  const spin = () => {
    const r = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
      acc += SLOT_WEIGHTS[i];
      if (r < acc) return SLOT_SYMBOLS[i];
    }
    return SLOT_SYMBOLS[0];
  };
  return [spin(), spin(), spin()];
}

function slotsMultiplier(reels) {
  const [a, b, c] = reels;
  if (a === b && b === c) {
    if (a === '7️⃣') return 50;
    if (a === '💎') return 20;
    if (a === '⭐') return 10;
    if (a === '🍇') return 5;
    return 3;
  }
  if (a === b || b === c || a === c) return 1.5;
  return 0;
}

// ─── BLACKJACK ────────────────────────────────────────────────────────────────
function makeDecks(n = 1) {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (let i = 0; i < n; i++) for (const s of suits) for (const r of ranks) deck.push({ s, r });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card) {
  if (['J', 'Q', 'K'].includes(card.r)) return 10;
  if (card.r === 'A') return 11;
  return parseInt(card.r);
}

function handTotal(hand) {
  let total = hand.reduce((s, c) => s + cardValue(c), 0);
  let aces = hand.filter(c => c.r === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function cardStr(card) { return `${card.r}${card.s}`; }
function handStr(hand) { return hand.map(cardStr).join(' '); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('🎰 Joue à des jeux d\'argent')
    .addSubcommand(s => s.setName('slots').setDescription('🎰 Machine à sous').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%/nombre) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
    .addSubcommand(s => s.setName('coinflip').setDescription('🪙 Pile ou face').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30)).addStringOption(o => o.setName('choix').setDescription('pile ou face').setRequired(true).addChoices({ name: '🪙 Pile', value: 'pile' }, { name: '🎖️ Face', value: 'face' })))
    .addSubcommand(s => s.setName('blackjack').setDescription('🃏 Joue au Blackjack').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30))),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub   = interaction.options.getSubcommand();
    const cfg   = db.getConfig(interaction.guildId);
    const emoji = cfg.currency_emoji || '€';
    const name  = cfg.currency_name  || 'Euros';
    const user  = db.getUser(interaction.user.id, interaction.guildId);
    // parseBet accepte nombres, all, tout, max, moitié, 50%
    const parseBet = (raw, base) => {
      const s = String(raw ?? '').replace(/[\s_,]/g, '').toLowerCase();
      if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
      if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
      const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
      return Math.floor(n);
    };
    const miseRaw = interaction.options.get('mise')?.value;
    const mise = parseBet(miseRaw, user.balance);
    if (!Number.isFinite(mise) || mise < 10) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide. Minimum **10**. Tape un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
    }

    if (user.balance < mise) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Mise insuffisante ! Tu n'as que **${user.balance.toLocaleString('fr-FR')} ${name}**.`, ephemeral: true });
    }

    // ── SLOTS ──
    if (sub === 'slots') {
      const reels = spinSlots();
      const multi = slotsMultiplier(reels);
      const gain  = Math.floor(mise * multi);
      const net   = gain - mise;

      if (net >= 0) db.addCoins(interaction.user.id, interaction.guildId, net);
      else db.removeCoins(interaction.user.id, interaction.guildId, mise - gain);

      const won    = net >= 0;
      const result = multi === 0 ? '😭 Perdu !'
                   : multi >= 50 ? '🎊 JACKPOT LÉGENDAIRE !!'
                   : multi >= 20 ? '💎 JACKPOT !!'
                   : multi >= 10 ? '🌟 Gros gain !'
                   : multi >= 5  ? '🎉 Super gain !'
                   : multi >= 3  ? '✅ Gagne !'
                   : '🟡 Récupéré une partie !';

      const embed = new EmbedBuilder()
        .setColor(won ? '#2ECC71' : '#FF6B6B')
        .setTitle(`🎰 Machine à sous — ${result}`)
        .setDescription(`# ${reels.join(' | ')}`)
        .addFields(
          { name: '💵 Mise',     value: `**${mise.toLocaleString('fr-FR')}** ${name}`,                      inline: true },
          { name: '✖️ Multiplicateur', value: `**×${multi}**`,                                           inline: true },
          { name: won ? '🤑 Gain net' : '💸 Perte', value: `**${Math.abs(net).toLocaleString('fr-FR')}** ${name}`, inline: true },
        );

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── COINFLIP ──
    if (sub === 'coinflip') {
      const choix = interaction.options.getString('choix');
      const result = Math.random() < 0.5 ? 'pile' : 'face';
      const won    = choix === result;

      if (won) db.addCoins(interaction.user.id, interaction.guildId, mise);
      else db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const embed = new EmbedBuilder()
        .setColor(won ? '#2ECC71' : '#FF6B6B')
        .setTitle(`🪙 Pile ou Face — ${won ? 'Gagné !' : 'Perdu !'}`)
        .addFields(
          { name: 'Résultat', value: result === 'pile' ? '🪙 Pile' : '🎖️ Face', inline: true },
          { name: 'Ton choix', value: choix === 'pile' ? '🪙 Pile' : '🎖️ Face', inline: true },
          { name: won ? '🤑 Gain' : '💸 Perte', value: `**${mise.toLocaleString('fr-FR')}** ${name}`, inline: true },
        );

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    // ── BLACKJACK ──
    if (sub === 'blackjack') {
      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const deck       = makeDecks(2);
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      const playerTotal = handTotal(playerHand);
      const dealerUp    = cardValue(dealerHand[0]);

      // Blackjack naturel ?
      if (playerTotal === 21) {
        const gain = Math.floor(mise * 2.5);
        db.addCoins(interaction.user.id, interaction.guildId, gain);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#F39C12')
            .setTitle('🃏 BLACKJACK ! 🎉')
            .setDescription(`**Ta main :** ${handStr(playerHand)} (21)\n**Croupier :** ${cardStr(dealerHand[0])} + 🂠\n\n🤑 Tu gagnes **${gain.toLocaleString('fr-FR')} ${name}** (×2.5) !`)
          ]
        });
      }

      const bjState = { deck, playerHand, dealerHand, mise, userId: interaction.user.id, guildId: interaction.guildId };

      const buildBJEmbed = (state, ended = false, outcome = null) => {
        const pt = handTotal(state.playerHand);
        const dt = handTotal(state.dealerHand);

        let desc = `**Ta main :** ${handStr(state.playerHand)} (**${pt}**)\n`;
        desc += ended
          ? `**Croupier :** ${handStr(state.dealerHand)} (**${dt}**)`
          : `**Croupier :** ${cardStr(state.dealerHand[0])} + 🂠`;

        if (outcome) desc += `\n\n${outcome}`;

        return new EmbedBuilder()
          .setColor(outcome?.includes('gagn') ? '#2ECC71' : outcome ? '#FF6B6B' : cfg.color || '#7B2FBE')
          .setTitle('🃏 Blackjack')
          .setDescription(desc)
          .setFooter({ text: `Mise : ${state.mise.toLocaleString('fr-FR')} ${name}` });
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel('🎴 Tirer').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bj_stand').setLabel('🛑 Rester').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bj_double').setLabel('✖️ Doubler').setStyle(ButtonStyle.Danger).setDisabled(user.balance < mise),
      );

      const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [buildBJEmbed(bjState)], components: [row], fetchReply: true });

      const collector = msg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) return i.reply({ content: 'Ce n\'est pas ta partie !', ephemeral: true });

        if (i.customId === 'bj_hit') {
          bjState.playerHand.push(bjState.deck.pop());
          const pt = handTotal(bjState.playerHand);
          if (pt > 21) {
            collector.stop('bust');
            return i.update({ embeds: [buildBJEmbed(bjState, true, `💥 Bust ! Tu as dépassé 21. Tu perds **${bjState.mise.toLocaleString('fr-FR')} ${name}**.`)], components: [] });
          }
          if (pt === 21) {
            // Auto-stand
            await resolveDealer(i);
          } else {
            await i.update({ embeds: [buildBJEmbed(bjState)], components: [row] });
          }
        }

        if (i.customId === 'bj_stand') await resolveDealer(i);

        if (i.customId === 'bj_double') {
          const curUser = db.getUser(bjState.userId, bjState.guildId);
          if (curUser.balance < bjState.mise) return i.reply({ content: '❌ Solde insuffisant pour doubler.', ephemeral: true });
          db.removeCoins(bjState.userId, bjState.guildId, bjState.mise);
          bjState.mise *= 2;
          bjState.playerHand.push(bjState.deck.pop());
          const pt = handTotal(bjState.playerHand);
          if (pt > 21) {
            collector.stop('bust');
            return i.update({ embeds: [buildBJEmbed(bjState, true, `💥 Bust ! Tu perds **${bjState.mise.toLocaleString('fr-FR')} ${name}**.`)], components: [] });
          }
          await resolveDealer(i);
        }
      });

      async function resolveDealer(i) {
        while (handTotal(bjState.dealerHand) < 17) bjState.dealerHand.push(bjState.deck.pop());
        const pt = handTotal(bjState.playerHand);
        const dt = handTotal(bjState.dealerHand);
        let outcome, gain = 0;

        if (dt > 21 || pt > dt) {
          gain = bjState.mise * 2;
          db.addCoins(bjState.userId, bjState.guildId, gain);
          outcome = `🎉 Gagné ! Tu remportes **${bjState.mise.toLocaleString('fr-FR')} ${name}** !`;
        } else if (pt === dt) {
          db.addCoins(bjState.userId, bjState.guildId, bjState.mise);
          outcome = `🤝 Égalité ! Ta mise te revient.`;
        } else {
          outcome = `😭 Perdu ! Le croupier a ${dt} contre ton ${pt}.`;
        }

        collector.stop('resolved');
        await i.update({ embeds: [buildBJEmbed(bjState, true, outcome)], components: [] });
      }

      collector.on('end', (_, reason) => {
        if (reason === 'time') {
          db.addCoins(bjState.userId, bjState.guildId, bjState.mise); // remboursement timeout
          msg.edit({ embeds: [buildBJEmbed(bjState, false, '⏱️ Temps écoulé, mise remboursée.')], components: [] }).catch(() => {});
        }
      });
    }
  }
};
