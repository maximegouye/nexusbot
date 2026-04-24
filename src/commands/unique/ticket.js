const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, PermissionFlagsBits,
  ChannelType, StringSelectMenuBuilder, AttachmentBuilder
} = require('discord.js');
const db = require('../../database/db');

// ── Migrations inline ────────────────────────────────────
try {
  const tc = db.db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name);
  if (!tc.includes('category'))          db.db.prepare("ALTER TABLE tickets ADD COLUMN category TEXT DEFAULT 'support'").run();
  if (!tc.includes('claimed_by'))        db.db.prepare("ALTER TABLE tickets ADD COLUMN claimed_by TEXT").run();
  if (!tc.includes('close_reason'))      db.db.prepare("ALTER TABLE tickets ADD COLUMN close_reason TEXT").run();
  if (!tc.includes('rating'))            db.db.prepare("ALTER TABLE tickets ADD COLUMN rating INTEGER").run();
  if (!tc.includes('priority'))          db.db.prepare("ALTER TABLE tickets ADD COLUMN priority TEXT DEFAULT 'normale'").run();
  if (!tc.includes('warn_sent'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN warn_sent INTEGER DEFAULT 0').run();
  if (!tc.includes('closed_at'))         db.db.prepare('ALTER TABLE tickets ADD COLUMN closed_at INTEGER').run();
  // v2 — colonnes supplémentaires
  if (!tc.includes('tags'))              db.db.prepare("ALTER TABLE tickets ADD COLUMN tags TEXT DEFAULT '[]'").run();
  if (!tc.includes('first_response_at')) db.db.prepare('ALTER TABLE tickets ADD COLUMN first_response_at INTEGER').run();
} catch {}
try {
  const gc = db.db.prepare('PRAGMA table_info(guild_config)').all().map(c => c.name);
  if (!gc.includes('ticket_log_channel'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN ticket_log_channel TEXT").run();
  if (!gc.includes('ticket_welcome_msg'))  db.db.prepare("ALTER TABLE guild_config ADD COLUMN ticket_welcome_msg TEXT").run();
} catch {}
// Blacklist tickets
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    reason   TEXT,
    banned_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, user_id)
  )`).run();
} catch {}
// Réponses rapides personnalisées (v2)
try {
  db.db.prepare(`CREATE TABLE IF NOT EXISTS ticket_quick_replies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    title      TEXT NOT NULL,
    content    TEXT NOT NULL,
    created_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, title)
  )`).run();
} catch {}

// ── Catégories ───────────────────────────────────────────
const CATEGORIES = [
  { value: 'support',      label: '💬 Support Général',    description: 'Question ou aide générale',    emoji: '💬', color: '#7B2FBE' },
  { value: 'bug',          label: '🐛 Problème Technique', description: 'Bug ou dysfonctionnement',      emoji: '🐛', color: '#E74C3C' },
  { value: 'partenariat',  label: '🤝 Partenariat',        description: 'Demande de partenariat',        emoji: '🤝', color: '#2ECC71' },
  { value: 'signalement',  label: '🚨 Signalement',        description: 'Signaler un membre/comportement', emoji: '🚨', color: '#E67E22' },
  { value: 'achat',        label: '💰 Achat / Premium',    description: 'Question sur un achat',         emoji: '💰', color: '#F1C40F' },
  { value: 'autre',        label: '📋 Autre',              description: 'Toute autre demande',           emoji: '📋', color: '#95A5A6' },
];

function getCatInfo(value) {
  return CATEGORIES.find(c => c.value === value) || CATEGORIES[0];
}

// ── Priorités ────────────────────────────────────────────
const PRIORITIES = [
  { value: 'faible',  label: '🟢 Faible',  description: 'Pas urgent, quand vous avez le temps', emoji: '🟢' },
  { value: 'normale', label: '🟡 Normale', description: 'Demande standard',                      emoji: '🟡' },
  { value: 'elevee',  label: '🟠 Élevée',  description: 'Assez urgent',                          emoji: '🟠' },
  { value: 'urgente', label: '🔴 Urgente', description: 'Besoin d\'aide immédiatement',           emoji: '🔴' },
];
function getPriInfo(value) {
  return PRIORITIES.find(p => p.value === value) || PRIORITIES[1];
}

// ── Génère le transcript texte ───────────────────────────
async function generateTranscript(channel, ticket) {
  let messages = [];
  let before;
  try {
    for (let i = 0; i < 5; i++) {
      const fetched = await channel.messages.fetch({ limit: 100, before });
      if (!fetched.size) break;
      messages = messages.concat([...fetched.values()]);
      before = fetched.last()?.id;
      if (fetched.size < 100) break;
    }
  } catch {}

  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const cat = getCatInfo(ticket.category);

  let txt = `═══════════════════════════════════════════════════════\n`;
  txt += `  TRANSCRIPT TICKET — ${channel.name.toUpperCase()}\n`;
  txt += `═══════════════════════════════════════════════════════\n`;
  const pri = getPriInfo(ticket.priority);
  txt += `  Catégorie : ${cat.label}\n`;
  txt += `  Priorité  : ${pri.label}\n`;
  txt += `  Créé par  : <@${ticket.user_id}> (${ticket.user_id})\n`;
  txt += `  Salon     : #${channel.name}\n`;
  txt += `  Ouvert le : ${new Date(ticket.created_at * 1000).toLocaleString('fr-FR')}\n`;
  txt += `  Fermé le  : ${new Date().toLocaleString('fr-FR')}\n`;
  if (ticket.claimed_by) txt += `  Pris en charge : ${ticket.claimed_by}\n`;
  if (ticket.close_reason) txt += `  Raison fermeture : ${ticket.close_reason}\n`;
  txt += `  Messages  : ${messages.length}\n`;
  txt += `═══════════════════════════════════════════════════════\n\n`;

  for (const msg of messages) {
    if (msg.author.bot && !msg.embeds.length) continue;
    const time = msg.createdAt.toLocaleString('fr-FR');
    const author = `${msg.author.username}${msg.author.bot ? ' [BOT]' : ''}`;
    txt += `[${time}] ${author}\n`;
    if (msg.content) txt += `  ${msg.content}\n`;
    for (const embed of msg.embeds) {
      if (embed.title)       txt += `  [EMBED] ${embed.title}\n`;
      if (embed.description) txt += `  ${embed.description.slice(0, 200)}\n`;
    }
    if (msg.attachments.size) {
      for (const [, att] of msg.attachments) txt += `  [FICHIER] ${att.name} — ${att.url}\n`;
    }
    txt += '\n';
  }

  return Buffer.from(txt, 'utf-8');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎫 Système de tickets professionnel')
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('⚙️ Configurer le panneau de tickets')
      .addChannelOption(o => o.setName('salon').setDescription('Salon où envoyer le panneau').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addRoleOption(o => o.setName('staff').setDescription('Rôle du staff').setRequired(true))
      .addChannelOption(o => o.setName('categorie').setDescription('Catégorie Discord pour les tickets').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
      .addChannelOption(o => o.setName('logs').setDescription('Salon pour les transcripts').setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('message').setDescription('Message de bienvenue dans chaque ticket').setRequired(false).setMaxLength(500))
    )
    .addSubcommand(s => s
      .setName('fermer')
      .setDescription('🔒 Fermer ce ticket')
      .addStringOption(o => o.setName('raison').setDescription('Raison de fermeture').setRequired(false))
    )
    .addSubcommand(s => s.setName('claim').setDescription('✋ Prendre en charge ce ticket (Staff)'))
    .addSubcommand(s => s
      .setName('ajouter')
      .setDescription('➕ Ajouter un membre au ticket')
      .addUserOption(o => o.setName('membre').setDescription('Membre à ajouter').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('retirer')
      .setDescription('➖ Retirer un membre du ticket')
      .addUserOption(o => o.setName('membre').setDescription('Membre à retirer').setRequired(true))
    )
    .addSubcommand(s => s.setName('liste').setDescription('📋 Liste des tickets ouverts'))
    .addSubcommand(s => s
      .setName('renommer')
      .setDescription('✏️ Renommer ce ticket')
      .addStringOption(o => o.setName('nom').setDescription('Nouveau nom').setRequired(true).setMaxLength(50))
    )
    .addSubcommand(s => s.setName('stats').setDescription('📊 Statistiques des tickets (Staff only)'))
    .addSubcommand(s => s
      .setName('panel')
      .setDescription('🖼️ Purger le salon et republier un panneau propre')
      .addChannelOption(o => o.setName('salon').setDescription('Salon cible (laisse vide = salon configuré)').setRequired(false).addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(s => s
      .setName('reopen')
      .setDescription('🔓 Rouvrir le dernier ticket fermé d\'un membre (Staff)')
      .addUserOption(o => o.setName('membre').setDescription('Membre dont rouvrir le ticket').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('note')
      .setDescription('📝 Ajouter une note interne au ticket (Staff)')
      .addStringOption(o => o.setName('texte').setDescription('Contenu de la note').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(s => s
      .setName('assign')
      .setDescription('👤 Assigner ce ticket à un membre du staff')
      .addUserOption(o => o.setName('staff').setDescription('Membre du staff à assigner').setRequired(true))
    )
    .addSubcommand(s => s
      .setName('priority')
      .setDescription('🎯 Changer la priorité de ce ticket (Staff)')
      .addStringOption(o => o
        .setName('niveau')
        .setDescription('Nouveau niveau de priorité')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Faible — Pas urgent', value: 'faible' },
          { name: '🟡 Normale — Standard',  value: 'normale' },
          { name: '🟠 Élevée — Assez urgent', value: 'elevee' },
          { name: '🔴 Urgente — Immédiat !', value: 'urgente' },
        )
      )
    )
    .addSubcommand(s => s.setName('info').setDescription('🔍 Voir toutes les infos de ce ticket (Staff)'))
    .addSubcommand(s => s
      .setName('blacklist')
      .setDescription('🚫 Bannir un membre du système de tickets (Admin)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à bannir').setRequired(true))
      .addStringOption(o => o.setName('raison').setDescription('Raison du bannissement').setRequired(false).setMaxLength(200))
    )
    .addSubcommand(s => s
      .setName('unblacklist')
      .setDescription('✅ Retirer un membre de la blacklist tickets (Admin)')
      .addUserOption(o => o.setName('membre').setDescription('Membre à retirer').setRequired(true))
    )
    .addSubcommand(s => s.setName('dashboard').setDescription('📊 Publier un tableau de bord dans les logs (Admin)'))
    .addSubcommand(s => s
      .setName('tag')
      .setDescription('🏷️ Ajouter ou retirer un tag à ce ticket (Staff)')
      .addStringOption(o => o
        .setName('action')
        .setDescription('Ajouter ou retirer le tag')
        .setRequired(true)
        .addChoices({ name: '➕ Ajouter', value: 'add' }, { name: '➖ Retirer', value: 'remove' })
      )
      .addStringOption(o => o.setName('tag').setDescription('Nom du tag (ex: bug-critique, attente-user)').setRequired(true).setMaxLength(30))
    )
    .addSubcommand(s => s
      .setName('quickreply')
      .setDescription('💬 Envoyer une réponse rapide prédéfinie dans ce ticket (Staff)')
    )
    .addSubcommand(s => s
      .setName('addreply')
      .setDescription('➕ Ajouter une réponse rapide personnalisée (Staff)')
      .addStringOption(o => o.setName('titre').setDescription('Titre court de la réponse').setRequired(true).setMaxLength(50))
      .addStringOption(o => o.setName('contenu').setDescription('Contenu de la réponse (supporte {user} pour la mention)').setRequired(true).setMaxLength(1000))
    )
    .addSubcommand(s => s
      .setName('profile')
      .setDescription('👤 Afficher le profil complet de l\'auteur du ticket (Staff)')
    ),
  cooldown: 5,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const cfg = db.getConfig(interaction.guildId);
    const isStaff = () =>
      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      (cfg.ticket_staff_role && interaction.member.roles.cache.has(cfg.ticket_staff_role));

    // ══════════════════════════════ SETUP ══════
    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Permission insuffisante.', ephemeral: true });

      const channel   = interaction.options.getChannel('salon');
      const staffRole = interaction.options.getRole('staff');
      const category  = interaction.options.getChannel('categorie');
      const logCh     = interaction.options.getChannel('logs');
      const welcomeMsg = interaction.options.getString('message');

      db.setConfig(interaction.guildId, 'ticket_staff_role',    staffRole.id);
      db.setConfig(interaction.guildId, 'ticket_channel',       channel.id);
      if (category)   db.setConfig(interaction.guildId, 'ticket_category',     category.id);
      if (logCh)      db.setConfig(interaction.guildId, 'ticket_log_channel',  logCh.id);
      if (welcomeMsg) db.setConfig(interaction.guildId, 'ticket_welcome_msg',  welcomeMsg);

      // Auto-grant bot permissions dans le salon panel + la catégorie tickets
      const botMember = interaction.guild.members.me;
      const botPerms = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ];
      try {
        await channel.permissionOverwrites.edit(botMember, {
          ViewChannel: true, SendMessages: true, EmbedLinks: true,
          ReadMessageHistory: true, ManageMessages: true,
        });
      } catch {}
      if (category) {
        try {
          await category.permissionOverwrites.edit(botMember, {
            ViewChannel: true, SendMessages: true, EmbedLinks: true,
            ReadMessageHistory: true, ManageChannels: true, ManageMessages: true,
          });
        } catch {}
      }
      if (logCh) {
        try {
          await logCh.permissionOverwrites.edit(botMember, {
            ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true,
          });
        } catch {}
      }

      const panelEmbed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎫 Support — Ouvre un ticket')
        .setDescription(
          '**Besoin d\'aide ou une question ?**\nClique sur le bouton ci-dessous et sélectionne une catégorie.\n\n' +
          CATEGORIES.map(c => `${c.emoji} **${c.label.replace(/^.*? /, '')}** — ${c.description}`).join('\n') +
          '\n\n> ⏱️ Nous répondons dans les plus brefs délais.'
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: `${interaction.guild.name} • Support`, iconURL: interaction.guild.iconURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('Ouvrir un ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      // Vérifier que le bot a la permission d'envoyer dans ce canal
      if (!channel.permissionsFor(botMember)?.has(['SendMessages', 'EmbedLinks'])) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('❌ Permission manquante')
            .setDescription(
              `Le bot n'a pas la permission d'envoyer des messages dans ${channel}.\n\n` +
              `**Solution :** Va dans les paramètres du salon ${channel} → Permissions → Ajoute NexusBot avec **Envoyer des messages** et **Intégrer des liens**.`
            )
          ], ephemeral: true
        });
      }

      await channel.send({ embeds: [panelEmbed], components: [row] });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('✅ Panneau de tickets créé !')
          .addFields(
            { name: '📍 Panneau', value: `${channel}`, inline: true },
            { name: '👮 Staff', value: `${staffRole}`, inline: true },
            { name: '📁 Catégorie', value: category ? `${category.name}` : 'Non définie', inline: true },
            { name: '📋 Logs', value: logCh ? `${logCh}` : 'Non configuré', inline: true },
          )
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ FERMER ══════
    if (sub === 'fermer') {
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });
      if (!isStaff() && interaction.user.id !== ticket.user_id)
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seul le staff ou le créateur peut fermer ce ticket.', ephemeral: true });

      const raison = interaction.options.getString('raison') || 'Aucune raison spécifiée';
      db.db.prepare('UPDATE tickets SET close_reason=? WHERE id=?').run(raison, ticket.id);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_confirm_close_${ticket.id}`).setLabel('Fermer + Transcript').setEmoji('🔒').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ticket_cancel_close_${ticket.id}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
      );
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FF6B6B')
          .setTitle('🔒 Fermer ce ticket ?')
          .addFields({ name: '📝 Raison', value: raison })
          .setDescription('Un transcript complet sera sauvegardé et envoyé dans les logs.')
        ], components: [row]
      });
    }

    // ══════════════════════════════ CLAIM ══════
    if (sub === 'claim') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      if (ticket.claimed_by)
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⚠️ Ce ticket est déjà pris en charge par <@${ticket.claimed_by}>.`, ephemeral: true });

      db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(interaction.user.id, ticket.id);
      await interaction.channel.setTopic(`Ticket de <@${ticket.user_id}> | Pris en charge par ${interaction.user.tag}`).catch(() => {});

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setDescription(`✋ **${interaction.member.displayName}** a pris en charge ce ticket.\n<@${ticket.user_id}>, tu recevras une réponse sous peu !`)
        ]
      });
    }

    // ══════════════════════════════ AJOUTER ══════
    if (sub === 'ajouter') {
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const target = interaction.options.getMember('membre');
      await interaction.channel.permissionOverwrites.edit(target, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true
      });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setDescription(`✅ **${target.displayName}** a été ajouté au ticket.`)
        ]
      });
    }

    // ══════════════════════════════ RETIRER ══════
    if (sub === 'retirer') {
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const target = interaction.options.getMember('membre');
      await interaction.channel.permissionOverwrites.edit(target, { ViewChannel: false });
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#FFA500')
          .setDescription(`✅ **${target.displayName}** a été retiré du ticket.`)
        ]
      });
    }

    // ══════════════════════════════ LISTE ══════
    if (sub === 'liste') {
      const tickets = isStaff()
        ? db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND status='open' ORDER BY created_at DESC LIMIT 25").all(interaction.guildId)
        : db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'").all(interaction.guildId, interaction.user.id);

      if (!tickets.length)
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setDescription('📋 Aucun ticket ouvert en ce moment.')], ephemeral: true });

      const lines = tickets.map(t => {
        const cat = getCatInfo(t.category);
        const pri = getPriInfo(t.priority);
        const age = Math.floor((Date.now() / 1000 - t.created_at) / 3600);
        const claim = t.claimed_by ? ` • ✋ <@${t.claimed_by}>` : '';
        return `${pri.emoji} ${cat.emoji} <#${t.channel_id}> — <@${t.user_id}> • ${age}h${claim}`;
      });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle(`📋 Tickets ouverts (${tickets.length})`)
          .setDescription(lines.join('\n'))
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ RENOMMER ══════
    if (sub === 'renommer') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });
      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });
      const nom = interaction.options.getString('nom').replace(/[^a-z0-9\-]/gi, '-').toLowerCase().slice(0, 50);
      await interaction.channel.setName(`ticket-${nom}`).catch(() => {});
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`✅ Ticket renommé en **ticket-${nom}**.`)]
      });
    }

    // ══════════════════════════════ REOPEN ══════
    if (sub === 'reopen') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const userOpt = interaction.options.getUser('membre');
      const targetId = userOpt.id;

      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='closed' ORDER BY closed_at DESC LIMIT 1")
        .get(interaction.guildId, targetId);

      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun ticket fermé trouvé pour <@${targetId}>.`, ephemeral: true });

      const closedHoursAgo = ticket.closed_at ? (Date.now() / 1000 - ticket.closed_at) / 3600 : 999;
      if (closedHoursAgo > 24) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        content: `❌ Ce ticket a été fermé il y a **${Math.floor(closedHoursAgo)}h**. On ne peut rouvrir que dans les 24h suivant la fermeture.`,
        ephemeral: true
      });

      await interaction.deferReply({ ephemeral: true });

      const cat = getCatInfo(ticket.category);
      const pri = getPriInfo(ticket.priority || 'normale');
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      const safeName = (targetMember?.user.username || 'user').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 10);
      const channelName = `${ticket.category}-${safeName}-${ticket.id}`.slice(0, 100);

      const permissionOverwrites = [
        { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: targetId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ];
      if (cfg.ticket_staff_role) {
        permissionOverwrites.push({
          id: cfg.ticket_staff_role,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        });
      }

    // Proprio du serveur — toujours accès au ticket (même si pas staff)
    if (interaction.guild.ownerId && interaction.guild.ownerId !== targetId) {
        permissionOverwrites.push({
            id: interaction.guild.ownerId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels,
            ],
        });
    }

      const parent = cfg.ticket_category ? interaction.guild.channels.cache.get(cfg.ticket_category) : null;
      const ticketChannel = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: parent?.id || undefined,
        permissionOverwrites,
        topic: `${cat.emoji} ${cat.label} | Rouvert par ${interaction.user.tag}`,
      });

      db.db.prepare("UPDATE tickets SET status='open', channel_id=?, closed_at=NULL, close_reason=NULL, warn_sent=0 WHERE id=?")
        .run(ticketChannel.id, ticket.id);

      const controlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ticket_claim_${ticket.id}`).setLabel('Prendre en charge').setEmoji('✋').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ticket_close_${ticket.id}`).setLabel('Fermer').setEmoji('🔒').setStyle(ButtonStyle.Danger),
      );

      await ticketChannel.send({
        content: `<@${targetId}>${cfg.ticket_staff_role ? ` <@&${cfg.ticket_staff_role}>` : ''}`,
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle(`🔓 Ticket #${ticket.id} Rouvert — ${cat.label.replace(/^.*? /, '')}`)
          .setDescription(`Ce ticket a été rouvert par <@${interaction.user.id}>.\n\n${ticket.close_reason ? `**Raison de fermeture :** ${ticket.close_reason}` : ''}`)
          .addFields(
            { name: '📂 Catégorie', value: cat.label, inline: true },
            { name: `${pri.emoji} Priorité`, value: pri.label, inline: true },
          )
          .setFooter({ text: 'Ticket rouvert — Utilise les boutons pour gérer.' })
        ],
        components: [controlRow],
      });

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('✅ Ticket rouvert !')
          .setDescription(`Le ticket de <@${targetId}> est rouvert ici : ${ticketChannel}`)
        ]
      });
    }

    // ══════════════════════════════ NOTE (Staff interne) ══════
    if (sub === 'note') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      const noteText = interaction.options.getString('texte');

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#3498DB')
          .setTitle('📝 Note interne — Staff')
          .setDescription(noteText)
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp()
        ]
      });
    }

    // ══════════════════════════════ PANEL (purge + repost) ══════
    if (sub === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true });

      const channel = interaction.options.getChannel('salon')
            || (cfg?.ticket_channel ? interaction.guild.channels.cache.get(cfg.ticket_channel) : null)
            || interaction.channel;

      if (!channel)
        return interaction.reply({ content: '❌ Aucun salon. Configure d\'abord avec `/ticket setup` ou précise un salon.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      // Purger les messages existants
      let purged = 0;
      try {
        let msgs;
        do {
          msgs = await channel.messages.fetch({ limit: 100 });
          if (!msgs.size) break;
          await channel.bulkDelete(msgs, true).catch(() => {});
          purged += msgs.size;
          if (msgs.size < 2) break;
        } while (purged < 1000);
      } catch {}

      // Reconstruire le panneau
      const panelEmbed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle('🎫 Support — Ouvre un ticket')
        .setDescription(
          '**Besoin d\'aide ou une question ?**\nClique sur le bouton ci-dessous et sélectionne une catégorie.\n\n' +
          CATEGORIES.map(c => `${c.emoji} **${c.label.replace(/^.*? /, '')}** — ${c.description}`).join('\n') +
          '\n\n> ⏱️ Nous répondons dans les plus brefs délais.'
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: `${interaction.guild.name} • Support`, iconURL: interaction.guild.iconURL() });

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_open')
          .setLabel('Ouvrir un ticket')
          .setEmoji('🎫')
          .setStyle(ButtonStyle.Primary)
      );

      // Vérifier les permissions avant d'envoyer
      const botMemberPanel = interaction.guild.members.me;
      if (!channel.permissionsFor(botMemberPanel)?.has(['SendMessages', 'EmbedLinks'])) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('❌ Permission manquante dans ce salon')
            .setDescription(
              `Le bot ne peut pas envoyer de messages dans ${channel}.\n` +
              `Ajoute NexusBot dans les permissions du salon avec **Envoyer des messages** et **Intégrer des liens**.`
            )
          ]
        });
      }

      await channel.send({ embeds: [panelEmbed], components: [row] });
      db.setConfig(interaction.guildId, 'ticket_channel', channel.id);

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor('#2ECC71')
          .setTitle('✅ Panneau republié !')
          .setDescription(`${channel} a été purgé (**${purged}** message(s) supprimé(s)) et le nouveau panneau est en place.`)
        ]
      });
    }

    // ══════════════════════════════ ASSIGN ══════
    if (sub === 'assign') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });

      const targetUser = interaction.options.getUser('staff');
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Membre introuvable.', ephemeral: true });

      // Mettre à jour en DB
      db.db.prepare('UPDATE tickets SET claimed_by=? WHERE id=?').run(targetUser.id, ticket.id);

      // Donner accès au salon si pas déjà dedans
      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true
      }).catch(() => {});

      // Mettre à jour le topic
      await interaction.channel.setTopic(
        `Ticket de <@${ticket.user_id}> | Assigné à ${targetMember.user.tag}`
      ).catch(() => {});

      // Envoyer un message dans le ticket
      await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`👤 Ce ticket a été assigné à **${targetMember.displayName}** par <@${interaction.user.id}>.`)
        ]
      });

      // Notifier le staff assigné en DM
      const cat = getCatInfo(ticket.category);
      const pri = getPriInfo(ticket.priority || 'normale');
      targetMember.send({
        embeds: [new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle('🎫 Ticket assigné — Action requise')
          .setDescription(
            `Tu as été assigné à un ticket par <@${interaction.user.id}> sur **${interaction.guild.name}**.\n\n` +
            `Rends-toi dans ${interaction.channel} pour répondre au membre.`
          )
          .addFields(
            { name: '📂 Catégorie', value: cat.label, inline: true },
            { name: `${pri.emoji} Priorité`, value: pri.label, inline: true },
            { name: '👤 Créateur', value: `<@${ticket.user_id}>`, inline: true },
          )
          .setFooter({ text: `${interaction.guild.name} • Assigné par ${interaction.user.tag}` })
          .setTimestamp()
        ]
      }).catch(() => {}); // Ignore si DMs bloqués

      return;
    }

    // ══════════════════════════════ PRIORITY ══════
    if (sub === 'priority') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open'")
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket actif.', ephemeral: true });

      const newPriority = interaction.options.getString('niveau');
      const oldPri = getPriInfo(ticket.priority || 'normale');
      const newPri = getPriInfo(newPriority);

      db.db.prepare('UPDATE tickets SET priority=? WHERE id=?').run(newPriority, ticket.id);

      // Mettre à jour le topic du salon
      const cat = getCatInfo(ticket.category);
      await interaction.channel.setTopic(
        `${cat.emoji} ${cat.label} | ${newPri.emoji} ${newPri.label} — <@${ticket.user_id}>`
      ).catch(() => {});

      const embedColor = newPriority === 'urgente' ? '#E74C3C' : newPriority === 'elevee' ? '#E67E22' : newPriority === 'faible' ? '#2ECC71' : '#7B2FBE';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(embedColor)
          .setAuthor({ name: `Priorité modifiée par ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
          .setTitle(`🎯 Priorité mise à jour`)
          .addFields(
            { name: 'Avant', value: `${oldPri.emoji} ${oldPri.label}`, inline: true },
            { name: 'Après', value: `${newPri.emoji} ${newPri.label}`, inline: true },
          )
          .setFooter({ text: newPriority === 'urgente' ? '🚨 Ce ticket est maintenant traité en urgence !' : 'Mise à jour effectuée.' })
        ]
      });
    }

    // ══════════════════════════════ INFO ══════
    if (sub === 'info') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      const cat = getCatInfo(ticket.category);
      const pri = getPriInfo(ticket.priority || 'normale');
      const ageHours = Math.floor((Date.now() / 1000 - ticket.created_at) / 3600);
      const embedColor = ticket.priority === 'urgente' ? '#E74C3C' : ticket.priority === 'elevee' ? '#E67E22' : (cat.color || '#7B2FBE');

      // Dernier message du salon
      let lastActivity = 'Inconnue';
      try {
        const msgs = await interaction.channel.messages.fetch({ limit: 1 });
        const last = msgs.first();
        if (last) lastActivity = `<t:${Math.floor(last.createdTimestamp / 1000)}:R>`;
      } catch {}

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(`🔍 Informations — Ticket #${ticket.id}`)
          .setThumbnail(
            (await interaction.guild.members.fetch(ticket.user_id).catch(() => null))
              ?.user.displayAvatarURL({ size: 256 }) || null
          )
          .addFields(
            { name: '👤 Créateur',       value: `<@${ticket.user_id}>`,                                    inline: true },
            { name: `${cat.emoji} Catégorie`, value: cat.label,                                            inline: true },
            { name: `${pri.emoji} Priorité`, value: pri.label,                                             inline: true },
            { name: '📊 Statut',         value: ticket.status === 'open' ? '`🟢 Ouvert`' : '`🔴 Fermé`', inline: true },
            { name: '✋ Pris en charge', value: ticket.claimed_by ? `<@${ticket.claimed_by}>` : '`Non réclamé`', inline: true },
            { name: '⏳ Âge',            value: `**${ageHours}h**`,                                       inline: true },
            { name: '📅 Ouvert le',      value: `<t:${ticket.created_at}:F>`,                             inline: false },
            { name: '💬 Dernière activité', value: lastActivity,                                          inline: true },
            { name: '⭐ Note finale',    value: ticket.rating ? `**${'⭐'.repeat(ticket.rating)} ${ticket.rating}/5**` : '`Pas encore noté`', inline: true },
          )
          .setFooter({ text: `Ticket ID : ${ticket.id} | Salon : #${interaction.channel.name}` })
          .setTimestamp()
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ BLACKLIST ══════
    if (sub === 'blacklist') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé aux admins (Gérer le serveur).', ephemeral: true });

      const targetUser = interaction.options.getUser('membre');
      const raison = interaction.options.getString('raison') || 'Aucune raison précisée';

      // Vérifier si déjà blacklisté
      const existing = db.db.prepare('SELECT * FROM ticket_blacklist WHERE guild_id=? AND user_id=?')
        .get(interaction.guildId, targetUser.id);
      if (existing) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder()
            .setColor('#E67E22')
            .setDescription(`⚠️ **${targetUser.tag}** est déjà dans la blacklist.\n> Raison actuelle : ${existing.reason || 'Aucune'}`)
          ], ephemeral: true
        });
      }

      db.db.prepare('INSERT INTO ticket_blacklist (guild_id, user_id, reason, banned_by) VALUES (?,?,?,?)')
        .run(interaction.guildId, targetUser.id, raison, interaction.user.id);

      // Fermer les tickets ouverts de cet utilisateur
      const openTickets = db.db.prepare("SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND status='open'")
        .all(interaction.guildId, targetUser.id);
      for (const t of openTickets) {
        db.db.prepare("UPDATE tickets SET status='closed', closed_at=?, close_reason=? WHERE id=?")
          .run(Math.floor(Date.now() / 1000), `Blacklist : ${raison}`, t.id);
        const ch = interaction.guild.channels.cache.get(t.channel_id);
        if (ch) {
          await ch.send({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setDescription(`🚫 Ce ticket a été fermé automatiquement suite au bannissement de <@${targetUser.id}> du système de tickets.`)
            ]
          }).catch(() => {});
          setTimeout(() => ch.delete().catch(() => {}), 5000);
        }
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🚫 Membre blacklisté')
          .setDescription(`**${targetUser.tag}** ne peut plus ouvrir de tickets sur ce serveur.`)
          .addFields(
            { name: '📝 Raison',   value: raison,                       inline: false },
            { name: '🛡️ Par',     value: `<@${interaction.user.id}>`,  inline: true },
            { name: '🎫 Tickets fermés', value: `${openTickets.length}`, inline: true },
          )
          .setThumbnail(targetUser.displayAvatarURL())
          .setTimestamp()
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ UNBLACKLIST ══════
    if (sub === 'unblacklist') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé aux admins (Gérer le serveur).', ephemeral: true });

      const targetUser = interaction.options.getUser('membre');
      const result = db.db.prepare('DELETE FROM ticket_blacklist WHERE guild_id=? AND user_id=?')
        .run(interaction.guildId, targetUser.id);

      if (result.changes === 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: `❌ **${targetUser.tag}** n'est pas dans la blacklist.`,
          ephemeral: true
        });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Blacklist levée')
          .setDescription(`**${targetUser.tag}** peut à nouveau ouvrir des tickets.`)
          .setThumbnail(targetUser.displayAvatarURL())
          .setTimestamp()
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ DASHBOARD ══════
    if (sub === 'dashboard') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild))
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé aux admins.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      const open   = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='open'").get(interaction.guildId).c;
      const closed = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='closed'").get(interaction.guildId).c;
      const total  = open + closed;

      // Catégories breakdown
      const byCategory = db.db.prepare("SELECT category, COUNT(*) as cnt FROM tickets WHERE guild_id=? GROUP BY category ORDER BY cnt DESC").all(interaction.guildId);

      // Priorités actives
      const byPriority = db.db.prepare("SELECT priority, COUNT(*) as cnt FROM tickets WHERE guild_id=? AND status='open' GROUP BY priority ORDER BY cnt DESC").all(interaction.guildId);

      // Notation
      const ratingData   = db.db.prepare("SELECT rating, COUNT(*) as cnt FROM tickets WHERE guild_id=? AND rating IS NOT NULL GROUP BY rating ORDER BY rating DESC").all(interaction.guildId);
      const totalRated   = ratingData.reduce((s, r) => s + r.cnt, 0);
      const avgRating    = totalRated > 0 ? (ratingData.reduce((s, r) => s + r.rating * r.cnt, 0) / totalRated).toFixed(1) : null;
      const satisfaction = totalRated > 0 ? Math.round((ratingData.filter(r => r.rating >= 4).reduce((s, r) => s + r.cnt, 0) / totalRated) * 100) : null;

      // Staff
      const staffStats = db.db.prepare("SELECT claimed_by, COUNT(*) as cnt FROM tickets WHERE guild_id=? AND claimed_by IS NOT NULL GROUP BY claimed_by ORDER BY cnt DESC LIMIT 5").all(interaction.guildId);

      // Blacklist
      const blacklistCount = db.db.prepare('SELECT COUNT(*) as c FROM ticket_blacklist WHERE guild_id=?').get(interaction.guildId)?.c || 0;

      // Urgents ouverts
      const urgents = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND priority='urgente' AND status='open'").get(interaction.guildId).c;

      const catLines  = byCategory.slice(0,5).map(r => {
        const ci = getCatInfo(r.category);
        return `${ci.emoji} **${ci.label.replace(/^.*? /,'')}** — ${r.cnt}`;
      }).join('\n') || 'Aucun ticket';

      const priLines = byPriority.map(r => {
        const pi = getPriInfo(r.priority);
        return `${pi.emoji} ${pi.label.replace(/^.*? /,'')} — **${r.cnt}**`;
      }).join('\n') || 'Aucun ticket ouvert';

      const staffLines = staffStats.map((s, i) =>
        `**${i+1}.** <@${s.claimed_by}> — ${s.cnt} ticket${s.cnt > 1 ? 's' : ''}`
      ).join('\n') || 'Aucune activité';

      const dashEmbed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`📊 Tableau de bord Tickets — ${interaction.guild.name}`)
        .setDescription(
          `> Mis à jour le <t:${Math.floor(Date.now() / 1000)}:F>\n` +
          `> Généré par <@${interaction.user.id}>`
        )
        .addFields(
          { name: '📈 Vue d\'ensemble',
            value: `🟢 **${open}** ouverts · 🔴 **${closed}** fermés · 📁 **${total}** total\n🚨 **${urgents}** urgent(s) · 🚫 **${blacklistCount}** blacklisté(s)`,
            inline: false },
          { name: '📂 Par catégorie (top 5)', value: catLines,   inline: true },
          { name: '⚡ Priorités actives',     value: priLines,   inline: true },
          { name: '\u200B', value: '\u200B', inline: false },
          { name: '⭐ Satisfaction',
            value: avgRating
              ? `Moyenne : **${avgRating}/5** ${'⭐'.repeat(Math.round(parseFloat(avgRating)))}\nSatisfaction : **${satisfaction}%** (≥4⭐)\nAvis reçus : **${totalRated}**`
              : 'Aucun avis encore',
            inline: true },
          { name: '🏆 Top Staff (tickets pris)',  value: staffLines,  inline: true },
        )
        .setThumbnail(interaction.guild.iconURL())
        .setFooter({ text: `${interaction.guild.name} • NexusBot v2.0 • Dashboard Tickets`, iconURL: interaction.guild.iconURL() })
        .setTimestamp();

      // Poster dans le salon des logs
      const logCh = cfg.ticket_log_channel ? interaction.guild.channels.cache.get(cfg.ticket_log_channel) : null;
      if (logCh) {
        await logCh.send({ embeds: [dashEmbed] });
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder().setColor('#2ECC71')
            .setDescription(`✅ Tableau de bord publié dans ${logCh} !`)
          ]
        });
      } else {
        // Pas de salon logs → envoyer ici en réponse visible
        await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ embeds: [dashEmbed] });
        return;
      }
    }

    // ══════════════════════════════ STATS ══════
    if (sub === 'stats') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const open   = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='open'").get(interaction.guildId).c;
      const closed = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND status='closed'").get(interaction.guildId).c;
      const total  = open + closed;

      // Notation
      const ratingData = db.db.prepare("SELECT rating, COUNT(*) as cnt FROM tickets WHERE guild_id=? AND rating IS NOT NULL GROUP BY rating ORDER BY rating").all(interaction.guildId);
      const totalRated = ratingData.reduce((s, r) => s + r.cnt, 0);
      const avgRating  = totalRated > 0
        ? (ratingData.reduce((s, r) => s + r.rating * r.cnt, 0) / totalRated).toFixed(2)
        : null;
      // Satisfaction = tickets notés ≥ 4 / total notés
      const positiveRated = ratingData.filter(r => r.rating >= 4).reduce((s, r) => s + r.cnt, 0);
      const satisfaction  = totalRated > 0 ? Math.round((positiveRated / totalRated) * 100) : null;

      // Distribution étoiles
      let starBar = '';
      for (let s = 1; s <= 5; s++) {
        const cnt = ratingData.find(r => r.rating === s)?.cnt || 0;
        const bar = cnt > 0 ? '█'.repeat(Math.min(cnt, 10)) : '░';
        starBar += `${'⭐'.repeat(s)} ${bar} (${cnt})\n`;
      }

      const mostActive = db.db.prepare("SELECT claimed_by, COUNT(*) as cnt FROM tickets WHERE guild_id=? AND claimed_by IS NOT NULL GROUP BY claimed_by ORDER BY cnt DESC LIMIT 1").get(interaction.guildId);
      const activeStaff = mostActive?.claimed_by ? `<@${mostActive.claimed_by}> (${mostActive.cnt} tickets)` : 'Aucun';

      const urgents = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND priority='urgente' AND status='open'").get(interaction.guildId).c;

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(cfg.color || '#7B2FBE')
          .setTitle('📊 Statistiques des tickets')
          .addFields(
            { name: '🟢 Ouverts',           value: `**${open}**`,                   inline: true },
            { name: '🔴 Fermés',            value: `**${closed}**`,                  inline: true },
            { name: '📁 Total',             value: `**${total}**`,                   inline: true },
            { name: '🚨 Urgents (ouverts)', value: `**${urgents}**`,                 inline: true },
            { name: '⭐ Note moyenne',       value: avgRating ? `**${avgRating}/5**` : 'Aucune note', inline: true },
            { name: '😊 Satisfaction',      value: satisfaction !== null ? `**${satisfaction}%** (≥4⭐)` : 'Aucune note', inline: true },
            { name: '✋ Staff le + actif',   value: activeStaff,                     inline: false },
            { name: `📈 Distribution (${totalRated} avis)`, value: totalRated > 0 ? starBar : 'Aucun avis', inline: false },
          )
          .setTimestamp()
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ TAG ══════
    if (sub === 'tag') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      const action  = interaction.options.getString('action');
      const tagRaw  = interaction.options.getString('tag')
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 30);

      let tags = [];
      try { tags = JSON.parse(ticket.tags || '[]'); } catch {}

      if (action === 'add') {
        if (tags.includes(tagRaw))
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `⚠️ Le tag \`${tagRaw}\` est déjà présent sur ce ticket.`, ephemeral: true });
        if (tags.length >= 5)
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Maximum **5 tags** par ticket.', ephemeral: true });
        tags.push(tagRaw);
      } else {
        const idx = tags.indexOf(tagRaw);
        if (idx === -1)
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Tag \`${tagRaw}\` introuvable sur ce ticket.`, ephemeral: true });
        tags.splice(idx, 1);
      }

      db.db.prepare('UPDATE tickets SET tags=? WHERE id=?').run(JSON.stringify(tags), ticket.id);

      const tagDisplay = tags.length > 0 ? tags.map(t => `\`${t}\``).join(' ') : '*Aucun tag*';
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(action === 'add' ? '#7B2FBE' : '#95A5A6')
          .setDescription(
            `${action === 'add' ? '🏷️ Tag **ajouté**' : '🗑️ Tag **retiré**'} : \`${tagRaw}\`\n\n` +
            `**Tags actuels :** ${tagDisplay}`
          )
        ]
      });
    }

    // ══════════════════════════════ QUICKREPLY ══════
    if (sub === 'quickreply') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      const { StringSelectMenuBuilder } = require('discord.js');

      // Réponses rapides par défaut
      const DEFAULT_OPTS = [
        { label: '👋 Message d\'accueil',   value: 'qr_welcome',    description: 'Accueillir le membre et se présenter' },
        { label: '⏳ Merci de patienter',   value: 'qr_wait',       description: 'Demander de la patience pendant l\'analyse' },
        { label: '📷 Captures demandées',   value: 'qr_screenshot', description: 'Demander des preuves visuelles' },
        { label: '🔄 Plus d\'informations', value: 'qr_info',       description: 'Demander des détails supplémentaires' },
        { label: '✅ Problème résolu',       value: 'qr_resolved',   description: 'Confirmer la résolution du problème' },
        { label: '🔒 Fermeture imminente',  value: 'qr_closing',    description: 'Prévenir de la fermeture du ticket' },
      ];

      // Réponses personnalisées du serveur
      const customReplies = db.db.prepare('SELECT * FROM ticket_quick_replies WHERE guild_id=? ORDER BY title LIMIT 15')
        .all(interaction.guildId);
      const customOpts = customReplies.map(r => ({
        label: `✏️ ${r.title}`.slice(0, 100),
        value: `qr_custom_${r.id}`,
        description: r.content.slice(0, 100),
      }));

      const allOpts = [...DEFAULT_OPTS, ...customOpts].slice(0, 25);

      const select = new StringSelectMenuBuilder()
        .setCustomId(`ticket_qr_select_${ticket.id}`)
        .setPlaceholder('💬 Choisir une réponse rapide à envoyer...')
        .addOptions(allOpts);

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle('💬 Réponses rapides')
          .setDescription(
            `Sélectionne une réponse prédéfinie à envoyer dans <#${ticket.channel_id}>.\n\n` +
            `> ✏️ Pour ajouter tes propres réponses : \`/ticket addreply\``
          )
        ],
        components: [new ActionRowBuilder().addComponents(select)],
        ephemeral: true,
      });
    }

    // ══════════════════════════════ ADDREPLY ══════
    if (sub === 'addreply') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const titre   = interaction.options.getString('titre');
      const contenu = interaction.options.getString('contenu');

      try {
        db.db.prepare(
          'INSERT INTO ticket_quick_replies (guild_id, title, content, created_by) VALUES (?, ?, ?, ?)'
        ).run(interaction.guildId, titre, contenu, interaction.user.id);
      } catch {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Une réponse rapide avec ce titre existe déjà.`, ephemeral: true });
      }

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Réponse rapide ajoutée !')
          .addFields(
            { name: '📌 Titre',   value: titre,   inline: true },
            { name: '💬 Contenu', value: contenu, inline: false },
          )
          .setDescription('> Disponible dans `/ticket quickreply` depuis n\'importe quel ticket.')
          .setFooter({ text: `Créé par ${interaction.user.tag}` })
        ], ephemeral: true
      });
    }

    // ══════════════════════════════ PROFILE ══════
    if (sub === 'profile') {
      if (!isStaff()) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Réservé au staff.', ephemeral: true });

      const ticket = db.db.prepare('SELECT * FROM tickets WHERE guild_id=? AND channel_id=?')
        .get(interaction.guildId, interaction.channelId);
      if (!ticket) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce salon n\'est pas un ticket.', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });

      const targetMember = await interaction.guild.members.fetch(ticket.user_id).catch(() => null);
      const targetUser   = targetMember?.user || await interaction.client.users.fetch(ticket.user_id).catch(() => null);

      if (!targetUser) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Utilisateur introuvable.' });

      const prevTickets  = db.db.prepare(
        "SELECT * FROM tickets WHERE guild_id=? AND user_id=? AND id!=? ORDER BY created_at DESC LIMIT 5"
      ).all(interaction.guildId, ticket.user_id, ticket.id);

      const warnings  = db.db.prepare("SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?")
        .get(interaction.guildId, ticket.user_id)?.c || 0;
      const notes     = db.db.prepare("SELECT COUNT(*) as c FROM mod_notes WHERE guild_id=? AND user_id=?")
        .get(interaction.guildId, ticket.user_id)?.c || 0;
      const closedTicketsCount = db.db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id=? AND user_id=? AND status='closed'")
        .get(interaction.guildId, ticket.user_id)?.c || 0;
      const avgRating = db.db.prepare("SELECT AVG(rating) as avg FROM tickets WHERE guild_id=? AND user_id=? AND rating IS NOT NULL")
        .get(interaction.guildId, ticket.user_id)?.avg;

      const acctAgeDays = Math.floor((Date.now() - targetUser.createdTimestamp) / 86400000);
      const joinAgeDays = targetMember?.joinedTimestamp
        ? Math.floor((Date.now() - targetMember.joinedTimestamp) / 86400000)
        : null;

      // Score de risque
      let riskLevel = '🟢 Aucun risque détecté';
      if (warnings >= 5) riskLevel = '🔴 Risque élevé (5+ avertissements)';
      else if (warnings >= 3) riskLevel = '🟠 Risque modéré (3+ avertissements)';
      else if (warnings >= 1) riskLevel = '🟡 À surveiller (1-2 avertissements)';
      if (acctAgeDays < 7) riskLevel += '\n⚠️ Compte récent (< 7 jours)';

      const prevLines = prevTickets.length
        ? prevTickets.map(t => {
            const tc = getCatInfo(t.category);
            const tp = getPriInfo(t.priority || 'normale');
            const status = t.status === 'open' ? '🟢' : '🔴';
            const tags   = (() => { try { return JSON.parse(t.tags || '[]'); } catch { return []; } })();
            const tagStr = tags.length ? ` [${tags.join(', ')}]` : '';
            return `${status} ${tc.emoji} \`#${t.id}\` ${tp.emoji} <t:${t.created_at}:d>${tagStr}`;
          }).join('\n')
        : '*Aucun ticket précédent*';

      const latestNotes = db.db.prepare(
        "SELECT note, mod_id, created_at FROM mod_notes WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 3"
      ).all(interaction.guildId, ticket.user_id);
      const noteLines = latestNotes.length
        ? latestNotes.map(n => `> <@${n.mod_id}> : ${n.note.slice(0, 80)}`).join('\n')
        : '*Aucune note*';

      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [new EmbedBuilder()
          .setColor(warnings >= 3 ? '#E74C3C' : warnings >= 1 ? '#E67E22' : '#7B2FBE')
          .setTitle(`👤 Profil — ${targetUser.username}`)
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
          .addFields(
            { name: '🆔 Identifiant',       value: `\`${targetUser.id}\``,                     inline: true },
            { name: '📅 Compte créé',        value: `<t:${Math.floor(targetUser.createdTimestamp/1000)}:R> (${acctAgeDays}j)`, inline: true },
            { name: '📆 Membre depuis',      value: joinAgeDays !== null ? `<t:${Math.floor(targetMember.joinedTimestamp/1000)}:R> (${joinAgeDays}j)` : 'Inconnu', inline: true },
            { name: '⚠️ Avertissements',     value: `**${warnings}**`,                          inline: true },
            { name: '📝 Notes modération',   value: `**${notes}**`,                             inline: true },
            { name: '🎫 Tickets fermés',     value: `**${closedTicketsCount}**`,                 inline: true },
            { name: '⭐ Note moy. donnée',   value: avgRating ? `**${parseFloat(avgRating).toFixed(1)}/5**` : '*Jamais noté*', inline: true },
            { name: '🛡️ Profil risque',      value: riskLevel,                                  inline: false },
            { name: `🗂️ Tickets précédents (${prevTickets.length})`, value: prevLines,          inline: false },
            { name: '📋 Dernières notes staff', value: noteLines,                               inline: false },
          )
          .setFooter({ text: `Vue staff interne • Ticket #${ticket.id}` })
          .setTimestamp()
        ]
      });
    }
  },

  // ── Exposer pour interactionCreate.js et ticketAutoClose.js
  generateTranscript,
  getCatInfo,
  CATEGORIES,
  PRIORITIES,
  getPriInfo,
};
