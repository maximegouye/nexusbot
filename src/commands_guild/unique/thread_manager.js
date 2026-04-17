/**
 * NexusBot — Gestionnaire de Threads
 * /thread — Créez, gérez et archivez des threads facilement
 */
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS managed_threads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    thread_id   TEXT NOT NULL UNIQUE,
    title       TEXT,
    category    TEXT,
    created_by  TEXT,
    auto_close  INTEGER DEFAULT 0,
    close_after INTEGER DEFAULT 86400,
    last_activity INTEGER DEFAULT (strftime('%s','now')),
    created_at  INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('thread')
    .setDescription('🧵 Gestionnaire de threads avancé')
    .addSubcommand(s => s.setName('creer')
      .setDescription('➕ Créer un thread')
      .addStringOption(o => o.setName('titre').setDescription('Titre du thread').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('categorie').setDescription('Catégorie (pour l\'organisation)').setMaxLength(50))
      .addBooleanOption(o => o.setName('prive').setDescription('Thread privé ? (visible uniquement par les invités)'))
      .addStringOption(o => o.setName('auto_close').setDescription('Fermer auto après inactivité')
        .addChoices(
          { name: '🕐 1 heure', value: '3600' },
          { name: '📅 1 jour', value: '86400' },
          { name: '📆 3 jours', value: '259200' },
          { name: '📆 7 jours', value: '604800' },
          { name: '♾️ Jamais', value: '0' },
        )))
    .addSubcommand(s => s.setName('fermer')
      .setDescription('🔒 Fermer et archiver le thread actuel'))
    .addSubcommand(s => s.setName('rouvrir')
      .setDescription('🔓 Ré-ouvrir le thread actuel'))
    .addSubcommand(s => s.setName('renommer')
      .setDescription('✏️ Renommer le thread actuel')
      .addStringOption(o => o.setName('titre').setDescription('Nouveau titre').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('liste')
      .setDescription('📋 Lister les threads actifs')
      .addStringOption(o => o.setName('categorie').setDescription('Filtrer par catégorie')))
    .addSubcommand(s => s.setName('épingler')
      .setDescription('📌 Épingler/désépingler un message dans ce thread')
      .addStringOption(o => o.setName('message_id').setDescription('ID du message').setRequired(true)))
    .addSubcommand(s => s.setName('inviter')
      .setDescription('👋 Inviter un membre dans ce thread')
      .addUserOption(o => o.setName('membre').setDescription('Membre à inviter').setRequired(true)))
    .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques des threads du serveur')),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const channel = interaction.channel;

    if (sub === 'creer') {
      const titre     = interaction.options.getString('titre');
      const categorie = interaction.options.getString('categorie') || 'Général';
      const prive     = interaction.options.getBoolean('prive') || false;
      const closeAfter = parseInt(interaction.options.getString('auto_close') || '86400');

      if (!channel.isTextBased() || channel.isThread()) {
        return interaction.editReply({ content: '❌ Utilise cette commande dans un salon texte principal.' });
      }

      try {
        const type = prive ? ChannelType.PrivateThread : ChannelType.PublicThread;
        const thread = await channel.threads.create({
          name: titre,
          type,
          reason: `Créé par ${interaction.user.username}`,
        });

        db.db.prepare('INSERT OR IGNORE INTO managed_threads (guild_id, thread_id, title, category, created_by, auto_close, close_after) VALUES (?,?,?,?,?,?,?)')
          .run(guildId, thread.id, titre, categorie, interaction.user.id, closeAfter > 0 ? 1 : 0, closeAfter);

        await thread.send({ embeds: [new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle(`🧵 Thread : ${titre}`)
          .setDescription(`Créé par ${interaction.user}\n**Catégorie :** ${categorie}\n${closeAfter > 0 ? `**Fermeture auto :** dans ${Math.round(closeAfter/3600)}h d'inactivité` : '**Fermeture auto :** Non'}`)
          .setFooter({ text: 'NexusBot Thread Manager' })
        ]});

        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setTitle('✅ Thread créé !')
          .setDescription(`${thread}`)
          .addFields({ name: '📋 Catégorie', value: categorie, inline: true });
        return interaction.editReply({ embeds: [embed] });
      } catch (e) {
        return interaction.editReply({ content: `❌ Impossible de créer le thread : ${e.message}` });
      }
    }

    if (sub === 'fermer') {
      if (!channel.isThread()) return interaction.editReply({ content: '❌ Cette commande doit être utilisée dans un thread.' });
      const canClose = interaction.member.permissions.has(PermissionFlagsBits.ManageThreads) || channel.ownerId === interaction.user.id;
      if (!canClose) return interaction.editReply({ content: '❌ Tu ne peux pas fermer ce thread.' });

      await channel.setArchived(true, `Fermé par ${interaction.user.username}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription('🔒 Thread fermé et archivé.')] });
    }

    if (sub === 'rouvrir') {
      if (!channel.isThread()) return interaction.editReply({ content: '❌ Cette commande doit être utilisée dans un thread.' });
      await channel.setArchived(false);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription('🔓 Thread ré-ouvert !')] });
    }

    if (sub === 'renommer') {
      if (!channel.isThread()) return interaction.editReply({ content: '❌ Cette commande doit être utilisée dans un thread.' });
      const newTitle = interaction.options.getString('titre');
      await channel.setName(newTitle);
      db.db.prepare('UPDATE managed_threads SET title=? WHERE thread_id=?').run(newTitle, channel.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Thread renommé en **${newTitle}**`)] });
    }

    if (sub === 'liste') {
      const categorie = interaction.options.getString('categorie');
      const query = categorie
        ? "SELECT * FROM managed_threads WHERE guild_id=? AND category=? ORDER BY last_activity DESC LIMIT 20"
        : "SELECT * FROM managed_threads WHERE guild_id=? ORDER BY last_activity DESC LIMIT 20";
      const threads = categorie
        ? db.db.prepare(query).all(guildId, categorie)
        : db.db.prepare(query).all(guildId);

      if (!threads.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun thread géré trouvé.')] });

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🧵 Threads${categorie ? ` — ${categorie}` : ''}`)
        .setDescription(threads.map(t => `• <#${t.thread_id}> — **${t.category}** — <@${t.created_by}>`).join('\n'))
        .setFooter({ text: `${threads.length} thread(s)` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'épingler') {
      if (!channel.isThread()) return interaction.editReply({ content: '❌ Dans un thread uniquement.' });
      const msgId = interaction.options.getString('message_id');
      try {
        const msg = await channel.messages.fetch(msgId);
        if (msg.pinned) { await msg.unpin(); return interaction.editReply({ content: '📌 Message désépinglé.' }); }
        await msg.pin();
        return interaction.editReply({ content: '📌 Message épinglé !' });
      } catch {
        return interaction.editReply({ content: '❌ Message introuvable.' });
      }
    }

    if (sub === 'inviter') {
      if (!channel.isThread()) return interaction.editReply({ content: '❌ Dans un thread uniquement.' });
      const membre = interaction.options.getMember('membre');
      await channel.members.add(membre.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ **${membre.user.username}** ajouté au thread !`)] });
    }

    if (sub === 'stats') {
      const total = db.db.prepare('SELECT COUNT(*) as c FROM managed_threads WHERE guild_id=?').get(guildId).c;
      const cats  = db.db.prepare("SELECT category, COUNT(*) as c FROM managed_threads WHERE guild_id=? GROUP BY category ORDER BY c DESC LIMIT 5").all(guildId);
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📊 Statistiques des Threads')
        .addFields(
          { name: '🧵 Total créés', value: `${total}`, inline: true },
          { name: '📂 Catégories',  value: cats.length ? cats.map(c => `**${c.category}** : ${c.c}`).join('\n') : 'Aucune', inline: false },
        );
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
