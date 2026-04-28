// ============================================================
// boutique.js — Boutique du serveur avec rôles, titres & items
// Emplacement : src/commands_guild/economy/boutique.js
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
    actif     INTEGER DEFAULT 1
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS boutique_achats (
    user_id   TEXT,
    guild_id  TEXT,
    item_id   INTEGER,
    achetedAt INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY(user_id, guild_id, item_id)
  )`).run();
} catch {}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function fmt(n) { return n.toLocaleString('fr-FR'); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique')
    .setDescription('🏪 Boutique du serveur — Dépense tes € pour des récompenses !')
    .addSubcommand(s => s
      .setName('voir')
      .setDescription('🛍️ Voir tous les articles disponibles'))
    .addSubcommand(s => s
      .setName('acheter')
      .setDescription('💳 Acheter un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))
    .addSubcommand(s => s
      .setName('inventaire')
      .setDescription('🎒 Voir vos achats'))
    .addSubcommand(s => s
      .setName('admin-ajouter')
      .setDescription('⚙️ [Admin] Ajouter un article à la boutique')
      .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true))
      .addIntegerOption(o => o.setName('prix').setDescription('Prix en €').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Type: role / titre / item').setRequired(true)
        .addChoices(
          { name: '🎭 Rôle Discord', value: 'role' },
          { name: '🏷️ Titre personnalisé', value: 'titre' },
          { name: '🎁 Item spécial', value: 'item' },
        ))
      .addStringOption(o => o.setName('valeur').setDescription('ID du rôle ou texte du titre').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji de l\'article').setRequired(false))
      .addIntegerOption(o => o.setName('stock').setDescription('Stock limité (-1 = illimité)').setRequired(false)))
    .addSubcommand(s => s
      .setName('admin-retirer')
      .setDescription('⚙️ [Admin] Retirer un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub     = interaction.options.getSubcommand();
    const userId  = interaction.user.id;
    const guildId = interaction.guildId;
    const member  = interaction.member;
    const cfg     = db.getConfig ? db.getConfig(guildId) : null;
    const coin    = cfg?.currency_emoji || '€';

    // ── VOIR ────────────────────────────────────────────────
    if (sub === 'voir') {
      const items = db.db.prepare('SELECT * FROM boutique_items WHERE guild_id=? AND actif=1 ORDER BY prix ASC').all(guildId);

      if (!items.length) {
        return interaction.editReply({
          content: '🏪 La boutique est vide pour le moment. Un admin peut ajouter des articles avec `/boutique admin-ajouter`.',
          ephemeral: true,
        });
      }

      const u      = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
      const coins  = u?.balance || 0;

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🏪 Boutique du Serveur')
        .setDescription(`Votre solde : **${fmt(coins)} ${coin}**\nUtilisez \`/boutique acheter <id>\` pour acheter un article.`)
        .setTimestamp();

      const TYPE_LABELS = { role: '🎭 Rôle', titre: '🏷️ Titre', item: '🎁 Item' };

      items.forEach(item => {
        const canAfford = coins >= item.prix;
        const stockTxt  = item.stock === -1 ? '∞' : `${item.stock} restant(s)`;
        embed.addFields({
          name:   `${item.emoji || '🎁'} [#${item.id}] ${item.nom} ${canAfford ? '✅' : '❌'}`,
          value:  `Type : ${TYPE_LABELS[item.type] || item.type} | Stock : ${stockTxt}\nPrix : **${fmt(item.prix)} ${coin}**`,
          inline: true,
        });
      });

      return interaction.editReply({ embeds: [embed] });
    }

    // ── ACHETER ─────────────────────────────────────────────
    if (sub === 'acheter') {
      const itemId = interaction.options.getInteger('id');
      const item   = db.db.prepare('SELECT * FROM boutique_items WHERE id=? AND guild_id=? AND actif=1').get(itemId, guildId);

      if (!item) return interaction.editReply({ content: `❌ Article #${itemId} introuvable.`, ephemeral: true });

      const dejAch = db.db.prepare('SELECT 1 FROM boutique_achats WHERE user_id=? AND guild_id=? AND item_id=?').get(userId, guildId, itemId);
      if (dejAch) return interaction.editReply({ content: `❌ Tu possèdes déjà **${item.nom}**.`, ephemeral: true });

      if (item.stock === 0) return interaction.editReply({ content: '❌ Stock épuisé !', ephemeral: true });

      const u     = db.getUser(userId, guildId) || { balance: 0, bank: 0 };
      const coins = u?.balance || 0;
      if (coins < item.prix) {
        return interaction.editReply({
          content: `❌ Pas assez de €. Tu as **${fmt(coins)} ${coin}** mais l'article coûte **${fmt(item.prix)} ${coin}**.`,
          ephemeral: true,
        });
      }

      db.removeCoins(userId, guildId, item.prix);
      db.db.prepare('INSERT OR IGNORE INTO boutique_achats (user_id, guild_id, item_id) VALUES (?,?,?)').run(userId, guildId, itemId);

      if (item.stock > 0) db.db.prepare('UPDATE boutique_items SET stock=stock-1 WHERE id=?').run(itemId);

      let effectMsg = '';
      if (item.type === 'role') {
        const role = interaction.guild.roles.cache.get(item.valeur);
        if (role) {
          await member.roles.add(role).catch(() => null);
          effectMsg = `✅ Le rôle **${role.name}** t'a été attribué !`;
        } else {
          effectMsg = '⚠️ Rôle introuvable — contacte un admin.';
        }
      } else if (item.type === 'titre') {
        effectMsg = `🏷️ Titre débloqué : **${item.valeur}**`;
      } else {
        effectMsg = `🎁 Item obtenu : **${item.nom}**`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`✅ Achat réussi — ${item.emoji || '🎁'} ${item.nom}`)
        .setDescription(`${effectMsg}\n\n**Coût :** -${fmt(item.prix)} ${coin}\n**Solde restant :** ${fmt(coins - item.prix)} ${coin}`)
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    // ── INVENTAIRE ──────────────────────────────────────────
    if (sub === 'inventaire') {
      const achats = db.db.prepare(`
        SELECT b.*, bi.nom, bi.emoji, bi.type, bi.valeur, bi.prix
        FROM boutique_achats b
        JOIN boutique_items bi ON b.item_id = bi.id
        WHERE b.user_id=? AND b.guild_id=?
      `).all(userId, guildId);

      if (!achats.length) {
        return interaction.editReply({ content: '🎒 Votre inventaire est vide. Visitez `/boutique voir` !', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🎒 Vos achats — ${interaction.user.username}`)
        .setTimestamp();

      const TYPE_LABELS = { role: '🎭 Rôle', titre: '🏷️ Titre', item: '🎁 Item' };
      achats.forEach(a => {
        embed.addFields({
          name:   `${a.emoji || '🎁'} ${a.nom}`,
          value:  `Type : ${TYPE_LABELS[a.type] || a.type} | Payé : **${fmt(a.prix)} ${coin}**`,
          inline: true,
        });
      });

      return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    // ── ADMIN-AJOUTER ───────────────────────────────────────
    if (sub === 'admin-ajouter') {
      if (!isAdmin(member)) return interaction.editReply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const nom   = interaction.options.getString('nom');
      const prix  = interaction.options.getInteger('prix');
      const type  = interaction.options.getString('type');
      const val   = interaction.options.getString('valeur');
      const emoji = interaction.options.getString('emoji') || '🎁';
      const stock = interaction.options.getInteger('stock') ?? -1;

      const result = db.db.prepare(
        'INSERT INTO boutique_items (guild_id, nom, emoji, type, valeur, prix, stock) VALUES (?,?,?,?,?,?,?)'
      ).run(guildId, nom, emoji, type, val, prix, stock);

      return interaction.editReply({
        content: `✅ Article **${emoji} ${nom}** ajouté (ID: #${result.lastInsertRowid}) au prix de **${fmt(prix)} ${coin}**.`,
        ephemeral: true,
      });
    }

    // ── ADMIN-RETIRER ───────────────────────────────────────
    if (sub === 'admin-retirer') {
      if (!isAdmin(member)) return interaction.editReply({ content: '❌ Réservé aux admins.', ephemeral: true });
      const itemId = interaction.options.getInteger('id');
      db.db.prepare('UPDATE boutique_items SET actif=0 WHERE id=? AND guild_id=?').run(itemId, guildId);
      return interaction.editReply({ content: `✅ Article #${itemId} retiré de la boutique.`, ephemeral: true });
    }
  },
};

