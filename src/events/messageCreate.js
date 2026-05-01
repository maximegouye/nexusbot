'use strict';

const path = require('path');
const fs   = require('fs');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { checkActivityRoles } = require('../utils/activityRoleCheck');

const PREFIX = '&';

// ── XP par message ────────────────────────────────────────
// Cooldown par utilisateur pour éviter le spam (60 secondes)
const _xpCooldown = new Map(); // key: `${userId}-${guildId}`

// Cleanup des cooldowns expirés toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  const expiredKeys = [];
  for (const [key, timestamp] of _xpCooldown.entries()) {
    if (now - timestamp > 120_000) { // Purge après 2 minutes
      expiredKeys.push(key);
    }
  }
  expiredKeys.forEach(key => _xpCooldown.delete(key));
  if (expiredKeys.length > 0) {
    console.log(`[XP Cooldown] Cleanup: ${expiredKeys.length} entries supprimées`);
  }
}, 300_000); // Exécute toutes les 5 minutes

// 🎯 Bonus FIRST MESSAGE du jour + STREAK QUOTIDIEN
// Le streak (jours consécutifs) est le plus gros driver de retention sur
// les apps sociales. Chaque jour consécutif augmente le bonus. 1 jour
// raté = streak reset à 1. Affichage motivant avec milestones (7, 30, 100, 365).
const _firstMsgCache = new Map(); // userId-guildId → 'YYYY-MM-DD'
async function handleFirstMessageOfDay(message) {
  try {
    if (!message.guild) return;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${message.author.id}-${message.guild.id}`;

    if (_firstMsgCache.get(key) === today) return;

    // Auto-migration des colonnes de streak si absentes
    try {
      const cols = db.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
      if (!cols.includes('last_first_msg_day')) db.db.prepare('ALTER TABLE users ADD COLUMN last_first_msg_day TEXT').run();
      if (!cols.includes('daily_streak'))       db.db.prepare('ALTER TABLE users ADD COLUMN daily_streak INTEGER DEFAULT 0').run();
      if (!cols.includes('best_streak'))        db.db.prepare('ALTER TABLE users ADD COLUMN best_streak INTEGER DEFAULT 0').run();
    } catch {}

    const u = db.getUser(message.author.id, message.guild.id);
    if (!u) return;
    if (u.last_first_msg_day === today) {
      _firstMsgCache.set(key, today);
      return;
    }

    // Calcul streak : si la veille était le dernier jour actif → streak +1
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    let streak = (u.daily_streak || 0);
    let streakReset = false;
    let welcomeBackDays = 0;

    if (u.last_first_msg_day === yesterday) {
      streak += 1;
    } else if (u.last_first_msg_day) {
      // Calcule depuis combien de temps il/elle est absent(e)
      const lastDate = new Date(u.last_first_msg_day);
      const now = new Date();
      welcomeBackDays = Math.floor((now - lastDate) / 86_400_000);
      streakReset = streak >= 3;
      streak = 1;
    } else {
      streak = 1;
    }
    const bestStreak = Math.max(streak, u.best_streak || 0);

    // Bonus croissants selon streak (cap à 7×)
    const streakMult = Math.min(1 + (streak - 1) * 0.15, 7); // J1=1×, J2=1.15×, J7=1.9×, J30=cap 7×
    const bonusXP    = Math.round(50 * streakMult);
    const bonusCoins = Math.round(100 * streakMult);

    db.addXP(message.author.id, message.guild.id, bonusXP);
    db.addCoins(message.author.id, message.guild.id, bonusCoins);

    try {
      db.db.prepare('UPDATE users SET last_first_msg_day = ?, daily_streak = ?, best_streak = ? WHERE user_id = ? AND guild_id = ?')
        .run(today, streak, bestStreak, message.author.id, message.guild.id);
    } catch {}
    _firstMsgCache.set(key, today);

    const cfg = db.getConfig(message.guild.id);
    const coin = cfg?.currency_emoji || '€';

    // Milestone celebrations
    let milestoneText = '';
    if (streak === 7)   milestoneText = '\n🏅 **Streak 7 jours !** Tu es régulier — chapeau.';
    else if (streak === 30)  milestoneText = '\n🏆 **Streak 30 jours !** Bonus mensuel : +5000 € 🎉';
    else if (streak === 100) milestoneText = '\n👑 **Streak 100 jours !** Tu es légendaire. +25 000 € 🌟';
    else if (streak === 365) milestoneText = '\n💎 **Streak 365 jours !** UN AN COMPLET. +100 000 € 💎';
    if (streak === 30)  db.addCoins(message.author.id, message.guild.id, 5_000);
    if (streak === 100) db.addCoins(message.author.id, message.guild.id, 25_000);
    if (streak === 365) db.addCoins(message.author.id, message.guild.id, 100_000);

    const fireEmoji = streak >= 100 ? '👑' : streak >= 30 ? '💎' : streak >= 7 ? '🔥' : '✨';
    const resetText = streakReset ? `\n💔 *Ton streak a été réinitialisé après une absence...*` : '';

    // 🎉 WELCOME BACK : bonus de retour si absent ≥ 7 jours
    let welcomeBackText = '';
    if (welcomeBackDays >= 7) {
      const returnBonus = Math.min(welcomeBackDays * 200, 10_000); // 200€/jour absent, cap 10k
      db.addCoins(message.author.id, message.guild.id, returnBonus);
      welcomeBackText = `\n🎉 **Bon retour !** Absent depuis **${welcomeBackDays} jours** — bonus de retour : **+${returnBonus.toLocaleString('fr-FR')} ${coin}** 💝`;
      message.react('💝').catch(() => {});
    }

    message.react('🎁').catch(() => {});
    message.channel.send({
      content: `🎁 <@${message.author.id}> **Premier message du jour !** +${bonusXP} XP & +${bonusCoins.toLocaleString('fr-FR')} ${coin}\n${fireEmoji} **Streak : ${streak} jour${streak > 1 ? 's' : ''}** consécutifs (record perso : ${bestStreak})${milestoneText}${resetText}${welcomeBackText}`,
    }).then(m => setTimeout(() => m.delete().catch(() => {}), 14000)).catch(() => {});
  } catch {}
}

async function handleMessageXP(message) {
  try {
    if (!message.guild) return;
    const cfg = db.getConfig(message.guild.id);
    if (cfg.xp_enabled === 0) return;

    const key = `${message.author.id}-${message.guild.id}`;
    const now  = Date.now();
    const last = _xpCooldown.get(key) || 0;
    if (now - last < 60_000) return; // 60s cooldown anti-spam
    _xpCooldown.set(key, now);

    // XP aléatoire entre 5 et 15
    const xpGain    = Math.floor(Math.random() * 11) + 5;
    const coinsGain = 1;

    const before = db.addXP(message.author.id, message.guild.id, xpGain);
    db.addCoins(message.author.id, message.guild.id, coinsGain);

    // Tracking pour le classement hebdomadaire
    try {
      const wlb = require('../utils/weeklyLeaderboard');
      wlb.incrementWeeklyXP(message.guild.id, message.author.id, xpGain);
    } catch {}

    // Streak quotidien : incrémente 1× par jour, annonce les paliers
    try {
      const streak = require('../utils/dailyStreak');
      const info = streak.updateStreak(message.guild.id, message.author.id);
      if (info && info.streakChanged) {
        streak.announceStreakMilestone(message, info).catch(() => {});
      }
    } catch {}

    // Achievements : incrémente le compteur de messages et débloque les badges
    try {
      const ach = require('../utils/achievements');
      ach.addStat(message.author.id, message.guild.id, 'messages_sent', 1);
      const newBadges = ach.checkAchievements(message.author.id, message.guild.id);
      if (newBadges.length > 0) {
        const { EmbedBuilder } = require('discord.js');
        for (const b of newBadges) {
          const emb = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 Achievement débloqué !`)
            .setDescription([
              `<@${message.author.id}> a débloqué **${b.emoji} ${b.name}**`,
              '',
              `*${b.desc}*`,
              '',
              `🎁 +${b.reward.toLocaleString('fr-FR')} €`,
            ].join('\n'))
            .setTimestamp();
          message.channel.send({ embeds: [emb] }).catch(() => {});
        }
      }
    } catch {}

    // Level-up ?
    const newLevel = db.checkLevelUp(message.author.id, message.guild.id);
    if (newLevel && before) {
      const lvlCfg = cfg;
      // Chercher le salon de level-up configuré
      const lvlChannel = lvlCfg.level_channel
        ? message.guild.channels.cache.get(lvlCfg.level_channel)
        : message.channel;
      if (lvlChannel) {
        // Vérifier si un palier de récompense est débloqué
        let rewardAlert = '';
        try {
          const recompensesCmd = require('../commands_guild/economy/recompenses');
          if (recompensesCmd.checkMilestones && recompensesCmd.checkMilestones(message.author.id, message.guild.id)) {
            rewardAlert = '\n\n🎁 **Tu as des récompenses à réclamer !** → `/recompenses`';
          }
        } catch {}

        const embed = new EmbedBuilder()
          .setColor('#f1c40f')
          .setTitle('⬆️ Level Up !')
          .setDescription(
            `Félicitations <@${message.author.id}> ! Tu passes au **niveau ${newLevel}** 🎉\n\n` +
            `Continue comme ça pour débloquer des récompenses !` + rewardAlert
          )
          .setThumbnail(message.author.displayAvatarURL({ size: 128 }))
          .setTimestamp();
        lvlChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // Vérifier les rôles d'activité (20% de chance pour ne pas surcharger)
    if (Math.random() < 0.2) {
      checkActivityRoles(message.author.id, message.guild.id, message.guild).catch(() => {});
    }
  } catch (_) {}
}

// -- Chargement recursif de toutes les commandes slash
function loadAllCommands(dir, map = new Map()) {
  if (!fs.existsSync(dir)) return map;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.includes('disabled')) continue;
      loadAllCommands(full, map);
    } else if (entry.name.endsWith('.js')) {
      try {
        const cmd = require(full);
        const name = cmd.data?.name ?? null;
        if (name && typeof cmd.execute === 'function') {
          map.set(name.toLowerCase(), cmd);
        }
      } catch (e) {
        // fichier invalide, on skip
      }
    }
  }
  return map;
}

// Cache des commandes (charge au premier appel)
let _cmds = null;
function getCmds() {
  if (!_cmds) {
    const dir = path.join(__dirname, '..', 'commands');
    _cmds = loadAllCommands(dir);
    console.log(`[PREFIX] ${_cmds.size} commandes chargees pour le prefixe &`);
  }
  return _cmds;
}

// -- Cree un objet "interaction" factice a partir d'un message
function mockInteraction(message, args) {
  const mentionedUser   = message.mentions.users.first()   ?? null;
  const mentionedMember = message.mentions.members?.first() ?? null;
  const cleanArgs = args.filter(a => !/<@!?\d+>/.test(a));

  // Compteur de position : chaque appel getString/getInteger/getNumber consomme un arg
  let _pos = 0;

  // Résout 'all'/'tout'/'max' en solde liquide du joueur
  function resolveBalance() {
    try {
      const dbMod = require('../database/db');
      return dbMod.getUser(message.author.id, message.guild?.id)?.balance || 0;
    } catch { return 0; }
  }

  // Parse une valeur brute en nombre (gère all/tout/%, moitié, etc.)
  function parseAmount(raw) {
    const s = (raw ?? '').toLowerCase().trim();
    if (!s) return null;
    if (['all', 'tout', 'max', 'allin'].includes(s)) return resolveBalance();
    if (['moitie', 'moitié', 'half', '50%'].includes(s)) return Math.floor(resolveBalance() / 2);
    if (s.endsWith('%')) {
      const pct = parseFloat(s);
      return isFinite(pct) ? Math.floor(resolveBalance() * Math.min(pct, 100) / 100) : null;
    }
    const v = parseFloat(s);
    return isFinite(v) ? Math.floor(v) : null;
  }

  const obj = {
    user:            message.author,
    member:          message.member,
    guild:           message.guild,
    guildId:         message.guild?.id ?? null,
    channel:         message.channel,
    channelId:       message.channel?.id ?? null,
    client:          message.client,
    locale:          'fr',
    deferred:        true,
    replied:         false,

    isChatInputCommand:  () => true,
    isButton:            () => false,
    isModalSubmit:       () => false,
    isStringSelectMenu:  () => false,
    isAutocomplete:      () => false,

    options: {
      _args:   cleanArgs,
      _raw:    args,
      _msg:    message,

      getString(name, required = false) {
        return cleanArgs[_pos++] ?? null;
      },
      getInteger(name, required = false) {
        const raw = cleanArgs[_pos++];
        if (raw == null) return null;
        const parsed = parseAmount(raw);
        return (parsed != null && Number.isFinite(parsed)) ? parsed : null;
      },
      getNumber(name, required = false) {
        const raw = cleanArgs[_pos++];
        if (raw == null) return null;
        const parsed = parseAmount(raw);
        return (parsed != null && Number.isFinite(parsed)) ? parsed : null;
      },
      getUser(name, required = false) {
        return mentionedUser; // pas de consommation positionnelle
      },
      getMember(name, required = false) {
        return mentionedMember;
      },
      getBoolean(name, required = false) {
        const v = (cleanArgs[_pos++] ?? '').toLowerCase();
        return v === 'true' || v === 'oui' || v === 'yes' || v === '1';
      },
      getChannel(name, required = false) {
        return message.mentions.channels?.first() ?? null;
      },
      getRole(name, required = false) {
        return message.mentions.roles?.first() ?? null;
      },
      getSubcommand(required = false)      { return null; },
      getSubcommandGroup(required = false) { return null; },
    },

    async deferReply(opts = {}) { /* no-op */ },
    async reply(opts) {
      try { return await message.reply(opts); }
      catch (e) { return message.channel.send(opts).catch(() => {}); }
    },
    async editReply(opts) {
      try { return await message.reply(opts); }
      catch (e) { return message.channel.send(opts).catch(() => {}); }
    },
    async followUp(opts) {
      return message.channel.send(opts).catch(() => {});
    },
    async deleteReply() { /* no-op */ },
  };

  return obj;
}

// -- Commandes admin hardcodees
async function handleAdmin(cmd, args, message) {
  const isAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator);
  const guildId = message.guild?.id;
  if (!guildId) return false;

  if (cmd === 'donner' || cmd === 'give') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    let mention = message.mentions.users.first();
    if (!mention) {
      // Support typed @username (not a real Discord mention)
      const uname = (args.find(a => a.startsWith('@')) || '').slice(1).toLowerCase();
      if (uname) {
        try {
          const fetched = await message.guild.members.fetch();
          const found = fetched.find(m =>
            m.user.username.toLowerCase() === uname ||
            m.displayName.toLowerCase() === uname ||
            (m.nickname && m.nickname.toLowerCase() === uname) ||
            (m.user.globalName && m.user.globalName.toLowerCase() === uname)
          );
          if (found) mention = found.user;
        } catch(_) {}
      }
    }
    const amount  = parseInt(args.find(a => !/<@/.test(a) && !a.startsWith('@')) ?? '');
    if (!mention || isNaN(amount) || amount <= 0) {
      await message.reply('Usage : `&donner @membre montant`');
      return true;
    }
    try {
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?,?)').run(mention.id, guildId);
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(amount, mention.id, guildId);
      await message.reply('**' + mention.username + '** a recu **' + amount.toLocaleString('fr-FR') + '** €.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'retirer' || cmd === 'remove' || cmd === 'enlever') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    let mention = message.mentions.users.first();
    if (!mention) {
      // Support typed @username (not a real Discord mention)
      const uname = (args.find(a => a.startsWith('@')) || '').slice(1).toLowerCase();
      if (uname) {
        try {
          const fetched = await message.guild.members.fetch();
          const found = fetched.find(m =>
            m.user.username.toLowerCase() === uname ||
            m.displayName.toLowerCase() === uname ||
            (m.nickname && m.nickname.toLowerCase() === uname) ||
            (m.user.globalName && m.user.globalName.toLowerCase() === uname)
          );
          if (found) mention = found.user;
        } catch(_) {}
      }
    }
    const amount  = parseInt(args.find(a => !/<@/.test(a) && !a.startsWith('@')) ?? '');
    if (!mention || isNaN(amount) || amount <= 0) {
      await message.reply('Usage : `&retirer @membre montant`');
      return true;
    }
    try {
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?,?)').run(mention.id, guildId);
      db.db.prepare('UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(amount, mention.id, guildId);
      await message.reply('**' + amount.toLocaleString('fr-FR') + '** € retirés à **' + mention.username + '**.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'reset') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    let mention = message.mentions.users.first();
    if (!mention) {
      // Support typed @username (not a real Discord mention)
      const uname = (args.find(a => a.startsWith('@')) || '').slice(1).toLowerCase();
      if (uname) {
        try {
          const fetched = await message.guild.members.fetch();
          const found = fetched.find(m =>
            m.user.username.toLowerCase() === uname ||
            m.displayName.toLowerCase() === uname ||
            (m.nickname && m.nickname.toLowerCase() === uname) ||
            (m.user.globalName && m.user.globalName.toLowerCase() === uname)
          );
          if (found) mention = found.user;
        } catch(_) {}
      }
    }
    if (!mention) { await message.reply('Usage : `&reset @membre`'); return true; }
    try {
      db.db.prepare('UPDATE users SET balance = 0, bank = 0 WHERE user_id = ? AND guild_id = ?').run(mention.id, guildId);
      await message.reply('Compte de **' + mention.username + '** remis a zero.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'solde' || cmd === 'bal') {
    // Accessible à tous — admins peuvent voir le solde d'un autre membre
    let mention = message.mentions.users.first() || message.author;
    if (mention !== message.author && !isAdmin) mention = message.author;
    try {
      const cmds = getCmds();
      const balCmd = cmds.get('balance');
      if (balCmd) {
        // Utiliser la vraie commande balance pour un affichage riche
        const mock = mockInteraction(message, args);
        // Override getUser pour retourner la cible correcte
        mock.options.getUser = () => mention;
        await balCmd.execute(mock);
      } else {
        // Fallback simple
        const row = db.db.prepare('SELECT balance, bank FROM users WHERE user_id = ? AND guild_id = ?').get(mention.id, guildId);
        const bal  = (row?.balance) || 0;
        const bank = (row?.bank)    || 0;
        await message.reply(`💶 **${mention.username}** — Portefeuille : **${bal.toLocaleString('fr-FR')}** | Banque : **${bank.toLocaleString('fr-FR')}** €`);
      }
    } catch(e) { await message.reply('❌ Erreur : ' + e.message).catch(() => {}); }
    return true;
  }

  if (cmd === 'cooldown' || cmd === 'cd') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    let mention = message.mentions.users.first();
    if (!mention) {
      // Support typed @username (not a real Discord mention)
      const uname = (args.find(a => a.startsWith('@')) || '').slice(1).toLowerCase();
      if (uname) {
        try {
          const fetched = await message.guild.members.fetch();
          const found = fetched.find(m =>
            m.user.username.toLowerCase() === uname ||
            m.displayName.toLowerCase() === uname ||
            (m.nickname && m.nickname.toLowerCase() === uname) ||
            (m.user.globalName && m.user.globalName.toLowerCase() === uname)
          );
          if (found) mention = found.user;
        } catch(_) {}
      }
    }
    if (!mention) { await message.reply('Usage : `&cooldown @membre`'); return true; }
    try {
      db.db.prepare('UPDATE users SET last_work=0, last_daily=0, last_crime=0, last_rob=0 WHERE user_id=? AND guild_id=?').run(mention.id, guildId);
      await message.reply('Cooldowns de **' + mention.username + '** reinitialises.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'aide' || (cmd === 'help' && isAdmin)) {
    const embed = new EmbedBuilder()
      .setTitle('Commandes administrateurs &')
      .setColor(0x5865F2)
      .setDescription([
        '`&donner @membre montant` - Donner des €',
        '`&retirer @membre montant` - Retirer des €',
        '`&reset @membre` - Remettre le compte a zero',
        '`&solde @membre` - Voir le solde',
        '`&cooldown @membre` - Reinitialiser les cooldowns',
        '',
        'Toutes les commandes slash fonctionnent aussi avec `&`',
      ].join('\n'));
    await message.reply({ embeds: [embed] });
    return true;
  }

  return false;
}

// -- Handler principal
module.exports = {
  name: 'messageCreate',

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ── XP par message (tous les messages, pas seulement les commandes) ──
    handleMessageXP(message).catch(() => {});

    // ── Bonus First Message du Jour : encourage la connexion quotidienne ──
    handleFirstMessageOfDay(message).catch(() => {});

    // ── Commandes préfixe & ──────────────────────────────────────────
    if (!message.content.startsWith(PREFIX)) return;

    const raw     = message.content.slice(PREFIX.length).trim();
    const parts   = raw.split(/\s+/);
    const cmdName = parts.shift().toLowerCase();
    if (!cmdName) return;

    const adminHandled = await handleAdmin(cmdName, parts, message);
    if (adminHandled) return;

    const cmds = getCmds();
    const cmd  = cmds.get(cmdName);
    if (!cmd) return;

    const mock = mockInteraction(message, parts);
    try {
      await cmd.execute(mock);
    } catch (e) {
      console.error(`[PREFIX &${cmdName}] Erreur:`, e?.message || e);
      // Commande échouée (voir console)
    }
  },
};
