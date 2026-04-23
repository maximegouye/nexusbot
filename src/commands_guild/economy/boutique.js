const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS shop_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, name TEXT, description TEXT,
    price INTEGER, type TEXT DEFAULT 'cosmetic',
    role_id TEXT, emoji TEXT DEFAULT '🛍️',
    stock INTEGER DEFAULT -1,
    UNIQUE(guild_id, name)
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, user_id TEXT, item_id INTEGER,
    quantity INTEGER DEFAULT 1, used INTEGER DEFAULT 0,
    bought_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id, item_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boutique')
    .setDescription('🛍️ Boutique du serveur — Dépensez vos coins !')
    .addSubcommand(s => s.setName('voir').setDescription('👀 Voir les articles disponibles'))
    .addSubcommand(s => s.setName('acheter').setDescription('💰 Acheter un article')
      .addStringOption(o => o.setName('article').setDescription('Nom de l\'article').setRequired(true)))
    .addSubcommand(s => s.setName('inventaire').setDescription('🎒 Voir votre inventaire')
      .addUserOption(o => o.setName('membre').setDescription('Voir l\'inventaire d\'un membre')))
    .addSubcommand(s => s.setName('utiliser').setDescription('✅ Utiliser un article de votre inventaire')
      .addStringOption(o => o.setName('article').setDescription('Nom de l\'article à utiliser').setRequired(true)))
    .addSubcommand(s => s.setName('ajouter').setDescription('➕ Ajouter un article à la boutique (Admin)')
      .addStringOption(o => o.setName('nom').setDescription('Nom de l\'article').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true).setMaxLength(200))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji de l\'article'))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à donner lors de l\'achat'))
    .addSubcommand(s => s.setName('supprimer').setDescription('🗑️ Supprimer un article (Admin)')
      .addStringOption(o => o.setName('article').setDescription('Nom de l\'article').setRequired(true))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false }).catch(() => {});
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '€';

    if (sub === 'voir') {
      const items = db.db.prepare('SELECT * FROM shop_items WHERE guild_id=? ORDER BY price ASC').all(guildId);
      if (!items.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ La boutique est vide. Un admin peut ajouter des articles avec `/boutique ajouter`.', ephemeral: true });

      const lines = items.map(i => {
        const stock = i.stock === -1 ? '∞' : i.stock > 0 ? i.stock : '**Épuisé**';
        return `${i.emoji} **${i.name}** — ${i.price} ${coin}\n> ${i.description} | Stock: ${stock}${i.role_id ? ` | Rôle: <@&${i.role_id}>` : ''}`;
      }).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#F1C40F').setTitle('🛍️ Boutique du serveur')
          .setDescription(lines)
          .setFooter({ text: `${items.length} article(s) • /boutique acheter <article>` })
      ]});
    }

    if (sub === 'acheter') {
      const nom = interaction.options.getString('article');
      const item = db.db.prepare('SELECT * FROM shop_items WHERE guild_id=? AND LOWER(name)=LOWER(?)').get(guildId, nom);
      if (!item) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article **${nom}** introuvable. Voir la boutique : \`/boutique voir\`.`, ephemeral: true });
      if (item.stock === 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ **${item.name}** est épuisé !`, ephemeral: true });

      const u = db.getUser(userId, guildId);
      if (u.balance < item.price) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Solde insuffisant. **${item.price} ${coin}** requis, vous avez **${u.balance} ${coin}**.`, ephemeral: true });

      // Vérifier si déjà possédé (pour les rôles)
      const existing = db.db.prepare('SELECT * FROM user_inventory WHERE guild_id=? AND user_id=? AND item_id=?').get(guildId, userId, item.id);
      if (existing && item.role_id) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous possédez déjà **${item.name}** !`, ephemeral: true });

      db.addCoins(userId, guildId, -item.price);
      if (existing) {
        db.db.prepare('UPDATE user_inventory SET quantity=quantity+1 WHERE guild_id=? AND user_id=? AND item_id=?').run(guildId, userId, item.id);
      } else {
        db.db.prepare('INSERT INTO user_inventory (guild_id, user_id, item_id) VALUES (?,?,?)').run(guildId, userId, item.id);
      }
      if (item.stock > 0) db.db.prepare('UPDATE shop_items SET stock=stock-1 WHERE id=?').run(item.id);

      // Donner le rôle si applicable
      if (item.role_id) {
        try {
          await interaction.member.roles.add(item.role_id);
        } catch {}
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Achat réussi !')
          .setDescription(`Vous avez acheté **${item.emoji} ${item.name}** pour **${item.price} ${coin}** !`)
          .addFields(
            { name: '👛 Nouveau solde', value: `${u.balance - item.price} ${coin}`, inline: true },
            { name: '🎒 Article', value: item.description, inline: true },
          )
      ]});
    }

    if (sub === 'inventaire') {
      const target = interaction.options.getUser('membre') || interaction.user;
      const inv = db.db.prepare(`
        SELECT ui.*, si.name, si.description, si.emoji, si.price
        FROM user_inventory ui JOIN shop_items si ON ui.item_id=si.id
        WHERE ui.guild_id=? AND ui.user_id=?
      `).all(guildId, target.id);

      if (!inv.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${target.id === userId ? 'Votre inventaire est vide.' : `<@${target.id}> n'a rien dans son inventaire.`}`, ephemeral: true });

      const lines = inv.map(i => `${i.emoji} **${i.name}** x${i.quantity}${i.used ? ' *(utilisé)*' : ''}\n> ${i.description}`).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#7B2FBE').setTitle(`🎒 Inventaire de ${target.username}`)
          .setDescription(lines).setThumbnail(target.displayAvatarURL())
      ], ephemeral: target.id !== userId });
    }

    if (sub === 'utiliser') {
      const nom = interaction.options.getString('article');
      const invItem = db.db.prepare(`
        SELECT ui.*, si.name, si.emoji, si.role_id, si.type
        FROM user_inventory ui JOIN shop_items si ON ui.item_id=si.id
        WHERE ui.guild_id=? AND ui.user_id=? AND LOWER(si.name)=LOWER(?) AND ui.quantity>0
      `).get(guildId, userId, nom);

      if (!invItem) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Vous ne possédez pas **${nom}** ou votre stock est épuisé.`, ephemeral: true });

      db.db.prepare('UPDATE user_inventory SET quantity=quantity-1, used=1 WHERE guild_id=? AND user_id=? AND item_id=?').run(guildId, userId, invItem.item_id);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Vous avez utilisé **${invItem.emoji} ${invItem.name}** !`)
      ], ephemeral: true });
    }

    if (sub === 'ajouter') {
      if (!interaction.member.permissions.has(8n)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.', ephemeral: true });
      const nom = interaction.options.getString('nom');
      const desc = interaction.options.getString('description');
      const prix = parseInt(interaction.options.getString('prix'));
      const emoji = interaction.options.getString('emoji') || '🛍️';
      const role = interaction.options.getRole('role');
      const stock = parseInt(interaction.options.getString('stock')) ?? -1;

      try {
        db.db.prepare('INSERT INTO shop_items (guild_id, name, description, price, emoji, role_id, stock) VALUES (?,?,?,?,?,?,?)')
          .run(guildId, nom, desc, prix, emoji, role?.id || null, stock);
      } catch {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Un article avec ce nom existe déjà.`, ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('#2ECC71').setTitle('✅ Article ajouté !')
          .addFields(
            { name: '🏷️ Nom', value: `${emoji} ${nom}`, inline: true },
            { name: '💰 Prix', value: `${prix} ${coin}`, inline: true },
            { name: '📦 Stock', value: stock === -1 ? 'Illimité' : `${stock}`, inline: true },
          )
      ], ephemeral: true });
    }

    if (sub === 'supprimer') {
      if (!interaction.member.permissions.has(8n)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Admin uniquement.', ephemeral: true });
      const nom = interaction.options.getString('article');
      const r = db.db.prepare('DELETE FROM shop_items WHERE guild_id=? AND LOWER(name)=LOWER(?)').run(guildId, nom);
      if (!r.changes) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article **${nom}** introuvable.`, ephemeral: true });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `✅ Article **${nom}** supprimé.`, ephemeral: true });
    }
  }
};
