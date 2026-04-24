'use strict';

const path = require('path');
const fs   = require('fs');
const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const PREFIX = '&';

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
        return cleanArgs[0] ?? null;
      },
      getInteger(name, required = false) {
        const v = parseInt(cleanArgs[0]);
        return isNaN(v) ? null : v;
      },
      getNumber(name, required = false) {
        const v = parseFloat(cleanArgs[0]);
        return isNaN(v) ? null : v;
      },
      getUser(name, required = false) {
        return mentionedUser;
      },
      getMember(name, required = false) {
        return mentionedMember;
      },
      getBoolean(name, required = false) {
        const v = (cleanArgs[0] ?? '').toLowerCase();
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
    const mention = message.mentions.users.first();
    const amount  = parseInt(args.find(a => !/<@/.test(a)) ?? '');
    if (!mention || isNaN(amount) || amount <= 0) {
      await message.reply('Usage : `&donner @membre montant`');
      return true;
    }
    try {
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?,?)').run(mention.id, guildId);
      db.db.prepare('UPDATE users SET balance = balance + ? WHERE user_id = ? AND guild_id = ?').run(amount, mention.id, guildId);
      await message.reply('**' + mention.username + '** a recu **' + amount.toLocaleString('fr-FR') + '** coins.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'retirer' || cmd === 'remove' || cmd === 'enlever') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    const mention = message.mentions.users.first();
    const amount  = parseInt(args.find(a => !/<@/.test(a)) ?? '');
    if (!mention || isNaN(amount) || amount <= 0) {
      await message.reply('Usage : `&retirer @membre montant`');
      return true;
    }
    try {
      db.db.prepare('INSERT OR IGNORE INTO users (user_id, guild_id) VALUES (?,?)').run(mention.id, guildId);
      db.db.prepare('UPDATE users SET balance = MAX(0, balance - ?) WHERE user_id = ? AND guild_id = ?').run(amount, mention.id, guildId);
      await message.reply('**' + amount.toLocaleString('fr-FR') + '** coins retires a **' + mention.username + '**.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'reset') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    const mention = message.mentions.users.first();
    if (!mention) { await message.reply('Usage : `&reset @membre`'); return true; }
    try {
      db.db.prepare('UPDATE users SET balance = 0, bank = 0 WHERE user_id = ? AND guild_id = ?').run(mention.id, guildId);
      await message.reply('Compte de **' + mention.username + '** remis a zero.');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'solde' || cmd === 'bal') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    const mention = message.mentions.users.first();
    if (!mention) { await message.reply('Usage : `&solde @membre`'); return true; }
    try {
      const row = db.db.prepare('SELECT balance, bank FROM users WHERE user_id = ? AND guild_id = ?').get(mention.id, guildId);
      const bal  = row && row.balance ? row.balance : 0;
      const bank = row && row.bank    ? row.bank    : 0;
      await message.reply('**' + mention.username + '** - Portefeuille : **' + bal.toLocaleString('fr-FR') + '** | Banque : **' + bank.toLocaleString('fr-FR') + '** coins');
    } catch(e) { await message.reply('Erreur DB: ' + e.message); }
    return true;
  }

  if (cmd === 'cooldown' || cmd === 'cd') {
    if (!isAdmin) { await message.reply('Reserves aux administrateurs.'); return true; }
    const mention = message.mentions.users.first();
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
        '`&donner @membre montant` - Donner des coins',
        '`&retirer @membre montant` - Retirer des coins',
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
    if (!message.content.startsWith(PREFIX)) return;
    if (!message.guild) return;

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
      message.reply('Erreur lors de l\'execution. Essaie la commande slash `/'.concat(cmdName, '` a la place.')).catch(() => {});
    }
  },
};
