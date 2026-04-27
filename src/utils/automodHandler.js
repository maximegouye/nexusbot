/**
 * NexusBot v2 — Gestionnaire AutoMod (messageCreate)
 * Appelé depuis l'event messageCreate
 */
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// Cache anti-spam : Map<guildId_userId, timestamps[]>
const spamCache = new Map();

function getAutomodCfg(db, guildId) {
  let row = db.db.prepare('SELECT * FROM automod_config WHERE guild_id = ?').get(guildId);
  if (!row) return null;
  row.allowed_links = JSON.parse(row.allowed_links || '[]');
  row.bad_words     = JSON.parse(row.bad_words || '[]');
  return row;
}

async function applyAction(message, cfg, reason) {
  try {
    // Supprimer le message dans tous les cas
    await message.delete().catch(() => {});

    const member = message.member;
    if (!member) return;

    if (cfg.action === 'warn') {
      // On enregistre un avertissement via db si disponible
      try {
        const db = require('../database/db');
        db.db.prepare('INSERT INTO warnings (guild_id, user_id, mod_id, reason, timestamp) VALUES (?,?,?,?,?)')
          .run(message.guildId, message.author.id, message.client.user.id, `[AutoMod] ${reason}`, Date.now());
      } catch {}
      message.channel.send({
        embeds: [new EmbedBuilder().setColor('Yellow')
          .setDescription(`⚠️ <@${message.author.id}> — **Avertissement AutoMod** : ${reason}`)
        ]
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
    }

    if (cfg.action === 'mute') {
      await member.timeout(5 * 60 * 1000, `AutoMod: ${reason}`).catch(() => {});
      message.channel.send({
        embeds: [new EmbedBuilder().setColor('Orange')
          .setDescription(`🔇 <@${message.author.id}> a été muté 5 minutes — **${reason}**`)
        ]
      }).then(m => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
    }

    if (cfg.action === 'kick') {
      await member.kick(`AutoMod: ${reason}`).catch(() => {});
    }

    // Log si configuré
    if (cfg.log_channel) {
      const logCh = message.guild.channels.cache.get(cfg.log_channel);
      if (logCh) {
        logCh.send({ embeds: [new EmbedBuilder()
          .setColor('Red')
          .setTitle('🛡️ AutoMod — Violation détectée')
          .addFields(
            { name: '👤 Membre',  value: `<@${message.author.id}> (${message.author.username})`, inline: true },
            { name: '📋 Raison',  value: reason, inline: true },
            { name: '⚡ Action',   value: cfg.action, inline: true },
            { name: '💬 Salon',   value: `<#${message.channelId}>`, inline: true },
          )
          .setTimestamp()
        ]}).catch(() => {});
      }
    }
  } catch {}
}

async function handleAutomod(message) {
  if (!message.guild || message.author.bot) return;

  // Ignorer les modérateurs
  if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const db = require('../database/db');
  const cfg = getAutomodCfg(db, message.guildId);
  if (!cfg) return;

  const content = message.content || '';

  // ── Anti-Spam ─────────────────────────────────────────
  if (cfg.anti_spam) {
    const key = `${message.guildId}_${message.author.id}`;
    const now = Date.now();
    const window = (cfg.spam_window || 5) * 1000;
    const threshold = cfg.spam_threshold || 5;

    if (!spamCache.has(key)) spamCache.set(key, []);
    const times = spamCache.get(key).filter(t => now - t < window);
    times.push(now);
    spamCache.set(key, times);

    if (times.length >= threshold) {
      spamCache.delete(key);
      return applyAction(message, cfg, `Spam détecté (${times.length} messages en ${cfg.spam_window}s)`);
    }
  }

  // ── Anti-Invitations Discord ──────────────────────────
  if (cfg.anti_invites && /discord\.gg\/|discord\.com\/invite\//i.test(content)) {
    return applyAction(message, cfg, 'Invitation Discord non autorisée');
  }

  // ── Anti-Liens ────────────────────────────────────────
  if (cfg.anti_links) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = content.match(urlRegex) || [];
    const allowed = cfg.allowed_links || [];
    for (const url of urls) {
      const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
      if (!allowed.some(a => domain === a || domain.endsWith('.' + a))) {
        return applyAction(message, cfg, 'Lien externe non autorisé');
      }
    }
  }

  // ── Anti-Caps ─────────────────────────────────────────
  if (cfg.anti_caps && content.length >= 8) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length >= 6) {
      const uppers = content.replace(/[^A-Z]/g, '').length;
      const pct = (uppers / letters.length) * 100;
      if (pct >= (cfg.caps_threshold || 70)) {
        return applyAction(message, cfg, `Message en majuscules (${Math.round(pct)}%)`);
      }
    }
  }

  // ── Anti-Mentions ─────────────────────────────────────
  if (cfg.anti_mentions) {
    const mentions = (content.match(/<@!?\d+>/g) || []).length;
    if (mentions >= (cfg.mentions_limit || 5)) {
      return applyAction(message, cfg, `Trop de mentions (${mentions})`);
    }
  }

  // ── Mots interdits ────────────────────────────────────
  if (cfg.bad_words && cfg.bad_words.length > 0) {
    const lower = content.toLowerCase();
    const found = cfg.bad_words.find(w => lower.includes(w));
    if (found) {
      return applyAction(message, cfg, `Mot interdit détecté`);
    }
  }
}

module.exports = { handleAutomod };
