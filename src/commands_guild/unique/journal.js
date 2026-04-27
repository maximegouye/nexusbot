/**
 * NexusBot — Journal du serveur (Newspaper system)
 * UNIQUE : Rédiger des articles, éditions hebdomadaires, scoops
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS journal_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, author_id TEXT,
    title TEXT, content TEXT, category TEXT DEFAULT 'actu',
    edition INTEGER DEFAULT 1,
    likes INTEGER DEFAULT 0,
    published INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS journal_likes (
    article_id INTEGER, user_id TEXT, guild_id TEXT,
    PRIMARY KEY(article_id, user_id)
  )`).run();
} catch {}

const CATEGORIES = ['actu','sport','culture','economie','science','interview','opinion','humour'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('journal')
    .setDescription('📰 Journal du serveur — rédigez et lisez les actualités !')
    .addSubcommand(s => s.setName('ecrire').setDescription('✍️ Écrire un article')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'article').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('contenu').setDescription('Contenu de l\'article').setRequired(true).setMaxLength(1500))
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie').setRequired(true)
        .addChoices(...CATEGORIES.map(c => ({ name: c.charAt(0).toUpperCase()+c.slice(1), value: c })))))
    .addSubcommand(s => s.setName('lire').setDescription('📖 Lire un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))
    .addSubcommand(s => s.setName('une').setDescription('📰 La Une — derniers articles publiés'))
    .addSubcommand(s => s.setName('categorie').setDescription('📚 Articles par catégorie')
      .addStringOption(o => o.setName('cat').setDescription('Catégorie').setRequired(true)
        .addChoices(...CATEGORIES.map(c => ({ name: c.charAt(0).toUpperCase()+c.slice(1), value: c })))))
    .addSubcommand(s => s.setName('liker').setDescription('👍 Liker un article')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))
    .addSubcommand(s => s.setName('publier').setDescription('📢 Publier un article (modérateurs)')
      .addIntegerOption(o => o.setName('id').setDescription('ID de l\'article').setRequired(true)))
    .addSubcommand(s => s.setName('mes_articles').setDescription('📝 Voir mes articles'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Articles les plus aimés')),

  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      try { await interaction.deferReply({ ephemeral: false }); } catch (e) { /* already ack'd */ }
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';

    if (sub === 'ecrire') {
      const titre = interaction.options.getString('titre');
      const contenu = interaction.options.getString('contenu');
      const categorie = interaction.options.getString('categorie');

      // Vérifier si le membre a un rôle de journaliste ou est modérateur
      const isMod = interaction.member.permissions.has(0x8n) || interaction.member.permissions.has(0x20n);
      const published = isMod ? 1 : 0;

      const result = db.db.prepare('INSERT INTO journal_articles (guild_id,author_id,title,content,category,published) VALUES(?,?,?,?,?,?)')
        .run(guildId, userId, titre, contenu, categorie, published);

      // Récompense
      db.addCoins(userId, guildId, 25);

      const embed = new EmbedBuilder().setColor('#E67E22')
        .setTitle(`📰 Article soumis : ${titre}`)
        .setDescription(contenu.length > 300 ? contenu.slice(0, 300) + '...' : contenu)
        .addFields(
          { name: '📚 Catégorie', value: categorie, inline: true },
          { name: '🆔 ID', value: `#${result.lastInsertRowid}`, inline: true },
          { name: '📊 Statut', value: isMod ? '✅ Publié directement' : '⏳ En attente de modération', inline: true },
        )
        .setFooter({ text: `+25 ${coin} pour la contribution !` });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [embed] });
    }

    if (sub === 'lire') {
      const id = parseInt(interaction.options.getInteger('id'));
      const article = db.db.prepare('SELECT * FROM journal_articles WHERE id=? AND guild_id=?').get(id, guildId);
      if (!article) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      if (!article.published && !interaction.member.permissions.has(0x20n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cet article est en attente de modération.', ephemeral: true });
      }
      const catEmojis = { actu:'📰', sport:'⚽', culture:'🎭', economie:'💰', science:'🔬', interview:'🎤', opinion:'💭', humour:'😂' };
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#3498DB')
        .setTitle(`${catEmojis[article.category] || '📰'} ${article.title}`)
        .setDescription(article.content)
        .addFields(
          { name: '✍️ Auteur', value: `<@${article.author_id}>`, inline: true },
          { name: '📚 Catégorie', value: article.category, inline: true },
          { name: '👍 Likes', value: article.likes.toString(), inline: true },
          { name: '📅 Publié', value: `<t:${article.created_at}:D>`, inline: true },
        )
        .setFooter({ text: `Article #${id} | /journal liker id:${id}` })] });
    }

    if (sub === 'une') {
      const articles = db.db.prepare('SELECT * FROM journal_articles WHERE guild_id=? AND published=1 ORDER BY created_at DESC LIMIT 8').all(guildId);
      if (!articles.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📰 Aucun article publié pour l\'instant. Soyez le premier à écrire avec `/journal ecrire` !', ephemeral: true });
      const catEmojis = { actu:'📰', sport:'⚽', culture:'🎭', economie:'💰', science:'🔬', interview:'🎤', opinion:'💭', humour:'😂' };
      const desc = articles.map(a => `${catEmojis[a.category]||'📰'} **[#${a.id}] ${a.title}** — par <@${a.author_id}> | 👍 ${a.likes}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('📰 LA UNE — Derniers articles')
        .setDescription(desc)
        .setFooter({ text: '/journal lire id:<n> pour lire un article' })] });
    }

    if (sub === 'categorie') {
      const cat = interaction.options.getString('cat');
      const articles = db.db.prepare('SELECT * FROM journal_articles WHERE guild_id=? AND category=? AND published=1 ORDER BY created_at DESC LIMIT 8').all(guildId, cat);
      if (!articles.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `📰 Aucun article dans la catégorie **${cat}**.`, ephemeral: true });
      const desc = articles.map(a => `**[#${a.id}] ${a.title}** — par <@${a.author_id}> | 👍 ${a.likes}`).join('\n');
      const cap = cat.charAt(0).toUpperCase()+cat.slice(1);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`📚 Articles : ${cap}`)
        .setDescription(desc)] });
    }

    if (sub === 'liker') {
      const id = parseInt(interaction.options.getInteger('id'));
      const article = db.db.prepare('SELECT * FROM journal_articles WHERE id=? AND guild_id=?').get(id, guildId);
      if (!article) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      if (article.author_id === userId) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous ne pouvez pas liker votre propre article.', ephemeral: true });

      const existing = db.db.prepare('SELECT 1 FROM journal_likes WHERE article_id=? AND user_id=?').get(id, userId);
      if (existing) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà liké cet article.', ephemeral: true });

      db.db.prepare('INSERT INTO journal_likes (article_id,user_id,guild_id) VALUES(?,?,?)').run(id, userId, guildId);
      db.db.prepare('UPDATE journal_articles SET likes=likes+1 WHERE id=?').run(id);
      db.addCoins(article.author_id, guildId, 5);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `👍 Vous avez liké **"${article.title}"** ! +5 ${coin} pour l\'auteur.`, ephemeral: true });
    }

    if (sub === 'publier') {
      if (!interaction.member.permissions.has(0x8n) && !interaction.member.permissions.has(0x20n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seuls les modérateurs peuvent publier des articles.', ephemeral: true });
      }
      const id = parseInt(interaction.options.getInteger('id'));
      const article = db.db.prepare('SELECT * FROM journal_articles WHERE id=? AND guild_id=?').get(id, guildId);
      if (!article) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Article #${id} introuvable.`, ephemeral: true });
      if (article.published) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cet article est déjà publié.', ephemeral: true });

      db.db.prepare('UPDATE journal_articles SET published=1 WHERE id=?').run(id);
      db.addCoins(article.author_id, guildId, 50);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`📢 Article publié : ${article.title}`)
        .setDescription(`Article #${id} de <@${article.author_id}> est maintenant **public** ! (+50 ${coin} pour l\'auteur)`)
        .setFooter({ text: '/journal lire id:' + id + ' pour le lire' })] });
    }

    if (sub === 'mes_articles') {
      const articles = db.db.prepare('SELECT * FROM journal_articles WHERE guild_id=? AND author_id=? ORDER BY created_at DESC LIMIT 10').all(guildId, userId);
      if (!articles.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📝 Vous n\'avez écrit aucun article. Commencez avec `/journal ecrire` !', ephemeral: true });
      const desc = articles.map(a => `**[#${a.id}] ${a.title}** — ${a.published ? '✅ Publié' : '⏳ En attente'} | 👍 ${a.likes}`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#E67E22')
        .setTitle('📝 Vos articles')
        .setDescription(desc)], ephemeral: true });
    }

    if (sub === 'top') {
      const top = db.db.prepare('SELECT * FROM journal_articles WHERE guild_id=? AND published=1 ORDER BY likes DESC LIMIT 5').all(guildId);
      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun article publié.', ephemeral: true });
      const medals = ['🥇','🥈','🥉'];
      const desc = top.map((a, i) => `${medals[i]||`**${i+1}.**`} **${a.title}** — 👍 ${a.likes} par <@${a.author_id}>`).join('\n');
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#F1C40F')
        .setTitle('🏆 Articles les plus aimés')
        .setDescription(desc)] });
    }
  }
};
