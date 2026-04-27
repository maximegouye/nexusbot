/**
 * NexusBot — Commandes Économie Préfixées COMPLÈTES
 * Fixes :
 *  - Déductions via db.removeCoins() (plus jamais addCoins(-x))
 *  - Gains fortement augmentés
 *  - +30 commandes économie
 */
const { EmbedBuilder } = require('discord.js');

// ─── Helpers locaux ────────────────────────────────────────
const fmt = n => (n || 0).toLocaleString('fr-FR');

function cooldownLeft(lastTs, seconds) {
  const now = Math.floor(Date.now() / 1000);
  const diff = seconds - (now - (lastTs || 0));
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Jeux de cartes ────────────────────────────────────────
function buildDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const vals  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck  = [];
  for (const s of suits) for (const v of vals) deck.push({ v, s });
  return deck.sort(() => Math.random() - 0.5);
}
function cardVal(card) {
  if (['J','Q','K'].includes(card.v)) return 10;
  if (card.v === 'A') return 11;
  return parseInt(card.v);
}
function handScore(hand) {
  let score = hand.reduce((t, c) => t + cardVal(c), 0);
  let aces  = hand.filter(c => c.v === 'A').length;
  while (score > 21 && aces-- > 0) score -= 10;
  return score;
}
function cardStr(c) { return `\`${c.v}${c.s}\``; }

// ─── Slots ─────────────────────────────────────────────────
const SLOTS_SYMBOLS = ['🍒','🍋','🍊','🍇','⭐','💎','🎰'];
function spinSlots() {
  return [0,1,2].map(() => SLOTS_SYMBOLS[Math.floor(Math.random() * SLOTS_SYMBOLS.length)]);
}
function slotsMultiplier(r) {
  if (r[0] === r[1] && r[1] === r[2]) return r[0] === '💎' ? 15 : r[0] === '🎰' ? 8 : r[0] === '⭐' ? 5 : 3;
  if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) return 1.5;
  return 0;
}

// ─── Liste de commandes ────────────────────────────────────
const commands = [

  // ════════════════════════════════════════════
  //  PORTEFEUILLE
  // ════════════════════════════════════════════
  {
    name: 'balance',
    aliases: ['bal', 'solde', 'argent', 'coins', 'wallet', 'portefeuille', 'money', 'cash'],
    description: 'Voir son solde',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const u   = db.getUser(target.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const total = (u.balance || 0) + (u.bank || 0);
      const top10 = db.db.prepare('SELECT user_id FROM users WHERE guild_id=? ORDER BY balance+COALESCE(bank,0) DESC LIMIT 10').all(message.guild.id);
      const rank  = db.db.prepare('SELECT COUNT(*)+1 as r FROM users WHERE guild_id=? AND balance+COALESCE(bank,0) > ?').get(message.guild.id, total)?.r || '?';
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle(`💰 Solde de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👛 Portefeuille', value: `**${fmt(u.balance)} ${coin}**`, inline: true },
          { name: '🏦 Banque',       value: `**${fmt(u.bank)} ${coin}**`,    inline: true },
          { name: '💎 Total',        value: `**${fmt(total)} ${coin}**`,     inline: true },
          { name: '🏆 Classement',   value: `**#${rank}**`,                  inline: true },
          { name: '📈 Total gagné',  value: `**${fmt(u.total_earned)} ${coin}**`, inline: true },
          { name: '🔥 Streak',       value: `**${u.streak || 0}** jours`,    inline: true },
        )
        .setFooter({ text: 'Utilisez &deposit pour mettre à la banque' })
      ]});
    }
  },

  {
    name: 'bank',
    aliases: ['banque', 'coffre', 'vault'],
    description: 'Voir le détail de sa banque',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const u = db.getUser(message.author.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🏦 Ma Banque')
        .addFields(
          { name: '🏦 Solde banque',    value: `**${fmt(u.bank)} ${coin}**`,    inline: true },
          { name: '👛 Portefeuille',    value: `**${fmt(u.balance)} ${coin}**`, inline: true },
          { name: '💎 Fortune totale',  value: `**${fmt((u.balance||0)+(u.bank||0))} ${coin}**`, inline: true },
        )
        .setDescription('Utilisez `&deposit <montant>` ou `&withdraw <montant>`')
        .setFooter({ text: 'La banque protège votre argent des vols !' })
      ]});
    }
  },

  {
    name: 'deposit',
    aliases: ['dep', 'save', 'epargne', 'mettre', 'stocker'],
    description: 'Déposer des euros à la banque',
    usage: '[montant|all|max]',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) === 0) return message.reply('❌ Votre portefeuille est vide.');
      let amount;
      if (!args[0] || args[0] === 'all' || args[0] === 'max' || args[0] === 'tout') {
        amount = u.balance;
      } else {
        amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ Montant invalide.');
      }
      if (amount > (u.balance || 0)) return message.reply(`❌ Vous n'avez que **${fmt(u.balance)} ${coin}** dans votre portefeuille.`);
      db.removeCoins(message.author.id, message.guild.id, amount);
      db.db.prepare('UPDATE users SET bank = bank + ? WHERE user_id=? AND guild_id=?').run(amount, message.author.id, message.guild.id);
      const now = db.getUser(message.author.id, message.guild.id);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🏦 Dépôt effectué !')
        .addFields(
          { name: '💰 Déposé',      value: `**+${fmt(amount)} ${coin}**`,  inline: true },
          { name: '🏦 Banque',      value: `**${fmt(now.bank)} ${coin}**`, inline: true },
          { name: '👛 Portefeuille',value: `**${fmt(now.balance)} ${coin}**`, inline: true },
        )
      ]});
    }
  },

  {
    name: 'withdraw',
    aliases: ['with', 'retirer', 'retrait', 'sortir', 'take'],
    description: 'Retirer des euros de la banque',
    usage: '[montant|all|max]',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.bank || 0) === 0) return message.reply('❌ Votre banque est vide.');
      let amount;
      if (!args[0] || args[0] === 'all' || args[0] === 'max' || args[0] === 'tout') {
        amount = u.bank;
      } else {
        amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply('❌ Montant invalide.');
      }
      if (amount > (u.bank || 0)) return message.reply(`❌ Vous n'avez que **${fmt(u.bank)} ${coin}** en banque.`);
      db.db.prepare('UPDATE users SET bank = MAX(0, bank - ?) WHERE user_id=? AND guild_id=?').run(amount, message.author.id, message.guild.id);
      db.addCoins(message.author.id, message.guild.id, amount);
      const now = db.getUser(message.author.id, message.guild.id);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('💸 Retrait effectué !')
        .addFields(
          { name: '💰 Retiré',      value: `**${fmt(amount)} ${coin}**`,   inline: true },
          { name: '🏦 Banque',      value: `**${fmt(now.bank)} ${coin}**`, inline: true },
          { name: '👛 Portefeuille',value: `**${fmt(now.balance)} ${coin}**`, inline: true },
        )
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  GAINS QUOTIDIENS
  // ════════════════════════════════════════════
  {
    name: 'daily',
    aliases: ['journalier', 'claim', 'reward', 'jdaily', 'dl'],
    description: 'Réclamer la récompense quotidienne',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const guildId = message.guild.id;
      const userId  = message.author.id;
      const cfg  = db.getConfig(guildId);
      const coin = cfg.currency_emoji || '€';
      const now  = Math.floor(Date.now() / 1000);
      const u    = db.getUser(userId, guildId);
      const lastDaily = u.last_daily || 0;
      if (now - lastDaily < 86400) {
        const left = cooldownLeft(lastDaily, 86400);
        return message.reply(`⏳ Prochaine récompense dans **${left}**.`);
      }
      const streak = (now - lastDaily < 172800) ? (u.streak || 0) + 1 : 1;
      const base   = cfg.daily_amount || 300;
      let amount   = base + Math.min(streak * 25, 750);
      // Bonus paliers
      let bonus = 0;
      if (streak === 7)   bonus = 200;
      if (streak === 14)  bonus = 400;
      if (streak === 30)  bonus = 1000;
      if (streak === 100) bonus = 5000;
      amount += bonus;
      db.addCoins(userId, guildId, amount);
      db.db.prepare('UPDATE users SET last_daily=?, streak=? WHERE user_id=? AND guild_id=?').run(now, streak, userId, guildId);
      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🎁 Récompense quotidienne')
        .addFields(
          { name: '💰 Gagné',  value: `**+${fmt(amount)} ${coin}**`, inline: true },
          { name: '🔥 Série',  value: `**${streak}** jour${streak > 1 ? 's' : ''}`, inline: true },
          { name: '👛 Solde',  value: `**${fmt(db.getUser(userId, guildId).balance)} ${coin}**`, inline: true },
        );
      if (bonus > 0) embed.setDescription(`🎉 **Bonus de palier ×${streak} jour${streak > 1 ? 's' : ''} : +${fmt(bonus)} ${coin}**`);
      message.channel.send({ embeds: [embed] });
    }
  },

  {
    name: 'work',
    aliases: ['travailler', 'bosser', 'boulot', 'job', 'taf'],
    description: 'Travailler pour gagner des euros (cooldown 1h)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const cd  = cooldownLeft(u.last_work, 3600);
      if (cd) return message.reply(`⏳ Prochain travail dans **${cd}**.`);
      const jobs = [
        ['développeur senior',   '💻', 250, 600],
        ['chirurgien',           '🏥', 300, 700],
        ['pilote de ligne',      '✈️',  280, 650],
        ['trader en bourse',     '📈', 200, 800],
        ['chef étoilé',          '👨‍🍳', 200, 500],
        ['streamer',             '🎮', 150, 450],
        ['architecte',           '🏗️',  220, 550],
        ['avocat',               '⚖️',  260, 620],
        ['ingénieur spatial',    '🚀', 300, 750],
        ['data scientist',       '🔬', 230, 580],
        ['YouTubeur',            '📹', 100, 600],
        ['mécanicien F1',        '🏎️',  240, 560],
        ['pompier',              '🔥', 180, 420],
        ['astronaute',           '🛸', 350, 800],
        ['médecin urgentiste',   '🩺', 280, 640],
        ['producteur musical',   '🎵', 160, 500],
        ['journaliste',          '📰', 150, 380],
        ['graphiste 3D',         '🎨', 170, 430],
        ['professeur',           '📚', 140, 360],
        ['influenceur',          '📱', 100, 700],
      ];
      const [job, emoji, min, max] = jobs[Math.floor(Math.random() * jobs.length)];
      let earned = Math.floor(Math.random() * (max - min)) + min;
      // Bonus streak travail
      const workStreak = u.work_streak || 0;
      const newWorkStreak = (now - (u.last_work || 0) < 86400 * 2) ? workStreak + 1 : 1;
      if (newWorkStreak >= 3) earned = Math.floor(earned * 1.20); // +20% après 3 jours consécutifs
      db.addCoins(message.author.id, message.guild.id, earned);
      try {
        db.db.prepare('UPDATE users SET last_work=?, work_streak=? WHERE user_id=? AND guild_id=?').run(now, newWorkStreak, message.author.id, message.guild.id);
      } catch {
        db.db.prepare('UPDATE users SET last_work=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      }
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`${emoji} Travail — ${job}`)
        .setDescription(`Vous avez travaillé comme **${job}** et gagné **+${fmt(earned)} ${coin}** !${newWorkStreak >= 3 ? `\n🔥 Bonus assiduité +20% !` : ''}`)
        .setFooter({ text: `Prochain travail dans 1h` })
      ]});
    }
  },

  {
    name: 'crime',
    aliases: ['delit', 'criminel', 'vol', 'arnaque'],
    description: 'Commettre un crime risqué (cooldown 6h)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const cd  = cooldownLeft(u.last_crime, 21600);
      if (cd) return message.reply(`⏳ Prochain crime dans **${cd}**.`);
      const crimes = [
        { name: 'pickpocket dans le métro',  emoji: '🚇', min: 100,  max: 400,  risk: 0.30 },
        { name: 'vol de portefeuille',        emoji: '👜', min: 150,  max: 500,  risk: 0.35 },
        { name: 'arnaque en ligne',           emoji: '💻', min: 300,  max: 900,  risk: 0.35 },
        { name: 'braquage d\'un magasin',     emoji: '🏪', min: 500,  max: 1500, risk: 0.45 },
        { name: 'hack de serveur bancaire',   emoji: '🔐', min: 800,  max: 2500, risk: 0.50 },
        { name: 'trafic de marchandises',     emoji: '📦', min: 600,  max: 2000, risk: 0.45 },
        { name: 'vol de voiture de luxe',     emoji: '🚗', min: 700,  max: 2200, risk: 0.50 },
        { name: 'braquage de bijouterie',     emoji: '💎', min: 1000, max: 3000, risk: 0.55 },
        { name: 'contrebande internationale',emoji: '🛳️',  min: 1200, max: 4000, risk: 0.55 },
        { name: 'braquage de casino',         emoji: '🎰', min: 2000, max: 6000, risk: 0.60 },
      ];
      const c = crimes[Math.floor(Math.random() * crimes.length)];
      db.db.prepare('UPDATE users SET last_crime=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      if (Math.random() < c.risk) {
        const fine = Math.floor(Math.random() * 1000) + 300;
        db.removeCoins(message.author.id, message.guild.id, fine);
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle(`🚔 Arrêté ! — ${c.emoji} ${c.name}`)
          .setDescription(`Vous avez été arrêté ! Amende de **${fmt(fine)} ${coin}** !\n\nSolde restant : **${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`)
          .setFooter({ text: 'Prochain crime dans 6h' })
        ]});
      }
      const earned = Math.floor(Math.random() * (c.max - c.min)) + c.min;
      db.addCoins(message.author.id, message.guild.id, earned);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${c.emoji} Crime réussi !`)
        .setDescription(`Vous avez **${c.name}** et empoché **+${fmt(earned)} ${coin}** !`)
        .addFields({ name: '👛 Solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
        .setFooter({ text: 'Prochain crime dans 6h' })
      ]});
    }
  },

  {
    name: 'rob',
    aliases: ['voler', 'steal', 'cambrioler', 'piquer'],
    description: 'Voler un membre (cooldown 12h)',
    usage: '@membre',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const target = message.mentions.members.first();
      if (!target || target.id === message.author.id || target.user.bot) return message.reply('❌ Mentionnez un autre membre valide.');
      const robber = db.getUser(message.author.id, message.guild.id);
      const victim = db.getUser(target.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const cd  = cooldownLeft(robber.last_rob, 43200);
      if (cd) return message.reply(`⏳ Prochain vol dans **${cd}**.`);
      if ((victim.balance || 0) < 100) return message.reply(`❌ **${target.user.username}** n'a pas assez d'argent (min 100 ${coin}).`);
      if ((victim.bm_protected_until || 0) > now) return message.reply(`🛡️ **${target.user.username}** est protégé par un bouclier !`);
      const hasKit = (robber.bm_steal_kit || 0) > 0;
      const successRate = hasKit ? 0.65 : 0.40;
      if (hasKit) {
        try { db.db.prepare('UPDATE users SET bm_steal_kit = bm_steal_kit - 1 WHERE user_id=? AND guild_id=?').run(message.author.id, message.guild.id); } catch {}
      }
      db.db.prepare('UPDATE users SET last_rob=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      if (Math.random() < successRate) {
        const pct    = 0.10 + Math.random() * 0.25;
        const stolen = Math.min(Math.floor(victim.balance * pct), victim.balance);
        db.addCoins(message.author.id, message.guild.id, stolen);
        db.removeCoins(target.id, message.guild.id, stolen);
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('🥷 Vol réussi !')
          .setDescription(`Tu as volé **${fmt(stolen)} ${coin}** à **${target.user.username}** !`)
          .addFields(
            { name: '💰 Volé',   value: `**+${fmt(stolen)} ${coin}**`,                    inline: true },
            { name: '📊 %',      value: `**${Math.round(pct*100)}%** du portefeuille`,    inline: true },
            ...(hasKit ? [{ name: '🔓 Kit', value: 'Bonus appliqué', inline: true }] : []),
          )
          .setFooter({ text: 'Prochain vol dans 12h' })
        ]});
      } else {
        const fine = Math.min(Math.floor((robber.balance||0) * 0.25), robber.balance || 0);
        db.removeCoins(message.author.id, message.guild.id, fine);
        db.addCoins(target.id, message.guild.id, Math.floor(fine * 0.5));
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor('#E74C3C')
          .setTitle('🚔 Pris en flagrant délit !')
          .setDescription(`**${target.user.username}** t'a vu ! Tu paies une amende.`)
          .addFields(
            { name: '💸 Amende', value: `**-${fmt(fine)} ${coin}**`, inline: true },
            { name: '💰 Victime', value: `a récupéré **+${fmt(Math.floor(fine*0.5))} ${coin}**`, inline: true },
          )
          .setFooter({ text: 'Prochain vol dans 12h' })
        ]});
      }
    }
  },

  {
    name: 'pay',
    aliases: ['donner', 'transfer', 'give', 'envoyer', 'send'],
    description: 'Donner des euros à quelqu\'un',
    usage: '@membre [montant]',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first();
      if (!target || target.bot || target.id === message.author.id) return message.reply('❌ Mentionnez un autre membre valide.');
      const amount = parseInt(args[1]);
      if (!amount || amount <= 0) return message.reply('❌ Montant invalide. Usage : `&pay @membre 500`');
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u    = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < amount) return message.reply(`❌ Solde insuffisant. Vous avez **${fmt(u.balance)} ${coin}**.`);
      // Frais 2% max 100€
      const fee = Math.min(Math.floor(amount * 0.02), 100);
      db.removeCoins(message.author.id, message.guild.id, amount + fee);
      db.addCoins(target.id, message.guild.id, amount);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('💸 Transfert effectué !')
        .addFields(
          { name: '💰 Envoyé',    value: `**${fmt(amount)} ${coin}**`, inline: true },
          { name: '📊 Frais',     value: `**${fmt(fee)} ${coin}**`,    inline: true },
          { name: '🎯 Destinataire', value: `<@${target.id}>`,         inline: true },
        )
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  CLASSEMENT
  // ════════════════════════════════════════════
  {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'classement', 'richesse', 'richlist', 'top10', 'rl'],
    description: 'Classement économique du serveur',
    category: 'Économie',
    cooldown: 10,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const top  = db.db.prepare('SELECT user_id, balance+COALESCE(bank,0) as total FROM users WHERE guild_id=? ORDER BY total DESC LIMIT 10').all(message.guild.id);
      const medals = ['🥇','🥈','🥉'];
      const desc = (await Promise.all(top.map(async (u, i) => {
        const medal = medals[i] || `**${i+1}.**`;
        return `${medal} <@${u.user_id}> — **${fmt(u.total)} ${coin}**`;
      }))).join('\n');
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#F1C40F')
        .setTitle('💰 Top Richesse du Serveur')
        .setDescription(desc || 'Aucune donnée.')
        .setFooter({ text: 'Portefeuille + Banque combinés' })
        .setTimestamp()
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  CASINO
  // ════════════════════════════════════════════
  {
    name: 'slots',
    aliases: ['machine', 'casino', 'jackpot', 'slot', 's!'],
    description: 'Machine à sous',
    usage: '[mise]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet  = parseInt(args[0]) || 100;
      if (bet < 10) return message.reply('❌ Mise minimum **10 €**.');
      if (bet > 10000) return message.reply('❌ Mise maximum **10 000 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply(`❌ Solde insuffisant (**${fmt(u.balance)} ${coin}** disponibles).`);
      const reels = spinSlots();
      const mult  = slotsMultiplier(reels);
      const gain  = mult > 0 ? Math.floor(bet * mult) - bet : -bet;
      if (gain > 0) db.addCoins(message.author.id, message.guild.id, gain);
      else db.removeCoins(message.author.id, message.guild.id, bet);
      const title = mult >= 15 ? '💎 MEGA JACKPOT !!' : mult >= 8 ? '🎰 SUPER JACKPOT !' : mult >= 5 ? '⭐ JACKPOT !' : mult >= 3 ? '🎉 TRIPLE !' : mult > 0 ? '✅ Petite victoire !' : '❌ Perdu';
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(gain > 0 ? '#2ECC71' : '#E74C3C')
        .setTitle(title)
        .setDescription(`[ ${reels.join(' | ')} ]\n${gain > 0 ? `**+${fmt(gain)} ${coin}** 🎉` : `**${fmt(bet)} ${coin}** perdus`}`)
        .addFields({ name: '✖️ Multiplicateur', value: `×${mult || 0}`, inline: true }, { name: '👛 Solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
      ]});
    }
  },

  {
    name: 'flip',
    aliases: ['coinflip', 'pile', 'face', 'cf', 'pf'],
    description: 'Pile ou Face',
    usage: '[pile/face] [mise]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const choice = args[0]?.toLowerCase();
      const bet    = parseInt(args[1]);
      if (!['pile', 'face', 'heads', 'tails', 'p', 'f'].includes(choice)) return message.reply('❌ Choisissez `pile` ou `face`. Ex: `&flip pile 200`');
      if (!bet || bet < 10) return message.reply('❌ Mise minimum **10 €**.');
      if (bet > 50000) return message.reply('❌ Mise maximum **50 000 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply('❌ Solde insuffisant.');
      const result = Math.random() < 0.5 ? 'pile' : 'face';
      const norm   = ['pile', 'heads', 'p'].includes(choice) ? 'pile' : 'face';
      const win    = result === norm;
      if (win) db.addCoins(message.author.id, message.guild.id, bet);
      else     db.removeCoins(message.author.id, message.guild.id, bet);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(win ? '#2ECC71' : '#E74C3C')
        .setTitle(`${win ? '✅ Gagné !' : '❌ Perdu !'} — ${result === 'pile' ? '🪙 Pile' : '🖼️ Face'}`)
        .setDescription(`${win ? `**+${fmt(bet)} ${coin}** !` : `-${fmt(bet)} ${coin}`}`)
        .addFields({ name: '👛 Nouveau solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
      ]});
    }
  },

  {
    // DEPRECATED : remplacé par commands_prefix/games/des_prefix.js (version premium),
    name: 'dice_old',
    aliases: [],
    description: '[OBSOLÈTE] Ancien lancer de dés (remplacé par &des)',
    usage: '[mise] [faces]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet   = parseInt(args[0]);
      const faces = Math.min(parseInt(args[1]) || 6, 100);
      if (!bet || bet < 5) return message.reply('❌ Mise minimum **5 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply('❌ Solde insuffisant.');
      const myRoll  = Math.floor(Math.random() * faces) + 1;
      const botRoll = Math.floor(Math.random() * faces) + 1;
      const win = myRoll > botRoll;
      const tie = myRoll === botRoll;
      if (!tie) {
        if (win) db.addCoins(message.author.id, message.guild.id, bet);
        else     db.removeCoins(message.author.id, message.guild.id, bet);
      }
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(win ? '#2ECC71' : tie ? '#F39C12' : '#E74C3C')
        .setTitle(`🎲 Dés (1-${faces})`)
        .addFields(
          { name: '🎲 Vous',  value: `**${myRoll}**`,  inline: true },
          { name: '🤖 Bot',   value: `**${botRoll}**`, inline: true },
          { name: '💰 Résultat', value: tie ? '🤝 Égalité !' : win ? `**+${fmt(bet)} ${coin}**` : `-${fmt(bet)} ${coin}`, inline: true }
        )
      ]});
    }
  },

  {
    // DEPRECATED : remplacé par commands_prefix/games/blackjack_prefix.js (version premium avec état persisté),
    name: 'blackjack_old',
    aliases: [],
    description: '[OBSOLÈTE] Ancien blackjack (remplacé par &blackjack / &bj)',
    usage: '[mise]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const { EmbedBuilder: EMB, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const bet  = parseInt(args[0]) || 100;
      if (bet < 10) return message.reply('❌ Mise minimum **10 €**.');
      if (bet > 50000) return message.reply('❌ Mise maximum **50 000 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply(`❌ Solde insuffisant (**${fmt(u.balance)} ${coin}** disponibles).`);
      db.removeCoins(message.author.id, message.guild.id, bet);
      const deck = buildDeck();
      const player = [deck.pop(), deck.pop()];
      const dealer = [deck.pop(), deck.pop()];
      const ps = handScore(player);

      // Blackjack naturel
      if (ps === 21 && player.length === 2) {
        const payout = Math.floor(bet * 2.5);
        db.addCoins(message.author.id, message.guild.id, payout);
        return message.channel.send({ embeds: [new EMB()
          .setColor('#F1C40F')
          .setTitle('🃏 BLACKJACK ! Victoire naturelle !')
          .setDescription(`**Vous :** ${player.map(cardStr).join(' ')} = **21**\n**Croupier :** ${dealer.map(cardStr).join(' ')} = **${handScore(dealer)}**`)
          .addFields({ name: '💰 Gain', value: `**+${fmt(payout - bet)} ${coin}**  (×2.5)`, inline: true })
          .setFooter({ text: 'Excellent ! Blackjack naturel !' })
        ]});
      }

      // Créer les boutons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('bj_hit')
          .setLabel('🎴 Tirer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('bj_stand')
          .setLabel('🛑 Rester')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('bj_double')
          .setLabel('✖️ Doubler')
          .setStyle(ButtonStyle.Danger)
      );

      // État du jeu
      const gameState = {
        playerHand: [...player],
        dealerHand: [...dealer],
        deck: deck,
        gameOver: false,
        doubleBet: false,
        playerStand: false
      };

      const createEmbed = (title, status) => {
        const playerVal = handScore(gameState.playerHand);
        const dealerVal = handScore(gameState.dealerHand);
        return new EMB()
          .setColor('#FFD700')
          .setTitle(title)
          .addFields(
            { name: '🎰 Main du Croupier', value: `${gameState.gameOver || gameState.playerStand ? gameState.dealerHand.map(cardStr).join(' ') : gameState.dealerHand[0] ? `${cardStr(gameState.dealerHand[0])} 🂠` : 'Vide'}\n**Valeur :** ${gameState.gameOver || gameState.playerStand ? dealerVal : '?'}`, inline: false },
            { name: '🎯 Votre Main', value: `${gameState.playerHand.map(cardStr).join(' ')}\n**Valeur :** ${playerVal}`, inline: false },
            { name: '📊 Statut', value: status, inline: false }
          )
          .setFooter({ text: 'À votre tour !' });
      };

      let msg = await message.channel.send({ embeds: [createEmbed('♠♥ Blackjack ♦♣', 'À votre tour !')], components: [buttons] });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        filter: i => i.user.id === message.author.id
      });

      collector.on('collect', async (i) => {
        if (gameState.gameOver) {
          await i.reply({ content: '❌ Le jeu est déjà terminé !', ephemeral: true });
          return;
        }

        if (i.customId === 'bj_hit') {
          gameState.playerHand.push(gameState.deck.pop());
          const playerVal = handScore(gameState.playerHand);

          if (playerVal > 21) {
            gameState.gameOver = true;
            await i.update({ embeds: [createEmbed('♠♥ Blackjack ♦♣', `💥 BUST ! Vous avez dépassé 21. Vous perdez **${bet}** ${coin}.`)], components: [] });
            collector.stop();
          } else {
            await i.update({ embeds: [createEmbed('♠♥ Blackjack ♦♣', 'À votre tour !')] });
          }
        } else if (i.customId === 'bj_stand') {
          gameState.playerStand = true;

          // Tour du croupier
          while (handScore(gameState.dealerHand) < 17) {
            gameState.dealerHand.push(gameState.deck.pop());
          }

          gameState.gameOver = true;
          const playerVal = handScore(gameState.playerHand);
          const dealerVal = handScore(gameState.dealerHand);
          let resultMsg = '';
          let gained = 0;

          if (dealerVal > 21) {
            gained = bet * 2;
            db.addCoins(message.author.id, message.guild.id, gained);
            resultMsg = `🎉 Le croupier a bust ! Vous gagnez **+${gained}** ${coin} !`;
          } else if (playerVal > dealerVal) {
            gained = bet * 2;
            db.addCoins(message.author.id, message.guild.id, gained);
            resultMsg = `🎉 Vous gagnez ! +**${gained}** ${coin} !`;
          } else if (dealerVal > playerVal) {
            resultMsg = `💥 Le croupier gagne. Vous perdez **${bet}** ${coin}.`;
          } else {
            db.addCoins(message.author.id, message.guild.id, bet);
            resultMsg = `🤝 Égalité ! Votre mise est restituée.`;
          }

          await i.update({ embeds: [createEmbed('♠♥ Blackjack ♦♣', resultMsg)], components: [] });
          collector.stop();
        } else if (i.customId === 'bj_double') {
          const updated = db.getUser(message.author.id, message.guild.id);
          if ((updated.balance || 0) < bet) {
            await i.reply({ content: '❌ Vous n\'avez pas assez d`euros pour doubler !', ephemeral: true });
            return;
          }

          gameState.doubleBet = true;
          db.removeCoins(message.author.id, message.guild.id, bet);
          gameState.playerHand.push(gameState.deck.pop());
          const playerVal = handScore(gameState.playerHand);

          if (playerVal > 21) {
            gameState.gameOver = true;
            await i.update({ embeds: [createEmbed('♠♥ Blackjack ♦♣', `💥 BUST au doublement ! Vous perdez **${bet * 2}** ${coin}.`)], components: [] });
            collector.stop();
            return;
          }

          gameState.playerStand = true;
          while (handScore(gameState.dealerHand) < 17) {
            gameState.dealerHand.push(gameState.deck.pop());
          }

          gameState.gameOver = true;
          const playerValFinal = handScore(gameState.playerHand);
          const dealerVal = handScore(gameState.dealerHand);
          let resultMsg = '';
          let gained = 0;
          const totalBet = bet * 2;

          if (dealerVal > 21) {
            gained = totalBet * 2;
            db.addCoins(message.author.id, message.guild.id, gained);
            resultMsg = `🎉 Le croupier a bust ! Doublement gagnant ! +**${gained}** ${coin} !`;
          } else if (playerValFinal > dealerVal) {
            gained = totalBet * 2;
            db.addCoins(message.author.id, message.guild.id, gained);
            resultMsg = `🎉 Doublement gagnant ! +**${gained}** ${coin} !`;
          } else if (dealerVal > playerValFinal) {
            resultMsg = `💥 Le croupier gagne. Vous perdez **${totalBet}** ${coin}.`;
          } else {
            db.addCoins(message.author.id, message.guild.id, totalBet);
            resultMsg = `🤝 Égalité ! Votre mise est restituée.`;
          }

          await i.update({ embeds: [createEmbed('♠♥ Blackjack ♦♣', resultMsg)], components: [] });
          collector.stop();
        }
      });

      collector.on('end', (collected, reason) => {
        if (reason === 'time') {
          msg.edit({ components: [] }).catch(() => {});
        }
      });
    }
  },

  {
    name: 'gamble',
    aliases: ['pari', 'bet', 'mise', 'wager'],
    description: 'Miser une somme avec 45% de chance de doubler',
    usage: '[montant|all]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u = db.getUser(message.author.id, message.guild.id);
      let bet;
      if (!args[0] || args[0] === 'all') bet = u.balance;
      else bet = parseInt(args[0]);
      if (!bet || bet < 1) return message.reply('❌ Montant invalide.');
      if (bet > (u.balance || 0)) return message.reply(`❌ Pas assez — vous avez **${fmt(u.balance)} ${coin}**.`);
      const win = Math.random() < 0.48; // 48% légèrement favorable
      if (win) db.addCoins(message.author.id, message.guild.id, bet);
      else     db.removeCoins(message.author.id, message.guild.id, bet);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(win ? '#2ECC71' : '#E74C3C')
        .setTitle(win ? '🎰 Gagné !' : '🎰 Perdu !')
        .setDescription(`Vous avez ${win ? `gagné` : 'perdu'} **${fmt(bet)} ${coin}** !`)
        .addFields({ name: '👛 Nouveau solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
      ]});
    }
  },

  {
    name: 'highlow',
    aliases: ['hl', 'hautbas', 'plusmoins'],
    description: 'La prochaine carte sera plus haute ou plus basse ?',
    usage: '[haute/basse] [mise]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const choice = args[0]?.toLowerCase();
      const bet    = parseInt(args[1]);
      if (!['haute', 'basse', 'h', 'b'].includes(choice)) return message.reply('❌ Choisissez `haute` ou `basse`. Ex: `&highlow haute 300`');
      if (!bet || bet < 10) return message.reply('❌ Mise minimum **10 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply('❌ Solde insuffisant.');
      const deck = buildDeck();
      const card1 = deck.pop();
      const card2 = deck.pop();
      const v1 = cardVal(card1), v2 = cardVal(card2);
      const isHigh = ['haute','h'].includes(choice);
      const win = isHigh ? v2 > v1 : v2 < v1;
      const tie = v1 === v2;
      if (tie) {
        return message.reply(`🤝 Égalité ! **${cardStr(card1)}** et **${cardStr(card2)}** — mise remboursée.`);
      }
      if (win) db.addCoins(message.author.id, message.guild.id, bet);
      else     db.removeCoins(message.author.id, message.guild.id, bet);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(win ? '#2ECC71' : '#E74C3C')
        .setTitle(`🃏 Haute ou Basse — ${win ? 'Gagné !' : 'Perdu !'}`)
        .addFields(
          { name: '🃏 Première carte', value: `${cardStr(card1)} (${v1})`,  inline: true },
          { name: '🃏 Deuxième carte', value: `${cardStr(card2)} (${v2})`,  inline: true },
          { name: '💰 Résultat', value: win ? `**+${fmt(bet)} ${coin}**` : `-${fmt(bet)} ${coin}`, inline: true },
        )
      ]});
    }
  },

  {
    // DEPRECATED : l'ancienne roulette simpliste de eco.js a été remplacée par
    // la version premium dans commands_prefix/games/roulette_prefix.js.
    // Elle est renommée 'roulette_old' et sans alias pour ne pas entrer en
    // conflit avec la nouvelle (&roulette / &roue gèrent leurs propres jeux).
    name: 'roulette_old',
    aliases: [],
    description: '[OBSOLÈTE] Ancienne roulette (remplacée par /roulette et /roue)',
    usage: '[rouge/noir/pair/impair/0-36] [mise]',
    category: 'Casino',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const choice = args[0]?.toLowerCase();
      const bet    = parseInt(args[1]);
      if (!choice || !bet || bet < 10) return message.reply('❌ Usage : `&roulette rouge 200` ou `&roulette 17 1000`');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < bet) return message.reply('❌ Solde insuffisant.');
      const num    = Math.floor(Math.random() * 37); // 0-36
      const rouge  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
      const isRouge = rouge.includes(num);
      const isPair  = num !== 0 && num % 2 === 0;
      let win = false, mult = 1;
      if (['rouge','red','r'].includes(choice)) { win = isRouge; mult = 2; }
      else if (['noir','n'].includes(choice)) { win = !isRouge && num !== 0; mult = 2; }
      else if (['pair','p'].includes(choice)) { win = isPair; mult = 2; }
      else if (['impair','i'].includes(choice)) { win = !isPair && num !== 0; mult = 2; }
      else if (['1-12','premiere'].includes(choice)) { win = num >= 1 && num <= 12; mult = 3; }
      else if (['13-24','deuxieme'].includes(choice)) { win = num >= 13 && num <= 24; mult = 3; }
      else if (['25-36','troisieme'].includes(choice)) { win = num >= 25 && num <= 36; mult = 3; }
      else {
        const choiceNum = parseInt(choice);
        if (!isNaN(choiceNum) && choiceNum >= 0 && choiceNum <= 36) { win = num === choiceNum; mult = 36; }
        else return message.reply('❌ Choix invalide. Utilisez : `rouge`, `noir`, `pair`, `impair`, `0-36`');
      }
      const gain = win ? bet * (mult - 1) : -bet;
      if (win) db.addCoins(message.author.id, message.guild.id, gain);
      else     db.removeCoins(message.author.id, message.guild.id, bet);
      const numStr = `**${num}** ${num === 0 ? '🟩' : rouge.includes(num) ? '🔴' : '⚫'}`;
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(win ? '#2ECC71' : '#E74C3C')
        .setTitle(`🎡 Roulette — ${win ? 'Gagné !' : 'Perdu !'}`)
        .setDescription(`La bille s'arrête sur ${numStr}`)
        .addFields(
          { name: '🎯 Votre choix', value: `**${choice}** (×${mult})`, inline: true },
          { name: '💰 Résultat', value: win ? `**+${fmt(gain)} ${coin}**` : `-${fmt(bet)} ${coin}`, inline: true },
          { name: '👛 Solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true },
        )
      ]});
    }
  },

  {
    name: 'scratch',
    aliases: ['gratter', 'ticket', 'lotterie'],
    description: 'Acheter un ticket à gratter (100€)',
    category: 'Casino',
    cooldown: 10,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const cost = 100;
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < cost) return message.reply(`❌ Il vous faut **${cost} ${coin}** pour un ticket.`);
      db.removeCoins(message.author.id, message.guild.id, cost);
      const prizes = [0,0,0,0,0,50,100,100,200,300,500,1000,2000,5000,10000];
      const prize = prizes[Math.floor(Math.random() * prizes.length)];
      if (prize > 0) db.addCoins(message.author.id, message.guild.id, prize);
      const symbols = prize === 0
        ? ['❌','❌','❌'] : prize >= 5000
        ? ['💎','💎','💎'] : prize >= 1000
        ? ['⭐','⭐','⭐'] : prize >= 500
        ? ['🎰','🎰','🎰'] : prize >= 100
        ? ['🍀','🍀','🍀'] : ['🍒','🍒','💫'];
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(prize > cost ? '#2ECC71' : prize > 0 ? '#F1C40F' : '#E74C3C')
        .setTitle(`🎟️ Ticket à Gratter${prize >= 5000 ? ' — JACKPOT !!!' : prize > 0 ? ' — Gagné !' : ' — Perdu'}`)
        .setDescription(`[ ${symbols.join(' | ')} ]\n${prize > 0 ? `🎉 Vous gagnez **${fmt(prize)} ${coin}** !` : `Pas de chance cette fois... Coût : **-${cost} ${coin}**`}`)
        .addFields({ name: '👛 Solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  ACTIVITÉS
  // ════════════════════════════════════════════
  {
    name: 'fish',
    aliases: ['peche', 'pêche', 'pecher', 'pêcher', 'fishing'],
    description: 'Aller pêcher (cooldown 30min)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u   = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const lastFish = u.last_fish || 0;
      const cd = cooldownLeft(lastFish, 1800);
      if (cd) return message.reply(`⏳ Prochain retour à la pêche dans **${cd}**.`);
      try { db.db.prepare('ALTER TABLE users ADD COLUMN last_fish INTEGER DEFAULT 0').run(); } catch {}
      const hasBait = (u.bm_fishing_bait || 0) > 0;
      const catches = [
        { name: 'vieille botte',     emoji: '👢', value: 0,    chance: 0.15 },
        { name: 'petit poisson',     emoji: '🐟', value: 50,   chance: 0.35 },
        { name: 'saumon',            emoji: '🐠', value: 120,  chance: 0.25 },
        { name: 'thon',              emoji: '🐡', value: 250,  chance: 0.12 },
        { name: 'homard',            emoji: '🦞', value: 400,  chance: 0.07 },
        { name: 'requin',            emoji: '🦈', value: 800,  chance: 0.04 },
        { name: 'poisson légendaire',emoji: '✨', value: 2000,  chance: 0.02 },
      ];
      const effectiveCatches = hasBait
        ? catches.map(c => ({ ...c, chance: c.chance * (c.value >= 400 ? 3 : 1.5) }))
        : catches;
      let r = Math.random();
      let chosen = catches[1];
      for (const c of effectiveCatches) {
        if (r < c.chance) { chosen = c; break; }
        r -= c.chance;
      }
      if (hasBait) {
        try { db.db.prepare('UPDATE users SET bm_fishing_bait = bm_fishing_bait - 1 WHERE user_id=? AND guild_id=?').run(message.author.id, message.guild.id); } catch {}
      }
      db.db.prepare('UPDATE users SET last_fish=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      if (chosen.value > 0) db.addCoins(message.author.id, message.guild.id, chosen.value);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(chosen.value >= 800 ? '#F1C40F' : chosen.value > 0 ? '#2ECC71' : '#95A5A6')
        .setTitle(`🎣 Pêche${hasBait ? ' (Appât Légendaire ✨)' : ''}`)
        .setDescription(`Vous avez pêché : ${chosen.emoji} **${chosen.name}**${chosen.value > 0 ? ` → **+${fmt(chosen.value)} ${coin}**` : ' → Rien !'}`)
        .setFooter({ text: 'Prochain retour dans 30min' })
      ]});
    }
  },

  {
    name: 'hunt',
    aliases: ['chasse', 'hunting', 'chasser'],
    description: 'Partir à la chasse (cooldown 45min)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u   = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const lastHunt = u.last_hunt || 0;
      const cd = cooldownLeft(lastHunt, 2700);
      if (cd) return message.reply(`⏳ Prochaine chasse dans **${cd}**.`);
      try { db.db.prepare('ALTER TABLE users ADD COLUMN last_hunt INTEGER DEFAULT 0').run(); } catch {}
      const animals = [
        { name: 'rien trouvé',    emoji: '🌿', value: 0,    chance: 0.12 },
        { name: 'lapin',          emoji: '🐇', value: 80,   chance: 0.30 },
        { name: 'sanglier',       emoji: '🐗', value: 200,  chance: 0.25 },
        { name: 'cerf',           emoji: '🦌', value: 350,  chance: 0.18 },
        { name: 'ours',           emoji: '🐻', value: 600,  chance: 0.09 },
        { name: 'loup rare',      emoji: '🐺', value: 1000, chance: 0.04 },
        { name: 'dragon légendaire', emoji: '🐲', value: 3000, chance: 0.02 },
      ];
      let r = Math.random();
      let chosen = animals[1];
      for (const a of animals) {
        if (r < a.chance) { chosen = a; break; }
        r -= a.chance;
      }
      db.db.prepare('UPDATE users SET last_hunt=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      if (chosen.value > 0) db.addCoins(message.author.id, message.guild.id, chosen.value);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(chosen.value >= 600 ? '#F1C40F' : chosen.value > 0 ? '#2ECC71' : '#95A5A6')
        .setTitle('🏹 Chasse')
        .setDescription(`Vous avez chassé : ${chosen.emoji} **${chosen.name}**${chosen.value > 0 ? ` → **+${fmt(chosen.value)} ${coin}**` : ' → Rentrez bredouille !'}`)
        .setFooter({ text: 'Prochaine chasse dans 45min' })
      ]});
    }
  },

  {
    name: 'mine',
    aliases: ['miner', 'mining', 'creuser', 'dig'],
    description: 'Miner des ressources (cooldown 1h)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u   = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const lastMine = u.last_mine || 0;
      const cd = cooldownLeft(lastMine, 3600);
      if (cd) return message.reply(`⏳ Prochaine mine dans **${cd}**.`);
      try { db.db.prepare('ALTER TABLE users ADD COLUMN last_mine INTEGER DEFAULT 0').run(); } catch {}
      const hasTNT = (u.bm_mine_tnt || 0) > 0;
      const resources = [
        { name: 'pierre',     emoji: '🪨', value: 20,   chance: 0.20 },
        { name: 'charbon',    emoji: '⬛', value: 60,   chance: 0.28 },
        { name: 'fer',        emoji: '🔩', value: 120,  chance: 0.22 },
        { name: 'or',         emoji: '🟡', value: 250,  chance: 0.15 },
        { name: 'emeraude',   emoji: '💚', value: 500,  chance: 0.08 },
        { name: 'diamant',    emoji: '💎', value: 1200, chance: 0.05 },
        { name: 'cristal rare', emoji:'🔮', value: 3500, chance: 0.02 },
      ];
      let r = Math.random();
      let chosen = resources[1];
      for (const res of resources) {
        if (r < res.chance) { chosen = res; break; }
        r -= res.chance;
      }
      let earned = chosen.value;
      if (hasTNT) {
        earned = Math.floor(earned * 6);
        try { db.db.prepare('UPDATE users SET bm_mine_tnt = bm_mine_tnt - 1 WHERE user_id=? AND guild_id=?').run(message.author.id, message.guild.id); } catch {}
      }
      db.db.prepare('UPDATE users SET last_mine=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      db.addCoins(message.author.id, message.guild.id, earned);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(earned >= 1000 ? '#F1C40F' : '#7B2FBE')
        .setTitle(`⛏️ Mine${hasTNT ? ' — TNT x6 💣' : ''}`)
        .setDescription(`Vous avez trouvé : ${chosen.emoji} **${chosen.name}** → **+${fmt(earned)} ${coin}**`)
        .setFooter({ text: 'Prochaine mine dans 1h' })
      ]});
    }
  },

  {
    name: 'beg',
    aliases: ['mendier', 'quemander', 'demander'],
    description: 'Mendier des euros (cooldown 5min)',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u   = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const lastBeg = u.last_beg || 0;
      const cd = cooldownLeft(lastBeg, 300);
      if (cd) return message.reply(`⏳ Prochaine mendicité dans **${cd}**.`);
      try { db.db.prepare('ALTER TABLE users ADD COLUMN last_beg INTEGER DEFAULT 0').run(); } catch {}
      db.db.prepare('UPDATE users SET last_beg=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      if (Math.random() < 0.25) {
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor('#95A5A6')
          .setTitle('🙏 Mendié... Ignoré !')
          .setDescription('Personne ne vous a donné d\'argent cette fois.')
        ]});
      }
      const givers = ['un passant généreux','un touriste égaré','un banquier raté','votre voisin','un inconnu sympathique'];
      const giver  = givers[Math.floor(Math.random() * givers.length)];
      const amount = Math.floor(Math.random() * 60) + 10;
      db.addCoins(message.author.id, message.guild.id, amount);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('🙏 Quelqu\'un a été généreux !')
        .setDescription(`**${giver}** vous a donné **+${fmt(amount)} ${coin}** !`)
        .setFooter({ text: 'Prochain essai dans 5min' })
      ]});
    }
  },

  {
    name: 'heist',
    aliases: ['braquage', 'gang', 'attaque', 'raid'],
    description: 'Braquer une banque (solo ou groupe, cooldown 3h)',
    usage: '[solo]',
    category: 'Économie',
    cooldown: 3,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const u   = db.getUser(message.author.id, message.guild.id);
      const now = Math.floor(Date.now() / 1000);
      const lastHeist = u.last_heist || 0;
      const cd = cooldownLeft(lastHeist, 10800);
      if (cd) return message.reply(`⏳ Prochain braquage dans **${cd}**.`);
      try { db.db.prepare('ALTER TABLE users ADD COLUMN last_heist INTEGER DEFAULT 0').run(); } catch {}
      db.db.prepare('UPDATE users SET last_heist=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      const banks = ['Banque Nationale de Paris','BNP Paribas','Société Générale','Crédit Agricole','HSBC France'];
      const bank  = banks[Math.floor(Math.random() * banks.length)];
      const successRate = 0.55;
      if (Math.random() < successRate) {
        const loot = Math.floor(Math.random() * 5000) + 2000;
        db.addCoins(message.author.id, message.guild.id, loot);
        return message.channel.send({ embeds: [new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('💰 Braquage réussi !')
          .setDescription(`Votre équipe a braqué la **${bank}** et empoché **+${fmt(loot)} ${coin}** !`)
          .setFooter({ text: 'Prochain braquage dans 3h' })
        ]});
      }
      const fine = Math.min(Math.floor((u.balance || 0) * 0.30) + 500, u.balance || 0);
      db.removeCoins(message.author.id, message.guild.id, fine);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🚨 Braquage raté !')
        .setDescription(`La police a intercepté votre équipe à la **${bank}**. Amende : **-${fmt(fine)} ${coin}**`)
        .setFooter({ text: 'Prochain braquage dans 3h' })
      ]});
    }
  },

  {
    name: 'invest',
    aliases: ['investir', 'placement', 'bourse'],
    description: 'Investir des euros en bourse (résultat aléatoire -40% à +150%)',
    usage: '[montant]',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const amount = parseInt(args[0]);
      if (!amount || amount < 100) return message.reply('❌ Investissement minimum **100 €**.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < amount) return message.reply(`❌ Solde insuffisant (**${fmt(u.balance)} ${coin}**).`);
      const stocks = ['Apple 🍎','Tesla 🚗','NVIDIA 🖥️','Bitcoin ₿','Dogecoin 🐕','Meta 📘','Amazon 📦'];
      const stock  = stocks[Math.floor(Math.random() * stocks.length)];
      // Distribution biaisée légèrement positive
      const change = (Math.random() * 1.9) - 0.4; // -40% à +150%
      const profit = Math.floor(amount * change);
      if (profit < 0) {
        db.removeCoins(message.author.id, message.guild.id, Math.abs(profit));
      } else {
        db.addCoins(message.author.id, message.guild.id, profit);
      }
      const pct = (change * 100).toFixed(1);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(profit > 0 ? '#2ECC71' : '#E74C3C')
        .setTitle(`📈 Investissement — ${stock}`)
        .setDescription(`**${pct > 0 ? '+' : ''}${pct}%** — ${profit > 0 ? `Gain de **+${fmt(profit)} ${coin}**` : `Perte de **-${fmt(Math.abs(profit))} ${coin}**`}`)
        .addFields({ name: '👛 Solde', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true })
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  BOUTIQUE / INVENTAIRE
  // ════════════════════════════════════════════
  {
    name: 'shop',
    aliases: ['boutique', 'magasin', 'store', 'market', 'vitrine'],
    description: 'Voir la boutique du serveur',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const items = db.db.prepare('SELECT * FROM shop WHERE guild_id=? AND active=1 ORDER BY price ASC').all(message.guild.id);
      if (!items.length) return message.reply('❌ La boutique est vide. Un admin peut ajouter des articles avec `/shop add`.');
      const desc = items.map((item, i) => {
        const stock = item.stock === -1 ? '∞' : item.stock;
        return `**${i+1}.** ${item.emoji} **${item.name}** — **${fmt(item.price)} ${coin}** (stock: ${stock})\n> ${item.description || 'Pas de description'}`;
      }).join('\n\n');
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🛒 Boutique')
        .setDescription(desc)
        .setFooter({ text: `Achetez avec &buy [numéro]` })
      ]});
    }
  },

  {
    name: 'buy',
    aliases: ['acheter', 'achat', 'commander'],
    description: 'Acheter un article de la boutique',
    usage: '[numéro]',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg  = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const num  = parseInt(args[0]);
      if (!num) return message.reply('❌ Donnez le numéro de l\'article. Ex: `&buy 1`');
      const items = db.db.prepare('SELECT * FROM shop WHERE guild_id=? AND active=1 ORDER BY price ASC').all(message.guild.id);
      if (!items.length) return message.reply('❌ La boutique est vide.');
      const item = items[num - 1];
      if (!item) return message.reply(`❌ Numéro invalide (1-${items.length}).`);
      if (item.stock === 0) return message.reply('❌ Cet article est en rupture de stock.');
      const u = db.getUser(message.author.id, message.guild.id);
      if ((u.balance || 0) < item.price) return message.reply(`❌ Pas assez d'argent (**${fmt(item.price)} ${coin}** requis, vous avez **${fmt(u.balance)} ${coin}**).`);
      db.removeCoins(message.author.id, message.guild.id, item.price);
      if (item.stock !== -1) db.db.prepare('UPDATE shop SET stock = stock - 1 WHERE id=?').run(item.id);
      // Donner le rôle si configuré
      if (item.role_id) {
        const member = message.guild.members.cache.get(message.author.id) || await message.guild.members.fetch(message.author.id).catch(() => null);
        if (member) member.roles.add(item.role_id).catch(() => {});
      }
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`✅ Achat réussi — ${item.emoji} ${item.name}`)
        .addFields(
          { name: '💰 Prix payé', value: `**${fmt(item.price)} ${coin}**`, inline: true },
          { name: '👛 Solde restant', value: `**${fmt(db.getUser(message.author.id, message.guild.id).balance)} ${coin}**`, inline: true },
          ...(item.role_id ? [{ name: '🎭 Rôle donné', value: `<@&${item.role_id}>`, inline: true }] : []),
        )
      ]});
    }
  },

  {
    name: 'inventory',
    aliases: ['inv', 'inventaire', 'bag', 'sac', 'items'],
    description: 'Voir son inventaire',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const u   = db.getUser(target.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const fields = [];
      const now = Math.floor(Date.now() / 1000);
      if ((u.bm_boost_xp_until || 0) > now)  fields.push({ name: '⚡ Boost XP ×2', value: `Expire <t:${u.bm_boost_xp_until}:R>`, inline: true });
      if ((u.bm_protected_until || 0) > now)  fields.push({ name: '🛡️ Bouclier',    value: `Expire <t:${u.bm_protected_until}:R>`, inline: true });
      if ((u.bm_casino_bonus || 0) > 0)        fields.push({ name: '🎰 Bonus Casino', value: `**${u.bm_casino_bonus}** parties`, inline: true });
      if ((u.bm_fishing_bait || 0) > 0)        fields.push({ name: '🎣 Appâts',       value: `**${u.bm_fishing_bait}** restants`, inline: true });
      if ((u.bm_mine_tnt || 0) > 0)            fields.push({ name: '💣 TNT Mine',     value: `**${u.bm_mine_tnt}** restant(s)`, inline: true });
      if ((u.bm_steal_kit || 0) > 0)           fields.push({ name: '🔓 Kit de vol',   value: `**${u.bm_steal_kit}** restant(s)`, inline: true });
      const invItems = db.db.prepare('SELECT i.*, s.name, s.emoji, s.description FROM inventory i JOIN shop s ON i.item_id = s.id WHERE i.user_id=? AND i.guild_id=?').all(target.id, message.guild.id);
      for (const item of invItems) {
        fields.push({ name: `${item.emoji} ${item.name}`, value: `Qté: **${item.quantity}**`, inline: true });
      }
      if (!fields.length) return message.reply(`❌ **${target.username}** n'a rien dans son inventaire.`);
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle(`🎒 Inventaire de ${target.username}`)
        .addFields(...fields)
      ]});
    }
  },

  // ════════════════════════════════════════════
  //  PROFIL & STATS
  // ════════════════════════════════════════════
  {
    name: 'profile',
    aliases: ['profil', 'stats', 'stat', 'card', 'carte', 'me'],
    description: 'Voir son profil complet',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const u   = db.getUser(target.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const xpNeeded = db.getXPForLevel ? db.getXPForLevel(u.level || 1) : Math.floor(100 * Math.pow(1.35, (u.level||1) - 1));
      const total = (u.balance || 0) + (u.bank || 0);
      const rank  = db.db.prepare('SELECT COUNT(*)+1 as r FROM users WHERE guild_id=? AND balance+COALESCE(bank,0) > ?').get(message.guild.id, total)?.r || '?';
      const xpRank = db.db.prepare('SELECT COUNT(*)+1 as r FROM users WHERE guild_id=? AND xp > ?').get(message.guild.id, u.xp || 0)?.r || '?';
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor(cfg.color || '#7B2FBE')
        .setTitle(`👤 Profil de ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '👛 Portefeuille', value: `**${fmt(u.balance)} ${coin}**`, inline: true },
          { name: '🏦 Banque',       value: `**${fmt(u.bank)} ${coin}**`,    inline: true },
          { name: '💎 Fortune',      value: `**${fmt(total)} ${coin}**`,     inline: true },
          { name: '⭐ Niveau',        value: `**${u.level || 1}** (${fmt(u.xp || 0)} XP)`, inline: true },
          { name: '📊 XP Classement',value: `**#${xpRank}**`,               inline: true },
          { name: '💰 Classement',   value: `**#${rank}**`,                  inline: true },
          { name: '🔥 Streak Daily', value: `**${u.streak || 0}** jours`,   inline: true },
          { name: '💬 Messages',     value: `**${fmt(u.message_count)}**`,   inline: true },
          { name: '📈 Total gagné',  value: `**${fmt(u.total_earned)} ${coin}**`, inline: true },
        )
      ]});
    }
  },

  {
    name: 'streak',
    aliases: ['consecutive', 'serie', 'chaine'],
    description: 'Voir votre streak de connexions quotidiennes',
    category: 'Économie',
    cooldown: 5,
    async run(message, args, client, db) {
      const u   = db.getUser(message.author.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      const nextBonus = u.streak >= 100 ? 5000 : u.streak >= 30 ? 1000 : u.streak >= 14 ? 400 : u.streak >= 7 ? 200 : 0;
      const nextMilestone = u.streak < 7 ? 7 : u.streak < 14 ? 14 : u.streak < 30 ? 30 : u.streak < 100 ? 100 : null;
      message.channel.send({ embeds: [new EmbedBuilder()
        .setColor('#F39C12')
        .setTitle('🔥 Streak Quotidien')
        .addFields(
          { name: '🔥 Streak actuel', value: `**${u.streak || 0}** jours`,   inline: true },
          { name: '🎁 Bonus actuel',  value: `+${fmt(Math.min((u.streak||0)*25,750))} ${coin}/jour`, inline: true },
          ...(nextMilestone ? [{ name: '🎯 Prochain palier', value: `**${nextMilestone}** jours → Bonus **+${nextBonus} ${coin}**`, inline: true }] : []),
        )
        .setDescription('Réclamez `&daily` chaque jour pour maintenir votre streak !')
      ]});
    }
  },

];

module.exports = commands;
module.exports.__isMulti = true;
