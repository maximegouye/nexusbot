/**
 * NexusBot — Video Poker (Jacks or Better)
 * /poker <mise> — tirer 5 cartes, choisir lesquelles garder, nouvelle donne
 */
const {
  SlashCommandBuilder, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../../database/db');

// ── Adaptateur préfixe→interaction ────────────────────────────────────────────
function mkFake(message, opts = {}) {
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
      getSubcommand: opts.getSubcommand || (() => null),
      getUser:    opts.getUser    || ((k) => null),
      getMember:  opts.getMember  || ((k) => null),
      getRole:    opts.getRole    || ((k) => null),
      getChannel: opts.getChannel || ((k) => null),
      getString:  opts.getString  || ((k) => null),
      getInteger: opts.getInteger || ((k) => null),
      getNumber:  opts.getNumber  || ((k) => null),
      getBoolean: opts.getBoolean || ((k) => null),
    },
    deferReply: async () => { deferred = true; },
    editReply:  async (d) => send(d),
    reply:      async (d) => send(d),
    followUp:   async (d) => message.channel.send(d).catch(() => {}),
    update:     async (d) => {},
  };
}


// ─── Deck ────────────────────────────────────────────────
const SUITS  = ['♠', '♥', '♦', '♣'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const VAL_IDX = Object.fromEntries(VALUES.map((v, i) => [v, i]));

function buildDeck() {
  const deck = [];
  for (const s of SUITS) for (const v of VALUES) deck.push({ v, s });
  return deck.sort(() => Math.random() - 0.5);
}

function cardStr(card) {
  const colMap = { '♥': '❤️', '♦': '♦️', '♠': '♠️', '♣': '♣️' };
  return `\`${card.v}${colMap[card.s] || card.s}\``;
}

// ─── Évaluation main ────────────────────────────────────
function evalHand(cards) {
  const vals  = cards.map(c => VAL_IDX[c.v]).sort((a, b) => a - b);
  const suits = cards.map(c => c.s);
  const flush  = suits.every(s => s === suits[0]);
  const counts = {};
  vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
  const freq = Object.values(counts).sort((a, b) => b - a);
  const straight = vals[4] - vals[0] === 4 && freq[0] === 1;
  // Ace-low straight (A-2-3-4-5)
  const straightAceLow = JSON.stringify(vals) === JSON.stringify([0,1,2,3,12]);

  if ((straight || straightAceLow) && flush) return { name: 'Quinte Flush Royale', mult: 800 };
  if (freq[0] === 4)                          return { name: 'Carré',              mult: 25  };
  if (freq[0] === 3 && freq[1] === 2)         return { name: 'Full House',         mult: 9   };
  if (flush)                                  return { name: 'Couleur',             mult: 6   };
  if (straight || straightAceLow)            return { name: 'Suite',               mult: 4   };
  if (freq[0] === 3)                          return { name: 'Brelan',              mult: 3   };
  if (freq[0] === 2 && freq[1] === 2)         return { name: 'Double Paire',        mult: 2   };
  // Jacks or better : paire de V, D, R, As
  if (freq[0] === 2) {
    const pairVal = parseInt(Object.entries(counts).find(([, c]) => c === 2)?.[0]);
    if (pairVal >= 9) return { name: 'Paire (V+)',                                  mult: 1   };
  }
  return { name: 'Rien', mult: 0 };
}

// ─── Sessions actives ─────────────────────────────────────
const sessions = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('🃏 Video Poker (Jacks or Better) — mise et tire tes cartes !')
    .addStringOption(o => o
      .setName('mise')
      .setDescription('Montant à miser (aucune limite — tape all / tout / max / 50%)')
      .setRequired(true)
      .setMaxLength(30)
    ),
  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const cfg    = db.getConfig(interaction.guildId);
    const symbol = cfg.currency_emoji || '€';
    const user   = db.getUser(interaction.user.id, interaction.guildId);
    const miseRaw = interaction.options.getString('mise');

    // Parse mise : accepte chiffres bruts, all/tout/max/moitié/50%/etc.
    const parseAmount = (raw, base) => {
      const s = String(raw).replace(/[\s_,]/g, '').toLowerCase();
      if (s === 'all' || s === 'tout' || s === 'max') return Math.max(0, Number(base || 0));
      if (s === 'half' || s === 'moitié' || s === 'moitie' || s === '50%') return Math.floor(Number(base || 0) / 2);
      const m = s.match(/^(\d+(?:\.\d+)?)(%)?$/);
      if (!m) return NaN;
      const n = parseFloat(m[1]);
      if (m[2] === '%') return Math.floor((n / 100) * Number(base || 0));
      return Math.floor(n);
    };

    const mise = parseAmount(miseRaw, user.balance);
    if (!Number.isFinite(mise) || mise < 10) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        content: '❌ Mise invalide. Minimum **10**. Tape un nombre, `all`, `tout`, `max`, `50%`, `moitié`.',
        ephemeral: true
      });
    }

    if (user.balance < mise) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('❌ Solde insuffisant')
          .setDescription(`Tu as **${user.balance.toLocaleString('fr-FR')}${symbol}** mais veux miser **${mise.toLocaleString('fr-FR')}${symbol}**.`)
        ], ephemeral: true
      });
    }

    // Distribuer 5 cartes
    const deck  = buildDeck();
    const hand  = deck.splice(0, 5);
    const rest  = deck;

    const kept  = new Set(); // indices des cartes gardées

    const buildEmbed = () => {
      const handStr = hand.map((c, i) => kept.has(i) ? `**${cardStr(c)}✅**` : cardStr(c)).join('  ');
      const { name: handName } = evalHand(hand);
      return new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🃏 Video Poker — Jacks or Better')
        .setDescription(`**Ta main :**\n${handStr}\n\n> Clique sur les cartes à **garder**, puis **Tirer** !`)
        .addFields(
          { name: '💰 Mise',       value: `${mise.toLocaleString('fr-FR')}${symbol}`,                  inline: true },
          { name: '🃏 Main actuelle', value: handName,                                              inline: true },
        )
        .setFooter({ text: 'Gardez les bonnes cartes !' });
    };

    const buildRow = () => {
      const row1 = new ActionRowBuilder();
      for (let i = 0; i < 5; i++) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`poker_keep_${interaction.id}_${i}`)
            .setLabel(`Carte ${i + 1} ${kept.has(i) ? '✅' : ''}`)
            .setStyle(kept.has(i) ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`poker_draw_${interaction.id}`)
          .setLabel('🎴 Tirer les cartes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`poker_fold_${interaction.id}`)
          .setLabel('❌ Se coucher')
          .setStyle(ButtonStyle.Danger),
      );
      return [row1, row2];
    };

    db.removeCoins(interaction.user.id, interaction.guildId, mise);

    const msg = await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
      embeds: [buildEmbed()],
      components: buildRow(),
      fetchReply: true,
    });

    sessions.set(interaction.id, { hand, rest, kept, mise, userId: interaction.user.id });

    const collector = msg.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 60000,
    });

    collector.on('collect', async i => {
      const sess = sessions.get(interaction.id);
      if (!sess) return;

      if (i.customId.startsWith(`poker_keep_${interaction.id}_`)) {
        const idx = parseInt(i.customId.split('_').pop());
        if (sess.kept.has(idx)) sess.kept.delete(idx);
        else sess.kept.add(idx);
        return i.update({ embeds: [buildEmbed()], components: buildRow() });
      }

      if (i.customId === `poker_fold_${interaction.id}`) {
        sessions.delete(interaction.id);
        collector.stop('fold');
        return i.update({
          embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('❌ Couché').setDescription(`Tu t'es couché. La mise de **${mise.toLocaleString('fr-FR')}${symbol}** est perdue.`)],
          components: [],
        });
      }

      if (i.customId === `poker_draw_${interaction.id}`) {
        // Remplacer les cartes non gardées
        let deckIdx = 0;
        for (let idx = 0; idx < 5; idx++) {
          if (!sess.kept.has(idx)) {
            sess.hand[idx] = sess.rest[deckIdx++];
          }
        }

        const result = evalHand(sess.hand);
        const gain   = mise * result.mult;

        if (gain > 0) db.addCoins(interaction.user.id, interaction.guildId, gain);

        sessions.delete(interaction.id);
        collector.stop('done');

        const finalStr = sess.hand.map(c => cardStr(c)).join('  ');
        const profit   = gain - mise;
        const userNow  = db.getUser(interaction.user.id, interaction.guildId);

        return i.update({
          embeds: [new EmbedBuilder()
            .setColor(gain > mise ? '#2ECC71' : gain > 0 ? '#F1C40F' : '#E74C3C')
            .setTitle(`🃏 ${result.name} — ${gain > 0 ? 'Gagné !' : 'Perdu'}`)
            .setDescription(`**Main finale :**\n${finalStr}`)
            .addFields(
              { name: '🃏 Combinaison',    value: `**${result.name}**`,                                     inline: true },
              { name: '✖️ Multiplicateur', value: `×${result.mult}`,                                        inline: true },
              { name: gain > 0 ? '💵 Gain' : '💸 Perte', value: `**${gain > 0 ? '+' + gain.toLocaleString('fr-FR') : '-' + mise.toLocaleString('fr-FR')}${symbol}**`, inline: true },
              { name: `${symbol} Solde`,   value: `**${userNow.balance.toLocaleString('fr-FR')}${symbol}**`,   inline: true },
            )
            .setFooter({ text: 'Jacks or Better • Quinte Flush Royale = ×800' })
            .setTimestamp()
          ],
          components: [],
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason !== 'done' && reason !== 'fold') {
        sessions.delete(interaction.id);
        msg.edit({
          embeds: [new EmbedBuilder().setColor('#95A5A6').setTitle('⏰ Partie expirée').setDescription('Tu n\'as pas joué à temps.')],
          components: [],
        }).catch(() => {});
      }
    });
  },
  name: 'poker2',
  aliases: ["poker-prefix"],
  async run(message, args) {
    const mise = args[0] || '100';
    const fake = mkFake(message, { getString: (k) => k === 'mise' ? mise : null });
    await this.execute(fake);
  },
};
