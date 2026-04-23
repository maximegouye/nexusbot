// ============================================================
// videopoker.js — Video Poker (Jacks or Better) complet
// Emplacement : src/commands_guild/games/videopoker.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SUITS  = ['♠️','♥️','♦️','♣️'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RANK   = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

function newDeck() {
  const d = [];
  for (const s of SUITS) for (const v of VALUES) d.push({ suit: s, value: v });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function cardStr(c) { return `\`${c.value}${c.suit}\``; }

// ─── Évaluation main de poker ─────────────────────────────
function evalHand(hand) {
  const ranks  = hand.map(c => RANK[c.value]).sort((a,b) => a-b);
  const suits  = hand.map(c => c.suit);
  const vals   = hand.map(c => c.value);

  const isFlush   = suits.every(s => s === suits[0]);
  const isStraight = ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5;
  // Ace-low straight: A-2-3-4-5
  const isAceLow  = JSON.stringify(ranks) === JSON.stringify([2,3,4,5,14]);

  const counts = {};
  for (const v of vals) counts[v] = (counts[v] || 0) + 1;
  const groups = Object.values(counts).sort((a,b) => b-a);

  // Classement
  if (isFlush && (isStraight || isAceLow) && ranks[4] === 14 && !isAceLow) return { name: 'Royal Flush',       mult: 800 };
  if (isFlush && (isStraight || isAceLow))                                  return { name: 'Quinte Flush',      mult: 50  };
  if (groups[0] === 4)                                                        return { name: 'Carré',             mult: 25  };
  if (groups[0] === 3 && groups[1] === 2)                                    return { name: 'Full House',        mult: 9   };
  if (isFlush)                                                                return { name: 'Couleur',           mult: 6   };
  if (isStraight || isAceLow)                                                return { name: 'Quinte',            mult: 4   };
  if (groups[0] === 3)                                                        return { name: 'Brelan',            mult: 3   };
  if (groups[0] === 2 && groups[1] === 2)                                    return { name: 'Deux Paires',       mult: 2   };
  // Paire de Valets ou mieux
  if (groups[0] === 2) {
    const pairedVal = Object.entries(counts).find(([v,c]) => c === 2)[0];
    if (['J','Q','K','A'].includes(pairedVal))                               return { name: 'Paire (J ou +)',   mult: 1   };
  }
  return { name: 'Aucune combinaison', mult: 0 };
}

// ─── Sessions ─────────────────────────────────────────────
const sessions = new Map();

async function playVideoPoker(source, userId, guildId, mise) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.coin || '🪙';

  if (!u || u.solde < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.solde || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (sessions.has(userId)) {
    const err = '⚠️ Tu as déjà une partie de Video Poker en cours !';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const deck = newDeck();
  const hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
  const held = [false, false, false, false, false];

  const state = { userId, guildId, mise, deck, hand, held, phase: 'hold' };
  sessions.set(userId, state);

  function buildHoldEmbed() {
    const handStr = hand.map(cardStr).join(' ');
    const { name, mult } = evalHand(hand);
    return new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('🃏 ・ Video Poker — Jacks or Better ・')
      .setDescription(`**Ta main :**\n${handStr}\n\n*Clique sur les cartes à **garder**, puis appuie sur **Tirer** !*`)
      .addFields(
        { name: '🔍 Combinaison actuelle', value: `${name}${mult > 0 ? ` (×${mult})` : ''}`, inline: true },
        { name: '💰 Mise', value: `${mise} ${coin}`, inline: true },
      )
      .setFooter({ text: 'Sélectionnez 0 à 5 cartes à garder' });
  }

  function buildCardButtons() {
    return new ActionRowBuilder().addComponents(
      ...hand.map((c, i) =>
        new ButtonBuilder()
          .setCustomId(`vp_hold_${userId}_${i}`)
          .setLabel(`${c.value}${c.suit.replace(/[^♠♥♦♣]/g, '')} ${held[i] ? '✅' : ''}`)
          .setStyle(held[i] ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );
  }

  function buildActionRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`vp_draw_${userId}`).setLabel('🃏 Tirer').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`vp_hold_all_${userId}`).setLabel('Tout garder').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`vp_hold_none_${userId}`).setLabel('Tout échanger').setStyle(ButtonStyle.Danger),
    );
  }

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });
  } else {
    msg = await source.editReply({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });
  }

  const filter = i => i.user.id === userId && i.customId.startsWith(`vp_`);
  const collector = msg.createMessageComponentCollector({ filter, time: 120_000 });

  collector.on('collect', async i => {
    await i.deferUpdate().catch(() => {});
    const st = sessions.get(userId);
    if (!st || st.phase !== 'hold') return;

    if (i.customId.startsWith(`vp_hold_${userId}_`)) {
      // Toggle hold sur une carte
      const idx = parseInt(i.customId.split('_').pop());
      st.held[idx] = !st.held[idx];
      await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

    } else if (i.customId === `vp_hold_all_${userId}`) {
      for (let k = 0; k < 5; k++) st.held[k] = true;
      await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

    } else if (i.customId === `vp_hold_none_${userId}`) {
      for (let k = 0; k < 5; k++) st.held[k] = false;
      await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

    } else if (i.customId === `vp_draw_${userId}`) {
      // Tirer les nouvelles cartes
      st.phase = 'result';
      for (let k = 0; k < 5; k++) {
        if (!st.held[k]) st.hand[k] = st.deck.pop();
      }
      collector.stop('draw');

      // Animation tirage
      const animEmbed = new EmbedBuilder().setColor('#8E44AD').setTitle('🃏 ・ Video Poker ・').setDescription('*Tirage en cours...*\n🌀 🌀 🌀 🌀 🌀');
      await msg.edit({ embeds: [animEmbed], components: [] });
      await sleep(800);

      const { name, mult } = evalHand(st.hand);
      const gain = Math.floor(mise * mult);
      if (gain > 0) db.addCoins(userId, guildId, gain);

      const handStr = st.hand.map(cardStr).join(' ');
      const color   = mult >= 9 ? '#F1C40F' : mult > 0 ? '#2ECC71' : '#E74C3C';
      const desc    = mult > 0
        ? `🎉 **${name}** ! +**${gain} ${coin}**`
        : `😔 **${name}**. -**${mise} ${coin}**`;

      const finalEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🃏 ・ Video Poker — Résultat ・')
        .setDescription(`**Main finale :**\n${handStr}\n\n${desc}`)
        .addFields(
          { name: '🏆 Combinaison', value: name, inline: true },
          { name: '📈 Multiplicateur', value: `×${mult}`, inline: true },
          { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.solde || 0} ${coin}`, inline: true },
        )
        .addFields({ name: '📋 Table de paiement', value:
          '`Royal Flush ×800` · `Quinte Flush ×50` · `Carré ×25`\n`Full House ×9` · `Couleur ×6` · `Quinte ×4`\n`Brelan ×3` · `2 Paires ×2` · `Paire J+ ×1`',
          inline: false })
        .setTimestamp();

      sessions.delete(userId);
      await msg.edit({ embeds: [finalEmbed], components: [] });
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      sessions.delete(userId);
      db.addCoins(userId, guildId, Math.floor(mise / 2));
      msg.edit({ content: '⏰ Temps écoulé.', components: [] }).catch(() => {});
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('videopoker')
    .setDescription('🃏 Video Poker — Jacks or Better, gardez vos meilleures cartes !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    await playVideoPoker(interaction, interaction.user.id, interaction.guildId, interaction.options.getInteger('mise'));
  },

  name: 'videopoker',
  aliases: ['poker', 'vpoker', 'jacks'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&videopoker <mise>`\nEx: `&videopoker 200`');
    await playVideoPoker(message, message.author.id, message.guildId, mise);
  },
};
