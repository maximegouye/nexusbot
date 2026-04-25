/**
 * NexusBot — Histoires collaboratives
 * UNIQUE : créer des histoires à plusieurs, chaque membre ajoute une phrase
 */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS histoires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT, channel_id TEXT,
    creator_id TEXT,
    title TEXT,
    genre TEXT DEFAULT 'aventure',
    status TEXT DEFAULT 'active',
    content TEXT DEFAULT '[]',
    contributors TEXT DEFAULT '[]',
    max_length INTEGER DEFAULT 50,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

const GENRES = {
  aventure:   { emoji: '⚔️',  description: 'Épopée et quête héroïque' },
  horreur:    { emoji: '👻',  description: 'Suspense et frissons' },
  romance:    { emoji: '💕',  description: 'Histoire d\'amour' },
  science_fiction: { emoji: '🚀', description: 'Futur et technologie' },
  comedie:    { emoji: '😂',  description: 'Légèreté et humour' },
  mystere:    { emoji: '🔍',  description: 'Enquête et rebondissements' },
  fantasy:    { emoji: '🧙',  description: 'Magie et créatures' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('histoire')
    .setDescription('📖 Créez des histoires collaboratives avec toute la communauté !')
    .addSubcommand(s => s.setName('creer').setDescription('📝 Créer une nouvelle histoire')
      .addStringOption(o => o.setName('titre').setDescription('Titre de l\'histoire').setRequired(true).setMaxLength(60))
      .addStringOption(o => o.setName('genre').setDescription('Genre de l\'histoire').setRequired(true)
        .addChoices(...Object.entries(GENRES).map(([k, v]) => ({ name: `${v.emoji} ${k} — ${v.description}`, value: k }))))
      .addStringOption(o => o.setName('debut').setDescription('La première phrase de l\'histoire').setRequired(true).setMaxLength(300)))
    .addSubcommand(s => s.setName('ecrire').setDescription('✏️ Ajouter une phrase à une histoire')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'histoire').setRequired(true))
      .addStringOption(o => o.setName('phrase').setDescription('Votre contribution (max 300 caractères)').setRequired(true).setMaxLength(300)))
    .addSubcommand(s => s.setName('lire').setDescription('📖 Lire une histoire')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'histoire').setRequired(true)))
    .addSubcommand(s => s.setName('liste').setDescription('📚 Voir les histoires actives'))
    .addSubcommand(s => s.setName('terminer').setDescription('🔒 Terminer une histoire (créateur seulement)')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'histoire').setRequired(true)))
    .addSubcommand(s => s.setName('info').setDescription('ℹ️ Infos sur une histoire')
      .addStringOption(o => o.setName('id').setDescription('ID de l\'histoire').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const cfg = db.getConfig(guildId);
    const coin = cfg.currency_emoji || '🪙';
    const now = Math.floor(Date.now() / 1000);

    if (sub === 'creer') {
      const active = db.db.prepare('SELECT COUNT(*) as c FROM histoires WHERE guild_id=? AND status=?').get(guildId, 'active');
      if (active.c >= 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum 5 histoires actives par serveur. Terminez-en une d\'abord.', ephemeral: true });

      const titre = interaction.options.getString('titre');
      const genre = interaction.options.getString('genre');
      const debut = interaction.options.getString('debut');
      const maxLen = parseInt(interaction.options.getString('longueur_max')) || 50;
      const g = GENRES[genre];

      const content = JSON.stringify([{ user_id: userId, text: debut, timestamp: now }]);
      const contributors = JSON.stringify([userId]);

      const result = db.db.prepare('INSERT INTO histoires (guild_id,channel_id,creator_id,title,genre,content,contributors,max_length) VALUES(?,?,?,?,?,?,?,?)')
        .run(guildId, interaction.channelId, userId, titre, genre, content, contributors, maxLen);

      // Récompense pour création
      db.addCoins(userId, guildId, 50);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`${g.emoji} Nouvelle histoire : ${titre}`)
        .setDescription(`**L'histoire commence...**\n\n*${debut}*`)
        .addFields(
          { name: `${g.emoji} Genre`, value: genre, inline: true },
          { name: '📝 ID', value: `**#${result.lastInsertRowid}**`, inline: true },
          { name: '📊 Max phrases', value: `${maxLen}`, inline: true },
        )
        .setFooter({ text: `Utilisez /histoire ecrire id:${result.lastInsertRowid} pour contribuer ! • +50 ${coin}` })
      ]});
    }

    if (sub === 'ecrire') {
      const id = parseInt(interaction.options.getString('id'));
      const phrase = interaction.options.getString('phrase');
      const story = db.db.prepare('SELECT * FROM histoires WHERE id=? AND guild_id=?').get(id, guildId);
      if (!story) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Histoire #${id} introuvable.`, ephemeral: true });
      if (story.status !== 'active') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Cette histoire est terminée.', ephemeral: true });

      const content = JSON.parse(story.content || '[]');
      const contributors = JSON.parse(story.contributors || '[]');

      // Anti-spam : pas deux phrases consécutives du même auteur
      if (content.length > 0 && content[content.length - 1].user_id === userId) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Vous avez déjà écrit la dernière phrase. Attendez qu\'un autre membre contribue !', ephemeral: true });
      }

      if (content.length >= story.max_length) {
        db.db.prepare('UPDATE histoires SET status=? WHERE id=?').run('terminee', id);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `📖 L'histoire #${id} a atteint sa longueur maximale et est maintenant **terminée** !` });
      }

      content.push({ user_id: userId, text: phrase, timestamp: now });
      if (!contributors.includes(userId)) contributors.push(userId);

      db.db.prepare('UPDATE histoires SET content=?, contributors=? WHERE id=?')
        .run(JSON.stringify(content), JSON.stringify(contributors), id);

      // Récompense
      db.addCoins(userId, guildId, 15);
      const g = GENRES[story.genre] || GENRES.aventure;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`${g.emoji} ${story.title} — Phrase ajoutée`)
        .setDescription(`**...**\n\n*${phrase}*`)
        .addFields(
          { name: '📊 Progression', value: `${content.length}/${story.max_length} phrases`, inline: true },
          { name: '👥 Contributeurs', value: `${contributors.length}`, inline: true },
          { name: '💰 Récompense', value: `+15 ${coin}`, inline: true },
        )
        .setFooter({ text: `Histoire #${id} • /histoire lire id:${id} pour tout lire` })
      ]});
    }

    if (sub === 'lire') {
      const id = parseInt(interaction.options.getString('id'));
      const page = (parseInt(interaction.options.getString('page')) || 1) - 1;
      const story = db.db.prepare('SELECT * FROM histoires WHERE id=? AND guild_id=?').get(id, guildId);
      if (!story) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Histoire #${id} introuvable.`, ephemeral: true });

      const content = JSON.parse(story.content || '[]');
      const perPage = 8;
      const totalPages = Math.ceil(content.length / perPage) || 1;
      if (page >= totalPages) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Page invalide (max: ${totalPages}).`, ephemeral: true });

      const slice = content.slice(page * perPage, (page + 1) * perPage);
      const g = GENRES[story.genre] || GENRES.aventure;
      const statusEmoji = story.status === 'active' ? '🟢' : '🔒';

      const text = slice.map((s, i) => `**${page * perPage + i + 1}.** ${s.text} *(par <@${s.user_id}>)*`).join('\n\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`${g.emoji} ${story.title} ${statusEmoji}`)
        .setDescription(text || '*Aucune phrase encore.*')
        .setFooter({ text: `Page ${page + 1}/${totalPages} • ${content.length} phrases au total • Histoire #${id}` })
      ]});
    }

    if (sub === 'liste') {
      const stories = db.db.prepare('SELECT * FROM histoires WHERE guild_id=? AND status=? ORDER BY id DESC LIMIT 10').all(guildId, 'active');
      if (!stories.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '📚 Aucune histoire active pour l\'instant. Créez-en une avec `/histoire creer` !', ephemeral: true });

      const desc = stories.map(s => {
        const g = GENRES[s.genre] || GENRES.aventure;
        const content = JSON.parse(s.content || '[]');
        const contributors = JSON.parse(s.contributors || '[]');
        return `${g.emoji} **[#${s.id}] ${s.title}** — ${content.length}/${s.max_length} phrases • ${contributors.length} contributeurs`;
      }).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle('📚 Histoires en cours')
        .setDescription(desc)
        .setFooter({ text: 'Utilisez /histoire lire pour lire • /histoire ecrire pour contribuer' })
      ]});
    }

    if (sub === 'terminer') {
      const id = parseInt(interaction.options.getString('id'));
      const story = db.db.prepare('SELECT * FROM histoires WHERE id=? AND guild_id=?').get(id, guildId);
      if (!story) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Histoire #${id} introuvable.`, ephemeral: true });
      if (story.creator_id !== userId && !interaction.member.permissions.has(0x8n)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le créateur ou un administrateur peut terminer cette histoire.', ephemeral: true });
      }
      db.db.prepare('UPDATE histoires SET status=? WHERE id=?').run('terminee', id);
      const content = JSON.parse(story.content || '[]');

      // Récompenser le créateur
      db.addCoins(story.creator_id, guildId, 100);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#2ECC71')
        .setTitle(`📖 Histoire terminée — ${story.title}`)
        .setDescription(`L'histoire **${story.title}** est maintenant archivée avec **${content.length} phrases** !\n\nMerci à tous les contributeurs ! 🎉\n+100 ${coin} pour le créateur.`)
        .setFooter({ text: `Histoire #${id} archivée` })
      ]});
    }

    if (sub === 'info') {
      const id = parseInt(interaction.options.getString('id'));
      const story = db.db.prepare('SELECT * FROM histoires WHERE id=? AND guild_id=?').get(id, guildId);
      if (!story) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Histoire #${id} introuvable.`, ephemeral: true });

      const content = JSON.parse(story.content || '[]');
      const contributors = JSON.parse(story.contributors || '[]');
      const g = GENRES[story.genre] || GENRES.aventure;
      const statusEmoji = story.status === 'active' ? '🟢 Active' : '🔒 Terminée';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#9B59B6')
        .setTitle(`${g.emoji} Infos — ${story.title}`)
        .addFields(
          { name: '🆔 ID', value: `#${id}`, inline: true },
          { name: `${g.emoji} Genre`, value: story.genre, inline: true },
          { name: '📊 Statut', value: statusEmoji, inline: true },
          { name: '📝 Phrases', value: `${content.length}/${story.max_length}`, inline: true },
          { name: '👥 Contributeurs', value: `${contributors.length}`, inline: true },
          { name: '✍️ Créateur', value: `<@${story.creator_id}>`, inline: true },
          { name: '📅 Créée', value: `<t:${story.created_at}:R>`, inline: true },
        )
        .setFooter({ text: 'Utilisez /histoire lire pour lire cette histoire' })
      ]});
    }
  }
};
