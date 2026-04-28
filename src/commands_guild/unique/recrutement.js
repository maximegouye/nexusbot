'use strict';

/**
 * NexusBot — Système de Recrutement Staff v3 (refonte complète)
 * Labels modaux ≤ 45 chars, placeholders détaillés, design premium
 */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, PermissionFlagsBits,
} = require('discord.js');
const db = require('../../database/db');

// ─────────────────────────────────────────────────────────────────────────────
//  POSTES — label ≤ 45 chars (limite Discord), placeholder jusqu'à 100 chars
// ─────────────────────────────────────────────────────────────────────────────
const POSTES = {
  moderateur: {
    label: 'Modérateur',
    emoji: '🛡️',
    color: '#5865F2',
    desc: 'Veille au respect des règles et à la bonne ambiance du serveur.',
    questions: [
      {
        label: 'Ton âge & depuis quand sur le serveur',
        placeholder: 'Ex : 20 ans, membre depuis 4 mois',
        short: true,
      },
      {
        label: 'Expérience en modération Discord',
        placeholder: 'Serveurs modérés, sanctions appliquées, taille des communautés…',
        short: false,
      },
      {
        label: 'Gestion d\'un conflit entre membres',
        placeholder: 'Décris tes étapes concrètes pour désamorcer la situation',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~15h/sem, tous les soirs + week-end',
        short: true,
      },
      {
        label: 'Pourquoi rejoindre l\'équipe staff ?',
        placeholder: 'Ta vraie motivation et ce que tu apportes à l\'équipe',
        short: false,
      },
    ],
  },

  technicien: {
    label: 'Technicien Bots',
    emoji: '⚙️',
    color: '#2ECC71',
    desc: 'Développe, configure et maintient les bots du serveur.',
    questions: [
      {
        label: 'Langages & technologies maîtrisés',
        placeholder: 'Ex : JavaScript / Node.js, Python, Discord.js v14…',
        short: true,
      },
      {
        label: 'Bots Discord créés ou configurés',
        placeholder: 'Décris les projets, fonctionnalités, complexité technique…',
        short: false,
      },
      {
        label: 'Expérience APIs, webhooks, bases de données',
        placeholder: 'Intégrations réalisées, bases SQLite / MongoDB, etc.',
        short: false,
      },
      {
        label: 'Amélioration concrète pour NexusBot',
        placeholder: 'Une feature que tu pourrais livrer rapidement',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~10h/sem, principalement le week-end',
        short: true,
      },
    ],
  },

  animateur: {
    label: 'Animateur Events',
    emoji: '🎉',
    color: '#F39C12',
    desc: 'Organise et anime des événements pour faire vivre la communauté.',
    questions: [
      {
        label: 'Événements déjà organisés',
        placeholder: 'Type, plateforme, nombre de participants, résultats…',
        short: false,
      },
      {
        label: 'Types d\'events pour ce serveur',
        placeholder: 'Tournois, soirées, quiz, jeux… sois précis et créatif',
        short: false,
      },
      {
        label: 'Comment tu engages la communauté ?',
        placeholder: 'Méthodes, communication, outils d\'animation utilisés',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~8h/sem, flexible selon les events prévus',
        short: true,
      },
      {
        label: 'Idée d\'event inédite pour ce serveur',
        placeholder: 'Propose un concept original que tu pourrais organiser',
        short: false,
      },
    ],
  },

  helper: {
    label: 'Helper Support',
    emoji: '🤝',
    color: '#1ABC9C',
    desc: 'Aide et oriente les membres qui ont besoin d\'assistance.',
    questions: [
      {
        label: 'Expérience en support Discord',
        placeholder: 'Serveurs où tu as aidé, types de problèmes résolus…',
        short: false,
      },
      {
        label: 'Vulgariser quelque chose de complexe',
        placeholder: 'Comment tu adaptes ton langage selon ton interlocuteur ?',
        short: false,
      },
      {
        label: 'Gérer un membre difficile / irrespectueux',
        placeholder: 'Ta méthode pour garder ton calme et rester efficace',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~20h/sem, soirées + week-end',
        short: true,
      },
      {
        label: 'Pourquoi ce poste de Helper ?',
        placeholder: 'Ta motivation et ce que tu veux apporter aux membres',
        short: false,
      },
    ],
  },

  partenariat: {
    label: 'Chargé Partenariats',
    emoji: '🌐',
    color: '#9B59B6',
    desc: 'Développe et gère les partenariats avec d\'autres serveurs.',
    questions: [
      {
        label: 'Expérience en partenariats Discord',
        placeholder: 'Serveurs partenariés, types de collaborations menées…',
        short: false,
      },
      {
        label: 'Comment tu prospectes & contactes',
        placeholder: 'Méthodes de recherche, approche, discours de contact…',
        short: false,
      },
      {
        label: 'Critères pour valider un partenariat',
        placeholder: 'Ce que tu analyses avant de dire oui ou non',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~10h/sem, disponible pour négocier en semaine',
        short: true,
      },
      {
        label: 'Stratégie pour développer nos partenariats',
        placeholder: 'Plan d\'action concret que tu mettrais en place dès le départ',
        short: false,
      },
    ],
  },

  contenu: {
    label: 'Responsable Contenu',
    emoji: '📝',
    color: '#E74C3C',
    desc: 'Crée et gère le contenu éditorial et les annonces du serveur.',
    questions: [
      {
        label: 'Contenu créé (Discord / réseaux)',
        placeholder: 'Types de posts, annonces, formats, plateformes…',
        short: false,
      },
      {
        label: 'Outils de création que tu utilises',
        placeholder: 'Ex : Canva, Adobe Suite, Figma, CapCut…',
        short: true,
      },
      {
        label: 'Idées pour rendre le serveur attractif',
        placeholder: 'Propose des actions concrètes pour booster l\'activité',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~8h/sem, publication régulière et planifiée',
        short: true,
      },
      {
        label: 'Idée de contenu pour ce serveur',
        placeholder: 'Un concept éditorial qui pourrait vraiment faire la différence',
        short: false,
      },
    ],
  },

  graphiste: {
    label: 'Graphiste',
    emoji: '🎨',
    color: '#E91E63',
    desc: 'Conçoit l\'identité visuelle et les assets graphiques du serveur.',
    questions: [
      {
        label: 'Logiciels de design maîtrisés',
        placeholder: 'Ex : Photoshop, Illustrator, Figma, Canva Pro…',
        short: true,
      },
      {
        label: 'Création dont tu es le plus fier(e)',
        placeholder: 'Décris-la ou partage un lien (portfolio, Behance…)',
        short: false,
      },
      {
        label: 'Expérience design pour Discord',
        placeholder: 'Icônes, bannières, emotes, logos créés pour des serveurs',
        short: false,
      },
      {
        label: 'Disponibilité par semaine (heures)',
        placeholder: 'Ex : ~10h/sem selon les projets en cours',
        short: true,
      },
      {
        label: 'Première amélioration visuelle du serveur',
        placeholder: 'Qu\'améliorerais-tu en priorité dans notre identité visuelle ?',
        short: false,
      },
    ],
  },
};

const COOLDOWN_DAYS = 14;

// ─────────────────────────────────────────────────────────────────────────────
//  INIT DB
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

function buildLogEmbed(app, user, poste, status) {
  const statusMap = {
    pending:  { color: '#F1C40F', label: '⏳ En attente de traitement' },
    waiting:  { color: '#5865F2', label: '🔍 En cours d\'examen'       },
    accepted: { color: '#2ECC71', label: '✅ Candidature acceptée'     },
    rejected: { color: '#E74C3C', label: '❌ Candidature refusée'      },
  };
  const s       = statusMap[status] || statusMap.pending;
  const answers = (() => { try { return JSON.parse(app.answers || '[]'); } catch { return []; } })();
  const displayName = user?.tag ?? user?.username ?? `<@${app.user_id}>`;
  const avatarURL   = (typeof user?.displayAvatarURL === 'function') ? user.displayAvatarURL({ size: 256 }) : null;

  const embed = new EmbedBuilder()
    .setColor(s.color)
    .setAuthor({ name: `Candidature #${app.id} — ${poste?.label ?? app.poste}`, iconURL: avatarURL ?? undefined })
    .setDescription(
      `> **Candidat :** <@${app.user_id}> (\`${displayName}\`)\n` +
      `> **Poste :** ${poste?.emoji ?? ''} ${poste?.label ?? app.poste}\n` +
      `> **Statut :** ${s.label}`
    )
    .setFooter({ text: `Candidature #${app.id}  ·  Soumise le` })
    .setTimestamp(app.submitted_at * 1000);

  if (avatarURL) embed.setThumbnail(avatarURL);

  answers.forEach((a, i) => {
    embed.addFields({
      name:   `${i + 1}. ${(a.q ?? '').slice(0, 100)}`,
      value:  `\`\`\`${(a.a ?? 'Non renseigné').slice(0, 900)}\`\`\``,
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

function buildLogButtons(appId, status) {
  if (status === 'accepted' || status === 'rejected') return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rec_acc_${appId}`) .setLabel('Accepter') .setEmoji('✅').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`rec_wait_${appId}`).setLabel('En examen').setEmoji('🔍').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rec_rej_${appId}`) .setLabel('Refuser')  .setEmoji('❌').setStyle(ButtonStyle.Danger),
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
      .setDescription('⚙️ Configurer le système')
      .addChannelOption(o => o.setName('logs').setDescription('Salon des candidatures (staff)').setRequired(true))
      .addRoleOption(o => o.setName('ping').setDescription('Rôle pingé à chaque candidature')))
    .addSubcommand(s => s
      .setName('panel')
      .setDescription('📢 Publier le panneau dans ce salon'))
    .addSubcommand(s => s
      .setName('role')
      .setDescription('🏷️ Associer un rôle à un poste')
      .addStringOption(o => o.setName('poste').setDescription('Poste').setRequired(true)
        .addChoices(...Object.entries(POSTES).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k }))))
      .addRoleOption(o => o.setName('role').setDescription('Rôle à attribuer si accepté').setRequired(true)))
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('🔓 Ouvrir / fermer un poste')
      .addStringOption(o => o.setName('poste').setDescription('Poste').setRequired(true)
        .addChoices(...Object.entries(POSTES).map(([k, v]) => ({ name: `${v.emoji} ${v.label}`, value: k })))))
    .addSubcommand(s => s
      .setName('candidatures')
      .setDescription('📋 Lister les candidatures')
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
      .setDescription('📊 Statistiques de recrutement')),

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
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
        embeds: [
          new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('✅ Recrutement configuré')
            .addFields(
              { name: '📋 Logs',     value: `${logCh}`,                              inline: true },
              { name: '🔔 Ping',     value: pingRole ? `${pingRole}` : 'Aucun',      inline: true },
              { name: '💡 Suite',    value: '`/recrutement panel` → publie le panneau\n`/recrutement role` → associe les rôles staff', inline: false },
            ),
        ],
        ephemeral: true,
      });
    }

    // ── /recrutement panel ─────────────────────────────────────────────────
    if (sub === 'panel') {
      const cfg = getConfig(guildId);
      if (!cfg.log_channel) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Configure d\'abord avec `/recrutement setup`.', ephemeral: true });
      }
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const guild      = interaction.guild;
      const openCount  = Object.keys(POSTES).filter(k => cfg.status[k] !== false).length;
      const totalCount = Object.keys(POSTES).length;
      const iconURL    = guild.iconURL({ size: 256, dynamic: true });
      const bannerURL  = guild.bannerURL({ size: 1024, forceStatic: false });

      const panelEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: `${guild.name} — Recrutement Staff`, iconURL: iconURL ?? undefined })
        .setTitle('✨  Rejoins l\'équipe qui fait vivre le serveur !')
        .setDescription(
          `> *Nous cherchons des personnes motivées et investies pour renforcer notre équipe.*\n\n` +
          `**📌 Comment postuler ?**\n` +
          `Clique sur le bouton du poste qui t'intéresse, remplis le formulaire et soumets ta candidature.\n` +
          `Notre équipe te répondra sous **48–72h**.\n\n` +
          `**📋 Postes disponibles** — \`${openCount}/${totalCount} ouverts\`\n` +
          Object.entries(POSTES).map(([k, p]) => {
            const isOpen = cfg.status[k] !== false;
            return `${p.emoji} **${p.label}** — ${isOpen ? '🟢 Ouvert' : '🔴 Fermé'}`;
          }).join('\n') + '\n\n' +
          `**⚠️ Règles importantes**\n` +
          `— Remplis chaque champ avec soin et honnêteté\n` +
          `— Une seule candidature active à la fois\n` +
          `— Toute candidature bâclée sera refusée automatiquement`
        )
        .setThumbnail(iconURL ?? null)
        .setFooter({ text: `${guild.name}  •  Répond sous 48–72h  •  Bonne chance ! 🍀`, iconURL: iconURL ?? undefined })
        .setTimestamp();

      if (bannerURL) panelEmbed.setImage(bannerURL);

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
      return interaction.editReply({ content: '✅ Panneau publié dans ce salon !' });
    }

    // ── /recrutement role ──────────────────────────────────────────────────
    if (sub === 'role') {
      const poste = interaction.options.getString('poste');
      const role  = interaction.options.getRole('role');
      const cfg   = getConfig(guildId);
      cfg.roles[poste] = role.id;
      saveConfig(guildId, { roles: cfg.roles });
      return interaction.editReply({
        content: `✅ Rôle **${role.name}** associé au poste **${POSTES[poste]?.label ?? poste}**.`,
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
      return interaction.editReply({
        content: wasOpen
          ? `🔴 Poste **${p?.label ?? poste}** fermé aux candidatures.`
          : `🟢 Poste **${p?.label ?? poste}** ouvert aux candidatures.`,
        ephemeral: true,
      });
    }

    // ── /recrutement candidatures ──────────────────────────────────────────
    if (sub === 'candidatures') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
      const poste  = interaction.options.getString('poste');
      const statut = interaction.options.getString('statut');
      let query  = 'SELECT * FROM rec_apps WHERE guild_id=?';
      const args = [guildId];
      if (poste)  { query += ' AND poste=?';  args.push(poste);  }
      if (statut) { query += ' AND status=?'; args.push(statut); }
      query += ' ORDER BY submitted_at DESC LIMIT 25';
      const apps = db.db.prepare(query).all(...args);
      if (!apps.length) {
        return interaction.editReply({ content: '❌ Aucune candidature trouvée.' });
      }
      const statusEmoji = { pending: '⏳', waiting: '🔍', accepted: '✅', rejected: '❌' };
      const lines = apps.map(a => {
        const p = POSTES[a.poste];
        return `${statusEmoji[a.status] ?? '❓'} **#${a.id}** · ${p?.emoji ?? ''} ${p?.label ?? a.poste} · <@${a.user_id}> · <t:${a.submitted_at}:R>`;
      }).join('\n');
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📋 Candidatures récentes')
            .setDescription(lines.slice(0, 4000))
            .setFooter({ text: `${apps.length} résultat(s)` }),
        ],
      });
    }

    // ── /recrutement stats ─────────────────────────────────────────────────
    if (sub === 'stats') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
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
            .setColor('#5865F2')
            .setTitle('📊 Statistiques de recrutement')
            .addFields(
              { name: '📨 Total',            value: `**${total}**`,    inline: true },
              { name: '⏳ En attente',        value: `**${pending}**`,  inline: true },
              { name: '🔍 En examen',         value: `**${waiting}**`,  inline: true },
              { name: '✅ Acceptées',         value: `**${accepted}**`, inline: true },
              { name: '❌ Refusées',          value: `**${rejected}**`, inline: true },
              { name: '📈 Taux acceptation',  value: total > 0 ? `**${Math.round(accepted / total * 100)}%**` : '—', inline: true },
              { name: '📋 Détail par poste',  value: perPoste || 'Aucune donnée', inline: false },
            )
            .setTimestamp(),
        ],
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  //  GESTION DES COMPOSANTS (boutons + modaux)
  // ─────────────────────────────────────────────────────────────────────────
  async handleComponent(interaction, cid) {
    const guildId = interaction.guildId;

    // ── Clic panneau → modal de candidature ──────────────────────────────
    if (cid.startsWith('rec_apply_')) {
      const poste = cid.slice(10);
      const p     = POSTES[poste];
      if (!p) return false;

      const cfg = getConfig(guildId);
      if (cfg.status[poste] === false) {
        await interaction.editReply({ content: `❌ Le poste **${p.label}** est actuellement **fermé** aux candidatures.`, ephemeral: true });
        return true;
      }
      if (hasPendingApp(guildId, interaction.user.id, poste)) {
        await interaction.editReply({ content: `⏳ Tu as déjà une candidature **en cours** pour le poste **${p.label}**. Attends la décision de l'équipe.`, ephemeral: true });
        return true;
      }
      const lastRej = getLastRejected(guildId, interaction.user.id, poste);
      if (lastRej) {
        const cooldownEnd = (lastRej.reviewed_at || lastRej.submitted_at) + COOLDOWN_DAYS * 86400;
        if (ts() < cooldownEnd) {
          await interaction.editReply({ content: `⏳ Tu dois attendre <t:${cooldownEnd}:R> avant de repostuler au poste **${p.label}**.`, ephemeral: true });
          return true;
        }
      }

      // Modal — titre ≤ 45 chars garanti, labels courts + placeholders détaillés
      const modal = new ModalBuilder()
        .setCustomId(`rec_form_${poste}`)
        .setTitle(`${p.label} — Candidature`.slice(0, 45));

      for (let i = 0; i < p.questions.length; i++) {
        const q = p.questions[i];
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId(`q${i}`)
              .setLabel(q.label.slice(0, 45))
              .setPlaceholder(q.placeholder.slice(0, 100))
              .setStyle(q.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
              .setRequired(true)
              .setMinLength(3)
              .setMaxLength(q.short ? 150 : 500)
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
        await interaction.editReply({ content: '❌ Le système de recrutement n\'est pas configuré. Contacte un admin.', ephemeral: true });
        return true;
      }

      const answers = p.questions.map((q, i) => ({
        q: q.label,
        a: interaction.fields.getTextInputValue(`q${i}`) || '',
      }));

      const result    = db.db.prepare('INSERT INTO rec_apps (guild_id, poste, user_id, answers) VALUES (?,?,?,?)').run(guildId, poste, interaction.user.id, JSON.stringify(answers));
      const appId     = result.lastInsertRowid;
      const appRecord = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      // Log channel
      const logCh = interaction.guild.channels.cache.get(cfg.log_channel);
      let msgId   = null;
      if (logCh) {
        const pingContent = cfg.ping_role ? `<@&${cfg.ping_role}>` : undefined;
        const msg = await logCh.send({
          ...(pingContent ? { content: pingContent } : {}),
          embeds:     [buildLogEmbed(appRecord, interaction.user, p, 'pending')],
          components: buildLogButtons(appId, 'pending'),
        }).catch(() => null);
        if (msg) msgId = msg.id;
      }

      if (msgId) db.db.prepare('UPDATE rec_apps SET msg_id=? WHERE id=?').run(msgId, appId);

      // Récapitulatif pour le candidat
      const recap = answers
        .map((a, i) => `**${i + 1}. ${a.q}**\n> ${a.a.slice(0, 200)}${a.a.length > 200 ? '…' : ''}`)
        .join('\n\n')
        .slice(0, 2000);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: `${p.emoji} Candidature envoyée — ${p.label}` })
            .setDescription(
              '✅ Ta candidature a bien été **soumise** !\n' +
              'Notre équipe staff l\'examinera dans les **48–72 heures**.\n\n' +
              '📬 Tu recevras un **message privé** dès qu\'une décision sera prise.\n' +
              '⚠️ Assure-toi que tes **DMs sont ouverts**.'
            )
            .addFields({ name: '📋 Récapitulatif de tes réponses', value: recap || '—' })
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
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                      { await interaction.editReply({ content: '❌ Candidature introuvable.',    ephemeral: true }); return true; }
      if (app.status === 'accepted') { await interaction.editReply({ content: '✅ Déjà acceptée.',              ephemeral: true }); return true; }
      if (app.status === 'rejected') { await interaction.editReply({ content: '❌ Déjà refusée.',              ephemeral: true }); return true; }

      const p   = POSTES[app.poste];
      const cfg = getConfig(guildId);

      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=?, reviewed_at=? WHERE id=?').run('accepted', interaction.user.id, ts(), appId);
      const appUpdated = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      const roleId = cfg.roles[app.poste];
      let roleGiven = false;
      if (roleId) {
        const member = await interaction.guild.members.fetch(app.user_id).catch(() => null);
        if (member) { await member.roles.add(roleId).catch(() => {}); roleGiven = true; }
      }

      const candidate = await interaction.client.users.fetch(app.user_id).catch(() => null);
      if (candidate) {
        candidate.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ECC71')
              .setTitle(`🎉 Candidature acceptée — ${p?.emoji ?? ''} ${p?.label ?? app.poste}`)
              .setDescription(
                `**Félicitations !** Ta candidature pour le poste **${p?.label ?? app.poste}** sur **${interaction.guild.name}** a été **acceptée** ! 🚀\n\n` +
                (roleGiven ? `✅ Le rôle correspondant t'a été attribué automatiquement.\n\n` : '') +
                `Bienvenue dans l'équipe ! Tu recevras bientôt les informations pour débuter.`
              )
              .setThumbnail(interaction.guild.iconURL({ size: 256 }))
              .setFooter({ text: `Candidature #${appId}  ·  ${interaction.guild.name}` })
              .setTimestamp(),
          ],
        }).catch(() => {});
      }

      const fakeUser = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      await interaction.message.edit({ embeds: [buildLogEmbed(appUpdated, fakeUser, p, 'accepted')], components: [] }).catch(() => {});
      await interaction.editReply({ content: `✅ Candidature **#${appId}** acceptée.${roleGiven ? ' Rôle attribué.' : ''} Candidat notifié en DM.`, ephemeral: true });
      return true;
    }

    // ── Bouton ❌ Refuser → modal raison ─────────────────────────────────
    if (cid.startsWith('rec_rej_') && !cid.startsWith('rec_rej_conf_')) {
      const appId   = parseInt(cid.slice(8));
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                      { await interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true }); return true; }
      if (app.status === 'rejected') { await interaction.editReply({ content: '❌ Déjà refusée.',            ephemeral: true }); return true; }
      if (app.status === 'accepted') { await interaction.editReply({ content: '✅ Déjà acceptée.',           ephemeral: true }); return true; }

      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`rec_rej_conf_${appId}`)
          .setTitle(`Refus #${appId}`.slice(0, 45))
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Raison du refus (envoyée au candidat)')
                .setPlaceholder('Ex : Ton profil ne correspond pas aux critères actuels…')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(500)
            )
          )
      );
      return true;
    }

    // ── Modal refus confirmé ──────────────────────────────────────────────
    if (cid.startsWith('rec_rej_conf_') && interaction.isModalSubmit()) {
      const appId  = parseInt(cid.slice(13));
      const reason = interaction.fields.getTextInputValue('reason') || 'Aucune raison précisée.';
      const app    = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app) { await interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true }); return true; }

      const p = POSTES[app.poste];
      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=?, reject_reason=?, reviewed_at=? WHERE id=?').run('rejected', interaction.user.id, reason, ts(), appId);
      const appUpdated = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);

      const candidate = await interaction.client.users.fetch(app.user_id).catch(() => null);
      if (candidate) {
        candidate.send({
          embeds: [
            new EmbedBuilder()
              .setColor('#E74C3C')
              .setTitle(`❌ Candidature non retenue — ${p?.emoji ?? ''} ${p?.label ?? app.poste}`)
              .setDescription(
                `Ta candidature pour **${p?.label ?? app.poste}** sur **${interaction.guild.name}** n'a pas été retenue cette fois.\n\n` +
                `**Raison :** ${reason}\n\n` +
                `Ne te décourage pas — tu pourras repostuler après **${COOLDOWN_DAYS} jours**. 💪`
              )
              .setThumbnail(interaction.guild.iconURL({ size: 256 }))
              .setFooter({ text: `Candidature #${appId}  ·  ${interaction.guild.name}` })
              .setTimestamp(),
          ],
        }).catch(() => {});
      }

      const cfg      = getConfig(guildId);
      const fakeUser = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      if (app.msg_id && cfg.log_channel) {
        const logCh = interaction.guild.channels.cache.get(cfg.log_channel);
        if (logCh) logCh.messages.fetch(app.msg_id).then(m => m.edit({ embeds: [buildLogEmbed(appUpdated, fakeUser, p, 'rejected')], components: [] })).catch(() => {});
      }

      await interaction.editReply({ content: `❌ Candidature **#${appId}** refusée. Candidat notifié en DM.`, ephemeral: true });
      return true;
    }

    // ── Bouton 🔍 En examen ───────────────────────────────────────────────
    if (cid.startsWith('rec_wait_')) {
      const appId   = parseInt(cid.slice(9));
      const isStaff = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) || interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
      if (!isStaff) { await interaction.editReply({ content: '❌ Permission insuffisante.', ephemeral: true }); return true; }

      const app = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      if (!app)                                                    { await interaction.editReply({ content: '❌ Candidature introuvable.', ephemeral: true }); return true; }
      if (app.status === 'accepted' || app.status === 'rejected') { await interaction.editReply({ content: '❌ Candidature déjà traitée.', ephemeral: true }); return true; }

      const p = POSTES[app.poste];
      db.db.prepare('UPDATE rec_apps SET status=?, reviewer_id=? WHERE id=?').run('waiting', interaction.user.id, appId);
      const appUpdated  = db.db.prepare('SELECT * FROM rec_apps WHERE id=?').get(appId);
      const candidate   = await interaction.client.users.fetch(app.user_id).catch(() => null);
      const fakeUser    = candidate ?? { tag: `User#${app.user_id}`, displayAvatarURL: () => null };
      await interaction.message.edit({ embeds: [buildLogEmbed(appUpdated, fakeUser, p, 'waiting')], components: buildLogButtons(appId, 'waiting') }).catch(() => {});
      await interaction.editReply({ content: `🔍 Candidature **#${appId}** marquée **en examen** par <@${interaction.user.id}>.`, ephemeral: true });
      return true;
    }

    return false;
  },
};
