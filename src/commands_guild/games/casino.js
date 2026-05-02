// ============================================================
// casino.js — Casino Almosni Luxury 5⭐ v3
// Lobby premium · Jeux de casino UNIQUEMENT · Visuels époustouflants
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
// CATALOGUE DES JEUX — Casino purs uniquement (pas de scratch, pas de PFC...)
// Chaque jeu a : art ASCII, description longue, RTP, gain max, tip stratégie
// ══════════════════════════════════════════════════════════════════════════════

const GAMES_BY_CATEGORY = {
  slots: {
    label: '🎰 MACHINES À SOUS',
    games: [
      {
        value: 'slots', label: 'Slots Classiques', desc: '5 rouleaux · Wilds · Free Spins · Jackpot · RTP 96%',
        art: [
          '╔══════════════════════╗',
          '║  🎰  ALMOSNI SLOTS   ║',
          '╠══╦════╦════╦════╦════╣',
          '║  ║ 🍒 ║ 💎 ║ 7️⃣  ║ 🔔 ║',
          '║▶ ║ 🃏 ║ ⭐ ║ 🍇 ║ 💎 ║ ◀',
          '║  ║ 🍋 ║ 🍊 ║ 🎴 ║ 🏆 ║',
          '╚══╩════╩════╩════╩════╝',
          '   💰  INSERT COINS  💰  ',
        ],
        rules: '**5 rouleaux × 3 lignes** — Aligne des symboles identiques sur une payline pour gagner.\n🃏 **WILD** remplace tout · 🌠 **SCATTER** = Free Spins · 🎁 **BONUS** = mini-jeu',
        rtp: '96%', maxWin: '×500', tip: '💡 Active le max de lignes pour ne pas rater une combo !',
        slash: '/slots', pari: null,
      },
      {
        value: 'mega-slots', label: 'Mega Slots', desc: 'Jackpots massifs · Gains ×1000 · Ultra-volatilité',
        art: [
          '╔══════════════════════╗',
          '║  💎  MEGA  SLOTS  💎  ║',
          '╠══════════════════════╣',
          '║  7️⃣  ║  💎  ║  7️⃣   ║',
          '║ 7️⃣7️⃣7️⃣ ║ 💎💎💎 ║ 7️⃣7️⃣7️⃣  ║',
          '║  💎  ║  7️⃣  ║  💎   ║',
          '╠══════════════════════╣',
          '║  🏆  JACKPOT MAX  🏆  ║',
          '╚══════════════════════╝',
        ],
        rules: 'Machines à sous premium avec volatilité extrême. Jackpot progressif toujours actif. **Mise haute = jackpot plus accessible.**',
        rtp: '95%', maxWin: '×1000+', tip: '💡 Mise plus élevée = contribution jackpot plus forte !',
        slash: '/mega-slots', pari: null,
      },
    ],
  },
  table: {
    label: '🃏 JEUX DE TABLE',
    games: [
      {
        value: 'blackjack', label: 'Blackjack', desc: 'Beat le dealer · Split · Double · Assurance · RTP 99.5%',
        art: [
          '╔═════════════════════╗',
          '║   🃏  BLACKJACK  🃏   ║',
          '╠═════════════════════╣',
          '║  DEALER: [🂠] + 🂾   ║',
          '║  ─────────────────  ║',
          '║  TOI:  🂳  +  🂺     ║',
          '║         = 13        ║',
          '╠═════════════════════╣',
          '║ Tirer? ██ Rester? ██║',
          '╚═════════════════════╝',
        ],
        rules: '**Objectif :** approcher 21 sans dépasser, battre le dealer.\n**Blackjack** (As + figure) paie ×2.5 · **Split** (2 cartes identiques) · **Double Down** (doubler en tirant 1 carte) · **Assurance** si dealer montre un As',
        rtp: '99.5%', maxWin: '×2.5 (Blackjack)', tip: '💡 Toujours "split" les As et les 8 !',
        slash: '/blackjack', pari: null,
      },
      {
        value: 'baccarat', label: 'Baccarat — Punto Banco', desc: '3 paris · Joueur/Banque/Égalité · RTP 98.9%',
        art: [
          '╔═════════════════════╗',
          '║  🎴  BACCARAT  🎴    ║',
          '╠═════════════════════╣',
          '║  PUNTO  ║  BANCO    ║',
          '║ 🂳  🂺    ║ 🂾  🂱     ║',
          '║   = 3   ║   = 7    ║',
          '╠═════════════════════╣',
          '║ Joueur×2 · Banque×2 ║',
          '║   Égalité × 9       ║',
          '╚═════════════════════╝',
        ],
        rules: '**Pariez sur Joueur, Banque ou Égalité.** La main la plus proche de 9 gagne.\n🃏 Figures/10 = 0 · As = 1 · Le reste = valeur nominale\n**Banque** gagne légèrement plus souvent → pari le plus sûr.',
        rtp: '98.9%', maxWin: '×9 (Égalité)', tip: '💡 Le pari Banque a le meilleur RTP malgré la commission !',
        slash: '/baccarat', pari: 'joueur',
      },
      {
        value: 'videopoker', label: 'Video Poker', desc: 'Jacks or Better · Discards · Paytable complet · RTP 99.5%',
        art: [
          '╔═════════════════════╗',
          '║  🃏  VIDEO POKER  🃏  ║',
          '╠═════════════════════╣',
          '║  🂳  🂴  🂵  🂶  🂷     ║',
          '║  3♠  4♠  5♠  6♠  7♠  ║',
          '║    QUINTE FLUSH !    ║',
          '╠═════════════════════╣',
          '║  Paire J+  → ×2     ║',
          '║  Full House→ ×9     ║',
          '║  Quinte Fl.→ ×50    ║',
          '╚═════════════════════╝',
        ],
        rules: '5 cartes distribuées. Garde les meilleures, échange les autres. **Paire de Valets minimum** pour gagner.\nMain Royale = gain maximum absolu.',
        rtp: '99.5%', maxWin: '×800 (Royal Flush)', tip: '💡 Garde toujours une paire même faible plutôt que rien !',
        slash: '/videopoker', pari: null,
      },
      {
        value: 'hilo', label: 'Hi-Lo', desc: 'Plus haut ou plus bas · Multiplicateur croissant · Risque pur',
        art: [
          '╔═════════════════════╗',
          '║   🃏   HI - LO   🃏   ║',
          '╠═════════════════════╣',
          '║   Carte actuelle:   ║',
          '║        🂾            ║',
          '║        ROI           ║',
          '╠═════════════════════╣',
          '║  ⬆️ HIGHER  LOWER ⬇️  ║',
          '║   ×1.2    ×1.2      ║',
          '╚═════════════════════╝',
        ],
        rules: 'Une carte est révélée. Parie si la prochaine sera **plus haute** ou **plus basse**.\nChaque bonne réponse **multiplie tes gains**. Quand tu veux, tu encaisses !',
        rtp: '96%', maxWin: '×infini (théorique)', tip: '💡 Encaisse tôt ! Les séries longues sont rares.',
        slash: '/hilo', pari: null,
      },
    ],
  },
  dice: {
    label: '🎲 JEUX DE DÉS',
    games: [
      {
        value: 'craps', label: 'Craps', desc: '2 dés · Pass/Don\'t Pass · 6 paris · Casino emblématique',
        art: [
          '╔═════════════════════╗',
          '║    🎲  C R A P S  🎲  ║',
          '╠═════════════════════╣',
          '║   ┌───┐   ┌───┐    ║',
          '║   │ ⚅ │   │ ⚄ │    ║',
          '║   └───┘   └───┘    ║',
          '║        = 11         ║',
          '╠═════════════════════╣',
          '║ Pass · Don\'t · Come  ║',
          '║ Field · Big 6/8     ║',
          '╚═════════════════════╝',
        ],
        rules: 'Lance 2 dés. **Come-out roll :** 7 ou 11 = gagné sur Pass · 2, 3, 12 = perdu.\nSi autre nombre → c\'est le **Point**. Relance jusqu\'à faire le Point (gagne) ou un 7 (perd).',
        rtp: '98.6%', maxWin: '×30 (Any Seven)', tip: '💡 Le pari Pass Line est le plus rentable du casino !',
        slash: '/craps', pari: 'pass',
      },
      {
        value: 'sicbo', label: 'Sic Bo', desc: '3 dés · Style casino asiatique · 15+ types de paris',
        art: [
          '╔═════════════════════╗',
          '║  🎲  S I C  B O  🎲  ║',
          '╠═════════════════════╣',
          '║  ┌──┐  ┌──┐  ┌──┐  ║',
          '║  │⚄ │  │⚂ │  │⚅ │  ║',
          '║  └──┘  └──┘  └──┘  ║',
          '║   2  +  3  +  6     ║',
          '╠═════════════════════╣',
          '║ Small(4-10) × 1     ║',
          '║ Triple     × 150    ║',
          '╚═════════════════════╝',
        ],
        rules: '3 dés lancés simultanément. Paris sur la somme, les doubles, les triples, les combinaisons...\n**Small** (4-10) ou **Big** (11-17) = paris les plus sûrs · Triple = gain maximum.',
        rtp: '97.2%', maxWin: '×150 (Triple)', tip: '💡 Small/Big sont les paris les plus sûrs pour commencer !',
        slash: '/sicbo', pari: 'small',
      },
    ],
  },
  wheel: {
    label: '🎡 ROUES & ROULETTE',
    games: [
      {
        value: 'roulette', label: 'Roulette Européenne', desc: 'Roue animée · 37 numéros · Paris complets · RTP 97.3%',
        art: [
          '         ▼  POINTEUR  ▼          ',
          ' ⚫0 🔴32 ⚫15 🔴19 ⚫4 🔴21 ⚫2 ',
          '  ╔════════════════════════╗    ',
          '  ║ ⚪ La bille tourne...  ║    ',
          '  ║    🎡 ROULETTE ROYALE  ║    ',
          '  ╚════════════════════════╝    ',
          ' 🔴25 ⚫17 🔴34 ⚫6 🔴27 ⚫13  ',
          '                                ',
          '  ROUGE·NOIR·PAIR·IMPAIR·PLEIN  ',
        ],
        rules: '37 numéros (0-36). La bille tourne et se pose sur un numéro au hasard.\n🔴/⚫ × 2 · Douzaines × 3 · Colonnes × 3 · **Plein sur 1 numéro × 36**\nParis multiples possibles : `rouge,d1,17`',
        rtp: '97.3%', maxWin: '×36 (Plein)', tip: '💡 Paris multiples : `rouge` + `d1` couvre 24/37 numéros !',
        slash: '/roulette mise:X pari:rouge', pari: 'rouge',
      },
      {
        value: 'roue-fortune', label: 'Grande Roue Almosni', desc: 'Jackpot ×50 · Animations premium · Secteurs spéciaux',
        art: [
          '╔═══════════════════════╗',
          '║  🎡  GRANDE ROUE  🎡   ║',
          '╠═══════════════════════╣',
          '║       ▼               ║',
          '║  ×2│×1│×5│×1│×50│×1  ║',
          '║  ×1│×3│×1│×2│×1 │×10 ║',
          '║       ▲               ║',
          '╠═══════════════════════╣',
          '║  Jackpot ALMOSNI ×50  ║',
          '╚═══════════════════════╝',
        ],
        rules: 'La roue de la fortune tourne ! Chaque secteur a un multiplicateur.\n**Secteur dorés rares :** ×50 jackpot · **×10** · **×5**\nParis libres, mise minimale faible.',
        rtp: '96%', maxWin: '×50 (Jackpot)', tip: '💡 Plus tu mises, plus ton jackpot potentiel est grand !',
        slash: '/roue-fortune', pari: null,
      },
    ],
  },
  special: {
    label: '🚀 JEUX MODERNES',
    games: [
      {
        value: 'crash', label: 'Crash', desc: 'Multiplicateur monte · Cashout avant le crash · Adrénaline pure',
        art: [
          '╔══════════════════════╗',
          '║   🚀  C R A S H  🚀   ║',
          '╠══════════════════════╣',
          '║   📈              💥  ║',
          '║         ×4.72        ║',
          '║      ×2.1            ║',
          '║   ×1.3               ║',
          '║ ×1.0 ──────────────► ║',
          '╠══════════════════════╣',
          '║  CASHOUT avant CRASH ║',
          '╚══════════════════════╝',
        ],
        rules: 'Un multiplicateur monte de ×1.0 vers l\'infini... jusqu\'au CRASH.\n**Cashout à n\'importe quel moment** pour empocher le multiplicateur actuel.\nAttends trop longtemps → tu perds tout !',
        rtp: '97%', maxWin: '×1000+ (rare)', tip: '💡 Cashout à ×1.5-×2.0 = stratégie la plus rentable long terme !',
        slash: '/crash', pari: null,
      },
      {
        value: 'mines', label: 'Mines', desc: 'Grille minée · Révèle des cases · Plus tu continues, plus tu gagnes',
        art: [
          '╔═══════════════════════╗',
          '║   💣   M I N E S   💣  ║',
          '╠═══════════════════════╣',
          '║  💎  💣  💎  ❓  ❓   ║',
          '║  ❓  💎  ❓  💎  💣   ║',
          '║  ❓  ❓  💎  ❓  ❓   ║',
          '║  💣  ❓  ❓  💎  ❓   ║',
          '║  ❓  ❓  💣  ❓  ❓   ║',
          '╠═══════════════════════╣',
          '║  Révèle · Encaisse !  ║',
          '╚═══════════════════════╝',
        ],
        rules: 'Une grille contient des **mines** cachées et des **diamants**.\nRévèle des cases : chaque diamant **multiplie tes gains**.\nTouche une mine → tu perds tout. **Encaisse quand tu veux !**',
        rtp: '97%', maxWin: '×1000+ (variable)', tip: '💡 Moins de mines = plus sûr. Plus de mines = plus rentable !',
        slash: '/mines', pari: null,
      },
      {
        value: 'plinko', label: 'Plinko', desc: 'Balle qui tombe · Slots à multiplicateurs · Chute aléatoire',
        art: [
          '╔══════════════════════╗',
          '║   🎱  P L I N K O    ║',
          '╠══════════════════════╣',
          '║    ·  ·  ·  ·  ·    ║',
          '║   ·  ·  ·  ·  ·     ║',
          '║  ·  ·  ·  ·  ·  ·   ║',
          '║ ·  ·  ·  ·  ·  ·  · ║',
          '╠══════════════════════╣',
          '║×0.5│×1│×3│×10│×3│×1 ║',
          '╚══════════════════════╝',
        ],
        rules: 'Une balle est lâchée en haut et rebondit sur des **picots**.\nElle tombe dans un **slot** du bas avec un multiplicateur.\nPlus le slot est à l\'extrémité, plus il est rare mais plus il rapporte !',
        rtp: '97%', maxWin: '×100 (bords)', tip: '💡 Le centre paie moins mais arrive plus souvent — stratégie stable !',
        slash: '/plinko', pari: null,
      },
    ],
  },
  cards: {
    label: '🃏 JEUX DE CARTES',
    games: [
      {
        value: 'war', label: 'Casino War', desc: 'Carte vs dealer · En Guerre ×3 · Le plus simple des casinos',
        art: [
          '╔═════════════════════╗',
          '║  ⚔️  CASINO WAR  ⚔️   ║',
          '╠═════════════════════╣',
          '║  DEALER     TOI     ║',
          '║   🂾           🂾     ║',
          '║  ROI  vs   ROI !    ║',
          '╠═════════════════════╣',
          '║   ⚔️  EN GUERRE !    ║',
          '║  3× la mise enjeu   ║',
          '╚═════════════════════╝',
        ],
        rules: 'Une carte pour toi, une pour le dealer. La plus haute gagne, c\'est tout.\n**Égalité :** tu peux choisir la GUERRE → **3× la mise en jeu** ou abandonner (perd moitié).\nSimplicité absolue !',
        rtp: '97.1%', maxWin: '×3 (En Guerre)', tip: '💡 L\'option Guerre vaut le coup : espérance légèrement positive !',
        slash: '/war', pari: null,
      },
      {
        value: 'dragon-tiger', label: 'Dragon Tiger', desc: 'Dragon vs Tigre · 7 types de paris · Rapidité absolue',
        art: [
          '╔═════════════════════╗',
          '║ 🐉 DRAGON  TIGER 🐯 ║',
          '╠═════════════════════╣',
          '║  DRAGON    TIGER    ║',
          '║   🂾           🂺     ║',
          '║  ROI  vs   10 !     ║',
          '╠═════════════════════╣',
          '║ Dragon×2 · Tiger×2  ║',
          '║ Tie×9 · Suited Tie× ║',
          '╚═════════════════════╝',
        ],
        rules: '1 carte Dragon, 1 carte Tigre. La plus haute l\'emporte. C\'est tout.\n**Paris :** Dragon ×2 · Tiger ×2 · Tie ×9 · Suited Tie ×50\n7 autres paris possibles (couleur, valeur, parité...)',
        rtp: '96.7%', maxWin: '×50 (Suited Tie)', tip: '💡 Dragon/Tiger sont 50/50 — le pari le plus équilibré !',
        slash: '/dragon-tiger', pari: 'dragon',
      },
    ],
  },
  instant: {
    label: '🎟️ JEUX INSTANTANÉS',
    games: [
      {
        value: 'keno', label: 'Keno', desc: 'Loterie de chiffres · Choisis 1-10 numéros · Tirage 20/80',
        art: [
          '╔═════════════════════╗',
          '║   🎟️   K E N O   🎟️  ║',
          '╠═════════════════════╣',
          '║  1  2  3  4  5  6  ║',
          '║  7  8 [9][10] 11 12 ║',
          '║ 13 14 15[16] 17 18  ║',
          '║ 19[20]21 22 23 24   ║',
          '╠═════════════════════╣',
          '║  20 numéros tirés   ║',
          '║  Choisis 1 à 10 n°  ║',
          '╚═════════════════════╝',
        ],
        rules: 'Choisis 1 à 10 numéros sur 80. 20 numéros sont tirés au sort.\nPlus tu en as, plus ton gain potentiel est élevé.\nUse `/keno` pour jouer avec tes propres numéros.',
        rtp: '95%', maxWin: '×10000', tip: '💡 4 numéros = meilleur équilibre risque/récompense !',
        slash: '/keno', pari: null, noDirectLaunch: true,
      },
    ],
  },
};

// ── Options par défaut par jeu — { nomOption: valeurDefaut } ────────────────
// Couvre tous les getString()/getInteger() spécifiques à chaque jeu
const GAME_DEFAULTS = {
  baccarat:       { pari: 'joueur' },
  craps:          { pari: 'pass' },
  sicbo:          { pari: 'small' },
  roulette:       { pari: 'rouge' },
  'dragon-tiger': { pari: 'dragon', choix: 'dragon' }, // dragon-tiger utilise getString('choix')
  des:            { pari: 'pair' },
  plinko:         { risque: 'medium' },
  mines:          { mines: 3 },          // sera traité dans getInteger
};

// ── Jeux qui ne peuvent pas être lancés directement depuis casino_bet_ ───────
// (nécessitent des options spécifiques que le joueur doit choisir lui-même)
const NO_DIRECT_LAUNCH = new Set(['keno']);

// ── Trouver un jeu dans le catalogue ────────────────────────────────────────
function findGame(gameKey) {
  for (const catData of Object.values(GAMES_BY_CATEGORY)) {
    const g = catData.games.find(g => g.value === gameKey);
    if (g) return g;
  }
  return null;
}

// ── Jackpot progressif ───────────────────────────────────────────────────────
function getProgressiveJackpot(guildId) {
  try {
    const row = db.db.prepare('SELECT amount FROM slots_jackpot WHERE guild_id=?').get(guildId);
    if (row?.amount) return row.amount;
  } catch {}
  return Math.floor(Math.random() * 50000) + 15000;
}

// ── Parties jouées aujourd'hui ───────────────────────────────────────────────
function getGamesPlayedToday(guildId) {
  try {
    const row = db.db.prepare(`
      SELECT COUNT(*) as cnt FROM slots_stats
      WHERE guild_id=? AND date(datetime(timestamp, 'unixepoch')) = date('now')
    `).get(guildId);
    if (row) return row.cnt;
  } catch {}
  return Math.floor(Math.random() * 800) + 200;
}

// ── Rang VIP ─────────────────────────────────────────────────────────────────
function getVIPRank(totalWon) {
  if (totalWon >= 500000) return { rank: 'Elite',   emoji: '👑', color: '#FFD700' };
  if (totalWon >= 200000) return { rank: 'Diamant', emoji: '💎', color: '#00D4FF' };
  if (totalWon >= 75000)  return { rank: 'Or',      emoji: '🥇', color: '#FFB700' };
  if (totalWon >= 20000)  return { rank: 'Argent',  emoji: '🥈', color: '#C0C0C0' };
  if (totalWon >= 5000)   return { rank: 'Bronze',  emoji: '🥉', color: '#CD7F32' };
  return { rank: 'Nouveau', emoji: '⭐', color: '#808080' };
}

// ══════════════════════════════════════════════════════════════════════════════
// MODULE
// ══════════════════════════════════════════════════════════════════════════════

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('🎰 CASINO ALMOSNI — Lobby de luxe, tous les jeux casino'),
  cooldown: 3,

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: false }).catch(() => {});
    }
    await handleCasinoLobby(interaction, interaction.user.id, interaction.guildId);
  },

  name: 'casino',
  aliases: ['casino', 'games', 'lobby'],
  async run(message, args) {
    const fakeInteraction = {
      user: message.author,
      guildId: message.guildId,
      deferred: false, replied: false,
      reply: async (d) => { const m = await message.channel.send(d).catch(() => {}); fakeInteraction._msg = m; return m; },
      editReply: async (d) => fakeInteraction._msg ? fakeInteraction._msg.edit(d).catch(() => {}) : message.channel.send(d).catch(() => {}),
      deferReply: async () => {},
      _msg: null,
    };
    await handleCasinoLobby(fakeInteraction, message.author.id, message.guildId);
  },

  handleComponent,
};

// ══════════════════════════════════════════════════════════════════════════════
// LOBBY PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

async function handleCasinoLobby(source, userId, guildId) {
  const isInteraction = !!source.editReply;
  const cfg   = db.getConfig ? db.getConfig(guildId) : null;
  const coin  = cfg?.currency_emoji || '€';

  let balance = 0, totalWon = 0;
  try {
    const user = db.getUser ? db.getUser(userId, guildId) : null;
    balance  = user?.balance || 0;
  } catch {}
  try {
    if (db.db) {
      const stats = db.db.prepare('SELECT SUM(won) as won FROM user_stats WHERE user_id=? AND guild_id=?').get(userId, guildId);
      totalWon = stats?.won || 0;
    }
  } catch {}

  const vip      = getVIPRank(totalWon);
  const jackpot  = getProgressiveJackpot(guildId);
  const played   = getGamesPlayedToday(guildId);

  const mainEmbed = new EmbedBuilder()
    .setColor('#1a0a2e')
    .setTitle('🎰  CASINO ALMOSNI  ✨  Luxury 5⭐')
    .setDescription(
      '```\n' +
      '╔══════════════════════════════════╗\n' +
      '║  ✨  Bienvenue dans l\'excellence  ║\n' +
      '║  Tapis verts · Lumières dorées   ║\n' +
      '║  Jeux de casino authentiques 🎲  ║\n' +
      '╚══════════════════════════════════╝\n' +
      '```'
    )
    .addFields(
      { name: '💰 Ton solde',            value: `**${balance.toLocaleString('fr-FR')} ${coin}**`, inline: true },
      { name: `${vip.emoji} Rang VIP`,   value: `**${vip.rank}**`,                                inline: true },
      { name: '🎲 Parties aujourd\'hui', value: `**${played}**`,                                  inline: true },
      { name: '🌟 Jackpot Progressif',   value: `**${jackpot.toLocaleString('fr-FR')} ${coin}**\n_Remportable aux Slots_`, inline: false },
    )
    .setFooter({ text: 'Casino Almosni ✨ Jeu responsable · 18+ · Le hasard peut être addictif' })
    .setTimestamp();

  // ── Select menu — toutes catégories, max 25 options Discord ─────────────
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

  const selectRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('casino_select_all')
      .setPlaceholder('🎰 Choisis un jeu de casino…')
      .addOptions(allOptions.slice(0, 25))
      .setMinValues(0)
      .setMaxValues(1)
  );

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('casino_bonus').setLabel('🎁 Bonus Quotidien').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('casino_stats').setLabel('📊 Mes Stats').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('casino_top').setLabel('🏆 Classement').setStyle(ButtonStyle.Danger),
  );

  const payload = { embeds: [mainEmbed], components: [selectRow, actionRow] };
  if (isInteraction) return source.editReply(payload);
  return source.reply(payload);
}

// ══════════════════════════════════════════════════════════════════════════════
// GESTIONNAIRE DE COMPOSANTS
// ══════════════════════════════════════════════════════════════════════════════

async function handleComponent(interaction, customId) {
  if (!customId.startsWith('casino_')) return false;

  if (!interaction.deferred && !interaction.replied) {
    const ephem = !customId.startsWith('casino_bet_');
    await interaction.deferReply({ ephemeral: ephem }).catch(() => {});
  }

  const guildId = interaction.guildId;
  const userId  = interaction.user.id;
  const cfg     = db.getConfig ? db.getConfig(guildId) : null;
  const coin    = cfg?.currency_emoji || '€';

  // ── Sélection d'un jeu (SelectMenu) ────────────────────────────────────
  if (customId.startsWith('casino_select_')) {
    if (!interaction.isStringSelectMenu()) return true;
    const selected = interaction.values?.[0];
    if (!selected?.startsWith('game_')) return true;

    const gameKey  = selected.replace('game_', '');
    const gameInfo = findGame(gameKey);
    if (!gameInfo) {
      return interaction.editReply({ content: '❌ Jeu introuvable.' }).then(() => true).catch(() => true);
    }

    // Fiche jeu riche avec ASCII art
    const artBlock = gameInfo.art ? '```\n' + gameInfo.art.join('\n') + '\n```' : '';
    const catData  = Object.values(GAMES_BY_CATEGORY).find(c => c.games.some(g => g.value === gameKey));
    const catLabel = catData?.label || '🎲 Jeu casino';

    const gameEmbed = new EmbedBuilder()
      .setColor(cfg?.color || '#F39C12')
      .setTitle(`${catLabel.split(' ')[0]} ${gameInfo.label}`)
      .setDescription(
        artBlock +
        '\n' + (gameInfo.rules || gameInfo.desc || '')
      )
      .addFields(
        { name: '📊 RTP',         value: gameInfo.rtp || '—',     inline: true },
        { name: '🏆 Gain max',    value: gameInfo.maxWin || '—',  inline: true },
        { name: '🃏 Catégorie',   value: catLabel,                 inline: true },
      );

    if (gameInfo.tip) gameEmbed.addFields({ name: '💡 Conseil', value: gameInfo.tip, inline: false });

    gameEmbed
      .setFooter({ text: gameInfo.noDirectLaunch ? `Utilise ${gameInfo.slash} pour jouer` : 'Clique "Jouer maintenant" pour choisir ta mise' })
      .setTimestamp();

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`casino_play_${gameKey}`)
        .setLabel('▶️ Jouer maintenant')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!!gameInfo.noDirectLaunch),
    ];
    if (gameInfo.noDirectLaunch) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId('casino_noop')
          .setLabel(`👉 Utilise ${gameInfo.slash}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    }

    return interaction.editReply({
      embeds: [gameEmbed],
      components: [new ActionRowBuilder().addComponents(...buttons)],
    }).then(() => true).catch(() => true);
  }

  // ── Bouton "Jouer maintenant" → grille de mises ─────────────────────────
  if (customId.startsWith('casino_play_')) {
    const gameKey  = customId.replace('casino_play_', '');
    const gameInfo = findGame(gameKey);
    if (!gameInfo) {
      return interaction.editReply({ content: '❌ Jeu introuvable.' }).then(() => true).catch(() => true);
    }

    const ROW1 = [100, 1_000, 10_000, 100_000, 500_000];
    const ROW2 = [1_000_000, 5_000_000, 10_000_000, 50_000_000];
    const fmt  = n => n >= 1_000_000
      ? `${(n / 1_000_000).toLocaleString('fr-FR')}M €`
      : n >= 1_000 ? `${(n / 1_000).toLocaleString('fr-FR')}k €`
      : `${n} €`;

    const betRow1 = new ActionRowBuilder().addComponents(
      ...ROW1.map(a => new ButtonBuilder()
        .setCustomId(`casino_bet_${gameKey}_${a}`)
        .setLabel(fmt(a))
        .setStyle(ButtonStyle.Secondary)
      )
    );
    const betRow2 = new ActionRowBuilder().addComponents(
      ...ROW2.map(a => new ButtonBuilder()
        .setCustomId(`casino_bet_${gameKey}_${a}`)
        .setLabel(fmt(a))
        .setStyle(ButtonStyle.Primary)
      ),
      new ButtonBuilder()
        .setCustomId(`casino_bet_${gameKey}_max`)
        .setLabel('💥 Tout miser')
        .setStyle(ButtonStyle.Danger)
    );

    // Fiche récap mise en en-tête
    const user    = db.getUser ? db.getUser(userId, guildId) : null;
    const balance = user?.balance || 0;
    const artBlock = gameInfo.art ? '```\n' + gameInfo.art.join('\n') + '\n```\n' : '';

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle(`🎮 ${gameInfo.label} — Choisis ta mise`)
        .setDescription(artBlock + `💰 Solde disponible : **${balance.toLocaleString('fr-FR')} ${coin}**\n\nChoisis le montant à miser :`)
        .setFooter({ text: '💥 Tout miser = miser tout ton solde actuel' })
      ],
      components: [betRow1, betRow2],
    }).then(() => true).catch(() => true);
  }

  // ── Bouton mise → lance le jeu ───────────────────────────────────────────
  if (customId.startsWith('casino_bet_')) {
    const afterPrefix   = customId.replace('casino_bet_', '');
    const lastUnderscore = afterPrefix.lastIndexOf('_');
    const gameKey       = afterPrefix.substring(0, lastUnderscore);
    const amountStr     = afterPrefix.substring(lastUnderscore + 1);
    const gameInfo      = findGame(gameKey);

    if (!gameKey || !gameInfo) {
      return interaction.editReply({ content: '❌ Jeu invalide.' }).then(() => true).catch(() => true);
    }

    // Calcul de la mise
    let amount;
    if (amountStr === 'max') {
      const u = db.getUser ? db.getUser(userId, guildId) : null;
      amount  = u?.balance || 0;
      if (!amount || amount <= 0) {
        return interaction.editReply({
          content: `❌ Solde insuffisant ! Fais \`/daily\` ou \`/work\` pour gagner des ${coin}.`,
        }).then(() => true).catch(() => true);
      }
    } else {
      amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return interaction.editReply({ content: '❌ Mise invalide.' }).then(() => true).catch(() => true);
      }
    }

    // Vérification solde avant lancement
    const userBal = db.getUser ? db.getUser(userId, guildId) : null;
    if (!userBal || userBal.balance < amount) {
      return interaction.editReply({
        content: `❌ Solde insuffisant. Tu as **${(userBal?.balance || 0).toLocaleString('fr-FR')} ${coin}** mais tu veux miser **${amount.toLocaleString('fr-FR')} ${coin}**.`,
      }).then(() => true).catch(() => true);
    }

    // Charge le module dynamiquement
    const nodePath = require('path');
    const gamePath = nodePath.join(__dirname, `${gameKey}.js`);
    let gameModule;
    try {
      gameModule = require(gamePath);
    } catch (e) {
      console.error(`[casino_bet] Module ${gameKey} introuvable:`, e.message);
      return interaction.editReply({
        content: `❌ Le jeu **${gameInfo.label}** n'est pas disponible. Essaie la commande \`${gameInfo.slash}\` directement.`,
      }).then(() => true).catch(() => true);
    }

    if (typeof gameModule.execute !== 'function') {
      return interaction.editReply({
        content: `❌ Ce jeu ne peut pas être lancé depuis le casino. Utilise \`${gameInfo.slash}\` directement.`,
      }).then(() => true).catch(() => true);
    }

    // Patch des options interaction pour injecter la mise et les valeurs par défaut
    const gameDefaults   = GAME_DEFAULTS[gameKey] || {};
    const origOptions    = interaction.options;
    interaction.options  = {
      getInteger: (name) => {
        if (name === 'mise')  return amount;
        if (name === 'lignes' || name === 'lines') return null; // défaut: 1 (géré dans le jeu)
        if (name in gameDefaults && typeof gameDefaults[name] === 'number') return gameDefaults[name];
        return null;
      },
      getNumber:  (name) => name === 'mise' ? amount : null,
      getString:  (name) => {
        if (name in gameDefaults && typeof gameDefaults[name] === 'string') return gameDefaults[name];
        return null; // mode, type, format, etc. → les jeux ont des fallbacks
      },
      getBoolean:    () => null,
      getUser:       () => null,
      getMember:     () => null,
      getSubcommand: () => null,
    };

    try {
      await gameModule.execute(interaction);
    } catch (err) {
      console.error(`[casino_bet] Erreur ${gameKey}:`, err?.message || err);
      try {
        const errMsg = { content: `❌ Erreur lors du lancement de **${gameInfo.label}** : ${err?.message || 'Erreur inconnue'}\nEssaie la commande \`${gameInfo.slash}\` directement.`, ephemeral: true };
        if (interaction.deferred || interaction.replied) await interaction.editReply(errMsg).catch(() => {});
        else await interaction.reply(errMsg).catch(() => {});
      } catch {}
    } finally {
      interaction.options = origOptions;
    }
    return true;
  }

  // ── Bonus Quotidien ──────────────────────────────────────────────────────
  if (customId === 'casino_bonus') {
    try {
      db.db.prepare(`CREATE TABLE IF NOT EXISTS casino_bonus_claims (
        user_id TEXT NOT NULL, guild_id TEXT NOT NULL, last_claim INTEGER NOT NULL,
        PRIMARY KEY (user_id, guild_id)
      )`).run();
    } catch {}

    const now      = Math.floor(Date.now() / 1000);
    const COOLDOWN = 86400;
    let lastClaim  = 0;
    try {
      const row = db.db.prepare('SELECT last_claim FROM casino_bonus_claims WHERE user_id=? AND guild_id=?').get(userId, guildId);
      lastClaim = row?.last_claim || 0;
    } catch {}

    if (now - lastClaim < COOLDOWN) {
      const nextTs = lastClaim + COOLDOWN;
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#FF6B6B')
          .setTitle('⏳ Bonus déjà réclamé')
          .setDescription(`Tu as déjà réclamé ton bonus aujourd\'hui.\n\nReviens <t:${nextTs}:R> *(le <t:${nextTs}:t>)* !`)
          .setFooter({ text: 'Un bonus par jour — cumule chaque jour !' })
        ],
        components: [],
      }).then(() => true).catch(() => true);
    }

    const bonusAmount = Math.floor(Math.random() * 2001) + 500; // 500–2500€
    db.addCoins(userId, guildId, bonusAmount);

    try {
      db.db.prepare(
        'INSERT INTO casino_bonus_claims (user_id, guild_id, last_claim) VALUES (?,?,?) ON CONFLICT(user_id,guild_id) DO UPDATE SET last_claim=?'
      ).run(userId, guildId, now, now);
    } catch {}

    const nextClaimTs = now + COOLDOWN;
    const newBal      = db.getUser ? (db.getUser(userId, guildId)?.balance || 0) : 0;

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🎁 Bonus Quotidien réclamé !')
        .setDescription(`**+${bonusAmount.toLocaleString('fr-FR')} ${coin}** ajoutés à ton compte ! 💸`)
        .addFields(
          { name: '💰 Nouveau solde',    value: `**${newBal.toLocaleString('fr-FR')} ${coin}**`, inline: true },
          { name: '⏰ Prochain bonus',   value: `<t:${nextClaimTs}:R>`,                          inline: true },
        )
        .setFooter({ text: 'Reviens chaque jour — ça s\'additionne vite !' })
        .setTimestamp()
      ],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ── Mes Stats ────────────────────────────────────────────────────────────
  if (customId === 'casino_stats') {
    let totalSpent = 0, totalWon = 0, totalGames = 0, bestWin = 0;
    try {
      if (db.db) {
        const stats = db.db.prepare(`
          SELECT SUM(spent) as spent, SUM(won) as won, COUNT(*) as games, MAX(biggest_win) as best
          FROM user_stats WHERE user_id=? AND guild_id=?
        `).get(userId, guildId);
        if (stats) {
          totalSpent = stats.spent || 0; totalWon = stats.won || 0;
          totalGames = stats.games || 0; bestWin  = stats.best || 0;
        }
      }
    } catch {}

    const vip    = getVIPRank(totalWon);
    const net    = totalWon - totalSpent;
    const netStr = (net >= 0 ? '+' : '') + net.toLocaleString('fr-FR');

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(vip.color)
        .setTitle('📊 Tes Statistiques Casino')
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          { name: `${vip.emoji} Rang VIP`,      value: `**${vip.rank}**`,                                       inline: true },
          { name: '🎮 Parties jouées',           value: `**${totalGames}**`,                                    inline: true },
          { name: '🏆 Meilleur gain',            value: `**${bestWin.toLocaleString('fr-FR')} ${coin}**`,       inline: true },
          { name: '💰 Total gagné',              value: `**${totalWon.toLocaleString('fr-FR')} ${coin}**`,      inline: true },
          { name: '💸 Total misé',               value: `**${totalSpent.toLocaleString('fr-FR')} ${coin}**`,    inline: true },
          { name: `${net >= 0 ? '📈' : '📉'} Net`, value: `**${netStr} ${coin}**`,                             inline: true },
        )
        .setFooter({ text: 'Casino Almosni · Joue de manière responsable' })
        .setTimestamp()
      ],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ── Classement Top Gagnants ──────────────────────────────────────────────
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
    } catch {}

    if (!topStats.length) {
      return interaction.editReply({
        content: '📊 Aucune statistique disponible. Soyez le premier à jouer !',
        components: [],
      }).then(() => true).catch(() => true);
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines  = topStats.map((s, i) =>
      `${medals[i]} <@${s.user_id}> — Meilleur gain : **${(s.best_win||0).toLocaleString('fr-FR')} ${coin}**`
    ).join('\n');

    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('👑 Top 10 Gagnants du Casino Almosni')
        .setDescription(lines || 'Aucun gagnant pour le moment.')
        .setFooter({ text: 'Classement mis à jour en temps réel' })
        .setTimestamp()
      ],
      components: [],
    }).then(() => true).catch(() => true);
  }

  // ── Noop (bouton désactivé) ──────────────────────────────────────────────
  if (customId === 'casino_noop') {
    return interaction.editReply({ content: 'ℹ️ Ce jeu nécessite une commande slash dédiée.' }).then(() => true).catch(() => true);
  }

  return false;
}

module.exports.handleComponent = handleComponent;
