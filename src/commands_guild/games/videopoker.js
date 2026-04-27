// ============================================================
// videopoker.js — Video Poker (Jacks or Better) complet
// Emplacement : src/commands_guild/games/videopoker.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');
const { makeGameRow, changeMiseModal, parseMise } = require('../../utils/casinoUtils');

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

// ─── Game Sessions Map with TTL ───────────────────────────
const gameSessions = new Map();

function storeSession(userId, state) {
  const existing = gameSessions.get(userId);
  if (existing?.timeout) clearTimeout(existing.timeout);

  const timeout = setTimeout(() => {
    gameSessions.delete(userId);
  }, 15 * 60 * 1000); // 15 minutes

  gameSessions.set(userId, { ...state, timeout });
}

function getSession(userId) {
  return gameSessions.get(userId);
}

function deleteSession(userId) {
  const sess = gameSessions.get(userId);
  if (sess?.timeout) clearTimeout(sess.timeout);
  gameSessions.delete(userId);
}

async function playVideoPoker(source, userId, guildId, mise) {
  const isInteraction = !!source.editReply;
  const u    = db.getUser(userId, guildId);
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  if (!u || u.balance < mise) {
    const err = `❌ Solde insuffisant. Tu as **${u?.balance || 0} ${coin}**.`;
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }
  if (getSession(userId)) {
    const err = '⚠️ Tu as déjà une partie de Video Poker en cours !';
    if (isInteraction) return source.editReply({ content: err, ephemeral: true });
    return source.reply(err);
  }

  db.addCoins(userId, guildId, -mise);

  const deck = newDeck();
  const hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
  const held = [false, false, false, false, false];

  const state = { userId, guildId, mise, deck, hand, held, phase: 'hold' };
  storeSession(userId, state);

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

  // Animation de distribution des cartes AMÉLIORÉE avec frame de shuffle
  const shuffleFrame = new EmbedBuilder()
    .setColor('#5B2C6F')
    .setTitle('🃏 ・ Video Poker — Jacks or Better ・')
    .setDescription('🎰 *Mélange du sabot...*\n\n🌀 🌀 🌀 🌀 🌀')
    .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true});

  let msg;
  if (isInteraction) {
    msg = await source.editReply({ embeds: [shuffleFrame] });
  } else {
    msg = await source.reply({ embeds: [shuffleFrame] });
  }
  await sleep(400);

  // Intro frame — cartes dos visibles avant révélation
  const dealIntro = new EmbedBuilder()
    .setColor('#6C3483')
    .setTitle('🃏 ・ Video Poker — Jacks or Better ・')
    .setDescription('🃏 *Distribution des cartes...*\n\n🂠 🂠 🂠 🂠 🂠')
    .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true});

  await msg.edit({ embeds: [dealIntro] });
  await sleep(350);

  // Révéler les cartes une par une avec ordre dramatique amélioré
  const revealOrder = [2, 0, 4, 1, 3]; // centre puis coins, meilleure dramaturgie
  const revealedFlags = [false, false, false, false, false];
  for (const idx of revealOrder) {
    revealedFlags[idx] = true;
    const handPreview = hand.map((c, i) => revealedFlags[i] ? cardStr(c) : '🂠').join(' ');
    const position = revealOrder.indexOf(idx) + 1;
    await sleep(350); // 350ms au lieu de 300ms pour plus d'impact
    await msg.edit({ embeds: [new EmbedBuilder()
      .setColor('#8E44AD').setTitle('🃏 ・ Video Poker — Jacks or Better ・')
      .setDescription(`✨ *Révélation...*\n\n${handPreview}\n\n*Carte ${position}/5*`)
      .addFields({name:'💰 Mise',value:`${mise} ${coin}`,inline:true})
    ]});
  }
  await sleep(400);

  // Affiche la vraie main avec boutons
  await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

  // Note: No collector — using persistent handleComponent instead
}

// ─── Component Handler ────────────────────────────────────
async function handleComponent(interaction) {
  const customId = interaction.customId;

  // Paytable handler
  if (customId.startsWith('vp_paytable_')) {
    const userId = customId.split('_')[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    const paytableEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🃏 Table de paiement')
      .setDescription('Mains gagnantes et leurs multiplicateurs')
      .addFields(
        { name: 'Royal Flush', value: '× 250', inline: true },
        { name: 'Straight Flush', value: '× 50', inline: true },
        { name: 'Carré', value: '× 25', inline: true },
        { name: 'Full House', value: '× 9', inline: true },
        { name: 'Flush', value: '× 6', inline: true },
        { name: 'Suite', value: '× 4', inline: true },
        { name: 'Brelan', value: '× 3', inline: true },
        { name: 'Double Paire', value: '× 2', inline: true },
        { name: 'Jacks or Better', value: '× 1', inline: true },
      )
      .setFooter({ text: 'Video Poker · Jacks or Better' });
    return interaction.reply({ embeds: [paytableEmbed], ephemeral: true });
  }

  // Play again handler
  if (customId.startsWith('vp_replay_')) {
    const parts = customId.split('_');
    const userId = parts[2];
    const mise = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
    }

    await interaction.deferUpdate().catch(() => {});
    await playVideoPoker(interaction, userId, interaction.guildId, mise);
    return true;
  }

  // Changer la mise
  if (customId.startsWith('vp_changemise_')) {
    const parts = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce bouton ne t\'appartient pas.', ephemeral: true });
    }
    await interaction.showModal(changeMiseModal('vp', userId));
    return true;
  }

  // Modal mise
  if (customId.startsWith('vp_modal_') && interaction.isModalSubmit()) {
    const parts = customId.split('_');
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce modal ne t\'appartient pas.', ephemeral: true });
    }
    const rawMise = interaction.fields.getTextInputValue('newmise');
    const u = db.getUser(userId, interaction.guildId);
    const newMise = parseMise(rawMise, u?.balance || 0);
    if (!newMise || newMise < 10) {
      return interaction.reply({ content: '❌ Mise invalide (min 10 coins).', ephemeral: true });
    }
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false });
    await playVideoPoker(interaction, userId, interaction.guildId, newMise);
    return true;
  }

  // In-game button handling
  if (!customId.startsWith('vp_')) return;

  const parts = customId.split('_');
  const userId = parts.length > 2 ? parts[2] : null;

  if (!userId || interaction.user.id !== userId) {
    return interaction.reply({ content: '❌ Ce n\'est pas ta partie!', ephemeral: true });
  }

  await interaction.deferUpdate().catch(() => {});
  const st = getSession(userId);
  if (!st || st.phase !== 'hold') return;

  const action = parts[1];
  const msg = interaction.message;
  const guildId = interaction.guildId;
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '🪙';

  function buildHoldEmbed() {
    const handStr = st.hand.map(cardStr).join(' ');
    const { name, mult } = evalHand(st.hand);
    return new EmbedBuilder()
      .setColor('#8E44AD')
      .setTitle('🃏 ・ Video Poker — Jacks or Better ・')
      .setDescription(`**Ta main :**\n${handStr}\n\n*Clique sur les cartes à **garder**, puis appuie sur **Tirer** !*`)
      .addFields(
        { name: '🔍 Combinaison actuelle', value: `${name}${mult > 0 ? ` (×${mult})` : ''}`, inline: true },
        { name: '💰 Mise', value: `${st.mise} ${coin}`, inline: true },
      )
      .setFooter({ text: 'Sélectionnez 0 à 5 cartes à garder' });
  }

  function buildCardButtons() {
    return new ActionRowBuilder().addComponents(
      ...st.hand.map((c, i) =>
        new ButtonBuilder()
          .setCustomId(`vp_hold_${userId}_${i}`)
          .setLabel(`${c.value}${c.suit.replace(/[^♠♥♦♣]/g, '')} ${st.held[i] ? '✅' : ''}`)
          .setStyle(st.held[i] ? ButtonStyle.Success : ButtonStyle.Secondary)
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

  if (action === 'hold' && parts[3]) {
    // Toggle hold sur une carte
    const idx = parseInt(parts[3]);
    st.held[idx] = !st.held[idx];
    await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

  } else if (action === 'hold' && parts[3] === undefined) {
    // hold_all or hold_none
    if (customId.includes('hold_all')) {
      for (let k = 0; k < 5; k++) st.held[k] = true;
    } else if (customId.includes('hold_none')) {
      for (let k = 0; k < 5; k++) st.held[k] = false;
    }
    await msg.edit({ embeds: [buildHoldEmbed()], components: [buildCardButtons(), buildActionRow()] });

  } else if (action === 'draw') {
    // Tirer les nouvelles cartes
    st.phase = 'result';
    for (let k = 0; k < 5; k++) {
      if (!st.held[k]) st.hand[k] = st.deck.pop();
    }

    // Animation tirage AMÉLIORÉE — plus dramatique avec plusieurs frames
    const drawFrames = [
      { desc: '🎰 *Échange des cartes en cours...*\n\n🌀 🌀 🌀 🌀 🌀', color: '#8E44AD', delay: 300 },
      { desc: '✨ *Les cartes volent dans l\'air...*\n\n💨 💨 💨 💨 💨', color: '#6C3483', delay: 300 },
      { desc: '🃏 *Nouvelles cartes en place...*\n\n🌀 🌀 🌀 🌀 🌀', color: '#5B2C6F', delay: 200 },
    ];
    for (const frame of drawFrames) {
      const animEmbed = new EmbedBuilder().setColor(frame.color).setTitle('🃏 ・ Video Poker ・').setDescription(frame.desc);
      await msg.edit({ embeds: [animEmbed], components: [] });
      await sleep(frame.delay);
    }
    await sleep(300);

    const { name, mult } = evalHand(st.hand);
    const gain = Math.floor(st.mise * mult);
    if (gain > 0) db.addCoins(userId, guildId, gain);

    const handStr = st.hand.map(cardStr).join(' ');
    const color   = mult >= 9 ? '#F1C40F' : mult > 0 ? '#2ECC71' : '#E74C3C';
    const desc    = mult > 0
      ? `🎉 **${name}** ! +**${gain} ${coin}**`
      : `😔 **${name}**. -**${st.mise} ${coin}**`;

    const payoutTable = '`Royal Flush ×800` · `Quinte Flush ×50` · `Carré ×25`\n' +
                        '`Full House ×9` · `Couleur ×6` · `Quinte ×4`\n' +
                        '`Brelan ×3` · `Deux Paires ×2` · `Paire J+ ×1`';

    const finalEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🃏 ・ Video Poker — Résultat ・')
      .setDescription(`**Main finale :**\n${handStr}\n\n${desc}`)
      .addFields(
        { name: '🏆 Combinaison', value: name, inline: true },
        { name: '📈 Multiplicateur', value: `×${mult}`, inline: true },
        { name: '🏦 Solde', value: `${db.getUser(userId, guildId)?.balance || 0} ${coin}`, inline: true },
        { name: '📋 Table de paiement', value: payoutTable, inline: false }
      );

    const playAgainButtons = makeGameRow('vp', userId, st.mise);
    const paytableButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vp_paytable_${userId}`)
        .setLabel('🃏 Combinaisons')
        .setStyle(ButtonStyle.Secondary)
    );

    deleteSession(userId);
    await msg.edit({ embeds: [finalEmbed], components: [playAgainButtons, paytableButton] });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('videopoker')
    .setDescription('🃏 Video Poker — Jacks or Better, gardez vos meilleures cartes !')
    .addIntegerOption(o => o.setName('mise').setDescription('Mise (min 10)').setRequired(true).setMinValue(10)),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await playVideoPoker(interaction, interaction.user.id, interaction.guildId, interaction.options.getInteger('mise'));
  },

  async handleComponent(interaction) {
    return handleComponent(interaction);
  },

  name: 'videopoker',
  aliases: ['poker', 'vpoker', 'jacks'],
  async run(message, args) {
    const mise = parseInt(args[0]);
    if (!mise || mise < 10) return message.reply('❌ Usage : `&videopoker <mise>`\nEx: `&videopoker 200`');
    await playVideoPoker(message, message.author.id, message.guildId, mise);
  },
};
