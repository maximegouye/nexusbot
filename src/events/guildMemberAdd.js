const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('../database/db');

// Canvas optionnel pour image de bienvenue
let createCanvas, loadImage;
try { ({ createCanvas, loadImage } = require('canvas')); } catch {}

async function buildWelcomeCard(member, guild) {
  if (!createCanvas) return null;
  try {
    const W = 800, H = 240;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Fond dégradé
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f0f1a');
    bg.addColorStop(1, '#1a1033');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Bande gauche
    ctx.fillStyle = '#7B2FBE';
    ctx.fillRect(0, 0, 6, H);

    // Avatar circulaire
    const ax = 120, ay = H / 2, ar = 75;
    try {
      const img = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }));
      // Bague
      ctx.beginPath();
      ctx.arc(ax, ay, ar + 5, 0, Math.PI * 2);
      ctx.fillStyle = '#7B2FBE';
      ctx.fill();
      // Image
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, ar, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2);
      ctx.restore();
    } catch {}

    // Textes
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText(`Bienvenue !`, 230, 90);

    ctx.fillStyle = '#c77dff';
    ctx.font = 'bold 26px Arial, sans-serif';
    const name = member.user.username.length > 20 ? member.user.username.slice(0, 20) + '…' : member.user.username;
    ctx.fillText(name, 230, 128);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial, sans-serif';
    ctx.fillText(`Tu es le ${guild.memberCount.toLocaleString('fr')}ème membre de ${guild.name}`, 230, 162);

    ctx.fillStyle = '#666666';
    ctx.font = '13px sans-serif';
    ctx.fillText('NexusBot v2 • Bienvenue !', W - 190, H - 12);

    return canvas.toBuffer('image/png');
  } catch { return null; }
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const { guild, user } = member;
    const cfg = db.getConfig(guild.id);

    db.incrementStat(guild.id, 'new_members');

    // ── Suivi des invitations ───────────────────────────
    try {
      const { handleInviteJoin } = require('../utils/inviteCache');
      await handleInviteJoin(member);
    } catch {}

    // ── Auto-rôle ─────────────────────────────────────
    if (cfg.autorole) {
      const role = guild.roles.cache.get(cfg.autorole);
      if (role) member.roles.add(role).catch(() => {});
    }

    // ── Message de bienvenue ──────────────────────────
    if (!cfg.welcome_channel) return;
    const channel = guild.channels.cache.get(cfg.welcome_channel);
    if (!channel) return;

    const memberCount = guild.memberCount;
    const defaultMsg = `🎉 Bienvenue **{username}** sur **{server}** ! Tu es le **{count}ème** membre !\n\n📋 Lis les règles et choisis tes rôles !`;

    const msg = (cfg.welcome_msg || defaultMsg)
      .replace('{user}',     `<@${user.id}>`)
      .replace('{username}', user.username)
      .replace('{server}',   guild.name)
      .replace('{count}',    memberCount.toLocaleString('fr'));

    // Tentative d'image de bienvenue canvas
    const cardBuffer = await buildWelcomeCard(member, guild);

    const embed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`👋 Nouveau membre !`)
      .setDescription(msg)
      .addFields(
        { name: '📅 Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Membres',     value: `**${memberCount}** au total`, inline: true }
      )
      .setFooter({ text: guild.name, iconURL: guild.iconURL() })
      .setTimestamp();

    if (!cardBuffer) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));

    const payload = { embeds: [embed] };
    if (cardBuffer) payload.files = [new AttachmentBuilder(cardBuffer, { name: 'welcome.png' })];

    await channel.send(payload).catch(() => {});

    // ── DM de bienvenue au nouveau membre ──────────────
    const dmEmbed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`👋 Bienvenue sur ${guild.name} !`)
      .setDescription(
        `Salut **${user.username}** ! On est super contents de t'avoir parmi nous 🎉\n\n` +
        `Voici quelques infos pour bien démarrer :`
      )
      .addFields(
        { name: '📋 Les règles', value: 'Lis les règles du serveur pour une bonne ambiance.', inline: false },
        { name: '🎫 Besoin d\'aide ?', value: 'Ouvre un ticket depuis le salon support — notre équipe est là pour toi.', inline: false },
        { name: '🏆 Système de niveaux', value: 'Plus tu participes, plus tu montes en grade et tu gagnes des coins !', inline: false },
      )
      .setThumbnail(guild.iconURL())
      .setFooter({ text: `${guild.name} • On espère te voir souvent !` })
      .setTimestamp();

    user.send({ embeds: [dmEmbed] }).catch(() => {}); // Ignore si DM bloqués
  }
};
