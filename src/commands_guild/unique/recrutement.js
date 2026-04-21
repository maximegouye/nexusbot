/**
 * NexusBot — Système de Recrutement Serveur
 * /recrutement — Gérez les candidatures pour rejoindre le serveur ou des rôles
 */
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../../database/db');

try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS recrutement_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    creator_id   TEXT NOT NULL,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    requirements TEXT,
    role_id      TEXT,
    channel_id   TEXT,
    slots        INTEGER DEFAULT 0,
    filled       INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'open',
    msg_id       TEXT,
    created_at   INTEGER DEFAULT (strftime('%s','now'))
  )`).run();
  db.db.prepare(`CREATE TABLE IF NOT EXISTS recrutement_candidatures (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id      INTEGER NOT NULL,
    guild_id     TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    motivation   TEXT,
    status       TEXT DEFAULT 'pending',
    reviewed_by  TEXT,
    created_at   INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(post_id, user_id)
  )`).run();
} catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recrutement')
    .setDescription('📋 Système de recrutement pour le serveur')
    .addSubcommand(s => s.setName('ouvrir')
      .setDescription('📢 Ouvrir un poste de recrutement')
      .addStringOption(o => o.setName('titre').setDescription('Titre du poste').setRequired(true).setMaxLength(100))
      .addStringOption(o => o.setName('description').setDescription('Description du poste').setRequired(true).setMaxLength(1000))
      .addStringOption(o => o.setName('conditions').setDescription('Conditions requises').setMaxLength(500))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer si accepté'))
      .addChannelOption(o => o.setName('salon').setDescription('Salon pour l\'annonce')))
    .addSubcommand(s => s.setName('postuler')
      .setDescription('📝 Postuler à un recrutement')
      .addStringOption(o => o.setName('id').setDescription('ID du poste').setRequired(true))
      .addStringOption(o => o.setName('motivation').setDescription('Votre lettre de motivation').setRequired(true).setMaxLength(600)))
    .addSubcommand(s => s.setName('candidatures')
      .setDescription('👥 Voir les candidatures d\'un poste (admin)')
      .addStringOption(o => o.setName('id').setDescription('ID du poste').setRequired(true)))
    .addSubcommand(s => s.setName('decider')
      .setDescription('✅ Accepter ou refuser une candidature')
      .addStringOption(o => o.setName('candidature_id').setDescription('ID de la candidature').setRequired(true))
      .addStringOption(o => o.setName('decision').setDescription('Decision').setRequired(true)
        .addChoices(
          { name: '✅ Accepter', value: 'accepted' },
          { name: '❌ Refuser',  value: 'rejected' },
        )))
    .addSubcommand(s => s.setName('liste').setDescription('📋 Voir les postes ouverts'))
    .addSubcommand(s => s.setName('fermer')
      .setDescription('🔒 Fermer un poste')
      .addStringOption(o => o.setName('id').setDescription('ID du poste').setRequired(true))),

  cooldown: 5,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId  = interaction.user.id;

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (sub === 'ouvrir') {
      if (!isAdmin) return interaction.editReply({ content: '❌ Permission insuffisante.' });

      const titre       = interaction.options.getString('titre');
      const description = interaction.options.getString('description');
      const conditions  = interaction.options.getString('conditions');
      const role        = interaction.options.getRole('role');
      const places      = parseInt(interaction.options.getString('places')) || 0;
      const salon       = interaction.options.getChannel('salon');

      const result = db.db.prepare('INSERT INTO recrutement_posts (guild_id, creator_id, title, description, requirements, role_id, channel_id, slots) VALUES (?,?,?,?,?,?,?,?)')
        .run(guildId, userId, titre, description, conditions || null, role?.id || null, salon?.id || null, places);
      const id = result.lastInsertRowid;

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`📋 Recrutement #${id} — ${titre}`)
        .setDescription(description)
        .addFields(
          { name: '🎯 Places disponibles', value: places === 0 ? 'Illimitées' : `${places}`, inline: true },
          { name: '🏷️ Rôle attribué',     value: role ? `<@&${role.id}>` : 'Aucun',          inline: true },
        );
      if (conditions) embed.addFields({ name: '📋 Conditions', value: conditions, inline: false });
      embed.setFooter({ text: `Postulez avec /recrutement postuler ${id}` });

      if (salon) {
        const msg = await salon.send({ embeds: [embed] }).catch(() => null);
        if (msg) db.db.prepare('UPDATE recrutement_posts SET msg_id=? WHERE id=?').run(msg.id, id);
      }

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setDescription(`✅ Poste de recrutement **#${id}** ouvert !${salon ? ` Annoncé dans <#${salon.id}>` : ''}`)] });
    }

    if (sub === 'postuler') {
      const id         = parseInt(interaction.options.getString('id'));
      const motivation = interaction.options.getString('motivation');
      const post       = db.db.prepare('SELECT * FROM recrutement_posts WHERE id=? AND guild_id=?').get(id, guildId);

      if (!post) return interaction.editReply({ content: `❌ Poste #${id} introuvable.` });
      if (post.status !== 'open') return interaction.editReply({ content: '❌ Ce poste est fermé.' });
      if (post.slots > 0 && post.filled >= post.slots) return interaction.editReply({ content: '❌ Plus de places disponibles !' });

      const existing = db.db.prepare('SELECT * FROM recrutement_candidatures WHERE post_id=? AND user_id=?').get(id, userId);
      if (existing) return interaction.editReply({ content: '❌ Tu as déjà postulé à ce poste !' });

      const result = db.db.prepare('INSERT INTO recrutement_candidatures (post_id, guild_id, user_id, motivation) VALUES (?,?,?,?)').run(id, guildId, userId, motivation);

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`✅ Candidature #${result.lastInsertRowid} envoyée !`)
        .setDescription(`Pour le poste **${post.title}** (#${id}).\nUn admin examinera ta candidature.`)
        .addFields({ name: '📝 Ta motivation', value: motivation, inline: false })
      ]});
    }

    if (sub === 'candidatures') {
      if (!isAdmin) return interaction.editReply({ content: '❌ Permission insuffisante.' });
      const id   = parseInt(interaction.options.getString('id'));
      const post = db.db.prepare('SELECT * FROM recrutement_posts WHERE id=? AND guild_id=?').get(id, guildId);
      if (!post) return interaction.editReply({ content: `❌ Poste #${id} introuvable.` });

      const cands = db.db.prepare('SELECT * FROM recrutement_candidatures WHERE post_id=? ORDER BY created_at DESC').all(id);
      if (!cands.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucune candidature pour ce poste.')] });

      const statusEmoji = { pending: '⏳', accepted: '✅', rejected: '❌' };
      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`👥 Candidatures — Poste #${id} : ${post.title}`)
        .setDescription(cands.map(c => `${statusEmoji[c.status]} **Candidature #${c.id}** — <@${c.user_id}>\n> ${c.motivation.slice(0,80)}${c.motivation.length>80?'...':''}\n> <t:${c.created_at}:R>`).join('\n\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'decider') {
      if (!isAdmin) return interaction.editReply({ content: '❌ Permission insuffisante.' });
      const candId   = parseInt(interaction.options.getString('candidature_id'));
      const decision = interaction.options.getString('decision');
      const cand     = db.db.prepare('SELECT * FROM recrutement_candidatures WHERE id=? AND guild_id=?').get(candId, guildId);
      if (!cand) return interaction.editReply({ content: `❌ Candidature #${candId} introuvable.` });
      if (cand.status !== 'pending') return interaction.editReply({ content: '❌ Candidature déjà traitée.' });

      db.db.prepare('UPDATE recrutement_candidatures SET status=?, reviewed_by=? WHERE id=?').run(decision, userId, candId);

      if (decision === 'accepted') {
        const post = db.db.prepare('SELECT * FROM recrutement_posts WHERE id=?').get(cand.post_id);
        db.db.prepare('UPDATE recrutement_posts SET filled=filled+1 WHERE id=?').run(cand.post_id);

        // Attribuer le rôle si configuré
        if (post?.role_id) {
          const member = interaction.guild.members.cache.get(cand.user_id);
          if (member) await member.roles.add(post.role_id).catch(() => {});
        }

        // Notifier le candidat en DM
        const candidate = await interaction.client.users.fetch(cand.user_id).catch(() => null);
        if (candidate) {
          candidate.send({ embeds: [new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`✅ Candidature Acceptée — ${interaction.guild.name}`)
            .setDescription(`Félicitations ! Ta candidature pour le poste **#${cand.post_id}** a été acceptée.${post?.role_id ? ` Le rôle <@&${post.role_id}> t'a été attribué !` : ''}`)
          ]}).catch(() => {});
        }
      } else {
        const candidate = await interaction.client.users.fetch(cand.user_id).catch(() => null);
        if (candidate) {
          candidate.send({ embeds: [new EmbedBuilder()
            .setColor('#e74c3c')
            .setDescription(`❌ Ta candidature pour **${interaction.guild.name}** (poste #${cand.post_id}) n'a pas été retenue cette fois. Bonne chance pour la suite !`)
          ]}).catch(() => {});
        }
      }

      return interaction.editReply({ embeds: [new EmbedBuilder()
        .setColor(decision === 'accepted' ? '#2ecc71' : '#e74c3c')
        .setDescription(`${decision === 'accepted' ? '✅' : '❌'} Candidature **#${candId}** ${decision === 'accepted' ? 'acceptée' : 'refusée'}. Le candidat a été notifié.`)
      ]});
    }

    if (sub === 'liste') {
      const posts = db.db.prepare("SELECT * FROM recrutement_posts WHERE guild_id=? AND status='open' ORDER BY created_at DESC LIMIT 10").all(guildId);
      if (!posts.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#95a5a6').setDescription('Aucun poste de recrutement ouvert.')] });
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('📋 Postes de Recrutement Ouverts')
        .setDescription(posts.map(p => {
          const places = p.slots > 0 ? `${p.filled}/${p.slots} places` : 'Places illimitées';
          return `**#${p.id}** — **${p.title}**\n> ${p.description.slice(0,80)}...\n> ${places} — <t:${p.created_at}:R>`;
        }).join('\n\n'));
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'fermer') {
      if (!isAdmin) return interaction.editReply({ content: '❌ Permission insuffisante.' });
      const id   = parseInt(interaction.options.getString('id'));
      const post = db.db.prepare('SELECT * FROM recrutement_posts WHERE id=? AND guild_id=?').get(id, guildId);
      if (!post) return interaction.editReply({ content: `❌ Poste #${id} introuvable.` });
      db.db.prepare("UPDATE recrutement_posts SET status='closed' WHERE id=?").run(id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#e74c3c').setDescription(`🔒 Poste de recrutement **#${id}** fermé.`)] });
    }
  }
};
