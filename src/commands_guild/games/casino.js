// ============================================================
// casino.js — Hub Casino central + classement
// Emplacement : src/commands_guild/games/casino.js
// ============================================================

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

const GAMES = [
  { name: 'Blackjack',    cmd: '/blackjack',   prefix: '&blackjack',   emoji: '🃏', desc: 'Battez le croupier · Split / Double / Insurance',   payout: '×2 (BJ: ×2.5)' },
  { name: 'Roulette',     cmd: '/roulette',     prefix: '&roulette',    emoji: '🎡', desc: 'Roue européenne · Paris simples, doubles, 35:1',    payout: 'Jusqu\'à ×36' },
  { name: 'Slots',        cmd: '/slots',        prefix: '&slots',       emoji: '🎰', desc: '5 rouleaux · Wilds · Jackpot progressif',           payout: 'Jackpot: illimité' },
  { name: 'Crash',        cmd: '/crash',        prefix: '&crash',       emoji: '🚀', desc: 'Multiplicateur en temps réel · Cash-out avant le crash', payout: 'Jusqu\'à ×100' },
  { name: 'Mines',        cmd: '/mines',        prefix: '&mines',       emoji: '💣', desc: 'Grille 5×5 · Évitez les bombes · Multiplicateur croissant', payout: 'Jusqu\'à ×24' },
  { name: 'Plinko',       cmd: '/plinko',       prefix: '&plinko',      emoji: '🎯', desc: 'Lâchez la bille · Animation chute rangée par rangée', payout: 'Jusqu\'à ×29' },
  { name: 'Video Poker',  cmd: '/videopoker',   prefix: '&videopoker',  emoji: '🎴', desc: 'Jacks or Better · Gardez vos meilleures cartes',   payout: 'Royal Flush: ×800' },
  { name: 'Baccarat',     cmd: '/baccarat',     prefix: '&baccarat',    emoji: '🎲', desc: 'Joueur / Banquier / Égalité · Règles authentiques', payout: 'Égalité: ×9' },
  { name: 'Dés',          cmd: '/des',          prefix: '&des',         emoji: '🎲', desc: 'Pariez sur le résultat · 1 ou 2 dés · Somme exacte', payout: 'Exact: ×5.5' },
  { name: 'Pile ou Face', cmd: '/pile-ou-face', prefix: '&pile-ou-face',emoji: '💰', desc: '50/50 · Choisissez votre côté ou laissez le hasard', payout: '×2' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('🎪 Casino — Tous les jeux disponibles et leurs statistiques')
    .addSubcommand(s => s.setName('jeux').setDescription('📋 Liste de tous les jeux du casino'))
    .addSubcommand(s => s.setName('jackpot').setDescription('🏆 Voir le jackpot progressif actuel des slots'))
    .addSubcommand(s => s.setName('top').setDescription('👑 Classement des plus grands gagnants')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    const sub = interaction.options.getSubcommand();
    await handleCasino(interaction, interaction.user.id, interaction.guildId, sub);
  },

  name: 'casino',
  aliases: ['jeux', 'games'],
  async run(message, args) {
    const sub = args[0] || 'jeux';
    await handleCasino(message, message.author.id, message.guildId, sub);
  },
};

async function handleCasino(source, userId, guildId, sub) {
  const isInteraction = !!source.editReply;
  const coin = (db.getConfig ? db.getConfig(guildId) : null)?.currency_emoji || '€';

  if (sub === 'jeux' || sub === 'list' || sub === 'aide') {
    const gameList = GAMES.map(g =>
      `${g.emoji} **${g.name}** · ${g.desc}\n` +
      `  └ ${g.cmd} · \`${g.prefix}\` · Paiement: ${g.payout}`
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('#F39C12')
      .setTitle('🎪 ・ Casino NexusBot ・')
      .setDescription(`**${GAMES.length} jeux disponibles** — utilisez \`/commande\` ou \`&commande\`\n\n${gameList}`)
      .setFooter({ text: 'Jouez de manière responsable · 18+ uniquement · Jeux fictifs' })
      .setTimestamp();

    if (isInteraction) return source.editReply({ embeds: [embed], ephemeral: true });
    return source.reply({ embeds: [embed] });
  }

  if (sub === 'jackpot') {
    let jackpot = 5000;
    try {
      const row = db.db.prepare('SELECT amount FROM slots_jackpot WHERE guild_id=?').get(guildId);
      jackpot = row ? row.amount : 5000;
    } catch {}

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('🏆 ・ Jackpot Progressif ・')
      .setDescription(`# 🏆 ${jackpot.toLocaleString()} ${coin}`)
      .addFields({ name: '🎰 Comment le gagner', value: 'Faites **5 💎 Diamants** sur la ligne centrale des Slots !\nChaque mise sur les Slots alimente le jackpot.', inline: false })
      .setFooter({ text: 'Le jackpot repart de 5 000 € après chaque victoire' })
      .setTimestamp();

    if (isInteraction) return source.editReply({ embeds: [embed] });
    return source.reply({ embeds: [embed] });
  }

  if (sub === 'top' || sub === 'classement') {
    let stats = [];
    try {
      stats = db.db.prepare(`
        SELECT user_id, SUM(wins) as total_wins, MAX(biggest) as best_win, SUM(jackpots) as total_jackpots
        FROM slots_stats WHERE guild_id=?
        GROUP BY user_id ORDER BY best_win DESC LIMIT 10
      `).all(guildId);
    } catch {}

    if (!stats.length) {
      const msg = '📊 Aucune statistique disponible pour le moment.';
      if (isInteraction) return source.editReply({ content: msg, ephemeral: true });
      return source.reply(msg);
    }

    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const lines  = stats.map((s, i) =>
      `${medals[i]} <@${s.user_id}> — Plus gros gain: **${s.best_win} ${coin}** · Jackpots: **${s.total_jackpots}** · Victoires Slots: **${s.total_wins}**`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('👑 ・ Top Gagnants Casino ・')
      .setDescription(lines)
      .setTimestamp();

    if (isInteraction) return source.editReply({ embeds: [embed] });
    return source.reply({ embeds: [embed] });
  }
}

// ── handleComponent pour les boutons du panel casino ─────────────────────────
const CASINO_GAME_MAP = {
  'casino_bj':     { label: 'Blackjack',   slash: '/blackjack',   prefix: '&blackjack'   },
  'casino_poker':  { label: 'Poker',        slash: '/poker',       prefix: '&poker'       },
  'casino_roul':   { label: 'Roulette',     slash: '/roulette',    prefix: '&roulette'    },
  'casino_roue':   { label: 'Roue',         slash: '/roue',        prefix: '&roue'        },
  'casino_slots':  { label: 'Slots',        slash: '/slots',       prefix: '&slots'       },
  'casino_mines':  { label: 'Mines',        slash: '/mines',       prefix: '&mines'       },
  'casino_crash':  { label: 'Crash',        slash: '/crash',       prefix: '&crash'       },
  'casino_des':    { label: 'Dés',          slash: '/des',         prefix: '&des'         },
  'casino_crypto': { label: 'Crypto',       slash: '/crypto',      prefix: '&crypto'      },
};

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('casino_')) return false;

  const base = customId.split(':')[0]; // retire éventuel :userId

  // Bouton stats détaillées
  if (base === 'casino_stats') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const client = interaction.client;
    const statsCmd = client.commands.get('casino-stats') || client.commands.get('casinostats') || client.commands.get('casino');
    if (statsCmd && typeof statsCmd.execute === 'function') {
      // Appel direct impossible (pas de slash options) → message guide
    }
    return interaction.editReply({
      content: '📊 Utilise `/casino-stats` pour voir tes statistiques détaillées.',
    }).then(() => true).catch(() => true);
  }

  // Bouton top gagnants
  if (base === 'casino_top') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    try {
      await handleCasino(interaction, interaction.user.id, interaction.guildId, 'top');
    } catch (_) {
      await interaction.editReply({ content: '🏆 Utilise `/casino top` pour voir le classement.' }).catch(() => {});
    }
    return true;
  }

  // Boutons de jeu → guide rapide
  const game = CASINO_GAME_MAP[base];
  if (game) {
    await interaction.editReply({
      content: `🎮 **${game.label}** — Lance le jeu avec :\n• Slash : \`${game.slash} <mise>\`\n• Préfixe : \`${game.prefix} <mise>\``,
      ephemeral: true,
    }).catch(() => {});
    return true;
  }

  return false;
}

module.exports.handleComponent = handleComponent;
