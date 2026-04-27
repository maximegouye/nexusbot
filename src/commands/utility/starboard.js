const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

db.db.prepare(`CREATE TABLE IF NOT EXISTS starboard_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT, original_msg_id TEXT, star_msg_id TEXT, channel_id TEXT, stars INTEGER DEFAULT 1,
  author_id TEXT,
  UNIQUE(guild_id, original_msg_id)
)`).run();

// Migration : ajouter author_id si absent
try { db.db.prepare('ALTER TABLE starboard_messages ADD COLUMN author_id TEXT').run(); } catch {}

db.db.prepare(`CREATE TABLE IF NOT EXISTS starboard_config (
  guild_id TEXT PRIMARY KEY, channel_id TEXT, threshold INTEGER DEFAULT 3,
  emoji TEXT DEFAULT '⭐', self_star INTEGER DEFAULT 0
)`).run();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('⭐ Gérer le tableau d\'honneur des meilleurs messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('Configurer le starboard')
      .addChannelOption(o => o.setName('salon').setDescription('Salon starboard').setRequired(true))
      .addIntegerOption(o => o.setName('seuil').setDescription('Nombre d\'étoiles minimum (défaut: 3)').setMinValue(1).setMaxValue(100).setRequired(false))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji de vote (défaut: ⭐)'))
      .addBooleanOption(o => o.setName('selfstar').setDescription('Autoriser de voter son propre message')))
    .addSubcommand(s => s.setName('statut').setDescription('Voir la configuration et les statistiques'))
    .addSubcommand(s => s.setName('top').setDescription('🏆 Top des messages les plus étoilés')
      .addIntegerOption(o => o.setName('limite').setDescription('Nombre de messages (défaut: 10)').setMinValue(1).setMaxValue(50).setRequired(false)))
    .addSubcommand(s => s.setName('aleatoire').setDescription('🎲 Afficher un message étoilé au hasard'))
    .addSubcommand(s => s.setName('desactiver').setDescription('Désactiver le starboard'))
    .addSubcommand(s => s.setName('reset').setDescription('🗑️ Réinitialiser tous les messages étoilés')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── SETUP ──────────────────────────────────────────────────
    if (sub === 'setup') {
      const ch       = interaction.options.getChannel('salon');
      const seuil    = interaction.options.getInteger('seuil') ?? 3;
      const emoji    = interaction.options.getString('emoji') ?? '⭐';
      const selfstar = interaction.options.getBoolean('selfstar') ?? false;

      db.db.prepare(`INSERT OR REPLACE INTO starboard_config VALUES (?,?,?,?,?)`).run(
        guildId, ch.id, seuil, emoji, selfstar ? 1 : 0);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('⭐ Starboard configuré avec succès !')
          .setDescription('Les messages qui atteignent le seuil d\'étoiles seront automatiquement affichés dans le salon choisi.')
          .addFields(
            { name: '📌 Salon', value: `<#${ch.id}>`, inline: true },
            { name: '🔢 Seuil', value: `${seuil} ${emoji}`, inline: true },
            { name: '🤳 Self-star', value: selfstar ? '✅ Autorisé' : '❌ Interdit', inline: true },
          )
          .setFooter({ text: 'Les membres peuvent maintenant étoiler des messages !' })
          .setTimestamp()
      ], ephemeral: true });
    }

    // ── STATUT ────────────────────────────────────────────────
    if (sub === 'statut') {
      const cfg = db.db.prepare('SELECT * FROM starboard_config WHERE guild_id=?').get(guildId);
      if (!cfg) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Le starboard n\'est pas configuré. Utilise `/starboard setup` d\'abord.', ephemeral: true });

      const total   = db.db.prepare('SELECT COUNT(*) as c FROM starboard_messages WHERE guild_id=?').get(guildId)?.c ?? 0;
      const maxMsg  = db.db.prepare('SELECT * FROM starboard_messages WHERE guild_id=? ORDER BY stars DESC LIMIT 1').get(guildId);
      const sumRows = db.db.prepare('SELECT SUM(stars) as s FROM starboard_messages WHERE guild_id=?').get(guildId);
      const totalStars = sumRows?.s ?? 0;

      // Top auteur
      let topAuthor = '';
      try {
        const topRow = db.db.prepare('SELECT author_id, SUM(stars) as s FROM starboard_messages WHERE guild_id=? GROUP BY author_id ORDER BY s DESC LIMIT 1').get(guildId);
        if (topRow?.author_id) topAuthor = `<@${topRow.author_id}> (${topRow.s} ⭐)`;
      } catch {}

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('⭐ Statut du Starboard')
          .setDescription(`Salon : <#${cfg.channel_id}> • Seuil : **${cfg.threshold} ${cfg.emoji}** • Self-star : **${cfg.self_star ? 'Oui' : 'Non'}**`)
          .addFields(
            { name: '📊 Messages dans le starboard', value: `**${total}**`, inline: true },
            { name: '⭐ Total d\'étoiles distribuées', value: `**${totalStars}**`, inline: true },
            { name: '🏆 Meilleur auteur', value: topAuthor || 'Aucun encore', inline: true },
            { name: '🥇 Record absolu', value: maxMsg ? `**${maxMsg.stars} ${cfg.emoji}** sur <#${maxMsg.channel_id}>` : 'Aucun encore', inline: false },
          )
          .setFooter({ text: `Utilise /starboard top pour voir le classement complet` })
          .setTimestamp()
      ], ephemeral: true });
    }

    // ── TOP ────────────────────────────────────────────────────
    if (sub === 'top') {
      const limite = interaction.options.getInteger('limite') ?? 10;
      const top = db.db.prepare('SELECT * FROM starboard_messages WHERE guild_id=? ORDER BY stars DESC LIMIT ?').all(guildId, limite);

      if (!top.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun message dans le starboard pour l\'instant.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      const cfg = db.db.prepare('SELECT * FROM starboard_config WHERE guild_id=?').get(guildId);
      const emoji = cfg?.emoji ?? '⭐';
      const medals = ['🥇', '🥈', '🥉'];

      const lines = top.map((m, i) => {
        const medal = medals[i] ?? `**${i + 1}.**`;
        const author = m.author_id ? `<@${m.author_id}>` : 'Inconnu';
        const link = m.star_msg_id && m.channel_id
          ? `[Voir](https://discord.com/channels/${guildId}/${m.channel_id}/${m.original_msg_id})`
          : '';
        return `${medal} ${author} — **${m.stars} ${emoji}** ${link}`;
      }).join('\n');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🏆 Top ${limite} — Starboard`)
          .setDescription(lines)
          .setFooter({ text: `${top.length} messages affichés` })
          .setTimestamp()
      ]});
    }

    // ── ALÉATOIRE ─────────────────────────────────────────────
    if (sub === 'aleatoire') {
      const all = db.db.prepare('SELECT * FROM starboard_messages WHERE guild_id=?').all(guildId);
      if (!all.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun message dans le starboard pour l\'instant.', ephemeral: true });

      const random = all[Math.floor(Math.random() * all.length)];
      const cfg    = db.db.prepare('SELECT * FROM starboard_config WHERE guild_id=?').get(guildId);
      const emoji  = cfg?.emoji ?? '⭐';

      let msgContent = '*Contenu indisponible*';
      let authorTag  = 'Inconnu';
      let authorIcon = undefined;

      try {
        const ch  = interaction.guild.channels.cache.get(random.channel_id);
        const msg = await ch?.messages.fetch(random.original_msg_id);
        if (msg) {
          msgContent = msg.content || '*[Image/Fichier sans texte]*';
          authorTag  = msg.author.username;
          authorIcon = msg.author.displayAvatarURL();
        }
      } catch {}

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle('🎲 Message aléatoire du Starboard')
          .setAuthor({ name: authorTag, iconURL: authorIcon })
          .setDescription(msgContent)
          .addFields(
            { name: `${emoji} Étoiles`, value: `**${random.stars}**`, inline: true },
            { name: '💬 Salon', value: `<#${random.channel_id}>`, inline: true },
            { name: '🔗 Lien', value: `[Aller au message](https://discord.com/channels/${guildId}/${random.channel_id}/${random.original_msg_id})`, inline: true },
          )
          .setFooter({ text: 'Un message qui a marqué les esprits !' })
          .setTimestamp()
      ], ephemeral: false });
    }

    // ── DÉSACTIVER ────────────────────────────────────────────
    if (sub === 'desactiver') {
      db.db.prepare('DELETE FROM starboard_config WHERE guild_id=?').run(guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Red').setTitle('❌ Starboard désactivé')
          .setDescription('Le starboard a été désactivé. Les anciens messages restent en base mais aucun nouveau ne sera ajouté.')
      ], ephemeral: true });
    }

    // ── RESET ─────────────────────────────────────────────────
    if (sub === 'reset') {
      const count = db.db.prepare('SELECT COUNT(*) as c FROM starboard_messages WHERE guild_id=?').get(guildId)?.c ?? 0;
      if (!count) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucun message à supprimer.', ephemeral: true });

      db.db.prepare('DELETE FROM starboard_messages WHERE guild_id=?').run(guildId);
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [
        new EmbedBuilder().setColor('Orange').setTitle('🗑️ Starboard réinitialisé')
          .setDescription(`**${count} message(s)** ont été supprimés de la base de données du starboard.\n> Les messages Discord dans le salon restent, seul le suivi est effacé.`)
      ], ephemeral: true });
    }
  }
};
