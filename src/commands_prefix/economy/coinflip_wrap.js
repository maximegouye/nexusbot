'use strict';
const slashCmd = require('../../commands/economy/coinflip.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'coinflip',
  aliases: [],
  description: 'Execute the coinflip command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};