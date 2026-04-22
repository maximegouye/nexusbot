const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');

// Anti-spam : stocke les messages récents par user/guild
const spamCache = new Map();

// ID du bot DISBOARD officiel
const DISBOARD_ID = '302050872383242240';

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {

    // ── Détection DISBOARD bump ──────────────────────────────────────
    // Doit tourner AVANT le guard bot pour capturer les messages du bot DISBOARD
    if (message.author.id === DISBOARD_ID && message.guild) {
      try {
        const embed = message.embeds?.[0];
        const descLower  = (embed?.description || '').toLowerCase();
        const titleLower = (embed?.title       || '').toLowerCase();

        // DISBOARD envoie "Bump done!" ou variantes dans la description/titre
        const isBumpConfirmation =
          descLower.includes('bump done')   ||
          descLower.includes('bump!')        ||
          descLower.includes('bumped')       ||
          titleLower.includes('bump done')   ||
          // format alternatif : ":thumbsup: Bump done!"
          descLower.includes(':thumbsup:');

        if (isBumpConfirmation) {
          // Récupérer l'utilisateur qui a lancé /bump (slash command)
          let bumperId = message.interaction?.user?.id
                      || message.interactionMetadata?.user?.id;

          // Fallback legacy !d bump : DISBOARD répond parfois en reply
          if (!bumperId && message.reference?.messageId) {
            const ref = await message.channel.messages
              .fetch(message.reference.messageId)
              .catch(() => null);
            if (ref && !ref.author.bot) bumperId = ref.author.id;
          }

          if (bumperId) {
            // S'assurer que la table existe (migration safe)
            db.db.prepare(`
              CREATE TABLE IF NOT EXISTS bump_reminders (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id   TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                user_id    TEXT NOT NULL,
                bumped_at  INTEGER NOT NULL,
                reminded   INTEGER DEFAULT 0
              )
            `).run();

            db.db.prepare(
              'INSERT INTO bump_reminders (guild_id, channel_id, user_id, bumped_at, reminded) VALUES (?, ?, ?, ?, 0)'
            ).run(message.guild.id, message.channel.id, bumperId, Math.floor(Date.now() / 1000));

            // Récompense économie : +50 coins pour le bumpeur
            try {
              db.addCoins(bumperId, message.guild.id, 50);
              db.db.prepare('UPDATE users SET last_bump = ? WHERE user_id = ? AND guild_id = ?')
                .run(Math.floor(Date.now() / 1000), bumperId, message.guild.id);
            } catch {}

            console.log(`[DISBOARD] ✅ Bump enregistré : ${bumperId} dans "${message.guild.name}" — rappel dans 2h`);
          }
        }
      } catch (e) {
        console.error('[DISBOARD] Erreur détection bump:', e.message);
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          interaction.reply({ content: '❌ Une erreur est survenue. Ressaie.', ephemeral: true }).catch(() => {});
        } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
          interaction.editReply({ content: '❌ Une erreur est survenue. Ressaie.', }).catch(() => {});
        }
      }
      return; // Ne pas traiter davantage les messages du bot DISBOARD
    }
    // ────────────────────────────────────────────────────────────────

    if (message.author.bot || !message.guild) return;

    // ── Commandes PRÉFIXÉES (illimitées — pas de restriction Discord) ──
    try {
      const { handlePrefixMessage } = require('../utils/prefixHandler');
      const handled = await handlePrefixMessage(message, client);
      if (handled) return;
    } catch (e) { console.error('[PREFIX] Erreur handler:', e.message); }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Une erreur est survenue. Réessaie.', ephemeral: true }).catch(() => {});
      } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
        interaction.editReply({ content: '❌ Une erreur est survenue. Réessaie.' }).catch(() => {});
      }

    // ── Mention du bot = question IA (si activé) ────────────────────
    try {
      const botId = client.user?.id;
      if (botId && message.mentions.users.has(botId)) {
        const ai = require('../utils/aiService');
        const aiCfg = ai.getAIConfig(message.guild.id, db);
        if (aiCfg.enabled && aiCfg.mention_reply && ai.isAvailable()) {
          // Vérif rôle/salon
          const roleOk = !aiCfg.required_role || message.member.roles.cache.has(aiCfg.required_role);
          const chanOk = !Array.isArray(aiCfg.allowed_channels) || aiCfg.allowed_channels.length === 0
                      || aiCfg.allowed_channels.includes(message.channel.id);
          if (roleOk && chanOk) {
            // Extraire le texte sans la mention
            const text = message.content
              .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
              .trim();
            if (text.length > 0 && text.length <= 2000) {
              try { await message.channel.sendTyping(); } catch {}
              try {
                const res = await ai.askAI({
                  prompt: text,
                  guildId: message.guild.id,
                  userId:  message.author.id,
                  cfg: aiCfg,
                });
                await message.reply({
                  embeds: [new EmbedBuilder()
                    .setColor(db.getConfig(message.guild.id).color || '#7B2FBE')
                    .setAuthor({ name: `🧠 NexusBot IA`, iconURL: client.user.displayAvatarURL() })
                    .setDescription(res.text.slice(0, 4000) || '*(vide)*')
                    .setFooter({ text: `${res.provider} • ${res.model}` })
                    .setTimestamp()],
                  allowedMentions: { repliedUser: false },
                });
              } catch (e) {
                if (e.code !== 'RATE_LIMIT') console.error('[AI mention]', e.message);
                // silencieux si rate-limit pour éviter le spam
              }
              return; // on a répondu, on n'enchaîne pas sur XP/afk etc.
            }
          }
        }
      }
    } catch (e) { console.error('[AI mention] erreur:', e.message); }

    const { guild, author, channel } = message;
    const cfg = db.getConfig(guild.id);

    // ── Stats ────────────────────────────────────────
    db.incrementStat(guild.id, 'total_messages');
    db.getUser(author.id, guild.id);
    db.db.prepare('UPDATE users SET last_message = ? WHERE user_id = ? AND guild_id = ?')
      .run(Math.floor(Date.now() / 1000), author.id, guild.id);

    // ── Détection AFK (retour) ───────────────────────
    const selfAfk = db.getAfk(guild.id, author.id);
    if (selfAfk) {
      db.removeAfk(guild.id, author.id);
      const elapsed = Math.floor(Date.now() / 1000) - selfAfk.created_at;
      const mins = Math.floor(elapsed / 60);
      const msg = await channel.send({
        embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setDescription(`✅ Bienvenue de retour <@${author.id}> ! Tu étais AFK depuis **${mins > 0 ? `${mins} min` : 'quelques secondes'}**.`)
        ]
      }).catch(() => {});
      if (msg) setTimeout(() => msg.delete().catch(() => {}), 8000);
    }

    // ── Notifier si mention d'un AFK ────────────────
    if (message.mentions.users.size > 0) {
      for (const [, mentioned] of message.mentions.users) {
        if (mentioned.bot || mentioned.id === author.id) continue;
        const afkData = db.getAfk(guild.id, mentioned.id);
        if (afkData) {
          const elapsed = Math.floor(Date.now() / 1000) - afkData.created_at;
          const mins = Math.floor(elapsed / 60);
          const notice = await channel.send({
            embeds: [new EmbedBuilder()
              .setColor('#FFA500')
              .setDescription(`💤 **${mentioned.username}** est AFK depuis **${mins > 0 ? `${mins} min` : 'quelques secondes'}** : *"${afkData.reason}"*`)
            ]
          }).catch(() => {});
          if (notice) setTimeout(() => notice.delete().catch(() => {}), 8000);
        }
      }
    }

    // ── Tracking première réponse staff (tickets v2) ────────────────────────
    try {
      const openTicket = db.db.prepare(
        "SELECT * FROM tickets WHERE guild_id=? AND channel_id=? AND status='open' AND first_response_at IS NULL"
      ).get(guild.id, channel.id);

      if (openTicket && author.id !== openTicket.user_id) {
        const isStaffSender =
          message.member?.permissions.has(0x10n) || // ManageChannels
          (cfg.ticket_staff_role && message.member?.roles.cache.has(cfg.ticket_staff_role));

        if (isStaffSender) {
          db.db.prepare('UPDATE tickets SET first_response_at=? WHERE id=?')
            .run(Math.floor(Date.now() / 1000), openTicket.id);
        }
      }
    } catch {}

    // ── Commandes personnalisées (nouvelle table custom_commands) ────────────
    const content = message.content.trim();
    if (content.length > 0) {
      const triggerWord = content.split(' ')[0].toLowerCase();
      let customCmd = null;
      try {
        customCmd = db.db.prepare('SELECT * FROM custom_commands WHERE guild_id=? AND trigger=?').get(guild.id, triggerWord);
      } catch {
        // Fallback ancienne table
        customCmd = db.getCustomCommand(guild.id, triggerWord);
      }
      if (customCmd) {
        const args = content.split(' ').slice(1).join(' ');
        const now = Math.floor(Date.now() / 1000);
        if (customCmd.cooldown && (now - (customCmd.last_used || 0)) < customCmd.cooldown) {
          // En cooldown — ignorer silencieusement
        } else {
          if (customCmd.restricted_role && !message.member.roles.cache.has(customCmd.restricted_role)) {
            // Rôle requis manquant — ignorer
          } else {
            const response = (customCmd.response || '')
              .replace(/{user}/g, `<@${author.id}>`)
              .replace(/{username}/g, author.username)
              .replace(/{server}/g, guild.name)
              .replace(/{args}/g, args)
              .replace(/{count}/g, guild.memberCount);
            if (customCmd.embed) {
              const { EmbedBuilder } = require('discord.js');
              await channel.send({ embeds: [new EmbedBuilder().setColor(customCmd.embed_color || '#7B2FBE').setDescription(response)] }).catch(() => {});
            } else {
              await channel.send(response).catch(() => {});
            }
            try { db.db.prepare('UPDATE custom_commands SET uses=uses+1, last_used=? WHERE guild_id=? AND trigger=?').run(now, guild.id, triggerWord); } catch {}
            return;
          }
        }
      }
    }

    // ── Jeu du comptage ──────────────────────────────
    const counting = db.db.prepare('SELECT * FROM counting WHERE guild_id = ?').get(guild.id);
    if (counting && counting.channel_id === channel.id) {
      const num = parseInt(message.content.trim());
      if (!isNaN(num)) {
        if (num === counting.current + 1 && counting.last_user_id !== author.id) {
          const newCount = counting.current + 1;
          const newRecord = newCount > (counting.record || 0) ? newCount : (counting.record || 0);
          db.db.prepare('UPDATE counting SET current = ?, last_user_id = ?, record = ? WHERE guild_id = ?')
            .run(newCount, author.id, newRecord, guild.id);
          await message.react('✅').catch(() => {});
        } else {
          // Mauvais nombre ou même utilisateur : reset
          const prev = counting.current;
          db.db.prepare('UPDATE counting SET current = 0, last_user_id = NULL WHERE guild_id = ?').run(guild.id);
          await message.react('❌').catch(() => {});
          const warn = await channel.send({
            embeds: [new EmbedBuilder()
              .setColor('#E74C3C')
              .setDescription(`❌ <@${author.id}> a cassé le comptage à **${prev}** ! On recommence depuis **1**.\n📊 Record : **${counting.record || 0}**`)
            ]
          }).catch(() => {});
        }
      }
    }

    // ── XP Messages ─────────────────────────────────
    if (cfg.xp_enabled) {
      // Vérifier canaux/rôles sans XP
      let noXp = false;
      try {
        const noXpCh = db.db.prepare('SELECT 1 FROM no_xp WHERE guild_id=? AND type="channel" AND target_id=?').get(guild.id, channel.id);
        if (noXpCh) noXp = true;
        if (!noXp && message.member) {
          for (const [roleId] of message.member.roles.cache) {
            const noXpR = db.db.prepare('SELECT 1 FROM no_xp WHERE guild_id=? AND type="role" AND target_id=?').get(guild.id, roleId);
            if (noXpR) { noXp = true; break; }
          }
        }
      } catch {}

      // Calculer le multiplicateur XP
      let xpMult = 1.0;
      try {
        if (message.member) {
          const mults = db.db.prepare('SELECT role_id, multiplier FROM xp_multipliers WHERE guild_id=?').all(guild.id);
          for (const m of mults) {
            if (message.member.roles.cache.has(m.role_id)) {
              xpMult = Math.max(xpMult, m.multiplier);
            }
          }
        }
      } catch {}

      const xpGain = Math.round((Math.floor(Math.random() * 10) + (cfg.xp_rate || 15)) * xpMult);
      const coinsGain = cfg.coins_per_msg || 5;

      const xpKey = `${author.id}:${guild.id}:xp_cd`;
      if (!noXp && !spamCache.has(xpKey)) {
        db.addXP(author.id, guild.id, xpGain);
        db.addCoins(author.id, guild.id, coinsGain);
        spamCache.set(xpKey, true);
        setTimeout(() => spamCache.delete(xpKey), 60000);

        // Vérifier level up
        const newLevel = db.checkLevelUp(author.id, guild.id);
        if (newLevel) {
          const levelChannel = cfg.level_channel ? guild.channels.cache.get(cfg.level_channel) : channel;
          if (levelChannel) {
            const levelMsg = cfg.level_msg
              ? cfg.level_msg.replace('{user}', `<@${author.id}>`).replace('{level}', newLevel).replace('{guild}', guild.name)
              : `🎉 Bravo <@${author.id}> ! Tu passes au niveau **${newLevel}** !`;
            levelChannel.send(levelMsg).catch(() => {});
          }
          // Assigner les rôles de niveau
          const member = guild.members.cache.get(author.id);
          if (member) db.checkAndAssignLevelRoles(member, newLevel);

          // Quête : atteindre un niveau
          updateQuestProgress(guild.id, author.id, 'level_up', 1, client);
        }
      }
    }

    // ── Highlights ────────────────────────────────────
    try { require('../utils/highlightHandler').handleHighlight(message); } catch {}

    // ── Auto-répondeur ────────────────────────────────
    try {
      const { handleAutoresponder } = require('../utils/autoresponderHandler');
      const handled = await handleAutoresponder(message);
      if (handled) return;
    } catch {}

    // ── AutoMod avancé (table automod_config) ────────
    try {
      const { handleAutomod } = require('../utils/automodHandler');
      const intercepted = await handleAutomod(message);
      if (intercepted) return;
    } catch {}

    // ── AutoMod via commande /automod (guild_config) ──
    if (!message.member?.permissions.has(8n)) {
      const content2 = message.content || '';

      // Anti-spam (/automod spam)
      if (cfg.automod_spam) {
        const spamKey2 = `automod_spam:${author.id}:${guild.id}`;
        const threshold = cfg.automod_spam_threshold || 5;
        const msgs2 = spamCache.get(spamKey2) || [];
        msgs2.push(Date.now());
        const recent2 = msgs2.filter(t => Date.now() - t < 5000);
        spamCache.set(spamKey2, recent2);
        if (recent2.length >= threshold) {
          spamCache.delete(spamKey2);
          await message.delete().catch(() => {});
          const w = await channel.send(`🚨 <@${author.id}> Stop le spam ! (${recent2.length} messages en 5s)`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
          if (cfg.automod_log) {
            const logCh = guild.channels.cache.get(cfg.automod_log);
            if (logCh) logCh.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🛡️ AutoMod — Spam').addFields({ name: '👤', value: `<@${author.id}>`, inline: true }, { name: '📋', value: `Spam (${recent2.length} msgs/5s)`, inline: true }).setTimestamp()] }).catch(() => {});
          }
          return;
        }
      }

      // Anti-CAPS (/automod caps)
      if (cfg.automod_caps && content2.length >= 8) {
        const letters2 = content2.replace(/[^a-zA-Z]/g, '');
        if (letters2.length >= 6 && (content2.replace(/[^A-Z]/g, '').length / letters2.length) > 0.7) {
          await message.delete().catch(() => {});
          const w = await channel.send(`⚠️ <@${author.id}> Évitez les messages en MAJUSCULES excessives.`).catch(() => null);
          if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Anti-invitations Discord (/automod invites)
      if (cfg.automod_invites && /discord\.gg\/|discord\.com\/invite\//i.test(content2)) {
        await message.delete().catch(() => {});
        const w = await channel.send(`🔗 <@${author.id}> Les invitations Discord ne sont pas autorisées.`).catch(() => null);
        if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
        if (cfg.automod_log) {
          const logCh = guild.channels.cache.get(cfg.automod_log);
          if (logCh) logCh.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🛡️ AutoMod — Invitation').addFields({ name: '👤', value: `<@${author.id}>`, inline: true }, { name: '📋', value: 'Invitation Discord', inline: true }).setTimestamp()] }).catch(() => {});
        }
        return;
      }

      // Anti-liens externes (/automod liens)
      if (cfg.automod_links && /https?:\/\/[^\s]+/i.test(content2)) {
        await message.delete().catch(() => {});
        const w = await channel.send(`🔗 <@${author.id}> Les liens externes ne sont pas autorisés ici.`).catch(() => null);
        if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
        return;
      }

      // Mots interdits (/automod mots)
      if (cfg.automod_words) {
        try {
          const badWords2 = JSON.parse(cfg.automod_words);
          const lower2 = content2.toLowerCase();
          if (badWords2.length > 0 && badWords2.some(w => lower2.includes(w))) {
            await message.delete().catch(() => {});
            const w = await channel.send(`🤬 <@${author.id}> Ce message contient un mot interdit.`).catch(() => null);
            if (w) setTimeout(() => w.delete().catch(() => {}), 5000);
            if (cfg.automod_log) {
              const logCh = guild.channels.cache.get(cfg.automod_log);
              if (logCh) logCh.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🛡️ AutoMod — Mot interdit').addFields({ name: '👤', value: `<@${author.id}>`, inline: true }).setTimestamp()] }).catch(() => {});
            }
            return;
          }
        } catch {}
      }
    }

    // ── Auto-Modération legacy ────────────────────────
    if (cfg.automod_enabled) {
      // Anti-liens
      if (cfg.automod_antilink) {
        const urlRegex = /(https?:\/\/|www\.|discord\.gg\/)\S+/gi;
        if (urlRegex.test(message.content) && !message.member.permissions.has(8n)) {
          await message.delete().catch(() => {});
          const warn = await channel.send(`⚠️ <@${author.id}> Les liens ne sont pas autorisés ici.`);
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }

      // Anti-spam (5 messages en 5 secondes)
      if (cfg.automod_antispam) {
        const spamKey = `spam:${author.id}:${guild.id}`;
        const msgs = spamCache.get(spamKey) || [];
        msgs.push(Date.now());
        const recent = msgs.filter(t => Date.now() - t < 5000);
        spamCache.set(spamKey, recent);
        if (recent.length >= 5) {
          await message.delete().catch(() => {});
          if (recent.length === 5) {
            const warn = await channel.send(`🚨 <@${author.id}> Stop le spam !`);
            setTimeout(() => warn.delete().catch(() => {}), 5000);
          }
          return;
        }
      }

      // Anti-mots interdits
      const badWords = JSON.parse(cfg.automod_badwords || '[]');
      if (badWords.length > 0) {
        const msgContent = message.content.toLowerCase();
        const found = badWords.some(word => msgContent.includes(word.toLowerCase()));
        if (found && !message.member.permissions.has(8n)) {
          await message.delete().catch(() => {});
          const warn = await channel.send(`⚠️ <@${author.id}> Ce message contient un mot interdit.`);
          setTimeout(() => warn.delete().catch(() => {}), 5000);
          return;
        }
      }
    }

    // ── Quête : envoyer des messages ─────────────────
    updateQuestProgress(guild.id, author.id, 'messages', 1, client);

    // ── Missions quotidiennes : tracking messages ─────
    try {
      const { progressMission } = require('../commands_guild/unique/missions');
      progressMission(author.id, guild.id, 'messages');
    } catch {}
  }
};

async function updateQuestProgress(guildId, userId, type, amount, client) {
  try {
    const quests = db.db.prepare(
      'SELECT * FROM quests WHERE guild_id = ? AND status = "active"'
    ).all(guildId);

    for (const quest of quests) {
      if (!quest.description || !quest.description.toLowerCase().includes(type)) continue;
      const existing = db.db.prepare(
        'SELECT * FROM quest_contributions WHERE quest_id = ? AND guild_id = ? AND user_id = ?'
      ).get(quest.id, guildId, userId);

      if (existing) {
        db.db.prepare('UPDATE quest_contributions SET amount = amount + ? WHERE id = ?')
          .run(amount, existing.id);
      } else {
        db.db.prepare('INSERT INTO quest_contributions (quest_id, guild_id, user_id, amount) VALUES (?, ?, ?, ?)')
          .run(quest.id, guildId, userId, amount);
      }

      const totalContrib = db.db.prepare('SELECT SUM(amount) as total FROM quest_contributions WHERE quest_id = ?').get(quest.id);
      const newCurrent = Math.min(totalContrib.total || 0, quest.target);
      db.db.prepare('UPDATE quests SET current = ? WHERE id = ?').run(newCurrent, quest.id);

      if (newCurrent >= quest.target && quest.current < quest.target) {
        db.db.prepare('UPDATE quests SET status = "completed" WHERE id = ?').run(quest.id);
        const contributors = db.db.prepare('SELECT DISTINCT user_id FROM quest_contributions WHERE quest_id = ?').all(quest.id);
        const guild = client.guilds.cache.get(guildId);
        const cfg = db.getConfig(guildId);
        if (guild && cfg.quest_channel) {
          const qCh = guild.channels.cache.get(cfg.quest_channel);
          if (qCh) {
            const reward = JSON.parse(quest.reward || '{"coins":500,"xp":100}');
            qCh.send({
              content: `🏆 **QUÊTE ACCOMPLIE !** **${quest.title}** est terminée grâce à ${contributors.length} membre(s) ! Récompense distribuée !`
            }).catch(() => {});
            for (const { user_id } of contributors) {
              db.addCoins(user_id, guildId, reward.coins || 500);
              db.addXP(user_id, guildId, reward.xp || 100);
            }
          }
        }
      }
    }
  } catch (e) {}
}

module.exports.updateQuestProgress = updateQuestProgress;
