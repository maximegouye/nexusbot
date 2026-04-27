/**
 * Commandes de modération préfixées
 * Toutes accessibles via n!ban, !ban, n!kick, !warn, etc.
 */
const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: 'ban',
    category: 'Modération',
    aliases: ['bannir', 'expulser-def'],
    description: 'Bannir un membre',
    usage: '@membre [raison]',
    permissions: '4', // BAN_MEMBERS
    cooldown: 3,
    async run(message, args, client, db) {
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return message.reply('❌ Mentionnez un membre.');
      if (!message.member.permissions.has(0x4n)) return message.reply('❌ Permission de bannir requise.');
      const reason = args.slice(1).join(' ') || 'Aucune raison';
      try {
        await target.ban({ reason, deleteMessageSeconds: 86400 });
        try { db.db.prepare('INSERT INTO warnings (guild_id,user_id,mod_id,reason,created_at) VALUES(?,?,?,?,?)').run(message.guild.id, target.id, message.author.id, `[BAN] ${reason}`, Math.floor(Date.now()/1000)); } catch {}
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('🔨 Membre banni').addFields({ name: '👤 Membre', value: `${target.user.username}`, inline: true }, { name: '📋 Raison', value: reason, inline: true }).setTimestamp()] });
      } catch (e) { message.reply(`❌ ${e.message}`); }
    }
  },
  {
    name: 'kick',
    category: 'Modération',
    aliases: ['expulser', 'virer'],
    description: 'Expulser un membre',
    usage: '@membre [raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x2n)) return message.reply('❌ Permission d\'expulser requise.');
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return message.reply('❌ Mentionnez un membre.');
      const reason = args.slice(1).join(' ') || 'Aucune raison';
      try {
        await target.kick(reason);
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#E67E22').setTitle('👢 Membre expulsé').addFields({ name: '👤', value: target.user.username, inline: true }, { name: '📋', value: reason, inline: true }).setTimestamp()] });
      } catch (e) { message.reply(`❌ ${e.message}`); }
    }
  },
  {
    name: 'mute',
    category: 'Modération',
    aliases: ['taire', 'timeout', 'silence'],
    description: 'Mettre en timeout un membre',
    usage: '@membre [durée en minutes] [raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x10000000n)) return message.reply('❌ Permission de mettre en timeout requise.');
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return message.reply('❌ Mentionnez un membre.');
      const mins = parseInt(args[1]) || 10;
      const reason = args.slice(2).join(' ') || 'Aucune raison';
      try {
        await target.timeout(mins * 60000, reason);
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#F1C40F').setTitle('🔇 Membre muté').addFields({ name: '👤', value: target.user.username, inline: true }, { name: '⏱️', value: `${mins} min`, inline: true }, { name: '📋', value: reason, inline: true }).setTimestamp()] });
      } catch (e) { message.reply(`❌ ${e.message}`); }
    }
  },
  {
    name: 'unmute',
    category: 'Modération',
    aliases: ['unsilence', 'untimeout'],
    description: 'Retirer le timeout d\'un membre',
    usage: '@membre',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x10000000n)) return message.reply('❌ Permission de mettre en timeout requise.');
      const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
      if (!target) return message.reply('❌ Mentionnez un membre.');
      await target.timeout(null);
      message.reply(`✅ <@${target.id}> est de nouveau autorisé à parler.`);
    }
  },
  {
    name: 'warn',
    category: 'Modération',
    aliases: ['avertir', 'avertissement'],
    description: 'Avertir un membre',
    usage: '@membre [raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4000n)) return message.reply('❌ Permission de gérer les messages requise.');
      const target = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
      if (!target) return message.reply('❌ Mentionnez un membre.');
      const reason = args.slice(1).join(' ') || 'Aucune raison';
      try { db.db.prepare('INSERT INTO warnings (guild_id,user_id,mod_id,reason,created_at) VALUES(?,?,?,?,?)').run(message.guild.id, target.id, message.author.id, reason, Math.floor(Date.now()/1000)); } catch {}
      const count = db.db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id=? AND user_id=?').get(message.guild.id, target.id);
      message.channel.send({ embeds: [new EmbedBuilder().setColor('#F39C12').setTitle('⚠️ Avertissement').addFields({ name: '👤', value: target.tag, inline: true }, { name: '📋', value: reason, inline: true }, { name: '🔢', value: `**${count.c}** warn(s)`, inline: true }).setTimestamp()] });
    }
  },
  {
    name: 'warns',
    category: 'Modération',
    aliases: ['warnings', 'infractions'],
    description: 'Voir les avertissements d\'un membre',
    usage: '@membre',
    cooldown: 5,
    async run(message, args, client, db) {
      const target = message.mentions.users.first() || message.author;
      const warns = db.db.prepare('SELECT * FROM warnings WHERE guild_id=? AND user_id=? ORDER BY created_at DESC LIMIT 10').all(message.guild.id, target.id);
      if (!warns.length) return message.reply(`✅ **${target.username}** n'a aucun avertissement.`);
      const desc = warns.map((w, i) => `**${i+1}.** ${w.reason} — <@${w.mod_id}> • <t:${w.created_at || 0}:R>`).join('\n');
      message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle(`⚠️ Warns de ${target.username}`).setDescription(desc)] });
    }
  },
  {
    name: 'clearwarns',
    category: 'Modération',
    aliases: ['delwarns', 'supprimerwarns'],
    description: 'Effacer les warns d\'un membre',
    usage: '@membre',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x20n)) return message.reply('❌ Administrateur requis.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Mentionnez un membre.');
      db.db.prepare('DELETE FROM warnings WHERE guild_id=? AND user_id=?').run(message.guild.id, target.id);
      message.reply(`✅ Warns de **${target.username}** effacés.`);
    }
  },
  {
    name: 'purge',
    category: 'Modération',
    aliases: ['clear', 'clean', 'cls', 'supprimer'],
    description: 'Supprimer des messages en masse',
    usage: '[nombre 1-100] [@membre]',
    cooldown: 5,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4000n)) return message.reply('❌ Permission de gérer les messages requise.');
      const amount = Math.min(parseInt(args[0]) || 10, 100);
      if (isNaN(amount) || amount < 1) return message.reply('❌ Nombre entre 1 et 100.');
      const filterMember = message.mentions.members.first();
      await message.delete().catch(() => {});
      let msgs = await message.channel.messages.fetch({ limit: 100 });
      if (filterMember) msgs = msgs.filter(m => m.author.id === filterMember.id);
      const toDelete = [...msgs.values()].slice(0, amount).filter(m => Date.now() - m.createdTimestamp < 14 * 24 * 3600 * 1000);
      const deleted = await message.channel.bulkDelete(toDelete, true);
      const confirm = await message.channel.send(`🗑️ **${deleted.size}** message(s) supprimé(s).`);
      setTimeout(() => confirm.delete().catch(() => {}), 4000);
    }
  },
  {
    name: 'lock',
    category: 'Modération',
    aliases: ['verrouiller', 'fermer'],
    description: 'Verrouiller un salon',
    usage: '[#salon]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x20n)) return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first() || message.channel;
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      message.channel.send(`🔒 <#${channel.id}> verrouillé.`);
    }
  },
  {
    name: 'unlock',
    category: 'Modération',
    aliases: ['deverrouiller', 'ouvrir'],
    description: 'Déverrouiller un salon',
    usage: '[#salon]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x20n)) return message.reply('❌ Administrateur requis.');
      const channel = message.mentions.channels.first() || message.channel;
      await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      message.channel.send(`🔓 <#${channel.id}> déverrouillé.`);
    }
  },
  {
    name: 'slowmode',
    category: 'Modération',
    aliases: ['slow', 'lent'],
    description: 'Activer le mode lent',
    usage: '[secondes 0-21600]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4000n)) return message.reply('❌ Permission de gérer les messages requise.');
      const secs = Math.min(parseInt(args[0]) || 0, 21600);
      await message.channel.setRateLimitPerUser(secs);
      message.reply(secs === 0 ? '✅ Mode lent désactivé.' : `✅ Mode lent : **${secs}s** entre chaque message.`);
    }
  },
  {
    name: 'nick',
    category: 'Modération',
    aliases: ['surnomme', 'pseudonyme', 'rename'],
    description: 'Changer le pseudo d\'un membre',
    usage: '@membre [nouveau pseudo]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x8000000n)) return message.reply('❌ Permission de gérer les pseudos requise.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionnez un membre.');
      const nick = args.slice(1).join(' ') || null;
      await target.setNickname(nick);
      message.reply(`✅ Pseudo de **${target.user.username}** changé en **${nick || '(original)'}**.`);
    }
  },
  {
    name: 'role',
    category: 'Modération',
    aliases: ['addrole', 'removerole', 'giverole'],
    description: 'Donner/retirer un rôle',
    usage: '@membre @role',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x10000000n)) return message.reply('❌ Permission de gérer les rôles requise.');
      const target = message.mentions.members.first();
      const role = message.mentions.roles.first();
      if (!target || !role) return message.reply('❌ Mentionnez un membre et un rôle.');
      if (target.roles.cache.has(role.id)) {
        await target.roles.remove(role);
        message.reply(`✅ Rôle **${role.name}** retiré de **${target.user.username}**.`);
      } else {
        await target.roles.add(role);
        message.reply(`✅ Rôle **${role.name}** donné à **${target.user.username}**.`);
      }
    }
  },
  {
    name: 'unban',
    category: 'Modération',
    aliases: ['debannir'],
    description: 'Débannir un utilisateur par ID',
    usage: '[user_id] [raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4n)) return message.reply('❌ Permission de bannir requise.');
      if (!args[0]) return message.reply('❌ Fournissez l\'ID de l\'utilisateur.');
      try {
        await message.guild.bans.remove(args[0], args.slice(1).join(' ') || 'Débanni');
        message.reply(`✅ Utilisateur \`${args[0]}\` débanni.`);
      } catch { message.reply('❌ ID invalide ou utilisateur non banni.'); }
    }
  },
  {
    name: 'tempban',
    category: 'Modération',
    aliases: ['btemp', 'bantmp'],
    description: 'Bannir temporairement',
    usage: '@membre [durée en heures] [raison]',
    cooldown: 3,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4n)) return message.reply('❌ Permission de bannir requise.');
      const target = message.mentions.members.first();
      if (!target) return message.reply('❌ Mentionnez un membre.');
      const hours = parseInt(args[1]) || 24;
      const reason = args.slice(2).join(' ') || `Tempban ${hours}h`;
      const unbanAt = Math.floor(Date.now() / 1000) + hours * 3600;
      await target.ban({ reason });
      try { db.db.prepare('INSERT OR REPLACE INTO tempbans (guild_id,user_id,mod_id,reason,expires_at) VALUES(?,?,?,?,?)').run(message.guild.id, target.id, message.author.id, reason, unbanAt); } catch {}
      message.channel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setTitle('⏱️ Tempban').addFields({ name: '👤', value: target.user.username, inline: true }, { name: '⏱️', value: `${hours}h`, inline: true }, { name: '🏁', value: `<t:${unbanAt}:R>`, inline: true }).setTimestamp()] });
    }
  },
];

// Exporter chaque commande individuellement
for (const cmd of commands) {
  module.exports = cmd; // Chaque fichier = une commande (mais on group ici)
}

// Pour ce fichier multi-commandes, on exporte toutes les commandes
module.exports = commands;
module.exports.__isMulti = true;
