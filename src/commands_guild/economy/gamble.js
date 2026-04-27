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


// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts) {
  opts = opts || {};
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gamble')
    .setDescription('🎰 Joue à des jeux d\'argent')
    .addSubcommand(s => s.setName('slots').setDescription('🎰 Machine à sous').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%/nombre) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
    .addSubcommand(s => s.setName('coinflip').setDescription('🪙 Pile ou face').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30)).addStringOption(o => o.setName('choix').setDescription('pile ou face').setRequired(true).addChoices({ name: '🪙 Pile', value: 'pile' }, { name: '🎖️ Face', value: 'face' })))
    .addSubcommand(s => s.setName('blackjack').setDescription('🃏 Joue au Blackjack').addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%) — ILLIMITÉ').setRequired(true).setMaxLength(30)))
    .addSubcommand(s => s.setName('des').setDescription('🎲 Jeu de dés — choisir pair/impair/bas/haut/sept/numéro')
      .addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%/nombre) — ILLIMITÉ').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('pari').setDescription('Votre pari').setRequired(true).addChoices(
        { name: '🔢 Pair (×2)', value: 'pair' },
        { name: '🔢 Impair (×2)', value: 'impair' },
        { name: '⬇️ Bas 2–6 (×2)', value: 'bas' },
        { name: '⬆️ Haut 8–12 (×2)', value: 'haut' },
        { name: '🎯 Sept exactement (×5)', value: 'sept' },
      )))
    .addSubcommand(s => s.setName('roulette').setDescription('🎡 Roulette rapide — rouge/noir/pair/impair')
      .addStringOption(o => o.setName('mise').setDescription('Mise (all/tout/50%/nombre) — ILLIMITÉ').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('pari').setDescription('Votre pari').setRequired(true).addChoices(
        { name: '🔴 Rouge (×2)', value: 'rouge' },
        { name: '⚫ Noir (×2)', value: 'noir' },
        { name: '🔢 Pair (×2)', value: 'pair' },
        { name: '🔢 Impair (×2)', value: 'impair' },
        { name: '⬇️ Manque 1–18 (×2)', value: 'manque' },
        { name: '⬆️ Passe 19–36 (×2)', value: 'passe' },
      ))),
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
    const miseRaw = interaction.options.getString('mise');
    const mise = parseBet(miseRaw, user.balance);
    if (!Number.isFinite(mise) || mise < 10) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Mise invalide. Minimum **10**. Tape un nombre, `all`, `50%`, `moitié`.', ephemeral: true });
    }

    if (user.balance < mise) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Mise insuffisante ! Tu n'as que **${user.balance.toLocaleString('fr-FR')} ${name}**.`, ephemeral: true });
    }

    const reply = (data) => (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(data);

    // ── SLOTS ──
    if (sub === 'slots') {
      const reels = spinSlots();
      const multi = slotsMultiplier(reels);
      const gain  = Math.floor(mise * multi);
      const net   = gain - mise;

      if (net >= 0) db.addCoins(interaction.user.id, interaction.guildId, net);
      else db.removeCoins(interaction.user.id, interaction.guildId, mise - gain);

      const won       = net >= 0;
      const isJackpot = multi >= 50;
      const isTriple7 = reels[0] === '7️⃣' && reels[1] === '7️⃣' && reels[2] === '7️⃣';
      const result = multi === 0 ? '😭 Perdu !'
                   : multi >= 50 ? '🏆 JACKPOT LÉGENDAIRE !! 🏆'
                   : multi >= 20 ? '💎 JACKPOT !!'
                   : multi >= 10 ? '🌟 Gros gain !'
                   : multi >= 5  ? '🎉 Super gain !'
                   : multi >= 3  ? '✅ Gagné !'
                   : '🟡 Récupéré une partie !';

      const userAfter = db.getUser(interaction.user.id, interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(isJackpot ? '#FFD700' : won ? '#2ECC71' : '#FF6B6B')
        .setTitle(`🎰 Machine à sous — ${result}`)
        .setDescription(isTriple7
          ? `# 7️⃣ | 7️⃣ | 7️⃣\n\n🎊 **TRIPLE SEPT — JACKPOT LÉGENDAIRE !**`
          : `# ${reels.join(' | ')}`)
        .addFields(
          { name: '💵 Mise',           value: `**${mise.toLocaleString('fr-FR')}** ${name}`,                         inline: true },
          { name: '✖️ Multiplicateur', value: `**×${multi}**`,                                                        inline: true },
          { name: won ? '🤑 Gain net' : '💸 Perte', value: `**${Math.abs(net).toLocaleString('fr-FR')}** ${name}`,  inline: true },
          { name: '👛 Solde',          value: `**${userAfter.balance.toLocaleString('fr-FR')}** ${name}`,            inline: true },
        );

      return reply({ embeds: [embed] });
    }

    // ── COINFLIP ──
    if (sub === 'coinflip') {
      const choix = interaction.options.getString('choix');
      const result = Math.random() < 0.5 ? 'pile' : 'face';
      const won    = choix === result;

      if (won) db.addCoins(interaction.user.id, interaction.guildId, mise);
      else db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const userAfter = db.getUser(interaction.user.id, interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(won ? '#2ECC71' : '#FF6B6B')
        .setTitle(`🪙 Pile ou Face — ${won ? 'Gagné !' : 'Perdu !'}`)
        .addFields(
          { name: 'Résultat',   value: result === 'pile' ? '🪙 Pile' : '🎖️ Face',                              inline: true },
          { name: 'Ton choix',  value: choix === 'pile' ? '🪙 Pile' : '🎖️ Face',                              inline: true },
          { name: won ? '🤑 Gain' : '💸 Perte', value: `**${mise.toLocaleString('fr-FR')}** ${name}`,        inline: true },
          { name: '👛 Solde',   value: `**${userAfter.balance.toLocaleString('fr-FR')}** ${name}`,            inline: true },
        );

      return reply({ embeds: [embed] });
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

    // ── DÉS ──
    if (sub === 'des') {
      const pari = interaction.options.getString('pari');
      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const total = d1 + d2;
      const DICE_EMOJI = ['','⚀','⚁','⚂','⚃','⚄','⚅'];

      let won = false, mult = 2, label = '';
      switch (pari) {
        case 'pair':   won = total % 2 === 0; label = '🔢 Pair';        break;
        case 'impair': won = total % 2 !== 0; label = '🔢 Impair';      break;
        case 'bas':    won = total <= 6;       label = '⬇️ Bas (2–6)';   break;
        case 'haut':   won = total >= 8;       label = '⬆️ Haut (8–12)'; break;
        case 'sept':   won = total === 7; mult = 5; label = '🎯 Sept';   break;
      }

      const gain = won ? Math.floor(mise * mult) : 0;
      if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);
      const userAfter = db.getUser(interaction.user.id, interaction.guildId);

      return reply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#2ECC71' : '#E74C3C')
        .setTitle(won ? `🎲 GAGNÉ — Total : ${total}` : `🎲 Perdu — Total : ${total}`)
        .setDescription(`${DICE_EMOJI[d1]} ${DICE_EMOJI[d2]}  →  **${total}**`)
        .addFields(
          { name: '🎯 Pari',           value: label,                                                           inline: true },
          { name: '✖️ Multiplicateur', value: `×${mult}`,                                                      inline: true },
          { name: won ? '🤑 Gain net' : '💸 Perte', value: `**${won ? gain - mise : mise}** ${name}`,        inline: true },
          { name: '👛 Solde',          value: `**${userAfter.balance.toLocaleString('fr-FR')}** ${name}`,     inline: true },
        )
        .setTimestamp()
      ]});
    }

    // ── ROULETTE ──
    if (sub === 'roulette') {
      const pari = interaction.options.getString('pari');
      db.removeCoins(interaction.user.id, interaction.guildId, mise);

      const RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
      const num = Math.floor(Math.random() * 37); // 0–36
      const isRed = RED_NUMS.has(num);
      const isEven = num !== 0 && num % 2 === 0;

      let won = false;
      switch (pari) {
        case 'rouge':  won = num !== 0 && isRed;  break;
        case 'noir':   won = num !== 0 && !isRed; break;
        case 'pair':   won = isEven;               break;
        case 'impair': won = num !== 0 && !isEven; break;
        case 'manque': won = num >= 1 && num <= 18; break;
        case 'passe':  won = num >= 19;             break;
      }

      const numEmoji = num === 0 ? '🟢 0' : isRed ? `🔴 ${num}` : `⚫ ${num}`;
      if (won) db.addCoins(interaction.user.id, interaction.guildId, Math.floor(mise * 2));
      const userAfter = db.getUser(interaction.user.id, interaction.guildId);

      return reply({ embeds: [new EmbedBuilder()
        .setColor(won ? '#2ECC71' : '#E74C3C')
        .setTitle(`🎡 Roulette — ${won ? 'Gagné !' : 'Perdu !'}`)
        .setDescription(`La bille s'arrête sur : **${numEmoji}**`)
        .addFields(
          { name: '🎯 Pari',   value: pari,                                                               inline: true },
          { name: '🎰 Numéro', value: `${numEmoji}`,                                                      inline: true },
          { name: won ? '🤑 Gain net' : '💸 Perte', value: `**${mise.toLocaleString('fr-FR')}** ${name}`, inline: true },
          { name: '👛 Solde',  value: `**${userAfter.balance.toLocaleString('fr-FR')}** ${name}`,         inline: true },
        )
        .setTimestamp()
      ]});
    }
  },

  name: 'gamble',
  aliases: ['jeu', 'casino2'],
  async run(message, args) {
    const sub   = args[0] || 'slots';
    const mise  = args[1] || '100';
    const choix = args[2] || 'pile';
    const pari  = args[2] || 'pair';
    const fake = mkFake(message, {
      getSubcommand: () => sub,
      getString: (k) => {
        if (k === 'mise')  return mise;
        if (k === 'choix') return choix;
        if (k === 'pari')  return pari;
        return null;
      },
    });
    await this.execute(fake);
  },

};
