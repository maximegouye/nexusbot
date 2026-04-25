'use strict';
const slashCmd = require('../../commands_guild/economy/market.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'market',
  aliases: [],
  description: 'Execute the market command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};