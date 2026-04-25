'use strict';
const slashCmd = require('../../commands_guild/economy/gamble.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'gamble',
  aliases: [],
  description: 'Execute the gamble command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};