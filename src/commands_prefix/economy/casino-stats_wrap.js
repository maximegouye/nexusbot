'use strict';
const slashCmd = require('../../commands_guild/economy/casino-stats.js');
const { adapt } = require('../../utils/messageAdapter');

module.exports = {
  name: 'casino-stats',
  aliases: [],
  description: 'Execute the casino-stats command',
  cooldown: slashCmd.cooldown || 3,
  async execute(message, args, client, db) {
    const fake = adapt(message, args, slashCmd.data);
    return slashCmd.execute(fake);
  }
};