/**
 * NexusBot — Panneau de configuration AVANCÉ (extensions)
 *
 * Ce module ajoute au panneau principal (configPanel.js) :
 *  - Éditeur d'embed visuel (templates réutilisables)
 *  - Commandes personnalisées AVANCÉES (texte ou embed, cooldown, rôles, salons)
 *  - Messages système configurables (welcome, leave, levelup, boost, daily, work...)
 *  - Cooldowns & toggles par commande (override global)
 *  - Aliases de commandes
 *
 * Le handler principal (`handleAdvancedInteraction`) prend les customId :
 *    adv:<section>:<action>:<userId>[:<arg>]
 *    adv_modal:<section>:<action>:<userId>[:<arg>]
 *    adv_chan:<section>:<userId>[:<arg>]
 *    adv_role:<section>:<userId>[:<arg>]
 *    adv_sel:<section>:<userId>[:<arg>]
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

// ═══════════════════════════════════════════════════════════════
// HELPERS COMMUNS
// ═══════════════════════════════════════════════════════════════
function onOff(v)         { return v ? '✅ Activé' : '❌ Désactivé'; }
function chanMention(id)  { return id ? `<#${id}>` : '`Non défini`'; }
function roleMention(id)  { return id ? `<@&${id}>` : '`Non défini`'; }
function truncate(s, n)   { if (!s) return ''; s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function safeJsonParse(s, fallback = null) {
  try { return JSON.parse(s); } catch { return fallback; }
}

function backBtn(userId) {
  return new ButtonBuilder()
    .setCustomId(`cfg:menu:${userId}`)
    .setLabel('← Menu principal')
    .setStyle(ButtonStyle.Secondary);
}

// ═══════════════════════════════════════════════════════════════
// CATÉGORIES AVANCÉES (exportées pour être fusionnées dans CATEGORIES)
// ═══════════════════════════════════════════════════════════════
const ADVANCED_CATEGORIES = [
  { value: 'eco_pro',        label: '⚡ Économie avancée',        description: 'Travail, crime, vol, série, taxes, intérêts — sans limite' },
  { value: 'xp_pro',         label: '📊 XP avancé',               description: 'Délai, vocal, bonus week-end, cumul des rôles' },
  { value: 'mod_pro',        label: '🔨 Modération avancée',      description: 'Escalade automatique des avertissements, durée de rendu muet' },
  { value: 'logs_pro',       label: '📋 Journaux détaillés',      description: 'Activer/désactiver chaque type d\'événement journalisé' },
  { value: 'ai',             label: '🧠 Intelligence artificielle', description: 'Fournisseur, modèle, mention = question, rôle requis' },
  { value: 'kv',             label: '🗄️ Éditeur libre de clés',  description: 'Ajoute/modifie N\'IMPORTE quelle clé de configuration' },
  { value: 'ui_texts',       label: '🗣️ Textes & libellés',      description: 'Personnalise les textes du panneau (boutons, titres)' },
  { value: 'embeds',         label: '🎨 Éditeur d\'encarts',      description: 'Créer et gérer des encarts personnalisés (titre, image, champs…)' },
  { value: 'cmds_adv',       label: '⚡ Commandes personnalisées', description: 'Créer des commandes & sur mesure (texte ou encart)' },
  { value: 'sys_msgs',       label: '📢 Messages système',        description: 'Bienvenue, départ, niveau, boost, quotidien…' },
  { value: 'autoresp',       label: '🔁 Réponses automatiques',   description: 'Le bot répond quand un message contient un mot-clé' },
  { value: 'level_roles',    label: '🏆 Rôles par niveau',        description: 'Attribue un rôle quand un membre atteint un niveau' },
  { value: 'shop',           label: '🛒 Boutique',                description: 'Articles, prix, stock, rôles attribués' },
  { value: 'reaction_roles', label: '⭐ Rôles par réaction',       description: 'Réagir sur un message = obtenir un rôle' },
  { value: 'role_menus',     label: '📜 Menus de rôles',          description: 'Panneaux interactifs de sélection de rôles' },
  { value: 'antiraid',       label: '🛡️ Anti-raid',              description: 'Protection contre les raids + comptes trop jeunes' },
  { value: 'youtube',        label: '📺 Alertes YouTube',         description: 'Alertes quand une chaîne publie une vidéo' },
  { value: 'twitch',         label: '🎮 Alertes Twitch',          description: 'Alertes quand un streameur démarre un direct' },
  { value: 'giveaways',      label: '🎁 Concours',                description: 'Liste des concours et gestion' },
  { value: 'scheduled',      label: '⏰ Messages programmés',      description: 'Messages automatiques récurrents (expressions CRON)' },
  { value: 'quests',         label: '📋 Quêtes',                  description: 'Défis communautaires avec récompenses' },
  { value: 'polls',          label: '📬 Sondages',                description: 'Liste et gestion des sondages' },
  { value: 'cmd_ctrl',       label: '🛠️ Délais & activations',   description: 'Activer/désactiver et régler les délais de chaque commande' },
  { value: 'aliases',        label: '🔀 Raccourcis',              description: 'Alias : utiliser un autre nom pour une commande' },
  { value: 'backup',         label: '💾 Sauvegarde & Import',     description: 'Exporter / importer toute la configuration du serveur' },
];

// ═══════════════════════════════════════════════════════════════
// LISTE DES ÉVÉNEMENTS SYSTÈME CONFIGURABLES
// ═══════════════════════════════════════════════════════════════
const SYSTEM_EVENTS = [
  { key: 'welcome',  label: '👋 Bienvenue',        desc: 'Nouveau membre', vars: '{user} {username} {server} {count}' },
  { key: 'leave',    label: '🚪 Au revoir',         desc: 'Membre qui part', vars: '{user} {username} {server} {count}' },
  { key: 'levelup',  label: '⭐ Passage de niveau', desc: 'Nouveau niveau atteint', vars: '{user} {username} {level} {xp}' },
  { key: 'boost',    label: '🚀 Boost serveur',    desc: 'Membre qui boost', vars: '{user} {username} {server}' },
  { key: 'daily',    label: '📅 Daily',            desc: 'Récompense daily réclamée', vars: '{user} {amount} {streak}' },
  { key: 'work',     label: '💼 Work',             desc: 'Commande &work/&travail', vars: '{user} {amount} {job}' },
  { key: 'crime',    label: '🕵️ Crime',            desc: 'Commande &crime', vars: '{user} {amount} {outcome}' },
  { key: 'rob',      label: '🎭 Vol',              desc: 'Commande &rob', vars: '{user} {target} {amount} {outcome}' },
  { key: 'rep',      label: '❤️ Réputation',       desc: 'Point de réputation reçu', vars: '{user} {target} {rep}' },
  { key: 'birthday', label: '🎂 Anniversaire',     desc: 'Annonce d\'anniversaire', vars: '{user} {username} {age}' },
  { key: 'ban',      label: '🔨 Ban',              desc: 'Ban de modération', vars: '{user} {mod} {reason}' },
  { key: 'kick',     label: '👢 Kick',             desc: 'Kick de modération', vars: '{user} {mod} {reason}' },
  { key: 'mute',     label: '🔇 Mute',             desc: 'Mute/timeout', vars: '{user} {mod} {duration} {reason}' },
  { key: 'warn',     label: '⚠️ Avertissement',    desc: 'Warn reçu', vars: '{user} {mod} {reason} {count}' },
];

// ═══════════════════════════════════════════════════════════════
// SECTION : ÉDITEUR D'EMBED (templates réutilisables)
// ═══════════════════════════════════════════════════════════════
function buildEmbedsPanel(cfg, guild, userId, db) {
  const templates = db.getEmbedTemplates ? db.getEmbedTemplates(guild.id) : [];

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎨 Éditeur d\'embed')
    .setDescription(
      templates.length === 0
        ? '*Aucun template d\'embed pour l\'instant.*\n\nClique sur **➕ Nouveau** pour créer un embed entièrement personnalisé : titre, description, couleur, champs, image, miniature, footer, auteur…'
        : templates.slice(0, 15).map(t => `**${t.name}** — _${t.created_at ? new Date(t.created_at * 1000).toLocaleDateString('fr-FR') : '?'}_`).join('\n'),
    )
    .addFields({
      name: '💡 Variables supportées',
      value: '`{user}` `{username}` `{server}` `{channel}` `{count}` `{args}` `{arg1}` `{arg2}`…\n'
          +  'Disponibles dans le titre, la description, les fields et le footer.',
      inline: false,
    })
    .setFooter({ text: `${templates.length} template(s) — NexusBot — Éditeur d\'embed` });

  const newBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:new:${userId}`)
    .setLabel('➕ Nouveau')
    .setStyle(ButtonStyle.Success);

  const editBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:edit:${userId}`)
    .setLabel('✏️ Modifier')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(templates.length === 0);

  const sendBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:send:${userId}`)
    .setLabel('📤 Envoyer')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(templates.length === 0);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:del:${userId}`)
    .setLabel('🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(templates.length === 0);

  const rows = [new ActionRowBuilder().addComponents(backBtn(userId), newBtn, editBtn, sendBtn, delBtn)];

  if (templates.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`adv_sel:embeds_pick:${userId}`)
      .setPlaceholder('📄 Choisir un template à prévisualiser…')
      .addOptions(
        templates.slice(0, 25).map(t => ({
          label: truncate(t.name, 100),
          value: t.name,
          description: truncate((safeJsonParse(t.data_json, {})?.description) || 'Embed personnalisé', 100),
        })),
      );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  return { embeds: [embed], components: rows };
}

// Prévisualisation d'un template en mode lecture
function buildEmbedPreviewPanel(cfg, guild, userId, db, templateName) {
  const tpl = db.getEmbedTemplate(guild.id, templateName);
  if (!tpl) {
    const embed = new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Template introuvable')
      .setDescription(`Aucun template nommé \`${templateName}\`.`);
    return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId))] };
  }
  const data = safeJsonParse(tpl.data_json, {});
  const preview = rebuildEmbedFromData(data);

  const header = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`🎨 Prévisualisation — ${tpl.name}`)
    .setDescription('Voici à quoi ressemble ce template. Utilise les boutons ci-dessous pour le modifier, l\'envoyer ou le dupliquer.');

  const backList = new ButtonBuilder()
    .setCustomId(`adv:embeds:list:${userId}`)
    .setLabel('← Liste')
    .setStyle(ButtonStyle.Secondary);

  const editBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:edit_start:${userId}:${encodeURIComponent(tpl.name)}`)
    .setLabel('✏️ Modifier (rapide)')
    .setStyle(ButtonStyle.Primary);

  const fullBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:edit_full:${userId}:${encodeURIComponent(tpl.name)}`)
    .setLabel('🎨 Éditeur complet')
    .setStyle(ButtonStyle.Primary);

  const sendBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:send_start:${userId}:${encodeURIComponent(tpl.name)}`)
    .setLabel('📤 Envoyer vers un salon')
    .setStyle(ButtonStyle.Success);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:embeds:del_start:${userId}:${encodeURIComponent(tpl.name)}`)
    .setLabel('🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger);

  return {
    embeds: [header, preview],
    components: [new ActionRowBuilder().addComponents(backList, editBtn, fullBtn, sendBtn, delBtn)],
  };
}

// Reconstruit un EmbedBuilder depuis les données JSON du template
function rebuildEmbedFromData(data) {
  const eb = new EmbedBuilder();
  if (data.title)       eb.setTitle(truncate(data.title, 256));
  if (data.description) eb.setDescription(truncate(data.description, 4096));
  if (data.color && /^#?[0-9A-Fa-f]{6}$/.test(data.color)) eb.setColor(data.color.startsWith('#') ? data.color : '#' + data.color);
  if (data.url)         { try { eb.setURL(data.url); } catch {} }
  if (data.image)       { try { eb.setImage(data.image); } catch {} }
  if (data.thumbnail)   { try { eb.setThumbnail(data.thumbnail); } catch {} }
  if (data.footer_text) { eb.setFooter({ text: truncate(data.footer_text, 2048), iconURL: data.footer_icon || undefined }); }
  if (data.author_name) { eb.setAuthor({ name: truncate(data.author_name, 256), iconURL: data.author_icon || undefined, url: data.author_url || undefined }); }
  if (data.timestamp)   eb.setTimestamp();
  if (Array.isArray(data.fields)) {
    for (const f of data.fields.slice(0, 25)) {
      if (!f?.name || !f?.value) continue;
      eb.addFields({ name: truncate(f.name, 256), value: truncate(f.value, 1024), inline: !!f.inline });
    }
  }
  // Fallback si embed vide
  if (!data.title && !data.description && !(data.fields && data.fields.length)) {
    eb.setDescription('_Embed vide — ajoute au moins un titre ou une description._');
  }
  return eb;
}

// Applique les variables utilisateur à une chaîne
function applyVars(str, ctx) {
  if (!str) return str;
  return String(str)
    .replace(/\{user\}/g,     ctx.userMention || '')
    .replace(/\{username\}/g, ctx.username || '')
    .replace(/\{server\}/g,   ctx.serverName || '')
    .replace(/\{channel\}/g,  ctx.channelMention || '')
    .replace(/\{count\}/g,    String(ctx.memberCount ?? ''))
    .replace(/\{args\}/g,     ctx.args || '')
    .replace(/\{arg(\d+)\}/g, (_, i) => (ctx.argArray?.[parseInt(i, 10) - 1] ?? ''))
    .replace(/\{level\}/g,    String(ctx.level ?? ''))
    .replace(/\{xp\}/g,       String(ctx.xp ?? ''))
    .replace(/\{amount\}/g,   String(ctx.amount ?? ''))
    .replace(/\{target\}/g,   ctx.targetMention || '')
    .replace(/\{mod\}/g,      ctx.modMention || '')
    .replace(/\{reason\}/g,   ctx.reason || '')
    .replace(/\{duration\}/g, ctx.duration || '')
    .replace(/\{streak\}/g,   String(ctx.streak ?? ''))
    .replace(/\{job\}/g,      ctx.job || '')
    .replace(/\{outcome\}/g,  ctx.outcome || '')
    .replace(/\{rep\}/g,      String(ctx.rep ?? ''))
    .replace(/\{age\}/g,      String(ctx.age ?? ''));
}

// Applique les variables à toutes les chaînes d'un template
function applyVarsToTemplate(data, ctx) {
  const out = { ...data };
  if (out.title)       out.title       = applyVars(out.title, ctx);
  if (out.description) out.description = applyVars(out.description, ctx);
  if (out.footer_text) out.footer_text = applyVars(out.footer_text, ctx);
  if (out.author_name) out.author_name = applyVars(out.author_name, ctx);
  if (Array.isArray(out.fields)) {
    out.fields = out.fields.map(f => ({
      name: applyVars(f.name, ctx),
      value: applyVars(f.value, ctx),
      inline: !!f.inline,
    }));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// SECTION : COMMANDES CUSTOM AVANCÉES
// ═══════════════════════════════════════════════════════════════
function buildCmdsAdvPanel(cfg, guild, userId, db, page = 0) {
  const all     = db.getCustomCommands(guild.id);
  const perPage = 10;
  const maxPage = Math.max(0, Math.ceil(all.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = all.slice(p * perPage, p * perPage + perPage);

  const desc = slice.length === 0
    ? '*Aucune commande personnalisée.*\n\nClique sur **➕ Créer** pour ajouter une commande `&ma_commande` qui répond par du texte ou un embed complet.'
    : slice.map(c => {
        const typeIcon = c.response_type === 'embed' ? '🎨' : '💬';
        const status   = c.enabled === 0 ? '🚫' : '✅';
        const cd       = c.cooldown > 0 ? ` • ⏱️ ${c.cooldown}s` : '';
        const uses     = c.uses > 0 ? ` • 🔁 ${c.uses}` : '';
        return `${status} ${typeIcon} \`&${c.trigger}\`${cd}${uses}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('⚡ Commandes personnalisées')
    .setDescription(desc)
    .addFields(
      { name: '📊 Total',  value: `**${all.length}** commande(s)`, inline: true },
      { name: '📄 Page',   value: `**${p + 1}/${maxPage + 1}**`,    inline: true },
      { name: '🔤 Variables', value: '`{user}` `{username}` `{server}` `{args}` `{arg1}`…', inline: false },
    )
    .setFooter({ text: 'NexusBot — Commandes personnalisées' });

  const createBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:new:${userId}`)
    .setLabel('➕ Créer (texte)')
    .setStyle(ButtonStyle.Success);

  const createEmbedBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:new_embed:${userId}`)
    .setLabel('🎨 Créer (embed)')
    .setStyle(ButtonStyle.Success);

  const editBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:edit:${userId}`)
    .setLabel('✏️ Modifier')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(all.length === 0);

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:toggle:${userId}`)
    .setLabel('🔁 Activer / Désactiver')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(all.length === 0);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:del:${userId}`)
    .setLabel('🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(all.length === 0);

  const prevBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:page:${userId}:${Math.max(0, p - 1)}`)
    .setLabel('◀️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(p === 0);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:page:${userId}:${Math.min(maxPage, p + 1)}`)
    .setLabel('▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(p >= maxPage);

  const rows = [
    new ActionRowBuilder().addComponents(backBtn(userId), createBtn, createEmbedBtn),
    new ActionRowBuilder().addComponents(editBtn, toggleBtn, delBtn),
  ];

  if (all.length > perPage) {
    rows.push(new ActionRowBuilder().addComponents(prevBtn, nextBtn));
  }

  if (slice.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`adv_sel:cmds_pick:${userId}`)
      .setPlaceholder('🔎 Voir le détail d\'une commande…')
      .addOptions(
        slice.map(c => ({
          label: `&${truncate(c.trigger, 95)}`,
          value: c.trigger,
          description: truncate(c.response_type === 'embed' ? '(embed)' : c.response, 100),
        })),
      );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  return { embeds: [embed], components: rows };
}

// Détail d'une commande custom
function buildCmdDetailPanel(cfg, guild, userId, db, trigger) {
  const cmd = db.getCustomCommand(guild.id, trigger);
  if (!cmd) {
    return {
      embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Commande introuvable').setDescription(`Aucune commande \`&${trigger}\`.`)],
      components: [new ActionRowBuilder().addComponents(backBtn(userId))],
    };
  }

  const allowedChans = safeJsonParse(cmd.allowed_channels, []);
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`⚡ &${cmd.trigger}`)
    .addFields(
      { name: '📝 Type',      value: cmd.response_type === 'embed' ? '🎨 Embed' : '💬 Texte', inline: true },
      { name: '⚡ Statut',     value: onOff(cmd.enabled),                                     inline: true },
      { name: '⏱️ Cooldown',   value: cmd.cooldown > 0 ? `**${cmd.cooldown}**s` : '*Aucun*', inline: true },
      { name: '🎭 Rôle requis', value: cmd.required_role ? `<@&${cmd.required_role}>` : '*Aucun*', inline: true },
      { name: '🔒 Permission', value: cmd.required_perm || '*Aucune*',                        inline: true },
      { name: '🔁 Utilisations', value: String(cmd.uses || 0),                                inline: true },
      { name: '🗑️ Supprimer trigger', value: cmd.delete_trigger ? '✅ Oui' : '❌ Non',        inline: true },
      { name: '📣 Salons autorisés', value: allowedChans.length ? allowedChans.map(id => `<#${id}>`).join(', ') : '*Tous les salons*', inline: false },
    );

  if (cmd.response_type === 'embed' && cmd.embed_json) {
    const previewData = safeJsonParse(cmd.embed_json, {});
    const preview = rebuildEmbedFromData(previewData);
    return packDetail(userId, cmd, [embed, preview]);
  }

  embed.addFields({ name: '💬 Réponse', value: truncate(cmd.response, 1024) || '*(vide)*', inline: false });
  return packDetail(userId, cmd, [embed]);
}

function packDetail(userId, cmd, embeds) {
  const back = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:list:${userId}`)
    .setLabel('← Liste')
    .setStyle(ButtonStyle.Secondary);

  const editResp = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:edit_resp:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel('✏️ Modifier la réponse')
    .setStyle(ButtonStyle.Primary);

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:toggle_one:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel(cmd.enabled ? '⏸️ Désactiver' : '▶️ Activer')
    .setStyle(cmd.enabled ? ButtonStyle.Secondary : ButtonStyle.Success);

  const cdBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:set_cd:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel('⏱️ Cooldown')
    .setStyle(ButtonStyle.Secondary);

  const roleBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:set_role:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel('🎭 Rôle requis')
    .setStyle(ButtonStyle.Secondary);

  const chansBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:set_chans:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel('📣 Salons autorisés')
    .setStyle(ButtonStyle.Secondary);

  const delTrigBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:toggle_del:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel(cmd.delete_trigger ? '🗑️ Ne plus supprimer' : '🗑️ Supprimer trigger')
    .setStyle(ButtonStyle.Secondary);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:cmds_adv:del_one:${userId}:${encodeURIComponent(cmd.trigger)}`)
    .setLabel('💥 Supprimer cette commande')
    .setStyle(ButtonStyle.Danger);

  return {
    embeds,
    components: [
      new ActionRowBuilder().addComponents(back, editResp, toggleBtn),
      new ActionRowBuilder().addComponents(cdBtn, roleBtn, chansBtn, delTrigBtn),
      new ActionRowBuilder().addComponents(delBtn),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : MESSAGES SYSTÈME
// ═══════════════════════════════════════════════════════════════
function buildSysMsgsPanel(cfg, guild, userId, db) {
  const msgs = new Map();
  for (const m of (db.getSystemMessages(guild.id) || [])) msgs.set(m.event, m);

  const lines = SYSTEM_EVENTS.map(e => {
    const m = msgs.get(e.key);
    const on  = m?.enabled ?? 1;
    const mode = m?.mode || 'text';
    const modeIcon = mode === 'embed' ? '🎨' : mode === 'both' ? '🎨+💬' : '💬';
    const hasCustom = m && (m.content || m.embed_json);
    return `${on ? '✅' : '❌'} ${modeIcon} ${e.label}${hasCustom ? '' : ' _(par défaut)_'}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('📢 Messages système')
    .setDescription(
      'Personnalise le message envoyé par le bot pour chaque événement (texte ou embed complet).\n\n' +
      lines,
    )
    .setFooter({ text: 'NexusBot — Messages système' });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`adv_sel:sys_pick:${userId}`)
    .setPlaceholder('📝 Choisir un événement à configurer…')
    .addOptions(
      SYSTEM_EVENTS.map(e => ({
        label: e.label.replace(/^[^\w]+/, '').trim() || e.label,
        value: e.key,
        description: truncate(e.desc, 100),
        emoji: (e.label.match(/^\p{Emoji}/u) || [undefined])[0],
      })),
    );

  const newCustomBtn = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:new_custom:${userId}`)
    .setLabel('➕ Nouvel événement custom')
    .setStyle(ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), newCustomBtn),
      new ActionRowBuilder().addComponents(select),
    ],
  };
}

function buildSysMsgDetailPanel(cfg, guild, userId, db, eventKey) {
  const def = SYSTEM_EVENTS.find(e => e.key === eventKey);
  if (!def) return buildSysMsgsPanel(cfg, guild, userId, db);
  const m = db.getSystemMessage(guild.id, eventKey);

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`${def.label} — Configuration`)
    .setDescription(def.desc)
    .addFields(
      { name: '⚡ Statut', value: onOff(m?.enabled ?? 1), inline: true },
      { name: '🎨 Mode',   value: m?.mode === 'embed' ? 'Embed' : m?.mode === 'both' ? 'Texte + Embed' : 'Texte', inline: true },
      { name: '📣 Salon',  value: m?.channel_id ? `<#${m.channel_id}>` : '*Salon par défaut de la catégorie*', inline: true },
      { name: '💬 Texte',  value: m?.content ? `\`\`\`${truncate(m.content, 900)}\`\`\`` : '*Texte par défaut*', inline: false },
      { name: '🔤 Variables', value: `\`${def.vars}\``, inline: false },
    );

  const rows = [];

  const back = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:list:${userId}`)
    .setLabel('← Liste')
    .setStyle(ButtonStyle.Secondary);

  const toggle = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:toggle:${userId}:${eventKey}`)
    .setLabel((m?.enabled ?? 1) ? '⏸️ Désactiver' : '▶️ Activer')
    .setStyle((m?.enabled ?? 1) ? ButtonStyle.Secondary : ButtonStyle.Success);

  const editText = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:edit_text:${userId}:${eventKey}`)
    .setLabel('💬 Modifier le texte')
    .setStyle(ButtonStyle.Primary);

  const editEmbed = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:edit_embed:${userId}:${eventKey}`)
    .setLabel('🎨 Éditer l\'embed (JSON)')
    .setStyle(ButtonStyle.Primary);

  const modeBtn = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:set_mode:${userId}:${eventKey}`)
    .setLabel('🎛️ Mode (texte/embed/both)')
    .setStyle(ButtonStyle.Secondary);

  const resetBtn = new ButtonBuilder()
    .setCustomId(`adv:sys_msgs:reset:${userId}:${eventKey}`)
    .setLabel('↩️ Réinitialiser')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`adv_chan:sys_msgs:${userId}:${eventKey}`)
    .setPlaceholder(`📣 Salon pour les messages "${def.label}" (laisser vide = par défaut)`)
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  rows.push(new ActionRowBuilder().addComponents(back, toggle, modeBtn, resetBtn));
  rows.push(new ActionRowBuilder().addComponents(editText, editEmbed));
  rows.push(new ActionRowBuilder().addComponents(chanSelect));

  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : COOLDOWNS & TOGGLES PAR COMMANDE
// ═══════════════════════════════════════════════════════════════
function buildCmdCtrlPanel(cfg, guild, userId, db, client, page = 0) {
  // Liste unifiée : commandes slash + préfixe
  const slashNames  = client?.commands ? [...client.commands.keys()] : [];
  const prefixNames = [];
  try {
    const { prefixCommands } = require('./prefixHandler');
    if (prefixCommands) for (const k of prefixCommands.keys()) prefixNames.push(k);
  } catch {}
  const all = [...new Set([...slashNames, ...prefixNames])].sort();

  const toggles = new Map();
  for (const t of db.getCommandToggles(guild.id)) toggles.set(t.command, t);
  const cds = new Map();
  for (const c of db.getCooldownOverrides(guild.id)) cds.set(c.command, c);

  const perPage = 10;
  const maxPage = Math.max(0, Math.ceil(all.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = all.slice(p * perPage, p * perPage + perPage);

  const lines = slice.map(name => {
    const t = toggles.get(name);
    const cd = cds.get(name);
    const status = (t && t.enabled === 0) ? '🚫' : '✅';
    const cdText = cd ? ` • ⏱️ ${cd.seconds}s` : '';
    return `${status} \`${name}\`${cdText}`;
  }).join('\n') || '*Aucune commande détectée.*';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🛠️ Cooldowns & activation par commande')
    .setDescription(lines)
    .addFields(
      { name: '📊 Commandes détectées', value: `**${all.length}** (slash + préfixe)`, inline: true },
      { name: '📄 Page',                value: `**${p + 1}/${maxPage + 1}**`,         inline: true },
    )
    .setFooter({ text: 'NexusBot — Cooldowns & toggles' });

  const prev = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:page:${userId}:${Math.max(0, p - 1)}`)
    .setLabel('◀️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(p === 0);

  const next = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:page:${userId}:${Math.min(maxPage, p + 1)}`)
    .setLabel('▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(p >= maxPage);

  const rows = [new ActionRowBuilder().addComponents(backBtn(userId), prev, next)];

  if (slice.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`adv_sel:cmd_ctrl_pick:${userId}`)
      .setPlaceholder('⚙️ Configurer une commande…')
      .addOptions(
        slice.map(name => ({
          label: truncate(name, 100),
          value: name,
          description: ((toggles.get(name)?.enabled === 0) ? '🚫 désactivée' : '✅ active') + (cds.get(name) ? ` • ⏱️ ${cds.get(name).seconds}s` : ''),
        })),
      );
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  return { embeds: [embed], components: rows };
}

function buildCmdCtrlDetailPanel(cfg, guild, userId, db, commandName) {
  const enabled = db.isCommandEnabled(guild.id, commandName);
  const cd      = db.getCooldownOverride(guild.id, commandName);

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`🛠️ ${commandName}`)
    .addFields(
      { name: '⚡ Statut',            value: onOff(enabled),                                              inline: true },
      { name: '⏱️ Cooldown override', value: cd != null ? `**${cd}**s` : '*Aucun (cooldown de la commande)*', inline: true },
    )
    .setFooter({ text: 'NexusBot — Cooldowns & toggles' });

  const back = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:list:${userId}`)
    .setLabel('← Liste')
    .setStyle(ButtonStyle.Secondary);

  const toggle = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:toggle:${userId}:${encodeURIComponent(commandName)}`)
    .setLabel(enabled ? '⏸️ Désactiver' : '▶️ Activer')
    .setStyle(enabled ? ButtonStyle.Secondary : ButtonStyle.Success);

  const cdBtn = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:set_cd:${userId}:${encodeURIComponent(commandName)}`)
    .setLabel('⏱️ Définir cooldown')
    .setStyle(ButtonStyle.Primary);

  const resetCd = new ButtonBuilder()
    .setCustomId(`adv:cmd_ctrl:reset_cd:${userId}:${encodeURIComponent(commandName)}`)
    .setLabel('↩️ Cooldown par défaut')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(cd == null);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(back, toggle, cdBtn, resetCd)],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : ALIASES
// ═══════════════════════════════════════════════════════════════
function buildAliasesPanel(cfg, guild, userId, db) {
  const all = db.getAliases(guild.id);
  const desc = all.length === 0
    ? '*Aucun alias.*\n\nUn alias permet d\'invoquer une commande par un autre nom.\nEx: `&r` → `&role` : taper `&r` exécute la commande `&role`.'
    : all.slice(0, 25).map(a => `\`&${a.alias}\` → \`&${a.target}\``).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔀 Aliases de commandes')
    .setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}** alias`, inline: true })
    .setFooter({ text: 'NexusBot — Aliases' });

  const addBtn = new ButtonBuilder()
    .setCustomId(`adv:aliases:new:${userId}`)
    .setLabel('➕ Ajouter')
    .setStyle(ButtonStyle.Success);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:aliases:del:${userId}`)
    .setLabel('🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(all.length === 0);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : ÉDITEUR D'EMBED COMPLET (mode avancé)
// Ouvert depuis un template : affiche la prévisualisation + TOUS les boutons
// pour éditer chaque partie (titre, desc, couleur, footer, image, thumbnail,
// auteur, URL, timestamp, fields add/remove).
// ═══════════════════════════════════════════════════════════════
function buildEmbedEditorFull(cfg, guild, userId, db, templateName) {
  const tpl = db.getEmbedTemplate(guild.id, templateName);
  if (!tpl) {
    return {
      embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('❌ Template introuvable')],
      components: [new ActionRowBuilder().addComponents(backBtn(userId))],
    };
  }
  const data = safeJsonParse(tpl.data_json, {});
  const preview = rebuildEmbedFromData(data);

  const header = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`🎨 Éditeur complet — ${tpl.name}`)
    .setDescription(
      'Modifie chaque partie de l\'embed via les boutons ci-dessous. La prévisualisation se met à jour en direct.\n\n' +
      `• **Fields** : ${Array.isArray(data.fields) ? data.fields.length : 0} / 25\n` +
      `• **Image** : ${data.image ? '✅' : '—'}\n` +
      `• **Thumbnail** : ${data.thumbnail ? '✅' : '—'}\n` +
      `• **Auteur** : ${data.author_name ? '✅ ' + truncate(data.author_name, 40) : '—'}\n` +
      `• **Timestamp** : ${data.timestamp ? '✅' : '—'}`,
    );

  const id = encodeURIComponent(tpl.name);

  const back = new ButtonBuilder()
    .setCustomId(`adv:embeds:preview:${userId}:${id}`)
    .setLabel('← Aperçu')
    .setStyle(ButtonStyle.Secondary);

  const titleBtn = new ButtonBuilder().setCustomId(`adv:embeds:set_title:${userId}:${id}`).setLabel('📝 Titre').setStyle(ButtonStyle.Primary);
  const descBtn  = new ButtonBuilder().setCustomId(`adv:embeds:set_desc:${userId}:${id}`).setLabel('📄 Description').setStyle(ButtonStyle.Primary);
  const colorBtn = new ButtonBuilder().setCustomId(`adv:embeds:set_color:${userId}:${id}`).setLabel('🎨 Couleur').setStyle(ButtonStyle.Primary);
  const urlBtn   = new ButtonBuilder().setCustomId(`adv:embeds:set_url:${userId}:${id}`).setLabel('🔗 URL du titre').setStyle(ButtonStyle.Primary);

  const imgBtn    = new ButtonBuilder().setCustomId(`adv:embeds:set_image:${userId}:${id}`).setLabel('🖼️ Image').setStyle(ButtonStyle.Primary);
  const thumbBtn  = new ButtonBuilder().setCustomId(`adv:embeds:set_thumb:${userId}:${id}`).setLabel('🔳 Thumbnail').setStyle(ButtonStyle.Primary);
  const authorBtn = new ButtonBuilder().setCustomId(`adv:embeds:set_author:${userId}:${id}`).setLabel('👤 Auteur').setStyle(ButtonStyle.Primary);
  const footerBtn = new ButtonBuilder().setCustomId(`adv:embeds:set_footer:${userId}:${id}`).setLabel('👣 Footer').setStyle(ButtonStyle.Primary);

  const addFieldBtn = new ButtonBuilder().setCustomId(`adv:embeds:add_field:${userId}:${id}`).setLabel('➕ Ajouter un field').setStyle(ButtonStyle.Success).setDisabled((data.fields?.length ?? 0) >= 25);
  const rmFieldBtn  = new ButtonBuilder().setCustomId(`adv:embeds:rm_field:${userId}:${id}`).setLabel('➖ Retirer un field').setStyle(ButtonStyle.Danger).setDisabled(!(data.fields?.length));
  const tsBtn       = new ButtonBuilder().setCustomId(`adv:embeds:toggle_ts:${userId}:${id}`).setLabel(data.timestamp ? '🕑 Désact. timestamp' : '🕑 Activer timestamp').setStyle(ButtonStyle.Secondary);
  const resetBtn    = new ButtonBuilder().setCustomId(`adv:embeds:reset:${userId}:${id}`).setLabel('↩️ Réinitialiser').setStyle(ButtonStyle.Danger);

  return {
    embeds: [header, preview],
    components: [
      new ActionRowBuilder().addComponents(back, titleBtn, descBtn, colorBtn, urlBtn),
      new ActionRowBuilder().addComponents(imgBtn, thumbBtn, authorBtn, footerBtn),
      new ActionRowBuilder().addComponents(addFieldBtn, rmFieldBtn, tsBtn, resetBtn),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : AUTORESPONDER
// ═══════════════════════════════════════════════════════════════
function buildAutorespPanel(cfg, guild, userId, db, page = 0) {
  const all     = db.getAutoresponders ? db.getAutoresponders(guild.id) : [];
  const perPage = 10;
  const maxPage = Math.max(0, Math.ceil(all.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = all.slice(p * perPage, p * perPage + perPage);

  const lines = slice.length === 0
    ? '*Aucune réponse automatique.*\n\nLe bot peut répondre automatiquement quand un message contient (ou est exactement) un certain mot-clé.\nExemple : trigger `bonjour` → répond "Salut {user} !"'
    : slice.map(a => {
        const match = a.exact_match ? '🎯 exact' : '🔎 contient';
        const cd    = a.cooldown > 0 ? ` • ⏱️ ${a.cooldown}s` : '';
        const uses  = a.uses > 0 ? ` • 🔁 ${a.uses}` : '';
        return `${match} \`${truncate(a.trigger, 30)}\` → ${truncate(a.response, 50)}${cd}${uses}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔁 Réponses automatiques')
    .setDescription(lines)
    .addFields(
      { name: '📊 Total', value: `**${all.length}** réponse(s)`, inline: true },
      { name: '📄 Page',  value: `**${p + 1}/${maxPage + 1}**`,    inline: true },
    )
    .setFooter({ text: 'NexusBot — Autoresponder' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:autoresp:new:${userId}`).setLabel('➕ Ajouter').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:autoresp:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  const prev   = new ButtonBuilder().setCustomId(`adv:autoresp:page:${userId}:${Math.max(0, p - 1)}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0);
  const next   = new ButtonBuilder().setCustomId(`adv:autoresp:page:${userId}:${Math.min(maxPage, p + 1)}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= maxPage);

  const rows = [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)];
  if (all.length > perPage) rows.push(new ActionRowBuilder().addComponents(prev, next));

  if (slice.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`adv_sel:autoresp_pick:${userId}`)
      .setPlaceholder('🔎 Voir le détail d\'un autoresponder…')
      .addOptions(
        slice.map(a => ({
          label: truncate(a.trigger, 100),
          value: a.trigger,
          description: truncate(a.response || '(embed)', 100),
        })),
      );
    rows.push(new ActionRowBuilder().addComponents(select));
  }
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : RÔLES PAR NIVEAU
// ═══════════════════════════════════════════════════════════════
function buildLevelRolesPanel(cfg, guild, userId, db) {
  const all = db.getLevelRoles ? db.getLevelRoles(guild.id) : [];

  const desc = all.length === 0
    ? '*Aucun rôle par niveau.*\n\nDéfinis un rôle à attribuer automatiquement quand un membre atteint un certain niveau.\nExemple : niveau **5** → rôle **Confirmé**'
    : all.map(r => `**Niveau ${r.level}** → <@&${r.role_id}>`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🏆 Rôles par niveau')
    .setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}** rôle(s) configuré(s)`, inline: true })
    .setFooter({ text: 'NexusBot — Level Roles' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:level_roles:new:${userId}`).setLabel('➕ Ajouter').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:level_roles:del:${userId}`).setLabel('🗑️ Retirer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : SAUVEGARDE & IMPORT
// ═══════════════════════════════════════════════════════════════
function buildBackupPanel(cfg, guild, userId, db) {
  const stats = {
    custom_commands: db.getCustomCommands(guild.id).length,
    aliases:         db.getAliases(guild.id).length,
    templates:       db.getEmbedTemplates(guild.id).length,
    sys_msgs:        (db.getSystemMessages(guild.id) || []).length,
    autoresp:        (db.getAutoresponders ? db.getAutoresponders(guild.id) : []).length,
    level_roles:     (db.getLevelRoles ? db.getLevelRoles(guild.id) : []).length,
    cooldowns:       db.getCooldownOverrides(guild.id).length,
    toggles:         db.getCommandToggles(guild.id).length,
  };

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('💾 Sauvegarde & Import')
    .setDescription(
      'Exporte toute ta configuration serveur dans un fichier JSON que tu pourras ré-importer plus tard ou sur un autre serveur NexusBot.\n\n' +
      '**⚠️ L\'import ÉCRASE toutes les données des tables listées pour ce serveur.**',
    )
    .addFields(
      { name: '📊 Contenu actuel', value:
        `• ⚡ Commandes custom : **${stats.custom_commands}**\n` +
        `• 🔀 Aliases : **${stats.aliases}**\n` +
        `• 🎨 Templates embed : **${stats.templates}**\n` +
        `• 📢 Messages système : **${stats.sys_msgs}**\n` +
        `• 🔁 Autoresponders : **${stats.autoresp}**\n` +
        `• 🏆 Rôles par niveau : **${stats.level_roles}**\n` +
        `• ⏱️ Cooldowns : **${stats.cooldowns}**\n` +
        `• 🚫 Toggles : **${stats.toggles}**`,
        inline: false },
    )
    .setFooter({ text: 'NexusBot — Sauvegarde' });

  const exportBtn = new ButtonBuilder().setCustomId(`adv:backup:export:${userId}`).setLabel('📤 Exporter (JSON)').setStyle(ButtonStyle.Success);
  const importBtn = new ButtonBuilder().setCustomId(`adv:backup:import:${userId}`).setLabel('📥 Importer (coller JSON)').setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(backBtn(userId), exportBtn, importBtn)],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🗄️ ÉDITEUR LIBRE (KV + guild_config arbitraire)
// Permet de lire/créer/modifier/supprimer N'IMPORTE QUELLE clé.
// ═══════════════════════════════════════════════════════════════
function buildKvPanel(cfg, guild, userId, db, page = 0, source = 'kv') {
  // source: 'kv' (table guild_kv) ou 'gc' (colonnes guild_config)
  let entries = [];
  if (source === 'gc') {
    const gc = db.getConfig(guild.id) || {};
    const cols = db.listGuildConfigColumns ? db.listGuildConfigColumns() : [];
    entries = cols
      .filter(c => c.name !== 'guild_id')
      .map(c => ({ key: c.name, value: gc[c.name], type: c.type }));
  } else {
    const rows = db.kvList ? db.kvList(guild.id) : [];
    entries = rows.map(r => ({ key: r.key, value: r.value }));
  }

  const perPage = 15;
  const maxPage = Math.max(0, Math.ceil(entries.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = entries.slice(p * perPage, p * perPage + perPage);

  const lines = slice.length === 0
    ? '*Aucune clé pour l\'instant.*'
    : slice.map(e => {
        const v = e.value === null || e.value === undefined
          ? '*(null)*'
          : typeof e.value === 'object'
              ? truncate(JSON.stringify(e.value), 60)
              : truncate(String(e.value), 60);
        return `\`${truncate(e.key, 28)}\` = ${v}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🗄️ Éditeur libre')
    .setDescription(
      `Modifie **N'IMPORTE QUELLE** clé de configuration — aucun champ n'est verrouillé.\n\n` +
      `**Source actuelle :** ${source === 'gc' ? '⚙️ Colonnes `guild_config` (typées)' : '📦 Clés libres `guild_kv` (JSON)'}\n\n` +
      lines,
    )
    .addFields(
      { name: '📊 Total',  value: `**${entries.length}** clé(s)`, inline: true },
      { name: '📄 Page',   value: `**${p + 1}/${maxPage + 1}**`,    inline: true },
    )
    .setFooter({ text: source === 'gc' ? 'Colonnes typées — attention aux types' : 'Clés libres — JSON accepté' });

  const back = backBtn(userId);

  const switchBtn = new ButtonBuilder()
    .setCustomId(`adv:kv:switch:${userId}:${source === 'gc' ? 'kv' : 'gc'}`)
    .setLabel(source === 'gc' ? '📦 Voir KV libre' : '⚙️ Voir guild_config')
    .setStyle(ButtonStyle.Secondary);

  const viewBtn = new ButtonBuilder()
    .setCustomId(`adv:kv:view:${userId}:${source}`)
    .setLabel('🔍 Voir une clé')
    .setStyle(ButtonStyle.Primary);

  const setBtn = new ButtonBuilder()
    .setCustomId(`adv:kv:set:${userId}:${source}`)
    .setLabel(source === 'gc' ? '✏️ Modifier une colonne' : '➕ Créer/Modifier')
    .setStyle(ButtonStyle.Success);

  const delBtn = new ButtonBuilder()
    .setCustomId(`adv:kv:del:${userId}:${source}`)
    .setLabel(source === 'gc' ? '↩️ Mettre NULL' : '🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger);

  const prev = new ButtonBuilder().setCustomId(`adv:kv:page:${userId}:${source}:${Math.max(0, p - 1)}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0);
  const next = new ButtonBuilder().setCustomId(`adv:kv:page:${userId}:${source}:${Math.min(maxPage, p + 1)}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= maxPage);

  const rows = [
    new ActionRowBuilder().addComponents(back, switchBtn, viewBtn),
    new ActionRowBuilder().addComponents(setBtn, delBtn),
  ];
  if (entries.length > perPage) rows.push(new ActionRowBuilder().addComponents(prev, next));

  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🛒 BOUTIQUE
// ═══════════════════════════════════════════════════════════════
function buildShopPanel(cfg, guild, userId, db, page = 0) {
  const items = db.getShopItems ? db.getShopItems(guild.id) : [];
  const coin = cfg.currency_emoji || '€';
  const perPage = 10;
  const maxPage = Math.max(0, Math.ceil(items.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = items.slice(p * perPage, p * perPage + perPage);

  const lines = slice.length === 0
    ? '*Aucun item dans la boutique.*\n\nClique sur **➕ Créer** pour ajouter un item achetable.'
    : slice.map(it => {
        const stockTxt = it.stock === -1 ? '∞' : `${it.stock}`;
        const roleTxt  = it.role_id ? ` • 🎭 <@&${it.role_id}>` : '';
        const active   = it.active === 0 ? '🚫' : '✅';
        return `${active} **#${it.id}** ${it.emoji || '📦'} **${truncate(it.name, 40)}** — ${it.price} ${coin} • Stock: ${stockTxt}${roleTxt}`;
      }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🛒 Boutique')
    .setDescription(lines)
    .addFields(
      { name: '📊 Items', value: `**${items.length}**`,                inline: true },
      { name: '📄 Page',  value: `**${p + 1}/${maxPage + 1}**`,         inline: true },
    )
    .setFooter({ text: 'NexusBot — Boutique' });

  const createBtn = new ButtonBuilder().setCustomId(`adv:shop:new:${userId}`).setLabel('➕ Créer').setStyle(ButtonStyle.Success);
  const editBtn   = new ButtonBuilder().setCustomId(`adv:shop:edit:${userId}`).setLabel('✏️ Modifier').setStyle(ButtonStyle.Primary).setDisabled(items.length === 0);
  const toggleBtn = new ButtonBuilder().setCustomId(`adv:shop:toggle:${userId}`).setLabel('🔁 Activer/Désact.').setStyle(ButtonStyle.Secondary).setDisabled(items.length === 0);
  const delBtn    = new ButtonBuilder().setCustomId(`adv:shop:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(items.length === 0);

  const prev = new ButtonBuilder().setCustomId(`adv:shop:page:${userId}:${Math.max(0, p - 1)}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0);
  const next = new ButtonBuilder().setCustomId(`adv:shop:page:${userId}:${Math.min(maxPage, p + 1)}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= maxPage);

  const rows = [
    new ActionRowBuilder().addComponents(backBtn(userId), createBtn, editBtn, toggleBtn, delBtn),
  ];
  if (items.length > perPage) rows.push(new ActionRowBuilder().addComponents(prev, next));
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : ⭐ REACTION ROLES
// ═══════════════════════════════════════════════════════════════
function buildReactionRolesPanel(cfg, guild, userId, db) {
  const all = db.getReactionRoles ? db.getReactionRoles(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucun reaction role.*\n\nUn reaction role attribue un rôle quand un membre réagit avec un emoji sur un message donné.'
    : all.slice(0, 20).map(r => `**#${r.id}** ${r.emoji} → <@&${r.role_id}> (msg \`${r.message_id}\`)`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('⭐ Reaction roles')
    .setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Reaction roles' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:reaction_roles:new:${userId}`).setLabel('➕ Ajouter').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:reaction_roles:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📜 ROLE MENUS (panneaux interactifs)
// ═══════════════════════════════════════════════════════════════
function buildRoleMenusPanel(cfg, guild, userId, db) {
  const all = db.getRoleMenus ? db.getRoleMenus(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucun menu de rôles.*\n\nUn menu de rôles est un message avec des boutons pour permettre aux membres de s\'auto-attribuer des rôles.'
    : all.slice(0, 10).map(m => `**#${m.id}** ${truncate(m.title, 40)} — ${safeJsonParse(m.roles, []).length} rôle(s)`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('📜 Menus de rôles')
    .setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Role menus' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:role_menus:new:${userId}`).setLabel('➕ Créer').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:role_menus:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// DÉTAIL ENRICHI AUTORESPONDER
// ═══════════════════════════════════════════════════════════════
function buildAutorespDetailPanel(cfg, guild, userId, db, trigger) {
  const a = db.getAutoresponder(guild.id, trigger);
  if (!a) return buildAutorespPanel(cfg, guild, userId, db, 0);

  const allowedChans = safeJsonParse(a.allowed_channels, []);
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`🔁 ${a.trigger}`)
    .addFields(
      { name: '⚡ Statut',      value: onOff(a.enabled ?? 1),                             inline: true },
      { name: '🎯 Match',       value: a.exact_match ? 'exact' : 'contient',              inline: true },
      { name: '⏱️ Cooldown',    value: a.cooldown > 0 ? `**${a.cooldown}**s` : '*Aucun*', inline: true },
      { name: '📝 Type',        value: a.response_type === 'embed' ? '🎨 Embed' : '💬 Texte', inline: true },
      { name: '🎭 Rôle requis',  value: a.required_role ? `<@&${a.required_role}>` : '*Aucun*', inline: true },
      { name: '🔁 Utilisations', value: String(a.uses ?? 0),                              inline: true },
      { name: '📣 Salons autorisés', value: allowedChans.length ? allowedChans.map(id => `<#${id}>`).join(', ') : '*Tous les salons*', inline: false },
    );
  if (a.response_type === 'embed' && a.embed_json) {
    const data = safeJsonParse(a.embed_json, {});
    const preview = rebuildEmbedFromData(data);
    return _packAutoresp(userId, a, [embed, preview]);
  }
  embed.addFields({ name: '💬 Réponse', value: truncate(a.response, 1024) || '*(vide)*', inline: false });
  return _packAutoresp(userId, a, [embed]);
}

function _packAutoresp(userId, a, embeds) {
  const id = encodeURIComponent(a.trigger);
  return {
    embeds,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adv:autoresp:list:${userId}`).setLabel('← Liste').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`adv:autoresp:edit_resp:${userId}:${id}`).setLabel('✏️ Modifier réponse').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`adv:autoresp:toggle_one:${userId}:${id}`).setLabel((a.enabled ?? 1) ? '⏸️ Désactiver' : '▶️ Activer').setStyle((a.enabled ?? 1) ? ButtonStyle.Secondary : ButtonStyle.Success),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adv:autoresp:set_cd:${userId}:${id}`).setLabel('⏱️ Cooldown').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`adv:autoresp:set_role:${userId}:${id}`).setLabel('🎭 Rôle requis').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`adv:autoresp:set_chans:${userId}:${id}`).setLabel('📣 Salons autorisés').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`adv:autoresp:toggle_match:${userId}:${id}`).setLabel(a.exact_match ? '🔎 Match exact → contient' : '🎯 Contient → exact').setStyle(ButtonStyle.Secondary),
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`adv:autoresp:del_one:${userId}:${id}`).setLabel('💥 Supprimer').setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🧠 IA
// ═══════════════════════════════════════════════════════════════
function _getAiModule() {
  try { return require('./aiService'); } catch { return null; }
}

function buildAIPanel(cfg, guild, userId, db) {
  const aiMod = _getAiModule();
  const aiCfg = aiMod ? aiMod.getAIConfig(guild.id, db) : null;
  const hasKeyAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasKeyOpenAI    = !!process.env.OPENAI_API_KEY;

  const providerShown = aiCfg?.provider === 'auto'
    ? (hasKeyAnthropic ? 'auto → anthropic' : hasKeyOpenAI ? 'auto → openai' : 'auto (aucune clé)')
    : (aiCfg?.provider || 'auto');

  const status = aiCfg?.enabled ? '✅ Activé' : '❌ Désactivé';
  const keyStatus = (hasKeyAnthropic || hasKeyOpenAI)
    ? `✅ ${hasKeyAnthropic ? 'Anthropic' : ''}${hasKeyAnthropic && hasKeyOpenAI ? ' + ' : ''}${hasKeyOpenAI ? 'OpenAI' : ''}`
    : '❌ Aucune clé API (ajoute `ANTHROPIC_API_KEY` ou `OPENAI_API_KEY` sur Railway)';

  const allowedCh = Array.isArray(aiCfg?.allowed_channels) ? aiCfg.allowed_channels : [];

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🧠 Intelligence Artificielle')
    .setDescription(
      'Active l\'IA pour que NexusBot réponde aux questions, résume les conversations, traduise, et réponde quand il est mentionné.\n\n' +
      '**Comment ça marche :**\n' +
      '• `&ia <question>` ou `/ia <question>` → réponse intelligente\n' +
      '• `&resume [N]` ou `/resume` → résumé des N derniers messages\n' +
      '• `&traduis <langue> <texte>` ou `/traduis` → traduction\n' +
      '• @NexusBot <question> (si activé ci-dessous) → réponse directe',
    )
    .addFields(
      { name: '⚡ Statut',             value: status,                                 inline: true },
      { name: '🔑 Clés API détectées',  value: keyStatus,                             inline: true },
      { name: '🛰️ Provider',           value: `\`${providerShown}\``,                inline: true },
      { name: '🤖 Modèle',              value: `\`${aiCfg?.model || '—'}\``,          inline: true },
      { name: '📏 Max tokens',          value: `\`${aiCfg?.max_tokens ?? 512}\``,     inline: true },
      { name: '💬 Mention = question',  value: aiCfg?.mention_reply ? '✅ Oui' : '❌ Non', inline: true },
      { name: '🎭 Rôle requis',         value: aiCfg?.required_role ? `<@&${aiCfg.required_role}>` : '*Aucun (tout le monde)*', inline: true },
      { name: '📣 Salons autorisés',    value: allowedCh.length ? allowedCh.map(id => `<#${id}>`).join(', ') : '*Tous les salons*', inline: false },
    )
    .setFooter({ text: 'NexusBot — IA' });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:toggle:${userId}`)
    .setLabel(aiCfg?.enabled ? '⏸️ Désactiver l\'IA' : '▶️ Activer l\'IA')
    .setStyle(aiCfg?.enabled ? ButtonStyle.Secondary : ButtonStyle.Success);

  const toggleMention = new ButtonBuilder()
    .setCustomId(`adv:ai:toggle_mention:${userId}`)
    .setLabel(aiCfg?.mention_reply ? '🙊 Ne plus répondre aux mentions' : '💬 Répondre aux mentions')
    .setStyle(aiCfg?.mention_reply ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const providerBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:cycle_provider:${userId}`)
    .setLabel('🛰️ Changer provider')
    .setStyle(ButtonStyle.Primary);

  const modelBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:set_model:${userId}`)
    .setLabel('🤖 Modifier modèle')
    .setStyle(ButtonStyle.Primary);

  const tokensBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:set_tokens:${userId}`)
    .setLabel('📏 Max tokens')
    .setStyle(ButtonStyle.Primary);

  const promptBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:set_prompt:${userId}`)
    .setLabel('🎭 Personnalité (system)')
    .setStyle(ButtonStyle.Primary);

  const testBtn = new ButtonBuilder()
    .setCustomId(`adv:ai:test:${userId}`)
    .setLabel('🧪 Tester l\'IA')
    .setStyle(ButtonStyle.Success);

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`adv_role:ai_required:${userId}`)
    .setPlaceholder('🎭 Rôle requis pour utiliser l\'IA (vide = tout le monde)')
    .setMinValues(0).setMaxValues(1);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`adv_chan:ai_channels:${userId}`)
    .setPlaceholder(`📣 Salons autorisés (vide = tous) — actuellement ${allowedCh.length}`)
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0).setMaxValues(25);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn, toggleMention),
      new ActionRowBuilder().addComponents(providerBtn, modelBtn, tokensBtn, promptBtn, testBtn),
      new ActionRowBuilder().addComponents(roleSelect),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🗣️ TEXTES & LIBELLÉS (personnalisation UI par serveur)
// ═══════════════════════════════════════════════════════════════
function buildUiTextsPanel(cfg, guild, userId, db, page = 0) {
  const i18n = (() => { try { return require('./i18n'); } catch { return null; } })();
  const catalogue = i18n ? i18n.CATALOGUE : [];
  const overrides = new Map();
  if (i18n) for (const r of i18n.listTexts(guild.id, db)) overrides.set(r.key, r.value);

  const perPage = 15;
  const maxPage = Math.max(0, Math.ceil(catalogue.length / perPage) - 1);
  const p       = Math.min(Math.max(0, page), maxPage);
  const slice   = catalogue.slice(p * perPage, p * perPage + perPage);

  const lines = slice.map(e => {
    const cur = overrides.get(e.key);
    const mark = cur != null ? '✏️' : '⚪';
    const val  = cur != null ? cur : e.default;
    return `${mark} \`${e.key}\` = ${truncate(val, 60)}`;
  }).join('\n') || '*Catalogue vide.*';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🗣️ Textes & libellés')
    .setDescription(
      'Personnalise **N\'IMPORTE QUEL** texte du panneau depuis Discord.\n\n' +
      '**✏️ = personnalisé** · **⚪ = texte par défaut**\n\n' +
      lines,
    )
    .addFields(
      { name: '📊 Textes', value: `**${catalogue.length}** référencés • **${overrides.size}** personnalisés`, inline: true },
      { name: '📄 Page',   value: `**${p + 1}/${maxPage + 1}**`,                                            inline: true },
    )
    .setFooter({ text: 'Tu peux aussi ajouter un ID custom non listé ici via le bouton ✏️ Modifier.' });

  const editBtn  = new ButtonBuilder().setCustomId(`adv:ui_texts:edit:${userId}`).setLabel('✏️ Modifier / Créer').setStyle(ButtonStyle.Primary);
  const resetBtn = new ButtonBuilder().setCustomId(`adv:ui_texts:reset:${userId}`).setLabel('↩️ Rétablir le défaut').setStyle(ButtonStyle.Danger);
  const resetAll = new ButtonBuilder().setCustomId(`adv:ui_texts:reset_all:${userId}`).setLabel('🗑️ Tout rétablir').setStyle(ButtonStyle.Danger);
  const prev     = new ButtonBuilder().setCustomId(`adv:ui_texts:page:${userId}:${Math.max(0, p - 1)}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(p === 0);
  const next     = new ButtonBuilder().setCustomId(`adv:ui_texts:page:${userId}:${Math.min(maxPage, p + 1)}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(p >= maxPage);

  const rows = [
    new ActionRowBuilder().addComponents(backBtn(userId), editBtn, resetBtn, resetAll),
  ];
  if (catalogue.length > perPage) rows.push(new ActionRowBuilder().addComponents(prev, next));
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🛡️ ANTIRAID
// ═══════════════════════════════════════════════════════════════
function buildAntiraidPanel(cfg, guild, userId, db) {
  const a = db.getAntiraidConfig(guild.id) || {};
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🛡️ Protection AntiRaid')
    .setDescription('Limite les arrivées massives suspectes et les comptes trop jeunes.')
    .addFields(
      { name: '⚡ Statut',               value: onOff(a.enabled ?? 0),                              inline: true },
      { name: '🚪 Seuil d\'arrivées',    value: `**${a.join_threshold ?? 10}** en ${a.join_window_secs ?? 30}s`, inline: true },
      { name: '🔨 Action raid',          value: `\`${a.action || 'kick'}\``,                        inline: true },
      { name: '👶 Comptes jeunes',       value: `< ${a.new_account_days ?? 7} j → \`${a.new_account_action || 'kick'}\``, inline: true },
      { name: '🔒 CAPTCHA',              value: onOff(a.captcha_enabled ?? 0),                      inline: true },
    )
    .setFooter({ text: 'NexusBot — AntiRaid' });

  const toggle = new ButtonBuilder().setCustomId(`adv:antiraid:toggle:${userId}`).setLabel((a.enabled ?? 0) ? '⏸️ Désactiver' : '▶️ Activer').setStyle((a.enabled ?? 0) ? ButtonStyle.Secondary : ButtonStyle.Success);
  const thresh = new ButtonBuilder().setCustomId(`adv:antiraid:set_thresh:${userId}`).setLabel('🚪 Seuil & fenêtre').setStyle(ButtonStyle.Primary);
  const action = new ButtonBuilder().setCustomId(`adv:antiraid:cycle_action:${userId}`).setLabel('🔨 Cycle action').setStyle(ButtonStyle.Primary);
  const newAcc = new ButtonBuilder().setCustomId(`adv:antiraid:set_newacc:${userId}`).setLabel('👶 Comptes jeunes').setStyle(ButtonStyle.Primary);
  const captcha = new ButtonBuilder().setCustomId(`adv:antiraid:toggle_captcha:${userId}`).setLabel((a.captcha_enabled ?? 0) ? '🔒 CAPTCHA OFF' : '🔒 CAPTCHA ON').setStyle(ButtonStyle.Secondary);

  return { embeds: [embed], components: [
    new ActionRowBuilder().addComponents(backBtn(userId), toggle, captcha),
    new ActionRowBuilder().addComponents(thresh, action, newAcc),
  ] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📺 YOUTUBE / 🎮 TWITCH
// ═══════════════════════════════════════════════════════════════
function buildYoutubePanel(cfg, guild, userId, db) {
  const all = db.getYoutubeSubs ? db.getYoutubeSubs(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucune chaîne suivie.*\n\nLe bot surveille une chaîne YouTube et annonce chaque nouvelle vidéo dans un salon.'
    : all.slice(0, 20).map(s => `**#${s.id}** <#${s.channel_id}> ← \`${truncate(s.yt_channel_name || s.yt_channel_id, 40)}\``).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('📺 Notifications YouTube').setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — YouTube' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:youtube:new:${userId}`).setLabel('➕ Ajouter').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:youtube:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)] };
}

function buildTwitchPanel(cfg, guild, userId, db) {
  const all = db.getTwitchSubs ? db.getTwitchSubs(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucun streamer suivi.*\n\nLe bot annonce quand un streamer Twitch passe en live.'
    : all.slice(0, 20).map(s => `**#${s.id}** <#${s.channel_id}> ← \`${truncate(s.twitch_login, 40)}\``).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('🎮 Notifications Twitch').setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Twitch' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:twitch:new:${userId}`).setLabel('➕ Ajouter').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:twitch:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🎁 GIVEAWAYS
// ═══════════════════════════════════════════════════════════════
function buildGiveawaysPanel(cfg, guild, userId, db) {
  const all = db.listGiveaways ? db.listGiveaways(guild.id) : [];
  const now = Math.floor(Date.now() / 1000);
  const desc = all.length === 0
    ? '*Aucun giveaway.*\n\nUtilise `/giveaway` ou `&giveaway` pour en créer un.'
    : all.slice(0, 10).map(g => {
        const icon = g.status === 'active' ? (g.ends_at > now ? '🟢' : '⏰') : g.status === 'ended' ? '⚫' : '❌';
        const time = g.ends_at ? `<t:${g.ends_at}:R>` : '';
        return `${icon} **#${g.id}** ${truncate(g.prize, 40)} — ${g.winners_count || 1} 🏆 — ${time}`;
      }).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('🎁 Giveaways').setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Giveaways' });

  const endBtn = new ButtonBuilder().setCustomId(`adv:giveaways:end:${userId}`).setLabel('⏰ Terminer un giveaway').setStyle(ButtonStyle.Primary).setDisabled(all.length === 0);
  const cancelBtn = new ButtonBuilder().setCustomId(`adv:giveaways:cancel:${userId}`).setLabel('❌ Annuler un giveaway').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), endBtn, cancelBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : ⏰ MESSAGES PROGRAMMÉS
// ═══════════════════════════════════════════════════════════════
function buildScheduledPanel(cfg, guild, userId, db) {
  const all = db.listScheduledMessages ? db.listScheduledMessages(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucun message programmé.*\n\nProgramme un message récurrent avec une expression CRON (ex: `0 9 * * *` = tous les jours à 9h).'
    : all.slice(0, 20).map(s => `${s.enabled ? '✅' : '⏸️'} **#${s.id}** \`${s.cron}\` → <#${s.channel_id}> ${truncate(s.content || '(embed)', 40)}`).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('⏰ Messages programmés').setDescription(desc)
    .addFields(
      { name: '📊 Total', value: `**${all.length}**`, inline: true },
      { name: '🔤 Syntaxe CRON', value: '`m h j M J` — ex: `0 9 * * *` (9h tous les jours)', inline: false },
    )
    .setFooter({ text: 'NexusBot — Scheduled' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:scheduled:new:${userId}`).setLabel('➕ Programmer').setStyle(ButtonStyle.Success);
  const toggleBtn = new ButtonBuilder().setCustomId(`adv:scheduled:toggle:${userId}`).setLabel('🔁 Activer/Désact.').setStyle(ButtonStyle.Secondary).setDisabled(all.length === 0);
  const delBtn = new ButtonBuilder().setCustomId(`adv:scheduled:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, toggleBtn, delBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📋 QUÊTES
// ═══════════════════════════════════════════════════════════════
function buildQuestsPanel(cfg, guild, userId, db) {
  const all = db.listQuests ? db.listQuests(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucune quête.*\n\nCrée des défis communautaires avec un objectif à atteindre et une récompense.'
    : all.slice(0, 15).map(q => {
        const status = q.status === 'active' ? '🎯' : '✅';
        return `${status} **#${q.id}** ${truncate(q.title, 40)} (${q.current}/${q.target}) • 🎁 ${truncate(q.reward, 40)}`;
      }).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('📋 Quêtes communautaires').setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Quêtes' });

  const addBtn = new ButtonBuilder().setCustomId(`adv:quests:new:${userId}`).setLabel('➕ Créer').setStyle(ButtonStyle.Success);
  const delBtn = new ButtonBuilder().setCustomId(`adv:quests:del:${userId}`).setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📬 SONDAGES
// ═══════════════════════════════════════════════════════════════
function buildPollsPanel(cfg, guild, userId, db) {
  const all = db.listPolls ? db.listPolls(guild.id) : [];
  const desc = all.length === 0
    ? '*Aucun sondage.*\n\nUtilise `/sondage` ou `&sondage` pour en créer.'
    : all.slice(0, 10).map(p => `${p.ended ? '✅' : '🟢'} **#${p.id}** ${truncate(p.question, 60)}`).join('\n');

  const embed = new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('📬 Sondages').setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${all.length}**`, inline: true })
    .setFooter({ text: 'NexusBot — Sondages' });

  const endBtn = new ButtonBuilder().setCustomId(`adv:polls:end:${userId}`).setLabel('⏰ Terminer').setStyle(ButtonStyle.Primary).setDisabled(all.length === 0);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(backBtn(userId), endBtn)] };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : ⚡ ÉCONOMIE PRO (sans aucune limite)
// ═══════════════════════════════════════════════════════════════
function buildEcoProPanel(cfg, guild, userId, db) {
  const c = db.getConfig(guild.id);
  const coin = c.currency_emoji || '€';
  const fmt = v => (v == null ? '*(non défini)*' : v === -1 ? '∞' : v.toLocaleString('fr-FR'));

  const embed = new EmbedBuilder()
    .setColor(c.color || '#7B2FBE')
    .setTitle('⚡ Économie — Mode expert')
    .setDescription('Tous les montants acceptent jusqu\'à **10²⁰** (aucune limite pratique).\nUtilise -1 pour "illimité" quand c\'est pertinent.')
    .addFields(
      { name: '💼 Work',       value: `Gain : **${fmt(c.work_min)}–${fmt(c.work_max)}** ${coin}\nCooldown : **${fmt(c.work_cooldown)}**s`, inline: true },
      { name: '🕵️ Crime',      value: `Gain : **${fmt(c.crime_min)}–${fmt(c.crime_max)}** ${coin}\nCooldown : **${fmt(c.crime_cooldown)}**s\nÉchec : **${fmt(c.crime_fail_rate)}%**`, inline: true },
      { name: '🎭 Rob',         value: `Max : **${fmt(c.rob_max_percent)}%** de la victime\nPénalité échec : **${fmt(c.rob_fail_penalty)}** ${coin}\nCooldown : **${fmt(c.rob_cooldown)}**s`, inline: true },
      { name: '📅 Daily',       value: `Montant : **${fmt(c.daily_amount)}** ${coin}\nCooldown : **${fmt(c.daily_cooldown)}**s\nStreak bonus : **${fmt(c.daily_streak_bonus)}%/j**`, inline: true },
      { name: '🏦 Banque',      value: `Intérêt : **${fmt(c.bank_interest_rate)}%/j**\nDépôt max : **${fmt(c.bank_max_deposit)}** ${coin}`, inline: true },
      { name: '🛒 Shop',        value: `Taxe : **${fmt(c.shop_tax_rate)}%**`, inline: true },
    )
    .setFooter({ text: 'NexusBot — Économie Pro' });

  const rows = [
    new ActionRowBuilder().addComponents(
      backBtn(userId),
      new ButtonBuilder().setCustomId(`adv:eco_pro:work:${userId}`).setLabel('💼 Work').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:eco_pro:crime:${userId}`).setLabel('🕵️ Crime').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:eco_pro:rob:${userId}`).setLabel('🎭 Rob').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:eco_pro:daily:${userId}`).setLabel('📅 Daily').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`adv:eco_pro:bank:${userId}`).setLabel('🏦 Banque').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:eco_pro:shop_tax:${userId}`).setLabel('🛒 Taxe shop').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:eco_pro:reset_all:${userId}`).setLabel('↩️ Tout réinitialiser').setStyle(ButtonStyle.Danger),
    ),
  ];
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📊 XP PRO (sans aucune limite)
// ═══════════════════════════════════════════════════════════════
function buildXpProPanel(cfg, guild, userId, db) {
  const c = db.getConfig(guild.id);
  const embed = new EmbedBuilder()
    .setColor(c.color || '#7B2FBE')
    .setTitle('📊 XP — Mode expert')
    .setDescription('Tous les réglages XP sans limite. Cooldown en millisecondes.')
    .addFields(
      { name: '📝 XP par message',    value: `**${c.xp_rate ?? 15}** XP`,                                   inline: true },
      { name: '⏱️ Cooldown message',  value: `**${(c.xp_cooldown_ms ?? 60000).toLocaleString('fr-FR')}** ms`, inline: true },
      { name: '🎙️ XP vocal',          value: onOff(c.xp_voice_enabled ?? 1),                               inline: true },
      { name: '🎙️ XP/min vocal',      value: `**${c.xp_voice_rate ?? 5}** XP`,                             inline: true },
      { name: '✖️ Multiplicateur',     value: `×**${c.xp_multiplier ?? 1}**`,                               inline: true },
      { name: '🎉 Bonus weekend',     value: `×**${c.xp_weekend_bonus ?? 0}** (0 = off)`,                  inline: true },
      { name: '📚 Stack rôles',        value: (c.xp_stack_roles ?? 1) ? '✅ Garder tous' : '❌ Garder max', inline: true },
      { name: '🔔 Annonces >= niveau', value: `**${c.xp_min_level_msg ?? 1}**`,                            inline: true },
    )
    .setFooter({ text: 'NexusBot — XP Pro' });

  const rows = [
    new ActionRowBuilder().addComponents(
      backBtn(userId),
      new ButtonBuilder().setCustomId(`adv:xp_pro:rate:${userId}`).setLabel('📝 XP/message').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:xp_pro:cd_ms:${userId}`).setLabel('⏱️ Cooldown ms').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:xp_pro:voice:${userId}`).setLabel('🎙️ Vocal').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`adv:xp_pro:mult:${userId}`).setLabel('✖️ Multiplicateur').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:xp_pro:weekend:${userId}`).setLabel('🎉 Bonus weekend').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:xp_pro:min_msg:${userId}`).setLabel('🔔 Seuil annonce').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`adv:xp_pro:toggle_voice:${userId}`).setLabel((c.xp_voice_enabled ?? 1) ? '🎙️ Vocal OFF' : '🎙️ Vocal ON').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`adv:xp_pro:toggle_stack:${userId}`).setLabel((c.xp_stack_roles ?? 1) ? '📚 Stack OFF' : '📚 Stack ON').setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 🔨 MODÉRATION PRO (escalation auto)
// ═══════════════════════════════════════════════════════════════
function buildModProPanel(cfg, guild, userId, db) {
  const c = db.getConfig(guild.id);
  const embed = new EmbedBuilder()
    .setColor(c.color || '#7B2FBE')
    .setTitle('🔨 Modération — Mode expert')
    .setDescription('Escalation automatique des warns. Durée de mute et expiration configurables.')
    .addFields(
      { name: '⚡ Escalation auto',      value: onOff(c.auto_escalate_warns ?? 0),                   inline: true },
      { name: '🔇 → Mute à partir de',    value: `**${c.escalate_mute_count ?? 3}** warns`,           inline: true },
      { name: '👢 → Kick à partir de',    value: `**${c.escalate_kick_count ?? 5}** warns`,           inline: true },
      { name: '🔨 → Ban à partir de',     value: `**${c.escalate_ban_count ?? 10}** warns`,           inline: true },
      { name: '⏳ Durée mute par défaut', value: `**${(c.default_mute_duration ?? 3600).toLocaleString('fr-FR')}**s`, inline: true },
      { name: '📅 Expiration des warns',  value: `**${c.warn_expire_days ?? 30}** jours (0 = jamais)`, inline: true },
    )
    .setFooter({ text: 'NexusBot — Modération Pro' });

  const rows = [
    new ActionRowBuilder().addComponents(
      backBtn(userId),
      new ButtonBuilder().setCustomId(`adv:mod_pro:toggle_escalate:${userId}`).setLabel((c.auto_escalate_warns ?? 0) ? '⏸️ Désact. escalation' : '▶️ Act. escalation').setStyle((c.auto_escalate_warns ?? 0) ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`adv:mod_pro:set_seuils:${userId}`).setLabel('📏 Seuils warns').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`adv:mod_pro:set_mute:${userId}`).setLabel('⏳ Durée mute').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`adv:mod_pro:set_expire:${userId}`).setLabel('📅 Expiration warns').setStyle(ButtonStyle.Primary),
    ),
  ];
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// SECTION : 📋 LOGS GRANULAIRES
// ═══════════════════════════════════════════════════════════════
const LOG_EVENTS = [
  { key: 'log_message_delete',  label: '🗑️ Suppression de messages' },
  { key: 'log_message_edit',    label: '✏️ Édition de messages' },
  { key: 'log_member_join',     label: '📥 Arrivée de membres' },
  { key: 'log_member_leave',    label: '📤 Départ de membres' },
  { key: 'log_role_changes',    label: '🎭 Changements de rôles' },
  { key: 'log_voice',           label: '🔊 Activité vocale' },
  { key: 'log_channel_changes', label: '📂 Salons créés/modifiés/supprimés' },
  { key: 'log_bans',            label: '🔨 Bans & unbans' },
];

function buildLogsProPanel(cfg, guild, userId, db) {
  const c = db.getConfig(guild.id);
  const lines = LOG_EVENTS.map(e => `${(c[e.key] ?? 1) ? '✅' : '❌'} ${e.label}`).join('\n');

  const embed = new EmbedBuilder()
    .setColor(c.color || '#7B2FBE')
    .setTitle('📋 Logs granulaires')
    .setDescription('Choisis précisément quels événements enregistrer dans le salon de logs.\n\n' + lines)
    .setFooter({ text: 'NexusBot — Logs Pro' });

  // 2 rows de toggles (4 par row)
  const rows = [new ActionRowBuilder().addComponents(backBtn(userId))];
  let current = new ActionRowBuilder();
  for (let i = 0; i < LOG_EVENTS.length; i++) {
    const e = LOG_EVENTS[i];
    const on = !!(c[e.key] ?? 1);
    current.addComponents(new ButtonBuilder()
      .setCustomId(`adv:logs_pro:toggle:${userId}:${e.key}`)
      .setLabel(e.label.replace(/^[^\w]+/, '').trim().slice(0, 20))
      .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    if (current.components.length === 4 || i === LOG_EVENTS.length - 1) {
      rows.push(current);
      current = new ActionRowBuilder();
    }
  }
  return { embeds: [embed], components: rows };
}

// ═══════════════════════════════════════════════════════════════
// DISPATCHER DES CATÉGORIES AVANCÉES
// ═══════════════════════════════════════════════════════════════
function buildAdvancedCategoryPanel(category, cfg, guild, userId, db, client) {
  switch (category) {
    case 'eco_pro':        return buildEcoProPanel(cfg, guild, userId, db);
    case 'xp_pro':         return buildXpProPanel(cfg, guild, userId, db);
    case 'mod_pro':        return buildModProPanel(cfg, guild, userId, db);
    case 'logs_pro':       return buildLogsProPanel(cfg, guild, userId, db);
    case 'ai':             return buildAIPanel(cfg, guild, userId, db);
    case 'kv':             return buildKvPanel(cfg, guild, userId, db, 0, 'kv');
    case 'ui_texts':       return buildUiTextsPanel(cfg, guild, userId, db, 0);
    case 'embeds':         return buildEmbedsPanel(cfg, guild, userId, db);
    case 'cmds_adv':       return buildCmdsAdvPanel(cfg, guild, userId, db, 0);
    case 'sys_msgs':       return buildSysMsgsPanel(cfg, guild, userId, db);
    case 'autoresp':       return buildAutorespPanel(cfg, guild, userId, db, 0);
    case 'level_roles':    return buildLevelRolesPanel(cfg, guild, userId, db);
    case 'shop':           return buildShopPanel(cfg, guild, userId, db, 0);
    case 'reaction_roles': return buildReactionRolesPanel(cfg, guild, userId, db);
    case 'role_menus':     return buildRoleMenusPanel(cfg, guild, userId, db);
    case 'antiraid':       return buildAntiraidPanel(cfg, guild, userId, db);
    case 'youtube':        return buildYoutubePanel(cfg, guild, userId, db);
    case 'twitch':         return buildTwitchPanel(cfg, guild, userId, db);
    case 'giveaways':      return buildGiveawaysPanel(cfg, guild, userId, db);
    case 'scheduled':      return buildScheduledPanel(cfg, guild, userId, db);
    case 'quests':         return buildQuestsPanel(cfg, guild, userId, db);
    case 'polls':          return buildPollsPanel(cfg, guild, userId, db);
    case 'cmd_ctrl':       return buildCmdCtrlPanel(cfg, guild, userId, db, client, 0);
    case 'aliases':        return buildAliasesPanel(cfg, guild, userId, db);
    case 'backup':         return buildBackupPanel(cfg, guild, userId, db);
    default:               return null;
  }
}

function isAdvancedCategory(category) {
  return ADVANCED_CATEGORIES.some(c => c.value === category);
}

// ═══════════════════════════════════════════════════════════════
// MODALS AVANCÉS
// ═══════════════════════════════════════════════════════════════
function buildSimpleModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(truncate(title, 45));
  for (const f of fields) {
    const input = new TextInputBuilder()
      .setCustomId(f.id)
      .setLabel(truncate(f.label, 45))
      .setStyle(f.style || TextInputStyle.Short)
      .setRequired(f.required !== false);
    if (f.placeholder) input.setPlaceholder(truncate(f.placeholder, 100));
    if (f.minLength != null) input.setMinLength(f.minLength);
    if (f.maxLength != null) input.setMaxLength(f.maxLength);
    if (f.value) { try { input.setValue(truncate(String(f.value), f.maxLength || 4000)); } catch {} }
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return modal;
}

// ═══════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL DES INTERACTIONS AVANCÉES
// ═══════════════════════════════════════════════════════════════
async function handleAdvancedInteraction(interaction, db, client) {
  const customId = interaction.customId || '';
  if (!/^adv(_modal|_chan|_role|_sel)?:/.test(customId)) return false;

  const parts = customId.split(':');

  // Sécurité : le dernier (ou avant-dernier) est l'userId
  function getUserId() {
    // Pour les modales, la sig est adv_modal:<section>:<action>:<userId>[:<arg>]
    // Pour boutons : adv:<section>:<action>:<userId>[:<arg>]
    // L'userId est toujours la 4e position (index 3)
    return parts[3];
  }
  function checkOwner() {
    const uid = getUserId();
    if (interaction.user.id !== uid) {
      (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true }).catch(() => {});
      return false;
    }
    return true;
  }

  const cfg     = db.getConfig(interaction.guildId);
  const userId  = getUserId();
  const section = parts[1];
  const action  = parts[2];

  // ─────────────────────────────────────────────────────────────
  // BOUTONS (adv:<section>:<action>:<userId>[:<arg>])
  // ─────────────────────────────────────────────────────────────
  if (customId.startsWith('adv:') && interaction.isButton()) {
    if (!checkOwner()) return true;
    const arg = parts[4] ? decodeURIComponent(parts[4]) : null;

    // ── EMBEDS ────────────────────────────────────────────────
    if (section === 'embeds') {
      if (action === 'list') {
        return interaction.update(buildEmbedsPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:embeds:create:${userId}`, '🎨 Nouveau template d\'embed', [
          { id: 'name',        label: 'Nom du template (unique)',      placeholder: 'mon_embed',           style: TextInputStyle.Short,     minLength: 1, maxLength: 50 },
          { id: 'title',       label: 'Titre (facultatif)',             placeholder: 'Bienvenue !',          style: TextInputStyle.Short,     required: false, maxLength: 256 },
          { id: 'description', label: 'Description (facultatif)',       placeholder: 'Contenu de l\'embed…', style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
          { id: 'color',       label: 'Couleur HEX (facultatif)',       placeholder: '#7B2FBE',              style: TextInputStyle.Short,     required: false, maxLength: 7 },
          { id: 'footer_text', label: 'Footer (facultatif)',            placeholder: 'NexusBot',             style: TextInputStyle.Short,     required: false, maxLength: 200 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'edit' || action === 'send' || action === 'del') {
        const modal = buildSimpleModal(`adv_modal:embeds:${action}_name:${userId}`,
          action === 'send' ? '📤 Envoyer un template' : action === 'del' ? '🗑️ Supprimer un template' : '✏️ Modifier un template',
          [{ id: 'name', label: 'Nom du template', placeholder: 'mon_embed', style: TextInputStyle.Short, maxLength: 50 }]);
        return interaction.showModal(modal);
      }
      if (action === 'edit_start' && arg) {
        const tpl = db.getEmbedTemplate(interaction.guildId, arg);
        if (!tpl) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Template introuvable.', ephemeral: true }).catch(() => {});
        const d = safeJsonParse(tpl.data_json, {});
        const modal = buildSimpleModal(`adv_modal:embeds:update:${userId}:${encodeURIComponent(arg)}`, '✏️ Modifier l\'embed', [
          { id: 'title',       label: 'Titre',       value: d.title,       style: TextInputStyle.Short,     required: false, maxLength: 256 },
          { id: 'description', label: 'Description', value: d.description, style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
          { id: 'color',       label: 'Couleur HEX', value: d.color,       style: TextInputStyle.Short,     required: false, maxLength: 7 },
          { id: 'footer_text', label: 'Footer',      value: d.footer_text, style: TextInputStyle.Short,     required: false, maxLength: 200 },
          { id: 'image',       label: 'Image URL',   value: d.image,       style: TextInputStyle.Short,     required: false, maxLength: 500 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'send_start' && arg) {
        const tpl = db.getEmbedTemplate(interaction.guildId, arg);
        if (!tpl) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Template introuvable.', ephemeral: true }).catch(() => {});
        const sel = new ChannelSelectMenuBuilder()
          .setCustomId(`adv_chan:embeds_send:${userId}:${encodeURIComponent(arg)}`)
          .setPlaceholder(`📤 Salon où envoyer l\'embed "${arg}"`)
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(1).setMaxValues(1);
        const back = new ButtonBuilder().setCustomId(`adv:embeds:list:${userId}`).setLabel('← Annuler').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`📤 Envoyer « ${tpl.name} »`).setDescription('Choisis le salon de destination ci-dessous.')],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
      if (action === 'del_start' && arg) {
        db.deleteEmbedTemplate(interaction.guildId, arg);
        return interaction.update(buildEmbedsPanel(cfg, interaction.guild, userId, db));
      }
    }

    // ── COMMANDES CUSTOM AVANCÉES ─────────────────────────────
    if (section === 'cmds_adv') {
      if (action === 'list') {
        return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, userId, db, 0));
      }
      if (action === 'page') {
        const page = parseInt(arg, 10) || 0;
        return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, userId, db, page));
      }
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:cmds_adv:create_text:${userId}`, '➕ Nouvelle commande (texte)', [
          { id: 'trigger',  label: 'Déclencheur (sans &)',          placeholder: 'bonjour',               style: TextInputStyle.Short,     maxLength: 30 },
          { id: 'response', label: 'Réponse (variables autorisées)', placeholder: 'Salut {user} !',        style: TextInputStyle.Paragraph, maxLength: 2000 },
          { id: 'cooldown', label: 'Cooldown en secondes (0 = aucun)', placeholder: '0',                   style: TextInputStyle.Short,     required: false, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'new_embed') {
        const modal = buildSimpleModal(`adv_modal:cmds_adv:create_embed:${userId}`, '🎨 Nouvelle commande (embed)', [
          { id: 'trigger',     label: 'Déclencheur (sans &)',  placeholder: 'regles',        style: TextInputStyle.Short,     maxLength: 30 },
          { id: 'title',       label: 'Titre de l\'embed',     placeholder: '📜 Règles',     style: TextInputStyle.Short,     required: false, maxLength: 256 },
          { id: 'description', label: 'Description',           placeholder: 'Règle 1 : …',   style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
          { id: 'color',       label: 'Couleur HEX',           placeholder: '#7B2FBE',       style: TextInputStyle.Short,     required: false, maxLength: 7 },
          { id: 'cooldown',    label: 'Cooldown (secondes, 0 = aucun)', placeholder: '0',    style: TextInputStyle.Short,     required: false, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'edit' || action === 'toggle' || action === 'del') {
        const modal = buildSimpleModal(`adv_modal:cmds_adv:${action}_pick:${userId}`,
          action === 'del' ? '🗑️ Supprimer une commande' : action === 'toggle' ? '🔁 Activer/Désactiver' : '✏️ Modifier une commande',
          [{ id: 'trigger', label: 'Déclencheur (sans &)', placeholder: 'bonjour', style: TextInputStyle.Short, maxLength: 30 }]);
        return interaction.showModal(modal);
      }
      if (action === 'toggle_one' && arg) {
        const c = db.getCustomCommand(interaction.guildId, arg);
        if (c) {
          db.upsertCustomCommand(interaction.guildId, arg, {
            ...c,
            allowed_channels: safeJsonParse(c.allowed_channels, []),
            enabled: c.enabled ? 0 : 1,
            created_by: c.created_by,
          });
        }
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'toggle_del' && arg) {
        const c = db.getCustomCommand(interaction.guildId, arg);
        if (c) {
          db.upsertCustomCommand(interaction.guildId, arg, {
            ...c,
            allowed_channels: safeJsonParse(c.allowed_channels, []),
            delete_trigger: c.delete_trigger ? 0 : 1,
            created_by: c.created_by,
          });
        }
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'del_one' && arg) {
        db.deleteCustomCommand(interaction.guildId, arg);
        return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, userId, db, 0));
      }
      if (action === 'set_cd' && arg) {
        const c = db.getCustomCommand(interaction.guildId, arg);
        const modal = buildSimpleModal(`adv_modal:cmds_adv:save_cd:${userId}:${encodeURIComponent(arg)}`, '⏱️ Cooldown', [
          { id: 'seconds', label: 'Cooldown en secondes (0 = aucun)', placeholder: '10', style: TextInputStyle.Short, value: String(c?.cooldown ?? 0), maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_role' && arg) {
        const sel = new RoleSelectMenuBuilder()
          .setCustomId(`adv_role:cmds_adv:${userId}:${encodeURIComponent(arg)}`)
          .setPlaceholder(`🎭 Rôle requis pour &${arg} (vide = aucun)`)
          .setMinValues(0).setMaxValues(1);
        const back = new ButtonBuilder().setCustomId(`adv:cmds_adv:detail_btn:${userId}:${encodeURIComponent(arg)}`).setLabel('← Retour').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`🎭 Rôle requis — &${arg}`).setDescription('Sélectionne un rôle requis pour utiliser cette commande, ou aucun pour rendre la commande publique.')],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
      if (action === 'edit_resp' && arg) {
        const c = db.getCustomCommand(interaction.guildId, arg);
        if (!c) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Introuvable.', ephemeral: true }).catch(() => {});
        const modal = buildSimpleModal(`adv_modal:cmds_adv:save_resp:${userId}:${encodeURIComponent(arg)}`, '✏️ Modifier la réponse', [
          { id: 'response', label: 'Nouvelle réponse (texte)', value: c.response, style: TextInputStyle.Paragraph, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'detail_btn' && arg) {
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
    }

    // ── MESSAGES SYSTÈME ──────────────────────────────────────
    if (section === 'sys_msgs') {
      if (action === 'list') {
        return interaction.update(buildSysMsgsPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'toggle' && arg) {
        const m = db.getSystemMessage(interaction.guildId, arg);
        db.upsertSystemMessage(interaction.guildId, arg, {
          enabled: (m?.enabled ?? 1) ? 0 : 1,
          mode: m?.mode || 'text',
          content: m?.content,
          embed_json: m?.embed_json,
          channel_id: m?.channel_id,
        });
        return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'edit_text' && arg) {
        const m = db.getSystemMessage(interaction.guildId, arg);
        const def = SYSTEM_EVENTS.find(e => e.key === arg);
        const modal = buildSimpleModal(`adv_modal:sys_msgs:save_text:${userId}:${arg}`, `💬 ${def?.label || arg}`, [
          { id: 'content', label: 'Texte (variables autorisées)', value: m?.content || '', style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'edit_embed' && arg) {
        const m = db.getSystemMessage(interaction.guildId, arg);
        const def = SYSTEM_EVENTS.find(e => e.key === arg);
        const current = m?.embed_json ? truncate(m.embed_json, 3900) : '';
        const placeholder = '{"title":"Exemple","description":"Salut {user}","color":"#7B2FBE"}';
        const modal = buildSimpleModal(`adv_modal:sys_msgs:save_embed:${userId}:${arg}`, `🎨 Embed — ${def?.label || arg}`, [
          { id: 'embed_json', label: 'JSON de l\'embed', value: current, placeholder, style: TextInputStyle.Paragraph, required: false, maxLength: 3900 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_mode' && arg) {
        const m = db.getSystemMessage(interaction.guildId, arg);
        const cur = m?.mode || 'text';
        const next = cur === 'text' ? 'embed' : cur === 'embed' ? 'both' : 'text';
        db.upsertSystemMessage(interaction.guildId, arg, {
          enabled: m?.enabled ?? 1,
          mode: next,
          content: m?.content,
          embed_json: m?.embed_json,
          channel_id: m?.channel_id,
        });
        return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'reset' && arg) {
        db.upsertSystemMessage(interaction.guildId, arg, { enabled: 1, mode: 'text', content: null, embed_json: null, channel_id: null });
        return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
    }

    // ── COOLDOWNS / TOGGLES ───────────────────────────────────
    if (section === 'cmd_ctrl') {
      if (action === 'list') {
        return interaction.update(buildCmdCtrlPanel(cfg, interaction.guild, userId, db, client, 0));
      }
      if (action === 'page') {
        const page = parseInt(arg, 10) || 0;
        return interaction.update(buildCmdCtrlPanel(cfg, interaction.guild, userId, db, client, page));
      }
      if (action === 'toggle' && arg) {
        const cur = db.isCommandEnabled(interaction.guildId, arg);
        db.setCommandEnabled(interaction.guildId, arg, !cur);
        return interaction.update(buildCmdCtrlDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'set_cd' && arg) {
        const cd = db.getCooldownOverride(interaction.guildId, arg);
        const modal = buildSimpleModal(`adv_modal:cmd_ctrl:save_cd:${userId}:${encodeURIComponent(arg)}`, `⏱️ Cooldown — ${arg}`, [
          { id: 'seconds', label: 'Cooldown en secondes (0 = désactiver override)', value: String(cd ?? ''), placeholder: '10', style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'reset_cd' && arg) {
        db.removeCooldownOverride(interaction.guildId, arg);
        return interaction.update(buildCmdCtrlDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
    }

    // ── ⚡ ÉCONOMIE PRO ──────────────────────────────────────
    if (section === 'eco_pro') {
      const c = db.getConfig(interaction.guildId);
      if (action === 'work') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_work:${userId}`, '💼 Work — gains & cooldown', [
          { id: 'min',      label: 'Gain minimum',             value: String(c.work_min ?? 10),      style: TextInputStyle.Short, maxLength: 20 },
          { id: 'max',      label: 'Gain maximum',             value: String(c.work_max ?? 100),     style: TextInputStyle.Short, maxLength: 20 },
          { id: 'cooldown', label: 'Cooldown (secondes)',      value: String(c.work_cooldown ?? 3600), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'crime') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_crime:${userId}`, '🕵️ Crime — gains, cooldown, échec', [
          { id: 'min',      label: 'Gain minimum',             value: String(c.crime_min ?? 50),      style: TextInputStyle.Short, maxLength: 20 },
          { id: 'max',      label: 'Gain maximum',             value: String(c.crime_max ?? 500),     style: TextInputStyle.Short, maxLength: 20 },
          { id: 'cooldown', label: 'Cooldown (secondes)',      value: String(c.crime_cooldown ?? 7200), style: TextInputStyle.Short, maxLength: 20 },
          { id: 'fail',     label: 'Taux d\'échec (%)',        value: String(c.crime_fail_rate ?? 40), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'rob') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_rob:${userId}`, '🎭 Rob — max, pénalité, cooldown', [
          { id: 'max_pct',  label: 'Max % du solde victime',    value: String(c.rob_max_percent ?? 30), style: TextInputStyle.Short, maxLength: 20 },
          { id: 'penalty',  label: 'Pénalité si échec',         value: String(c.rob_fail_penalty ?? 100), style: TextInputStyle.Short, maxLength: 20 },
          { id: 'cooldown', label: 'Cooldown (secondes)',       value: String(c.rob_cooldown ?? 14400), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'daily') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_daily:${userId}`, '📅 Daily — montant, cooldown, streak', [
          { id: 'amount',   label: 'Montant daily',             value: String(c.daily_amount ?? 25),   style: TextInputStyle.Short, maxLength: 20 },
          { id: 'cooldown', label: 'Cooldown (secondes)',        value: String(c.daily_cooldown ?? 86400), style: TextInputStyle.Short, maxLength: 20 },
          { id: 'streak',   label: 'Bonus streak (% par jour)',  value: String(c.daily_streak_bonus ?? 10), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'bank') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_bank:${userId}`, '🏦 Banque — intérêt, max dépôt', [
          { id: 'interest', label: 'Taux intérêt par jour (%)',  value: String(c.bank_interest_rate ?? 0), style: TextInputStyle.Short, maxLength: 20 },
          { id: 'max_dep',  label: 'Dépôt maximum (-1 = illimité)', value: String(c.bank_max_deposit ?? -1), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'shop_tax') {
        const modal = buildSimpleModal(`adv_modal:eco_pro:save_tax:${userId}`, '🛒 Taxe boutique (%)', [
          { id: 'rate', label: 'Pourcentage prélevé à chaque achat', value: String(c.shop_tax_rate ?? 0), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'reset_all') {
        const defaults = {
          work_min:10, work_max:100, work_cooldown:3600,
          crime_min:50, crime_max:500, crime_cooldown:7200, crime_fail_rate:40,
          rob_max_percent:30, rob_fail_penalty:100, rob_cooldown:14400,
          daily_amount:25, daily_cooldown:86400, daily_streak_bonus:10,
          bank_interest_rate:0, bank_max_deposit:-1, shop_tax_rate:0,
        };
        for (const [k, v] of Object.entries(defaults)) db.setConfig(interaction.guildId, k, v);
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, userId, db));
      }
    }

    // ── 📊 XP PRO ────────────────────────────────────────────
    if (section === 'xp_pro') {
      const c = db.getConfig(interaction.guildId);
      const simple = (act, key, label, value) => ({ id: 'value', label, value: String(value), style: TextInputStyle.Short, maxLength: 20 });
      const map = {
        rate:    { title: '📝 XP par message',           key: 'xp_rate',         value: c.xp_rate ?? 15 },
        cd_ms:   { title: '⏱️ Cooldown XP (millisecondes)', key: 'xp_cooldown_ms', value: c.xp_cooldown_ms ?? 60000 },
        voice:   { title: '🎙️ XP par minute vocal',       key: 'xp_voice_rate',  value: c.xp_voice_rate ?? 5 },
        mult:    { title: '✖️ Multiplicateur XP global',   key: 'xp_multiplier',  value: c.xp_multiplier ?? 1 },
        weekend: { title: '🎉 Bonus XP weekend (0=off)',    key: 'xp_weekend_bonus', value: c.xp_weekend_bonus ?? 0 },
        min_msg: { title: '🔔 Seuil d\'annonce de niveau',  key: 'xp_min_level_msg', value: c.xp_min_level_msg ?? 1 },
      };
      if (map[action]) {
        const m = map[action];
        const modal = buildSimpleModal(`adv_modal:xp_pro:save:${userId}:${m.key}`, m.title, [
          { id: 'value', label: 'Nouvelle valeur (numérique, sans limite)', value: String(m.value), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'toggle_voice') {
        db.setConfig(interaction.guildId, 'xp_voice_enabled', (c.xp_voice_enabled ?? 1) ? 0 : 1);
        return interaction.update(buildXpProPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'toggle_stack') {
        db.setConfig(interaction.guildId, 'xp_stack_roles', (c.xp_stack_roles ?? 1) ? 0 : 1);
        return interaction.update(buildXpProPanel(cfg, interaction.guild, userId, db));
      }
    }

    // ── 🔨 MODÉRATION PRO ────────────────────────────────────
    if (section === 'mod_pro') {
      const c = db.getConfig(interaction.guildId);
      if (action === 'toggle_escalate') {
        db.setConfig(interaction.guildId, 'auto_escalate_warns', (c.auto_escalate_warns ?? 0) ? 0 : 1);
        return interaction.update(buildModProPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'set_seuils') {
        const modal = buildSimpleModal(`adv_modal:mod_pro:save_seuils:${userId}`, '📏 Seuils d\'escalation', [
          { id: 'mute', label: 'Mute à partir de X warns',  value: String(c.escalate_mute_count ?? 3),  style: TextInputStyle.Short, maxLength: 20 },
          { id: 'kick', label: 'Kick à partir de X warns',  value: String(c.escalate_kick_count ?? 5),  style: TextInputStyle.Short, maxLength: 20 },
          { id: 'ban',  label: 'Ban à partir de X warns',   value: String(c.escalate_ban_count ?? 10),  style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_mute') {
        const modal = buildSimpleModal(`adv_modal:mod_pro:save_mute:${userId}`, '⏳ Durée de mute par défaut (secondes)', [
          { id: 'value', label: 'Durée en secondes (sans limite)', value: String(c.default_mute_duration ?? 3600), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_expire') {
        const modal = buildSimpleModal(`adv_modal:mod_pro:save_expire:${userId}`, '📅 Expiration des warns (jours)', [
          { id: 'value', label: 'Jours avant expiration (0 = jamais)', value: String(c.warn_expire_days ?? 30), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 📋 LOGS PRO ──────────────────────────────────────────
    if (section === 'logs_pro' && action === 'toggle') {
      const key = arg; // ex: log_message_delete
      if (!LOG_EVENTS.find(e => e.key === key)) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Event inconnu.', ephemeral: true }).catch(() => {});
      const c = db.getConfig(interaction.guildId);
      db.setConfig(interaction.guildId, key, (c[key] ?? 1) ? 0 : 1);
      return interaction.update(buildLogsProPanel(cfg, interaction.guild, userId, db));
    }

    // ── 🛡️ ANTIRAID ──────────────────────────────────────────
    if (section === 'antiraid') {
      if (action === 'toggle') {
        const a = db.getAntiraidConfig(interaction.guildId);
        db.setAntiraidField(interaction.guildId, 'enabled', a.enabled ? 0 : 1);
        return interaction.update(buildAntiraidPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'toggle_captcha') {
        const a = db.getAntiraidConfig(interaction.guildId);
        db.setAntiraidField(interaction.guildId, 'captcha_enabled', a.captcha_enabled ? 0 : 1);
        return interaction.update(buildAntiraidPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'cycle_action') {
        const a = db.getAntiraidConfig(interaction.guildId);
        const cycle = ['kick', 'ban', 'mute'];
        const i = cycle.indexOf(a.action || 'kick');
        db.setAntiraidField(interaction.guildId, 'action', cycle[(i + 1) % cycle.length]);
        return interaction.update(buildAntiraidPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'set_thresh') {
        const a = db.getAntiraidConfig(interaction.guildId);
        const modal = buildSimpleModal(`adv_modal:antiraid:save_thresh:${userId}`, '🚪 Seuil de raid', [
          { id: 'threshold', label: 'Arrivées max', value: String(a.join_threshold ?? 10), style: TextInputStyle.Short, maxLength: 4 },
          { id: 'window',    label: 'Fenêtre en secondes', value: String(a.join_window_secs ?? 30), style: TextInputStyle.Short, maxLength: 4 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_newacc') {
        const a = db.getAntiraidConfig(interaction.guildId);
        const modal = buildSimpleModal(`adv_modal:antiraid:save_newacc:${userId}`, '👶 Comptes jeunes', [
          { id: 'days',   label: 'Jours min avant d\'autoriser', value: String(a.new_account_days ?? 7), style: TextInputStyle.Short, maxLength: 3 },
          { id: 'action', label: 'Action (kick | ban | mute)',    value: a.new_account_action || 'kick', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 📺 YOUTUBE / 🎮 TWITCH ────────────────────────────────
    if (section === 'youtube' || section === 'twitch') {
      const label = section === 'youtube' ? 'YouTube' : 'Twitch';
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:${section}:create:${userId}`, `➕ Nouvelle alerte ${label}`, [
          { id: 'channel_id', label: 'ID du salon Discord où poster',              style: TextInputStyle.Short, maxLength: 30 },
          { id: 'target',     label: section === 'youtube' ? 'ID de la chaîne YouTube (UCxxx)' : 'Login Twitch (ex: ninja)', style: TextInputStyle.Short, maxLength: 100 },
          { id: 'message',    label: 'Message (optionnel)', placeholder: section === 'youtube' ? '🎬 Nouvelle vidéo de {channel} ! {url}' : '🔴 {streamer} est EN LIVE ! {url}', style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:${section}:del_pick:${userId}`, `🗑️ Supprimer alerte ${label}`, [
          { id: 'id', label: 'ID de l\'alerte', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 🎁 GIVEAWAYS ──────────────────────────────────────────
    if (section === 'giveaways') {
      if (action === 'end' || action === 'cancel') {
        const modal = buildSimpleModal(`adv_modal:giveaways:${action}_pick:${userId}`, action === 'end' ? '⏰ Terminer' : '❌ Annuler', [
          { id: 'id', label: 'ID du giveaway', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── ⏰ SCHEDULED ──────────────────────────────────────────
    if (section === 'scheduled') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:scheduled:create:${userId}`, '➕ Programmer un message', [
          { id: 'channel_id', label: 'ID du salon',                       style: TextInputStyle.Short, maxLength: 30 },
          { id: 'cron',       label: 'Expression CRON (ex: 0 9 * * *)',   style: TextInputStyle.Short, maxLength: 30, placeholder: '0 9 * * *' },
          { id: 'content',    label: 'Contenu du message (texte)',         style: TextInputStyle.Paragraph, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'toggle' || action === 'del') {
        const modal = buildSimpleModal(`adv_modal:scheduled:${action}_pick:${userId}`, action === 'del' ? '🗑️ Supprimer' : '🔁 Activer/Désact.', [
          { id: 'id', label: 'ID du message programmé', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 📋 QUÊTES ─────────────────────────────────────────────
    if (section === 'quests') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:quests:create:${userId}`, '➕ Nouvelle quête', [
          { id: 'title',       label: 'Titre',                           style: TextInputStyle.Short,     maxLength: 100 },
          { id: 'description', label: 'Description',                      style: TextInputStyle.Paragraph, maxLength: 500 },
          { id: 'target',      label: 'Objectif (nombre)',                style: TextInputStyle.Short,     maxLength: 10, placeholder: '100' },
          { id: 'reward',      label: 'Récompense (texte libre)',         style: TextInputStyle.Short,     maxLength: 200 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:quests:del_pick:${userId}`, '🗑️ Supprimer une quête', [
          { id: 'id', label: 'ID de la quête', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 📬 SONDAGES ───────────────────────────────────────────
    if (section === 'polls' && action === 'end') {
      const modal = buildSimpleModal(`adv_modal:polls:end_pick:${userId}`, '⏰ Terminer un sondage', [
        { id: 'id', label: 'ID du sondage', style: TextInputStyle.Short, maxLength: 10 },
      ]);
      return interaction.showModal(modal);
    }

    // ── 🗣️ TEXTES UI ─────────────────────────────────────────
    if (section === 'ui_texts') {
      if (action === 'page') {
        return interaction.update(buildUiTextsPanel(cfg, interaction.guild, userId, db, parseInt(arg, 10) || 0));
      }
      if (action === 'edit') {
        const modal = buildSimpleModal(`adv_modal:ui_texts:save:${userId}`, '✏️ Personnaliser un texte', [
          { id: 'key',   label: 'Identifiant (ex: btn.save ou titre.custom)', style: TextInputStyle.Short, maxLength: 80, placeholder: 'btn.save' },
          { id: 'value', label: 'Nouveau texte (vide = garder le défaut)',     style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'reset') {
        const modal = buildSimpleModal(`adv_modal:ui_texts:reset_one:${userId}`, '↩️ Rétablir le défaut', [
          { id: 'key', label: 'Identifiant du texte à réinitialiser', style: TextInputStyle.Short, maxLength: 80 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'reset_all') {
        // Supprime tous les ui:* du serveur
        try {
          const all = db.kvList(interaction.guildId, 'ui:') || [];
          for (const r of all) db.kvDelete(interaction.guildId, r.key);
        } catch {}
        return interaction.update(buildUiTextsPanel(cfg, interaction.guild, userId, db, 0));
      }
    }

    // ── 🗄️ ÉDITEUR LIBRE (KV + guild_config) ─────────────────
    if (section === 'kv') {
      const argSrc = parts[4] || 'kv';
      if (action === 'list') {
        return interaction.update(buildKvPanel(cfg, interaction.guild, userId, db, 0, argSrc));
      }
      if (action === 'switch') {
        return interaction.update(buildKvPanel(cfg, interaction.guild, userId, db, 0, argSrc));
      }
      if (action === 'page') {
        const page = parseInt(parts[5], 10) || 0;
        return interaction.update(buildKvPanel(cfg, interaction.guild, userId, db, page, argSrc));
      }
      if (action === 'view') {
        const modal = buildSimpleModal(`adv_modal:kv:do_view:${userId}:${argSrc}`, `🔍 Voir une clé (${argSrc})`, [
          { id: 'key', label: 'Nom de la clé', style: TextInputStyle.Short, maxLength: 80 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set') {
        const modal = buildSimpleModal(`adv_modal:kv:do_set:${userId}:${argSrc}`,
          argSrc === 'gc' ? '✏️ Modifier une colonne guild_config' : '➕ Créer/Modifier une clé',
          [
            { id: 'key',   label: argSrc === 'gc' ? 'Nom de la colonne (ex: color)' : 'Nom de la clé (libre)', style: TextInputStyle.Short, maxLength: 80 },
            { id: 'value', label: 'Nouvelle valeur (texte, nombre, JSON…)',                                     style: TextInputStyle.Paragraph, required: false, maxLength: 4000 },
          ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:kv:do_del:${userId}:${argSrc}`,
          argSrc === 'gc' ? '↩️ Mettre NULL une colonne' : '🗑️ Supprimer une clé',
          [{ id: 'key', label: 'Nom de la clé', style: TextInputStyle.Short, maxLength: 80 }]);
        return interaction.showModal(modal);
      }
    }

    // ── 🛒 BOUTIQUE ──────────────────────────────────────────
    if (section === 'shop') {
      if (action === 'list') return interaction.update(buildShopPanel(cfg, interaction.guild, userId, db, 0));
      if (action === 'page') return interaction.update(buildShopPanel(cfg, interaction.guild, userId, db, parseInt(arg, 10) || 0));
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:shop:create:${userId}`, '➕ Nouvel item', [
          { id: 'name',        label: 'Nom',                 style: TextInputStyle.Short,     maxLength: 100 },
          { id: 'description', label: 'Description',          style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
          { id: 'price',       label: 'Prix (en €)',      style: TextInputStyle.Short,     maxLength: 10, placeholder: '100' },
          { id: 'emoji',       label: 'Emoji',                style: TextInputStyle.Short,     required: false, maxLength: 10, placeholder: '📦' },
          { id: 'stock',       label: 'Stock (-1 = illimité)', style: TextInputStyle.Short,     required: false, maxLength: 10, placeholder: '-1' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'edit' || action === 'toggle' || action === 'del') {
        const modal = buildSimpleModal(`adv_modal:shop:${action}_pick:${userId}`,
          action === 'del' ? '🗑️ Supprimer' : action === 'toggle' ? '🔁 Activer/Désact.' : '✏️ Modifier',
          [{ id: 'id', label: 'ID de l\'item', style: TextInputStyle.Short, maxLength: 10 }]);
        return interaction.showModal(modal);
      }
    }

    // ── ⭐ REACTION ROLES ────────────────────────────────────
    if (section === 'reaction_roles') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:reaction_roles:create:${userId}`, '➕ Nouveau reaction role', [
          { id: 'message_id', label: 'ID du message (clic droit → Copier l\'ID)', style: TextInputStyle.Short, maxLength: 30 },
          { id: 'channel_id', label: 'ID du salon du message',                     style: TextInputStyle.Short, maxLength: 30 },
          { id: 'emoji',      label: 'Emoji (unicode ou <:nom:id>)',                style: TextInputStyle.Short, maxLength: 80 },
          { id: 'role_id',    label: 'ID du rôle à attribuer',                      style: TextInputStyle.Short, maxLength: 30 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:reaction_roles:del_pick:${userId}`, '🗑️ Supprimer un reaction role', [
          { id: 'id', label: 'ID du reaction role', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 📜 ROLE MENUS ────────────────────────────────────────
    if (section === 'role_menus') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:role_menus:create:${userId}`, '➕ Nouveau menu de rôles', [
          { id: 'title',       label: 'Titre du menu',                        style: TextInputStyle.Short,     maxLength: 100 },
          { id: 'description', label: 'Description',                           style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
          { id: 'role_ids',    label: 'IDs des rôles (séparés par virgule)',   style: TextInputStyle.Paragraph, maxLength: 1000 },
          { id: 'max_choices', label: 'Choix max par membre (0 = illimité)',   style: TextInputStyle.Short,     required: false, maxLength: 3, placeholder: '0' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:role_menus:del_pick:${userId}`, '🗑️ Supprimer un menu', [
          { id: 'id', label: 'ID du menu', style: TextInputStyle.Short, maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── 🔁 AUTORESPONDER — détail + enrichissements ──────────
    if (section === 'autoresp') {
      if (action === 'detail' && arg) {
        return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'toggle_one' && arg) {
        const a = db.getAutoresponder(interaction.guildId, arg);
        if (a) {
          db.upsertAutoresponder(interaction.guildId, arg, {
            ...a,
            allowed_channels: safeJsonParse(a.allowed_channels, []),
            enabled: a.enabled ? 0 : 1,
          });
        }
        return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'toggle_match' && arg) {
        const a = db.getAutoresponder(interaction.guildId, arg);
        if (a) {
          db.upsertAutoresponder(interaction.guildId, arg, {
            ...a,
            allowed_channels: safeJsonParse(a.allowed_channels, []),
            exact_match: a.exact_match ? 0 : 1,
          });
        }
        return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'del_one' && arg) {
        db.deleteAutoresponder(interaction.guildId, arg);
        return interaction.update(buildAutorespPanel(cfg, interaction.guild, userId, db, 0));
      }
      if (action === 'edit_resp' && arg) {
        const a = db.getAutoresponder(interaction.guildId, arg);
        const modal = buildSimpleModal(`adv_modal:autoresp:save_resp:${userId}:${encodeURIComponent(arg)}`, '✏️ Modifier la réponse', [
          { id: 'response', label: 'Nouvelle réponse', value: a?.response || '', style: TextInputStyle.Paragraph, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_cd' && arg) {
        const a = db.getAutoresponder(interaction.guildId, arg);
        const modal = buildSimpleModal(`adv_modal:autoresp:save_cd:${userId}:${encodeURIComponent(arg)}`, '⏱️ Cooldown', [
          { id: 'seconds', label: 'Cooldown (secondes, 0 = aucun)', value: String(a?.cooldown ?? 0), style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_role' && arg) {
        const sel = new RoleSelectMenuBuilder()
          .setCustomId(`adv_role:autoresp_role:${userId}:${encodeURIComponent(arg)}`)
          .setPlaceholder(`🎭 Rôle requis pour "${arg}" (vide = aucun)`)
          .setMinValues(0).setMaxValues(1);
        const back = new ButtonBuilder().setCustomId(`adv:autoresp:detail:${userId}:${encodeURIComponent(arg)}`).setLabel('← Retour').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`🎭 Rôle requis — ${arg}`)],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
      if (action === 'set_chans' && arg) {
        const sel = new ChannelSelectMenuBuilder()
          .setCustomId(`adv_chan:autoresp_chans:${userId}:${encodeURIComponent(arg)}`)
          .setPlaceholder(`📣 Salons autorisés pour "${arg}" (vide = tous)`)
          .setChannelTypes(ChannelType.GuildText)
          .setMinValues(0).setMaxValues(25);
        const back = new ButtonBuilder().setCustomId(`adv:autoresp:detail:${userId}:${encodeURIComponent(arg)}`).setLabel('← Retour').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`📣 Salons — ${arg}`)],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
    }

    // ── ⚡ COMMANDES CUSTOM — allowed_channels multi ─────────
    if (section === 'cmds_adv' && action === 'set_chans' && arg) {
      const sel = new ChannelSelectMenuBuilder()
        .setCustomId(`adv_chan:cmds_chans:${userId}:${encodeURIComponent(arg)}`)
        .setPlaceholder(`📣 Salons autorisés pour &${arg} (vide = tous)`)
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(0).setMaxValues(25);
      const back = new ButtonBuilder().setCustomId(`adv:cmds_adv:detail_btn:${userId}:${encodeURIComponent(arg)}`).setLabel('← Retour').setStyle(ButtonStyle.Secondary);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`📣 Salons — &${arg}`).setDescription('Choisis les salons où cette commande peut être utilisée. Laisse vide pour autoriser partout.')],
        components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
      });
    }

    // ── 📢 MESSAGES SYSTÈME CUSTOM ───────────────────────────
    if (section === 'sys_msgs' && action === 'new_custom') {
      const modal = buildSimpleModal(`adv_modal:sys_msgs:create_custom:${userId}`, '➕ Nouvel événement custom', [
        { id: 'event',   label: 'Nom de l\'événement (libre, ex: jackpot)',  style: TextInputStyle.Short,     maxLength: 50 },
        { id: 'content', label: 'Message texte (variables autorisées)',     style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
      ]);
      return interaction.showModal(modal);
    }

    // ── 🧠 IA ─────────────────────────────────────────────────
    if (section === 'ai') {
      const aiMod = _getAiModule();
      if (!aiMod) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Module IA non chargé.', ephemeral: true }).catch(() => {});
      if (action === 'toggle') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        aiMod.setAIConfig(interaction.guildId, db, { enabled: current.enabled ? 0 : 1 });
        return interaction.update(buildAIPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'toggle_mention') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        aiMod.setAIConfig(interaction.guildId, db, { mention_reply: current.mention_reply ? 0 : 1 });
        return interaction.update(buildAIPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'cycle_provider') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        const cycle = ['auto', 'anthropic', 'openai'];
        const idx = cycle.indexOf(current.provider || 'auto');
        const next = cycle[(idx + 1) % cycle.length];
        aiMod.setAIConfig(interaction.guildId, db, { provider: next });
        return interaction.update(buildAIPanel(cfg, interaction.guild, userId, db));
      }
      if (action === 'set_model') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        const modal = buildSimpleModal(`adv_modal:ai:save_model:${userId}`, '🤖 Modèle IA', [
          { id: 'model', label: 'Nom exact du modèle',
            value: current.model,
            placeholder: 'claude-3-5-sonnet-20241022 | claude-3-5-haiku-20241022 | gpt-4o-mini | gpt-4o',
            style: TextInputStyle.Short, maxLength: 100 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_tokens') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        const modal = buildSimpleModal(`adv_modal:ai:save_tokens:${userId}`, '📏 Max tokens réponse', [
          { id: 'max_tokens', label: 'Max tokens (64-2048, défaut 512)',
            value: String(current.max_tokens ?? 512),
            placeholder: '512', style: TextInputStyle.Short, maxLength: 5 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_prompt') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        const modal = buildSimpleModal(`adv_modal:ai:save_prompt:${userId}`, '🎭 Personnalité (prompt système)', [
          { id: 'system_prompt', label: 'Instruction système (vide = défaut)',
            value: current.system_prompt || '',
            placeholder: 'Tu es l\'assistant du serveur Zone Entraide, chaleureux et concis…',
            style: TextInputStyle.Paragraph, required: false, maxLength: 2000 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'test') {
        const current = aiMod.getAIConfig(interaction.guildId, db);
        if (!aiMod.isAvailable()) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Aucune clé API IA configurée côté Railway.', ephemeral: true }).catch(() => {});
        await interaction.deferReply({ ephemeral: true });
        try {
          const res = await aiMod.askAI({
            prompt: 'En UNE seule phrase, présente-toi et dis que tu es prêt à aider.',
            guildId: interaction.guildId, userId: interaction.user.id, cfg: current,
          });
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
            embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle('🧪 Test IA')
              .setDescription(res.text || '*(vide)*')
              .setFooter({ text: `${res.provider} • ${res.model} • ${res.usage?.output_tokens || res.usage?.completion_tokens || '?'} tokens` })],
          });
        } catch (e) {
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${e.message}` }).catch(() => {});
        }
      }
    }

    // ── ÉDITEUR EMBED : handlers pour le mode complet ─────────
    if (section === 'embeds') {
      if (action === 'preview' && arg) {
        return interaction.update(buildEmbedPreviewPanel(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'edit_full' && arg) {
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, userId, db, arg));
      }
      // Boutons set_xxx : ouvrent un modal pour éditer une propriété
      const simpleFields = {
        set_title:   { key: 'title',       label: 'Titre',          style: TextInputStyle.Short,     max: 256 },
        set_desc:    { key: 'description', label: 'Description',    style: TextInputStyle.Paragraph, max: 4000 },
        set_color:   { key: 'color',       label: 'Couleur HEX',    style: TextInputStyle.Short,     max: 7 },
        set_url:     { key: 'url',         label: 'URL du titre',   style: TextInputStyle.Short,     max: 500 },
        set_image:   { key: 'image',       label: 'Image URL',      style: TextInputStyle.Short,     max: 500 },
        set_thumb:   { key: 'thumbnail',   label: 'Thumbnail URL',  style: TextInputStyle.Short,     max: 500 },
        set_footer:  { key: 'footer_text', label: 'Footer',         style: TextInputStyle.Paragraph, max: 2000 },
      };
      if (simpleFields[action] && arg) {
        const tpl = db.getEmbedTemplate(interaction.guildId, arg);
        const data = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        const conf = simpleFields[action];
        const modal = buildSimpleModal(`adv_modal:embeds:save_${conf.key}:${userId}:${encodeURIComponent(arg)}`, `✏️ ${conf.label}`, [
          { id: 'value', label: `${conf.label} (vide = retirer)`, value: data[conf.key], style: conf.style, required: false, maxLength: conf.max },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'set_author' && arg) {
        const tpl = db.getEmbedTemplate(interaction.guildId, arg);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        const modal = buildSimpleModal(`adv_modal:embeds:save_author:${userId}:${encodeURIComponent(arg)}`, '👤 Auteur', [
          { id: 'author_name', label: 'Nom de l\'auteur (vide = retirer)', value: d.author_name, style: TextInputStyle.Short, required: false, maxLength: 256 },
          { id: 'author_icon', label: 'Icône URL',                          value: d.author_icon, style: TextInputStyle.Short, required: false, maxLength: 500 },
          { id: 'author_url',  label: 'Lien cliquable',                     value: d.author_url,  style: TextInputStyle.Short, required: false, maxLength: 500 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'add_field' && arg) {
        const modal = buildSimpleModal(`adv_modal:embeds:save_field:${userId}:${encodeURIComponent(arg)}`, '➕ Ajouter un field', [
          { id: 'name',   label: 'Nom du field',        style: TextInputStyle.Short,     maxLength: 256 },
          { id: 'value',  label: 'Valeur',              style: TextInputStyle.Paragraph, maxLength: 1024 },
          { id: 'inline', label: 'Inline ? (oui/non)',  style: TextInputStyle.Short,     required: false, maxLength: 3, placeholder: 'non' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'rm_field' && arg) {
        const modal = buildSimpleModal(`adv_modal:embeds:rm_field:${userId}:${encodeURIComponent(arg)}`, '➖ Retirer un field', [
          { id: 'index', label: 'Numéro du field (à partir de 1)', style: TextInputStyle.Short, maxLength: 3, placeholder: '1' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'toggle_ts' && arg) {
        const tpl = db.getEmbedTemplate(interaction.guildId, arg);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        d.timestamp = !d.timestamp;
        db.upsertEmbedTemplate(interaction.guildId, arg, d, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, userId, db, arg));
      }
      if (action === 'reset' && arg) {
        db.upsertEmbedTemplate(interaction.guildId, arg, { title: null, description: null, color: null }, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, userId, db, arg));
      }
    }

    // ── AUTORESPONDER ─────────────────────────────────────────
    if (section === 'autoresp') {
      if (action === 'list') {
        return interaction.update(buildAutorespPanel(cfg, interaction.guild, userId, db, 0));
      }
      if (action === 'page') {
        return interaction.update(buildAutorespPanel(cfg, interaction.guild, userId, db, parseInt(arg, 10) || 0));
      }
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:autoresp:create:${userId}`, '➕ Nouvelle réponse auto', [
          { id: 'trigger',  label: 'Mot-clé déclencheur',                   placeholder: 'bonjour',     style: TextInputStyle.Short,     maxLength: 100 },
          { id: 'response', label: 'Réponse (variables autorisées)',        placeholder: 'Salut {user}!', style: TextInputStyle.Paragraph, maxLength: 2000 },
          { id: 'exact',    label: 'Match exact ? (oui/non)',                placeholder: 'non',         style: TextInputStyle.Short,     required: false, maxLength: 3 },
          { id: 'cooldown', label: 'Cooldown secondes (0 = aucun)',          placeholder: '0',           style: TextInputStyle.Short,     required: false, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:autoresp:del_pick:${userId}`, '🗑️ Supprimer une réponse auto', [
          { id: 'trigger', label: 'Mot-clé déclencheur', style: TextInputStyle.Short, maxLength: 100 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── LEVEL ROLES ───────────────────────────────────────────
    if (section === 'level_roles') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:level_roles:set_level:${userId}`, '➕ Rôle pour un niveau', [
          { id: 'level', label: 'Niveau requis (1-500)', style: TextInputStyle.Short, maxLength: 3, placeholder: '5' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:level_roles:del_pick:${userId}`, '🗑️ Retirer un rôle de niveau', [
          { id: 'level', label: 'Niveau à retirer', style: TextInputStyle.Short, maxLength: 3, placeholder: '5' },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'pick_role' && arg) {
        // arg = level
        const sel = new RoleSelectMenuBuilder()
          .setCustomId(`adv_role:level_roles:${userId}:${arg}`)
          .setPlaceholder(`🎭 Rôle à attribuer au niveau ${arg}`)
          .setMinValues(1).setMaxValues(1);
        const back = new ButtonBuilder().setCustomId(`adv:level_roles:list:${userId}`).setLabel('← Annuler').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`🏆 Rôle pour le niveau ${arg}`).setDescription('Sélectionne le rôle à attribuer.')],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
      if (action === 'list') {
        return interaction.update(buildLevelRolesPanel(cfg, interaction.guild, userId, db));
      }
    }

    // ── BACKUP / IMPORT ───────────────────────────────────────
    if (section === 'backup') {
      if (action === 'export') {
        const payload = db.exportGuildConfig(interaction.guildId);
        const json = JSON.stringify(payload, null, 2);
        // Limite Discord 25 MB pour attachements ; le JSON reste petit
        const buf = Buffer.from(json, 'utf8');
        if (buf.length > 8_000_000) {
          return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Config trop volumineuse pour être envoyée (>8 MB).', ephemeral: true }).catch(() => {});
        }
        const { AttachmentBuilder } = require('discord.js');
        const file = new AttachmentBuilder(buf, { name: `nexusbot_config_${interaction.guild.name.replace(/[^a-z0-9_\-]/gi, '_')}.json` });
        return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          content: '✅ Voici ta sauvegarde complète. Garde-la précieusement — tu pourras la ré-importer plus tard.',
          files: [file],
          ephemeral: true,
        });
      }
      if (action === 'import') {
        const modal = buildSimpleModal(`adv_modal:backup:do_import:${userId}`, '📥 Importer une config', [
          { id: 'json', label: 'Colle ici le JSON d\'export', placeholder: '{"_meta":{...}, ...}', style: TextInputStyle.Paragraph, maxLength: 4000 },
          { id: 'confirm', label: 'Tape CONFIRMER pour valider (écrase !)', placeholder: 'CONFIRMER', style: TextInputStyle.Short, maxLength: 20 },
        ]);
        return interaction.showModal(modal);
      }
    }

    // ── ALIASES ───────────────────────────────────────────────
    if (section === 'aliases') {
      if (action === 'new') {
        const modal = buildSimpleModal(`adv_modal:aliases:create:${userId}`, '➕ Nouvel alias', [
          { id: 'alias',  label: 'Alias (ex: r)',            placeholder: 'r',    style: TextInputStyle.Short, maxLength: 30 },
          { id: 'target', label: 'Commande cible (ex: role)', placeholder: 'role', style: TextInputStyle.Short, maxLength: 30 },
        ]);
        return interaction.showModal(modal);
      }
      if (action === 'del') {
        const modal = buildSimpleModal(`adv_modal:aliases:del_pick:${userId}`, '🗑️ Supprimer un alias', [
          { id: 'alias', label: 'Alias à supprimer', placeholder: 'r', style: TextInputStyle.Short, maxLength: 30 },
        ]);
        return interaction.showModal(modal);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SELECT MENUS (adv_sel:...)
  // ─────────────────────────────────────────────────────────────
  if (customId.startsWith('adv_sel:') && interaction.isStringSelectMenu()) {
    const which = parts[1];
    const uid   = parts[2];
    if (interaction.user.id !== uid) {
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true }).catch(() => {});
    }
    const val = interaction.values[0];
    if (which === 'embeds_pick') {
      return interaction.update(buildEmbedPreviewPanel(cfg, interaction.guild, uid, db, val));
    }
    if (which === 'cmds_pick') {
      return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, uid, db, val));
    }
    if (which === 'sys_pick') {
      return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, uid, db, val));
    }
    if (which === 'cmd_ctrl_pick') {
      return interaction.update(buildCmdCtrlDetailPanel(cfg, interaction.guild, uid, db, val));
    }
    if (which === 'autoresp_pick') {
      return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, uid, db, val));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // CHANNEL SELECTORS (adv_chan:...)
  // ─────────────────────────────────────────────────────────────
  if (customId.startsWith('adv_chan:') && interaction.isChannelSelectMenu()) {
    const which = parts[1];
    const uid   = parts[2];
    if (interaction.user.id !== uid) {
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true }).catch(() => {});
    }
    const channelId = interaction.values[0] || null;

    if (which === 'sys_msgs') {
      const eventKey = parts[3];
      const m = db.getSystemMessage(interaction.guildId, eventKey);
      db.upsertSystemMessage(interaction.guildId, eventKey, {
        enabled: m?.enabled ?? 1,
        mode: m?.mode || 'text',
        content: m?.content,
        embed_json: m?.embed_json,
        channel_id: channelId,
      });
      await interaction.deferUpdate();
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildSysMsgDetailPanel(cfg, interaction.guild, uid, db, eventKey)).catch(() => {});
    }

    if (which === 'ai_channels') {
      const aiMod = _getAiModule();
      const ids = Array.isArray(interaction.values) ? interaction.values : [];
      if (aiMod) aiMod.setAIConfig(interaction.guildId, db, { allowed_channels: ids });
      await interaction.deferUpdate();
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildAIPanel(cfg, interaction.guild, uid, db)).catch(() => {});
    }

    if (which === 'cmds_chans') {
      const trigger = parts[3] ? decodeURIComponent(parts[3]) : null;
      const ids = Array.isArray(interaction.values) ? interaction.values : [];
      const c = trigger ? db.getCustomCommand(interaction.guildId, trigger) : null;
      if (c) {
        db.upsertCustomCommand(interaction.guildId, trigger, {
          ...c,
          allowed_channels: ids,
          created_by: c.created_by,
        });
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildCmdDetailPanel(cfg, interaction.guild, uid, db, trigger));
    }

    if (which === 'autoresp_chans') {
      const trigger = parts[3] ? decodeURIComponent(parts[3]) : null;
      const ids = Array.isArray(interaction.values) ? interaction.values : [];
      const a = trigger ? db.getAutoresponder(interaction.guildId, trigger) : null;
      if (a) {
        db.upsertAutoresponder(interaction.guildId, trigger, {
          ...a,
          allowed_channels: ids,
        });
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildAutorespDetailPanel(cfg, interaction.guild, uid, db, trigger));
    }

    if (which === 'embeds_send') {
      const name = parts[3] ? decodeURIComponent(parts[3]) : null;
      const tpl = name ? db.getEmbedTemplate(interaction.guildId, name) : null;
      if (!tpl || !channelId) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Impossible d\'envoyer : template ou salon manquant.', ephemeral: true });
      }
      const data = safeJsonParse(tpl.data_json, {});
      const ctx = {
        userMention: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        serverName: interaction.guild.name,
        memberCount: interaction.guild.memberCount,
      };
      const eb = rebuildEmbedFromData(applyVarsToTemplate(data, ctx));
      const chan = interaction.guild.channels.cache.get(channelId);
      if (!chan) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Salon introuvable.', ephemeral: true });
      try {
        await chan.send({ embeds: [eb] });
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Envoi impossible : ${e.message?.slice(0, 150)}`, ephemeral: true });
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildEmbedsPanel(cfg, interaction.guild, uid, db));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ROLE SELECTORS (adv_role:...)
  // ─────────────────────────────────────────────────────────────
  if (customId.startsWith('adv_role:') && interaction.isRoleSelectMenu()) {
    const which = parts[1];
    const uid   = parts[2];
    if (interaction.user.id !== uid) {
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true }).catch(() => {});
    }
    const roleId = interaction.values[0] || null;

    if (which === 'cmds_adv') {
      const trigger = parts[3] ? decodeURIComponent(parts[3]) : null;
      const c = trigger ? db.getCustomCommand(interaction.guildId, trigger) : null;
      if (c) {
        db.upsertCustomCommand(interaction.guildId, trigger, {
          ...c,
          allowed_channels: safeJsonParse(c.allowed_channels, []),
          required_role: roleId,
          created_by: c.created_by,
        });
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildCmdDetailPanel(cfg, interaction.guild, uid, db, trigger));
    }

    if (which === 'level_roles') {
      // parts[3] = level
      const level = parseInt(parts[3], 10);
      if (!isNaN(level) && roleId) {
        db.addLevelRole(interaction.guildId, level, roleId);
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildLevelRolesPanel(cfg, interaction.guild, uid, db));
    }

    if (which === 'ai_required') {
      const aiMod = _getAiModule();
      if (aiMod) aiMod.setAIConfig(interaction.guildId, db, { required_role: roleId });
      await interaction.deferUpdate();
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildAIPanel(cfg, interaction.guild, uid, db)).catch(() => {});
    }

    if (which === 'autoresp_role') {
      const trigger = parts[3] ? decodeURIComponent(parts[3]) : null;
      const a = trigger ? db.getAutoresponder(interaction.guildId, trigger) : null;
      if (a) {
        db.upsertAutoresponder(interaction.guildId, trigger, {
          ...a,
          allowed_channels: safeJsonParse(a.allowed_channels, []),
          required_role: roleId,
        });
      }
      await interaction.deferUpdate();
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(buildAutorespDetailPanel(cfg, interaction.guild, uid, db, trigger));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MODAL SUBMITS (adv_modal:...)
  // ─────────────────────────────────────────────────────────────
  if (customId.startsWith('adv_modal:') && interaction.isModalSubmit()) {
    const sect = parts[1];
    const act  = parts[2];
    const uid  = parts[3];
    if (interaction.user.id !== uid) {
      return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true }).catch(() => {});
    }
    const extra = parts[4] ? decodeURIComponent(parts[4]) : null;
    const field = (id, def = '') => { try { return interaction.fields.getTextInputValue(id); } catch { return def; } };

    // ── EMBEDS ────────────────────────────────────────────────
    if (sect === 'embeds') {
      if (act === 'create') {
        const name = field('name').toLowerCase().trim().replace(/\s+/g, '_');
        if (!name) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Nom requis.', ephemeral: true });
        const data = {
          title:       field('title').trim() || null,
          description: field('description').trim() || null,
          color:       field('color').trim() || null,
          footer_text: field('footer_text').trim() || null,
        };
        if (!data.title && !data.description) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ajoute au moins un titre ou une description.', ephemeral: true });
        }
        db.upsertEmbedTemplate(interaction.guildId, name, data, interaction.user.id);
        return interaction.update(buildEmbedsPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'update' && extra) {
        const current = db.getEmbedTemplate(interaction.guildId, extra);
        const data = current ? safeJsonParse(current.data_json, {}) : {};
        data.title       = field('title').trim()       || null;
        data.description = field('description').trim() || null;
        data.color       = field('color').trim()       || null;
        data.footer_text = field('footer_text').trim() || null;
        data.image       = field('image').trim()       || null;
        db.upsertEmbedTemplate(interaction.guildId, extra, data, interaction.user.id);
        return interaction.update(buildEmbedPreviewPanel(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'edit_name') {
        const name = field('name').toLowerCase().trim();
        const tpl = db.getEmbedTemplate(interaction.guildId, name);
        if (!tpl) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Template \`${name}\` introuvable.`, ephemeral: true });
        return interaction.update(buildEmbedPreviewPanel(cfg, interaction.guild, uid, db, name));
      }
      if (act === 'send_name') {
        const name = field('name').toLowerCase().trim();
        const tpl = db.getEmbedTemplate(interaction.guildId, name);
        if (!tpl) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Template \`${name}\` introuvable.`, ephemeral: true });
        return interaction.update(buildEmbedPreviewPanel(cfg, interaction.guild, uid, db, name));
      }
      if (act === 'del_name') {
        const name = field('name').toLowerCase().trim();
        const n = db.deleteEmbedTemplate(interaction.guildId, name);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Template \`${name}\` introuvable.`, ephemeral: true });
        return interaction.update(buildEmbedsPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── COMMANDES CUSTOM ──────────────────────────────────────
    if (sect === 'cmds_adv') {
      if (act === 'create_text') {
        const trigger  = field('trigger').toLowerCase().trim().replace(/\s+/g, '_').replace(/^&+/, '');
        const response = field('response').trim();
        const cooldown = parseInt(field('cooldown', '0'), 10) || 0;
        if (!trigger || !response) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Déclencheur et réponse obligatoires.', ephemeral: true });
        db.upsertCustomCommand(interaction.guildId, trigger, {
          response, response_type: 'text',
          cooldown, enabled: 1, created_by: interaction.user.id,
        });
        return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'create_embed') {
        const trigger     = field('trigger').toLowerCase().trim().replace(/\s+/g, '_').replace(/^&+/, '');
        const title       = field('title').trim();
        const description = field('description').trim();
        const color       = field('color').trim() || null;
        const cooldown    = parseInt(field('cooldown', '0'), 10) || 0;
        if (!trigger) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Déclencheur obligatoire.', ephemeral: true });
        if (!title && !description) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ajoute au moins un titre ou une description.', ephemeral: true });
        const embedJson = JSON.stringify({ title: title || null, description: description || null, color });
        db.upsertCustomCommand(interaction.guildId, trigger, {
          response: title || description || '',
          response_type: 'embed',
          embed_json: embedJson,
          cooldown, enabled: 1, created_by: interaction.user.id,
        });
        return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'edit_pick' || act === 'toggle_pick' || act === 'del_pick') {
        const trigger = field('trigger').toLowerCase().trim().replace(/^&+/, '');
        const c = db.getCustomCommand(interaction.guildId, trigger);
        if (!c) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ \`&${trigger}\` introuvable.`, ephemeral: true });
        if (act === 'del_pick') {
          db.deleteCustomCommand(interaction.guildId, trigger);
          return interaction.update(buildCmdsAdvPanel(cfg, interaction.guild, uid, db, 0));
        }
        if (act === 'toggle_pick') {
          db.upsertCustomCommand(interaction.guildId, trigger, {
            ...c,
            allowed_channels: safeJsonParse(c.allowed_channels, []),
            enabled: c.enabled ? 0 : 1,
            created_by: c.created_by,
          });
        }
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, uid, db, trigger));
      }
      if (act === 'save_resp' && extra) {
        const c = db.getCustomCommand(interaction.guildId, extra);
        if (!c) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Introuvable.', ephemeral: true }).catch(() => {});
        const response = field('response').trim();
        db.upsertCustomCommand(interaction.guildId, extra, {
          ...c, allowed_channels: safeJsonParse(c.allowed_channels, []),
          response, created_by: c.created_by,
        });
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'save_cd' && extra) {
        const c = db.getCustomCommand(interaction.guildId, extra);
        if (!c) return await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Introuvable.', ephemeral: true }).catch(() => {});
        const cd = Math.max(0, parseInt(field('seconds', '0'), 10) || 0);
        db.upsertCustomCommand(interaction.guildId, extra, {
          ...c, allowed_channels: safeJsonParse(c.allowed_channels, []),
          cooldown: cd, created_by: c.created_by,
        });
        return interaction.update(buildCmdDetailPanel(cfg, interaction.guild, uid, db, extra));
      }
    }

    // ── MESSAGES SYSTÈME ──────────────────────────────────────
    if (sect === 'sys_msgs') {
      const eventKey = extra;
      if (!eventKey) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Événement manquant.', ephemeral: true });
      const m = db.getSystemMessage(interaction.guildId, eventKey);

      if (act === 'save_text') {
        const content = field('content').trim() || null;
        db.upsertSystemMessage(interaction.guildId, eventKey, {
          enabled: m?.enabled ?? 1, mode: m?.mode || (content ? 'text' : 'text'),
          content, embed_json: m?.embed_json, channel_id: m?.channel_id,
        });
        return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, uid, db, eventKey));
      }
      if (act === 'save_embed') {
        const raw = field('embed_json').trim() || null;
        if (raw) {
          const parsed = safeJsonParse(raw, null);
          if (!parsed) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ JSON invalide.', ephemeral: true });
        }
        db.upsertSystemMessage(interaction.guildId, eventKey, {
          enabled: m?.enabled ?? 1, mode: m?.mode === 'text' ? 'embed' : (m?.mode || 'embed'),
          content: m?.content, embed_json: raw, channel_id: m?.channel_id,
        });
        return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, uid, db, eventKey));
      }
    }

    // ── COOLDOWNS / TOGGLES ───────────────────────────────────
    if (sect === 'cmd_ctrl') {
      if (act === 'save_cd' && extra) {
        const raw = field('seconds').trim();
        const cd = parseInt(raw, 10);
        if (raw === '' || cd === 0) {
          db.removeCooldownOverride(interaction.guildId, extra);
        } else {
          if (isNaN(cd) || cd < 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Nombre entier positif attendu.', ephemeral: true });
          db.setCooldownOverride(interaction.guildId, extra, cd);
        }
        return interaction.update(buildCmdCtrlDetailPanel(cfg, interaction.guild, uid, db, extra));
      }
    }

    // ── ⚡ ÉCONOMIE PRO — saves ───────────────────────────────
    if (sect === 'eco_pro') {
      const toInt = (s, d = 0) => {
        const n = parseInt(String(s).replace(/[\s,_]/g, ''), 10);
        return isNaN(n) ? d : n;
      };
      if (act === 'save_work') {
        db.setConfig(interaction.guildId, 'work_min',      toInt(field('min'),      10));
        db.setConfig(interaction.guildId, 'work_max',      toInt(field('max'),      100));
        db.setConfig(interaction.guildId, 'work_cooldown', toInt(field('cooldown'), 3600));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_crime') {
        db.setConfig(interaction.guildId, 'crime_min',       toInt(field('min'),      50));
        db.setConfig(interaction.guildId, 'crime_max',       toInt(field('max'),      500));
        db.setConfig(interaction.guildId, 'crime_cooldown',  toInt(field('cooldown'), 7200));
        db.setConfig(interaction.guildId, 'crime_fail_rate', toInt(field('fail'),     40));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_rob') {
        db.setConfig(interaction.guildId, 'rob_max_percent',  toInt(field('max_pct'),  30));
        db.setConfig(interaction.guildId, 'rob_fail_penalty', toInt(field('penalty'),  100));
        db.setConfig(interaction.guildId, 'rob_cooldown',     toInt(field('cooldown'), 14400));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_daily') {
        db.setConfig(interaction.guildId, 'daily_amount',       toInt(field('amount'),   25));
        db.setConfig(interaction.guildId, 'daily_cooldown',     toInt(field('cooldown'), 86400));
        db.setConfig(interaction.guildId, 'daily_streak_bonus', toInt(field('streak'),   10));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_bank') {
        db.setConfig(interaction.guildId, 'bank_interest_rate', toInt(field('interest'), 0));
        db.setConfig(interaction.guildId, 'bank_max_deposit',   toInt(field('max_dep'),  -1));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_tax') {
        db.setConfig(interaction.guildId, 'shop_tax_rate', toInt(field('rate'), 0));
        return interaction.update(buildEcoProPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 📊 XP PRO — save (extra = nom de la colonne) ─────────
    if (sect === 'xp_pro' && act === 'save' && extra) {
      const raw = field('value').trim().replace(/[\s,_]/g, '');
      const n = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
      if (isNaN(n)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Valeur numérique requise.', ephemeral: true });
      db.setConfig(interaction.guildId, extra, extra === 'xp_multiplier' ? n : Math.trunc(n));
      return interaction.update(buildXpProPanel(cfg, interaction.guild, uid, db));
    }

    // ── 🔨 MODÉRATION PRO — saves ────────────────────────────
    if (sect === 'mod_pro') {
      const toInt = (s, d = 0) => { const n = parseInt(String(s).replace(/[\s,_]/g, ''), 10); return isNaN(n) ? d : n; };
      if (act === 'save_seuils') {
        db.setConfig(interaction.guildId, 'escalate_mute_count', toInt(field('mute'), 3));
        db.setConfig(interaction.guildId, 'escalate_kick_count', toInt(field('kick'), 5));
        db.setConfig(interaction.guildId, 'escalate_ban_count',  toInt(field('ban'),  10));
        return interaction.update(buildModProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_mute') {
        db.setConfig(interaction.guildId, 'default_mute_duration', toInt(field('value'), 3600));
        return interaction.update(buildModProPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_expire') {
        db.setConfig(interaction.guildId, 'warn_expire_days', toInt(field('value'), 30));
        return interaction.update(buildModProPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 🛡️ ANTIRAID — save modals ────────────────────────────
    if (sect === 'antiraid') {
      if (act === 'save_thresh') {
        const t = parseInt(field('threshold'), 10);
        const w = parseInt(field('window'), 10);
        if (isNaN(t) || t < 2) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Seuil invalide (>=2).', ephemeral: true });
        if (isNaN(w) || w < 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Fenêtre invalide (>=5s).', ephemeral: true });
        db.setAntiraidField(interaction.guildId, 'join_threshold', t);
        db.setAntiraidField(interaction.guildId, 'join_window_secs', w);
        return interaction.update(buildAntiraidPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_newacc') {
        const d = parseInt(field('days'), 10);
        const a = field('action', 'kick').toLowerCase().trim();
        if (isNaN(d) || d < 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Jours invalides.', ephemeral: true });
        if (!['kick', 'ban', 'mute'].includes(a)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Action : kick, ban ou mute.', ephemeral: true });
        db.setAntiraidField(interaction.guildId, 'new_account_days', d);
        db.setAntiraidField(interaction.guildId, 'new_account_action', a);
        return interaction.update(buildAntiraidPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 📺 YOUTUBE / 🎮 TWITCH ────────────────────────────────
    if (sect === 'youtube' || sect === 'twitch') {
      if (act === 'create') {
        const channel_id = field('channel_id').trim();
        const target     = field('target').trim();
        const message    = field('message').trim() || null;
        if (!channel_id || !target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Salon + cible requis.', ephemeral: true });
        if (sect === 'youtube') db.addYoutubeSub(interaction.guildId, { channel_id, yt_channel_id: target, message });
        else                    db.addTwitchSub(interaction.guildId, { channel_id, twitch_login: target.toLowerCase(), message });
        return interaction.update(sect === 'youtube' ? buildYoutubePanel(cfg, interaction.guild, uid, db) : buildTwitchPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        if (isNaN(id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ ID invalide.', ephemeral: true });
        const n = sect === 'youtube' ? db.removeYoutubeSub(interaction.guildId, id) : db.removeTwitchSub(interaction.guildId, id);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ #${id} introuvable.`, ephemeral: true });
        return interaction.update(sect === 'youtube' ? buildYoutubePanel(cfg, interaction.guild, uid, db) : buildTwitchPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 🎁 GIVEAWAYS ──────────────────────────────────────────
    if (sect === 'giveaways') {
      const id = parseInt(field('id'), 10);
      if (isNaN(id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ ID invalide.', ephemeral: true });
      if (act === 'end_pick')    { db.endGiveaway(interaction.guildId, id);    return interaction.update(buildGiveawaysPanel(cfg, interaction.guild, uid, db)); }
      if (act === 'cancel_pick') { db.cancelGiveaway(interaction.guildId, id); return interaction.update(buildGiveawaysPanel(cfg, interaction.guild, uid, db)); }
    }

    // ── ⏰ SCHEDULED ──────────────────────────────────────────
    if (sect === 'scheduled') {
      if (act === 'create') {
        const channel_id = field('channel_id').trim();
        const cron       = field('cron').trim();
        const content    = field('content').trim();
        if (!channel_id || !cron || !content) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tous les champs requis.', ephemeral: true });
        // Validation basique du cron (5 tokens)
        if (cron.split(/\s+/).length !== 5) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Expression CRON invalide (5 tokens).', ephemeral: true });
        db.createScheduledMessage(interaction.guildId, { channel_id, cron, content, enabled: 1, created_by: interaction.user.id });
        return interaction.update(buildScheduledPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'toggle_pick') {
        const id = parseInt(field('id'), 10);
        if (isNaN(id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ ID invalide.', ephemeral: true });
        db.toggleScheduledMessage(interaction.guildId, id);
        return interaction.update(buildScheduledPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        if (isNaN(id)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ ID invalide.', ephemeral: true });
        db.deleteScheduledMessage(interaction.guildId, id);
        return interaction.update(buildScheduledPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 📋 QUÊTES ─────────────────────────────────────────────
    if (sect === 'quests') {
      if (act === 'create') {
        db.createQuest(interaction.guildId, {
          title:       field('title').trim(),
          description: field('description').trim(),
          target:      parseInt(field('target'), 10) || 0,
          reward:      field('reward').trim(),
        });
        return interaction.update(buildQuestsPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        db.deleteQuest(interaction.guildId, id);
        return interaction.update(buildQuestsPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 📬 SONDAGES ───────────────────────────────────────────
    if (sect === 'polls' && act === 'end_pick') {
      const id = parseInt(field('id'), 10);
      db.endPoll(interaction.guildId, id);
      return interaction.update(buildPollsPanel(cfg, interaction.guild, uid, db));
    }

    // ── 🗣️ TEXTES UI — save / reset_one ──────────────────────
    if (sect === 'ui_texts') {
      const i18n = (() => { try { return require('./i18n'); } catch { return null; } })();
      if (!i18n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Module i18n indisponible.', ephemeral: true });
      if (act === 'save') {
        const key = field('key').trim();
        if (!key) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Identifiant requis.', ephemeral: true });
        const value = field('value').trim();
        i18n.setText(interaction.guildId, db, key, value || null);
        return interaction.update(buildUiTextsPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'reset_one') {
        const key = field('key').trim();
        if (!key) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Identifiant requis.', ephemeral: true });
        i18n.setText(interaction.guildId, db, key, null);
        return interaction.update(buildUiTextsPanel(cfg, interaction.guild, uid, db, 0));
      }
    }

    // ── 🗄️ KV : view / set / del ─────────────────────────────
    if (sect === 'kv') {
      const source = extra || 'kv'; // 'kv' ou 'gc'
      const key = field('key', '').trim();
      if (!key) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Clé requise.', ephemeral: true });

      if (act === 'do_view') {
        let val;
        if (source === 'gc') {
          const gc = db.getConfig(interaction.guildId);
          if (!(key in gc)) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Colonne \`${key}\` inexistante.`, ephemeral: true });
          val = gc[key];
        } else {
          val = db.kvGet(interaction.guildId, key);
          if (val === null || val === undefined) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Clé \`${key}\` inexistante.`, ephemeral: true });
        }
        const display = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`🔍 ${key}`)
            .setDescription('```' + truncate(display, 3800) + '```')
            .setFooter({ text: `Source: ${source === 'gc' ? 'guild_config' : 'guild_kv'}` })],
          ephemeral: true,
        });
      }

      if (act === 'do_set') {
        const rawValue = field('value', '').trim();
        try {
          if (source === 'gc') {
            // Tenter typage int / null
            let typed = rawValue;
            if (typed === '' || typed.toUpperCase() === 'NULL') typed = null;
            else if (/^-?\d+$/.test(typed)) typed = parseInt(typed, 10);
            else if (/^-?\d*\.\d+$/.test(typed)) typed = parseFloat(typed);
            db.setGuildConfigColumn(interaction.guildId, key, typed);
          } else {
            const parsed = safeJsonParse(rawValue, rawValue);
            db.kvSet(interaction.guildId, key, parsed);
          }
          return interaction.update(buildKvPanel(cfg, interaction.guild, uid, db, 0, source));
        } catch (e) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }

      if (act === 'do_del') {
        try {
          if (source === 'gc') {
            db.setGuildConfigColumn(interaction.guildId, key, null);
          } else {
            db.kvDelete(interaction.guildId, key);
          }
          return interaction.update(buildKvPanel(cfg, interaction.guild, uid, db, 0, source));
        } catch (e) {
          return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ ${e.message}`, ephemeral: true });
        }
      }
    }

    // ── 🛒 SHOP ───────────────────────────────────────────────
    if (sect === 'shop') {
      if (act === 'create') {
        const price = parseInt(field('price'), 10);
        if (isNaN(price) || price < 0) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Prix invalide.', ephemeral: true });
        const item = db.createShopItem(interaction.guildId, {
          name: field('name').trim(),
          description: field('description').trim() || null,
          emoji: field('emoji').trim() || '📦',
          price,
          stock: parseInt(field('stock', '-1'), 10),
        });
        return interaction.update(buildShopPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        const n = isNaN(id) ? 0 : db.deleteShopItem(interaction.guildId, id);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Item #${id} introuvable.`, ephemeral: true });
        return interaction.update(buildShopPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'toggle_pick') {
        const id = parseInt(field('id'), 10);
        const it = isNaN(id) ? null : db.getShopItem(interaction.guildId, id);
        if (!it) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Item #${id} introuvable.`, ephemeral: true });
        db.updateShopItem(interaction.guildId, id, { active: it.active ? 0 : 1 });
        return interaction.update(buildShopPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'edit_pick') {
        const id = parseInt(field('id'), 10);
        const it = isNaN(id) ? null : db.getShopItem(interaction.guildId, id);
        if (!it) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Item #${id} introuvable.`, ephemeral: true });
        const modal = buildSimpleModal(`adv_modal:shop:save_edit:${userId}:${id}`, `✏️ Modifier #${id}`, [
          { id: 'name',        label: 'Nom',          value: it.name,            style: TextInputStyle.Short,     maxLength: 100 },
          { id: 'description', label: 'Description',  value: it.description || '', style: TextInputStyle.Paragraph, required: false, maxLength: 500 },
          { id: 'price',       label: 'Prix',          value: String(it.price),  style: TextInputStyle.Short,     maxLength: 10 },
          { id: 'emoji',       label: 'Emoji',         value: it.emoji || '',     style: TextInputStyle.Short,     required: false, maxLength: 10 },
          { id: 'stock',       label: 'Stock',         value: String(it.stock),   style: TextInputStyle.Short,     maxLength: 10 },
        ]);
        return interaction.showModal(modal);
      }
      if (act === 'save_edit' && extra) {
        const id = parseInt(extra, 10);
        db.updateShopItem(interaction.guildId, id, {
          name:        field('name').trim(),
          description: field('description').trim() || null,
          price:       parseInt(field('price'), 10),
          emoji:       field('emoji').trim() || '📦',
          stock:       parseInt(field('stock'), 10),
        });
        return interaction.update(buildShopPanel(cfg, interaction.guild, uid, db, 0));
      }
    }

    // ── ⭐ REACTION ROLES ────────────────────────────────────
    if (sect === 'reaction_roles') {
      if (act === 'create') {
        const mid = field('message_id').trim();
        const cid = field('channel_id').trim();
        const emoji = field('emoji').trim();
        const rid = field('role_id').trim();
        if (!mid || !cid || !emoji || !rid) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tous les champs requis.', ephemeral: true });
        db.addReactionRole(interaction.guildId, mid, cid, emoji, rid);
        return interaction.update(buildReactionRolesPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        const n = isNaN(id) ? 0 : db.removeReactionRole(interaction.guildId, id);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Reaction role #${id} introuvable.`, ephemeral: true });
        return interaction.update(buildReactionRolesPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 📜 ROLE MENUS ────────────────────────────────────────
    if (sect === 'role_menus') {
      if (act === 'create') {
        const ids = field('role_ids').split(',').map(s => s.trim()).filter(Boolean);
        if (!ids.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Au moins un rôle requis.', ephemeral: true });
        db.createRoleMenu(interaction.guildId, {
          title: field('title').trim(),
          description: field('description').trim() || null,
          roles: ids,
          max_choices: parseInt(field('max_choices', '0'), 10) || 0,
        });
        return interaction.update(buildRoleMenusPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const id = parseInt(field('id'), 10);
        const n = isNaN(id) ? 0 : db.deleteRoleMenu(interaction.guildId, id);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Menu #${id} introuvable.`, ephemeral: true });
        return interaction.update(buildRoleMenusPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── 🔁 AUTORESP : save_resp + save_cd ───────────────────
    if (sect === 'autoresp') {
      if (act === 'save_resp' && extra) {
        const a = db.getAutoresponder(interaction.guildId, extra);
        if (!a) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Introuvable.', ephemeral: true });
        db.upsertAutoresponder(interaction.guildId, extra, {
          ...a,
          allowed_channels: safeJsonParse(a.allowed_channels, []),
          response: field('response').trim(),
        });
        return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'save_cd' && extra) {
        const a = db.getAutoresponder(interaction.guildId, extra);
        if (!a) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Introuvable.', ephemeral: true });
        const cd = Math.max(0, parseInt(field('seconds', '0'), 10) || 0);
        db.upsertAutoresponder(interaction.guildId, extra, {
          ...a,
          allowed_channels: safeJsonParse(a.allowed_channels, []),
          cooldown: cd,
        });
        return interaction.update(buildAutorespDetailPanel(cfg, interaction.guild, uid, db, extra));
      }
    }

    // ── 📢 SYS MSGS CUSTOM ───────────────────────────────────
    if (sect === 'sys_msgs' && act === 'create_custom') {
      const ev = field('event').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (!ev) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Nom d\'événement invalide.', ephemeral: true });
      const content = field('content').trim() || null;
      db.upsertSystemMessage(interaction.guildId, ev, {
        enabled: 1, mode: 'text', content, embed_json: null, channel_id: null,
      });
      return interaction.update(buildSysMsgDetailPanel(cfg, interaction.guild, uid, db, ev));
    }

    // ── 🧠 IA : save model / tokens / prompt ─────────────────
    if (sect === 'ai') {
      const aiMod = _getAiModule();
      if (!aiMod) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Module IA introuvable.', ephemeral: true });
      if (act === 'save_model') {
        const v = field('model').trim() || 'claude-3-5-haiku-20241022';
        aiMod.setAIConfig(interaction.guildId, db, { model: v });
        return interaction.update(buildAIPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_tokens') {
        const n = parseInt(field('max_tokens'), 10);
        if (isNaN(n) || n < 64 || n > 2048) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Valeur invalide (64-2048).', ephemeral: true });
        aiMod.setAIConfig(interaction.guildId, db, { max_tokens: n });
        return interaction.update(buildAIPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'save_prompt') {
        const v = field('system_prompt').trim() || null;
        aiMod.setAIConfig(interaction.guildId, db, { system_prompt: v });
        return interaction.update(buildAIPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── ÉDITEUR EMBED : sauvegardes de chaque propriété ──────
    if (sect === 'embeds') {
      const saveFieldMap = {
        save_title:       'title',
        save_description: 'description',
        save_color:       'color',
        save_url:         'url',
        save_image:       'image',
        save_thumbnail:   'thumbnail',
        save_footer_text: 'footer_text',
      };
      if (saveFieldMap[act] && extra) {
        const key = saveFieldMap[act];
        const val = field('value').trim();
        const tpl = db.getEmbedTemplate(interaction.guildId, extra);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        d[key] = val || null;
        db.upsertEmbedTemplate(interaction.guildId, extra, d, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'save_author' && extra) {
        const tpl = db.getEmbedTemplate(interaction.guildId, extra);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        d.author_name = field('author_name').trim() || null;
        d.author_icon = field('author_icon').trim() || null;
        d.author_url  = field('author_url').trim()  || null;
        db.upsertEmbedTemplate(interaction.guildId, extra, d, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'save_field' && extra) {
        const name   = field('name').trim();
        const value  = field('value').trim();
        const inline = /^(oui|yes|y|o|true|1)$/i.test(field('inline', 'non').trim());
        if (!name || !value) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Nom ET valeur requis.', ephemeral: true });
        const tpl = db.getEmbedTemplate(interaction.guildId, extra);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        if (!Array.isArray(d.fields)) d.fields = [];
        if (d.fields.length >= 25) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Max 25 fields atteint.', ephemeral: true });
        d.fields.push({ name, value, inline });
        db.upsertEmbedTemplate(interaction.guildId, extra, d, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, uid, db, extra));
      }
      if (act === 'rm_field' && extra) {
        const idx = parseInt(field('index'), 10);
        if (isNaN(idx) || idx < 1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Numéro invalide.', ephemeral: true });
        const tpl = db.getEmbedTemplate(interaction.guildId, extra);
        const d = tpl ? safeJsonParse(tpl.data_json, {}) : {};
        if (!Array.isArray(d.fields) || idx > d.fields.length) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Field inexistant.', ephemeral: true });
        d.fields.splice(idx - 1, 1);
        db.upsertEmbedTemplate(interaction.guildId, extra, d, interaction.user.id);
        return interaction.update(buildEmbedEditorFull(cfg, interaction.guild, uid, db, extra));
      }
    }

    // ── AUTORESPONDER ────────────────────────────────────────
    if (sect === 'autoresp') {
      if (act === 'create') {
        const trigger  = field('trigger').toLowerCase().trim();
        const response = field('response').trim();
        const exact    = /^(oui|yes|y|o|true|1)$/i.test(field('exact', 'non').trim());
        const cd       = Math.max(0, parseInt(field('cooldown', '0'), 10) || 0);
        if (!trigger || !response) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Trigger et réponse requis.', ephemeral: true });
        db.upsertAutoresponder(interaction.guildId, trigger, { response, exact_match: exact, cooldown: cd });
        return interaction.update(buildAutorespPanel(cfg, interaction.guild, uid, db, 0));
      }
      if (act === 'del_pick') {
        const trigger = field('trigger').toLowerCase().trim();
        const n = db.deleteAutoresponder(interaction.guildId, trigger);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Trigger \`${trigger}\` introuvable.`, ephemeral: true });
        return interaction.update(buildAutorespPanel(cfg, interaction.guild, uid, db, 0));
      }
    }

    // ── LEVEL ROLES ──────────────────────────────────────────
    if (sect === 'level_roles') {
      if (act === 'set_level') {
        const level = parseInt(field('level'), 10);
        if (isNaN(level) || level < 1 || level > 500) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Niveau invalide (1-500).', ephemeral: true });
        // Ouvrir un sélecteur de rôle
        const sel = new RoleSelectMenuBuilder()
          .setCustomId(`adv_role:level_roles:${uid}:${level}`)
          .setPlaceholder(`🎭 Rôle pour le niveau ${level}`)
          .setMinValues(1).setMaxValues(1);
        const back = new ButtonBuilder().setCustomId(`adv:level_roles:list:${uid}`).setLabel('← Annuler').setStyle(ButtonStyle.Secondary);
        return interaction.update({
          embeds: [new EmbedBuilder().setColor(cfg.color || '#7B2FBE').setTitle(`🏆 Rôle pour le niveau ${level}`).setDescription('Sélectionne le rôle à attribuer automatiquement aux membres atteignant ce niveau.')],
          components: [new ActionRowBuilder().addComponents(back), new ActionRowBuilder().addComponents(sel)],
        });
      }
      if (act === 'del_pick') {
        const level = parseInt(field('level'), 10);
        if (isNaN(level) || level < 1) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Niveau invalide.', ephemeral: true });
        const n = db.removeLevelRole(interaction.guildId, level);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Aucun rôle pour le niveau ${level}.`, ephemeral: true });
        return interaction.update(buildLevelRolesPanel(cfg, interaction.guild, uid, db));
      }
    }

    // ── BACKUP / IMPORT ──────────────────────────────────────
    if (sect === 'backup' && act === 'do_import') {
      const json    = field('json').trim();
      const confirm = field('confirm').trim();
      if (confirm !== 'CONFIRMER') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Tape CONFIRMER pour valider l\'import.', ephemeral: true });
      const parsed = safeJsonParse(json, null);
      if (!parsed || typeof parsed !== 'object') return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ JSON invalide.', ephemeral: true });
      try {
        db.importGuildConfig(interaction.guildId, parsed);
      } catch (e) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Erreur import : ${e.message?.slice(0, 150)}`, ephemeral: true });
      }
      return interaction.update(buildBackupPanel(cfg, interaction.guild, uid, db));
    }

    // ── ALIASES ───────────────────────────────────────────────
    if (sect === 'aliases') {
      if (act === 'create') {
        const alias  = field('alias').toLowerCase().trim().replace(/\s+/g, '').replace(/^&+/, '');
        const target = field('target').toLowerCase().trim().replace(/\s+/g, '').replace(/^&+/, '');
        if (!alias || !target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Alias et cible requis.', ephemeral: true });
        if (alias === target) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ L\'alias doit être différent de la cible.', ephemeral: true });
        db.setAlias(interaction.guildId, alias, target, interaction.user.id);
        return interaction.update(buildAliasesPanel(cfg, interaction.guild, uid, db));
      }
      if (act === 'del_pick') {
        const alias = field('alias').toLowerCase().trim().replace(/^&+/, '');
        const n = db.deleteAlias(interaction.guildId, alias);
        if (!n) return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: `❌ Alias \`${alias}\` introuvable.`, ephemeral: true });
        return interaction.update(buildAliasesPanel(cfg, interaction.guild, uid, db));
      }
    }
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════
module.exports = {
  ADVANCED_CATEGORIES,
  SYSTEM_EVENTS,
  buildAdvancedCategoryPanel,
  isAdvancedCategory,
  handleAdvancedInteraction,
  // utilitaires réutilisables
  rebuildEmbedFromData,
  applyVars,
  applyVarsToTemplate,
  safeJsonParse,
};
