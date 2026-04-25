/**
 * NexusBot — Gestion complète de la boutique depuis Discord
 * /boutique_admin — Créer, modifier, supprimer des articles
 * Mieux que UnbelievaBoat, MEE6, DraftBot
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique_admin')
    .setDescription('🛒 Gérer la boutique du serveur (articles, prix, stock, rôles)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Ajouter un article à la boutique')
      .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('prix').setDescription('Prix en coins (aucune limite)').setRequired(true).setMaxLength(30))
      .addStringOption(o => o.setName('description').setDescription('Description de l\'article').setMaxLength(200))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji de l\'article (ex: 🎩)').setMaxLength(10))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer à l\'achat'))
)
    .addSubcommand(s => s.setName('modifier').setDescription('✏️ Modifier un article existant')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom'))
      .addStringOption(o => o.setName('description').setDescription('Nouvelle description').setMaxLength(200))
      .addStringOption(o => o.setName('emoji').setDescription('Nouvel emoji'))
      .addBooleanOption(o => o.setName('actif').setDescription('Activer ou désactiver cet article')))

    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un article de la boutique')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'article à supprimer').setRequired(true)))

    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir tous les articles de la boutique (admin view)'))

    .addSubcommand(s => s.setName('stock_ajouter').setDescription('📦 Ajouter du stock à un article')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))
)
    .addSubcommand(s => s.setName('ventes').setDescription('📊 Statistiques de ventes des articles'))

    .addSubcommand(s => s.setName('vider').setDescription('☢️ Vider entièrement la boutique')
      .addStringOption(o => o.setName('confirmation').setDescription('Tapez CONFIRMER').setRequired(true)))

    .addSubcommand(s => s.setName('dupliquer').setDescription('📋 Dupliquer un article existant')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'article à copier').setRequired(true)))

    .addSubcommand(s => s.setName('promo').setDescription('🏷️ Mettre un article en promotion')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Permission **Gérer le serveur** requise.', ephemeral: true });

    // ── AJOUTER ──────────────────────────────────────────────────────
    if (sub === 'ajouter') {
      const nom    = interaction.options.getString('nom');
      const prix   = parseInt(interaction.options.getString('prix'));
      const desc   = interaction.options.getString('description') || '';
      const emoji  = interaction.options.getString('emoji') || '📦';
      const role   = interaction.options.getRole('role');
      const stock  = parseInt(interaction.options.getString('stock')) ?? -1;
      const maxPU  = parseInt(interaction.options.getString('max_par_joueur')) ?? null;
      const duree  = parseInt(interaction.options.getString('duree_heures')) ?? 0;

      const result = db.db.prepare(`
        INSERT INTO shop (guild_id,name,description,emoji,price,stock,role_id,max_per_user,duration_hours,active)
        VALUES (?,?,?,?,?,?,?,?,?,1)
      `).run(guildId, nom, desc, emoji, prix, stock, role?.id ?? null, maxPU, duree || null);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`✅ Article ajouté — ID #${result.lastInsertRowid}`)
        .addFields(
          { name: '🏷️ Nom',        value: `${emoji} ${nom}`,            inline: true },
          { name: '💰 Prix',        value: `${prix} ${coin}`,            inline: true },
          { name: '📦 Stock',       value: stock === -1 ? 'Illimité' : `${stock}`, inline: true },
          { name: '🎭 Rôle',        value: role ? `${role}` : 'Aucun',   inline: true },
          { name: '⏱️ Durée',       value: duree ? `${duree}h` : 'Permanent', inline: true },
          { name: '👤 Max/joueur',  value: maxPU ? `${maxPU}` : 'Illimité', inline: true },
          { name: '📝 Description', value: desc || '*Aucune*', inline: false },
        )
        .setFooter({ text: `Utilisez /boutique pour voir la boutique publique` })] });
    }

    // ── MODIFIER ──────────────────────────────────────────────────────
    if (sub === 'modifier') {
      const id   = parseInt(interaction.options.getString('id'));
      const item = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(id, guildId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });

      const changes = {};
      const nom   = interaction.options.getString('nom');
      const prix  = parseInt(interaction.options.getString('prix'));
      const desc  = interaction.options.getString('description');
      const emoji = interaction.options.getString('emoji');
      const stock = parseInt(interaction.options.getString('stock'));
      const actif = interaction.options.getBoolean('actif');

      if (nom   !== null) changes.name        = nom;
      if (prix  !== null) changes.price       = prix;
      if (desc  !== null) changes.description = desc;
      if (emoji !== null) changes.emoji       = emoji;
      if (stock !== null) changes.stock       = stock;
      if (actif !== null) changes.active      = actif ? 1 : 0;

      if (Object.keys(changes).length === 0)
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune modification spécifiée.', ephemeral: true });

      const sets = Object.keys(changes).map(k => `${k}=?`).join(', ');
      db.db.prepare(`UPDATE shop SET ${sets} WHERE id=? AND guild_id=?`).run(...Object.values(changes), id, guildId);

      const updated = db.db.prepare('SELECT * FROM shop WHERE id=?').get(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`✏️ Article #${id} mis à jour`)
        .setDescription(`${updated.emoji} **${updated.name}** — ${updated.price} ${coin} — Stock: ${updated.stock === -1 ? 'Illimité' : updated.stock} — ${updated.active ? '✅ Actif' : '❌ Inactif'}`)
        .setFooter({ text: `Modifié par ${interaction.user.username}` })] });
    }

    // ── SUPPRIMER ─────────────────────────────────────────────────────
    if (sub === 'supprimer') {
      const id = parseInt(interaction.options.getString('id'));
      const item = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(id, guildId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      db.db.prepare('DELETE FROM shop WHERE id=? AND guild_id=?').run(id, guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setDescription(`🗑️ Article **${item.emoji} ${item.name}** (#${id}) supprimé.`)] });
    }

    // ── LISTE ─────────────────────────────────────────────────────────
    if (sub === 'liste') {
      const items = db.db.prepare('SELECT * FROM shop WHERE guild_id=? ORDER BY active DESC, price ASC').all(guildId);
      if (!items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📦 Boutique vide. Ajoutez des articles avec `/boutique_admin ajouter`.', ephemeral: true });

      const lines = items.map(it => {
        const status = it.active ? '✅' : '❌';
        const stock  = it.stock === -1 ? '∞' : it.stock;
        return `${status} **#${it.id}** ${it.emoji} **${it.name}** — ${it.price} ${coin} | Stock: ${stock}${it.role_id ? ` | 🎭 <@&${it.role_id}>` : ''}`;
      });

      const chunks = [];
      for (let i = 0; i < lines.length; i += 15) chunks.push(lines.slice(i, i+15));

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`🛒 Boutique Admin — ${items.length} article(s)`)
        .setDescription(chunks[0].join('\n'))
        .setFooter({ text: 'Utilisez /boutique_admin modifier id:<n> pour éditer' })], ephemeral: true });
    }

    // ── STOCK AJOUTER ─────────────────────────────────────────────────
    if (sub === 'stock_ajouter') {
      const id  = parseInt(interaction.options.getString('id'));
      const qty = parseInt(interaction.options.getString('quantite'));
      const item = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(id, guildId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      if (item.stock === -1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cet article a un stock illimité.', ephemeral: true });
      db.db.prepare('UPDATE shop SET stock=stock+? WHERE id=?').run(qty, id);
      const updated = db.db.prepare('SELECT stock FROM shop WHERE id=?').get(id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setDescription(`📦 Stock de **${item.emoji} ${item.name}** : +${qty} → **${updated.stock}** unités.`)] });
    }

    // ── VENTES ────────────────────────────────────────────────────────
    if (sub === 'ventes') {
      const stats = db.db.prepare(`
        SELECT s.id, s.name, s.emoji, s.price,
               COUNT(t.id) as sales,
               SUM(t.amount) as revenue
        FROM shop s
        LEFT JOIN transactions t ON t.description LIKE '%#'||s.id||'%' AND t.guild_id=?
        WHERE s.guild_id=?
        GROUP BY s.id ORDER BY sales DESC LIMIT 10
      `).all(guildId, guildId);

      const lines = stats.map((it, i) =>
        `**${i+1}.** ${it.emoji} ${it.name} — 🛒 ${it.sales||0} ventes | 💰 ${(it.revenue||0)} ${coin}`
      );

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F59E0B')
        .setTitle('📊 Top ventes de la boutique')
        .setDescription(lines.join('\n') || '*Aucune vente enregistrée.*')], ephemeral: true });
    }

    // ── VIDER ─────────────────────────────────────────────────────────
    if (sub === 'vider') {
      if (interaction.options.getString('confirmation') !== 'CONFIRMER')
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tapez exactement **CONFIRMER**.', ephemeral: true });
      const count = db.db.prepare('SELECT COUNT(*) as c FROM shop WHERE guild_id=?').get(guildId);
      db.db.prepare('DELETE FROM shop WHERE guild_id=?').run(guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E74C3C')
        .setTitle('☢️ Boutique vidée')
        .setDescription(`${count.c} article(s) supprimé(s).`)] });
    }

    // ── DUPLIQUER ─────────────────────────────────────────────────────
    if (sub === 'dupliquer') {
      const id = parseInt(interaction.options.getString('id'));
      const item = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(id, guildId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      const result = db.db.prepare(`
        INSERT INTO shop (guild_id,name,description,emoji,price,stock,role_id,max_per_user,duration_hours,active)
        VALUES (?,?,?,?,?,?,?,?,?,1)
      `).run(guildId, `${item.name} (copie)`, item.description, item.emoji, item.price, item.stock, item.role_id, item.max_per_user, item.duration_hours);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setDescription(`📋 Article **${item.emoji} ${item.name}** dupliqué → Nouveau ID **#${result.lastInsertRowid}**.`)] });
    }

    // ── PROMO ─────────────────────────────────────────────────────────
    if (sub === 'promo') {
      const id  = parseInt(interaction.options.getString('id'));
      const pct = parseInt(interaction.options.getString('reduction'));
      const item = db.db.prepare('SELECT * FROM shop WHERE id=? AND guild_id=?').get(id, guildId);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      const newPrice = Math.max(1, Math.floor(item.price * (1 - pct / 100)));
      db.db.prepare('UPDATE shop SET price=? WHERE id=?').run(newPrice, id);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#EF4444')
        .setTitle(`🏷️ Promotion appliquée — -${pct}%`)
        .setDescription(`${item.emoji} **${item.name}**\n~~${item.price}~~ → **${newPrice} ${coin}**`)
        .setFooter({ text: `Article #${id} mis en promo` })] });
    }
  }
};
