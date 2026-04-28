const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: 'level',
    category: 'Social',
    aliases: ['lvl', 'xp', 'niveau', 'rank', 'rang'],
    description: 'Voir son niveau et XP',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const u = db.getUser(target.id, message.guild.id);
      const level = u.level || 1;
      const xp = u.xp || 0;
      const xpNeeded = level * 100 + (level * 50);
      const pct = Math.min(Math.floor((xp % xpNeeded) / xpNeeded * 100), 100);
      const bar = '█'.repeat(Math.floor(pct/10)) + '░'.repeat(10 - Math.floor(pct/10));
      const rank = db.db.prepare('SELECT COUNT(*) as c FROM users WHERE guild_id=? AND (level > ? OR (level = ? AND xp >= ?))').get(message.guild.id, level, level, xp);
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle(`⭐ Niveau de ${target.username}`).setThumbnail(target.displayAvatarURL()).addFields(
        { name: '⭐ Niveau', value: `**${level}**`, inline: true },
        { name: '✨ XP', value: `**${xp}** / ${xpNeeded}`, inline: true },
        { name: '🏆 Rang', value: `**#${(rank?.c||0)+1}**`, inline: true },
        { name: '📊 Progression', value: `\`[${bar}]\` **${pct}%**`, inline: false },
      )] });
    }
  },
  {
    name: 'leaderboard',
    category: 'Social',
    aliases: ['toplvl', 'topxp', 'classement', 'lb'],
    description: 'Classement XP',
    cooldown: 10,
    async run(message, args, client, db) {
      const top = db.db.prepare('SELECT user_id, level, xp FROM users WHERE guild_id=? ORDER BY level DESC, xp DESC LIMIT 10').all(message.guild.id);
      const desc = top.map((u, i) => `${['🥇','🥈','🥉'][i]||`**${i+1}.**`} <@${u.user_id}> — Niveau **${u.level||1}** (${u.xp||0} XP)`).join('\n');
      message.reply({ embeds: [new EmbedBuilder().setColor('#7B2FBE').setTitle('🏆 Top Niveaux').setDescription(desc||'Aucune donnée.')] });
    }
  },
  {
    name: 'rep',
    category: 'Social',
    aliases: ['reputation', '+rep', 'bigrep'],
    description: 'Donner de la réputation',
    usage: '@membre [raison]',
    cooldown: 86400,
    async run(message, args, client, db) {
      const target = message.mentions.users.first();
      if (!target || target.id === message.author.id || target.bot) return message.reply('❌ Mentionnez un autre membre valide.');
      const reason = args.slice(1).join(' ') || null;
      const now = Math.floor(Date.now() / 1000);
      const u = db.getUser(message.author.id, message.guild.id);
      if ((now - (u.last_rep||0)) < 86400) {
        const left = 86400 - (now - (u.last_rep||0));
        return message.reply(`⏳ Prochaine rep dans **${Math.floor(left/3600)}h ${Math.floor((left%3600)/60)}m**.`);
      }
      db.getUser(target.id, message.guild.id);
      db.db.prepare('UPDATE users SET reputation=COALESCE(reputation,0)+1 WHERE user_id=? AND guild_id=?').run(target.id, message.guild.id);
      db.db.prepare('UPDATE users SET last_rep=? WHERE user_id=? AND guild_id=?').run(now, message.author.id, message.guild.id);
      db.addCoins(target.id, message.guild.id, 50);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setDescription(`⭐ <@${message.author.id}> a donné +1 réputation à <@${target.id}>${reason ? ` — *${reason}*` : ''} ! (+50 ${coin})`)] });
    }
  },
  {
    name: 'afk',
    category: 'Social',
    aliases: ['away', 'absent'],
    description: 'Passer en mode AFK',
    usage: '[raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      const reason = args.join(' ') || 'AFK';
      db.setAfk(message.guild.id, message.author.id, reason);
      message.reply(`💤 Vous êtes maintenant AFK : *"${reason}"*`);
    }
  },
  {
    name: 'streak',
    category: 'Social',
    aliases: ['streaks', 'serie', 'combo'],
    description: 'Voir votre streak quotidien',
    cooldown: 3,
    async run(message, args, client, db) {
      const u = db.getUser(message.author.id, message.guild.id);
      const streak = u.streak || 0;
      const lastDaily = u.last_daily || 0;
      const now = Math.floor(Date.now() / 1000);
      const isActive = now - lastDaily < 172800;
      const fire = '🔥'.repeat(Math.min(streak, 7));
      message.reply({ embeds: [new EmbedBuilder().setColor(isActive ? '#E67E22' : '#95A5A6').setTitle('🔥 Streak Quotidien').addFields({ name: '🔥 Streak', value: `**${streak}** jours ${fire}`, inline: true }, { name: '📅 Statut', value: isActive ? '✅ Actif' : '❌ Perdu si pas réclamé', inline: true })] });
    }
  },
  {
    name: 'badges',
    category: 'Social',
    aliases: ['badge', 'trophées', 'achievements'],
    description: 'Voir ses badges',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      let badgesRows;
      try { badgesRows = db.db.prepare('SELECT * FROM user_badges WHERE guild_id=? AND user_id=?').all(message.guild.id, target.id); } catch { badgesRows = []; }
      if (!badgesRows.length) return message.reply(`❌ **${target.username}** n'a pas encore de badge.`);
      const desc = badgesRows.map(b => `${b.emoji || '🏅'} **${b.name}** — *${b.description || ''}*`).join('\n');
      message.reply({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle(`🏅 Badges de ${target.username}`).setDescription(desc)] });
    }
  },
  {
    name: 'inventory',
    category: 'Social',
    aliases: ['inv', 'inventaire', 'sac'],
    description: 'Voir son inventaire',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      let items;
      try { items = db.db.prepare('SELECT ui.quantity, si.name, si.emoji FROM user_inventory ui JOIN shop_items si ON ui.item_id=si.id WHERE ui.guild_id=? AND ui.user_id=?').all(message.guild.id, target.id); } catch { items = []; }
      if (!items.length) return message.reply(`❌ **${target.username}** n'a rien dans son inventaire.`);
      const desc = items.map(i => `${i.emoji||'📦'} **${i.name}** × ${i.quantity}`).join('\n');
      message.reply({ embeds: [new EmbedBuilder().setColor('#9B59B6').setTitle(`🎒 Inventaire de ${target.username}`).setDescription(desc)] });
    }
  },
  {
    name: 'bio',
    category: 'Social',
    aliases: ['setbio', 'aboutme'],
    description: 'Définir sa bio',
    usage: '[texte]',
    cooldown: 5,
    async run(message, args, client, db) {
      const texte = args.join(' ');
      if (!texte) return message.reply('❌ Donnez une bio.');
      if (texte.length > 200) return message.reply('❌ Max 200 caractères.');
      const now = Math.floor(Date.now() / 1000);
      try {
        db.db.prepare('INSERT INTO statuts_perso (guild_id, user_id, bio, updated_at) VALUES(?,?,?,?) ON CONFLICT(guild_id,user_id) DO UPDATE SET bio=?, updated_at=?').run(message.guild.id, message.author.id, texte, now, texte, now);
      } catch { db.db.prepare('INSERT OR REPLACE INTO statuts_perso (guild_id, user_id, bio, updated_at) VALUES(?,?,?,?)').run(message.guild.id, message.author.id, texte, now); }
      message.reply('✅ Bio mise à jour !');
    }
  },
  {
    name: 'profile',
    category: 'Social',
    aliases: ['profil', 'me', 'card', 'carte'],
    description: 'Voir son profil complet',
    usage: '[@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const u = db.getUser(target.id, message.guild.id);
      const cfg = db.getConfig(message.guild.id);
      const coin = cfg.currency_emoji || '€';
      let statut = null;
      try { statut = db.db.prepare('SELECT * FROM statuts_perso WHERE guild_id=? AND user_id=?').get(message.guild.id, target.id); } catch {}
      const prestige = u.prestige || 0;
      const prestigeEmojis = ['','🥉','🥈','🥇','💜','💎','🔴','🌟','👑'];
      const fields = [
        { name: '⭐ Niveau', value: `**${u.level||1}** (${u.xp||0} XP)`, inline: true },
        { name: '💰 Solde', value: `**${(u.balance||0).toLocaleString()} ${coin}**`, inline: true },
        { name: '💼 Banque', value: `**${(u.bank||0).toLocaleString()} ${coin}**`, inline: true },
        { name: '⭐ Réputation', value: `**${u.reputation||0}** ⭐`, inline: true },
        { name: '🔥 Streak', value: `**${u.streak||0}** jours`, inline: true },
      ];
      if (prestige > 0) fields.push({ name: '🌟 Prestige', value: `${prestigeEmojis[prestige]} Prestige **${prestige}**`, inline: true });
      if (statut?.bio) fields.push({ name: '📝 Bio', value: statut.bio, inline: false });
      const embed = new EmbedBuilder().setColor(statut?.color || '#7B2FBE').setTitle(`👤 ${target.username}`).setThumbnail(target.displayAvatarURL({ size: 256 })).addFields(...fields).setTimestamp();
      if (statut?.status_text) embed.setDescription(`*"${statut.status_text}"*`);
      message.reply({ embeds: [embed] });
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
