/**
 * NexusBot — embedFactory premium.
 *
 * Crée des embeds visuellement cohérents partout dans le bot.
 * Chaque helper accepte :
 *   - un titre (string)
 *   - un corps (string ou array de lignes)
 *   - des options (fields, footer, thumbnail, etc.)
 *
 * Couleurs cohérentes :
 *   success  ✅  #2ECC71
 *   error    ❌  #E74C3C
 *   warning  ⚠️  #F39C12
 *   info     💡  #3498DB
 *   loading  ⏳  #9B59B6
 *   money    💰  #F1C40F
 *   premium  ⭐  #FFD700
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  success: '#2ECC71',
  error:   '#E74C3C',
  warning: '#F39C12',
  info:    '#3498DB',
  loading: '#9B59B6',
  money:   '#F1C40F',
  premium: '#FFD700',
  casino:  '#E67E22',
  default: '#7B2FBE',
};

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    '💡',
  loading: '⏳',
  money:   '💰',
  premium: '⭐',
  casino:  '🎰',
};

function normalizeBody(body) {
  if (!body) return '';
  if (Array.isArray(body)) return body.join('\n');
  return String(body);
}

function base(kind, title, body, opts = {}) {
  const icon = ICONS[kind] || '';
  const color = opts.color || COLORS[kind] || COLORS.default;
  const eb = new EmbedBuilder()
    .setColor(color)
    .setTitle(title ? `${icon} ${title}`.trim() : `${icon}`.trim())
    .setDescription(normalizeBody(body).slice(0, 4000));
  if (opts.fields?.length) eb.addFields(opts.fields);
  if (opts.thumbnail) eb.setThumbnail(opts.thumbnail);
  if (opts.image) eb.setImage(opts.image);
  if (opts.footer) eb.setFooter(typeof opts.footer === 'string' ? { text: opts.footer } : opts.footer);
  if (opts.author) eb.setAuthor(typeof opts.author === 'string' ? { name: opts.author } : opts.author);
  if (opts.timestamp !== false) eb.setTimestamp();
  return eb;
}

// Presets principaux
const success = (title, body, opts) => base('success', title, body, opts);
const error   = (title, body, opts) => base('error',   title, body, opts);
const warning = (title, body, opts) => base('warning', title, body, opts);
const info    = (title, body, opts) => base('info',    title, body, opts);
const loading = (title, body, opts) => base('loading', title || 'Chargement…', body || 'Un instant…', opts);
const money   = (title, body, opts) => base('money',   title, body, opts);
const premium = (title, body, opts) => base('premium', title, body, opts);
const casino  = (title, body, opts) => base('casino',  title, body, opts);

// Barre de progression ASCII
function progressBar(value, max, length = 20) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const filled = Math.round(pct * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

// Confirmation avec 2 boutons + handler customId
function confirm(title, body, opts = {}) {
  const idYes = opts.yesId || 'confirm_yes';
  const idNo  = opts.noId  || 'confirm_no';
  const embed = warning(title, body, opts);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(idYes).setLabel(opts.yesLabel || '✅ Confirmer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(idNo).setLabel(opts.noLabel || '❌ Annuler').setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row] };
}

// Formatage rapide
const fmtMoney = (n, symbol = '€') => `**${Number(n).toLocaleString('fr-FR')}${symbol}**`;
const fmtDate  = (ts) => ts ? `<t:${Math.floor(ts)}:R>` : 'jamais';

module.exports = {
  COLORS, ICONS,
  base, success, error, warning, info, loading, money, premium, casino,
  progressBar, confirm, fmtMoney, fmtDate,
};
