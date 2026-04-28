// ============================================================
// boutique.js — Boutique du serveur avec rôles, titres & effets
// Auto-seed des articles par défaut — Effets actifs en jeu
// ============================================================

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

// ─── Tables ───────────────────────────────────────────────
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS boutique_items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id  TEXT,
    nom       TEXT,
    emoji     TEXT DEFAULT '🎁',
    type      TEXT DEFAULT 'role',
    valeur    TEXT,
    prix      INTEGER DEFAULT 100,
    stock     INTEGER DEFAULT -1,
    actif     INTEGER DEFAULT 1,
    description TEXT DEFAULT ''
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS boutique_achats (
    user_id   TEXT,
    guild_id  TEXT,
    item_id   INTEGER,
    achetedAt INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY(user_id, guild_id, item_id)
  )`).run();
  try { db.db.prepare("ALTER TABLE boutique_items ADD COLUMN description TEXT DEFAULT ''").run(); } catch {}
  try { db.db.prepare("ALTER TABLE users ADD COLUMN boost_daily_mult INTEGER DEFAULT 1").run(); } catch {}
  try { db.db.prepare("ALTER TABLE users ADD COLUMN casino_luck_until INTEGER DEFAULT 0").run(); } catch {}
  try { db.db.prepare("ALTER TABLE users ADD COLUMN boost_work_until INTEGER DEFAULT 0").run(); } catch {}
  try { db.db.prepare("ALTER TABLE users ADD COLUMN streak_saver INTEGER DEFAULT 0").run(); } catch {}
  try { db.db.prepare("ALTER TABLE users ADD COLUMN titre TEXT DEFAULT ''").run(); } catch {}
} catch {}

// ─── Articles par défaut ──────────────────────────────────
const DEFAULT_ITEMS = [
  { nom: 'Bouclier Anti-Vol',  emoji: '🛡️', type: 'protection',   valeur: '86400',  prix: 5000,   stock: -1, description: 'Immunité totale contre /vol pendant 24h' },
  { nom: 'Boost XP ×2',        emoji: '⚡',  type: 'boost_xp',     valeur: '7200',   prix: 3000,   stock: -1, description: 'Double ton XP gagné par message pendant 2h' },
  { nom: 'Boost Daily ×3',     emoji: '💰',  type: 'boost_daily',  valeur: '1',      prix: 8000,   stock: -1, description: 'Triple ta prochaine récompense /daily' },
  { nom: 'Chance Casino +15%', emoji: '🎰',  type: 'casino_luck',  valeur: '3600',   prix: 15000,  stock: -1, description: '+15% de gains dans tous les jeux de casino pendant 1h' },
  { nom: 'Streak Saver',       emoji: '🔥',  type: 'streak_saver', valeur: '1',      prix: 10000,  stock: -1, description: 'Protège ton streak quotidien une fois en cas d\'oubli' },
  { nom: 'Boost Travail ×2',   emoji: '💼',  type: 'boost_work',   valeur: '86400',  prix: 12000,  stock: -1, description: 'Double ton salaire /work pendant 24h' },
  { nom: 'Loot Box Mystère',   emoji: '🎁',  type: 'lootbox',      valeur: '1',      prix: 2500,   stock: -1, description: 'Ouvre une boîte : 500 à 50 000€ aléatoire !' },
  { nom: 'Titre 👑 VIP',        emoji: '👑',  type: 'titre',        valeur: 'VIP',    prix: 50000,  stock: -1, description: 'Badge VIP affiché dans ton profil et ta balance' },
  { nom: 'Titre 🌟 Élite',      emoji: '🌟',  type: 'titre',        valeur: 'Elite',  prix: 200000, stock: -1, description: 'Badge Élite — pour les membres les plus actifs' },
  { nom: 'Titre 💎 Légende',    emoji: '💎',  type: 'titre',        valeur: 'Legende',prix: 750000, stock: -1, description: 'Badge Légende — pour les vrais riches du serveur' },
];

function seedDefaultItems(guildId) {
  const count = db.db.prepare('SELECT COUNT(*) as c FROM boutique_items WHERE guild_id=?').get(guildId)?.c || 0;
  if (count > 0) return;
  const stmt = db.db.prepare('INSERT INTO boutique_items (guild_id,nom,emoji,type,valeur,prix,stock,actif,description) VALUES (?,?,?,?,?,?,?,1,?)');
  for (const item of DEFAULT_ITEMS) {
    stmt.run(guildId, item.nom, item.emoji, item.type, item.valeur, item.prix, item.stock, item.description);
  }
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}
function fmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }

function applyItemEffect(userId, guildId, item) {
  const now = Math.floor(Date.now() / 1000);
  const val = parseInt(item.valeur) || 0;

  switch (item.type) {
    case 'protection':
      db.db.prepare('UPDATE users SET bm_protected_until=? WHERE user_id=? AND guild_id=?').run(now + val, userId, guildId);
      return `🛡️ Protection anti-vol active jusqu'à <t:${now + val}:R> !`;

    case 'boost_xp':
      db.db.prepare('UPDATE users SET bm_boost_xp_until=? WHERE user_id=? AND guild_id=?').run(now + val, userId, guildId);
      return `⚡ Boost XP ×2 actif jusqu'à <t:${now + val}:R> !`;

    case 'boost_daily':
      db.db.prepare('UPDATE users SET boost_daily_mult=3 WHERE user_id=? AND guild_id=?').run(userId, guildId);
      return `💰 Ton prochain /daily sera multiplié ×3 !`;

    case 'casino_luck':
      db.db.prepare('UPDATE users SET casino_luck_until=? WHERE user_id=? AND guild_id=?').run(now + val, userId, guildId);
      return `🎰 +15% de gains casino actif jusqu'à <t:${now + val}:R> !`;

    case 'streak_saver':
      db.db.prepare('UPDATE users SET streak_saver=1 WHERE user_id=? AND guild_id=?').run(userId, guildId);
      return `🔥 Streak Saver activé ! Ton prochain oubli de /daily sera pardonné.`;

    case 'boost_work':
      db.db.prepare('UPDATE users SET boost_work_until=? WHERE user_id=? AND guild_id=?').run(now + val, userId, guildId);
      return `💼 Salaire /work ×2 actif jusqu'à <t:${now + val}:R> !`;

    case 'lootbox': {
      const prizes  = [500, 1000, 2500, 5000, 10000, 25000, 50000];
      const weights = [40, 25, 15, 10, 6, 3, 1];
      let rng = Math.random() * 100, prize = prizes[0], acc = 0;
      for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (rng < acc) { prize = prizes[i]; break; } }
      db.addCoins(userId, guildId, prize);
      return `🎁 **LOOT BOX OUVERTE !** Tu as trouvé **${fmt(prize)} €** à l'intérieur !`;
    }

    case 'titre':
      db.db.prepare('UPDATE users SET titre=? WHERE user_id=? AND guild_id=?').run(item.valeur, userId, guildId);
      return `${item.emoji} Titre **${item.valeur}** équipé ! Il apparaît dans \`/balance\` et \`/profil\`.`;

    case 'role':
      return `🎭 Rôle Discord — contacte un admin si tu ne l'as pas reçu automatiquement.`;

    default:
      return `✅ Article activé !`;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique')
    .setDescription('🏪 Boutique du serveur — Dépense tes € pour des récompenses !')
    .addSubcommand(s => s.setName('voir').setDescription('🛍️ Voir tous les articles disponibles'))
    .addSubcommand(s => s.setName('acheter').setDescription('💳 Acheter un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))
    .addSubcommand(s => s.setName('inventaire').setDescription('🎒 Voir tes achats et effets actifs'))
    .addSubcommand(s => s.setName('admin-ajouter').setDescription('⚙️ [Admin] Ajouter un article')
      .addStringOption(o => o.setName('nom').setDescription('Nom').setRequired(true))
      .addIntegerOption(o => o.setName('prix').setDescription('Prix en €').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
        .addChoices(
          { name: '🎭 Rôle Discord', value: 'role' },
          { name: '🏷️ Titre', value: 'titre' },
          { name: '🛡️ Protection vol', value: 'protection' },
          { name: '⚡ Boost XP', value: 'boost_xp' },
          { name: '💰 Boost Daily', value: 'boost_daily' },
          { name: '🎰 Chance Casino', value: 'casino_luck' },
          { name: '💼 Boost Travail', value: 'boost_work' },
          { name: '🎁 Loot Box', value: 'lootbox' },
        ))
      .addStringOption(o => o.setName('valeur').setDescription('ID rôle / texte titre / durée secondes').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(false))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock (-1 = illimité)').setRequired(false)))
    .addSubcommand(s => s.setName('admin-retirer').setDescription('⚙️ [Admin] Retirer un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch {}
    }

    const sub     = interaction.options.getSubcommand();
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const cfg     = (db.getConfig ? db.getConfig(guildId) : null) || {};
    const coin    = cfg.currency_emoji || '€';

    seedDefaultItems(guildId);

    // ── VOIR ──────────────────────────────────────────────
    if (sub === 'voir') {
      const items = db.db.prepare('SELECT * FROM boutique_items WHERE guild_id=? AND actif=1 ORDER BY prix ASC').all(guildId);
      const u     = db.getUser(userId, guildId) || { balance: 0 };

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🏪 Boutique du Serveur — Zone Entraide')
        .setDescription(`Ton solde : **${fmt(u.balance)} ${coin}**\nUtilise \`/boutique acheter <id>\` pour acheter.\n`)
        .setTimestamp()
        .setFooter({ text: `${items.length} articles disponibles • /boutique inventaire pour tes effets actifs` });

      const categories = {
        '⏱️ Effets Temporaires': ['protection','boost_xp','boost_daily','casino_luck','boost_work','streak_saver'],
        '🎲 Surprises': ['lootbox'],
        '🏆 Titres & Prestige': ['titre'],
        '🎭 Rôles Discord': ['role'],
      };

      for (const [catName, types] of Object.entries(categories)) {
        const catItems = items.filter(i => types.includes(i.type));
        if (!catItems.length) continue;
        const lines = catItems.map(item => {
          const can = u.balance >= item.prix ? '✅' : '❌';
          const stk = item.stock === -1 ? '' : ` · Stock: **${item.stock}**`;
          return `> **#${item.id}** ${item.emoji} **${item.nom}** — \`${fmt(item.prix)} ${coin}\` ${can}${stk}\n> *${item.description}*`;
        }).join('\n');
        embed.addFields({ name: catName, value: lines, inline: false });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── ACHETER ───────────────────────────────────────────
    if (sub === 'acheter') {
      const itemId = interaction.options.getInteger('id');
      const item   = db.db.prepare('SELECT * FROM boutique_items WHERE id=? AND guild_id=? AND actif=1').get(itemId, guildId);
      if (!item) return interaction.editReply({ content: `❌ Article #${itemId} introuvable.`, ephemeral: true });

      const u = db.getUser(userId, guildId) || { balance: 0 };
      if (u.balance < item.prix) {
        return interaction.editReply({
          content: `❌ Solde insuffisant !\nPrix : **${fmt(item.prix)} ${coin}** · Ton solde : **${fmt(u.balance)} ${coin}**\nIl te manque **${fmt(item.prix - u.balance)} ${coin}**.`,
          ephemeral: true
        });
      }
      if (item.stock === 0) return interaction.editReply({ content: '❌ Cet article est épuisé !', ephemeral: true });

      // Anti-doublons sur les titres
      if (item.type === 'titre') {
        const already = db.db.prepare('SELECT 1 FROM boutique_achats WHERE user_id=? AND guild_id=? AND item_id=?').get(userId, guildId, itemId);
        if (already) return interaction.editReply({ content: `❌ Tu possèdes déjà le titre **${item.nom}**.`, ephemeral: true });
      }

      db.addCoins(userId, guildId, -item.prix);
      try { db.db.prepare('INSERT OR REPLACE INTO boutique_achats (user_id,guild_id,item_id,achetedAt) VALUES (?,?,?,?)').run(userId, guildId, itemId, Math.floor(Date.now()/1000)); } catch {}
      if (item.stock > 0) db.db.prepare('UPDATE boutique_items SET stock=stock-1 WHERE id=?').run(itemId);

      const effectMsg = applyItemEffect(userId, guildId, item);
      const newBal = (u.balance - item.prix);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle(`✅ Achat confirmé — ${item.emoji} ${item.nom}`)
          .setDescription(`${effectMsg}\n\n💳 **${fmt(item.prix)} ${coin}** débités.`)
          .addFields(
            { name: '💰 Nouveau solde', value: `**${fmt(newBal)} ${coin}**`, inline: true },
            { name: '🎁 Article', value: `${item.emoji} ${item.nom}`, inline: true },
          )
          .setTimestamp()
        ]
      });
    }

    // ── INVENTAIRE ────────────────────────────────────────
    if (sub === 'inventaire') {
      const u   = db.getUser(userId, guildId) || {};
      const now = Math.floor(Date.now() / 1000);
      const achats = db.db.prepare(`
        SELECT ba.*, bi.nom, bi.emoji, bi.type FROM boutique_achats ba
        JOIN boutique_items bi ON ba.item_id = bi.id
        WHERE ba.user_id=? AND ba.guild_id=? ORDER BY ba.achetedAt DESC LIMIT 15
      `).all(userId, guildId);

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`🎒 Inventaire de ${interaction.user.username}`)
        .setTimestamp();

      const actifs = [];
      if ((u.bm_protected_until || 0) > now)  actifs.push(`🛡️ **Protection vol** — expire <t:${u.bm_protected_until}:R>`);
      if ((u.bm_boost_xp_until || 0) > now)   actifs.push(`⚡ **Boost XP ×2** — expire <t:${u.bm_boost_xp_until}:R>`);
      if ((u.casino_luck_until || 0) > now)    actifs.push(`🎰 **Chance Casino +15%** — expire <t:${u.casino_luck_until}:R>`);
      if ((u.boost_work_until || 0) > now)     actifs.push(`💼 **Boost Travail ×2** — expire <t:${u.boost_work_until}:R>`);
      if ((u.boost_daily_mult || 1) > 1)       actifs.push(`💰 **Boost Daily ×${u.boost_daily_mult}** — actif sur le prochain /daily`);
      if (u.streak_saver)                      actifs.push(`🔥 **Streak Saver** — prêt à l'emploi`);
      if (u.titre)                             actifs.push(`✨ **Titre ${u.titre}** — équipé`);

      embed.addFields({
        name: actifs.length ? '✨ Effets actifs' : '💤 Aucun effet actif',
        value: actifs.length ? actifs.join('\n') : '*Achète des articles dans `/boutique voir`*',
      });

      if (achats.length) {
        embed.addFields({
          name: '🛒 Derniers achats',
          value: achats.slice(0,10).map(a => `> ${a.emoji} **${a.nom}** — <t:${a.achetedAt}:R>`).join('\n'),
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ── ADMIN AJOUTER ──────────────────────────────────────
    if (sub === 'admin-ajouter') {
      if (!isAdmin(interaction.member)) return interaction.editReply({ content: '❌ Admins seulement.', ephemeral: true });
      const nom   = interaction.options.getString('nom');
      const prix  = interaction.options.getInteger('prix');
      const type  = interaction.options.getString('type');
      const val   = interaction.options.getString('valeur');
      const emoji = interaction.options.getString('emoji') || '🎁';
      const desc  = interaction.options.getString('description') || '';
      const stock = interaction.options.getInteger('stock') ?? -1;

      db.db.prepare('INSERT INTO boutique_items (guild_id,nom,emoji,type,valeur,prix,stock,actif,description) VALUES (?,?,?,?,?,?,?,1,?)')
        .run(guildId, nom, emoji, type, val, prix, stock, desc);

      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Article ajouté à la boutique')
          .addFields(
            { name: 'Article', value: `${emoji} ${nom}`, inline: true },
            { name: 'Prix', value: `${fmt(prix)} ${coin}`, inline: true },
            { name: 'Type', value: type, inline: true },
          )]
      });
    }

    // ── ADMIN RETIRER ──────────────────────────────────────
    if (sub === 'admin-retirer') {
      if (!isAdmin(interaction.member)) return interaction.editReply({ content: '❌ Admins seulement.', ephemeral: true });
      const id  = interaction.options.getInteger('id');
      const res = db.db.prepare('UPDATE boutique_items SET actif=0 WHERE id=? AND guild_id=?').run(id, guildId);
      if (!res.changes) return interaction.editReply({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      return interaction.editReply({ content: `✅ Article #${id} retiré de la boutique.` });
    }
  },
};
