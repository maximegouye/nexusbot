const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../../database/db');
const path = require('path');

// Chargement conditionnel de canvas (optionnel)
let createCanvas, loadImage, registerFont;
try {
  ({ createCanvas, loadImage, registerFont } = require('canvas'));
  try {
    registerFont(path.join(__dirname, '../../../assets/fonts/Montserrat-Bold.ttf'),    { family: 'Montserrat', weight: 'bold' });
    registerFont(path.join(__dirname, '../../../assets/fonts/Montserrat-Regular.ttf'), { family: 'MontserratR' });
  } catch {}
} catch {}

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.35, level - 1));
}

function clampColor(hex, fallback = '#7B2FBE') {
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : fallback;
}

function roundRect(ctx, x, y, w, h, r = 10) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const THEMES = {
  default:  { bg1: '#0f0f1a', bg2: '#1a1033', accent: '#7B2FBE', accent2: '#c77dff', star: '#b388ff' },
  galaxy:   { bg1: '#050d1f', bg2: '#0d1b3e', accent: '#00b4d8', accent2: '#90e0ef', star: '#caf0f8' },
  ocean:    { bg1: '#001219', bg2: '#005f73', accent: '#0a9396', accent2: '#94d2bd', star: '#e9d8a6' },
  fire:     { bg1: '#1a0000', bg2: '#3d0000', accent: '#e85d04', accent2: '#ffba08', star: '#ffd166' },
  nature:   { bg1: '#0a1a0a', bg2: '#1a3a1a', accent: '#40916c', accent2: '#74c69d', star: '#d8f3dc' },
  electro:  { bg1: '#0d0d0d', bg2: '#1a1a2e', accent: '#00f5ff', accent2: '#7b00ff', star: '#ffffff' },
};

async function buildCard(target, userData, rank, theme, W = 934, H = 282) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const level    = userData.level || 1;
  const xp       = userData.xp || 0;
  const xpStart  = xpForLevel(level);
  const xpNeeded = xpForLevel(level + 1);
  const progress = Math.min(Math.max((xp - xpStart) / (xpNeeded - xpStart), 0), 1);
  const t = THEMES[theme] || THEMES.default;

  // ─── Fond dégradé ───────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, t.bg1);
  bgGrad.addColorStop(1, t.bg2);
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // ─── Particules / étoiles déco ───────────────────────────
  ctx.fillStyle = t.star + '55';
  const seed = target.id.charCodeAt(0);
  for (let i = 0; i < 30; i++) {
    const px = ((seed * (i * 137 + 17)) % W);
    const py = ((seed * (i * 53  + 29)) % H);
    const pr = 0.8 + (i % 3) * 0.6;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Bande latérale accent ──────────────────────────────
  const sideGrad = ctx.createLinearGradient(0, 0, 0, H);
  sideGrad.addColorStop(0, t.accent);
  sideGrad.addColorStop(1, t.accent2);
  roundRect(ctx, 0, 0, 8, H, 4);
  ctx.fillStyle = sideGrad;
  ctx.fill();

  // ─── Panneau avatar ─────────────────────────────────────
  const cx = 130, cy = H / 2, cr = 85;
  // Glow
  const glow = ctx.createRadialGradient(cx, cy, cr - 10, cx, cy, cr + 22);
  glow.addColorStop(0, t.accent + 'aa');
  glow.addColorStop(1, t.accent + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, cr + 22, 0, Math.PI * 2);
  ctx.fill();
  // Bague
  ctx.beginPath();
  ctx.arc(cx, cy, cr + 6, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(cx - cr, cy, cx + cr, cy);
  ringGrad.addColorStop(0, t.accent);
  ringGrad.addColorStop(1, t.accent2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Avatar
  try {
    const url = target.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const img = await loadImage(url);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - cr, cy - cr, cr * 2, cr * 2);
    ctx.restore();
  } catch {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = t.accent + '66';
    ctx.fill();
    ctx.restore();
  }

  // Badge niveau (bulle)
  const badgeX = cx + 55, badgeY = cy + 55;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 22, 0, Math.PI * 2);
  const badgeGrad = ctx.createLinearGradient(badgeX - 22, badgeY, badgeX + 22, badgeY);
  badgeGrad.addColorStop(0, t.accent);
  badgeGrad.addColorStop(1, t.accent2);
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Montserrat, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${level}`, badgeX, badgeY + 5);
  ctx.textAlign = 'left';

  // ─── Section droite ─────────────────────────────────────
  const rx = 245;

  // Nom + tag
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px Montserrat, Arial, sans-serif';
  const nameStr = target.username.length > 18 ? target.username.slice(0, 18) + '…' : target.username;
  ctx.fillText(nameStr, rx, 72);

  // Rang + niveau
  ctx.fillStyle = t.accent2;
  ctx.font = 'bold 16px Montserrat, Arial, sans-serif';
  ctx.fillText(`NIVEAU ${level}`, rx, 100);
  ctx.fillStyle = '#999999';
  ctx.font = '15px sans-serif';
  ctx.fillText(`Rang #${rank} sur le serveur`, rx + 100, 100);

  // ─── Barre XP ──────────────────────────────────────────
  const bx = rx, by = 120, bw = 610, bh = 28;

  // Fond
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fillStyle = '#ffffff18';
  ctx.fill();

  // Remplissage
  if (progress > 0) {
    const filled = Math.max(bh, bw * progress);
    const barGrad = ctx.createLinearGradient(bx, 0, bx + filled, 0);
    barGrad.addColorStop(0, t.accent);
    barGrad.addColorStop(1, t.accent2);
    roundRect(ctx, bx, by, filled, bh, bh / 2);
    ctx.fillStyle = barGrad;
    ctx.fill();

    // Brillance
    roundRect(ctx, bx, by, filled, bh / 2, bh / 2);
    ctx.fillStyle = '#ffffff15';
    ctx.fill();
  }

  // XP textes
  const xpCur = Math.max(0, xp - xpStart).toLocaleString('fr-FR');
  const xpMax = Math.max(1, xpNeeded - xpStart).toLocaleString('fr-FR');
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px sans-serif';
  ctx.fillText(`${xpCur} / ${xpMax} XP`, bx, by - 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(progress * 100)}%`, bx + bw, by - 6);
  ctx.textAlign = 'left';

  // ─── Stats inférieures ──────────────────────────────────
  const stats = [
    { label: 'XP TOTAL',   val: xp.toLocaleString('fr-FR') },
    { label: 'MESSAGES',   val: (userData.message_count || 0).toLocaleString('fr-FR') },
    { label: 'VOCAL (MIN)', val: (userData.voice_minutes || 0).toLocaleString('fr-FR') },
    { label: 'MONNAIE',    val: `${(userData.balance || 0).toLocaleString('fr-FR')} 🪙` },
  ];

  const statW = bw / stats.length;
  stats.forEach((s, i) => {
    const sx = bx + i * statW;

    // Fond stat
    roundRect(ctx, sx + 2, by + 40, statW - 6, 72, 10);
    ctx.fillStyle = '#ffffff0a';
    ctx.fill();

    // Valeur
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Montserrat, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(s.val).length > 10 ? s.val.slice(0, 10) : s.val, sx + statW / 2, by + 75);

    // Label
    ctx.fillStyle = t.accent2;
    ctx.font = '11px sans-serif';
    ctx.fillText(s.label, sx + statW / 2, by + 95);
    ctx.textAlign = 'left';
  });

  // ─── Footer ─────────────────────────────────────────────
  ctx.fillStyle = '#ffffff33';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('NexusBot v2 • /rank', W - 14, H - 10);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('⭐ Affiche ta magnifique carte de rang')
    .addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false))
    .addStringOption(o => o
      .setName('theme')
      .setDescription('Thème de ta carte (Premium requis pour les thèmes exclusifs)')
      .setRequired(false)
      .addChoices(
        { name: '🟣 Default', value: 'default' },
        { name: '🌌 Galaxy (Premium)', value: 'galaxy' },
        { name: '🌊 Ocean (Premium)', value: 'ocean' },
        { name: '🔥 Fire (Premium)', value: 'fire' },
        { name: '🌿 Nature (Premium)', value: 'nature' },
        { name: '⚡ Electro (Premium)', value: 'electro' },
      )
    ),
  cooldown: 8,

  async execute(interaction) {
    await interaction.deferReply();

    const target     = interaction.options.getUser('membre') || interaction.user;
    const themeOpt   = interaction.options.getString('theme') || 'default';
    const cfg        = db.getConfig(interaction.guildId);
    const userData   = db.getUser(target.id, interaction.guildId);

    // Vérif premium pour thèmes exclusifs
    const premiumThemes = ['galaxy', 'ocean', 'fire', 'nature', 'electro'];
    let theme = themeOpt;
    if (premiumThemes.includes(theme)) {
      const isPrem = db.isPremium ? db.isPremium(interaction.guildId) : false;
      if (!isPrem) {
        theme = 'default';
        await interaction.followUp({
          embeds: [new EmbedBuilder()
            .setColor('#7B2FBE')
            .setTitle('⭐ Thème Premium requis')
            .setDescription(`Le thème **${themeOpt}** est réservé aux serveurs Premium.\nUtilise \`/premium activer\` pour débloquer tous les thèmes !`)
          ],
          ephemeral: true
        }).catch(() => {});
      }
    }

    const xp   = userData.xp || 0;
    const rank = db.db.prepare('SELECT COUNT(*) as r FROM users WHERE guild_id = ? AND xp > ?')
      .get(interaction.guildId, xp)?.r ?? 0;

    // Canvas disponible ?
    if (createCanvas) {
      try {
        const buffer = await buildCard(target, userData, rank + 1, theme);
        return interaction.editReply({
          files: [new AttachmentBuilder(buffer, { name: `rank-${theme}.png` })]
        });
      } catch (err) {
        console.error('[RANK] Erreur canvas:', err.message);
        // fallback embed ci-dessous
      }
    }

    // ── Fallback embed (sans canvas) ────────────────────────
    const level    = userData.level || 1;
    const xpStart  = Math.floor(100 * Math.pow(1.35, level - 1));
    const xpNeeded = Math.floor(100 * Math.pow(1.35, level));
    const progress = Math.min(Math.max((xp - xpStart) / (xpNeeded - xpStart), 0), 1);
    const filled   = Math.round(progress * 20);
    const bar      = '█'.repeat(filled) + '░'.repeat(20 - filled);
    const accent   = clampColor(cfg?.color, '#7B2FBE');

    const embed = new EmbedBuilder()
      .setColor(accent)
      .setTitle(`⭐ Carte de rang — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ extension: 'png', size: 256 }))
      .addFields(
        { name: '🏆 Niveau',   value: `**${level}**`, inline: true },
        { name: '🥇 Rang',     value: `**#${rank + 1}**`, inline: true },
        { name: '⭐ XP Total', value: `**${xp.toLocaleString('fr-FR')}**`, inline: true },
        { name: `📊 Progression (${Math.round(progress * 100)}%)`,
          value: `\`${bar}\`\n${Math.max(0, xp - xpStart).toLocaleString('fr-FR')} / ${Math.max(1, xpNeeded - xpStart).toLocaleString('fr-FR')} XP` },
        { name: '💬 Messages', value: `${(userData.message_count || 0).toLocaleString('fr-FR')}`, inline: true },
        { name: '🎙️ Vocal',   value: `${(userData.voice_minutes || 0)} min`, inline: true },
        { name: '🪙 Monnaie', value: `${(userData.balance || 0).toLocaleString('fr-FR')}`, inline: true },
      )
      .setFooter({ text: 'NexusBot v2 • Installe canvas pour les cartes visuelles' });

    return interaction.editReply({ embeds: [embed] });
  }
};
