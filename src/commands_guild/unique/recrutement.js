'use strict';

/**
 * NexusBot — Système de Recrutement Staff v2
 * Commande : /recrutement
 * Panel : boutons → modaux → log channel → accept/reject/en-examen avec DMs
 */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const db = require('../../database/db');

// ─────────────────────────────────────────────────────────────────────────────
//  POSTES DISPONIBLES
// ─────────────────────────────────────────────────────────────────────────────
const POSTES = {
  moderateur: {
    label: 'Modérateur',
    emoji: '🛡️',
    color: '#3498DB',
    desc: 'Assure le respect des règles et la bonne ambiance du serveur.',
    questions: [
      'Quel est ton âge et depuis combien de temps es-tu sur ce serveur ?',
      'Quelle est ton expérience en modération Discord ? (autres serveurs, sanctions...)',
      'Comment réagirais-tu face à un conflit entre deux membres ?',
      'Combien d\'heures par semaine peux-tu consacrer à la modération ?',
      'Pourquoi veux-tu rejoindre l\'équipe de modération de ce serveur ?',
    ],
  },
  technicien: {
    label: 'Technicien Bots',
    emoji: '⚙️',
    color: '#2ECC71',
    desc: 'Développe, configure et maintient les bots du serveur.',
    questions: [
      'Quels langages de programmation maîtrises-tu ? (JavaScript, Python, etc.)',
      'As-tu déjà développé ou configuré des bots Discord ? Si oui, décris-les.',
      'Quel est ton niveau avec les APIs et webhooks Discord ?',
      'Décris une amélioration concrète que tu pourrais apporter au bot du serveur.',
      'Combien d\'heures par semaine peux-tu consacrer au développement ?',
    ],
  },
  animateur: {
    label: 'Animateur Events',
    emoji: '🎉',
    color: '#F39C12',
    desc: 'Organise et anime des événements pour faire vivre la communauté.',
    questions: [
      'As-tu déjà organisé des événements Discord ? Décris-en un.',
      'Quels types d\'événements aimerais-tu organiser sur ce serveur ?',
      'Comment t\'assures-tu qu\'un événement engage vraiment la communauté ?',
      'Combien d\'heures par semaine peux-tu y consacrer ?',
      'Propose une idée originale d\'événement pour ce serveur.',
    ],
  },
  helper: {
    label: 'Helper Support',
    emoji: '🤝',
    color: '#1ABC9C',
    desc: 'Aide et oriente les membres qui ont besoin d\'assistance.',
    questions: [
      'Quelle est ton expérience dans l\'aide aux membres sur Discord ?',
      'Comment expliques-tu quelque chose de complexe à quelqu\'un qui débute ?',
      'Comment gardes-tu ton calme face à un membre difficile ou irrespectueux ?',
      'Combien d\'heures par semaine peux-tu être disponible pour le support ?',
      'Pourquoi veux-tu rejoindre l\'équipe support de ce serveur ?',
    ],
  },
  partenariat: {
    label: 'Chargé Partenariats',
    emoji: '🤝',
    color: '#9B59B6',
    desc: 'Gère et développe les partenariats avec d\'autres serveurs.',
    questions: [
      'As-tu déjà géré des partenariats Discord ou des relations inter-serveurs ?',
      'Comment prospectes-tu et contacterais-tu des serveurs partenaires ?',
      'Quels critères utilises-tu pour évaluer la pertinence d\'un partenariat ?',
      'Combien d\'heures par semaine peux-tu y consacrer ?',
      'Propose une stratégie concrète pour développer les partenariats du serveur.',
    ],
  },
  contenu: {
    label: 'Responsable Contenu',
    emoji: '📝',
    color: '#E74C3C',
    desc: 'Crée et gère le contenu éditorial et les annonces du serveur.',
    questions: [
      'Quel type de contenu as-tu déjà créé pour Discord ou les réseaux sociaux ?',
      'Quels outils utilises-tu pour créer du contenu ? (Canva, Adobe, etc.)',
      'Comment rendrais-tu le serveur plus attractif et dynamique ?',
      'Combien d\'heures par semaine peux-tu y consacrer ?',
      'Décris une idée de contenu qui pourrait booster l\'activité du serveur.',
    ],
  },
  graphiste: {
    label: 'Graphiste',
    emoji: '🎨',
    color: '#E91E63',
    desc: 'Conçoit l\'identité visuelle et les assets graphiques du serveur.',
    questions: [
      'Quels logiciels de design maîtrises-tu ? (Illustrator, Photoshop, Figma...)',
      'Décris une création dont tu es fier(e) ou partage un exemple de ton travail.',
      'Quelle est ton expérience avec le design Discord (icônes, bannières, emotes) ?',
      'Combien d\'heures par semaine peux-tu consacrer au design du serveur ?',
      'Quelle serait ta première création pour améliorer l\'identité visuelle du serveur ?',
    ],
  },
};

const COOLDOWN_DAYS = 14; // jours entre deux candidatures pour le même poste (si refusé)

// ─────────────────────────────────────────────────────────────────────────────
//  INITIALISATION DB
// ─────────────────────────────────────────────────────────────────────────────
try {
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS rec_config (
      guild_id    TEXT PRIMARY KEY,
      log_channel TEXT,
      roles       TEXT DEFAULT '{}',
      status      TEXT DEFAULT '{}',
      ping_role   TEXT
    );
    CREATE TABLE IF NOT EXISTS rec_apps (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id      TEXT NOT NULL,
      poste         TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      answers       TEXT DEFAULT '[]',
      status        TEXT DEFAULT 'pending',
      reviewer_id   TEXT,
      reject_reason TEXT,
      msg_id        TEXT,
      submitted_at  INTEGER DEFAULT (strftime('%s','now')),
      reviewed_at   INTEGER
    );
  `);
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function ts() { return Math.floor(Date.now() / 1000); }

function getConfig(guildId) {
  let row = db.db.prepare('SELECT * FROM rec_config WHERE guild_id=?').get(guildId);
  if (!row) {
    db.db.prepare('INSERT OR IGNORE INTO rec_config (guild_id) VALUES (?)').run(guildId);
    row = db.db.prepare('SELECT * FROM rec_config WHERE guild_id=?').get(guildId);
  }
  return {
    ...row,
    roles:  JSON.parse(row?.roles  || '{}'),
    status: JSON.parse(row?.status || '{}'),
  };
}

function saveConfig(guildId, patch = {}) {
  const cur = getConfig(guildId);
  db.db.prepare('UPDATE rec_config SET log_channel=?, roles=?, status=?, ping_role=? WHERE guild_id=?')
    .run(
      patch.log_channel ?? cur.log_channel,
      JSON.stringify(patch.roles  ?? cur.roles),
      JSON.stringify(patch.status ?? cur.status),
      patch.ping_role   ?? cur.ping_role,
      guildId
    );
}

function hasPendingApp(guildId, userId, poste) {
  return !!db.db.prepare(
    "SELECT id FROM rec_apps WHERE guild_id=? AND user_id=? AND poste=? AND status IN ('pending','waiting')"
  ).get(guildId, userId, poste);
}

function getLastRejected(guildId, userId, poste) {
  return db.db.prepare(
    "SELECT * FROM rec_apps WHERE guild_id=? AND user_id=? AND poste=? AND status='rejected' ORDER BY reviewed_at DESC LIMIT 1"
  ).get(guildId, userId, poste);
}

/** Construit l'embed qui apparaît dans le log channel */
function buildLogEmbed(app, user, poste, status) {
  const statusMap = {
    pending:  { color: '#F1C40F', label: '⏳ En attente de traitement' },
    waiting:  { color: '#3498DB', label: '🔍 En cours d\'examen'      },
    accepted: { color: '#2ECC71', label: '✅ Candidature acceptée'    },
    rejected: { color: '#E74C3C', label: '❌ Candidature refusée'     },
  };
  const s = statusMap[status] || statusMap.pending;
  const answers = (() => { try { return JSON.parse(app.answers || '[]'); } catch { return []; } })();

  const displayName = user?.tag  ?? user?.username ?? `<@${app.user_id}>`;
  const avatarURL   = (typeof user?.displayAvatarURL === 'function')
    ? user.displayAvatarURL({ size: 256 })
    : null;

  const embed = new EmbedBuilder()
    .setColor(s.color)
    .setTitle(`${poste?.emoji ?? '📋'} Candidature — ${poste?.label ?? app.poste}`)
    .setDescription(
      `**Candidat :** <@${app.user_id}> (\`${displayName}\`)\n` +
      `**Poste :** ${poste?.emoji ?? ''} ${poste?.label ?? app.poste}\n` +
      `**Statut :** ${s.label}`
    )
    .setFooter({ text: `Candidature #${app.id}  ·  Soumise le` })
    .setTimestamp(app.submitted_at * 1000);

  if (avatarURL) embed.setThumbnail(avatarURL);

  answers.forEach((a, i) => {
    embed.addFields({
      name:   `${i + 1}. ${(a.q ?? '').slice(0, 100)}`,
      value:  (a.a ?? '*Non renseigné*').slice(0, 1024),
      inline: false,
    });
  });

  if (app.reject_reason) {
    embed.addFields({ name: '💬 Raison du refus', value: app.reject_reason.slice(0, 1024), inline: false });
  }
  if (app.reviewer_id && status !== 'pending') {
    embed.addFields({ name: '👤 Traité par', value: `<@${app.reviewer_id}>`, inline: true });
  }

  return embed;
}

/** Boutons d'action staff sous le log embed */
function buildLogButtons(appId, status) {
  if (status === 'accepted' || status === 'rejected') return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_acc_${appId}`) .setLabel('Accepter')  .setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_wait_${appId}`).setLabel('En examen') .setEmoji('🔍').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rec_rej_${appId}`) .setLabel('Refuser')   .setEmoji('❌').setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMMANDE SLASH
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('recrutement')
    .setDescription('🎯 Système de recrutement staff')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s
      .setName('setup')
      .setDescription('⚙️ Configurer le système de recrutement')
      .addChannelOption(o => o.setName('logs').setDescription('Salon où arrivent les candidatures (staff only)').setRequired(true))
      .addRoleOption(o => o.setName('ping').setDescription('Rôle mentionné à chaque nouvelle candidature')))
    .addSubcommand(s => s
      .setName('panel')
      .setDescription('📢 Publier le panneau de recrutement dans ce salon'))
    .addSubcommand(s => s
      .setName('role')
      .setDescription('🏷️ Associer un rôle à un poste (attribué si accepté)')
      .addStringOption(o => o.setName('poste').setDescription('Poste').setRequired(true)
        .addChoices(...Object.entries(POSTES).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k }))))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer').setRequired(true)))
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('🔓 Ouvrir/fermer les candidatures pour un poste')
      .addStringOption(o => o.setName('poste').setDescription('Poste').setRequired(true)
        .addChoices(...Object.entries(POSTES).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k })))))
    .addSubcommand(s => s
      .setName('candidatures')
      .setDescription('📋 Lister les candidatures récentes')
      .addStringOption(o => o.setName('poste').setDescription('Filtrer par poste')
        .addChoices(...Object.entries(POSTES).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k }))))
      .addStringOption(o => o.setName('statut').setDescription('Filtrer par statut')
        .addChoices(
          { name: '⏳ En attente', value: 'pending'  },
          { name: '🔍 En examen',  value: 'waiting'  },
          { name: '✅ Acceptées',  value: 'accepted' },
          { name: '❌ Refusées',   value: 'rejected' },
        )))
    .addSubcommand(s => s
      .setName('stats')
      .setDescription('📊 Statistiques globales de recrutement')),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    // ── /recrutement setup ─────────────────────────────────────────────────
    if (sub === 'setup') {
      const logCh    = interaction.options.getChannel('logs');
      const pingRole = interaction.options.getRole('ping');
      const cfg      = getConfig(guildId);
      saveConfig(guildId, {
        log_channel: logCh.id,
        ping_role:   pingRole?.id ?? cfg.ping_role,
        roles:  cfg.roles,
        status: cfg.status,
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Recrutement configuré')
            .addFields(
              { name: '📋 Salon de logs', value: `${logCh}`, inline: true },
              { name: '🔔 Rôle ping',     value: pingRole ? `${pingRole}` : 'Aucun', inline: true },
              { name: '​', value: '​', inline: true },
              { name: '💡 Prochaine étape', value: 'Utilisez `/recrutement panel` pour publier le panneau, puis `/recrutement role` pour associer les rôles.', inline: false },
            ),
        ],
        ephemeral: true,
      });
    }

    // ── /recrutement panel ─────────────────────────────────────────────────
    if (sub === 'panel') {
      const cfg = getConfig(guildId);
      if (!cfg.log_channel) {
        return interaction.reply({ content: '❌ Configurez d\'abord le système avec `/recrutement setup`.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;

      // ── Embed principal ─────────────────────────────────────────────────
      const openCount   = Object.keys(POSTES).filter(k => cfg.status[k] !== false).length;
      const totalCount  = Object.keys(POSTES).length;
      const bannerURL   = guild.bannerURL({ size: 1024, forceStatic: false });
      const iconURL     = guild.iconURL({ size: 256, dynamic: true });

      const panelEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: guild.name + ' — Recrutement Staff', iconURL: iconURL ?? undefined })
        .setTitle('✨  Rejoins l\'équipe qui fait vivre le serveur !')
        .setDescription(
          `> *Nous cherchons des personnes motivées et investies pour renforcer notre équipe.*\n\n` +
          `**📌 Comment postuler ?**\n` +
          `Clique sur le bouton du poste qui t'intéresse, remplis le formulaire et soumets ta candidature.\n` +
          `Notre équipe te répondra sous **48–72h**.\n\n` +
          `**📋 Postes disponibles** — \`${openCount}/${totalCount} ouverts\`\n` +
          `${Object.entries(POSTES).map(([k, p]) => {
            const isOpen = cfg.status[k] !== false;
            return `${p.emoji} **${p.label}** — ${isOpen ? '🟢 Ouvert' : '🔴 Fermé'}`;
          }).join('\n')}\n\n` +
          `**⚠️ Règles importantes**\n` +
          `— Remplis chaque champ avec soin et honnêteté\n` +
          `— Une seule candidature active à la fois\n` +
          `— Toute candidature bâclée sera refusée automatiquement`
        )
        .setThumbnail(iconURL ?? null);

      if (bannerURL) panelEmbed.setImage(bannerURL);

      panelEmbed
        .setFooter({ text: `${guild.name}  •  Répond sous 48–72h  •  Bonne chance ! 🍀`, iconURL: iconURL ?? undefined })
        .setTimestamp();

      // ── Boutons (max 4 par rangée) ────────────────────────────────────
      const entries = Object.entries(POSTES);
      const rows    = [];
      for (let i = 0; i < entries.length; i += 4) {
        const row = new ActionRowBuilder();
        for (const [key, p] of entries.slice(i, i + 4)) {
          const isOpen = cfg.status[key] !== false;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`rec_apply_${key}`)
              .setLabel(p.label)
              .setEmoji(p.emoji)
              .setStyle(isOpen ? ButtonStyle.Primary : ButtonStyle.Danger)
              .setDisabled(!isOpen)
          );
        }
        rows.push(row);
      }

      await interaction.channel.send({ embeds: [panelEmbed], components: rows }).catch(() => {});
      return interaction.editReply({ content: '✅ Panneau de recrutement publié dans ce salon !' });
    }

    // ── /recrutement role ──────────────────────────────────────────────────
    if (sub === 'role') {
      const poste = interaction.options.getString('poste');
      const role  = interaction.options.getRole('role');
      const cfg   = getConfig(guildId);
      cfg.roles[poste] = role.id;
      saveConfig(guildId, { roles: cfg.roles });
      return interaction.reply({
        content: `✅ Rôle **${role.name}** associé au poste **${POSTES[poste]?.label ?? poste}**. Il sera attribué automatiquement si le candidat est accepté.`,
        ephemeral: true,
      });
    }

    // ── /recrutement toggle ────────────────────────────────────────────────
    if (sub === 'toggle') {
      const poste   = interaction.options.getString('poste');
      const cfg     = getConfig(guildId);
      const wasOpen = cfg.status[poste] !== false;
      cfg.status[poste] = !wasOpen;
      saveConfig(guildId, { status: cfg.status });
      const p = POSTES[poste];
      return interaction.reply({
        content: wasOpen
          ? `🔴 Poste **${p?.label ?? poste}** **fermé**. Le bouton sera désactivé au prochain /recrutement panel.`
          : `🟢 Poste **${p?.label ?? poste}** **ouvert** aux candidatures.`,
        ephemeral: true,
      });
    }

    // ── /recrutement candidatures ──────────────────────────────────────────
    if (sub === 'candidatures') {
      await interaction.deferReply({ ephemeral: true });

      const poste  = interaction.options.getString('poste');
      const statut = interaction.options.getString('statut');
      let query  = 'SELECT * FROM rec_apps WHERE guild_id=?';
      const args = [guildId];
      if (poste)  { query += ' AND poste=?';  args.push(poste);  }
      if (statut) { query += ' AND status=?'; args.push(statut); }
      query += ' ORDER BY submitted_at DESC LIMIT 25';

      const apps = db.db.prepare(query).all(...args);
      if (!apps.length) {
        return interaction.editReply({ content: '❌ Aucune candidature trouvée avec ces filtres.' });
      }

      const statusEmoji = { pending: '⏳', waiting: '🔍', accepted: '✅', rejected: '❌' };
      const lines = apps.map(a => {
        const p = POSTES[a.poste];
        return `${statusEmoji[a.status] ?? '❓'} **#${a.id}** · ${p?.emoji ?? ''} ${p?.label ?? a.poste} · <@${a.user_id}> · <t:${a.submitted_at}:R>`;
      }).join('\n');

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('📋 Candidatures récentes')
            .setDescription(lines.slice(0, 4000))
            .setFooter({ text: `${apps.length} candidature(s)` }),
        ],
      });
    }

    // ── /recrutement stats ─────────────────────────────────────────────────
    if (sub === 'stats') {
      await interaction.deferReply({ ephemeral: true });

      const total    = db.db.prepare('SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=?').get(guildId).c;
      const pending  = db.db.prepare("SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND status='pending'").get(guildId).c;
      const waiting  = db.db.prepare("SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND status='waiting'").get(guildId).c;
      const accepted = db.db.prepare("SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND status='accepted'").get(guildId).c;
      const rejected = db.db.prepare("SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND status='rejected'").get(guildId).c;

      const perPoste = Object.entries(POSTES).map(([key, p]) => {
        const c = db.db.prepare('SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND poste=?').get(guildId, key).c;
        const a = db.db.prepare("SELECT COUNT(*) as c FROM rec_apps WHERE guild_id=? AND poste=? AND status='accepted'").get(guildId, key).c;
        return `${p.emoji} **${p.label}** — ${c} cand. · ${a} accepté(s)`;
      }).join('\n');

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('📊 Statistiques de recrutement')
            .addFields(
              { name: '📨 Total',       value: `**${total}**`,    inline: true },
              { name: '⏳ En attente',  value: `**${pending}**`,  inline: true },
              { name: '🔍 En examen',   value: `**${waiting}**`,  inline: true },
              { name: '✅ Acceptées',   value: `**${accepted}**`, inline: true },
              { name: '❌ Refusées',    value: `**${rejected}**`, inline: true },
              { name: '📈 Taux acceptation', value: total > 0 ? `**${Math.round(accepted / total * 100)}%**` : '—', inline: true },
              { name: '📋 Détail par poste', value: perPoste || 'Aucune donnée', inline: false },
            )
            .setTimestamp(),
        ],
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  GESTION DES COMPOSANTS (boutons + modals)
  // ─────────────────────────────────────────────────────────────────────────
  async handleComponent(interaction, cid) {
    const guildId = interaction.guildId;

    // ── Clic sur le panneau : afficher le modal de candidature ────────────
    if (cid.startsWith('rec_apply_')) {
      const poste = cid.slice(10);
      const p     = POSTES[poste];
      if (!p) return false;

      const cfg = getConfig(guildId);
      if (cfg.status[poste] === false) {
        await interaction.reply({ content: '❌ Ce poste est actuellement **fermé** aux candidatures.', ephemeral: true });
        return true;
      }

      // Candidature en cours ?
      if (hasPendingApp(guildId, interaction.user.id, poste)) {
        await interaction.reply({ content: '⏳ Tu as déjà une candidature **en cours d\'examen** pour ce poste. Attends qu\'elle soit traitée avant de repostuler.', ephemeral: true });
        return true;
      }

      // Cooldown après refus ?
      const lastRej = getLastRejected(guildId, interaction.user.id, poste);
      if (lastRej) {
        const cooldownEnd = (lastRej.reviewed_at || lastRej.submitted_at) + COOLDOWN_DAYS * 86400;
        if (ts() < cooldownEnd) {
          await interaction.reply({ content: `⏳ Tu dois attendre <t:${cooldownEnd}:R> avant de repostuler au poste **${p.label}**.`, ephemeral: true });
          return true;
        }
      }

      // Construire le modal (5 questions)
      const modal = new ModalBuilder()
        .setCustomId(`rec_form_${poste}`)
        .setTitle(`${p.label} — Formulaire de candidature`);

      for (let i = 0; i < p.questions.length; i++) {
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`q${i}`)
              .setLabel(p.questions[i].slice(0, 45))
              .setStyle(i === 0 ? TextInputStyle.Short : TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(5)
              .setMaxLength(500)
          )
        );
      }

      await interaction.showModal(modal);
      return true;
    }

    // ── Soumission du formulaire ──────────────────────────────────────────
    if (cid.startsWith('rec_form_') && interaction.isModalSubmit()) {
      const poste = cid.slice(9);
      const p     = POSTES[poste];
      if (!p) return false;

      const cfg = getConfig(guildId);
      if (!cfg.log_channel) {
        await interaction.reply({ content: '❌ Le système de recrutement n\'est pas encore configuré. Contactez un admin.', ephemeral: true });
        return true;
      }

      const answers = p.questions.map((q, i) => ({
        q,
        a: interaction.fields.getTextInputValue(`q${i}`) || '',
      }));

      // Insertion en DB
      const result = db.db.prepare(
        'INSERT INTO rec_apps (guild_id, poste, user_id, answers) VALUES (?,?,?,?)'
      ).run(guildId, poste, interaction.user.id, JSON.stringify(answers));

      const appId     = result.lastInsertRowid;
      const appRecord = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      // Envoyer dans le log channel
      const logCh  = interaction.guild.channels.cache.get(cfg.log_channel);
      let   msgId  = null;
      if (logCh) {
        const logEmbed   = buildLogEmbed(appRecord, interaction.user, p, 'pending');
        const logButtons = buildLogButtons(appId, 'pending');
        const pingContent = cfg.ping_role ? `<@&${cfg.ping_role}>` : undefined;
        const msg = await logCh.send({
          ...(pingContent ? { content: pingContent } : {}),
          embeds:     [logEmbed],
          components: logButtons,
        }).catch(() => null);
        if (msg) msgId = msg.id;
      }

      if (msgId) {
        db.db.prepare('UPDATE rec_apps SET msg_id=? WHERE id=?').run(msgId, appId);
      }

      // Confirmation au candidat
      const recap = answers
        .map((a, i) => `**${i + 1}.** ${a.q.slice(0, 60)}\n> ${a.a.slice(0, 120)}${a.a.length > 120 ? '…' : ''}`)
        .join('\n\n')
        .slice(0, 1800);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`✅ Candidature envoyée — ${p.emoji} ${p.label}`)
            .setDescription(
              'Ta candidature a bien été **soumise** ! Notre équipe staff l\'examinera dans les **48–72 heures**.\n\n' +
              '📬 Tu recevras un **message privé** dès qu\'une décision sera prise. Assure-toi que tes DMs sont ouverts.'
            )
            .addFields({ name: '📋 Récapitulatif de tes réponses', value: recap || '*—*' })
            .setFooter({ text: `Candidature #${appId}` })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return true;
    }

    // ── Bouton ✅ Accepter ────────────────────────────────────────────────
    if (cid.startsWith('rec_acc_')) {
      const appId   = parseInt(cid.slice(8));
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
                   || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                   { await interaction.reply({ content: '❌ Candidature introuvable.',    ephemeral: true }); return true; }
      if (app.status === 'accepted') { await interaction.reply({ content: '✅ Déjà acceptée.',           ephemeral: true }); return true; }
      if (app.status === 'rejected') { await interaction.reply({ content: '❌ Déjà refusée.',            ephemeral: true }); return true; }

      const p   = POSTES[app.poste];
      const cfg = getConfig(guildId);

      // Mise à jour DB
      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=?, reviewed_at=? WHERE id=?')
        .run('accepted', interaction.user.id, ts(), appId);
      const appUpdated = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      // Attribuer le rôle
      const roleId = cfg.roles[app.poste];
      let roleGiven = false;
      if (roleId) {
        const member = await interaction.guild.members.fetch(app.user_id).catch(() => null);
        if (member) {
          await member.roles.add(roleId).catch(() => {});
          roleGiven = true;
        }
      }

      // DM au candidat
      const candidate = await interaction.client.users.fetch(app.user_id).catch(() => null);
      if (candidate) {
        candidate.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle(`🎉 Candidature acceptée — ${p?.emoji ?? ''} ${p?.label ?? app.poste}`)
              .setDescription(
                `**Félicitations !** Ta candidature pour le poste **${p?.label ?? app.poste}** sur **${interaction.guild.name}** a été **acceptée** par notre équipe staff.\n\n` +
                (roleGiven ? `✅ Le rôle correspondant t\'a été attribué automatiquement.\n\n` : '') +
                `Bienvenue dans l\'équipe ! 🚀 Tu recevras bientôt les informations nécessaires pour débuter.`
              )
              .setThumbnail(interaction.guild.iconURL({ size: 256 }))
              .setFooter({ text: `Candidature #${appId}  ·  ${interaction.guild.name}` })
              .setTimestamp(),
          ],
        }).catch(() => {});
      }

      // Mettre à jour le message de log
      const fakeUser = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      const updatedEmbed = buildLogEmbed(appUpdated, fakeUser, p, 'accepted');
      await interaction.message.edit({ embeds: [updatedEmbed], components: [] }).catch(() => {});

      await interaction.reply({
        content: `✅ Candidature **#${appId}** de <@${app.user_id}> **acceptée**.${roleGiven ? ' Rôle attribué.' : ''} Candidat notifié en DM.`,
        ephemeral: true,
      });
      return true;
    }

    // ── Bouton ❌ Refuser → afficher modal pour la raison ─────────────────
    if (cid.startsWith('rec_rej_') && !cid.startsWith('rec_rej_conf_')) {
      const appId   = parseInt(cid.slice(8));
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
                   || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                   { await interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true }); return true; }
      if (app.status === 'rejected') { await interaction.reply({ content: '❌ Déjà refusée.',         ephemeral: true }); return true; }
      if (app.status === 'accepted') { await interaction.reply({ content: '✅ Déjà acceptée.',        ephemeral: true }); return true; }

      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`rec_rej_conf_${appId}`)
          .setTitle(`Refus — Candidature #${appId}`)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Raison du refus (envoyée au candidat)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500)
                .setPlaceholder('Ex : Ton profil ne correspond pas aux critères actuels. N\'hésite pas à repostuler plus tard.')
            )
          )
      );
      return true;
    }

    // ── Modal refus confirmé ──────────────────────────────────────────────
    if (cid.startsWith('rec_rej_conf_') && interaction.isModalSubmit()) {
      const appId  = parseInt(cid.slice(13));
      const reason = interaction.fields.getTextInputValue('reason') || 'Aucune raison précisée.';

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app) { await interaction.reply({ content: '❌ Candidature introuvable.', ephemeral: true }); return true; }

      const p = POSTES[app.poste];

      // Mise à jour DB
      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=?, reject_reason=?, reviewed_at=? WHERE id=?')
        .run('rejected', interaction.user.id, reason, ts(), appId);
      const appUpdated = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      // DM au candidat
      const candidate = await interaction.client.users.fetch(app.user_id).catch(() => null);
      if (candidate) {
        candidate.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle(`❌ Candidature non retenue — ${p?.emoji ?? ''} ${p?.label ?? app.poste}`)
              .setDescription(
                `Ta candidature pour le poste **${p?.label ?? app.poste}** sur **${interaction.guild.name}** n\'a malheureusement pas été retenue cette fois.\n\n` +
                `**Raison :** ${reason}\n\n` +
                `Ne te décourage pas ! Tu pourras repostuler après **${COOLDOWN_DAYS} jours**. Bonne chance pour la suite ! 💪`
              )
              .setThumbnail(interaction.guild.iconURL({ size: 256 }))
              .setFooter({ text: `Candidature #${appId}  ·  ${interaction.guild.name}` })
              .setTimestamp(),
          ],
        }).catch(() => {});
      }

      // Mettre à jour le message de log (via msg_id sauvegardé)
      const cfg    = getConfig(guildId);
      const fakeUser = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      const rejEmbed = buildLogEmbed(appUpdated, fakeUser, p, 'rejected');

      if (app.msg_id && cfg.log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.log_channel);
        if (logCh) {
          logCh.messages.fetch(app.msg_id)
            .then(msg => msg.edit({ embeds: [rejEmbed], components: [] }))
            .catch(() => {});
        }
      }

      await interaction.reply({
        content: `❌ Candidature **#${appId}** de <@${app.user_id}> **refusée**. Candidat notifié en DM.`,
        ephemeral: true,
      });
      return true;
    }

    // ── Bouton 🔍 En examen ───────────────────────────────────────────────
    if (cid.startsWith('rec_wait_')) {
      const appId   = parseInt(cid.slice(9));
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
                   || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.reply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                   { await interaction.reply({ content: '❌ Candidature introuvable.',      ephemeral: true }); return true; }
      if (app.status === 'accepted' || app.status === 'rejected') {
        await interaction.reply({ content: '❌ Cette candidature est déjà traitée.', ephemeral: true });
        return true;
      }

      const p = POSTES[app.poste];
      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=? WHERE id=?')
        .run('waiting', interaction.user.id, appId);
      const appUpdated = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      // Mettre à jour le log embed
      const candidate = await interaction.client.users.fetch(app.user_id).catch(() => null);
      const fakeUser  = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      const updEmbed  = buildLogEmbed(appUpdated, fakeUser, p, 'waiting');
      await interaction.message.edit({ embeds: [updEmbed], components: buildLogButtons(appId, 'waiting') }).catch(() => {});

      await interaction.reply({
        content: `🔍 Candidature **#${appId}** marquée **en examen** par <@${interaction.user.id}>.`,
        ephemeral: true,
      });
      return true;
    }

    return false;
  },
};
