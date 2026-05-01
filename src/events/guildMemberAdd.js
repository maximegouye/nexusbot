const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const { onMemberJoin } = require('../utils/antiRaidWorker');

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
    ctx.fillText(`Tu es le ${guild.memberCount.toLocaleString('fr-FR')}ème membre de ${guild.name}`, 230, 162);

    ctx.fillStyle = '#666666';
    ctx.font = '13px sans-serif';
    ctx.fillText('NexusBot v2 • Bienvenue !', W - 190, H - 12);

    return canvas.toBuffer('image/png');
  } catch { return null; }
}

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    // Anti-raid check (au tout début)
    try { onMemberJoin(member); } catch {}

    const { guild, user } = member;
    const cfg = db.getConfig(guild.id);

    db.incrementStat(guild.id, 'new_members');

    // ── Bonus de bienvenue 5 000€ (si solde = 0) ──────
    try {
      const newUser = db.getUser(user.id, guild.id);
      if ((newUser.balance || 0) === 0 && (newUser.bank || 0) === 0) {
        db.addCoins(user.id, guild.id, 5000);
        console.log(`[Welcome] 5 000€ donnés à ${user.username} (${user.id})`);
      }
    } catch {}

    // ── Suivi des invitations + récompenses ────────────
    try {
      const { handleInviteJoin } = require('../utils/inviteCache');
      const inviteResult = await handleInviteJoin(member);

      if (inviteResult?.inviterId) {
        const inviterId  = inviteResult.inviterId;
        const guildId    = guild.id;

        // Compter le total d'invitations valides de cet inviteur
        let inviteCount = 0;
        try {
          const row = db.db.prepare(
            'SELECT COUNT(*) as cnt FROM invites WHERE guild_id=? AND inviter_id=?'
          ).get(guildId, inviterId);
          inviteCount = row?.cnt || 0;
        } catch {}

        // Récompense en coins : 50 € par invitation
        const coinsReward = 50;
        try { db.addCoins(inviterId, guildId, coinsReward); } catch {}

        // Rôles paliers selon le nombre d'invitations
        // Les rôles sont configurables via /invite-roles (créés par les admins)
        const PALIERS = [1, 5, 10, 25, 50, 100];
        if (PALIERS.includes(inviteCount)) {
          try {
            const palierRole = db.db.prepare(
              "SELECT role_id FROM invite_role_rewards WHERE guild_id=? AND invite_count=?"
            ).get(guildId, inviteCount);
            if (palierRole?.role_id) {
              const inviter = await guild.members.fetch(inviterId).catch(() => null);
              if (inviter) {
                const role = guild.roles.cache.get(palierRole.role_id);
                if (role) await inviter.roles.add(role).catch(() => {});
              }
            }
          } catch {}
        }

        // Notifier l'inviteur en DM (silencieux si DM bloqués)
        try {
          const inviterUser = await guild.client.users.fetch(inviterId).catch(() => null);
          if (inviterUser) {
            inviterUser.send({
              embeds: [new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('🎉 Nouvelle invitation !')
                .setDescription(
                  `**${user.username}** vient de rejoindre **${guild.name}** grâce à ton invitation !\n\n` +
                  `💰 Tu reçois **+${coinsReward}€**\n` +
                  `📊 Total : **${inviteCount}** invitation(s) validée(s)`
                )
                .setThumbnail(user.displayAvatarURL({ size: 64 }))
                .setTimestamp()
              ]
            }).catch(() => {});
          }
        } catch {}
      }
    } catch {}

    // ── Auto-rôle ─────────────────────────────────────
    if (cfg.autorole) {
      const role = guild.roles.cache.get(cfg.autorole);
      if (role) member.roles.add(role).catch(() => {});
    }

    // 🛑 KILL-SWITCH GLOBAL — désactive le système de vérification anti-bot.
    // Mis en place en période de pub payante : le mode cybersécurité Discord
    // bloque les DM des nouveaux arrivants, ils ne peuvent pas cliquer le
    // bouton "Je suis humain" et finissent kick automatiquement après 10 min.
    // Mettre à `false` pour réactiver. Pendant ce temps, l'autorole (cfg.autorole)
    // donne accès direct au serveur, ce qui est suffisant pour des arrivées
    // organiques de pub payante.
    const VERIFICATION_GLOBALLY_DISABLED = true;

    // ── Vérification anti-bot (si configurée) ─────────────────
    if (!VERIFICATION_GLOBALLY_DISABLED && cfg.verification_role) {
      const unverifiedRole = guild.roles.cache.get(cfg.verification_role);
      if (unverifiedRole) {
        try { await member.roles.add(unverifiedRole); } catch {}
        // Envoyer DM avec bouton de vérification
        const verifyEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(`🔒 Vérification requise — ${guild.name}`)
          .setDescription(
            `Salut **${user.username}** ! Pour accéder au serveur **${guild.name}**, clique sur le bouton ci-dessous.\n\n` +
            `⏱️ Cette vérification expire dans **10 minutes**.`
          )
          .setThumbnail(guild.iconURL())
          .setFooter({ text: 'Ce message est automatique — NexusBot' });

        const verifyRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`verify_human_${guild.id}_${user.id}`)
            .setLabel('✅ Je suis humain')
            .setStyle(ButtonStyle.Success)
        );

        try {
          await user.send({ embeds: [verifyEmbed], components: [verifyRow] });
        } catch {
          // DM bloqués → envoyer dans le canal de bienvenue à la place
          const wCh = guild.channels.cache.get(cfg.welcome_channel);
          if (wCh) {
            const pubEmbed = new EmbedBuilder()
              .setColor(0x5865F2)
              .setDescription(`<@${user.id}> → Clique ici pour te vérifier et accéder au serveur !`);
            const pubRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`verify_human_${guild.id}_${user.id}`)
                .setLabel('✅ Je suis humain')
                .setStyle(ButtonStyle.Success)
            );
            await wCh.send({ embeds: [pubEmbed], components: [pubRow] }).catch(() => {});
          }
        }

        // Auto-kick si pas vérifié après 10 minutes
        setTimeout(async () => {
          try {
            const refreshed = await guild.members.fetch(user.id).catch(() => null);
            if (refreshed && refreshed.roles.cache.has(cfg.verification_role)) {
              await refreshed.kick('Vérification non complétée dans les 10 minutes').catch(() => {});
            }
          } catch {}
        }, 10 * 60 * 1000).unref(); // unref() permet au processus de se terminer si aucune autre tâche n'est en attente
      }
    }

    // ── Message de bienvenue ──────────────────────────
    // Priorité : table system_messages(event='welcome') > cfg.welcome_msg > défaut
    const sysMsg = db.getSystemMessage ? db.getSystemMessage(guild.id, 'welcome') : null;
    const sysEnabled = sysMsg ? (sysMsg.enabled ?? 1) : 1;
    if (!sysEnabled) return; // désactivé via le panneau

    const channelId = (sysMsg && sysMsg.channel_id) || cfg.welcome_channel;
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const memberCount = guild.memberCount;
    const defaultMsg = `🎉 **Bienvenue {user} sur {server} !** Tu es le **{count}ᵉ** membre.\n\n💰 **Cadeau de bienvenue : 5 000€ déjà crédités** sur ton compte !\n\n🎯 **Pour commencer en 30 secondes :**\n• \`/daily\` → 250€ + bonus de fidélité (×2 dès J3, ×5 à J7, jusqu'à ×2000 à J365 !)\n• \`/work\` → travailler chaque heure pour gagner sans risque\n• \`/slots mise:50 lignes:5\` → tester la machine à sous\n• \`/roue-fortune mise:100\` → tenter la roue jackpot\n• \`/coffre-magique mise:100\` → 5 niveaux progressifs (×7 max)\n• \`/leaderboard\` → voir le top des plus riches\n\n🏆 **Système de rang automatique :** Bronze (5k€) · Silver (50k€) · Gold (500k€) · Platinum (5M€) · Diamond (50M€). Plus tu gagnes, plus ton rôle évolue automatiquement !`;

    // Texte : system_messages.content > cfg.welcome_msg > défaut
    const rawText = (sysMsg && sysMsg.content) || cfg.welcome_msg || defaultMsg;

    // 🛡️ Auto-réparation des références salon cassées (`# inconnu`)
    // Si le welcome_msg contient un <#ID> dont le salon n'existe plus
    // (config obsolète après suppression/recréation), on remplace par le
    // salon des règles ou de vérification actuel s'il existe, sinon par
    // un texte fallback. Évite l'embarrassant "Lis les règles dans #inconnu".
    const fallbackChannelId = cfg.rules_channel || cfg.verification_channel
      || guild.channels.cache.find(c => /règles|rules|reglement/i.test(c.name))?.id
      || guild.channels.cache.find(c => /v[ée]rif/i.test(c.name))?.id
      || null;
    const repairedText = rawText.replace(/<#(\d+)>/g, (match, channelId) => {
      if (guild.channels.cache.has(channelId)) return match;
      if (fallbackChannelId) return `<#${fallbackChannelId}>`;
      return 'le salon dédié';
    });

    const msg = repairedText
      .replace(/\{user\}/g,     `<@${user.id}>`)
      .replace(/\{username\}/g, user.username)
      .replace(/\{server\}/g,   guild.name)
      .replace(/\{count\}/g,    memberCount.toLocaleString('fr-FR'))
      .replace(/\{rules\}/g,    fallbackChannelId ? `<#${fallbackChannelId}>` : 'le salon des règles');

    // Si un embed JSON custom est défini dans system_messages, on l'utilise tel quel
    let customEmbedData = sysMsg && sysMsg.embed_json
      ? (() => { try { return JSON.parse(sysMsg.embed_json); } catch { return null; } })()
      : null;

    // Tentative d'image de bienvenue canvas
    const cardBuffer = await buildWelcomeCard(member, guild);

    // Construction de l'embed : custom (via system_messages) ou défaut
    let embed;
    if (customEmbedData) {
      try {
        const { rebuildEmbedFromData, applyVarsToTemplate } = require('../utils/configPanelAdvanced');
        embed = rebuildEmbedFromData(applyVarsToTemplate(customEmbedData, {
          userMention: `<@${user.id}>`,
          username: user.username,
          serverName: guild.name,
          memberCount,
        }));
      } catch { customEmbedData = null; }
    }
    if (!embed) {
      embed = new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`👋 Un nouveau membre nous rejoint !`)
        .setDescription(msg)
        .addFields(
          { name: '📅 Compte créé', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: '👥 Membres',     value: `**${memberCount.toLocaleString('fr-FR')}** au total`, inline: true }
        )
        .setFooter({ text: guild.name, iconURL: guild.iconURL() })
        .setTimestamp();
    }

    if (!cardBuffer) embed.setThumbnail(user.displayAvatarURL({ size: 256 }));

    // Mode 'text' : pas d'embed, juste le texte ; 'both' : les deux ; 'embed' : juste l'embed (défaut)
    const mode = (sysMsg && sysMsg.mode) || 'embed';
    const payload = {};
    if (mode === 'text') {
      payload.content = msg;
    } else {
      payload.embeds = [embed];
      if (mode === 'both') payload.content = msg;
    }
    if (cardBuffer && (mode !== 'text')) payload.files = [new AttachmentBuilder(cardBuffer, { name: 'welcome.png' })];

    await channel.send(payload).catch(() => {});

    // ── DM de bienvenue au nouveau membre ──────────────
    const dmEmbed = new EmbedBuilder()
      .setColor(cfg.color || '#7B2FBE')
      .setTitle(`👋 Bienvenue sur ${guild.name} !`)
      .setDescription(
        `Salut **${user.username}**, on est ravis de t'accueillir 🎉\n\n` +
        `Voici quelques informations pour bien démarrer :`
      )
      .addFields(
        { name: '📋 Règles du serveur',    value: 'Pense à lire les règles pour profiter d\'une ambiance agréable.', inline: false },
        { name: '🎫 Besoin d\'aide ?',      value: 'Ouvre un ticket depuis le salon support — notre équipe est là pour toi.', inline: false },
        { name: '🏆 Système de niveaux',    value: 'Plus tu participes, plus tu montes en grade et tu gagnes de la monnaie virtuelle !', inline: false },
      )
      .setThumbnail(guild.iconURL())
      .setFooter({ text: `${guild.name} · On espère te voir souvent !` })
      .setTimestamp();

    user.send({ embeds: [dmEmbed] }).catch(() => {}); // Ignore si DM bloqués
  }
};
