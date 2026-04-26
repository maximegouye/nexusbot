/**
 * NexusBot — Panneau de configuration interactif v2
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
// Catégories avancées (définies dans configPanelAdvanced.js)
let ADVANCED_CATEGORIES = [];
let advancedModule = null;
try {
  advancedModule = require('./configPanelAdvanced');
  ADVANCED_CATEGORIES = advancedModule.ADVANCED_CATEGORIES || [];
} catch (e) {
  console.warn('[configPanel] configPanelAdvanced non chargé:', e.message);
}

const BASE_CATEGORIES = [
  { value: 'general',       label: '🔧 Général',          description: 'Préfixe, couleur, paramètres de base' },
  { value: 'eco',           label: '💰 Économie',          description: 'Monnaie, daily, gains par message' },
  { value: 'xp',            label: '⭐ XP & Niveaux',      description: 'XP, multiplicateur, salon de niveau' },
  { value: 'bienvenue',     label: '👋 Bienvenue',         description: 'Salon et message d\'accueil' },
  { value: 'aurevoir',      label: '🚪 Au revoir',         description: 'Salon et message de départ' },
  { value: 'logs',          label: '📜 Logs',              description: 'Journaux des actions du serveur' },
  { value: 'automod',       label: '🤖 AutoMod',           description: 'Anti-liens, anti-spam, modération auto' },
  { value: 'roles',         label: '🎭 Rôles',             description: 'Rôle muet, auto-rôle, rôle anniversaire' },
  { value: 'tickets',       label: '🎫 Tickets',           description: 'Salon, logs, rôle staff et message' },
  { value: 'vocal',         label: '🔊 Salons vocaux',     description: 'TempVoice, salon créateur' },
  { value: 'starboard',     label: '⭐ Starboard',         description: 'Salon et seuil du starboard' },
  { value: 'jeux',          label: '🎮 Jeux',              description: 'Casino, paris, mises min/max' },
  { value: 'reponses',      label: '💬 Réponses perso',    description: 'Commandes personnalisées simples' },
  { value: 'anniversaires', label: '🎂 Anniversaires',     description: 'Salon et rôle d\'anniversaire' },
  { value: 'modules',       label: '🔌 Modules',           description: 'Activer/désactiver les modules' },
];

// CATEGORIES = BASE + ADVANCED fusionnées (Discord limite à 25 options dans un select)
const CATEGORIES = [...BASE_CATEGORIES, ...ADVANCED_CATEGORIES].slice(0, 25);

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
function onOff(val)        { return val ? '✅ Activé'    : '❌ Désactivé'; }
function chanMention(id)   { return id  ? `<#${id}>`     : '`Non défini`'; }
function roleMention(id)   { return id  ? `<@&${id}>`    : '`Non défini`'; }
function valOr(v, def)     { return (v !== null && v !== undefined && v !== '') ? v : def; }

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
    .setDescription(
      '**Sélectionne une catégorie dans le menu ci-dessous pour la configurer.**\n' +
      'Toutes les modifications sont enregistrées instantanément.'
    )
    .addFields(
      { name: '🔧 Préfixe',    value: `\`${cfg.prefix || '&'}\``,            inline: true },
      { name: '🎨 Couleur',    value: `\`${cfg.color || '#7B2FBE'}\``,        inline: true },
      { name: '💰 Économie',   value: onOff(cfg.eco_enabled),                 inline: true },
      { name: '⭐ XP',         value: onOff(cfg.xp_enabled),                  inline: true },
      { name: '🎮 Jeux',       value: onOff(cfg.game_enabled ?? 1),           inline: true },
      { name: '🤖 AutoMod',    value: onOff(cfg.automod_enabled),             inline: true },
      { name: '📜 Logs',       value: chanMention(cfg.log_channel),           inline: true },
      { name: '🎫 Tickets',    value: chanMention(cfg.ticket_channel),        inline: true },
      { name: '👋 Bienvenue',  value: chanMention(cfg.welcome_channel),       inline: true },
    )
    .setFooter({ text: `NexusBot — Configuration • ${guild.name}` })
    .setTimestamp();

  // Deux selects séparés pour contourner la limite 25 options/select de Discord
  // → toutes les catégories restent accessibles, rien n'est coupé.
  // Les customId DOIVENT être distincts (Discord refuse les doublons).
  const selectBase = new StringSelectMenuBuilder()
    .setCustomId(`cfg:cat:${userId}`)
    .setPlaceholder('📋 Catégories de base (économie, XP, logs, tickets, rôles…)')
    .addOptions(BASE_CATEGORIES.slice(0, 25));

  const selectAdv = new StringSelectMenuBuilder()
    .setCustomId(`cfg:cat2:${userId}`)
    .setPlaceholder('⚡ Catégories avancées (IA, commandes personnalisées, encarts, boutique…)')
    .addOptions(ADVANCED_CATEGORIES.slice(0, 25));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(selectBase),
      new ActionRowBuilder().addComponents(selectAdv),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════
// PANNEAUX PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════

// ─── GÉNÉRAL ────────────────────────────────────────────────────
function buildGeneralPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔧 Général')
    .setDescription('Paramètres généraux du bot sur ce serveur.')
    .addFields(
      { name: '🔧 Préfixe',        value: `\`${cfg.prefix || '&'}\``,          inline: true },
      { name: '🎨 Couleur du bot',  value: `\`${cfg.color || '#7B2FBE'}\``,     inline: true },
    )
    .setFooter({ text: 'NexusBot — Général' });

  const prefixBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:prefix:${userId}`)
    .setLabel('🔧 Changer le préfixe')
    .setStyle(ButtonStyle.Primary);

  const colorBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:color:${userId}`)
    .setLabel('🎨 Changer la couleur')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), prefixBtn, colorBtn),
    ],
  };
}

// ─── ÉCONOMIE ───────────────────────────────────────────────────
function buildEcoPanel(cfg, guild, userId) {
  const coin = cfg.currency_emoji || '🪙';

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('💰 Économie')
    .addFields(
      { name: '⚡ Statut',          value: onOff(cfg.eco_enabled),                              inline: true },
      { name: '💰 Monnaie',         value: `${coin} **${cfg.currency_name || 'Coins'}**`,       inline: true },
      { name: '📅 Daily',           value: `**${valOr(cfg.daily_amount, 25)}** ${coin}`,        inline: true },
      { name: '💬 Par message',     value: `**${valOr(cfg.coins_per_msg, 1)}** ${coin}`,        inline: true },
      { name: '💸 Frais transfert', value: `**${valOr(cfg.transfer_fee, 5)}%**`,                inline: true },
      { name: '🎰 Vol activé',      value: onOff(cfg.rob_enabled ?? 1),                         inline: true },
    )
    .setFooter({ text: 'NexusBot — Économie' });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:eco_enabled:${userId}`)
    .setLabel(cfg.eco_enabled ? '❌ Désactiver' : '✅ Activer')
    .setStyle(cfg.eco_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const robBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:rob_enabled:${userId}`)
    .setLabel((cfg.rob_enabled ?? 1) ? '🎰 Désact. vols' : '🎰 Act. vols')
    .setStyle((cfg.rob_enabled ?? 1) ? ButtonStyle.Danger : ButtonStyle.Success);

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

  const feeBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:transfer_fee:${userId}`)
    .setLabel('💸 Frais transfert %')
    .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn, robBtn),
      new ActionRowBuilder().addComponents(nameBtn, emojiBtn, dailyBtn, msgBtn, feeBtn),
    ],
  };
}

// ─── XP ─────────────────────────────────────────────────────────
function buildXpPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('⭐ XP & Niveaux')
    .addFields(
      { name: '⚡ Statut',            value: onOff(cfg.xp_enabled),                   inline: true },
      { name: '✖️ Multiplicateur',    value: `×${valOr(cfg.xp_multiplier, 1)}`,        inline: true },
      { name: '🎯 XP par message',    value: `**${valOr(cfg.xp_rate, 15)}** XP`,      inline: true },
      { name: '📣 Salon de niveau',   value: chanMention(cfg.level_channel),           inline: true },
      { name: '💬 Message de niveau', value: cfg.level_msg ? `\`${cfg.level_msg.slice(0, 80)}\`` : '*Message par défaut*', inline: false },
    )
    .addFields({ name: '🔤 Variables disponibles', value: '`{user}` — mention • `{username}` — nom • `{level}` — niveau', inline: false })
    .setFooter({ text: 'NexusBot — XP & Niveaux' });

  const toggleBtn = new ButtonBuilder()
    .setCustomId(`cfg:toggle:xp_enabled:${userId}`)
    .setLabel(cfg.xp_enabled ? '❌ Désactiver XP' : '✅ Activer XP')
    .setStyle(cfg.xp_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const multBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:xp_multiplier:${userId}`)
    .setLabel('✖️ Multiplicateur')
    .setStyle(ButtonStyle.Primary);

  const rateBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:xp_rate:${userId}`)
    .setLabel('🎯 XP/message')
    .setStyle(ButtonStyle.Primary);

  const msgBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:level_msg:${userId}`)
    .setLabel('💬 Message de niveau')
    .setStyle(ButtonStyle.Primary);

  const clearChanBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:level_channel:${userId}`)
    .setLabel('🗑️ Retirer salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:level_channel:${userId}`)
    .setPlaceholder('📣 Salon pour les annonces de passage de niveau')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleBtn, multBtn, rateBtn, msgBtn),
      new ActionRowBuilder().addComponents(clearChanBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

// ─── BIENVENUE ──────────────────────────────────────────────────
function buildBienvenuePanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('👋 Bienvenue')
    .addFields(
      { name: '📣 Salon',    value: chanMention(cfg.welcome_channel),                                                                                inline: true },
      { name: '📝 Message',  value: cfg.welcome_msg ? `\`${cfg.welcome_msg.slice(0, 120)}\`` : '*Message par défaut*',                               inline: false },
      { name: '🔤 Variables', value: '`{user}` — mention • `{username}` — nom • `{server}` — serveur • `{count}` — membres', inline: false },
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

// ─── AU REVOIR ──────────────────────────────────────────────────
function buildAurevoirPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🚪 Au revoir')
    .addFields(
      { name: '📣 Salon',   value: chanMention(cfg.leave_channel),                                                                                           inline: true },
      { name: '📝 Message', value: cfg.leave_msg ? `\`${cfg.leave_msg.slice(0, 120)}\`` : '*Message par défaut*',                                            inline: false },
      { name: '🔤 Variables', value: '`{user}` • `{username}` • `{server}` • `{count}`',                                                                   inline: false },
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

// ─── LOGS ────────────────────────────────────────────────────────
function buildLogsPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('📜 Logs')
    .addFields(
      { name: '📋 Logs généraux',       value: chanMention(cfg.log_channel),         inline: true },
      { name: '🔨 Logs modération',     value: chanMention(cfg.mod_log_channel),     inline: true },
      { name: '🤖 Logs AutoMod',        value: chanMention(cfg.automod_log),         inline: true },
      { name: '🚀 Salon boosts',        value: chanMention(cfg.boost_channel),       inline: true },
      { name: '📌 Salon quêtes',        value: chanMention(cfg.quest_channel),       inline: true },
    )
    .setFooter({ text: 'NexusBot — Logs' });

  const clear1 = new ButtonBuilder()
    .setCustomId(`cfg:clear:log_channel:${userId}`)
    .setLabel('🗑️ Retirer logs')
    .setStyle(ButtonStyle.Danger);

  const clear2 = new ButtonBuilder()
    .setCustomId(`cfg:clear:mod_log_channel:${userId}`)
    .setLabel('🗑️ Retirer logs mod')
    .setStyle(ButtonStyle.Danger);

  const chanSelect1 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:log_channel:${userId}`)
    .setPlaceholder('📋 Salon des logs généraux (bans, kicks, éditions...)')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const chanSelect2 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:mod_log_channel:${userId}`)
    .setPlaceholder('🔨 Salon des logs de modération')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const chanSelect3 = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:boost_channel:${userId}`)
    .setPlaceholder('🚀 Salon des annonces de boost serveur')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), clear1, clear2),
      new ActionRowBuilder().addComponents(chanSelect1),
      new ActionRowBuilder().addComponents(chanSelect2),
      new ActionRowBuilder().addComponents(chanSelect3),
    ],
  };
}

// ─── AUTOMOD ────────────────────────────────────────────────────
function buildAutomodPanel(cfg, guild, userId) {
  const words = (() => { try { const w = JSON.parse(cfg.automod_badwords || '[]'); return w.length ? w.join(', ') : '*Aucun*'; } catch { return '*Aucun*'; } })();
  const spamThresh = valOr(cfg.automod_spam_threshold, 5);

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🤖 AutoMod')
    .setDescription('Modération automatique des messages sur le serveur.')
    .addFields(
      { name: '⚡ AutoMod global',      value: onOff(cfg.automod_enabled),                         inline: true },
      { name: '🔗 Anti-liens',           value: onOff(cfg.automod_antilink || cfg.automod_links),   inline: true },
      { name: '💢 Anti-spam',            value: onOff(cfg.automod_antispam || cfg.automod_spam),    inline: true },
      { name: '🔠 Anti-majuscules',      value: onOff(cfg.automod_caps),                            inline: true },
      { name: '📩 Anti-invitations',     value: onOff(cfg.automod_invites),                         inline: true },
      { name: '⚠️ Seuil spam',           value: `**${spamThresh}** msg/5s`,                         inline: true },
      { name: '📋 Salon logs AutoMod',   value: chanMention(cfg.automod_log),                       inline: true },
      { name: '🚫 Mots interdits',       value: words.length > 200 ? words.slice(0, 200) + '…' : words, inline: false },
    )
    .setFooter({ text: 'NexusBot — AutoMod' });

  const toggleGlobal = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_enabled:${userId}`)
    .setLabel(cfg.automod_enabled ? '❌ Désactiver AutoMod' : '✅ Activer AutoMod')
    .setStyle(cfg.automod_enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleLink = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_antilink:${userId}`)
    .setLabel((cfg.automod_antilink || cfg.automod_links) ? '🔗 Désact. liens' : '🔗 Act. liens')
    .setStyle((cfg.automod_antilink || cfg.automod_links) ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleSpam = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_antispam:${userId}`)
    .setLabel((cfg.automod_antispam || cfg.automod_spam) ? '💢 Désact. spam' : '💢 Act. spam')
    .setStyle((cfg.automod_antispam || cfg.automod_spam) ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleCaps = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_caps:${userId}`)
    .setLabel(cfg.automod_caps ? '🔠 Désact. caps' : '🔠 Act. caps')
    .setStyle(cfg.automod_caps ? ButtonStyle.Danger : ButtonStyle.Success);

  const toggleInvites = new ButtonBuilder()
    .setCustomId(`cfg:toggle:automod_invites:${userId}`)
    .setLabel(cfg.automod_invites ? '📩 Désact. invitations' : '📩 Act. invitations')
    .setStyle(cfg.automod_invites ? ButtonStyle.Danger : ButtonStyle.Success);

  const threshBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:automod_spam_threshold:${userId}`)
    .setLabel('⚠️ Seuil spam')
    .setStyle(ButtonStyle.Primary);

  const wordsBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:automod_badwords:${userId}`)
    .setLabel('🚫 Mots interdits')
    .setStyle(ButtonStyle.Primary);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:automod_log:${userId}`)
    .setPlaceholder('📋 Salon des logs AutoMod (messages supprimés)')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), toggleGlobal),
      new ActionRowBuilder().addComponents(toggleLink, toggleSpam, toggleCaps, toggleInvites),
      new ActionRowBuilder().addComponents(threshBtn, wordsBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

// ─── RÔLES ──────────────────────────────────────────────────────
function buildRolesPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎭 Rôles')
    .addFields(
      { name: '🔇 Rôle muet',          value: roleMention(cfg.mute_role),      inline: true },
      { name: '🤝 Auto-rôle',          value: roleMention(cfg.autorole),       inline: true },
      { name: '🎂 Rôle anniversaire',  value: roleMention(cfg.birthday_role),  inline: true },
    )
    .setDescription('Sélectionne un rôle dans chaque menu ci-dessous pour le configurer.')
    .setFooter({ text: 'NexusBot — Rôles' });

  const muteSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:mute_role:${userId}`)
    .setPlaceholder('🔇 Rôle muet — attribué aux membres sanctionnés')
    .setMinValues(0)
    .setMaxValues(1);

  const autoSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:autorole:${userId}`)
    .setPlaceholder('🤝 Auto-rôle — attribué automatiquement à l\'arrivée')
    .setMinValues(0)
    .setMaxValues(1);

  const birthdaySelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:birthday_role:${userId}`)
    .setPlaceholder('🎂 Rôle anniversaire — attribué le jour de l\'anniversaire')
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId)),
      new ActionRowBuilder().addComponents(muteSelect),
      new ActionRowBuilder().addComponents(autoSelect),
      new ActionRowBuilder().addComponents(birthdaySelect),
    ],
  };
}

// ─── TICKETS ────────────────────────────────────────────────────
function buildTicketsPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎫 Tickets')
    .addFields(
      { name: '📣 Salon tickets',        value: chanMention(cfg.ticket_channel),       inline: true },
      { name: '📁 Catégorie tickets',    value: chanMention(cfg.ticket_category),      inline: true },
      { name: '🔨 Logs tickets',         value: chanMention(cfg.ticket_log_channel || cfg.ticket_log), inline: true },
      { name: '👮 Rôle staff',           value: roleMention(cfg.ticket_staff_role),    inline: true },
      { name: '💬 Message d\'accueil',   value: cfg.ticket_welcome_msg ? `\`${cfg.ticket_welcome_msg.slice(0, 100)}\`` : '*Message par défaut*', inline: false },
    )
    .setFooter({ text: 'NexusBot — Tickets' });

  const welcomeMsgBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:ticket_welcome_msg:${userId}`)
    .setLabel('💬 Message d\'accueil ticket')
    .setStyle(ButtonStyle.Primary);

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
      new ActionRowBuilder().addComponents(backBtn(userId), welcomeMsgBtn),
      new ActionRowBuilder().addComponents(chanSelect1),
      new ActionRowBuilder().addComponents(chanSelect2),
      new ActionRowBuilder().addComponents(staffSelect),
    ],
  };
}

// ─── VOCAL (TEMPVOICE) ──────────────────────────────────────────
function buildVocalPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔊 Salons vocaux')
    .setDescription('Configure les salons vocaux temporaires et le créateur de salon privé.')
    .addFields(
      { name: '🎙️ Salon Créateur', value: chanMention(cfg.tempvoice_creator), inline: true },
    )
    .setFooter({ text: 'NexusBot — Salons vocaux temporaires' });

  const clearBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:tempvoice_creator:${userId}`)
    .setLabel('🗑️ Retirer le salon créateur')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:tempvoice_creator:${userId}`)
    .setPlaceholder('🎙️ Salon vocal créateur (rejoindre = créer un salon perso)')
    .setChannelTypes(ChannelType.GuildVoice)
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

// ─── STARBOARD ──────────────────────────────────────────────────
function buildStarboardPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('⭐ Starboard')
    .setDescription('Les messages qui reçoivent assez de réactions ⭐ sont épinglés dans le salon starboard.')
    .addFields(
      { name: '📣 Salon starboard',  value: chanMention(cfg.starboard_channel), inline: true },
      { name: '⭐ Seuil de réactions', value: `**${valOr(cfg.starboard_threshold, 3)}** ⭐`, inline: true },
    )
    .setFooter({ text: 'NexusBot — Starboard' });

  const threshBtn = new ButtonBuilder()
    .setCustomId(`cfg:modal:starboard_threshold:${userId}`)
    .setLabel('⭐ Modifier le seuil')
    .setStyle(ButtonStyle.Primary);

  const clearBtn = new ButtonBuilder()
    .setCustomId(`cfg:clear:starboard_channel:${userId}`)
    .setLabel('🗑️ Retirer le salon')
    .setStyle(ButtonStyle.Danger);

  const chanSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`cfg_chan:starboard_channel:${userId}`)
    .setPlaceholder('⭐ Salon où sont épinglés les meilleurs messages')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), threshBtn, clearBtn),
      new ActionRowBuilder().addComponents(chanSelect),
    ],
  };
}

// ─── JEUX ────────────────────────────────────────────────────────
function buildJeuxPanel(cfg, guild, userId) {
  const coin = cfg.currency_emoji || '🪙';
  const enabled = cfg.game_enabled ?? 1;

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎮 Jeux & Paris')
    .addFields(
      { name: '⚡ Statut',    value: onOff(enabled),                                             inline: true },
      { name: '⬇️ Mise min',  value: `**${valOr(cfg.game_min_bet, 10)}** ${coin}`,              inline: true },
      { name: '⬆️ Mise max',  value: `**${valOr(cfg.game_max_bet, 1000000)}** ${coin}`,         inline: true },
    )
    .setDescription('Configure les jeux de casino et de paris disponibles sur le serveur.')
    .setFooter({ text: 'NexusBot — Jeux' });

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

// ─── RÉPONSES PERSO ─────────────────────────────────────────────
function buildReponsesPanel(cfg, guild, userId, db) {
  const cmds = db.getCustomCommands ? db.getCustomCommands(guild.id) : [];

  const desc = cmds.length === 0
    ? '*Aucune commande personnalisée pour l\'instant.*\n\nClique sur **➕ Ajouter** pour en créer une.'
    : cmds.slice(0, 20).map(c =>
        `\`&${c.trigger}\` → ${c.response.slice(0, 65)}${c.response.length > 65 ? '…' : ''}`
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

// ─── ANNIVERSAIRES ──────────────────────────────────────────────
function buildAnnivPanel(cfg, guild, userId) {
  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🎂 Anniversaires')
    .setDescription('Anniversaires des membres enregistrés et annoncés automatiquement.')
    .addFields(
      { name: '📣 Salon anniversaires',  value: chanMention(cfg.birthday_channel), inline: true },
      { name: '🎂 Rôle anniversaire',    value: roleMention(cfg.birthday_role),    inline: true },
    )
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

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(`cfg_role:birthday_role:${userId}`)
    .setPlaceholder('🎂 Rôle attribué le jour de l\'anniversaire')
    .setMinValues(0)
    .setMaxValues(1);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(backBtn(userId), clearBtn),
      new ActionRowBuilder().addComponents(chanSelect),
      new ActionRowBuilder().addComponents(roleSelect),
    ],
  };
}

// ─── MODULES ────────────────────────────────────────────────────
function buildModulesPanel(cfg, guild, userId) {
  const enabled = cfg.game_enabled ?? 1;

  const embed = new EmbedBuilder()
    .setColor(cfg.color || '#7B2FBE')
    .setTitle('🔌 Modules — Vue d\'ensemble')
    .setDescription('Active ou désactive les modules principaux du bot en un seul clic.')
    .addFields(
      { name: '💰 Économie',   value: onOff(cfg.eco_enabled),         inline: true },
      { name: '⭐ XP',         value: onOff(cfg.xp_enabled),          inline: true },
      { name: '🎮 Jeux',       value: onOff(enabled),                 inline: true },
      { name: '🤖 AutoMod',    value: onOff(cfg.automod_enabled),     inline: true },
    )
    .setFooter({ text: 'NexusBot — Modules' });

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
function buildCategoryPanel(category, cfg, guild, userId, db, client) {
  // Délégation aux catégories avancées (embeds, cmds_adv, sys_msgs, cmd_ctrl, aliases)
  if (advancedModule && advancedModule.isAdvancedCategory(category)) {
    const panel = advancedModule.buildAdvancedCategoryPanel(category, cfg, guild, userId, db, client);
    if (panel) return panel;
  }
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
    case 'vocal':         return buildVocalPanel(cfg, guild, userId);
    case 'starboard':     return buildStarboardPanel(cfg, guild, userId);
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
  prefix: {
    title: '🔧 Préfixe du bot',
    label: 'Nouveau préfixe (1-3 caractères)',
    placeholder: '&',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 3,
  },
  color: {
    title: '🎨 Couleur du bot',
    label: 'Code couleur HEX (ex: #7B2FBE)',
    placeholder: '#7B2FBE',
    style: TextInputStyle.Short,
    minLength: 4,
    maxLength: 7,
  },
  currency_name: {
    title: '💰 Nom de la monnaie',
    label: 'Nom de la monnaie (ex: Euros, Coins)',
    placeholder: 'Euros',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 30,
  },
  currency_emoji: {
    title: '😀 Emoji de la monnaie',
    label: 'Emoji (ex: 🪙 ou €)',
    placeholder: '€',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
  daily_amount: {
    title: '📅 Montant du daily',
    label: 'Montant journalier (nombre entier)',
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
  transfer_fee: {
    title: '💸 Frais de transfert',
    label: 'Pourcentage de frais (0 = gratuit)',
    placeholder: '5',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 3,
  },
  xp_multiplier: {
    title: '✖️ Multiplicateur XP',
    label: 'Multiplicateur (ex: 1, 1.5, 2)',
    placeholder: '1',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 5,
  },
  xp_rate: {
    title: '🎯 XP par message',
    label: 'XP gagné par message envoyé',
    placeholder: '15',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 5,
  },
  level_msg: {
    title: '💬 Message de passage de niveau',
    label: 'Message ({user}, {username}, {level})',
    placeholder: 'Bravo {user} ! Tu passes au niveau **{level}** 🎉',
    style: TextInputStyle.Paragraph,
    minLength: 1,
    maxLength: 500,
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
  automod_spam_threshold: {
    title: '⚠️ Seuil anti-spam',
    label: 'Nombre de messages max par 5 secondes',
    placeholder: '5',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 3,
  },
  automod_badwords: {
    title: '🚫 Mots interdits',
    label: 'Mots séparés par des virgules',
    placeholder: 'insulte1, insulte2, motinterdit',
    style: TextInputStyle.Paragraph,
    minLength: 0,
    maxLength: 1000,
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
    placeholder: '1000000',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 10,
  },
  starboard_threshold: {
    title: '⭐ Seuil starboard',
    label: 'Nombre de ⭐ requis',
    placeholder: '3',
    style: TextInputStyle.Short,
    minLength: 1,
    maxLength: 3,
  },
  ticket_welcome_msg: {
    title: '💬 Message d\'accueil ticket',
    label: 'Message affiché à l\'ouverture d\'un ticket',
    placeholder: 'Bonjour ! Notre équipe reviendra vers vous rapidement.',
    style: TextInputStyle.Paragraph,
    minLength: 1,
    maxLength: 500,
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
    title: 'Modifier la valeur',
    label: 'Nouvelle valeur',
    placeholder: '',
    style: TextInputStyle.Short,
    minLength: 0,
    maxLength: 200,
  };

  modal.setTitle(conf.title);

  const input = new TextInputBuilder()
    .setCustomId('value')
    .setLabel(conf.label)
    .setPlaceholder(conf.placeholder)
    .setStyle(conf.style)
    .setMinLength(conf.minLength)
    .setMaxLength(conf.maxLength)
    .setRequired(conf.minLength > 0);

  if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
    try { input.setValue(String(currentValue).slice(0, conf.maxLength)); } catch {}
  }

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

// ═══════════════════════════════════════════════════════════════
// MAPPING CLÉ → CATÉGORIE (pour refresh après update)
// ═══════════════════════════════════════════════════════════════
const KEY_TO_CATEGORY = {
  prefix:               'general',
  color:                'general',
  eco_enabled:          'eco',
  rob_enabled:          'eco',
  currency_name:        'eco',
  currency_emoji:       'eco',
  daily_amount:         'eco',
  coins_per_msg:        'eco',
  transfer_fee:         'eco',
  xp_enabled:           'xp',
  xp_multiplier:        'xp',
  xp_rate:              'xp',
  level_channel:        'xp',
  level_msg:            'xp',
  welcome_channel:      'bienvenue',
  welcome_msg:          'bienvenue',
  leave_channel:        'aurevoir',
  leave_msg:            'aurevoir',
  log_channel:          'logs',
  mod_log_channel:      'logs',
  automod_log:          'logs',
  boost_channel:        'logs',
  quest_channel:        'logs',
  automod_enabled:      'automod',
  automod_antilink:     'automod',
  automod_links:        'automod',
  automod_antispam:     'automod',
  automod_spam:         'automod',
  automod_caps:         'automod',
  automod_invites:      'automod',
  automod_spam_threshold: 'automod',
  automod_badwords:     'automod',
  mute_role:            'roles',
  autorole:             'roles',
  birthday_role:        'roles',
  ticket_channel:       'tickets',
  ticket_log_channel:   'tickets',
  ticket_staff_role:    'tickets',
  ticket_welcome_msg:   'tickets',
  tempvoice_creator:    'vocal',
  starboard_channel:    'starboard',
  starboard_threshold:  'starboard',
  game_enabled:         'jeux',
  game_min_bet:         'jeux',
  game_max_bet:         'jeux',
  birthday_channel:     'anniversaires',
  cmd_add:              'reponses',
  cmd_del:              'reponses',
};

function getCategoryForKey(key) {
  return KEY_TO_CATEGORY[key] || null;
}

// ═══════════════════════════════════════════════════════════════
// GESTIONNAIRE PRINCIPAL DES INTERACTIONS CFG
// ═══════════════════════════════════════════════════════════════
async function handleConfigInteraction(interaction, db, client) {
  const customId = interaction.customId || '';
  if (!customId.startsWith('cfg')) return false;

  // ── Vérification du propriétaire du panel ─────────────────────
  function getUserId() {
    const parts = customId.split(':');
    return parts[parts.length - 1];
  }

  function checkOwner() {
    const uid = getUserId();
    if (interaction.user.id !== uid) {
      (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau de configuration ne t\'appartient pas.', ephemeral: true });
      return false;
    }
    return true;
  }

  // ── cfg:menu:userId — Menu principal ──────────────────────────
  if (customId.startsWith('cfg:menu:')) {
    if (!checkOwner()) return true;
    const userId = customId.split(':')[2];
    const cfg = db.getConfig(interaction.guildId);
    return interaction.update(buildMainMenu(cfg, interaction.guild, userId));
  }

  // ── cfg:cat:userId / cfg:cat2:userId — Sélection de catégorie ───
  if (interaction.isStringSelectMenu() && (customId.startsWith('cfg:cat:') || customId.startsWith('cfg:cat2:'))) {
    if (!checkOwner()) return true;
    const userId   = customId.split(':')[2];
    const category = interaction.values[0];
    const cfg      = db.getConfig(interaction.guildId);
    return interaction.update(buildCategoryPanel(category, cfg, interaction.guild, userId, db, client));
  }

  // ── cfg:toggle:key:userId — Basculer un booléen ───────────────
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
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.update(panel);
  }

  // ── cfg:modal:key:userId — Ouvrir un modal ────────────────────
  if (customId.startsWith('cfg:modal:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[2];
    const userId = parts[3];
    const cfg    = db.getConfig(interaction.guildId);
    return interaction.showModal(buildModal(key, userId, cfg[key]));
  }

  // ── cfg:clear:key:userId — Effacer une valeur ─────────────────
  if (customId.startsWith('cfg:clear:')) {
    if (!checkOwner()) return true;
    const parts  = customId.split(':');
    const key    = parts[2];
    const userId = parts[3];
    db.setConfig(interaction.guildId, key, null);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    const panel    = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return interaction.update(panel);
  }

  // ── cfg_chan:key:userId — Sélection de salon ──────────────────
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
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(panel);
  }

  // ── cfg_role:key:userId — Sélection de rôle ──────────────────
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
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client)
      : buildMainMenu(newCfg, interaction.guild, userId);
    return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)(panel);
  }

  // ── cfg_modal:key:userId — Soumission de modal ────────────────
  if (interaction.isModalSubmit() && customId.startsWith('cfg_modal:')) {
    const parts  = customId.split(':');
    const key    = parts[1];
    const userId = parts[2];
    if (interaction.user.id !== userId) {
      return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Ce panneau ne t\'appartient pas.', ephemeral: true });
    }

    const cfg = db.getConfig(interaction.guildId);

    // Ajouter une commande personnalisée
    if (key === 'cmd_add') {
      const trigger  = interaction.fields.getTextInputValue('trigger').toLowerCase().trim().replace(/\s+/g, '_');
      const response = interaction.fields.getTextInputValue('response').trim();
      if (!trigger || !response) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Déclencheur ou réponse vide.', ephemeral: true });
      }
      db.db.prepare(
        `INSERT OR REPLACE INTO custom_commands (guild_id, trigger, response, created_by, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(interaction.guildId, trigger, response, interaction.user.id, Math.floor(Date.now() / 1000));
      const newCfg = db.getConfig(interaction.guildId);
      const panel  = buildCategoryPanel('reponses', newCfg, interaction.guild, userId, db, client);
      return interaction.update(panel);
    }

    // Supprimer une commande personnalisée
    if (key === 'cmd_del') {
      const trigger = interaction.fields.getTextInputValue('value').toLowerCase().trim();
      const result  = db.db.prepare('DELETE FROM custom_commands WHERE guild_id=? AND trigger=?')
        .run(interaction.guildId, trigger);
      const newCfg  = db.getConfig(interaction.guildId);
      const panel   = buildCategoryPanel('reponses', newCfg, interaction.guild, userId, db, client);
      try {
        await interaction.update(panel);
        if (result.changes === 0) {
          await interaction.followUp({ content: `❌ Commande \`&${trigger}\` introuvable.`, ephemeral: true }).catch(() => {});
        }
      } catch {
        await (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ ...panel, ephemeral: true }).catch(() => {});
      }
      return;
    }

    // Mots interdits (JSON array)
    if (key === 'automod_badwords') {
      const raw   = interaction.fields.getTextInputValue('value').trim();
      const words = raw ? raw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean) : [];
      db.setConfig(interaction.guildId, key, JSON.stringify(words));
      const newCfg   = db.getConfig(interaction.guildId);
      const category = getCategoryForKey(key);
      const panel    = buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client);
      try { return await interaction.update(panel); }
      catch { return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ ...panel, ephemeral: true }).catch(() => {}); }
    }

    // Clés numériques entières
    const INTEGER_KEYS = ['daily_amount', 'coins_per_msg', 'game_min_bet', 'game_max_bet', 'automod_spam_threshold', 'starboard_threshold', 'transfer_fee', 'xp_rate'];
    let value = interaction.fields.getTextInputValue('value').trim();

    if (INTEGER_KEYS.includes(key)) {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Valeur invalide. Entre un nombre entier positif.', ephemeral: true });
      }
      value = num;
    } else if (key === 'xp_multiplier') {
      const num = parseFloat(value.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Valeur invalide. Entre un nombre positif (ex: 1.5).', ephemeral: true });
      }
      value = num;
    } else if (key === 'color') {
      if (!value.startsWith('#')) value = '#' + value;
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Format invalide. Utilise `#RRGGBB` (ex: `#7B2FBE`).', ephemeral: true });
      }
    } else if (key === 'prefix') {
      if (!value || value.length > 3) {
        return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ content: '❌ Le préfixe doit faire entre 1 et 3 caractères.', ephemeral: true });
      }
    }

    db.setConfig(interaction.guildId, key, value);
    const newCfg   = db.getConfig(interaction.guildId);
    const category = getCategoryForKey(key);
    const panel    = category
      ? buildCategoryPanel(category, newCfg, interaction.guild, userId, db, client)
      : buildMainMenu(newCfg, interaction.guild, userId);

    try { return await interaction.update(panel); }
    catch { return (interaction.deferred||interaction.replied?interaction.editReply:interaction.reply).bind(interaction)({ ...panel, ephemeral: true }).catch(() => {}); }
  }

  return false;
}

module.exports = {
  buildMainMenu,
  buildCategoryPanel,
  buildModal,
  handleConfigInteraction,
};
