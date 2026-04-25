/**
 * &casino — Menu unifié du casino, redirige vers /casino via mkFake.
 */
const casinoCmd = require('../../commands_guild/games/casino');

function mkFake(message, opts) {
  opts = opts || {};
  let replied = false, deferred = false;
  const send = async (data) => {
    if (replied || deferred) return message.channel.send(data).catch(() => {});
    replied = true;
    return message.reply(data).catch(() => message.channel.send(data).catch(() => {}));
  };
  return {
    user: message.author, member: message.member,
    guild: message.guild, guildId: message.guildId,
    channel: message.channel, client: message.client,
    get deferred() { return deferred; }, get replied() { return replied; },
    options: {
      getSubcommand: opts.getSubcommand || function() { return null; },
      getUser:    opts.getUser    || function() { return null; },
      getString:  opts.getString  || function() { return null; },
      getInteger: opts.getInteger || function() { return null; },
      getBoolean: opts.getBoolean || function() { return null; },
      getMember:  opts.getMember  || function() { return null; },
      getRole:    opts.getRole    || function() { return null; },
      getChannel: opts.getChannel || function() { return null; },
      getNumber:  opts.getNumber  || function() { return null; },
    },
    deferReply: async function() { deferred = true; },
    editReply:  async function(d) { return send(d); },
    reply:      async function(d) { return send(d); },
    followUp:   async function(d) { return message.channel.send(d).catch(() => {}); },
    update:     async function(d) {},
  };
}

module.exports = {
  name: 'casino',
  aliases: ['games', 'jeux'],
  description: 'Menu unifié du casino — tous les jeux + stats',
  category: 'Jeux',
  cooldown: 3,

  async execute(message, args) {
    const sub = args[0] || 'menu';
    const fake = mkFake(message, {
      getSubcommand: () => sub,
    });
    await casinoCmd.execute(fake);
  },
};
