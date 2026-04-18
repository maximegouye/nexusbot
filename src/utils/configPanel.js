/**
 * NexusBot — Panneau de configuration interactif
 * Accessible via &config ou /panel
 * Navigation par menus, boutons, sélecteurs, modals
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
} = require('discord.js');

// ═══════════════════════════════════════════════════════════════
// CATÉGORIES DU PANNEAU
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
  { value: 'general',       label: '🔧 Général',          description: 'Couleur du bot, paramètres généraux' },
  { value: 'eco',           label: '💰 Économie',          description: 'Monnaie, daily, gains par message' },
  { value: 'xp',            label: '⭐ XP & Niveaux',      description: 'XP, multiplicateur, salon de niveau' },
  { value: 'bienvenue',     label: '👋 Bienvenue',         description: 'Salon et message d\'accueil' },
  { value: 'aurevoir',      label: '🚪 Au revoir',         description: 'Salon et message de départ' },
  { value: 'logs',          label: '📜 Logs',              description: 'Journaux des actions du serveur' },
  { value: 'automod',       label: '🤖 AutoMod',           description: 'Anti-liens, anti-spam, modération auto' },
  { value: 'roles',         label: '🎭 Rôles',             description: 'Rôle muet, auto-rôle à l\'arrivée' },
  { value: 'tickets',       label: '🎫 Tickets',           description: 'Salon, logs et rôle staff tickets' },
  { value: 'jeux',          label: '🎮 Jeux',              description: 'Casino, paris, mises min/max' },
  { value: 'reponses',      label: '💬 Réponses perso',    description: 'Commandes personnalisées (&déclencheur)' },
  { value: 'anniversaires', label: '🎂 Anniversaires',     description: 'Salon d\'annonce d\'anniversaire' },
  { value: 'modules',       label: '🔌 Modules',           description: 'Activer/désactiver les modules' },
];

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function onOff(val)       { return val ? '✅ Activé'   : '❌ Désactivé'; }
function chanMention(id)  { return id  ? `<#${id}>`    : '`Non défini`'; }
function roleMention(id)  { return id  ? `<@&${id}>`   : '`Non défini`'; }

function backBtn(userId) {
  return new ButtonBuilder()
    .setCustomId(`cfg:menu:${userId}`)
    .setLabel('← Retour au menu')
    .setStyle(ButtonStyle.Secondary);
}

// ═══════════════════════════════════════════════════════════════
// MENU PRINCIPAL
// ═══════════════════════════════════════════════════════════════
function buildMainMenu(cfg, guild, userId) {
  const coin = cfg.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle(`⚙️ Panneau de configuration — ${guild.name}`)
    .setThumbnail(guild.iconURL())
    .setDescription('**Sélectionne une catégorie dans le menu ci-dessous pour la configurer.**\nToutes les modifications sont instantanées.')
    .addFields(
      { name: '💰 Économie',  value: onOff(cfg.eco_enabled),         inline: true },
      { name: '⭐ XP',        value: onOff(cfg.xp_enabled),          inline: true },
      { name: '🎮 Jeux',      value: onOff(cfg.game_enabled ?? 1),   inline: true },
      { name: '🤖 AutoMod',   value: onOff(cfg.automod_enabled),     inline: true },
      { name: '🎫 Tickets',   value: chanMention(cfg.ticket_channel),   inline: true },
      { name: '📜 Logs',      value: chanMention(cfg.log_channel),       inline: true },
    )
    .setFooter({ text: `NexusBot — Configuration • ${guild.name}` })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId(`cfg:cat:${userId}`)
    .setPlaceholder('📋 Choisir une catégorie à configurer...')
    .addOptions(CATEGORIES);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(select)],
  };
}

// ═══════════════════════════════════════════════════════════════
// PANNEAUX PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════

function buildGeneralPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔧 Général')
    .setDescription('Paramètres généraux du bot sur ce serveur.')
    .addFields(
      { name: '🎨 Couleur du bot', value: `\`${cfg.color || '#7B2FBE'}\``, inline: true },
    )
    .setFooter({ text: 'NexusBot — Général' });

  const colorBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:color:${userId}`)
    .setLabel('🎨 Changer la couleur')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), colorBtn),
    ],
  };
}

function buildEcoPanel(cfg, guild, userId) {
  const coin = cfg.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('💰 Économie')
    .addFields(
      { name: '⚡ Statut',       value: onOff(cfg.eco_enabled),                    inline: true },
      { name: '💰 Monnaie',      value: `${coin} ${cfg.currency_name || 'Coins'}`,  inline: true },
      { name: '📅 Daily',        value: `**${cfg.daily_amount || 25}** ${coin}`,    inline: true },
      { name: '💬 Par message',  value: `**${cfg.coins_per_msg || 1}** ${coin}`,    inline: true },
    )
    .setFooter({ text: 'NexusBot — Économie' });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:eco_enabled:${userId}`)
    .setLabel(cfg.eco_enabled ? '❌ Désactiver' : '✅ Activer')
    .setStyle(cfg.eco_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const nameBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:currency_name:${userId}`)
    .setLabel('✏️ Nom monnaie')
    .setStyle(ButtonStyle.Primary);

  const emojiBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:currency_emoji:${userId}`)
    .setLabel('😀 Emoji monnaie')
    .setStyle(ButtonStyle.Primary);

  const dailyBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:daily_amount:${userId}`)
    .setLabel('📅 Montant daily')
    .setStyle(ButtonStyle.Primary);

  const msgBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:coins_per_msg:${userId}`)
    .setLabel('💬 Coins/message')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn),
      new ActionRowBuilder().addComponents(nameBtn, emojiBtn, dailyBtn, msgBtn),
    ],
  };
}

function buildXpPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('⭐ XP & Niveaux')
    .addFields(
      { name: '⚡ Statut',          value: onOff(cfg.xp_enabled),          inline: true },
      { name: '✖️ Multiplicateur',   value: `×${cfg.xp_multiplier || 1}`,   inline: true },
      { name: '📣 Salon de niveau',  value: chanMention(cfg.level_channel), inline: true },
    )
    .setFooter({ text: 'NexusBot — XP & Niveaux' });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:xp_enabled:${userId}`)
    .setLabel(cfg.xp_enabled ? '❌ Désactiver' : '✅ Activer')
    .setStyle(cfg.xp_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const multBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:xp_multiplier:${userId}`)
    .setLabel('✖️ Multiplicateur XP')
    .setStyle(ButtonStyle.Primary);

  const clearChanBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:level_channel:${userId}`)
    .setLabel('🗑️ Retirer le salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:level_channel:${userId}`)
    .setPlaceholder('📣 Salon pour les annonces de niveau')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn, multBtn, clearChanBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

function buildBienvenuePanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('👋 Bienvenue')
    .addFields(
      { name: '📣 Salon', value: chanMention(cfg.welcome_channel), inline: true },
      { name: '📝 Message', value: cfg.welcome_msg ? `\`${cfg.welcome_msg.slice(0, 120)}\`` : '*Message par défaut*', inline: false },
      { name: '🔤 Variables disponibles', value: '`{user}` — mention • `{username}` — nom • `{server}` — serveur • `{count}` — membres', inline: false },
    )
    .setFooter({ text: 'NexusBot — Bienvenue' });

  const msgBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:welcome_msg:${userId}`)
    .setLabel('✏️ Modifier le message')
    .setStyle(ButtonStyle.Primary);

  const clearChanBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:welcome_channel:${userId}`)
    .setLabel('🗑️ Retirer le salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:welcome_channel:${userId}`)
    .setPlaceholder('📣 Salon de bienvenue des nouveaux membres')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), msgBtn, clearChanBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

function buildAurevoirPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🚪 Au revoir')
    .addFields(
      { name: '📣 Salon', value: chanMention(cfg.leave_channel), inline: true },
      { name: '📝 Message', value: cfg.leave_msg ? `\`${cfg.leave_msg.slice(0, 120)}\`` : '*Message par défaut*', inline: false },
      { name: '🔤 Variables', value: '`{user}` • `{username}` • `{server}`', inline: false },
    )
    .setFooter({ text: 'NexusBot — Au revoir' });

  const msgBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:leave_msg:${userId}`)
    .setLabel('✏️ Modifier le message')
    .setStyle(ButtonStyle.Primary);

  const clearChanBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:leave_channel:${userId}`)
    .setLabel('🗑️ Retirer le salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:leave_channel:${userId}`)
    .setPlaceholder('📣 Salon pour les messages de départ')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), msgBtn, clearChanBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

function buildLogsPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('📜 Logs')
    .addFields(
      { name: '📋 Logs généraux',    value: chanMention(cfg.log_channel),     inline: true },
      { name: '🔨 Logs modération',  value: chanMention(cfg.mod_log_channel),  inline: true },
    )
    .setFooter({ text: 'NexusBot — Logs' });

  const chanSelect1 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:log_channel:${userId}`)
    .setPlaceholder('📋 Salon des logs généraux')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const chanSelect2 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:mod_log_channel:${userId}`)
    .setPlaceholder('🔨 Salon des logs de modération')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(chanSelect1),
      new ActionRowBuilder().addComponents(chanSelect2),
    ],
  };
}

function buildAutomodPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🤖 AutoMod')
    .setDescription('Modération automatique des messages sur le serveur.')
    .addFields(
      { name: '⚡ AutoMod global',  value: onOff(cfg.automod_enabled),   inline: true },
      { name: '🔗 Anti-liens',      value: onOff(cfg.automod_antilink),  inline: true },
      { name: '💢 Anti-spam',       value: onOff(cfg.automod_antispam),  inline: true },
    )
    .setFooter({ text: 'NexusBot — AutoMod' });

  const toggleGlobal = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_enabled:${userId}`)
    .setLabel(cfg.automod_enabled ? '❌ Désactiver AutoMod' : '✅ Activer AutoMod')
    .setStyle(cfg.automod_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleLink = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_antilink:${userId}`)
    .setLabel(cfg.automod_antilink ? '🔗 Désact. Anti-liens' : '🔗 Act. Anti-liens')
    .setStyle(cfg.automod_antilink ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleSpam = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_antispam:${userId}`)
    .setLabel(cfg.automod_antispam ? '💢 Désact. Anti-spam' : '💢 Act. Anti-spam')
    .setStyle(cfg.automod_antispam ? ButtonStyle.Danger : ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(toggleGlobal, toggleLink, toggleSpam),
    ],
  };
}

function buildRolesPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎭 Rôles')
    .addFields(
      { name: '🔇 Rôle muet',   value: roleMention(cfg.mute_role),  inline: true },
      { name: '🤝 Auto-rôle',   value: roleMention(cfg.autorole),   inline: true },
    )
    .setFooter({ text: 'NexusBot — Rôles' });

  const muteSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:mute_role:${userId}`)
    .setPlaceholder('🔇 Rôle muet (attribué aux membres sanctionnés)')
    .setMinValues(0)
    .setMaxValues(1);

  const autoSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:autorole:${userId}`)
    .setPlaceholder('🤝 Auto-rôle (attribué automatiquement à l\'arrivée)')
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(muteSelect),
      new ActionRowBuilder().addComponents(autoSelect),
    ],
  };
}

function buildTicketsPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎫 Tickets')
    .addFields(
      { name: '📣 Salon tickets',   value: chanMention(cfg.ticket_channel),      inline: true },
      { name: '🔨 Logs tickets',    value: chanMention(cfg.ticket_log_channel),   inline: true },
      { name: '👮 Rôle staff',      value: roleMention(cfg.ticket_staff_role),    inline: true },
    )
    .setFooter({ text: 'NexusBot — Tickets' });

  const staffSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:ticket_staff_role:${userId}`)
    .setPlaceholder('👮 Rôle staff — accès aux tickets')
    .setMinValues(0)
    .setMaxValues(1);

  const chanSelect1 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:ticket_channel:${userId}`)
    .setPlaceholder('📣 Salon avec le bouton d\'ouverture de tickets')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const chanSelect2 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:ticket_log_channel:${userId}`)
    .setPlaceholder('🔨 Salon des logs de tickets (fermetures, transcripts)')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(chanSelect1),
      new ActionRowBuilder().addComponents(chanSelect2),
      new ActionRowBuilder().addComponents(staffSelect),
    ],
  };
}

function buildJeuxPanel(cfg, guild, userId) {
  const coin = cfg.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎮 Jeux & Paris')
    .addFields(
      { name: '⚡ Statut',    value: onOff(cfg.game_enabled ?? 1),              inline: true },
      { name: '⬇️ Mise min',  value: `**${cfg.game_min_bet  || 10}** ${coin}`,   inline: true },
      { name: '⬆️ Mise max',  value: `**${cfg.game_max_bet  || 50000}** ${coin}`, inline: true },
    )
    .setFooter({ text: 'NexusBot — Jeux' });

  const enabled = cfg.game_enabled ?? 1;

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:game_enabled:${userId}`)
    .setLabel(enabled ? '❌ Désactiver les jeux' : '✅ Activer les jeux')
    .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const minBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:game_min_bet:${userId}`)
    .setLabel('⬇️ Mise minimum')
    .setStyle(ButtonStyle.Primary);

  const maxBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:game_max_bet:${userId}`)
    .setLabel('⬆️ Mise maximum')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn, minBtn, maxBtn),
    ],
  };
}

function buildReponsesPanel(cfg, guild, userId, db) {
  const cmds = db.getCustomCommands(guild.id);

  const desc = cmds.length === 0
    ? '*Aucune commande personnalisée pour l\'instant.*\n\nClique sur **➕ Ajouter** pour en créer une.'
    : cmds.slice(0, 20).map(c =>
        `\`&${c.trigger}\` → ${c.response.slice(0, 65)}${c.response.length > 65 ? '...' : ''}`
      ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('💬 Réponses personnalisées')
    .setDescription(desc)
    .addFields({ name: '📊 Total', value: `**${cmds.length}** commande(s)`, inline: true })
    .setFooter({ text: cmds.length > 20 ? `+ ${cmds.length - 20} autres non affichées` : 'NexusBot — Réponses perso' });

  const addBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:cmd_add:${userId}`)
    .setLabel('➕ Ajouter')
    .setStyle(ButtonStyle.Success);

  const delBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:cmd_del:${userId}`)
    .setLabel('🗑️ Supprimer')
    .setStyle(ButtonStyle.Danger);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), addBtn, delBtn),
    ],
  };
}

function buildAnnivPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎂 Anniversaires')
    .addFields(
      { name: '📣 Salon anniversaires', value: chanMention(cfg.birthday_channel), inline: true },
    )
    .setDescription('Les membres peuvent enregistrer leur anniversaire avec `/birthday set`.\nLe bot les annoncera automatiquement dans le salon configuré.')
    .setFooter({ text: 'NexusBot — Anniversaires' });

  const clearBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:birthday_channel:${userId}`)
    .setLabel('🗑️ Retirer le salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:birthday_channel:${userId}`)
    .setPlaceholder('📣 Salon pour les annonces d\'anniversaire')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), clearBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

function buildModulesPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔌 Modules — Vue d\'ensemble')
    .setDescription('Active ou désactive les modules principaux du bot.')
    .addFields(
      { name: '💰 Économie',  value: onOff(cfg.eco_enabled),         inline: true },
      { name: '⭐ XP',        value: onOff(cfg.xp_enabled),          inline: true },
      { name: '🎮 Jeux',      value: onOff(cfg.game_enabled ?? 1),   inline: true },
      { name: '🤖 AutoMod',   value: onOff(cfg.automod_enabled),     inline: true },
    )
    .setFooter({ text: 'NexusBot — Modules' });

  const enabled = cfg.game_enabled ?? 1;

  const ecoBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:eco_enabled:${userId}`)
    .setLabel(cfg.eco_enabled ? '❌ Éco OFF' : '✅ Éco ON')
    .setStyle(cfg.eco_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const xpBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:xp_enabled:${userId}`)
    .setLabel(cfg.xp_enabled ? '❌ XP OFF' : '✅ XP ON')
    .setStyle(cfg.xp_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const jeuBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:game_enabled:${userId}`)
    .setLabel(enabled ? '❌ Jeux OFF' : '✅ Jeux ON')
    .setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const automodBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_enabled:${userId}`)
    .setLabel(cfg.automod_enabled ? '❌ AutoMod OFF' : '✅ AutoMod ON')
    .setStyle(cfg.automod_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(ecoBtn, xpBtn, jeuBtn, automodBtn),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// DISPATCHER CATÉGORIES
// ═══════════════════════════════════════════════════════════════
function buildCategoryPanel(category, cfg, guild, userId, db) {
  switch (category) {
    case 'general':       return buildGeneralPanel(cfg, guild, userId);
    case 'eco':           return buildEcoPanel(cfg, guild, userId);
    case 'xp':            return buildXpPanel(cfg, guild, userId);
    case 'bienvenue':     return buildBienvenuePanel(cfg, guild, userId);
    case 'aurevoir':      return buildAurevoirPanel(cfg, guild, userId);
    case 'logs':          return buildLogsPanel(cfg, guild, userId);
    case 'automod':       return buildAutomodPanel(cfg, guild, userId);
    case 'roles':         return buildRolesPanel(cfg, guild, userId);
    case 'tickets':       return buildTicketsPanel(cfg, guild, userId);
    case 'jeux':          return buildJeuxPanel(cfg, guild, userId);
    case 'reponses':      return buildReponsesPanel(cfg, guild, userId, db);
    case 'anniversaires': return buildAnnivPanel(cfg, guild, userId);
    case 'modules':       return buildModulesPanel(cfg, guild, userId);
    default:              return buildMainMenu(cfg, guild, userId);
  }
}

// ═══════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════
const MODAL_CONFIGS = {
  color: {
    title: '🎨 Couleur du bot',
    label: 'Code couleur HEX (ex: #7B2FBE)',
    placeholder: '#7B2FBE',
    style: TextInputStyle.Short,
    minLength: 7,
    maxLength: 7,
  },
  currency_name: {
    title: '💰 Nom de la monnaie',
    label: 'Nom de la monnaie (ex: Coins)',
    placeholder: 'Coins',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 30,
  },
  currency_emoji: {
    title: '😀 Emoji de la monnaie',
    label: 'Emoji (ex: 🪙 ou $)',
    placeholder: '🪙',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
  daily_amount: {
    title: '📅 Montant du daily',
    label: 'Montant (nombre entier positif)',
    placeholder: '25',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
  coins_per_msg: {
    title: '💬 Coins par message',
    label: 'Montant par message envoyé',
    placeholder: '1',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 5,
  },
  xp_multiplier: {
    title: '✖️ Multiplicateur XP',
    label: 'Multiplicateur (ex: 1, 1.5, 2)',
    placeholder: '1',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 5,
  },
  welcome_msg: {
    title: '👋 Message de bienvenue',
    label: 'Message ({user}, {username}, {server}, {count})',
    placeholder: 'Bienvenue {user} sur {server} ! Tu es le membre n°{count} 🎉',
    style: TextInputStyle.Paragraph,
    minLength: 1,
    maxLength: 500,
  },
  leave_msg: {
    title: '🚪 Message au revoir',
    label: 'Message ({user}, {username}, {server})',
    placeholder: '{username} a quitté le serveur. Bonne continuation !',
    style: TextInputStyle.Paragraph,
    minLength: 1,
    maxLength: 500,
  },
  game_min_bet: {
    title: '⬇️ Mise minimum',
    label: 'Montant minimum par pari (entier)',
    placeholder: '10',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
  game_max_bet: {
    title: '⬆️ Mise maximum',
    label: 'Montant maximum par pari (entier)',
    placeholder: '50000',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
};

function buildModal(key, userId, currentValue) {
  const modal = new ModalBuilder()
    .setCustomId(`cfg_modal:${key}:${userId}`);

  // Modal spécial pour ajouter une réponse personnalisée (2 champs)
  if (key === 'cmd_add') {
    modal.setTitle('➕ Ajouter une réponse personnalisée');
    const triggerInput = new TextInputBuilder()
      .setCustomId('trigger')
      .setLabel('Déclencheur (sans &, ex: bonjour)')
      .setPlaceholder('bonjour')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(30)
      .setRequired(true);
    const responseInput = new TextInputBuilder()
      .setCustomId('response')
      .setLabel('Réponse du bot')
      .setPlaceholder('Bonjour ! Comment puis-je t\'aider ?')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(1)
      .setMaxLength(500)
      .setRequired(true);
    modal.addComponents(
      new ActionRowBuilder().addComponents(triggerInput),
      new ActionRowBuilder().addComponents(responseInput),
    );
    return modal;
  }

  // Modal pour supprimer une réponse personnalisée
  if (key === 'cmd_del') {
    modal.setTitle('🗑️ Supprimer une réponse personnalisée');
    const input = new TextInputBuilder()
      .setCustomId('value')
      .setLabel('Déclencheur à supprimer (sans &)')
      .setPlaceholder('bonjour')
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(30)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  }

  // Modal générique
  const conf = MODAL_CONFIGS[key] || {
    title: 'Modifier',
    label: 'Nouvelle valeur',
    placeholder: '',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 100,
  };

  modal.setTitle(conf.title);

  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(conf.label)
    .setPlaceholder(conf.placeholder)
    .setStyle(conf.style)
    .setMinLength(conf.minLength)
    .setMaxLength(conf.maxLength)
    .setRequired(true);

  if (currentValue !== null && currentValue !== undefined) {
    try { input.setValue(String(currentValue)); } catch {}
  }

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ═══════════════════════════════════════════════════════════════
// MAPPING CLÉ → CATÉGORIE (pour refresh après update)
// ═══════════════════════════════════════════════════════════════
const KEY_TO_CATEGORY = {
  color:              'general',
  eco_enabled:        'eco',
  currency_name:      'eco',
  currency_emoji:     'eco',
  daily_amount:       'eco',
  coins_per_msg:      'eco',
  xp_enabled:         'xp',
  xp_multiplier:      'xp',
  level_channel:      'xp',
  welcome_channel:    'bienvenue',
  welcome_msg:        'bienvenue',
  leave_channel:      'aurevoir',
  leave_msg:          'aurevoir',
  log_channel:        'logs',
  mod_log_channel:    'logs',
  automod_enabled:    'automod',
  automod_antilink:   'automod',
  automod_antispam:   'automod',
  mute_role:          'roles',
  autorole:           'roles',
  ticket_channel:     'tickets',
  ticket_staff_role:  'tickets',
  ticket_log_channel: 'tickets',
  game_enabled:       'jeux',
  game_min_bet:       'jeux',
  game_max_bet:       'jeux',
  birthday_channel:   'anniversaires',
  cmd_add:            'reponses',
  cmd_del:            'reponses',
};

function getCategoryForKey(key) {
  return KEY_TO_CATEGORY[key] || null;
}

// ═══════════════════════════════════════════════════════════════
// GESTIONNAIRE PRINCIPAL DES INTERACTIONS CFG
// ═══════════════════════════════════════════════════════════════
async function handleConfigInteraction(interaction, db) {
  const customId = interaction.customId || '';
  if (!customId.startsWith('cfg')) return false;

  // ── Vérification du propriétaire du panel ─────────────────────
  function getUserId() {
    const parts = customId.split(':');
    // cfg:action:key:userId ou cfg:action:userId
    return parts[parts.length - 1];
  }

  function checkOwner() {
    const uid = getUserId();
    if (interaction.user.id !== uid) {
      interaction.reply({ content: '❌ Ce panneau de configuration ne t\'appartient pas.', ephemeral: true });
      return false;
    }
    return true;
  }

  // Helper pour mettre à jour le panel
  async function updatePanel(panel, useUpdate = true) {
    if (useUpdate && typeof interaction.update === 'function') {
      return interaction.update(panel);
    }
    // Pour les modals → reply (ouvre un nouveau panel éphem)
    return interaction.reply({ ...panel, ephemeral: true });
  }

  // ── cfg:menu:userId — Afficher le menu principal ───────────────
  if (customId.startsWith('cfg:menu:')) {
    if (!checkOwner()) return true;
    const userId = customId.split(':')[2];
    const cfg = db.getConfig(interaction.guildId);
    return interaction.update(buildMainMenu(cfg, interaction.guild, userId));
  }

  // ── cfg:cat:userId (StringSelectMenu) — Afficher catégorie ─────
  if (interaction.isStringSelectMenu() && customId.startsWith('cfg:cat:')) {
    if (!checkOwner()) return true;
    const userId = customId.split(':')[2];
    const category = interaction.values[0];
    const cfg = db.getConfig(interaction.guildId);
    return interaction.update(buildCategoryPanel(category, cfg, interaction.guild, userId, db));
  }

  // ── cfg:toggle:key:userId — Basculer un booléen ────────────────
  if (customId.startsWith('cfg:toggle:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[2];
    const userId = parts[3];
    const cfg    = db.getConfig(interaction.guildId);
    const newVal = (cfg[key] ?? 0) ? 0 : 1;
    db.setConfig(interaction.guildId, key, newVal);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    const panel    = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.update(panel);
  }

  // ── cfg:modal:key:userId — Ouvrir un modal ─────────────────────
  if (customId.startsWith('cfg:modal:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[2];
    const userId = parts[3];
    const cfg    = db.getConfig(interaction.guildId);
    return interaction.showModal(buildModal(key, userId, cfg[key]));
  }

  // ── cfg:clear:key:userId — Effacer une valeur ──────────────────
  if (customId.startsWith('cfg:clear:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[2];
    const userId = parts[3];
    db.setConfig(interaction.guildId, key, null);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    const panel    = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.update(panel);
  }

  // ── cfg_chan:key:userId — Sélection de salon ────────────────────
  if (interaction.isChannelSelectMenu() && customId.startsWith('cfg_chan:')) {
    if (!checkOwner()) return true;
    const parts     = customId.split(':');
    const key       = parts[1];
    const userId    = parts[2];
    const channelId = interaction.values[0] || null;
    db.setConfig(interaction.guildId, key, channelId);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    await interaction.deferUpdate();
    const panel = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.editReply(panel);
  }

  // ── cfg_role:key:userId — Sélection de rôle ────────────────────
  if (interaction.isRoleSelectMenu() && customId.startsWith('cfg_role:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[1];
    const userId = parts[2];
    const roleId = interaction.values[0] || null;
    db.setConfig(interaction.guildId, key, roleId);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    await interaction.deferUpdate();
    const panel = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.editReply(panel);
  }

  // ── cfg_modal:key:userId — Soumission de modal ─────────────────
  if (interaction.isModalSubmit() && customId.startsWith('cfg_modal:')) {
    const parts  = customId.split(':');
    const key    = parts[1];
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return interaction.reply({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true });
    }

    const cfg = db.getConfig(interaction.guildId);

    // Ajouter une commande personnalisée
    if (key === 'cmd_add') {
      const trigger  = interaction.fields.getTextInputValue('trigger').toLowerCase().trim().replace(/\s+/g, '_');
      const response = interaction.fields.getTextInputValue('response').trim();
      if (!trigger || !response) {
        return interaction.reply({ content: '❌ Déclencheur ou réponse vide.', ephemeral: true });
      }
      db.db.prepare(
        `INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, created_by, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(interaction.guildId, trigger, response, interaction.user.id, Math.floor(Date.now() / 1000));
      const newCfg = db.getConfig(interaction.guildId);
      const panel = buildCategoryPanel('reponses', newCfg, interaction.guild, userId, db);
      return interaction.update(panel);
    }

    // Supprimer une commande personnalisée
    if (key === 'cmd_del') {
      const trigger = interaction.fields.getTextInputValue('value').toLowerCase().trim();
      const result  = db.db.prepare('DELETE FROM custom_commands WHERE guild_id=? AND trigger=?')
        .run(interaction.guildId, trigger);
      const msg = result.changes > 0
        ? `✅ Commande \`&${trigger}\` supprimée.`
        : `❌ Commande \`&${trigger}\` introuvable.`;
      const newCfg = db.getConfig(interaction.guildId);
      const panel  = buildCategoryPanel('reponses', newCfg, interaction.guild, userId, db);
      try {
        await interaction.update(panel);
        if (result.changes === 0) {
          await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
        }
      } catch {
        await interaction.reply({ ...panel, ephemeral: true }).catch(() => {});
      }
      return;
    }

    // Clés numériques entières
    const INTEGER_KEYS = ['daily_amount', 'coins_per_msg', 'game_min_bet', 'game_max_bet'];
    let value = interaction.fields.getTextInputValue('value').trim();

    if (INTEGER_KEYS.includes(key)) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        return interaction.reply({ content: '❌ Valeur invalide. Entre un nombre entier positif.', ephemeral: true });
      }
      value = num;
    } else if (key === 'xp_multiplier') {
      const num = parseFloat(value.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        return interaction.reply({ content: '❌ Valeur invalide. Entre un nombre positif (ex: 1.5).', ephemeral: true });
      }
      value = num;
    } else if (key === 'color') {
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return interaction.reply({ content: '❌ Format invalide. Utilise le format `#RRGGBB` (ex: `#7B2FBE`).', ephemeral: true });
      }
    }

    db.setConfig(interaction.guildId, key, value);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    const panel    = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db)
      : buildMainMenu(newCfg, interaction.guild, userId);

    // update() est disponible sur les modal submits en discord.js 14.11+
    try {
      return await interaction.update(panel);
    } catch {
      return interaction.reply({ ...panel, ephemeral: true }).catch(() => {});
    }
  }

  return false;
}

module.exports = {
  buildMainMenu,
  buildCategoryPanel,
  buildModal,
  handleConfigInteraction,
};
