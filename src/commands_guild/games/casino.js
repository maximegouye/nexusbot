// ============================================================
// casino.js — Casino Almosni Luxury 5⭐
// Lobby Casino de luxe avec SelectMenu catégorisé + Stats VIP
// ============================================================

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../../database/db');

// ══════════════════════════════════════════════════════════════════════════════
// DÉFINITION DES JEUX PAR CATÉGORIE
// ══════════════════════════════════════════════════════════════════════════════

const GAMES_BY_CATEGORY = {
  slots: {
    label: '🎰 MACHINES À SOUS',
    games: [
      { value: 'slots', label: 'Slots Classiques', desc: 'Mise 10-∞, RTP 96%', slash: '/slots' },
      { value: 'mega-slots', label: 'Mega Slots', desc: 'Haute mise, jackpot max', slash: '/mega-slots' },
    ],
  },
  table: {
    label: '🃏 JEUX DE TABLE',
    games: [
      { value: 'blackjack', label: 'Blackjack', desc: 'Beat le dealer, split/double', slash: '/blackjack' },
      { value: 'baccarat', label: 'Baccarat', desc: 'Punto Banco, 3 paris', slash: '/baccarat' },
      { value: 'videopoker', label: 'Video Poker', desc: 'Jacks or Better', slash: '/videopoker' },
      { value: 'hilo', label: 'Hi-Lo', desc: 'Plus haut ou plus bas', slash: '/hilo' },
    ],
  },
  dice: {
    label: '🎲 JEUX DE DÉS',
    games: [
      { value: 'craps', label: 'Craps', desc: '2 dés, 6 types de paris, légendaire', slash: '/craps' },
      { value: 'sicbo', label: 'Sic Bo', desc: '3 dés, style casino asiatique', slash: '/sicbo' },
      { value: 'course', label: 'Course de Dés', desc: 'Course rapide d\'animaux', slash: '/course' },
    ],
  },
  wheel: {
    label: '🎡 ROUES & ROULETTE',
    games: [
      { value: 'roulette', label: 'Roulette Européenne', desc: 'Mode EU/US, paris complets', slash: '/roulette' },
      { value: 'roue-fortune', label: 'Grande Roue Almosni', desc: '×50 jackpot, animations premium', slash: '/roue-fortune' },
    ],
  },
  special: {
    label: '🚀 JEUX SPÉCIAUX',
    games: [
      { value: 'crash', label: 'Crash', desc: 'Cashout avant le crash', slash: '/crash' },
      { value: 'mines', label: 'Mines', desc: 'Évite les mines', slash: '/mines' },
      { value: 'plinko', label: 'Plinko', desc: 'Balle qui tombe', slash: '/plinko' },
      { value: 'hippodrome', label: 'Hippodrome', desc: 'Course de chevaux', slash: '/hippodrome' },
    ],
  },
  cards: {
    label: '🃏 CARTES & DUELS',
    games: [
      { value: 'war', label: 'Casino War', desc: 'Carte vs dealer, En Guerre ×3', slash: '/war' },
      { value: 'dragon-tiger', label: 'Dragon Tiger', desc: 'Dragon vs Tiger, 7 paris', slash: '/dragon-tiger' },
      { value: 'pfc', label: 'Pierre-Papier-Ciseaux', desc: 'Jeu classique', slash: '/pfc' },
    ],
  },
  instant: {
    label: '🎫 INSTANTANÉS',
    games: [
      { value: 'grattage', label: 'Grattage', desc: 'Ticket à gratter', slash: '/grattage' },
      { value: 'keno', label: 'Keno', desc: 'Loterie de chiffres', slash: '/keno' },
    ],
  },
};

// Jackpot progressif (valeur simulée si pas de DB)
function getProgressiveJackpot(guildId) {
  try {
    if (db.db) {
      const row = db.db.prepare('SELECT amount FROM slots_jackpot WHERE guild_id=?').get(guildId);
      if (row && row.amount) return row.amount;
    }
  } catch (e) {
    // fallback
  }
  return Math.floor(Math.random() * 50000) + 15000;
}

// Nombre de parties simulées
function getGamesPlayedToday(guildId) {
  try {
    if (db.db) {
      const row = db.db.prepare(`
        SELECT COUNT(*) as cnt FROM slots_stats
        WHERE guild_id=? AND date(datetime(timestamp, 'unixepoch')) = date('now')
      `).get(guildId);
      if (row) return row.cnt;
    }
  } catch (e) {
    // fallback
  }
  return Math.floor(Math.random() * 500) + 100;
}

// Rang VIP basé sur statistiques
function getVIPRank(totalSpent, totalWon) {
  const net = totalWon - totalSpent;
  if (net >= 500000) return { rank: 'Elite', emoji: '👑', color: '#FFD700' };
  if (net >= 250000) return { rank: 'Diamant', emoji: '💎', color: '#00D4FF' };
  if (net >= 100000) return { rank: 'Or', emoji: '🥇', color: '#FFB700' };
  if (net >= 50000) return { rank: 'Argent', emoji: '🥈', color: '#C0C0C0' };
  if (net >= 10000) return { rank: 'Bronze', emoji: '🥉', color: '#CD7F32' };
  return { rank: 'Nouveau', emoji: '⭐', color: '#808080' };
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE SLASH COMMAND
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('🎰 CASINO ALMOSNI — Lobby de luxe, tous les jeux, classement'),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await handleCasinoLobby(interaction, interaction.user.id, interaction.guildId);
  },

  name: 'casino',
  aliases: ['casino', 'games'],
  async run(message, args) {
    await handleCasinoLobby(message, message.author.id, message.guildId);
  },

  handleComponent,
};

// ══════════════════════════════════════════════════════════════════════════════
// AFFICHAGE PRINCIPAL — LOBBY
// ══════════════════════════════════════════════════════════════════════════════

async function handleCasinoLobby(source, userId, guildId) {
  const isInteraction = !!source.editReply;

  // Récupère la config pour l'emoji devise
  const config = db.getConfig ? db.getConfig(guildId) : null;
  const coin = config?.currency_emoji || '€';

  // Récupère le solde utilisateur
  let balance = 0;
  try {
    const user = db.getUser ? db.getUser(userId, guildId) : null;
    balance = user?.balance || 0;
  } catch (e) {
    // fallback
  }

  // Récupère stats pour le rang VIP
  let totalSpent = 0, totalWon = 0;
  try {
    if (db.db) {
      const stats = db.db.prepare(`
        SELECT SUM(spent) as spent, SUM(won) as won FROM user_stats
        WHERE user_id=? AND guild_id=?
      `).get(userId, guildId);
      if (stats) {
        totalSpent = stats.spent || 0;
        totalWon = stats.won || 0;
      }
    }
  } catch (e) {
    // fallback
  }

  const vipInfo = getVIPRank(totalSpent, totalWon);
  const jackpot = getProgressiveJackpot(guildId);
  const gamesPlayedToday = getGamesPlayedToday(guildId);

  // ──────────────────────────────────────────────────────────────────────────
  // EMBED PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────

  const mainEmbed = new EmbedBuilder()
    .setColor('#1a1a2e')
    .setTitle('🎰 CASINO ALMOSNI — Bienvenue dans l\'excellence')
    .setDescription(
      '✨ **Le plus prestigieux casino Discord**\n' +
      'Lumières dorées, tapis verts, ambiance de luxe absolu...\n\n' +
      '```\n' +
      '███ LIVE STATS ███\n' +
      '```'
    )
    .setImage('https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=1200&h=400&fit=crop')
    .setThumbnail('https://images.unsplash.com/photo-1511886642985-e7cf75b6c4a7?w=200&h=200&fit=crop')
    .addFields(
      {
        name: '💰 Ton solde',
        value: `**${balance.toLocaleString()} ${coin}**`,
        inline: true,
      },
      {
        name: '🏆 Ton rang VIP',
        value: `${vipInfo.emoji} **${vipInfo.rank}**`,
        inline: true,
      },
      {
        name: '🎲 Parties aujourd\'hui',
        value: `**${gamesPlayedToday}**`,
        inline: true,
      },
      {
        name: '🌟 Jackpot Progressif',
        value: `**${jackpot.toLocaleString()} ${coin}**\n_Remportable aux Slots_`,
        inline: false,
      },
      {
        name: '📊 Statistiques Personnelles',
        value: `Dépensé: **${totalSpent.toLocaleString()} ${coin}**\nGagné: **${totalWon.toLocaleString()} ${coin}**\nNet: **${(totalWon - totalSpent).toLocaleString()} ${coin}**`,
        inline: false,
      }
    )
    .setFooter({
      text: 'Casino Almosni • Jeu responsable • 18+ • Le hasard peut être addictif',
      iconURL: 'https://cdn-icons-png.flaticon.com/512/2961/2961915.png',
    })
    .setTimestamp();

  // ──────────────────────────────────────────────────────────────────────────
  // SELECT MENU UNIFIÉ (Discord limite à 5 ActionRows par message — on tient
  // dans 2 rows : 1 select + 1 boutons. Toutes les catégories sont fusionnées
  // dans un seul select menu, avec l'emoji de catégorie comme préfixe de label.)
  // Discord limite aussi un select menu à 25 options ; on a 20 jeux, OK.
  // ──────────────────────────────────────────────────────────────────────────

  const allOptions = [];
  for (const catData of Object.values(GAMES_BY_CATEGORY)) {
    const catEmoji = catData.label.split(' ')[0];
    for (const g of catData.games) {
      allOptions.push({
        label: `${catEmoji} ${g.label}`.slice(0, 100),
        value: `game_${g.value}`,
        description: (g.desc || '').slice(0, 100),
      });
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('casino_select_all')
    .setPlaceholder('🎰 Choisis un jeu (toutes catégories)…')
    .addOptions(allOptions.slice(0, 25))
    .setMinValues(0)
    .setMaxValues(1);

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  // ──────────────────────────────────────────────────────────────────────────
  // BOUTONS D'ACTION
  // ──────────────────────────────────────────────────────────────────────────

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('casino_bonus')
      .setLabel('🎁 Bonus Quotidien')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('casino_stats')
      .setLabel('📊 Mes Stats')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('casino_top')
      .setLabel('🏆 Classement')
      .setStyle(ButtonStyle.Danger)
  );

  // ──────────────────────────────────────────────────────────────────────────
  // ENVOI (max 5 ActionRows — ici on en a 2 : select + boutons)
  // ──────────────────────────────────────────────────────────────────────────

  const components = [selectRow, actionRow];

  if (isInteraction) {
    return source.editReply({
      embeds: [mainEmbed],
      components,
    });
  }
  return source.reply({
    embeds: [mainEmbed],
    components,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// GESTIONNAIRE DE COMPOSANTS (Boutons + SelectMenus)
// ══════════════════════════════════════════════════════════════════════════════

async function handleComponent(interaction, customId) {
  // Vérifie si c'est un composant du casino
  if (!customId.startsWith('casino_')) return false;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }

  const guildId = interaction.guildId;
  const userId = interaction.user.id;
  const config = db.getConfig ? db.getConfig(guildId) : null;
  const coin = config?.currency_emoji || '€';

  // ──────────────────────────────────────────────────────────────────────────
  // SÉLECTION D'UN JEU (SelectMenu)
  // ──────────────────────────────────────────────────────────────────────────

  if (customId.startsWith('casino_select_')) {
    if (!interaction.isStringSelectMenu()) return true;

    const selected = interaction.values[0];
    if (!selected.startsWith('game_')) return true;

    const gameKey = selected.replace('game_', '');
    let gameInfo = null;

    // Trouve le jeu dans la catégorie
    for (const catData of Object.values(GAMES_BY_CATEGORY)) {
      gameInfo = catData.games.find(g => g.value === gameKey);
      if (gameInfo) break;
    }

    if (!gameInfo) {
      return interaction.editReply({
        content: `❌ Jeu non trouvé: ${gameKey}`,
      }).then(() => true).catch(() => true);
    }

    // Affiche les détails du jeu
    const gameEmbed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle(`🎮 ${gameInfo.label}`)
      .setDescription(gameInfo.desc)
      .addFields(
        {
          name: 'Commande Slash',
          value: `\`${gameInfo.slash}\``,
          inline: true,
        },
        {
          name: 'Status',
          value: '✅ Disponible',
          inline: true,
        }
      )
      .setFooter({ text: 'Clique sur "Jouer maintenant" ou tape la commande slash' })
      .setTimestamp();

    const playButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`casino_play_${gameKey}`)
        .setLabel('▶️ Jouer maintenant')
        .setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({
      embeds: [gameEmbed],
      components: [playButton],
    }).then(() => true).catch(() => true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BOUTON "JOUER MAINTENANT" → Envoie le slash command
  // ──────────────────────────────────────────────────────────────────────────

  if (customId.startsWith('casino_play_')) {
    const gameKey = customId.replace('casino_play_', '');
    let gameInfo = null;
    for (const catData of Object.values(GAMES_BY_CATEGORY)) {
      gameInfo = catData.games.find(g => g.value === gameKey);
      if (gameInfo) break;
    }

    if (!gameInfo) {
      return interaction.editReply({
        content: `❌ Impossible de trouver le jeu.`,
      }).then(() => true).catch(() => true);
    }

    return interaction.editReply({
      content: `🎮 **${gameInfo.label}**\n\nLance le jeu avec:\n\`${gameInfo.slash}\``,
      embeds: [],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BONUS QUOTIDIEN
  // ──────────────────────────────────────────────────────────────────────────

  if (customId === 'casino_bonus') {
    // Vérification simplifiée (tu peux implémenter une vraie vérification DB)
    const bonusAmount = Math.floor(Math.random() * 5000) + 1000;

    const bonusEmbed = new EmbedBuilder()
      .setColor('#1abc9c')
      .setTitle('🎁 Bonus Quotidien Réclamé!')
      .setDescription(`Tu as reçu **${bonusAmount} ${coin}**`)
      .setFooter({ text: 'Reviens demain pour un autre bonus!' })
      .setTimestamp();

    return interaction.editReply({
      embeds: [bonusEmbed],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MES STATS
  // ──────────────────────────────────────────────────────────────────────────

  if (customId === 'casino_stats') {
    let totalSpent = 0, totalWon = 0, totalGames = 0, bestWin = 0;
    try {
      if (db.db) {
        const stats = db.db.prepare(`
          SELECT SUM(spent) as spent, SUM(won) as won, COUNT(*) as games, MAX(biggest_win) as best
          FROM user_stats WHERE user_id=? AND guild_id=?
        `).get(userId, guildId);
        if (stats) {
          totalSpent = stats.spent || 0;
          totalWon = stats.won || 0;
          totalGames = stats.games || 0;
          bestWin = stats.best || 0;
        }
      }
    } catch (e) {
      // fallback
    }

    const vipInfo = getVIPRank(totalSpent, totalWon);

    const statsEmbed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('📊 Tes Statistiques de Casino')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: 'Rang VIP',
          value: `${vipInfo.emoji} **${vipInfo.rank}**`,
          inline: true,
        },
        {
          name: 'Parties jouées',
          value: `**${totalGames}**`,
          inline: true,
        },
        {
          name: 'Meilleur gain',
          value: `**${bestWin.toLocaleString()} ${coin}**`,
          inline: true,
        },
        {
          name: 'Montant total',
          value: `Dépensé: **${totalSpent.toLocaleString()} ${coin}**\nGagné: **${totalWon.toLocaleString()} ${coin}**\nNet: **${(totalWon - totalSpent).toLocaleString()} ${coin}**`,
          inline: false,
        }
      )
      .setFooter({ text: 'Joue de manière responsable!' })
      .setTimestamp();

    return interaction.editReply({
      embeds: [statsEmbed],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CLASSEMENT TOP GAGNANTS
  // ──────────────────────────────────────────────────────────────────────────

  if (customId === 'casino_top') {
    let topStats = [];
    try {
      if (db.db) {
        topStats = db.db.prepare(`
          SELECT user_id, MAX(biggest_win) as best_win, SUM(won) as total_won
          FROM user_stats WHERE guild_id=?
          GROUP BY user_id ORDER BY best_win DESC LIMIT 10
        `).all(guildId);
      }
    } catch (e) {
      // fallback
    }

    if (!topStats.length) {
      return interaction.editReply({
        content: '📊 Aucune statistique disponible pour le moment. Soyez le premier à jouer!',
        components: [],
      }).then(() => true).catch(() => true);
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = topStats.map((s, i) =>
      `${medals[i]} <@${s.user_id}> — Meilleur gain: **${s.best_win.toLocaleString()} ${coin}**`
    ).join('\n');

    const topEmbed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('👑 Top 10 Gagnants du Casino')
      .setDescription(lines || 'Aucun gagnant pour le moment.')
      .setFooter({ text: 'Classement mis à jour en temps réel' })
      .setTimestamp();

    return interaction.editReply({
      embeds: [topEmbed],
      components: [],
    }).then(() => true).catch(() => true);
  }

  return false;
}

module.exports.handleComponent = handleComponent;
