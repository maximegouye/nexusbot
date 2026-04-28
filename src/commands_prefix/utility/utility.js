const { EmbedBuilder } = require('discord.js');

const commands = [
  {
    name: 'help',
    aliases: ['aide', 'commands', 'cmds', 'h', '?'],
    description: 'Liste toutes les commandes disponibles',
    category: 'Utilitaire',
    cooldown: 5,
    async run(message, args, client, db) {
      const cfg = db.getConfig(message.guild.id);
      const prefix = cfg.prefix || 'n!';
      const { prefixCommands } = require('../../utils/prefixHandler');

      // Si un argument est fourni, montrer l'aide d'une commande spécifique
      if (args.length > 0) {
        const cmdName = args[0].toLowerCase();
        const cmd = prefixCommands.get(cmdName);
        if (!cmd) return message.reply(`❌ Commande **${cmdName}** non trouvée.`);

        const embed = new EmbedBuilder()
          .setColor('#7B2FBE')
          .setTitle(`📖 Aide — ${cmd.name}`)
          .setDescription(cmd.description || 'Pas de description.')
          .addFields(
            { name: '📝 Alias', value: cmd.aliases?.join(', ') || 'Aucun', inline: true },
            { name: '⏱️ Cooldown', value: `${cmd.cooldown || 'Aucun'}s`, inline: true },
            { name: '💡 Usage', value: `\`${prefix}${cmd.name} ${cmd.usage || ''}\`` }
          )
          .setFooter({ text: 'NexusBot v2 — Meilleur bot Discord' });
        return message.channel.send({ embeds: [embed] });
      }

      const categories = new Map();
      for (const [name, cmd] of prefixCommands) {
        const cat = cmd.category || 'Général';
        if (!categories.has(cat)) categories.set(cat, []);
        categories.get(cat).push(name);
      }

      const embed = new EmbedBuilder()
        .setColor('#7B2FBE')
        .setTitle('📋 NexusBot — Commandes Préfixées')
        .setDescription(`Préfixe : \`${prefix}\` ou \`n!\`\n\nTotal : **${prefixCommands.size}** commandes préfixées + **${client.commands.size}** slash commands\n\nUtilisez \`${prefix}help [commande]\` pour les détails.`);

      for (const [cat, cmds] of categories) {
        embed.addFields({
          name: `📁 ${cat}`,
          value: cmds.slice(0, 20).map(c => `\`${c}\``).join(' ')
        });
      }

      embed.setFooter({ text: 'NexusBot v2 — Meilleur bot Discord' });
      message.channel.send({ embeds: [embed] });
    }
  },
  {
    name: 'prefix',
    aliases: ['setprefix', 'changeprefix'],
    description: 'Changer le préfixe du serveur (Admin)',
    category: 'Utilitaire',
    usage: '[nouveau préfixe]',
    cooldown: 5,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x20n)) return message.reply('❌ Administrateur requis.');
      const newPrefix = args[0];
      if (!newPrefix || newPrefix.length > 5) return message.reply('❌ Préfixe valide de 1-5 caractères requis.');
      db.setConfig(message.guild.id, 'prefix', newPrefix);
      message.reply(`✅ Préfixe changé en \`${newPrefix}\`. Commandes : \`${newPrefix}help\``);
    }
  },
  {
    name: 'embed',
    aliases: ['say', 'announce', 'msg'],
    description: 'Envoyer un message embed',
    category: 'Utilitaire',
    usage: '[titre] | [description] | [couleur]',
    cooldown: 5,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4000n)) return message.reply('❌ Permission de gérer les messages requise.');
      const parts = args.join(' ').split('|').map(s => s.trim());
      const title = parts[0] || 'Message';
      const desc = parts[1] || '';
      const color = parts[2] || '#7B2FBE';
      await message.delete().catch(() => {});
      message.channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setTimestamp()] });
    }
  },
  {
    name: 'poll',
    aliases: ['vote', 'sondage'],
    description: 'Créer un sondage rapide',
    category: 'Utilitaire',
    usage: '[question] | [option1] | [option2] ...',
    cooldown: 10,
    async run(message, args) {
      const parts = args.join(' ').split('|').map(s => s.trim());
      const question = parts[0];
      const options = parts.slice(1, 11);
      if (!question) return message.reply('❌ Donnez une question. Séparation des options avec `|`');
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
      await message.delete().catch(() => {});
      if (!options.length) {
        const m = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('📊 Sondage').setDescription(question).setFooter({ text: `Sondage par ${message.author.username}` })] });
        await m.react('👍'); await m.react('👎'); await m.react('🤷');
      } else {
        const desc = options.map((o, i) => `${emojis[i]} ${o}`).join('\n');
        const m = await message.channel.send({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('📊 Sondage').setDescription(`**${question}**\n\n${desc}`).setFooter({ text: `Sondage par ${message.author.username}` })] });
        for (let i = 0; i < options.length; i++) await m.react(emojis[i]).catch(() => {});
      }
    }
  },
  {
    name: 'remind',
    aliases: ['remindme', 'rappel', 'timer'],
    description: 'Se créer un rappel',
    category: 'Utilitaire',
    usage: '[durée] [message]',
    cooldown: 5,
    async run(message, args, client, db) {
      const timeStr = args[0];
      const msg = args.slice(1).join(' ');
      if (!timeStr || !msg) return message.reply('❌ Usage : `&remind 1h30m [message]`');
      let secs = 0;
      const matches = timeStr.match(/(\d+)\s*([jhdms])/gi) || [];
      for (const m of matches) {
        const val = parseInt(m);
        const unit = m.replace(/\d+/g, '').toLowerCase();
        if (unit === 'j') secs += val * 86400;
        else if (unit === 'h') secs += val * 3600;
        else if (unit === 'm') secs += val * 60;
        else if (unit === 's') secs += val;
      }
      if (secs < 5) return message.reply('❌ Durée minimum : 5 secondes. Ex: `1h30m`, `2d`, `45m`');
      const triggerAt = Math.floor(Date.now() / 1000) + secs;
      try { db.db.prepare('INSERT INTO reminders (guild_id, user_id, channel_id, message, trigger_at) VALUES(?,?,?,?,?)').run(message.guild.id, message.author.id, message.channel.id, msg, triggerAt); } catch {}
      message.reply(`⏰ Rappel créé ! Je vous enverrai : *"${msg}"* <t:${triggerAt}:R>`);
    }
  },
  {
    name: 'calc',
    aliases: ['calculer', 'math', 'calculate'],
    description: 'Calculatrice',
    category: 'Utilitaire',
    usage: '[expression]',
    cooldown: 3,
    async run(message, args) {
      const expr = args.join(' ').replace(/[^0-9+\-*/.() %^]/g, '');
      if (!expr) return message.reply('❌ Donnez une expression. Ex: `n!calc 25 * 4 + 10`');
      try {
        // Évaluation sécurisée (pas d'exec)
        const result = Function('"use strict"; return (' + expr + ')')();
        if (typeof result !== 'number' || !isFinite(result)) throw new Error('Résultat invalide');
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#3498DB').setTitle('🧮 Calculatrice').addFields({ name: '📝 Expression', value: `\`${expr}\``, inline: true }, { name: '✅ Résultat', value: `**${result}**`, inline: true })] });
      } catch { message.reply('❌ Expression invalide.'); }
    }
  },
  {
    name: 'urban',
    aliases: ['ud', 'definition', 'define'],
    description: 'Définition Urban Dictionary',
    category: 'Utilitaire',
    usage: '[mot]',
    cooldown: 5,
    async run(message, args) {
      if (!args.length) return message.reply('❌ Donnez un mot.');
      const term = args.join(' ');
      try {
        const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
        const data = await res.json();
        if (!data.list?.length) return message.reply(`❌ Aucune définition pour **${term}**.`);
        const def = data.list[0];
        message.channel.send({ embeds: [new EmbedBuilder().setColor('#FFD700').setTitle(`📖 ${def.word}`).setDescription(def.definition?.slice(0, 1024) || 'Pas de définition.').addFields({ name: '💡 Exemple', value: def.example?.slice(0, 512) || 'Aucun exemple.' }).setURL(def.permalink)] });
      } catch { message.reply('❌ Erreur lors de la recherche.'); }
    }
  },
  {
    name: 'color',
    aliases: ['couleur', 'hex', 'rgb'],
    description: 'Afficher une couleur HEX',
    category: 'Utilitaire',
    usage: '#RRGGBB ou R G B',
    cooldown: 3,
    async run(message, args) {
      let hex;
      if (args[0]?.startsWith('#')) hex = args[0].replace('#', '');
      else if (args.length >= 3) hex = [parseInt(args[0]), parseInt(args[1]), parseInt(args[2])].map(n => n.toString(16).padStart(2, '0')).join('');
      else return message.reply('❌ Usage : `n!color #FF6B6B` ou `n!color 255 107 107`');
      if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return message.reply('❌ Couleur HEX invalide.');
      const r = parseInt(hex.slice(0,2), 16), g = parseInt(hex.slice(2,4), 16), b = parseInt(hex.slice(4,6), 16);
      message.channel.send({ embeds: [new EmbedBuilder().setColor(`#${hex.toUpperCase()}`).setTitle(`🎨 Couleur #${hex.toUpperCase()}`).addFields({ name: '🔴 R', value: `${r}`, inline: true }, { name: '🟢 G', value: `${g}`, inline: true }, { name: '🔵 B', value: `${b}`, inline: true }).setDescription(`HEX: **#${hex.toUpperCase()}** | RGB: **${r}, ${g}, ${b}**`)] });
    }
  },
  {
    name: 'snipe',
    aliases: ['sniper'],
    description: 'Voir le dernier message supprimé',
    category: 'Utilitaire',
    cooldown: 5,
    async run(message) {
      return message.reply('❌ Fonctionnalité snipe non disponible sur ce serveur.');
    }
  },
  {
    name: 'inrole',
    aliases: ['rolemembers', 'membres-role'],
    description: 'Liste les membres ayant un rôle',
    category: 'Utilitaire',
    usage: '@role',
    cooldown: 10,
    async run(message, args) {
      const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);
      if (!role) return message.reply('❌ Mentionnez un rôle valide.');
      const members = role.members.map(m => `<@${m.id}>`).join(', ') || 'Aucun membre.';
      message.channel.send({ embeds: [new EmbedBuilder().setColor(role.hexColor || '#7B2FBE').setTitle(`👥 Membres avec @${role.name}`).setDescription(members.slice(0, 2048)).setFooter({ text: `${role.members.size} membre(s)` })] });
    }
  },
  {
    name: 'giveaway',
    aliases: ['ga', 'gaw', 'tirage'],
    description: 'Lancer un giveaway rapide',
    category: 'Utilitaire',
    usage: '[durée] [prix]',
    cooldown: 10,
    async run(message, args, client, db) {
      if (!message.member.permissions.has(0x4000n)) return message.reply('❌ Permission de gérer les messages requise.');
      if (args.length < 2) return message.reply('❌ Usage : `&giveaway 1h PlayStation 5`');
      const timeStr = args[0];
      const prize = args.slice(1).join(' ');
      let secs = 0;
      const timeMatches = timeStr.match(/(\d+)\s*([jhdm])/gi) || [];
      for (const m of timeMatches) {
        const val = parseInt(m);
        const unit = m.replace(/\d+/g, '').toLowerCase();
        if (unit === 'j') secs += val * 86400; else if (unit === 'h') secs += val * 3600; else if (unit === 'm') secs += val * 60;
      }
      if (secs < 60) return message.reply('❌ Durée minimum 1 minute.');
      const endsAt = Math.floor(Date.now() / 1000) + secs;
      await message.delete().catch(() => {});
      const embed = new EmbedBuilder().setColor('#FFD700').setTitle('🎉 GIVEAWAY !').setDescription(`**Prix :** ${prize}\n\nRéagissez avec 🎉 pour participer !\n\n**Fin :** <t:${endsAt}:R>`).setFooter({ text: `Organisé par ${message.author.username}` }).setTimestamp(new Date(endsAt * 1000));
      const m = await message.channel.send({ embeds: [embed] });
      await m.react('🎉');
      try { db.db.prepare('INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winners, ends_at, host_id) VALUES(?,?,?,?,?,?,?)').run(message.guild.id, message.channel.id, m.id, prize, 1, endsAt, message.author.id); } catch {}
    }
  },
];

module.exports = commands;
module.exports.__isMulti = true;
